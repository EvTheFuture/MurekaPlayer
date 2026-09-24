/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the one WebView the player lives in
 *
 * Copyright (C) 2026 EvTheFuture
 * https://github.com/EvTheFuture/MurekaPlayer
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

package dev.evthefuture.murekaplayer;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.MutableContextWrapper;
import android.graphics.Color;
import android.net.Uri;
import android.net.VpnService;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.provider.Settings;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import android.content.ContentValues;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// The player runs in a single WebView that belongs to the app, not to the
// screen. The service creates it, even at boot with nothing on screen, and
// the activity only borrows it to show it. Closing the activity leaves the
// player playing and the web view working
final class PlayerWeb {

    static final String HOME = "https://www.mureka.ai/";

    // What only a visible activity can do for the page: show a popup window,
    // such as the Google sign in, and open the file picker
    interface Host {
        boolean openPopup(Message resultMsg);

        void closePopup();

        boolean showFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params);

        // Fullscreen from the page, the player's fullscreen button and the
        // screen off cover. The view is what the page shows fullscreen
        void showFullscreen(android.view.View view, WebChromeClient.CustomViewCallback callback);

        void hideFullscreen();

        // Android's question whether the app may run a VPN, which only an
        // activity can show
        void askVpnPermission(Intent intent);

        void finishApp();

        // The page's process died and a new WebView took the old one's place
        void replaceWeb(WebView fresh);

        // Save a file the player built, asking the user where it goes. Only
        // an activity can show that question
        void saveFile(String name, String text);

