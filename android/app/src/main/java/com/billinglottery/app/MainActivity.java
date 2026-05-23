package com.billinglottery.app;

import android.os.Bundle;

import com.billinglottery.app.bluetooth.BluetoothPrinterPlugin;
import com.billinglottery.app.print.ReceiptPrintPlugin;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
	@Override
	protected void onCreate(Bundle savedInstanceState) {
		initialPlugins.add(BluetoothPrinterPlugin.class);
		initialPlugins.add(ReceiptPrintPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
