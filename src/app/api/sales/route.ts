import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session || session.role !== Role.MASTER_ADMIN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateStr = url.searchParams.get("date");

  let startDate: Date;
  let endDate: Date;

  if (dateStr) {
    // Expecting YYYY-MM-DD
    startDate = new Date(`${dateStr}T00:00:00.000`);
    endDate = new Date(`${dateStr}T23:59:59.999`);
  } else {
    // Default to today
    const now = new Date();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  try {
    const groupedSales = await prisma.receipt.groupBy({
      by: ["heading"],
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        heading: "asc",
      },
    });

    const reportDate = dateStr || startDate.toISOString().split("T")[0];
    const winnerDeductions = await prisma.winnerDeduction.findMany({
      where: { date: reportDate },
      select: {
        counterHeading: true,
        amount: true,
      },
    });

    const grossMap = new Map<string, number>();
    for (const group of groupedSales) {
      grossMap.set(group.heading || "Unknown Counter", group._sum.totalAmount || 0);
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
