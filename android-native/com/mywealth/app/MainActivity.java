package com.mywealth.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

/**
 * Nivo's activity. Two things on top of Capacitor's BridgeActivity:
 *
 * 1. Back. The system back button and the back gesture ask the web app what back means
 *    (window.nivoBack: close the lock step, the sheet, the screen, go Home) and only send Nivo to the
 *    background when the web app says there is nothing left. This callback is added after Capacitor's
 *    own (plugins load inside super.onCreate), so it is the one Android calls, with or without the
 *    App plugin. Before 4.2 the APK had no plugins at all and back closed the app from anywhere.
 *
 * 2. No contrast scrim over the bottom of the screen. Android 15 draws apps edge to edge and puts a
 *    translucent scrim behind the navigation bar, which is what made the dock look faded. Capacitor
 *    keeps the WebView clear of the system bars (adjustMarginsForEdgeToEdge: force), and the area
 *    behind the bars is painted in the app's background colour by NivoNative.setSystemBars.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NivoNativePlugin.class);
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
            getWindow().setStatusBarContrastEnforced(false);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView web = bridge != null ? bridge.getWebView() : null;
                if (web == null) {
                    moveTaskToBack(true);
                    return;
                }
                web.evaluateJavascript(
                    "(function(){try{return window.nivoBack?window.nivoBack():'exit'}catch(e){return 'exit'}})()",
                    value -> {
                        // value is the JSON of what nivoBack returned: "\"handled\"" when the app went back itself
                        if (value == null || !value.contains("handled")) moveTaskToBack(true);
                    }
                );
            }
        });
    }
}
