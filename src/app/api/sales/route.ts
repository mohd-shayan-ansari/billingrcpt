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
    const groupedSales = await prisma.$queryRaw<Array<{ heading: string | null; grossTotal: bigint | number }>>(Prisma.sql`
      SELECT
        r.heading,
        COALESCE(SUM(r."totalAmount"), 0) AS "grossTotal"
      FROM "Receipt" r
      WHERE DATE(r.timestamp AT TIME ZONE 'Asia/Kolkata') = ${reportDate}
      GROUP BY r.heading
      ORDER BY r.heading ASC
    `);

    const winnerDeductions = await prisma.winnerDeduction.findMany({
      where: { date: reportDate },
      select: {
        counterHeading: true,
        amount: true,
      },
    });

    const grossMap = new Map<string, number>();
    for (const group of groupedSales) {
      const grossTotal = typeof group.grossTotal === "bigint" ? Number(group.grossTotal) : Number(group.grossTotal ?? 0);
      grossMap.set(group.heading || "Unknown Counter", grossTotal);
    }

    const deductionMap = new Map<string, number>();
    for (const entry of winnerDeductions) {
      deductionMap.set(entry.counterHeading, (deductionMap.get(entry.counterHeading) ?? 0) + entry.amount);
    }

    const headings = Array.from(new Set([...grossMap.keys(), ...deductionMap.keys()])).sort((left, right) => left.localeCompare(right));

    let grandTotal = 0;
    const salesData = headings.map((heading) => {
      const grossTotal = grossMap.get(heading) ?? 0;
      const deductionTotal = deductionMap.get(heading) ?? 0;
      const netTotal = grossTotal - deductionTotal;
      grandTotal += netTotal;
      return {
        heading,
        grossTotal,
        deductionTotal,
        netTotal,
      };
    });

    return NextResponse.json({ salesData, grandTotal, date: reportDate });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    return NextResponse.json({ error: "Failed to fetch sales data" }, { status: 500 });
  }
}
