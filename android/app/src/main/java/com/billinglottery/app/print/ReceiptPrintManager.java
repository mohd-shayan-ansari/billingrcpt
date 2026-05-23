package com.billinglottery.app.print;

import android.app.Activity;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

final class ReceiptPrintManager {

    interface PrintCallback {
        void onStarted();

        void onCompleted();

        void onError(String message);

        void onCancelled(String message);
    }

    private final Activity activity;
    private WebView activeWebView;

    ReceiptPrintManager(Activity activity) {
        this.activity = activity;
    }

    void printHtml(String jobName, String html, int paperWidthMm, PrintCallback callback) {
        runOnUiThread(() -> {
            if (!isActivityReady()) {
                callback.onError("Print screen is not ready");
                return;
            }

            cleanupWebView();

            WebView webView = new WebView(activity);
            activeWebView = webView;
            webView.setLayoutParams(new FrameLayout.LayoutParams(1, 1));
            webView.setVisibility(View.GONE);
            webView.setBackgroundColor(0xFFFFFFFF);
            webView.getSettings().setJavaScriptEnabled(false);
            webView.getSettings().setDomStorageEnabled(false);
            webView.getSettings().setLoadWithOverviewMode(true);
            webView.getSettings().setUseWideViewPort(true);
            webView.getSettings().setSupportZoom(false);
            webView.getSettings().setBuiltInZoomControls(false);

            FrameLayout root = activity.findViewById(android.R.id.content);
            root.addView(webView);

            webView.setWebViewClient(new WebViewClient() {
                private boolean started;

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (started) {
                        return;
                    }

                    started = true;
                    printAdapter(jobName, webView.createPrintDocumentAdapter(jobName), paperWidthMm, callback);
                }

                @Override
                public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                    cleanupWebView();
                    callback.onError("Rendering failed");
                }

                @Override
                public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                    cleanupWebView();
                    callback.onError("Rendering failed");
                }
            });

            webView.loadDataWithBaseURL("about:blank", html, "text/html", "UTF-8", null);
        });
    }

    void printImage(String jobName, String base64Image, int paperWidthMm, PrintCallback callback) {
        runOnUiThread(() -> {
            if (!isActivityReady()) {
                callback.onError("Print screen is not ready");
                return;
            }

            byte[] imageBytes = android.util.Base64.decode(base64Image, android.util.Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.length);
            if (bitmap == null) {
                callback.onError("Unable to decode receipt image");
                return;
            }

            printAdapter(jobName, new ReceiptImagePrintDocumentAdapter(activity, jobName, bitmap), paperWidthMm, callback);
        });
    }

    void printPdf(String jobName, String base64Pdf, int paperWidthMm, PrintCallback callback) {
        runOnUiThread(() -> {
            if (!isActivityReady()) {
                callback.onError("Print screen is not ready");
                return;
            }

            byte[] pdfBytes = android.util.Base64.decode(base64Pdf, android.util.Base64.DEFAULT);
            if (pdfBytes.length == 0) {
                callback.onError("PDF content is empty");
                return;
            }

            printAdapter(jobName, new ReceiptPdfPrintDocumentAdapter(jobName, pdfBytes), paperWidthMm, callback);
        });
    }

    void destroy() {
        runOnUiThread(this::cleanupWebView);
    }

    private void printAdapter(String jobName, PrintDocumentAdapter adapter, int paperWidthMm, PrintCallback callback) {
        PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
        if (printManager == null) {
            callback.onError("Print service unavailable");
            cleanupWebView();
            return;
        }

        PrintAttributes attributes = PrintHelper.buildPrintAttributes(paperWidthMm);
        PrintJob printJob = printManager.print(jobName, adapter, attributes);
        if (printJob == null) {
            callback.onError("Unable to open print preview");
            cleanupWebView();
            return;
        }

        callback.onStarted();
        callback.onCompleted();
    }

    private boolean isActivityReady() {
        return activity != null && !activity.isFinishing();
    }

    private void cleanupWebView() {
        if (activeWebView == null) {
            return;
        }

        try {
            if (activeWebView.getParent() instanceof FrameLayout) {
                ((FrameLayout) activeWebView.getParent()).removeView(activeWebView);
            }
        } catch (Exception ignored) {
        }

        try {
            activeWebView.stopLoading();
            activeWebView.loadUrl("about:blank");
            activeWebView.destroy();
        } catch (Exception ignored) {
        }

        activeWebView = null;
    }

    private void runOnUiThread(Runnable runnable) {
        if (activity == null) {
            return;
        }

        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            runnable.run();
        } else {
            activity.runOnUiThread(runnable);
        }
    }
}