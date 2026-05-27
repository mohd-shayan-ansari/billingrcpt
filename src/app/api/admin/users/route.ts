import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { getSessionFromRequest, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  name: z.string().min(2),
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
    select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
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

  // generate a username from name (slug) and ensure uniqueness
  const base = parsed.data.name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "") || "user";
  let username = base;
  let suffix = 1;
  // loop to avoid collisions
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${base}${suffix++}`;
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      username,
      passwordHash: await hashPassword(parsed.data.password),
      role: Role.COUNTER_ADMIN,
      isActive: true,
    },
    select: { id: true, name: true, username: true, role: true, isActive: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}