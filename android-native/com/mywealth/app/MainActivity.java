package com.mywealth.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Nivo's activity. On top of Capacitor's BridgeActivity:
 *
 * 1. Back. The system back button and the back gesture ask the web app what back means
 *    (window.nivoBack: close the lock step, the sheet, the screen, go Home) and only send Nivo to the
 *    background when the web app says there is nothing left. This callback is added after Capacitor's
 *    own (plugins load inside super.onCreate), so it is the one Android calls.
 *
 * 2. One surface, edge to edge. The app draws under the status bar and the navigation bar (both
 *    transparent, no contrast scrim), so its background runs from the top of the screen to the bottom
 *    with no separate strips. The bar sizes are measured here and handed to the page as CSS variables
 *    (--sat, --sab, --sal, --sar), because Android's WebView does not reliably report them itself; the
 *    page keeps its header below the clock and the dock above the gesture bar with them.
 *    When the keyboard opens, the web view is lifted above it (what adjustResize did before edge to edge).
 */
public class MainActivity extends BridgeActivity {

    @Override
    @SuppressWarnings("deprecation")
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NivoNativePlugin.class);
        super.onCreate(savedInstanceState);

        // ---------- edge to edge ----------
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
            getWindow().setStatusBarContrastEnforced(false);
        }
        final WebView web = bridge != null ? bridge.getWebView() : null;
        if (web != null) {
            ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
                Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                boolean keyboard = ime.bottom > bars.bottom;
                // keyboard open: lift the whole page above it, and the page needs no bottom inset of its own
                ViewGroup.LayoutParams lp = v.getLayoutParams();
                if (lp instanceof ViewGroup.MarginLayoutParams) {
                    ViewGroup.MarginLayoutParams m = (ViewGroup.MarginLayoutParams) lp;
                    int want = keyboard ? ime.bottom : 0;
                    if (m.bottomMargin != want) {
                        m.bottomMargin = want;
                        v.setLayoutParams(m);
                    }
                }
                float d = getResources().getDisplayMetrics().density;
                NivoNativePlugin.setInsets(
                    Math.round(bars.top / d),
                    Math.round(bars.right / d),
                    keyboard ? 0 : Math.round(bars.bottom / d),
                    Math.round(bars.left / d)
                );
                pushInsets(web);
                return insets;
            });
            ViewCompat.requestApplyInsets(web);
        }

        // ---------- back ----------
        // Android 14+ (predictive back): while the back gesture is in progress the page follows it and shows
        // the screen underneath; letting go commits (handleOnBackPressed), sliding back cancels.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackStarted(BackEventCompat e) {
                js("window.nivoBackStart&&window.nivoBackStart(" + (e.getSwipeEdge() == BackEventCompat.EDGE_RIGHT ? 1 : 0) + ")");
            }

            @Override
            public void handleOnBackProgressed(BackEventCompat e) {
                js("window.nivoBackProgress&&window.nivoBackProgress(" + e.getProgress() + ")");
            }

            @Override
            public void handleOnBackCancelled() {
                js("window.nivoBackCancel&&window.nivoBackCancel()");
            }

            @Override
            public void handleOnBackPressed() {
                WebView w = bridge != null ? bridge.getWebView() : null;
                if (w == null) {
                    moveTaskToBack(true);
                    return;
                }
                w.evaluateJavascript(
                    "(function(){try{return window.nivoBack?window.nivoBack():'exit'}catch(e){return 'exit'}})()",
                    value -> {
                        // value is the JSON of what nivoBack returned: "\"handled\"" when the app went back itself
                        if (value == null || !value.contains("handled")) moveTaskToBack(true);
                    }
                );
            }
        });
    }

    private void js(String code) {
        WebView w = bridge != null ? bridge.getWebView() : null;
        if (w != null) w.evaluateJavascript(code, null);
    }

    @Override
    public void onResume() {
        super.onResume();
        WebView web = bridge != null ? bridge.getWebView() : null;
        if (web != null) pushInsets(web);
    }

    /** Hand the current bar sizes to the page (it also asks for them itself as soon as it starts). */
    private static void pushInsets(WebView web) {
        int[] i = NivoNativePlugin.getInsets();
        web.evaluateJavascript(
            "window.nivoInsets&&window.nivoInsets(" + i[0] + "," + i[1] + "," + i[2] + "," + i[3] + ")",
            null
        );
    }
}
