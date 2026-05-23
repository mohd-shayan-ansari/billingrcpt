package com.billinglottery.app.print;

import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;

import java.io.FileOutputStream;

final class ReceiptPdfPrintDocumentAdapter extends PrintDocumentAdapter {

    private final String jobName;
    private final byte[] pdfBytes;

    ReceiptPdfPrintDocumentAdapter(String jobName, byte[] pdfBytes) {
        this.jobName = jobName;
        this.pdfBytes = pdfBytes;
    }

    @Override
    public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, android.os.Bundle extras) {
        if (cancellationSignal.isCanceled()) {
            callback.onLayoutCancelled();
            return;
        }

        PrintDocumentInfo info = new PrintDocumentInfo.Builder(jobName)
            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
            .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
            .build();

        callback.onLayoutFinished(info, true);
    }

    @Override
    public void onWrite(PageRange[] pages, ParcelFileDescriptor destination, CancellationSignal cancellationSignal, WriteResultCallback callback) {
        if (cancellationSignal.isCanceled()) {
            callback.onWriteCancelled();
            return;
        }

        try (FileOutputStream outputStream = new FileOutputStream(destination.getFileDescriptor())) {
            outputStream.write(pdfBytes);
            outputStream.flush();
            callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
        } catch (Exception exception) {
            callback.onWriteFailed(exception.getMessage());
        }
    }
}