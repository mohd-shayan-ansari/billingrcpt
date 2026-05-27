import { Capacitor, registerPlugin } from "@capacitor/core";

import { buildReceiptLines } from "@/lib/receipt";

import type { PaperWidth, ReceiptLike } from "./types";

export interface NativeReceiptPrintBridge {
  printHtml(options: { jobName: string; html: string; paperWidthMm: PaperWidth }): Promise<{ opened: boolean }>;
  printImage(options: { jobName: string; imageBase64: string; paperWidthMm: PaperWidth }): Promise<{ opened: boolean }>;
  printPdf(options: { jobName: string; pdfBase64: string; paperWidthMm: PaperWidth }): Promise<{ opened: boolean }>;
}

export const NativeReceiptPrint = registerPlugin<NativeReceiptPrintBridge>("ReceiptPrint");

export function isNativeReceiptPrintAvailable() {
  return Capacitor.isNativePlatform();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPrintableEntries(receipt: ReceiptLike) {
  if (receipt.entries && receipt.entries.length > 0) {
    return receipt.entries.map((entry) => ({
      itemKey: entry.itemKey,
      code: entry.code,
      qty: entry.qty,
      rate: entry.rate,
      amount: entry.amount,
    }));
  }

  const itemTypes = [
    { key: "andar" as const, code: receipt.andarCode, qty: receipt.andarQty ?? 0, rate: receipt.andarRate ?? 12, amount: receipt.andarAmount ?? 0 },
    { key: "bahar" as const, code: receipt.baharCode, qty: receipt.baharQty ?? 0, rate: receipt.baharRate ?? 55, amount: receipt.baharAmount ?? 0 },
    { key: "result" as const, code: receipt.resultCode, qty: receipt.resultQty ?? 0, rate: receipt.resultRate ?? 110, amount: receipt.resultAmount ?? 0 },
  ];

  const entries: Array<{ itemKey: "andar" | "bahar" | "result"; code: string; qty: number; rate: number; amount: number }> = [];

  for (const item of itemTypes) {
    if (!item.code || item.qty <= 0) {
      continue;
    }

    const codes = String(item.code)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    const code = codes.join(",");
    if (!code) {
      continue;
    }

    entries.push({
      itemKey: item.key,
      code,
      qty: Number(item.qty),
      rate: Number(item.rate),
      amount: Number(item.amount),
    });
  }

  return entries;
}

export function buildNativeReceiptHtml(receipt: ReceiptLike, paperWidthMm: PaperWidth = 58) {
  const preview = buildReceiptLines({
    receiptNumber: receipt.receiptNumber,
    heading: receipt.heading ?? "",
    timestamp: new Date(receipt.timestamp),
    entries: getPrintableEntries(receipt),
  });

  const paperWidth = paperWidthMm === 80 ? "80mm" : "58mm";
  const fontSize = paperWidthMm === 80 ? "12px" : "11px";

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @page { margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
      }
      body {
        width: ${paperWidth};
      }
      .sheet {
        box-sizing: border-box;
        width: ${paperWidth};
        padding: 4mm 3mm 6mm;
        font-family: "Courier New", Courier, monospace;
        font-size: ${fontSize};
        line-height: 1.35;
        color: #000;
      }
      pre {
        margin: 0;
        white-space: pre;
      }
    </style>
  </head>
  <body>
    <div class="sheet"><pre>${escapeHtml(preview.lines.join("\n"))}</pre></div>
  </body>
</html>`;
}