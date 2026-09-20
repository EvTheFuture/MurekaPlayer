/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the meeting point of the WebView, the service and the car page
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

import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

import java.lang.ref.WeakReference;
import java.util.concurrent.CopyOnWriteArrayList;

import org.json.JSONException;
import org.json.JSONObject;

// The player in the WebView publishes its now playing state here, and the
// media session, the notification and the car page read it from here. Their
// commands go the other way, into the player, through the same place
final class Hub {

    // Told on the main thread whenever the player publishes a new state
    interface Listener {
        void onState(JSONObject state);
    }

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final CopyOnWriteArrayList<Listener> LISTENERS = new CopyOnWriteArrayList<>();

    // The last state as the player sent it, and parsed
    private static volatile String stateJson = "{}";
    private static volatile JSONObject state = new JSONObject();

    // The WebView the player runs in, while the activity is alive
    private static WeakReference<WebView> webRef = new WeakReference<>(null);

    // Run when the notification asks the whole app to quit
    private static WeakReference<Runnable> quitRef = new WeakReference<>(null);

    private Hub() {
    }

    static void attach(WebView web, Runnable quit) {

        webRef = new WeakReference<>(web);
        quitRef = new WeakReference<>(quit);
    }

    static void detach() {

        webRef = new WeakReference<>(null);
        quitRef = new WeakReference<>(null);
    }

    static void addListener(Listener l) {
        LISTENERS.add(l);
    }

    static void removeListener(Listener l) {
        LISTENERS.remove(l);
    }

    static String stateJson() {
        return stateJson;
    }

    static JSONObject state() {
        return state;
    }

    // Called from the JavaScript bridge thread, handed over to the main one
    static void publish(String json) {

        final JSONObject parsed;

        try {
            parsed = new JSONObject(json);
        } catch (JSONException e) {
            return;
        }

        stateJson = json;
        state = parsed;

        MAIN.post(() -> {

            for (Listener l : LISTENERS) {
                l.onState(parsed);
            }
        });
    }

    // Send a command to the player. Safe from any thread
    static void command(String cmd, Object arg) {

        final String js = "window.__murekaHostCommand && window.__murekaHostCommand("
            + JSONObject.quote(cmd) + "," + toJs(arg) + ")";

        MAIN.post(() -> {

            WebView web = webRef.get();

            if (web != null) {
                web.evaluateJavascript(js, null);
            }
        });
    }

    static void quit() {

        MAIN.post(() -> {

            Runnable r = quitRef.get();

            if (r != null) {
                r.run();
            }
        });
    }

    // A command argument written as a JavaScript literal
    private static String toJs(Object arg) {

        if (arg instanceof Number || arg instanceof Boolean) {
            return String.valueOf(arg);
        }

        if (arg instanceof String) {
            return JSONObject.quote((String) arg);
        }

        return "null";
    }
}
