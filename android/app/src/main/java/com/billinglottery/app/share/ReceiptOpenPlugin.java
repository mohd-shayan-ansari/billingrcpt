package com.billinglottery.app.share;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "ReceiptOpener")
public class ReceiptOpenPlugin extends Plugin {

    @PluginMethod
    public void openReceipt(PluginCall call) {
        String imageBase64 = call.getString("imageBase64", "");
        String fileName = call.getString("fileName", "receipt.png");
        String mimeType = call.getString("mimeType", "image/png");
        String dialogTitle = call.getString("dialogTitle", "Open receipt with");

        if (imageBase64 == null || imageBase64.trim().isEmpty()) {
            call.reject("Image content is required");
            return;
        }

        byte[] imageBytes = Base64.decode(imageBase64, Base64.DEFAULT);
        File receiptsDir = new File(getContext().getCacheDir(), "receipts");
        if (!receiptsDir.exists() && !receiptsDir.mkdirs()) {
            call.reject("Unable to prepare receipt storage");
            return;
        }

        File receiptFile = new File(receiptsDir, fileName);
        try (FileOutputStream outputStream = new FileOutputStream(receiptFile)) {
            outputStream.write(imageBytes);
        } catch (Exception exception) {
            call.reject(exception.getMessage());
            return;
        }

        Uri receiptUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", receiptFile);
        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
        viewIntent.setDataAndType(receiptUri, mimeType);
        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        Intent chooserIntent = Intent.createChooser(viewIntent, dialogTitle);
        chooserIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

        try {
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(chooserIntent);
                    JSObject result = new JSObject();
                    result.put("opened", true);
                    call.resolve(result);
                } catch (ActivityNotFoundException exception) {
                    call.reject("No app available to open this receipt");
                } catch (Exception exception) {
                    call.reject(exception.getMessage());
                }
            });
        } catch (Exception exception) {
            call.reject(exception.getMessage());
        }
    }
}
