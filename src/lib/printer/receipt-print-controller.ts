import { loadPrinterSettings, loadPrinterStatus, listPairedPrinters, printReceipt as printBluetoothReceipt, requestBluetoothPermissions, savePrinterSettings, testPrint as testBluetoothPrint } from "./printer-manager";

import type { PaperWidth, PrinterDevice, PrinterSettings, PrinterStatus, ReceiptLike } from "./types";

class ReceiptPrintController {
  async requestPermissions() {
    return requestBluetoothPermissions();
  }

  async getStatus(): Promise<PrinterStatus> {
    return loadPrinterStatus();
  }

  async getPairedPrinters(): Promise<PrinterDevice[]> {
    return listPairedPrinters();
  }

  async getSettings(): Promise<PrinterSettings | null> {
    return loadPrinterSettings();
  }

  async saveSettings(settings: PrinterSettings) {
    return savePrinterSettings(settings);
  }

  async printReceipt(receipt: ReceiptLike) {
    return printBluetoothReceipt(receipt);
  }

  async testPrint() {
    return testBluetoothPrint();
  }
}

export const receiptPrintController = new ReceiptPrintController();