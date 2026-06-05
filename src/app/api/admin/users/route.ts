import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { getSessionFromRequest, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  password: z.string().min(6),
});

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session || session.role !== "MASTER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: Role.COUNTER_ADMIN },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session || session.role !== "MASTER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Calculate the next counter number
  const counters = await prisma.user.findMany({
    where: { role: Role.COUNTER_ADMIN },
    select: { name: true },
  });

  let maxCounterNum = 0;
  for (const counter of counters) {
    const match = counter.name.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxCounterNum) {
        maxCounterNum = num;
      }
    }
  }
  
  const nextCounterNum = maxCounterNum + 1;
  const newName = `Counter ${nextCounterNum}`;
  const newUsername = `counter${nextCounterNum}@billing.local`;

  const user = await prisma.user.create({
    data: {
      name: newName,
      username: newUsername,
      passwordHash: await hashPassword(parsed.data.password),
      role: Role.COUNTER_ADMIN,
      isActive: true,
    },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}