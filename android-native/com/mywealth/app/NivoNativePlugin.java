package com.mywealth.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.Window;
import androidx.core.content.FileProvider;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Phone features Nivo needs that no stock plugin covers, compiled into the APK itself:
 * haptics that follow Android's own touch feedback, the colour behind the system bars,
 * battery optimisation, version and signing details, and downloading and installing an update.
 */
@CapacitorPlugin(name = "NivoNative")
public class NivoNativePlugin extends Plugin {

    // ---------- haptics ----------

    /**
     * type: tap, select, medium, success, error. Uses the view's haptic feedback first (the same engine as
     * the keyboard and system buttons); when Android's touch feedback is turned off, it uses the vibrator
     * directly so Nivo still gives feedback.
     */
    @PluginMethod
    public void haptic(PluginCall call) {
        final String type = call.getString("type", "tap");
        getActivity().runOnUiThread(() -> {
            boolean done = false;
            try {
                View view = getBridge().getWebView();
                if (view != null) done = view.performHapticFeedback(feedbackConstant(type), HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING);
            } catch (Exception ignored) { }
            if (!done) vibrate(type);
            JSObject r = new JSObject();
            r.put("performed", done);
            call.resolve(r);
        });
    }

    private int feedbackConstant(String type) {
        boolean r = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R;
        switch (type) {
            case "select": return HapticFeedbackConstants.CLOCK_TICK;
            case "medium": return HapticFeedbackConstants.VIRTUAL_KEY;
            case "success": return r ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY;
            case "error": return r ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS;
            default: return HapticFeedbackConstants.KEYBOARD_TAP;
        }
    }

    @SuppressWarnings("deprecation")
    private void vibrate(String type) {
        try {
            Vibrator v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (v == null || !v.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int effect;
                switch (type) {
                    case "medium": effect = VibrationEffect.EFFECT_HEAVY_CLICK; break;
                    case "success": case "error": effect = VibrationEffect.EFFECT_DOUBLE_CLICK; break;
                    case "select": effect = VibrationEffect.EFFECT_TICK; break;
                    default: effect = VibrationEffect.EFFECT_CLICK;
                }
                v.vibrate(VibrationEffect.createPredefined(effect));
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(VibrationEffect.createOneShot("medium".equals(type) ? 18 : 10, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                v.vibrate("medium".equals(type) ? 18 : 10);
            }
        } catch (Exception ignored) { }
    }

    // ---------- system bars ----------

    /** Paint the area behind the status and navigation bars, and pick dark or light icons for them. */
    @PluginMethod
    @SuppressWarnings("deprecation")
    public void setSystemBars(PluginCall call) {
        final String color = call.getString("color", "#0f111d");
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", true));
        getActivity().runOnUiThread(() -> {
            try {
                int c = Color.parseColor(color);
                Window w = getActivity().getWindow();
                w.getDecorView().setBackgroundColor(c);
                if (Build.VERSION.SDK_INT < 35) {
                    w.setStatusBarColor(c);
                    w.setNavigationBarColor(c);
                }
                WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(w, w.getDecorView());
                ic.setAppearanceLightStatusBars(!dark);
                ic.setAppearanceLightNavigationBars(!dark);
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not set the system bar colours", e);
            }
        });
    }

    // ---------- battery (background price checks) ----------

    private boolean ignoringBattery() {
        if (Build.VERSION.SDK_INT < 23) return true;
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ignoring", ignoringBattery());
        call.resolve(r);
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (!ignoringBattery()) {
            try {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            } catch (Exception e) {
                try {
                    Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(i);
                } catch (Exception ignored) { }
            }
        }
        JSObject r = new JSObject();
        r.put("ignoring", ignoringBattery());
        call.resolve(r);
    }

    // ---------- notifications ----------

    /**
     * Android stops showing the permission prompt after it has been declined twice; the only way back is
     * the app's notification settings, which this opens directly.
     */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open the notification settings", e);
        }
    }

    // ---------- version and signing ----------

