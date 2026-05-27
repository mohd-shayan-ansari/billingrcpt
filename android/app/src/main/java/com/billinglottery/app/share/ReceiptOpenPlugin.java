package com.billinglottery.app.share;

import android.content.ClipData;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
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

    private static final String PREFS_NAME = "billinglottery.receipt_opener";
    private static final String PREF_COMPONENT = "preferred_component";
    private static final String PREF_PACKAGE = "preferred_package";
    private static final String PREF_CLASS = "preferred_class";

    private BroadcastReceiver chosenAppReceiver;
    private String chooserAction;

    @Override
    public void load() {
        chooserAction = getContext().getPackageName() + ".RECEIPT_CHOOSER_SELECTED";
        chosenAppReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) {
                    return;
                }

                ComponentName chosenComponent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    chosenComponent = intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT, ComponentName.class);
                } else {
                    chosenComponent = intent.getParcelableExtra(Intent.EXTRA_CHOSEN_COMPONENT);
                }

                if (chosenComponent == null) {
                    return;
                }

                savePreferredComponent(chosenComponent);
            }
        };

        IntentFilter filter = new IntentFilter(chooserAction);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(chosenAppReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(chosenAppReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (chosenAppReceiver != null) {
            try {
                getContext().unregisterReceiver(chosenAppReceiver);
            } catch (Exception ignored) {
                // Receiver may already be unregistered.
            }
        }
        super.handleOnDestroy();
    }

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
        Intent viewIntent = createViewIntent(receiptUri, mimeType);

        try {
            getActivity().runOnUiThread(() -> {
                try {
                    if (openWithPreferredApp(viewIntent, receiptUri)) {
                        JSObject result = new JSObject();
                        result.put("opened", true);
                        result.put("usedDefault", true);
                        call.resolve(result);
                        return;
                    }

                    Intent chooserIntent = createChooserIntent(viewIntent, dialogTitle);
                    getActivity().startActivity(chooserIntent);
                    JSObject result = new JSObject();
                    result.put("opened", true);
                    result.put("usedDefault", false);
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

    private Intent createViewIntent(Uri receiptUri, String mimeType) {
        Intent viewIntent = new Intent(Intent.ACTION_VIEW);
        viewIntent.setDataAndType(receiptUri, mimeType);
        viewIntent.setClipData(ClipData.newUri(getContext().getContentResolver(), "receipt", receiptUri));
        viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return viewIntent;
    }

    private Intent createChooserIntent(Intent viewIntent, String dialogTitle) {
        Intent callbackIntent = new Intent(chooserAction).setPackage(getContext().getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent callback = PendingIntent.getBroadcast(getContext(), 0, callbackIntent, flags);

        Intent chooserIntent = Intent.createChooser(viewIntent, dialogTitle, callback.getIntentSender());
        chooserIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return chooserIntent;
    }

    private boolean openWithPreferredApp(Intent baseIntent, Uri receiptUri) {
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String flattenedComponent = preferences.getString(PREF_COMPONENT, "");

        if (flattenedComponent == null || flattenedComponent.isEmpty()) {
            String packageName = preferences.getString(PREF_PACKAGE, "");
            String className = preferences.getString(PREF_CLASS, "");

            if (packageName != null && !packageName.isEmpty() && className != null && !className.isEmpty()) {
                flattenedComponent = new ComponentName(packageName, className).flattenToString();
            }
        }

        if (flattenedComponent == null || flattenedComponent.isEmpty()) {
            return false;
        }

        ComponentName preferredComponent = ComponentName.unflattenFromString(flattenedComponent);
        if (preferredComponent == null) {
            clearPreferredComponent();
            return false;
        }

        Intent preferredIntent = new Intent(baseIntent);
        preferredIntent.setComponent(preferredComponent);
        getContext().grantUriPermission(preferredComponent.getPackageName(), receiptUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);

        try {
            getActivity().startActivity(preferredIntent);
            return true;
        } catch (Exception exception) {
            clearPreferredComponent();
            return false;
        }
    }

    private void savePreferredComponent(ComponentName componentName) {
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        preferences
            .edit()
            .putString(PREF_COMPONENT, componentName.flattenToString())
            .remove(PREF_PACKAGE)
            .remove(PREF_CLASS)
            .commit();
    }

    private void clearPreferredComponent() {
        SharedPreferences preferences = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        preferences
            .edit()
            .remove(PREF_COMPONENT)
            .remove(PREF_PACKAGE)
            .remove(PREF_CLASS)
            .commit();
    }
}
