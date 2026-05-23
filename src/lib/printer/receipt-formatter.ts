import { ITEM_LABELS } from "@/lib/constants";

import type { PaperWidth, PrinterSettings, PrintableReceipt, ReceiptLike } from "./types";

function getReceiptEntries(receipt: ReceiptLike) {
  if (receipt.entries && receipt.entries.length > 0) {
    return receipt.entries.map((entry) => ({
      itemKey: entry.itemKey,
      itemName: ITEM_LABELS[entry.itemKey],
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

  const items: PrintableReceipt["items"] = [];
  for (const item of itemTypes) {
    if (!item.code || item.qty <= 0) {
      continue;
    }

    const codes = String(item.code).split(",").map((entry) => entry.trim()).filter(Boolean);
    if (codes.length <= 1) {
      items.push({
        itemKey: item.key,
        itemName: ITEM_LABELS[item.key],
        code: codes[0] ?? "",
        qty: Number(item.qty),
        rate: Number(item.rate),
        amount: Number(item.amount),
      });
      continue;
    }

    const perCodeQty = Math.floor(Number(item.qty) / codes.length);
    const remainder = Number(item.qty) % codes.length;

    for (let index = 0; index < codes.length; index += 1) {
      const qty = perCodeQty + (index < remainder ? 1 : 0);
      items.push({
        itemKey: item.key,
        itemName: ITEM_LABELS[item.key],
        code: codes[index],
        qty,
        rate: Number(item.rate),
        amount: Number(item.rate) * qty,
      });
    }
  }

  return items;
}

export function getColumnsForPaperWidth(paperWidthMm: PaperWidth) {
  return paperWidthMm === 80 ? 48 : 32;
}

export function formatPrintableReceipt(receipt: ReceiptLike, settings: PrinterSettings): PrintableReceipt {
  const items = getReceiptEntries(receipt);
  const totalAmount = receipt.totalAmount ?? items.reduce((sum, item) => sum + item.amount, 0);
  return {
    shopName: "Billing",
    receiptNumber: receipt.receiptNumber,
    timestamp: receipt.timestamp,
    counterLabel: receipt.heading ?? "Counter",
    items,
    totalAmount,
    footerMessage: "Thank you. Visit again.",
    paperWidthMm: settings.paperWidthMm,
    autoCut: settings.autoCut,
    qrText: settings.qrText ?? null,
    logoBase64: settings.logoBase64 ?? null,
  };
}

export function formatTestReceipt(settings: PrinterSettings): PrintableReceipt {
  return {
    shopName: "Billing",
    receiptNumber: "TEST",
    timestamp: new Date().toISOString(),
    counterLabel: "Printer Test",
    items: [
      { itemKey: "andar", itemName: ITEM_LABELS.andar, code: "00", qty: 1, rate: 1, amount: 1 },
      { itemKey: "bahar", itemName: ITEM_LABELS.bahar, code: "01", qty: 2, rate: 2, amount: 4 },
    ],
    totalAmount: 5,
    footerMessage: "Test print successful.",
    paperWidthMm: settings.paperWidthMm,
    autoCut: settings.autoCut,
    qrText: settings.qrText ?? null,
    logoBase64: settings.logoBase64 ?? null,
  };
}