import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const heading = url.searchParams.get("heading") ?? undefined;

  function getCounterNumber(heading?: string) {
    if (!heading) return 1;
    const match = heading.match(/\d+/);
    if (!match) return 1;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  function toCounterPrefix(counterNumber: number) {
    let value = Math.max(1, counterNumber);
    let letters = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      letters = String.fromCharCode(65 + remainder) + letters;
      value = Math.floor((value - 1) / 26);
    }
    return letters;
  }

  const counterNumber = getCounterNumber(heading ?? undefined);
  const counterPrefix = toCounterPrefix(counterNumber);

  const likePattern = `${counterPrefix}%`;
  const substrStart = counterPrefix.length + 1;

  const [sequenceRow] = await prisma.$queryRaw<Array<{ last_seq: number | null }>>(Prisma.sql`
    SELECT MAX(CAST(SUBSTR("receiptNumber", ${substrStart}) AS INTEGER)) AS last_seq
    FROM "Receipt"
    WHERE "receiptNumber" LIKE ${likePattern}
  `);

  const rawLast = sequenceRow?.last_seq ?? 0;
  const lastSeq = typeof rawLast === "bigint" ? Number(rawLast) : Number(rawLast || 0);
  const nextSequence = lastSeq + 1;
  const receiptNumber = `${counterPrefix}${String(nextSequence).padStart(2, "0")}`;

  return NextResponse.json({ receiptNumber, nextSequence });
}
