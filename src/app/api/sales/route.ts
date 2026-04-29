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

    let grandTotal = 0;
    const salesData = groupedSales.map((group) => {
      const total = group._sum.totalAmount || 0;
      grandTotal += total;
      return {
        heading: group.heading || "Unknown Counter",
        total,
      };
    });

    return NextResponse.json({ salesData, grandTotal, date: dateStr || startDate.toISOString().split("T")[0] });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    return NextResponse.json({ error: "Failed to fetch sales data" }, { status: 500 });
  }
}