    @SuppressWarnings("deprecation")
    private static long versionCodeOf(PackageInfo p) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? p.getLongVersionCode() : p.versionCode;
    }

    @SuppressWarnings("deprecation")
    private static Signature[] signaturesOf(PackageInfo p) {
        if (p == null) return null;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (p.signingInfo == null) return null;
            return p.signingInfo.hasMultipleSigners() ? p.signingInfo.getApkContentsSigners() : p.signingInfo.getSigningCertificateHistory();
        }
        return p.signatures;
    }

    @SuppressWarnings("deprecation")
    private static int signingFlag() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    }

    /** SHA-256 of the first signing certificate, as AA:BB:..., the same format keytool prints. */
    private static String fingerprint(Signature[] sigs) {
        if (sigs == null || sigs.length == 0) return "";
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(sigs[0].toByteArray());
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < d.length; i++) {
                if (i > 0) b.append(':');
                b.append(String.format("%02X", d[i]));
            }
            return b.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private PackageInfo installed() throws PackageManager.NameNotFoundException {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), signingFlag());
    }

    @PluginMethod
    public void appInfo(PluginCall call) {
        try {
            PackageInfo p = installed();
            JSObject r = new JSObject();
            r.put("packageName", getContext().getPackageName());
            r.put("versionName", p.versionName);
            r.put("versionCode", versionCodeOf(p));
            r.put("signature", fingerprint(signaturesOf(p)));
            r.put("sdk", Build.VERSION.SDK_INT);
            r.put("device", Build.MANUFACTURER + " " + Build.MODEL);
            r.put("canInstall", canInstall());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not read the app version", e);
        }
    }

    // ---------- updates ----------

    private File updateFile() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, "nivo-update.apk");
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    /**
     * Download a new APK into the app's cache, reporting progress as "updateProgress" events.
     * The download is then checked before anything is installed: it must be Nivo, newer than this
     * version, and signed with the same key, which is exactly what Android checks. When it is not,
     * the call says why, instead of Android's bare "App not installed".
     */
    @PluginMethod
    public void downloadUpdate(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("No download address");
            return;
        }
        new Thread(() -> {
            File out = updateFile();
            File part = new File(out.getParentFile(), "nivo-update.part");
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.setRequestProperty("Accept", "application/octet-stream");
                int code = c.getResponseCode();
                if (code / 100 != 2) throw new Exception("The server answered " + code);
                long total = c.getContentLengthLong();
                long done = 0, lastSent = 0;
                try (InputStream in = c.getInputStream(); OutputStream os = new FileOutputStream(part)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        os.write(buf, 0, n);
                        done += n;
                        if (done - lastSent > 256 * 1024) {
                            lastSent = done;
                            JSObject p = new JSObject();
                            p.put("done", done);
                            p.put("total", total);
                            notifyListeners("updateProgress", p);
                        }
                    }
                }
                if (out.exists()) out.delete();
                if (!part.renameTo(out)) throw new Exception("Could not save the download");

                PackageManager pm = getContext().getPackageManager();
                PackageInfo dl = pm.getPackageArchiveInfo(out.getAbsolutePath(), signingFlag());
                if (dl == null) throw new Exception("The download is not a valid app file");
                PackageInfo me = installed();
                JSObject r = new JSObject();
                r.put("versionName", dl.versionName);
                r.put("versionCode", versionCodeOf(dl));
                r.put("samePackage", getContext().getPackageName().equals(dl.packageName));
                r.put("newer", versionCodeOf(dl) > versionCodeOf(me));
                String a = fingerprint(signaturesOf(me));
                String b = fingerprint(signaturesOf(dl));
                // Older Android versions do not report signatures for an APK file that is not installed;
                // then only Android itself can tell, so the check is left to it.
                r.put("sameKey", b.isEmpty() || a.equals(b));
                r.put("signature", b);
                r.put("size", out.length());
                call.resolve(r);
            } catch (Exception e) {
                part.delete();
                call.reject(e.getMessage() != null ? e.getMessage() : "Download failed", e);
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }

    /** Hand the downloaded APK to Android's installer. Asks once for "Install unknown apps" if needed. */
    @PluginMethod
    public void installUpdate(PluginCall call) {
        File f = updateFile();
        if (!f.exists()) {
            call.reject("Download the update first");
            return;
        }
        JSObject r = new JSObject();
        if (!canInstall()) {
            openInstallSettings();
            r.put("needsPermission", true);
            call.resolve(r);
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            r.put("started", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not open the installer", e);
        }
    }

    private void openInstallSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) { }
    }

    @PluginMethod
    public void canInstallUpdates(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", canInstall());
        call.resolve(r);
    }
}
