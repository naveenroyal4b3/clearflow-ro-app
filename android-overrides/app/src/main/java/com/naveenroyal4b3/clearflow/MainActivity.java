package com.naveenroyal4b3.clearflow;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App plugins must be registered before the bridge starts.
        registerPlugin(PrintPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
