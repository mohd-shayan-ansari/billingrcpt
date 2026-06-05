import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";

import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const winningResultSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotId: z.string().min(1),
  slotLabel: z.string().min(1),
  number: z.string().regex(/^\d{2}$/, "Winning number must be exactly 2 digits (00-99)"),
});

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session || session.role !== Role.MASTER_ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (!date) {
    return NextResponse.json({ winningResults: [] });
  }

  const winningResults = await prisma.winningResult.findMany({
    where: { date },
    orderBy: { slotId: "asc" },
  });

  return NextResponse.json({ winningResults });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session || session.role !== Role.MASTER_ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = winningResultSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
  }

  const { date, slotId, slotLabel, number } = parsed.data;

  // Upsert to ensure only one winning result per slot
  const result = await prisma.winningResult.upsert({
    where: {
      date_slotId: {
        date,
        slotId,
      },
    },
    update: {
      number,
      slotLabel,
    },
    create: {
      date,
      slotId,
      slotLabel,
      number,
    },
  });

  return NextResponse.json({ winningResult: result }, { status: 201 });
}
