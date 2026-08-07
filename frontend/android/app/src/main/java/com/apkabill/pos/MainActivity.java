package com.apkabill.pos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.apkabill.pos.plugins.ThermalPrinterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThermalPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