        // Hide or show Android's status and navigation bars, which only an
        // activity can do
        void applyFullscreen();
    }

    private static WebView web;
    private static MutableContextWrapper context;
    private static Context appContext;
    private static WeakReference<Host> hostRef = new WeakReference<>(null);
    private static String playerJs;

    private PlayerWeb() {
    }

    static boolean exists() {
        return web != null;
    }

    // The player's WebView, created and loaded the first time it is asked
    // for. Main thread only
    static WebView get(Context c) {

        if (web != null) {
            return web;
        }

        appContext = c.getApplicationContext();
        playerJs = readAsset(appContext, "player.js");

        // A context that can be pointed at the activity while it is on
        // screen, which dialogs and popups need, and back at the application
        // when it is not, so the activity is never kept alive by the page
        context = new MutableContextWrapper(appContext);

        web = make(context);
        web.setWebViewClient(new MainClient());
        web.setWebChromeClient(new MainChrome());
        web.addJavascriptInterface(new Bridge(), "MurekaHost");

        CookieManager cookies = CookieManager.getInstance();

        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);

        Hub.attach(web, PlayerWeb::quitAll);
        web.loadUrl(HOME);

        return web;
    }

    static void attachHost(Activity activity, Host host) {

        if (context != null) {
            context.setBaseContext(activity);
        }

        hostRef = new WeakReference<>(host);
    }

    static void detachHost(Host host) {

        if (hostRef.get() != host) {
            return;
        }

        hostRef = new WeakReference<>(null);

        if (context != null && appContext != null) {
            context.setBaseContext(appContext);
        }

        if (web != null && web.getParent() instanceof ViewGroup) {
            ((ViewGroup) web.getParent()).removeView(web);
        }
    }

    // Quit from the notification: the page, the service and the activity
    static void quitAll() {

        Host host = hostRef.get();

        if (host != null) {
            host.finishApp();
        }

        if (appContext != null) {
            appContext.stopService(new Intent(appContext, PlayerService.class));
        }

        if (web != null) {

            if (web.getParent() instanceof ViewGroup) {
                ((ViewGroup) web.getParent()).removeView(web);
            }

            web.destroy();
            web = null;
        }

        Hub.detach();
    }

    // A WebView set up like a real phone browser. Google refuses to sign in
    // inside anything that calls itself a WebView, so the markers that give
    // it away are taken out of the user agent
    @SuppressWarnings("deprecation")
    static WebView make(Context c) {

        WebView w = new WebView(c);
        WebSettings s = w.getSettings();

        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        String ua = s.getUserAgentString()
            .replace("; wv)", ")")
            .replaceAll("Version/\\d+(\\.\\d+)* ", "");

        s.setUserAgentString(ua);
        w.setBackgroundColor(Color.parseColor("#1d1d22"));

        // The page runs in a process of its own. Off screen Android counts
        // it as unimportant and freezes it after a while, and the player then
        // does nothing until the app is opened again. Kept important, the
        // page keeps running with the phone asleep in a pocket or a bag
        w.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);

        return w;
    }

    // Web pages stay in the app, anything else, mail or a store link, goes
    // to whichever app handles it
    static boolean openOutside(WebResourceRequest request) {

        Uri uri = request.getUrl();
        String scheme = uri.getScheme();

        if ("http".equals(scheme) || "https".equals(scheme)) {
            return false;
        }

        if (appContext != null) {

            try {
                appContext.startActivity(new Intent(Intent.ACTION_VIEW, uri)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException e) {
                // Nothing handles it, the tap simply does nothing
            }
        }

        return true;
    }

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    // The player has a file to save. On screen the user is asked where it
    // goes, otherwise it lands in Downloads, which needs nobody to answer
    static void saveFile(String name, String text) {

        MAIN.post(() -> {

            Host host = hostRef.get();

            if (host != null) {

                host.saveFile(name, text);
                return;
            }

            saveToDownloads(name, text);
        });
    }

    // Straight into the phone's Downloads folder, no question asked
    static void saveToDownloads(String name, String text) {

        if (appContext == null) {

            savedResult(false, "Nothing to save with");
            return;
        }

        byte[] data = text.getBytes(StandardCharsets.UTF_8);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {

            ContentValues values = new ContentValues();

            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, "application/json");

            try {

                Uri where = appContext.getContentResolver()
                    .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);

                if (where == null) {

                    savedResult(false, "Could not save the file");
                    return;
                }

                try (OutputStream out = appContext.getContentResolver().openOutputStream(where)) {

                    if (out == null) {

                        savedResult(false, "Could not save the file");
                        return;
                    }

                    out.write(data);
                }

                savedResult(true, "Downloads, " + name);
            } catch (IOException | SecurityException | IllegalArgumentException e) {
                savedResult(false, "Could not save the file");
            }

            return;
        }

        // Before Android 10 the folder is written straight
        try {

            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);

            if (dir != null && !dir.exists() && !dir.mkdirs()) {

                savedResult(false, "Could not save the file");
                return;
            }

            File file = new File(dir, name);

            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(data);
            }

            savedResult(true, "Downloads, " + name);
        } catch (IOException | SecurityException e) {
            savedResult(false, "Could not save the file");
        }
    }

    // Tell the player how the save went, so it can show it in its own line
    static void savedResult(boolean ok, String where) {

        MAIN.post(() -> {

            if (web == null) {
                return;
            }

            web.evaluateJavascript("window.__murekaSaveResult && window.__murekaSaveResult("
                + (ok ? "true" : "false") + ", " + JSONObject.quote(where == null ? "" : where) + ")", null);
        });
    }

    // The bars follow the setting as soon as it moves, while the app is on
    // screen. With no activity there is nothing to hide
    private static void tellFullscreen() {

        Host host = hostRef.get();

        if (host != null) {
            host.applyFullscreen();
        }
    }

    // The permission is given once and stays until another VPN app takes
    // over. When it is missing and the app is not on screen, the setting
    // says so and switching it on again asks
    private static void askVpnIfNeeded() {

        if (appContext == null) {
            return;
        }

        Intent ask = VpnService.prepare(appContext);

        if (ask == null) {
            return;
        }

        Host host = hostRef.get();

        if (host != null) {
            host.askVpnPermission(ask);
        } else {
            CarVpn.setStatus("needs permission, open the app and switch it on again");
        }
    }

    private static boolean isMureka(String url) {

        if (url == null) {
            return false;
        }

        String host = Uri.parse(url).getHost();

        return host != null && (host.equals("mureka.ai") || host.endsWith(".mureka.ai"));
    }

    private static String readAsset(Context c, String name) {

        try (InputStream in = c.getAssets().open(name)) {

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int n;

            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
            }

            return out.toString(StandardCharsets.UTF_8.name());
        } catch (IOException e) {
            return null;
        }
    }

    // The player's way out to the app
    private static final class Bridge {

        @JavascriptInterface
        public void publish(String json) {
            Hub.publish(json);
        }

        // The app's own web view settings: which networks may open it, the
        // fixed public address and the local name
        @JavascriptInterface
        public String getPref(String key, String fallback) {

            if (appContext == null) {
                return fallback;
            }

            if (CarSettings.VPN_ADDRESS.equals(key)) {
                return CarSettings.vpnAddress(appContext);
            }

            if (CarSettings.MDNS_NAME.equals(key)) {

                String name = CarSettings.mdnsName(appContext);

                return name.substring(0, name.length() - ".local".length());
            }

            return CarSettings.prefs(appContext).getString(key, fallback);
        }

        // Stores the value when it is valid, and brings the name and the VPN
        // in line. Switching the public address on asks for the VPN permission
        // the first time, which needs the app on screen
        @JavascriptInterface
        public boolean setPref(String key, String value) {

            if (appContext == null || !CarSettings.store(appContext, key, value)) {
                return false;
            }

            if (CarSettings.VPN.equals(key) && "1".equals(value)) {
                MAIN.post(PlayerWeb::askVpnIfNeeded);
            }

            if (CarSettings.FULLSCREEN.equals(key)) {
                MAIN.post(PlayerWeb::tellFullscreen);
            }

            PlayerService.settingsChanged();

            return true;
        }

        // Whether Android lets the app run freely in the background, "1" when
        // it is left out of battery optimisation
        @JavascriptInterface
        public String batteryFree() {

            if (appContext == null) {
                return "0";
            }

            PowerManager pm = appContext.getSystemService(PowerManager.class);

            return pm != null && pm.isIgnoringBatteryOptimizations(appContext.getPackageName()) ? "1" : "0";
        }

        // Ask Android to leave the app out of battery optimisation, a
        // question Android shows itself
        @JavascriptInterface
        public void askBatteryFree() {

            if (appContext == null) {
                return;
            }

            Intent ask = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                Uri.parse("package:" + appContext.getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            try {
                appContext.startActivity(ask);
            } catch (ActivityNotFoundException e) {

                // No such question on this phone, the list of apps instead
                try {
                    appContext.startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                } catch (ActivityNotFoundException e2) {
                    // Nothing to open
                }
            }
        }

        // What the web view is reachable at right now, for the settings panel
        // A file the player built, saved where the user says or, with the
        // app off screen, in Downloads
        @JavascriptInterface
        public void saveFile(String name, String text) {

            String clean = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]", "_");

            if (clean.isEmpty()) {
                clean = "mureka-player.json";
            }

            PlayerWeb.saveFile(clean, text == null ? "" : text);
        }

        @JavascriptInterface
        public String carStatus() {

            JSONObject o = new JSONObject();

            if (appContext == null) {
                return "{}";
            }

            try {

                String publicAddr = CarVpn.activeAddress();
                String name = CarSettings.mdnsName(appContext);
                List<String> addresses = CarServer.addresses(PlayerService.PORT);

                o.put("vpnEnabled", CarSettings.vpnEnabled(appContext));
                o.put("vpn", CarVpn.status());
                o.put("carUrl", publicAddr != null ? "http://" + publicAddr + ":" + PlayerService.PORT : "");
                o.put("name", name);
                o.put("localUrl", "http://" + name + ":" + PlayerService.PORT);
                o.put("mdns", PlayerService.mdnsStatus());
                o.put("addresses", new JSONArray(addresses));
            } catch (JSONException e) {
                // Whatever was put so far
            }

            return o.toString();
        }
    }

    // The page's process was ended by Android. The old WebView is useless
    // then, so a new one loads the player again, and the screen shows it
    // when the app is open
    private static void rebuild() {

        WebView old = web;

        web = null;

        if (old != null) {

            if (old.getParent() instanceof ViewGroup) {
                ((ViewGroup) old.getParent()).removeView(old);
            }

            old.destroy();
        }

        if (appContext == null) {
            return;
        }

        WebView fresh = get(appContext);
        Host host = hostRef.get();

        if (host instanceof Activity && context != null) {
            context.setBaseContext((Activity) host);
        }

        if (host != null) {
            host.replaceWeb(fresh);
        }
    }

    private static final class MainClient extends WebViewClient {

        // Without this the whole app would be ended with the page
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {

            if (view == web) {
                MAIN.post(PlayerWeb::rebuild);
            }

            return true;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return openOutside(request);
        }

        // Tag the page as the app and run the player. The player guards
        // itself against a second run on the same page
        @Override
        public void onPageFinished(WebView view, String url) {

            if (isMureka(url) && playerJs != null) {

                view.evaluateJavascript("document.documentElement.setAttribute('data-mureka-host','apk');", null);
                view.evaluateJavascript(playerJs, null);
            }
        }
    }

    private static final class MainChrome extends WebChromeClient {

        // A page asking for a new window gets one from the activity, when
        // one is on screen. Without it the request is refused
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {

            Host host = hostRef.get();

            return host != null && host.openPopup(resultMsg);
        }

        @Override
        public void onCloseWindow(WebView window) {

            Host host = hostRef.get();

            if (host != null) {
                host.closePopup();
            }
        }

        // Having these is what makes the page's fullscreen work at all, a
        // WebView without them reports fullscreen as unavailable
        @Override
        public void onShowCustomView(android.view.View view, CustomViewCallback callback) {

            Host host = hostRef.get();

            if (host == null) {

                callback.onCustomViewHidden();
                return;
            }

            host.showFullscreen(view, callback);
        }

        @Override
        public void onHideCustomView() {

            Host host = hostRef.get();

            if (host != null) {
                host.hideFullscreen();
            }
        }

        // Import from file in the player's settings
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {

            Host host = hostRef.get();

            return host != null && host.showFileChooser(callback, params);
        }
    }
}
