import { NativeReceiptPrint, buildNativeReceiptHtml } from "./native-print-service";

import type { PaperWidth, ReceiptLike } from "./types";

class NativeReceiptPrintController {
  async printReceipt(receipt: ReceiptLike, paperWidthMm: PaperWidth = 58) {
    const html = buildNativeReceiptHtml(receipt, paperWidthMm);
    return NativeReceiptPrint.printHtml({
      jobName: `Receipt ${receipt.receiptNumber}`,
      html,
      paperWidthMm,
    });
  }

  async printImage(imageBase64: string, paperWidthMm: PaperWidth = 58, jobName = "Billing Receipt") {
    return NativeReceiptPrint.printImage({
      jobName,
      imageBase64,
      paperWidthMm,
    });
  }

  async printPdf(pdfBase64: string, paperWidthMm: PaperWidth = 58, jobName = "Billing Receipt") {
    return NativeReceiptPrint.printPdf({
      jobName,
      pdfBase64,
      paperWidthMm,
    });
  }
}

export const nativeReceiptPrintController = new NativeReceiptPrintController();