package com.billinglottery.app.print;

import android.print.PrintAttributes;

final class PrintHelper {

    private PrintHelper() {
    }

    static PrintAttributes buildPrintAttributes(int paperWidthMm) {
        return new PrintAttributes.Builder()
            .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .setMediaSize(buildMediaSize(paperWidthMm))
            .build();
    }

    static PrintAttributes.MediaSize buildMediaSize(int paperWidthMm) {
        int widthMils = Math.max(1000, Math.round(paperWidthMm * 39.3701f));
        int heightMils = 12000;
        return new PrintAttributes.MediaSize("BILLING_RECEIPT_" + paperWidthMm, paperWidthMm + "mm Receipt", widthMils, heightMils).asPortrait();
    }
}