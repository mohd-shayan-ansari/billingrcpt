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

    // Fetch receipts in a 48-hour window around the requested date and compute
    // local date in JS using Asia/Kolkata timezone. This avoids mismatches caused
    // by mixed timestamp types in the DB and ensures consistency with the
    // receipts API which also computes localDate server-side.
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT r."receiptNumber", r.heading, r.timestamp, r."totalAmount"
      FROM "Receipt" r
      WHERE r.timestamp >= (CAST(${date} AS DATE) - INTERVAL '1 day')
        AND r.timestamp < (CAST(${date} AS DATE) + INTERVAL '2 day')
    `);

    const toNumber = (v: number | bigint | undefined | null) => (typeof v === 'bigint' ? Number(v) : Number(v ?? 0));
    let grossTotal = 0;
    let receiptCount = 0;

    for (const row of rows) {
      try {
        const ts = String(row.timestamp);
        const d = new Date(ts);
        const localDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (localDate === date) {
          grossTotal += toNumber(row.totalAmount as any);
          receiptCount += 1;
        }
      } catch (e) {
        // ignore malformed rows
      }
    }

    return NextResponse.json({ grossTotal, receiptCount, date });
  } catch (error) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
