package com.billinglottery.app.print;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReceiptPrint")
public class ReceiptPrintPlugin extends Plugin {

    private ReceiptPrintManager receiptPrintManager;

    @Override
    public void load() {
        receiptPrintManager = new ReceiptPrintManager(getActivity());
    }

    @Override
    protected void handleOnDestroy() {
        if (receiptPrintManager != null) {
            receiptPrintManager.destroy();
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html", "");
        String jobName = call.getString("jobName", "Billing Receipt");
        int paperWidthMm = call.getInt("paperWidthMm", 58);

        if (html == null || html.trim().isEmpty()) {
            call.reject("HTML content is required");
            return;
        }

        receiptPrintManager.printHtml(jobName, html, paperWidthMm, new ReceiptPrintManager.PrintCallback() {
            @Override
            public void onStarted() {
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            }

            @Override
            public void onCompleted() {
                // The Android print dialog manages the rest of the lifecycle.
            }

            @Override
            public void onError(String message) {
                call.reject(message);
            }

            @Override
            public void onCancelled(String message) {
                call.reject(message);
            }
        });
    }

    @PluginMethod
    public void printImage(PluginCall call) {
        String imageBase64 = call.getString("imageBase64", "");
        String jobName = call.getString("jobName", "Billing Receipt");
        int paperWidthMm = call.getInt("paperWidthMm", 58);

        if (imageBase64 == null || imageBase64.trim().isEmpty()) {
            call.reject("Image content is required");
            return;
        }

        receiptPrintManager.printImage(jobName, imageBase64, paperWidthMm, new ReceiptPrintManager.PrintCallback() {
            @Override
            public void onStarted() {
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            }

            @Override
            public void onCompleted() {
                // The adapter renders the bitmap into a printable PDF page.
            }

            @Override
            public void onError(String message) {
                call.reject(message);
            }

            @Override
            public void onCancelled(String message) {
                call.reject(message);
            }
        });
    }

    @PluginMethod
    public void printPdf(PluginCall call) {
        String pdfBase64 = call.getString("pdfBase64", "");
        String jobName = call.getString("jobName", "Billing Receipt");
        int paperWidthMm = call.getInt("paperWidthMm", 58);

        if (pdfBase64 == null || pdfBase64.trim().isEmpty()) {
            call.reject("PDF content is required");
            return;
        }

        receiptPrintManager.printPdf(jobName, pdfBase64, paperWidthMm, new ReceiptPrintManager.PrintCallback() {
            @Override
            public void onStarted() {
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            }

            @Override
            public void onCompleted() {
                // The Android print dialog manages the rest of the lifecycle.
            }

            @Override
            public void onError(String message) {
                call.reject(message);
            }

            @Override
            public void onCancelled(String message) {
                call.reject(message);
            }
        });
    }
}