import type { ReceiptEntryLine, ReceiptItemKey } from "@/lib/receipt";

export type PaperWidth = 58 | 80;

export type PrinterDevice = {
  name: string;
  address: string;
};

export type PrinterSettings = {
  name: string;
  address: string;
  paperWidthMm: PaperWidth;
  autoCut: boolean;
  qrText?: string | null;
  logoBase64?: string | null;
};

export type PrinterStatus = {
  bluetoothEnabled: boolean;
  connected: boolean;
  message: string;
  savedPrinter: PrinterSettings | null;
};

export type PrintableReceiptItem = {
  itemKey: ReceiptItemKey;
  itemName: string;
  code: string;
  qty: number;
  rate: number;
  amount: number;
};

export type PrintableReceipt = {
  shopName: string;
  receiptNumber: string;
  timestamp: string;
  counterLabel: string;
  items: PrintableReceiptItem[];
  totalAmount: number;
  footerMessage: string;
  paperWidthMm: PaperWidth;
  autoCut: boolean;
  qrText?: string | null;
  logoBase64?: string | null;
};

export type ReceiptLike = {
  receiptNumber: string;
  heading?: string | null;
  timestamp: string;
  entries?: ReceiptEntryLine[];
  andarCode?: string | null;
  andarRate?: number | null;
  andarQty?: number;
  andarAmount?: number;
  baharCode?: string | null;
  baharRate?: number | null;
  baharQty?: number;
  baharAmount?: number;
  resultCode?: string | null;
  resultRate?: number | null;
  resultQty?: number;
  resultAmount?: number;
  totalAmount?: number;
};