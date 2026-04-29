import { NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCode } from "@/lib/receipt";

const createReceiptSchema = z.object({
  heading: z.string().optional(),
  entries: z.array(
    z.object({
      itemKey: z.enum(["andar", "bahar", "result"]),
      code: z.string().optional(),
      qty: z.number().int().positive().default(1),
    }),
  ).min(1),
});

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";

  const like = `%${search}%`;
  let whereClause = Prisma.empty;

  if (session.role !== Role.MASTER_ADMIN && search) {
    whereClause = Prisma.sql`WHERE r.adminId = ${session.id} AND (
      r.receiptNumber LIKE ${like}
      OR COALESCE(r.heading, '') LIKE ${like}
      OR a.name LIKE ${like}
      OR a.username LIKE ${like}
    )`;
  } else if (session.role !== Role.MASTER_ADMIN) {
    whereClause = Prisma.sql`WHERE r.adminId = ${session.id}`;
  } else if (search) {
    whereClause = Prisma.sql`WHERE (
      r.receiptNumber LIKE ${like}
      OR COALESCE(r.heading, '') LIKE ${like}
      OR a.name LIKE ${like}
      OR a.username LIKE ${like}
    )`;
  }

  const receipts = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      r.id,
      r.receiptNumber,
      r.heading,
      r.timestamp,
      r.adminId,
      a.id AS admin_id,
      a.name AS admin_name,
      a.username AS admin_username,
      a.role AS admin_role,
      r.andarCode,
      r.andarRate,
      r.andarQty,
      r.andarAmount,
      r.baharCode,
      r.baharRate,
      r.baharQty,
      r.baharAmount,
      r.resultCode,
      r.resultRate,
      r.resultQty,
      r.resultAmount,
      r.totalAmount
    FROM Receipt r
    JOIN User a ON a.id = r.adminId
    ${whereClause}
    ORDER BY r.timestamp DESC
    LIMIT 100
  `);

  const normalizedReceipts = receipts.map((receipt) => ({
    id: String(receipt.id),
    receiptNumber: String(receipt.receiptNumber),
    heading: receipt.heading === null ? null : String(receipt.heading),
    timestamp: String(receipt.timestamp),
    admin: {
      id: String(receipt.admin_id),
      name: String(receipt.admin_name),
      username: String(receipt.admin_username),
      role: String(receipt.admin_role) as Role,
    },
    andarCode: receipt.andarCode === null ? null : String(receipt.andarCode),
    andarRate: receipt.andarRate === null ? null : Number(receipt.andarRate),
    andarQty: Number(receipt.andarQty ?? 0),
    andarAmount: Number(receipt.andarAmount ?? 0),
    baharCode: receipt.baharCode === null ? null : String(receipt.baharCode),
    baharRate: receipt.baharRate === null ? null : Number(receipt.baharRate),
    baharQty: Number(receipt.baharQty ?? 0),
    baharAmount: Number(receipt.baharAmount ?? 0),
    resultCode: receipt.resultCode === null ? null : String(receipt.resultCode),
    resultRate: receipt.resultRate === null ? null : Number(receipt.resultRate),
    resultQty: Number(receipt.resultQty ?? 0),
    resultAmount: Number(receipt.resultAmount ?? 0),
    totalAmount: Number(receipt.totalAmount ?? 0),
  }));

  return NextResponse.json({ receipts: normalizedReceipts });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createReceiptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid receipt payload" }, { status: 400 });
  }

  const rates = await prisma.rate.findMany();
  const rateMap = Object.fromEntries(rates.map((rate) => [rate.itemKey, rate.rate])) as Record<string, number>;

  const andarRate = rateMap.andar ?? 12;
  const baharRate = rateMap.bahar ?? 55;
  const resultRate = rateMap.result ?? 110;

  const normalizedEntries = parsed.data.entries
    .map((entry) => {
      const code = entry.code ? normalizeCode(entry.itemKey, entry.code) : "";
      if (!code) {
        return null;
      }

      const rate = entry.itemKey === "andar" ? andarRate : entry.itemKey === "bahar" ? baharRate : resultRate;
      return {
        itemKey: entry.itemKey,
        code,
        qty: entry.qty,
        rate,
        amount: rate * entry.qty,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (normalizedEntries.length === 0) {
    return NextResponse.json({ error: "Select at least one valid entry" }, { status: 400 });
  }

  const grouped = {
    andar: { codes: [] as string[], qty: 0, amount: 0 },
    bahar: { codes: [] as string[], qty: 0, amount: 0 },
    result: { codes: [] as string[], qty: 0, amount: 0 },
  };

  for (const entry of normalizedEntries) {
    grouped[entry.itemKey].codes.push(entry.code);
    grouped[entry.itemKey].qty += entry.qty;
    grouped[entry.itemKey].amount += entry.amount;
  }

  const andarQty = grouped.andar.qty;
  const baharQty = grouped.bahar.qty;
  const resultQty = grouped.result.qty;
  const andarAmount = grouped.andar.amount;
  const baharAmount = grouped.bahar.amount;
  const resultAmount = grouped.result.amount;
  const andarActive = andarQty > 0;
  const baharActive = baharQty > 0;
  const resultActive = resultQty > 0;
  const andarCode = grouped.andar.codes.length ? Array.from(new Set(grouped.andar.codes)).join(",") : "";
  const baharCode = grouped.bahar.codes.length ? Array.from(new Set(grouped.bahar.codes)).join(",") : "";
  const resultCode = grouped.result.codes.length ? Array.from(new Set(grouped.result.codes)).join(",") : "";
  const totalAmount = andarAmount + baharAmount + resultAmount;
  const counterNumber = getCounterNumber(parsed.data.heading);
  const counterPrefix = toCounterPrefix(counterNumber);

  const likePattern = `${counterPrefix}%`;
  const substrStart = counterPrefix.length + 1; // SQLite SUBSTR is 1-based
  const [sequenceRow] = await prisma.$queryRaw<Array<{ last_seq: number | null }>>(Prisma.sql`
    SELECT MAX(CAST(SUBSTR(receiptNumber, ${substrStart}) AS INTEGER)) AS last_seq
    FROM Receipt
    WHERE receiptNumber LIKE ${likePattern}
  `);

  const rawLast = sequenceRow?.last_seq ?? 0;
  const lastSeq = typeof rawLast === "bigint" ? Number(rawLast) : Number(rawLast || 0);
  const nextSequence = lastSeq + 1;
  const receiptNumber = `${counterPrefix}${String(nextSequence).padStart(2, "0")}`;

  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO Receipt (
      id,
      receiptNumber,
      heading,
      adminId,
      timestamp,
      andarCode,
      andarRate,
      andarQty,
      andarAmount,
      baharCode,
      baharRate,
      baharQty,
      baharAmount,
      resultCode,
      resultRate,
      resultQty,
      resultAmount,
      totalAmount,
      createdAt,
      updatedAt
    ) VALUES (
      ${crypto.randomUUID()},
      ${receiptNumber},
      ${parsed.data.heading?.trim() || null},
      ${session.id},
      CURRENT_TIMESTAMP,
      ${andarCode || null},
      ${andarActive ? andarRate : null},
      ${andarQty},
      ${andarAmount},
      ${baharCode || null},
      ${baharActive ? baharRate : null},
      ${baharQty},
      ${baharAmount},
      ${resultCode || null},
      ${resultActive ? resultRate : null},
      ${resultQty},
      ${resultAmount},
      ${totalAmount},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  const [receipt] = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      r.id,
      r.receiptNumber,
      r.heading,
      r.timestamp,
      r.adminId,
      a.id AS admin_id,
      a.name AS admin_name,
      a.username AS admin_username,
      a.role AS admin_role,
      r.andarCode,
      r.andarRate,
      r.andarQty,
      r.andarAmount,
      r.baharCode,
      r.baharRate,
      r.baharQty,
      r.baharAmount,
      r.resultCode,
      r.resultRate,
      r.resultQty,
      r.resultAmount,
      r.totalAmount
    FROM Receipt r
    JOIN User a ON a.id = r.adminId
    WHERE r.receiptNumber = ${receiptNumber}
    LIMIT 1
  `);

  return NextResponse.json({
    receipt: {
      id: String(receipt.id),
      receiptNumber: String(receipt.receiptNumber),
      heading: receipt.heading === null ? null : String(receipt.heading),
      timestamp: String(receipt.timestamp),
      admin: {
        id: String(receipt.admin_id),
        name: String(receipt.admin_name),
        username: String(receipt.admin_username),
        role: String(receipt.admin_role) as Role,
      },
      andarCode: receipt.andarCode === null ? null : String(receipt.andarCode),
      andarRate: receipt.andarRate === null ? null : Number(receipt.andarRate),
      andarQty: Number(receipt.andarQty ?? 0),
      andarAmount: Number(receipt.andarAmount ?? 0),
      baharCode: receipt.baharCode === null ? null : String(receipt.baharCode),
      baharRate: receipt.baharRate === null ? null : Number(receipt.baharRate),
      baharQty: Number(receipt.baharQty ?? 0),
      baharAmount: Number(receipt.baharAmount ?? 0),
      resultCode: receipt.resultCode === null ? null : String(receipt.resultCode),
      resultRate: receipt.resultRate === null ? null : Number(receipt.resultRate),
      resultQty: Number(receipt.resultQty ?? 0),
      resultAmount: Number(receipt.resultAmount ?? 0),
      totalAmount: Number(receipt.totalAmount ?? 0),
      entries: normalizedEntries,
    },
  }, { status: 201 });
}

function getCounterNumber(heading?: string) {
  if (!heading) {
    return 1;
  }

  const match = heading.match(/\d+/);
  if (!match) {
    return 1;
  }

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