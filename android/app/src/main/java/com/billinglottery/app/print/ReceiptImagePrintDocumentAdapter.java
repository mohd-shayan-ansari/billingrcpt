package com.billinglottery.app.print;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.pdf.PrintedPdfDocument;

import java.io.FileOutputStream;

final class ReceiptImagePrintDocumentAdapter extends PrintDocumentAdapter {

    private final Activity activity;
    private final String jobName;
    private final Bitmap bitmap;
    private PrintAttributes attributes;

    ReceiptImagePrintDocumentAdapter(Activity activity, String jobName, Bitmap bitmap) {
        this.activity = activity;
        this.jobName = jobName;
        this.bitmap = bitmap;
    }

    @Override
    public void onLayout(PrintAttributes oldAttributes, PrintAttributes newAttributes, CancellationSignal cancellationSignal, LayoutResultCallback callback, android.os.Bundle extras) {
        if (cancellationSignal.isCanceled()) {
            callback.onLayoutCancelled();
            return;
        }

        attributes = newAttributes;
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

        if (attributes == null) {
            callback.onWriteFailed("Print attributes unavailable");
            return;
        }

        PrintedPdfDocument document = new PrintedPdfDocument(activity, attributes);

        try (FileOutputStream outputStream = new FileOutputStream(destination.getFileDescriptor())) {
            android.graphics.pdf.PdfDocument.Page page = document.startPage(0);
            Canvas canvas = page.getCanvas();
            RectF content = new RectF(page.getInfo().getContentRect());

            float scale = Math.min(content.width() / bitmap.getWidth(), content.height() / bitmap.getHeight());
            Matrix matrix = new Matrix();
            matrix.postScale(scale, scale);
            matrix.postTranslate(
                content.left + (content.width() - (bitmap.getWidth() * scale)) / 2f,
                content.top + (content.height() - (bitmap.getHeight() * scale)) / 2f
            );

            canvas.drawBitmap(bitmap, matrix, new Paint(Paint.FILTER_BITMAP_FLAG));
            document.finishPage(page);
            document.writeTo(outputStream);
            callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
        } catch (Exception exception) {
            callback.onWriteFailed(exception.getMessage());
        } finally {
            document.close();
        }
    }
}