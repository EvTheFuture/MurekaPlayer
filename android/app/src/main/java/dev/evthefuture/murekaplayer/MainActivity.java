/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the WebView that runs mureka.ai with the shared player
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

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final String HOME = "https://www.mureka.ai/";
    private static final int PICK_FILE = 7;

    private FrameLayout root;
    private WebView web;

    // A window the page opened, the Google sign in for one, shown on top
    private WebView popup;

    // The shared player, read from the assets once
    private String playerJs;

    // The page waiting for the file picker to answer
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        playerJs = readAsset("player.js");

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#1d1d22"));
        setContentView(root);
        applyInsets();

        // chrome://inspect on the desktop can debug the page on the phone
        WebView.setWebContentsDebuggingEnabled(true);

        web = makeWebView();
        web.setWebViewClient(new MainClient());
        web.setWebChromeClient(new MainChrome());
        web.addJavascriptInterface(new Bridge(), "MurekaHost");
        root.addView(web, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(web, true);

        Hub.attach(web, this::quitApp);

        startForegroundService(new Intent(this, PlayerService.class));
        askForNotifications();

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(HOME);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {

        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    // The WebView is deliberately never paused. Pausing it would stop the
    // music as soon as the screen goes off or another app comes forward
    @Override
    protected void onDestroy() {

        Hub.detach();
        stopService(new Intent(this, PlayerService.class));
        closePopup();

        if (web != null) {

            web.destroy();
            web = null;
        }

        super.onDestroy();
    }

    // Back closes a popup, then goes back in the page, and finally only hides
    // the app so the music keeps playing
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {

        if (popup != null) {

            closePopup();
            return;
        }

        if (web != null && web.canGoBack()) {

            web.goBack();
            return;
        }

        moveTaskToBack(true);
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {

        if (requestCode == PICK_FILE && fileCallback != null) {

            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    private void quitApp() {
        finishAndRemoveTask();
    }

    // Android 15 draws apps under the status and navigation bars, so the
    // bars, the keyboard and any camera cutout are kept clear with padding
    @SuppressWarnings("deprecation")
    private void applyInsets() {

        root.setOnApplyWindowInsetsListener((v, insets) -> {

            if (Build.VERSION.SDK_INT >= 30) {

                Insets i = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());

                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }

            return insets;
        });
    }

    private void askForNotifications() {

        if (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {

            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 1);
        }
    }

    // A WebView set up like a real phone browser. Google refuses to sign in
    // inside anything that calls itself a WebView, so the markers that give
    // it away are taken out of the user agent
    @SuppressWarnings("deprecation")
    private WebView makeWebView() {

        WebView w = new WebView(this);
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

        return w;
    }

    private static boolean isMureka(String url) {

        if (url == null) {
            return false;
        }

        String host = Uri.parse(url).getHost();

        return host != null && (host.equals("mureka.ai") || host.endsWith(".mureka.ai"));
    }

    // Tag the page as the app and run the player. The player guards itself
    // against a second run on the same page
    private void injectPlayer(WebView view) {

        if (playerJs == null) {
            return;
        }

        view.evaluateJavascript("document.documentElement.setAttribute('data-mureka-host','apk');", null);
        view.evaluateJavascript(playerJs, null);
    }

    private void closePopup() {

        if (popup == null) {
            return;
        }

        root.removeView(popup);
        popup.destroy();
        popup = null;
    }

    private String readAsset(String name) {

        try (InputStream in = getAssets().open(name)) {

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

    // Web pages stay in the app, anything else, mail or a store link, goes
    // to whichever app handles it
    private boolean openOutside(WebResourceRequest request) {

        Uri uri = request.getUrl();
        String scheme = uri.getScheme();

        if ("http".equals(scheme) || "https".equals(scheme)) {
            return false;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            // Nothing handles it, the tap simply does nothing
        }

        return true;
    }

    // The player's way out to the app
    private static final class Bridge {

        @JavascriptInterface
        public void publish(String json) {
            Hub.publish(json);
        }
    }

    private final class MainClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return openOutside(request);
        }

        @Override
        public void onPageFinished(WebView view, String url) {

            if (isMureka(url)) {
                injectPlayer(view);
            }
        }
    }

    private final class MainChrome extends WebChromeClient {

        // A page asking for a new window gets one on top of the player, and
        // it goes away again when the page closes it
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {

            closePopup();

            WebView child = makeWebView();

            child.setWebViewClient(new WebViewClient() {

                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                    return openOutside(request);
                }
            });

            child.setWebChromeClient(new WebChromeClient() {

                @Override
                public void onCloseWindow(WebView window) {
                    closePopup();
                }
            });

            CookieManager.getInstance().setAcceptThirdPartyCookies(child, true);
            root.addView(child, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            popup = child;

            WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;

            transport.setWebView(child);
            resultMsg.sendToTarget();

            return true;
        }

        @Override
        public void onCloseWindow(WebView window) {
            closePopup();
        }

        // Import from file in the player's settings
        @Override
        @SuppressWarnings("deprecation")
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {

            if (fileCallback != null) {
                fileCallback.onReceiveValue(null);
            }

            fileCallback = callback;

            try {
                startActivityForResult(params.createIntent(), PICK_FILE);
            } catch (ActivityNotFoundException e) {

                fileCallback = null;
                return false;
            }

            return true;
        }
    }
}
