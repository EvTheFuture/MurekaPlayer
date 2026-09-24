/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the screen that shows the player's WebView
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
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

// Only a window onto the player. The WebView belongs to PlayerWeb and keeps
// running when this screen closes, so leaving the app never stops the music
// or the web view. Quit in the notification ends everything
public class MainActivity extends Activity implements PlayerWeb.Host {

    private static final int PICK_FILE = 7;
    private static final int ASK_VPN = 8;
    private static final int SAVE_FILE = 9;

    private FrameLayout root;
    private WebView web;

    // A window the page opened, the Google sign in for one, shown on top
    private WebView popup;

    // The page waiting for the file picker to answer
    private ValueCallback<Uri[]> fileCallback;

    // The file waiting for the user to say where it goes
    private String saveText;
    private String saveName;

    // What the page shows fullscreen, and how to tell it fullscreen ended
    private android.view.View fullView;
    private WebChromeClient.CustomViewCallback fullCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {

        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#1d1d22"));
        setContentView(root);

        // Without this the system keeps the page out of the cutout strip,
        // whatever padding we ask for
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
        }

        applyInsets();
        applyFullscreen();

        // chrome://inspect on the desktop can debug the page on the phone
        WebView.setWebContentsDebuggingEnabled(true);

        // The service owns the player. Started here as well, so the music and
        // the web view keep going once this screen is closed
        startForegroundService(new Intent(this, PlayerService.class));
        askForNotifications();

        web = PlayerWeb.get(this);
        PlayerWeb.attachHost(this, this);

        if (web.getParent() instanceof ViewGroup) {
            ((ViewGroup) web.getParent()).removeView(web);
        }

