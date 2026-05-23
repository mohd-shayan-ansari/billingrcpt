import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "missing date" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        COALESCE(SUM(r."totalAmount"), 0) AS gross_total,
        COUNT(*) AS receipt_count
      FROM "Receipt" r
      WHERE DATE(r.timestamp AT TIME ZONE 'Asia/Kolkata') = CAST(${date} AS DATE)
    `) as Array<{
      gross_total?: number | bigint;
      grossTotal?: number | bigint;
      receipt_count?: number | bigint;
      count?: number | bigint;
    }>;

    const raw = rows[0] ?? {};
    const toNumber = (v: number | bigint | undefined | null) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));
    const grossTotal = toNumber(raw.gross_total ?? raw.grossTotal ?? 0);
    const receiptCount = toNumber(raw.receipt_count ?? raw.count ?? 0);

    return NextResponse.json({ grossTotal, receiptCount, date });
  } catch (error) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
