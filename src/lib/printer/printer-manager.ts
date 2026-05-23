import { isBluetoothPrintingAvailable, BluetoothPrinter } from "./bluetooth-service";

import type { PaperWidth, PrinterDevice, PrinterSettings, PrinterStatus, PrintableReceipt, ReceiptLike } from "./types";
import { formatPrintableReceipt, formatTestReceipt } from "./receipt-formatter";

const STORAGE_KEY = "billinglottery.printer.settings";

let cachedSettings: PrinterSettings | null = null;

function normalizeSettings(value: Partial<PrinterSettings> | null | undefined): PrinterSettings | null {
  if (!value?.address || !value.name) {
    return null;
  }

  return {
    name: value.name,
    address: value.address,
    paperWidthMm: value.paperWidthMm === 80 ? 80 : 58,
    autoCut: value.autoCut ?? true,
    qrText: value.qrText ?? null,
    logoBase64: value.logoBase64 ?? null,
  };
}

function readLocalSettings() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeSettings(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return null;
  }
}

function writeLocalSettings(settings: PrinterSettings | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!settings) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function loadPrinterSettings() {
  if (cachedSettings) {
    return cachedSettings;
  }

  const localSettings = readLocalSettings();
  if (isBluetoothPrintingAvailable()) {
    try {
      const nativeSettings = await BluetoothPrinter.getSavedPrinter();
      cachedSettings = normalizeSettings(nativeSettings.printer) ?? localSettings;
    } catch {
      cachedSettings = localSettings;
    }
  } else {
    cachedSettings = localSettings;
  }

  if (cachedSettings) {
    writeLocalSettings(cachedSettings);
  }

  return cachedSettings;
}

export async function savePrinterSettings(settings: PrinterSettings) {
  const nextSettings = normalizeSettings(settings);
  if (!nextSettings) {
    throw new Error("Invalid printer settings");
  }

  cachedSettings = nextSettings;
  writeLocalSettings(nextSettings);

  if (isBluetoothPrintingAvailable()) {
    await BluetoothPrinter.savePrinter(nextSettings);
  }

  return nextSettings;
}

export async function clearPrinterSettings() {
  cachedSettings = null;
  writeLocalSettings(null);

  if (isBluetoothPrintingAvailable()) {
    await BluetoothPrinter.clearSavedPrinter();
  }
}

export async function loadPrinterStatus(): Promise<PrinterStatus> {
  if (isBluetoothPrintingAvailable()) {
    return BluetoothPrinter.getStatus();
  }

  const savedPrinter = await loadPrinterSettings();
  return {
    bluetoothEnabled: false,
    connected: false,
    message: "Bluetooth printing is only available on Android.",
    savedPrinter,
  };
}

export async function listPairedPrinters(): Promise<PrinterDevice[]> {
  if (!isBluetoothPrintingAvailable()) {
    return [];
  }

  const result = await BluetoothPrinter.listPairedPrinters();
  return result.devices;
}

async function printWithRetry(payload: PrintableReceipt) {
  if (!isBluetoothPrintingAvailable()) {
    throw new Error("Bluetooth printing is only available on Android.");
  }

  try {
    return await BluetoothPrinter.printReceipt(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/printer|connection|failed/i.test(message)) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      return BluetoothPrinter.printReceipt(payload);
    }

    throw error;
  }
}

export async function printReceipt(receipt: ReceiptLike) {
  const settings = await loadPrinterSettings();
  if (!settings) {
    throw new Error("Select a printer in Printer Settings first.");
  }

  const payload = formatPrintableReceipt(receipt, settings);
  return printWithRetry(payload);
}

export async function testPrint() {
  const settings = await loadPrinterSettings();
  if (!settings) {
    throw new Error("Select a printer in Printer Settings first.");
  }

  const payload = formatTestReceipt(settings);
  return printWithRetry(payload);
}

export async function requestBluetoothPermissions() {
  if (!isBluetoothPrintingAvailable()) {
    return null;
  }

  return BluetoothPrinter.requestPermissions();
}