        root.addView(web, 0, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    // The WebView is deliberately never paused or destroyed here. It is only
    // handed back, and the player keeps running without a screen
    @Override
    protected void onDestroy() {

        leaveFullscreen();
        closePopup();
        PlayerWeb.detachHost(this);
        web = null;

        super.onDestroy();
    }

    // Back closes a popup, then goes back in the page, and finally only hides
    // the app so the music keeps playing
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {

        if (fullView != null) {

            leaveFullscreen();
            return;
        }

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

    // Coming back from another app, or from the bars showing for a moment,
    // puts them away again
    @Override
    protected void onResume() {

        super.onResume();
        applyFullscreen();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {

        super.onWindowFocusChanged(hasFocus);

        if (hasFocus) {
            applyFullscreen();
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {

        if (requestCode == PICK_FILE && fileCallback != null) {

            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }

        if (requestCode == ASK_VPN) {

            vpnAnswered(resultCode == RESULT_OK);
            return;
        }

        if (requestCode == SAVE_FILE) {

            writeSaved(resultCode == RESULT_OK && data != null ? data.getData() : null);
            return;
        }

        super.onActivityResult(requestCode, resultCode, data);
    }

    // Android asks once whether the app may run a VPN. A no switches the public
    // address off again, so the setting never claims more than is running
    @Override
    @SuppressWarnings("deprecation")
    public void askVpnPermission(Intent intent) {

        try {
            startActivityForResult(intent, ASK_VPN);
        } catch (ActivityNotFoundException e) {
            vpnAnswered(false);
        }
    }

    private void vpnAnswered(boolean yes) {

        if (!yes) {

            CarSettings.store(this, CarSettings.VPN, "0");
            CarVpn.setStatus("permission refused");
        }

        PlayerService.settingsChanged();
    }

    @Override
    public void finishApp() {
        finishAndRemoveTask();
    }

    // The page's process died and the player came back in a new WebView,
    // which takes the old one's place on screen
    @Override
    public void replaceWeb(WebView fresh) {

        web = fresh;

        if (fresh.getParent() instanceof ViewGroup) {
            ((ViewGroup) fresh.getParent()).removeView(fresh);
        }

        root.addView(fresh, 0, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    // The page went fullscreen: its view covers everything and the status
    // and navigation bars step aside, a swipe brings them back for a moment
    @Override
    public void showFullscreen(android.view.View view, WebChromeClient.CustomViewCallback callback) {

        if (fullView != null) {
            hideFullscreen();
        }

        fullView = view;
        fullCallback = callback;
        root.addView(view, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.setPadding(0, 0, 0, 0);

        if (Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController() != null) {

            getWindow().getInsetsController().setSystemBarsBehavior(
                android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());
        }
    }

    @Override
    public void hideFullscreen() {

        if (fullView == null) {
            return;
        }

        root.removeView(fullView);
        fullView = null;
        fullCallback = null;

        applyFullscreen();
    }

    // Leaving from our side, the back button, tells the page as well
    private void leaveFullscreen() {

        WebChromeClient.CustomViewCallback cb = fullCallback;

        hideFullscreen();

        if (cb != null) {
            cb.onCustomViewHidden();
        }
    }

    // A page asking for a new window gets one on top of the player, and it
    // goes away again when the page closes it
    @Override
    public boolean openPopup(Message resultMsg) {

        closePopup();

        WebView child = PlayerWeb.make(this);

        child.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                return PlayerWeb.openOutside(request);
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
    public void closePopup() {

        if (popup == null) {
            return;
        }

        root.removeView(popup);
        popup.destroy();
        popup = null;
    }

    @Override
    @SuppressWarnings("deprecation")
    public boolean showFileChooser(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {

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

    // The player has a file to save, so the user picks the place with the
    // system's own dialog, which starts in the last folder they used
    @Override
    @SuppressWarnings("deprecation")
    public void saveFile(String name, String text) {

        saveName = name;
        saveText = text;

        Intent pick = new Intent(Intent.ACTION_CREATE_DOCUMENT);

        pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.setType("application/json");
        pick.putExtra(Intent.EXTRA_TITLE, name);

        try {
            startActivityForResult(pick, SAVE_FILE);
        } catch (ActivityNotFoundException e) {

            // No file app on this phone, so it goes to Downloads instead
            saveText = null;
            PlayerWeb.saveToDownloads(name, text);
        }
    }

    // Write what is waiting to the place the user picked, or say it was left
    private void writeSaved(Uri where) {

        String text = saveText;
        String name = saveName;

        saveText = null;
        saveName = null;

        if (text == null) {
            return;
        }

        if (where == null) {

            PlayerWeb.savedResult(false, "");
            return;
        }

        try (OutputStream out = getContentResolver().openOutputStream(where)) {

            if (out == null) {

                PlayerWeb.savedResult(false, "Could not save the file");
                return;
            }

            out.write(text.getBytes(StandardCharsets.UTF_8));
            PlayerWeb.savedResult(true, name);
        } catch (IOException | SecurityException e) {
            PlayerWeb.savedResult(false, "Could not save the file");
        }
    }

    // Android's own status and navigation bars, hidden while the setting
    // asks for it. A swipe from the edge still brings them back for a
    // moment, which every app has to live with
    @Override
    public void applyFullscreen() {

        // The page showing something fullscreen of its own already hides them
        if (fullView != null) {
            return;
        }

        boolean full = CarSettings.fullscreen(this);

        if (Build.VERSION.SDK_INT >= 30 && getWindow().getInsetsController() != null) {

            getWindow().getInsetsController().setSystemBarsBehavior(
                android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);

            if (full) {
                getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());
            } else {
                getWindow().getInsetsController().show(WindowInsets.Type.systemBars());
            }
        } else {

            // Android 10 has only the older flags
            int flags = full
                ? (android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                    | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
                : 0;

            root.setSystemUiVisibility(flags);
        }

        root.requestApplyInsets();
    }

    // Android 15 draws apps under the status and navigation bars, so the
    // bars, the keyboard and any camera cutout are kept clear with padding
    @SuppressWarnings("deprecation")
    private void applyInsets() {

        root.setOnApplyWindowInsetsListener((v, insets) -> {

            // Fullscreen uses every pixel, bars and cutout included
            if (fullView != null) {

                v.setPadding(0, 0, 0, 0);
                return insets;
            }

            if (Build.VERSION.SDK_INT >= 30) {

                // Fullscreen means the whole screen, the strip beside a
                // camera cutout included. The keyboard is still kept clear,
                // or it would cover what is being typed
                int types = CarSettings.fullscreen(this)
                    ? WindowInsets.Type.ime()
                    : (WindowInsets.Type.systemBars() | WindowInsets.Type.ime()
                        | WindowInsets.Type.displayCutout());

                Insets i = insets.getInsets(types);

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
}
