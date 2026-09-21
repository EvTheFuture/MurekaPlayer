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
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

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

    // Counts the states published, so the car page can wait for the next
    // one instead of asking again and again. Guarded by LOCK
    private static final Object LOCK = new Object();
    private static long seq = 0;

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

    // The state with its number, as soon as there is one newer than the one
    // the car page already has, or after the timeout with what there is. A
    // number from before the app restarted is answered at once
    static String awaitState(long since, long timeoutMs) {

        synchronized (LOCK) {

            long end = System.currentTimeMillis() + timeoutMs;

            while (seq == since) {

                long left = end - System.currentTimeMillis();

                if (left <= 0) {
                    break;
                }

                try {
                    LOCK.wait(left);
                } catch (InterruptedException e) {

                    Thread.currentThread().interrupt();
                    break;
                }
            }

            String json = stateJson.trim();
            String rest = json.startsWith("{") ? json.substring(1).trim() : "}";

            return "{\"seq\":" + seq + (rest.equals("}") ? "" : ",") + rest;
        }
    }

    // Called from the JavaScript bridge thread, handed over to the main one
    static void publish(String json) {

        final JSONObject parsed;

        try {
            parsed = new JSONObject(json);
        } catch (JSONException e) {
            return;
        }

        synchronized (LOCK) {

            stateJson = json;
            state = parsed;
            seq += 1;
            LOCK.notifyAll();
        }

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

    // Ask the player for a page of its song list
    static String requestList(String argJson, long timeoutMs) {
        return request("__murekaHostList", argJson, timeoutMs);
    }

    // Call one of the player's host functions and wait for what it returns,
    // as JSON. Called from a car server thread, which waits here, and gives
    // up rather than holding the connection open if the player does not
    // come back. The function name is fixed by the caller, never by the car
    static String request(String function, String argJson, long timeoutMs) {

        final BlockingQueue<String> answer = new ArrayBlockingQueue<>(1);
        final String js = "JSON.stringify(window." + function + " ? window." + function + "("
            + argJson + ") : null)";

        MAIN.post(() -> {

            WebView web = webRef.get();

            if (web == null) {

                answer.offer("");
                return;
            }

            web.evaluateJavascript(js, value -> {

                // evaluateJavascript hands back a JSON encoded value, so the
                // string the player built is still quoted at this point
                String json = "";

                try {

                    Object parsed = new JSONTokener(value == null ? "" : value).nextValue();

                    if (parsed instanceof String) {
                        json = (String) parsed;
                    }
                } catch (JSONException e) {
                    json = "";
                }

                answer.offer(json);
            });
        });

        try {

            String json = answer.poll(timeoutMs, TimeUnit.MILLISECONDS);

            return json == null ? "" : json;
        } catch (InterruptedException e) {

            Thread.currentThread().interrupt();
            return "";
        }
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

        // Objects and lists from the car are already valid JavaScript
        if (arg instanceof JSONObject || arg instanceof org.json.JSONArray) {
            return arg.toString();
        }

        return "null";
    }
}
