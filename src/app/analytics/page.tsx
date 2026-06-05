import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/ui/cards";
import { Prisma } from "@prisma/client";
import { RESOLVED_SALES_SLOTS } from "@/lib/time";
import { DatePicker } from "./date-picker";

export const dynamic = "force-dynamic";

function getSalesSlotForMinutes(minutesSinceMidnight: number) {
  for (const slot of RESOLVED_SALES_SLOTS) {
    if (minutesSinceMidnight <= slot.minutes) {
      return slot;
    }
  }
  return RESOLVED_SALES_SLOTS[RESOLVED_SALES_SLOTS.length - 1] ?? null;
}

function getTimeSlotForTimestamp(value: string) {
  const date = new Date(value);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  return getSalesSlotForMinutes(currentMinutes);
}

function formatSlotLabel(slot: { label: string; minutes: number }) {
  const period = slot.minutes < 12 * 60 ? "AM" : "PM";
  return `${slot.label} ${period}`;
}

type SlotStats = {
  slotId: string;
  slotLabel: string;
  slotMinutes: number;
  winningNumber: string | null;
  sale: number;
  winners: number;
  anAmount: number;
  bhAmount: number;
  rtAmount: number;
  anWonQty: number;
  bhWonQty: number;
  rtWonQty: number;
  tickets: number;
};

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await getSessionFromRequest();
  
  if (!session || session.role !== "MASTER_ADMIN") {
    redirect("/");
  }

  const { date: dateStr } = await searchParams;
  const reportDate = dateStr ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // 1. Fetch Receipts for the date
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT r.heading, r.timestamp, r."totalAmount", r."andarAmount", r."baharAmount", r."resultAmount", r.entries
    FROM "Receipt" r
    WHERE r.timestamp >= (CAST(${reportDate} AS DATE) - INTERVAL '1 day')
      AND r.timestamp < (CAST(${reportDate} AS DATE) + INTERVAL '2 day')
  `);

  const winningResults = await prisma.winningResult.findMany({
    where: { date: reportDate },
  });
  const winningResultMap = new Map<string, string>();
  winningResults.forEach(wr => winningResultMap.set(wr.slotId, wr.number));

  const counterMap = new Map<string, Map<string, SlotStats>>();
  const toNumber = (v: number | bigint | undefined | null) => (typeof v === 'bigint' ? Number(v) : Number(v ?? 0));
  
  let grossOverall = 0;
  let totalReceipts = 0;
  let totalAndar = 0;
  let totalBahar = 0;
  let totalResult = 0;

  for (const r of rows) {
    try {
      const ts = String(r.timestamp);
      const d = new Date(ts);
      const localDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      if (localDate !== reportDate) continue;
      
      const heading = (r.heading as string) || 'Unknown Counter';
      const amt = toNumber(r.totalAmount as any);
      const anAmt = toNumber(r.andarAmount as any);
      const bhAmt = toNumber(r.baharAmount as any);
      const rtAmt = toNumber(r.resultAmount as any);

      // Determine the slot
      const slot = getTimeSlotForTimestamp(ts);
      if (!slot) continue;

      if (!counterMap.has(heading)) {
        counterMap.set(heading, new Map());
      }
      const slotMap = counterMap.get(heading)!;
      
      if (!slotMap.has(slot.id)) {
        slotMap.set(slot.id, {
          slotId: slot.id,
          slotLabel: formatSlotLabel(slot),
          slotMinutes: slot.minutes,
          winningNumber: winningResultMap.get(slot.id) || null,
          sale: 0,
          winners: 0,
          anAmount: 0,
          bhAmount: 0,
          rtAmount: 0,
          anWonQty: 0,
          bhWonQty: 0,
          rtWonQty: 0,
          tickets: 0,
        });
      }

      let anWonQty = 0;
      let bhWonQty = 0;
      let rtWonQty = 0;

      const winningNumber = winningResultMap.get(slot.id);
      if (winningNumber && winningNumber.length === 2) {
        const anCode = winningNumber.charAt(0);
        const bhCode = winningNumber.charAt(1);
        const rtCode = winningNumber;

        const entriesStr = r.entries as string | null | undefined;
        if (entriesStr) {
          const entries = typeof entriesStr === 'string' ? JSON.parse(entriesStr) : entriesStr;
          if (Array.isArray(entries)) {
            for (const entry of entries) {
              if (!entry.qty || entry.qty <= 0) continue;
              if (entry.itemKey === 'andar' && entry.code === anCode) {
                anWonQty += entry.qty;
              } else if (entry.itemKey === 'bahar' && entry.code === bhCode) {
                bhWonQty += entry.qty;
              } else if (entry.itemKey === 'result' && entry.code === rtCode) {
                rtWonQty += entry.qty;
              }
            }
          }
        }
      }

      const stats = slotMap.get(slot.id)!;
      stats.sale += amt;
      stats.anAmount += anAmt;
      stats.bhAmount += bhAmt;
      stats.rtAmount += rtAmt;
      stats.anWonQty += anWonQty;
      stats.bhWonQty += bhWonQty;
      stats.rtWonQty += rtWonQty;
      stats.tickets += 1;

      grossOverall += amt;
      totalAndar += anAmt;
      totalBahar += bhAmt;
      totalResult += rtAmt;
      totalReceipts += 1;
    } catch (e) {
      // ignore malformed rows
    }
  }

  // 2. Fetch Deductions
  const winnerDeductions = await prisma.winnerDeduction.findMany({
    where: { date: reportDate },
    select: {
      counterHeading: true,
      amount: true,
      slotId: true,
      slotLabel: true,
    },
  });

  let totalDeductions = 0;
  for (const entry of winnerDeductions) {
    const heading = entry.counterHeading || 'Unknown Counter';
    if (!counterMap.has(heading)) {
      counterMap.set(heading, new Map());
    }
    const slotMap = counterMap.get(heading)!;
    
    if (!slotMap.has(entry.slotId)) {
      // We need to figure out minutes for sorting if it's a new slot
      const slotDef = RESOLVED_SALES_SLOTS.find(s => s.id === entry.slotId);
      slotMap.set(entry.slotId, {
        slotId: entry.slotId,
        slotLabel: entry.slotLabel || (slotDef ? formatSlotLabel(slotDef) : "Unknown"),
        slotMinutes: slotDef ? slotDef.minutes : 0,
        winningNumber: winningResultMap.get(entry.slotId) || null,
        sale: 0,
        winners: 0,
        anAmount: 0,
        bhAmount: 0,
        rtAmount: 0,
        anWonQty: 0,
        bhWonQty: 0,
        rtWonQty: 0,
        tickets: 0,
      });
    }

    const stats = slotMap.get(entry.slotId)!;
    stats.winners += entry.amount;
    totalDeductions += entry.amount;
  }

  // 3. Prepare View Data
  const grandTotal = grossOverall - totalDeductions;
  
  // Sort counters alphabetically
  const counterHeadings = Array.from(counterMap.keys()).sort((a, b) => a.localeCompare(b));

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  }

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 pb-24">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Analytics & Reports</h1>
          <p className="mt-1 text-slate-400">Detailed slot-by-slot breakdown for {reportDate}</p>
        </div>
        <div className="flex items-center gap-3">
          <DatePicker defaultValue={reportDate} />
          <Link href="/" className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20 text-center">
            Back to App
          </Link>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="!p-5 border-emerald-500/20 bg-emerald-500/5">
          <div className="text-xs font-medium uppercase tracking-wider text-emerald-400/80 mb-2">Net Profit</div>
          <div className="text-3xl font-bold text-white">{formatCurrency(grandTotal)}</div>
        </GlassCard>
        <GlassCard className="!p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Gross Revenue</div>
          <div className="text-3xl font-bold text-white">{formatCurrency(grossOverall)}</div>
        </GlassCard>
        <GlassCard className="!p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Total Deductions</div>
          <div className="text-3xl font-bold text-red-400">{formatCurrency(totalDeductions)}</div>
        </GlassCard>
        <GlassCard className="!p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">Total Receipts</div>
          <div className="text-3xl font-bold text-white">{new Intl.NumberFormat("en-IN").format(totalReceipts)}</div>
        </GlassCard>
      </div>

      <div className="space-y-8">
        {counterHeadings.map((heading) => {
          const slotMap = counterMap.get(heading)!;
          // Only show slots that have some activity, sort chronologically
          const activeSlots = Array.from(slotMap.values()).sort((a, b) => a.slotMinutes - b.slotMinutes);
          
          let counterGross = 0;
          let counterWinners = 0;
          let counterAN = 0;
          let counterBH = 0;
          let counterRT = 0;
          let counterAnQty = 0;
          let counterBhQty = 0;
          let counterRtQty = 0;
          let counterTickets = 0;

          activeSlots.forEach(s => {
            counterGross += s.sale;
            counterWinners += s.winners;
            counterAN += s.anAmount;
            counterBH += s.bhAmount;
            counterRT += s.rtAmount;
            counterAnQty += s.anWonQty;
            counterBhQty += s.bhWonQty;
            counterRtQty += s.rtWonQty;
            counterTickets += s.tickets;
          });

          return (
            <GlassCard key={heading} title={heading} className="overflow-hidden p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm text-slate-300 min-w-[800px]">
                  <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-4 font-medium sticky left-0 bg-slate-900 z-10 w-32 border-r border-white/5">Time</th>
                      <th className="px-4 py-4 font-medium text-right text-emerald-300">Sale</th>
                      <th className="px-4 py-4 font-medium text-right text-red-300">Won Prize</th>
                      <th className="px-4 py-4 font-medium text-right text-amber-300">Net Profit</th>
                      <th className="px-4 py-4 font-medium text-right text-indigo-300">result rt</th>
                      <th className="px-4 py-4 font-medium text-right text-red-300/80">an/ No. of won ticket</th>
                      <th className="px-4 py-4 font-medium text-right text-red-300/80">bh/ No. of won ticket</th>
                      <th className="px-4 py-4 font-medium text-right text-red-300/80">Rt/ No. of won ticket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeSlots.map((slot) => {
                      const net = slot.sale - slot.winners;
                      return (
                        <tr key={slot.slotId} className="transition-colors hover:bg-white/5">
                          <td className="whitespace-nowrap px-4 py-3 font-medium text-white sticky left-0 bg-slate-900 border-r border-white/5 z-10">
                            {slot.slotLabel}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">{slot.sale > 0 ? formatCurrency(slot.sale) : "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-red-400/90">{slot.winners > 0 ? formatCurrency(slot.winners) : "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-emerald-400">{net !== 0 ? formatCurrency(net) : "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-indigo-300 font-bold">{slot.winningNumber || "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-red-300/60 font-mono">{slot.anWonQty > 0 ? slot.anWonQty : "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-red-300/60 font-mono">{slot.bhWonQty > 0 ? slot.bhWonQty : "-"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-red-300/60 font-mono">{slot.rtWonQty > 0 ? slot.rtWonQty : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-white/5 font-semibold text-white border-t border-white/10">
                    <tr>
                      <td className="px-4 py-4 sticky left-0 bg-[#16213e] border-r border-white/5 z-10">Total</td>
                      <td className="px-4 py-4 text-right">{formatCurrency(counterGross)}</td>
                      <td className="px-4 py-4 text-right text-red-400">{formatCurrency(counterWinners)}</td>
                      <td className="px-4 py-4 text-right text-emerald-400">{formatCurrency(counterGross - counterWinners)}</td>
                      <td className="px-4 py-4 text-right text-slate-500 font-mono">-</td>
                      <td className="px-4 py-4 text-right text-red-300/60 font-mono">{counterAnQty}</td>
                      <td className="px-4 py-4 text-right text-red-300/60 font-mono">{counterBhQty}</td>
                      <td className="px-4 py-4 text-right text-red-300/60 font-mono">{counterRtQty}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </GlassCard>
          );
        })}

        {counterHeadings.length === 0 && (
          <div className="flex h-40 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
            No sales or deductions found for {reportDate}.
          </div>
        )}
      </div>
    </div>
  );
}
