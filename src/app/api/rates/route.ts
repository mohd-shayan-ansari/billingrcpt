import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const rateSchema = z.object({
  andar: z.number().int().nonnegative(),
  bahar: z.number().int().nonnegative(),
  result: z.number().int().nonnegative(),
});

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rates = await prisma.rate.findMany();
  return NextResponse.json({ rates });
}

export async function PUT(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = rateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rates" }, { status: 400 });
  }

  const items = Object.entries(parsed.data);

  await Promise.all(
    items.map(([itemKey, rate]) =>
      prisma.rate.upsert({
        where: { itemKey },
        update: { rate },
        create: {
          itemKey,
          label: itemKey[0].toUpperCase() + itemKey.slice(1),
          rate,
        },
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}