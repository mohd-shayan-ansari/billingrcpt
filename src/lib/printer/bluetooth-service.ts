import { Capacitor, registerPlugin } from "@capacitor/core";

import type { PaperWidth, PrinterDevice, PrinterSettings, PrinterStatus, PrintableReceipt } from "./types";

export interface BluetoothPrinterBridge {
  requestPermissions(): Promise<PrinterStatus>;
  getStatus(): Promise<PrinterStatus>;
  listPairedPrinters(): Promise<{ devices: PrinterDevice[] }>;
  getSavedPrinter(): Promise<{ printer: PrinterSettings | null }>;
  savePrinter(options: PrinterSettings): Promise<{ printer: PrinterSettings }>;
  clearSavedPrinter(): Promise<void>;
  printReceipt(options: PrintableReceipt): Promise<{ printed: boolean }>;
  testPrint(options: { printerAddress?: string; paperWidthMm: PaperWidth }): Promise<{ printed: boolean }>;
}

export const BluetoothPrinter = registerPlugin<BluetoothPrinterBridge>("BluetoothPrinter");

export function isBluetoothPrintingAvailable() {
  return Capacitor.isNativePlatform();
}