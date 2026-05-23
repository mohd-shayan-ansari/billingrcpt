import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session || session.role !== Role.MASTER_ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateStr = url.searchParams.get("date");

  const reportDate = dateStr ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  try {
    // Fetch receipts in a window around the date and compute local date in JS
    // to avoid Postgres timestamp/timestamptz inconsistencies. Group by heading
    // using the same Asia/Kolkata local date logic used across the app.
    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT r.heading, r.timestamp, r."totalAmount"
      FROM "Receipt" r
      WHERE r.timestamp >= (CAST(${reportDate} AS DATE) - INTERVAL '1 day')
        AND r.timestamp < (CAST(${reportDate} AS DATE) + INTERVAL '2 day')
    `);

    const grossMap = new Map<string, number>();
    const toNumber = (v: number | bigint | undefined | null) => (typeof v === 'bigint' ? Number(v) : Number(v ?? 0));
    for (const r of rows) {
      try {
        const ts = String(r.timestamp);
        const d = new Date(ts);
        const localDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (localDate !== reportDate) continue;
        const heading = (r.heading as string) || 'Unknown Counter';
        const amt = toNumber(r.totalAmount as any);
        grossMap.set(heading, (grossMap.get(heading) ?? 0) + amt);
      } catch (e) {
        // ignore malformed rows
      }
    }

    const winnerDeductions = await prisma.winnerDeduction.findMany({
      where: { date: reportDate },
      select: {
        counterHeading: true,
        amount: true,
      },
    });

    const deductionMap = new Map<string, number>();
    for (const entry of winnerDeductions) {
      deductionMap.set(entry.counterHeading, (deductionMap.get(entry.counterHeading) ?? 0) + entry.amount);
    }

    const headings = Array.from(new Set([...grossMap.keys(), ...deductionMap.keys()])).sort((left, right) => left.localeCompare(right));

    let grandTotal = 0;
    let grossOverall = 0;
    const salesData = headings.map((heading) => {
      const grossTotal = grossMap.get(heading) ?? 0;
      const deductionTotal = deductionMap.get(heading) ?? 0;
      const netTotal = grossTotal - deductionTotal;
      grossOverall += grossTotal;
      grandTotal += netTotal;
      return {
        heading,
        grossTotal,
        deductionTotal,
        netTotal,
      };
    });

    return NextResponse.json({ salesData, grandTotal, grossTotal: grossOverall, date: reportDate });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    return NextResponse.json({ error: "Failed to fetch sales data" }, { status: 500 });
  }
}
