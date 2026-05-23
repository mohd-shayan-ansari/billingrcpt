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
    `);

    const grossTotal = Number(rows[0].gross_total ?? rows[0].grossTotal ?? 0);
    const receiptCount = Number(rows[0].receipt_count ?? rows[0].count ?? 0);

    return NextResponse.json({ grossTotal, receiptCount, date });
  } catch (error) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
