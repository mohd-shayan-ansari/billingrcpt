import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";

import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const winnerSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotId: z.string().min(1),
  slotLabel: z.string().min(1),
  counterHeading: z.string().min(1),
  amount: z.number().int().positive(),
});

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session || session.role !== Role.MASTER_ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (!date) {
    return NextResponse.json({ winners: [] });
  }

  const winners = await prisma.winnerDeduction.findMany({
    where: { date },
    orderBy: [{ slotId: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ winners });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session || session.role !== Role.MASTER_ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = winnerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid winner payload" }, { status: 400 });
  }

  const winner = await prisma.winnerDeduction.create({
    data: parsed.data,
  });

  return NextResponse.json({ winner }, { status: 201 });
}