package com.billinglottery.app;

import com.billinglottery.app.bluetooth.BluetoothPrinterPlugin;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.List;

public class MainActivity extends BridgeActivity {
	@Override
	public void registerPlugins(List<Class<? extends Plugin>> plugins) {
		plugins.add(BluetoothPrinterPlugin.class);
		super.registerPlugins(plugins);
	}
}
