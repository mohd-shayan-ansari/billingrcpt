import { RECEIPT_KEYS } from "@/lib/constants";

export type SelectedCodes = Partial<Record<(typeof RECEIPT_KEYS)[number], string>>;
export type ReceiptItemKey = (typeof RECEIPT_KEYS)[number];

export type ReceiptEntryLine = {
  itemKey: ReceiptItemKey;
  code: string;
  qty: number;
  rate: number;
  amount: number;
};

export function normalizeCode(key: (typeof RECEIPT_KEYS)[number], value: string) {
  const numeric = key === "result" ? value.replace(/\D/g, "").slice(0, 2) : value.replace(/\D/g, "").slice(0, 1);

  if (!numeric) {
    return "";
  }

  if (key === "result") {
    return numeric.padStart(2, "0");
  }

  return numeric;
}

export function buildReceiptLines(payload: {
  receiptNumber: string;
  heading?: string | null;
  timestamp: Date;
  entries: ReceiptEntryLine[];
}) {
  const lines: string[] = [];
  const width = 28; // reduce char width to fit 2 inch (50.8mm) thermal width
  lines.push(centerLine("Billing", width));
  const counterNumber = getCounterNumber(payload.heading);
  lines.push(centerLine(`Counter: ${counterNumber}`, width));
  lines.push(centerLine(`Recpt No: ${payload.receiptNumber}`, width));
  lines.push(centerLine(`Date: ${formatReceiptDate(payload.timestamp)}`, width));
  lines.push(centerLine(`Time: ${formatReceiptTime(payload.timestamp)}`, width));
  lines.push("-".repeat(width));

  lines.push(formatColumns("No.", "Qty", "Rate", "Total"));

  let total = 0;
  const codePrefix = {
    andar: "AN",
    result: "RT",
    bahar: "BH",
  } as const;

  for (const entry of payload.entries ?? []) {
    if (!entry.qty || !entry.code) {
      continue;
    }

    total += entry.amount;
    lines.push(
      formatColumns(`${codePrefix[entry.itemKey]}-${entry.code}`, String(entry.qty), entry.rate.toFixed(2), `₹${entry.amount}`)
    );
  }

  lines.push("-".repeat(width));
  lines.push(centerLine(`Final Total: ₹${total}`, width));

  return { lines, total };
}

export function receiptToText(lines: string[]) {
  return `${lines.join("\n")}\n`;
}

function getCounterNumber(heading?: string | null) {
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

function formatReceiptDate(value: Date) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = String(value.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatReceiptTime(value: Date) {
  let hours = value.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minute = String(value.getMinutes()).padStart(2, "0");
  const second = String(value.getSeconds()).padStart(2, "0");
  return `${String(hours).padStart(2, "0")}:${minute}:${second} ${ampm}`;
}

function formatColumns(no: string, qty: string, rate: string, total: string) {
  const w1 = 6;
  const w2 = 5;
  const w3 = 8;
  const w4 = 9;
  
  return [
    centerLine(no, w1),
    centerLine(qty, w2),
    centerLine(rate, w3),
    centerLine(total, w4),
  ].join("");
}

function leftAlign(text: string, width: number) {
  const trimmed = text.slice(0, width);
  return trimmed.padEnd(width, " ");
}

function rightAlign(text: string, width: number) {
  const trimmed = text.slice(0, width);
  return trimmed.padStart(width, " ");
}

function centerLine(text: string, width: number) {
  const trimmed = text.slice(0, width);
  const paddingLeft = Math.max(0, Math.floor((width - trimmed.length) / 2));
  const paddingRight = Math.max(0, width - trimmed.length - paddingLeft);
  return `${" ".repeat(paddingLeft)}${trimmed}${" ".repeat(paddingRight)}`.slice(0, width);
}