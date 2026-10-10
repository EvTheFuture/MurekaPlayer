/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, the web view as the app's own screen on a tablet
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
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// On a tablet the app can show the web view, the page other browsers get,
// as its own screen. It is served by the app's own server over the device
// itself, while the player keeps running on the Mureka page underneath,
// which stays a tap away for signing in. This WebView belongs to the
// activity and goes with it, the player never depends on it
final class AppScreen {

    // The only pages this WebView shows, the app's own server
    static final String BASE = "http://127.0.0.1:" + PlayerService.PORT + "/";

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    // Whether the device is a tablet, as the activity last measured it,
    // for the player's settings
    static volatile boolean tablet = false;

    // What only the activity can do for the screen
    interface Owner {

        // Show the Mureka page with the player, the web view stays behind it
        void showMurekaPage();

        // Save what the server hands out at a path, asking where it goes
        void saveFrom(String name, String path, String mime);

        // The page's process died, so the screen is built again
        void screenGone();

        boolean showFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params);
    }

    private AppScreen() {
    }

    static WebView make(MainActivity activity, Owner owner) {

        WebView w = new WebView(activity);
        WebSettings s = w.getSettings();

        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " " + WebViewServer.APP_AGENT + "1");
        w.setBackgroundColor(Color.BLACK);

        Bridge bridge = new Bridge(owner);

        w.addJavascriptInterface(bridge, "MurekaApp");
        w.setWebViewClient(new Client(bridge, owner));
        w.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return owner.showFileChooser(callback, params);
            }
        });
        // The secret that tells the server this is the app's own screen
        CookieManager.getInstance().setCookie(BASE, WebViewServer.APP_COOKIE + "=" + WebViewServer.APP_SECRET
            + "; Path=/; HttpOnly; SameSite=Strict");

        w.loadUrl(BASE);

        return w;
    }

    // Whether the device is a tablet: the short side of the largest window
    // it can show, in dp. A window shared with another app does not change
    // the answer, so the screen does not switch when the window is resized
    @SuppressWarnings("deprecation")
    static boolean measure(Activity a) {

        float density = a.getResources().getDisplayMetrics().density;
        int w;
        int h;

        if (Build.VERSION.SDK_INT >= 30) {

            Rect r = a.getWindowManager().getMaximumWindowMetrics().getBounds();

            w = r.width();
            h = r.height();
        } else {

            android.util.DisplayMetrics dm = new android.util.DisplayMetrics();

            a.getWindowManager().getDefaultDisplay().getRealMetrics(dm);
            w = dm.widthPixels;
            h = dm.heightPixels;
        }

        tablet = density > 0 && Math.min(w, h) / density >= WebViewSettings.TABLET_DP;

        return tablet;
    }

    // Whether an address is one of the app's own pages
    static boolean own(String url) {
        return url != null && url.startsWith(BASE);
    }

    // The paths a file may be saved from: an export, or a song the server
    // fetches from Mureka. Nothing that could leave the device
    static boolean savable(String path) {

        if (path == null || path.length() > 4096 || path.indexOf('\n') >= 0 || path.indexOf('\r') >= 0) {
            return false;
        }

        return path.startsWith("/download/") || path.startsWith("/audio?url=");
    }

    // What the screen's page may ask of the app. Every page this WebView
    // loads is the app's own, which the client makes sure of, and every
    // call checks it once more
    private static final class Bridge {

        private final Owner owner;
        private volatile boolean onOwn;

        Bridge(Owner owner) {
            this.owner = owner;
        }

        @JavascriptInterface
        public void showMureka() {

            if (onOwn) {
                MAIN.post(owner::showMurekaPage);
            }
        }

        @JavascriptInterface
        public boolean saveFrom(String name, String path, String mime) {

            if (!onOwn || name == null || name.isEmpty() || name.length() > 200 || !savable(path)) {
                return false;
            }

            String type = "audio/mpeg".equals(mime) ? "audio/mpeg" : "application/json";

            MAIN.post(() -> owner.saveFrom(name, path, type));

            return true;
        }
    }

    private static final class Client extends WebViewClient {

        private final Bridge bridge;
        private final Owner owner;

        Client(Bridge bridge, Owner owner) {

            this.bridge = bridge;
            this.owner = owner;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {

            bridge.onOwn = own(url);
            super.onPageStarted(view, url, favicon);
        }

        // Only the app's own pages open here, anything else goes to the
        // browser on the device
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {

            Uri uri = request.getUrl();

            if (own(uri.toString())) {
                return false;
            }

            try {
                view.getContext().startActivity(new Intent(Intent.ACTION_VIEW, uri)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (ActivityNotFoundException e) {
                // Nothing handles it, the tap simply does nothing
            }

            return true;
        }

        // The server may still be starting when the app opens, so the
        // page is asked for again a moment later
        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {

            if (request.isForMainFrame()) {
                MAIN.postDelayed(() -> view.loadUrl(BASE), 1000);
            }
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {

            MAIN.post(owner::screenGone);

            return true;
        }
    }
}
