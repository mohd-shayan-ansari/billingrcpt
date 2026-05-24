package com.billinglottery.app.bluetooth;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(alias = "bluetoothConnect", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    private static final String PREFS_NAME = "billinglottery.bluetooth_printer";
    private static final String PREF_PRINTER = "saved_printer";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final ExecutorService executorService = Executors.newSingleThreadExecutor();

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        executorService.shutdownNow();
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (!needsRuntimePermission() || hasBluetoothConnectPermission()) {
            call.resolve(buildStatus());
            return;
        }

        requestPermissionForAlias("bluetoothConnect", call, "permissionCallback");
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (needsRuntimePermission() && !hasBluetoothConnectPermission()) {
            call.reject("Bluetooth permission denied");
            return;
        }

        switch (call.getMethodName()) {
            case "requestPermissions":
                call.resolve(buildStatus());
                break;
            case "listPairedPrinters":
                listPairedPrinters(call);
                break;
            case "printReceipt":
                printReceipt(call);
                break;
            case "testPrint":
                testPrint(call);
                break;
            default:
                call.resolve(buildStatus());
                break;
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void listPairedPrinters(PluginCall call) {
        if (needsRuntimePermission() && !hasBluetoothConnectPermission()) {
            requestPermissionForAlias("bluetoothConnect", call, "permissionCallback");
            return;
        }

        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }

        if (!adapter.isEnabled()) {
            call.reject("Bluetooth disabled");
            return;
        }

        JSArray devices = new JSArray();
        try {
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                JSObject item = new JSObject();
                item.put("name", safeName(device.getName()));
                item.put("address", device.getAddress());
                devices.put(item);
            }
        } catch (SecurityException securityException) {
            call.reject("Bluetooth permission required");
            return;
        }

        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void getSavedPrinter(PluginCall call) {
        JSObject result = new JSObject();
        JSObject printer = readSavedPrinter();
        result.put("printer", printer);
        call.resolve(result);
    }

    @PluginMethod
    public void savePrinter(PluginCall call) {
        JSObject data = call.getData();
        String name = data.optString("name", "");
        String address = data.optString("address", "");

        if (name.isEmpty() || address.isEmpty()) {
            call.reject("Printer name and address are required");
            return;
        }

        JSObject printer = buildPrinterObject(data);
        getContext().getSharedPreferences(PREFS_NAME, 0).edit().putString(PREF_PRINTER, printer.toString()).apply();

        JSObject result = new JSObject();
        result.put("printer", printer);
        call.resolve(result);
    }

    @PluginMethod
    public void clearSavedPrinter(PluginCall call) {
        getContext().getSharedPreferences(PREFS_NAME, 0).edit().remove(PREF_PRINTER).apply();
        call.resolve();
    }

    @PluginMethod
    public void printReceipt(PluginCall call) {
        if (needsRuntimePermission() && !hasBluetoothConnectPermission()) {
            requestPermissionForAlias("bluetoothConnect", call, "permissionCallback");
            return;
        }

        JSObject payload = call.getData();
        executorService.execute(() -> {
            try {
                BluetoothDevice device = resolvePrinter(payload);
                byte[] bytes = buildReceiptBytes(payload);
                writeToPrinter(device, bytes);

                JSObject result = new JSObject();
                result.put("printed", true);
                runOnUiThread(() -> call.resolve(result));
            } catch (Exception exception) {
                runOnUiThread(() -> call.reject(formatError(exception)));
            }
        });
    }

    @PluginMethod
    public void testPrint(PluginCall call) {
        if (needsRuntimePermission() && !hasBluetoothConnectPermission()) {
            requestPermissionForAlias("bluetoothConnect", call, "permissionCallback");
            return;
        }

        JSObject payload = call.getData();
        executorService.execute(() -> {
            try {
                BluetoothDevice device = resolvePrinter(payload);
                byte[] bytes = buildTestBytes(payload);
                writeToPrinter(device, bytes);

                JSObject result = new JSObject();
                result.put("printed", true);
                runOnUiThread(() -> call.resolve(result));
            } catch (Exception exception) {
                runOnUiThread(() -> call.reject(formatError(exception)));
            }
        });
    }

    private BluetoothAdapter getBluetoothAdapter() {
        return BluetoothAdapter.getDefaultAdapter();
    }

    private boolean needsRuntimePermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S;
    }

    private boolean hasBluetoothConnectPermission() {
        return !needsRuntimePermission() || getPermissionState("bluetoothConnect") == PermissionState.GRANTED;
    }

    private JSObject buildStatus() {
        BluetoothAdapter adapter = getBluetoothAdapter();
        JSObject savedPrinter = readSavedPrinter();
        boolean enabled = adapter != null && adapter.isEnabled();
        boolean connected = enabled && savedPrinter != null && isBonded(adapter, savedPrinter.optString("address", ""));

        JSObject result = new JSObject();
        result.put("bluetoothEnabled", enabled);
        result.put("connected", connected);
        result.put("message", enabled ? (savedPrinter != null ? (connected ? "Printer ready" : "Saved printer not paired") : "Select a printer to start printing") : "Bluetooth disabled");
        result.put("savedPrinter", savedPrinter);
        return result;
    }

    private JSObject readSavedPrinter() {
        String saved = getContext().getSharedPreferences(PREFS_NAME, 0).getString(PREF_PRINTER, null);
        if (saved == null || saved.isEmpty()) {
            return null;
        }

        try {
            return new JSObject(saved);
        } catch (Exception exception) {
            return null;
        }
    }

    private JSObject buildPrinterObject(JSObject data) {
        JSObject printer = new JSObject();
        printer.put("name", data.optString("name", ""));
        printer.put("address", data.optString("address", ""));
        printer.put("paperWidthMm", data.optInt("paperWidthMm", 58));
        printer.put("autoCut", data.optBoolean("autoCut", true));
        printer.put("qrText", data.optString("qrText", null));
        printer.put("logoBase64", data.optString("logoBase64", null));
        return printer;
    }

    private BluetoothDevice resolvePrinter(JSObject payload) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            throw new IllegalStateException("Bluetooth not supported on this device");
        }

        if (!adapter.isEnabled()) {
            throw new IllegalStateException("Bluetooth disabled");
        }

        String requestedAddress = payload.optString("printerAddress", "");
        JSObject savedPrinter = readSavedPrinter();
        String selectedAddress = !requestedAddress.isEmpty() ? requestedAddress : savedPrinter != null ? savedPrinter.optString("address", "") : "";

        if (selectedAddress.isEmpty()) {
            throw new IllegalStateException("Select a printer in Printer Settings first");
        }

        if (!isBonded(adapter, selectedAddress)) {
            throw new IllegalStateException("Printer not connected");
        }

        try {
            return adapter.getRemoteDevice(selectedAddress);
        } catch (IllegalArgumentException illegalArgumentException) {
            throw new IllegalStateException("Printer not connected");
        }
    }

    private boolean isBonded(BluetoothAdapter adapter, String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }

        try {
            for (BluetoothDevice device : adapter.getBondedDevices()) {
                if (address.equals(device.getAddress())) {
                    return true;
                }
            }
        } catch (SecurityException securityException) {
            return false;
        }

        return false;
    }

    private void writeToPrinter(BluetoothDevice device, byte[] bytes) throws Exception {
        BluetoothSocket socket = null;
        try {
            BluetoothAdapter adapter = getBluetoothAdapter();
            if (adapter != null) {
                try {
                    adapter.cancelDiscovery();
                } catch (SecurityException ignored) {
                }
            }

            socket = connectSocket(device);
            socket.connect();
            OutputStream outputStream = socket.getOutputStream();
            outputStream.write(bytes);
            outputStream.flush();
        } catch (Exception exception) {
            if (socket != null) {
                try {
                    socket.close();
                } catch (Exception ignored) {
                }
            }

            throw exception;
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private BluetoothSocket connectSocket(BluetoothDevice device) throws Exception {
        try {
            return device.createRfcommSocketToServiceRecord(SPP_UUID);
        } catch (Exception firstError) {
            try {
                return device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            } catch (Exception secondError) {
                try {
                    Method method = device.getClass().getMethod("createRfcommSocket", int.class);
                    return (BluetoothSocket) method.invoke(device, 1);
                } catch (Exception thirdError) {
                    if (secondError != null) {
                        throw secondError;
                    }
                    throw firstError;
                }
            }
        }
    }

    private byte[] buildReceiptBytes(JSObject payload) throws Exception {
        int paperWidthMm = payload.optInt("paperWidthMm", 58);
        int columns = paperWidthMm >= 80 ? 48 : 32;
        String shopName = payload.optString("shopName", "Billing");
        String receiptNumber = payload.optString("receiptNumber", "");
        String timestamp = payload.optString("timestamp", "");
        String counterLabel = payload.optString("counterLabel", "Counter");
        String footerMessage = payload.optString("footerMessage", "Thank you. Visit again.");
        boolean autoCut = payload.optBoolean("autoCut", true);

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        writeBytes(output, escInit());
        writeBytes(output, alignCenter());
        writeBytes(output, boldOn());
        writeLine(output, shopName);
        writeBytes(output, boldOff());
        writeLine(output, counterLabel);
        writeLine(output, "Recpt No: " + receiptNumber);
        writeLine(output, "Date: " + formatDate(timestamp));
        writeLine(output, "Time: " + formatTime(timestamp));
        writeLine(output, divider(columns));
        writeBytes(output, alignLeft());
        writeLine(output, formatHeader());

        JSONArray items = payload.optJSONArray("items");
        if (items != null) {
            for (int index = 0; index < items.length(); index++) {
                JSONObject item = items.getJSONObject(index);
                String itemName = safeValue(item.optString("itemName", "Item"));
                String code = item.optString("code", "");
                int qty = item.optInt("qty", 0);
                double rate = item.optDouble("rate", 0);
                double amount = item.optDouble("amount", rate * qty);

                writeLine(output, formatReceiptRow(itemName + "-" + code, String.valueOf(qty), formatRate(rate), formatAmount(amount)));
            }
        }

        writeLine(output, divider(columns));
        writeBytes(output, alignCenter());
        writeBytes(output, boldOn());
        writeLine(output, "Final Total: " + formatAmount(payload.optDouble("totalAmount", 0)));
        writeBytes(output, boldOff());
        writeLine(output, footerMessage);

        String qrText = payload.optString("qrText", "");
        if (!qrText.isEmpty()) {
            writeLine(output, "");
            writeLine(output, qrText);
            writeQrCode(output, qrText);
        }

        if (autoCut) {
            writeBytes(output, cutPaper());
        }

        writeBytes(output, feed(2));
        return output.toByteArray();
    }

    private byte[] buildTestBytes(JSObject payload) throws Exception {
        int paperWidthMm = payload.optInt("paperWidthMm", 58);
        int columns = paperWidthMm >= 80 ? 48 : 32;

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        writeBytes(output, escInit());
        writeBytes(output, alignCenter());
        writeBytes(output, boldOn());
        writeLine(output, "Billing");
        writeBytes(output, boldOff());
        writeLine(output, "Printer Test");
        writeLine(output, divider(columns));
        writeBytes(output, alignLeft());
        writeLine(output, formatHeader());
        writeLine(output, formatReceiptRow("Test-1", "1", "1.00", "₹1"));
        writeLine(output, divider(columns));
        writeBytes(output, alignCenter());
        writeBytes(output, boldOn());
        writeLine(output, "Final Total: ₹1");
        writeBytes(output, boldOff());
        writeLine(output, "Test print successful.");
        writeBytes(output, cutPaper());
        writeBytes(output, feed(2));
        return output.toByteArray();
    }

    private byte[] escInit() {
        return new byte[] { 0x1B, 0x40 };
    }

    private byte[] alignLeft() {
        return new byte[] { 0x1B, 0x61, 0x00 };
    }

    private byte[] alignCenter() {
        return new byte[] { 0x1B, 0x61, 0x01 };
    }

    private byte[] boldOn() {
        return new byte[] { 0x1B, 0x45, 0x01 };
    }

    private byte[] boldOff() {
        return new byte[] { 0x1B, 0x45, 0x00 };
    }

    private byte[] cutPaper() {
        return new byte[] { 0x1D, 0x56, 0x42, 0x00 };
    }

    private byte[] feed(int lines) {
        return new byte[] { 0x1B, 0x64, (byte) lines };
    }

    private String divider(int columns) {
        return repeat('-', columns);
    }

    private String formatHeader() {
        return centerLine("No.", 6) + centerLine("Qty", 5) + centerLine("Rate", 8) + centerLine("Total", 9);
    }

    private String formatReceiptRow(String no, String qty, String rate, String total) {
        return centerLine(no, 6) + centerLine(qty, 5) + centerLine(rate, 8) + centerLine(total, 9);
    }

    private String fit(String text, int width) {
        if (text == null) {
            return repeat(' ', width);
        }
        if (text.length() > width) {
            return text.substring(0, width);
        }
        return padRight(text, width);
    }

    private String padRight(String text, int width) {
        String value = text == null ? "" : text;
        if (value.length() >= width) {
            return value.substring(0, width);
        }
        return value + repeat(' ', width - value.length());
    }

    private String padLeft(String text, int width) {
        String value = text == null ? "" : text;
        if (value.length() >= width) {
            return value.substring(0, width);
        }
        return repeat(' ', width - value.length()) + value;
    }

    private String repeat(char character, int count) {
        StringBuilder builder = new StringBuilder(Math.max(0, count));
        for (int index = 0; index < count; index++) {
            builder.append(character);
        }
        return builder.toString();
    }

    private String formatRate(double value) {
        return String.format(Locale.ENGLISH, "%.2f", value);
    }

    private String formatAmount(double value) {
        return String.format(Locale.ENGLISH, "₹%.0f", value);
    }

    private String centerLine(String text, int width) {
        String value = text == null ? "" : text;
        if (value.length() >= width) {
            return value.substring(0, width);
        }

        int paddingLeft = Math.max(0, (width - value.length()) / 2);
        int paddingRight = Math.max(0, width - value.length() - paddingLeft);
        return repeat(' ', paddingLeft) + value + repeat(' ', paddingRight);
    }

    private String formatDate(String timestamp) {
        if (timestamp == null || timestamp.isEmpty()) {
            return "";
        }

        return timestamp.length() >= 10 ? timestamp.substring(0, 10) : timestamp;
    }

    private String formatTime(String timestamp) {
        if (timestamp == null || timestamp.isEmpty()) {
            return "";
        }

        return timestamp.length() >= 19 ? timestamp.substring(11, 19) : timestamp;
    }

    private void writeQrCode(ByteArrayOutputStream output, String data) throws Exception {
        byte[] dataBytes = data.getBytes(StandardCharsets.UTF_8);
        writeBytes(output, new byte[] { 0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00 });
        writeBytes(output, new byte[] { 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06 });
        writeBytes(output, new byte[] { 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31 });
        int length = dataBytes.length + 3;
        byte pL = (byte) (length % 256);
        byte pH = (byte) (length / 256);
        writeBytes(output, new byte[] { 0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30 });
        writeBytes(output, dataBytes);
        writeBytes(output, new byte[] { 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30 });
    }

    private void writeBytes(ByteArrayOutputStream output, byte[] bytes) throws Exception {
        output.write(bytes);
    }

    private void writeLine(ByteArrayOutputStream output, String line) throws Exception {
        output.write((line + "\n").getBytes(StandardCharsets.UTF_8));
    }

    private String safeName(String name) {
        return name == null || name.trim().isEmpty() ? "Unknown printer" : name.trim();
    }

    private String safeValue(String text) {
        return text == null ? "" : text;
    }

    private void runOnUiThread(Runnable runnable) {
        if (getActivity() != null) {
            getActivity().runOnUiThread(runnable);
        } else {
            runnable.run();
        }
    }

    private String formatError(Exception exception) {
        String message = exception.getMessage();
        if (message == null || message.isEmpty()) {
            return "Print failed";
        }

        String lower = message.toLowerCase(Locale.ENGLISH);

        if (lower.contains("discovery") || lower.contains("scanning")) {
            return "Bluetooth discovery is still active. Stop scanning and try printing again.";
        }

        if (lower.contains("socket") || lower.contains("read failed") || lower.contains("failed to connect") || lower.contains("connection")) {
            return "Printer paired but not responding. Re-select the printer or turn it off and on again.";
        }

        if (lower.contains("permission")) {
            return "Bluetooth permission required. Allow Bluetooth and try again.";
        }

        if (lower.contains("bluetooth")) {
            return message;
        }

        if (lower.contains("printer")) {
            return message;
        }

        return "Print failed. Re-select the printer or try system print preview.";
    }
}