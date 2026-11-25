/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, what happens when the phone goes on battery or the chosen
 * Bluetooth devices go away, and when they come back
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

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

// Power saving, two of them set apart: one for the charger pulled out,
// one for the last of the chosen Bluetooth devices going away. After its
// grace time each can pause the player, turn the hotspot off and stop the
// background work, the last at once or only once nothing is in use. When
// the charger or one of the devices comes back, its hotspot can come on
// and what it stopped starts again. Nothing happens with its master switch
// off. The player shows the countdown with a button to skip it
final class ChargeWatch {

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    // One runnable for the countdowns, so it can be taken off the queue
    // without touching anything else posted there
    private static final Runnable TICK = ChargeWatch::tick;

    // One kind of power saving: its settings' keys and where it stands
    private static final class Trigger {

        final String kind;
        final String master;
        final String grace;
        final String pause;
        final String hotspotOff;
        final String quiet;
        final String quietIdle;
        final String hotspotOn;

        boolean counting = false;
        long deadline = 0;

        // Whether the background work was stopped by this one, so coming
        // back starts it again, and only then
        boolean quietHere = false;

        Trigger(String kind, String master, String grace, String pause, String hotspotOff, String quiet,
            String quietIdle, String hotspotOn) {

            this.kind = kind;
            this.master = master;
            this.grace = grace;
            this.pause = pause;
            this.hotspotOff = hotspotOff;
            this.quiet = quiet;
            this.quietIdle = quietIdle;
            this.hotspotOn = hotspotOn;
        }

        boolean bluetooth() {
            return WebViewSettings.TRIGGER_BLUETOOTH.equals(kind);
        }

        // Its words for the log: what happened, and what came back
        String gone() {
            return bluetooth() ? "Bluetooth devices gone" : "on battery";
        }

        String back() {
            return bluetooth() ? "Bluetooth device back" : "on the charger";
        }
    }

    private static final Trigger CHARGER = new Trigger(WebViewSettings.TRIGGER_CHARGER,
        WebViewSettings.CHARGE_SAVE, WebViewSettings.CHARGE_GRACE, WebViewSettings.UNPLUG_PAUSE,
        WebViewSettings.UNPLUG_HOTSPOT, WebViewSettings.UNPLUG_QUIET, WebViewSettings.UNPLUG_QUIET_IDLE,
        WebViewSettings.PLUG_HOTSPOT);
    private static final Trigger BLUETOOTH = new Trigger(WebViewSettings.TRIGGER_BLUETOOTH,
        WebViewSettings.BT_SAVE, WebViewSettings.BT_GRACE, WebViewSettings.BT_PAUSE,
        WebViewSettings.BT_HOTSPOT, WebViewSettings.BT_QUIET, WebViewSettings.BT_QUIET_IDLE,
        WebViewSettings.BT_PLUG_HOTSPOT);
    private static final Trigger[] TRIGGERS = {CHARGER, BLUETOOTH};

    private static Context ctx;
    private static BroadcastReceiver receiver;

    // What started the countdown running now or the last one, charger or
    // bluetooth, for the player's words
    private static String reason = WebViewSettings.TRIGGER_CHARGER;

    // Whether one of the chosen Bluetooth devices was connected at the last
    // look, so only a change counts
    private static boolean btHere = false;

    // The hotspot is due to go off and waits for the browsers on it to go,
    // looked at every few seconds. The one that asked for it, so only its
    // coming back or its setting calls the wait off
    private static Trigger hotspotWaiter = null;
    private static final long HOTSPOT_LOOK_MS = 5000;
    private static final Runnable HOTSPOT_LOOK = ChargeWatch::hotspotLook;

    private ChargeWatch() {
    }

    static void start(Context c) {

        if (receiver != null || c == null) {
            return;
        }

        ctx = c.getApplicationContext();
        receiver = new BroadcastReceiver() {

            @Override
            public void onReceive(Context context, Intent intent) {

                String action = intent != null ? intent.getAction() : null;

                if (Intent.ACTION_POWER_DISCONNECTED.equals(action)) {
                    powerChanged(false);
                } else if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
                    powerChanged(true);
                }

                // The phone kept awake for WireGuard's pings on a charger
                // only, looked at again
                PlayerService.carChanged();
            }
        };

        IntentFilter filter = new IntentFilter();

        filter.addAction(Intent.ACTION_POWER_CONNECTED);
        filter.addAction(Intent.ACTION_POWER_DISCONNECTED);

        if (Build.VERSION.SDK_INT >= 33) {
            ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            ctx.registerReceiver(receiver, filter);
        }

        startBluetooth();
    }

    static void stop() {

        for (Trigger t : TRIGGERS) {
            t.counting = false;
        }

        MAIN.removeCallbacks(TICK);
        stopHotspotWait();
        BtWatch.stop();

        if (receiver != null && ctx != null) {

            try {
                ctx.unregisterReceiver(receiver);
            } catch (IllegalArgumentException e) {
                // Already gone
            }
        }

        receiver = null;
    }

    // The Bluetooth watch, started again once the permission is given. The
    // devices connected when it starts are the starting point, not a device
    // coming back
    static void startBluetooth() {

        MAIN.post(() -> {

            if (ctx == null) {
                return;
            }

            BtWatch.start(ctx, ChargeWatch::bluetoothChanged, () -> {

                btHere = BtWatch.anyConnected(WebViewSettings.btDevices(ctx));
                Hub.note("Power", btHere ? "a chosen Bluetooth device is connected" : "no chosen Bluetooth device is connected");
            });
        });
    }

    // A setting of the power saving changed. A master switch or the devices
    // that count stop that one's countdown, and the devices there now are
    // the starting point, so ticking a device that is connected does not
    // count as it coming back. A master switch turned off starts what it
    // stopped again. The background work's settings are followed at once
    static void settingsChanged(String key) {

        MAIN.post(() -> {

            if (ctx == null) {
                return;
            }

            for (Trigger t : TRIGGERS) {

                boolean devices = t.bluetooth() && WebViewSettings.SAVE_BT.equals(key);

                if (!t.master.equals(key) && !devices) {
                    continue;
                }

                if (t.counting) {

                    Hub.note("Power", "settings changed, the countdown stops");
                    cancel(t, -3);
                }

                if (t.quietHere && !WebViewSettings.on(ctx, t.master)) {

                    t.quietHere = false;
                    Hub.note("Power", "switched off, the background work it stopped starts again");
                }
            }

            if (WebViewSettings.SAVE_BT.equals(key)) {
                btHere = BtWatch.anyConnected(WebViewSettings.btDevices(ctx));
            }

            applyQuiet();
        });
    }

    // Skip shutdown, from the player's notice or the web view's
    static void skip() {

        MAIN.post(() -> {

            for (Trigger t : TRIGGERS) {

                if (t.counting) {

                    Hub.note("Power", "shutdown skipped");
                    cancel(t, -2);
                }
            }
        });
    }

    // The countdown ending soonest, null when none runs
    private static Trigger soonest() {

        Trigger best = null;

        for (Trigger t : TRIGGERS) {

            if (t.counting && (best == null || t.deadline < best.deadline)) {
                best = t;
            }
        }

        return best;
    }

    // Seconds left of the countdown ending soonest, -1 when none runs
    static int left() {

        Trigger t = soonest();

        return t != null ? (int) Math.max(0, (t.deadline - System.currentTimeMillis() + 999) / 1000) : -1;
    }

    // What started the countdown, charger or bluetooth
    static String reason() {
        return reason;
    }

    // Whether the power saving asks for the background work to stop now,
    // in force or waiting for nothing to be in use
    static boolean quiet() {

        for (Trigger t : TRIGGERS) {

            if (t.quietHere) {
                return true;
            }
        }

        return false;
    }

    // What the power saving asks of the background work told to the
    // service: stopped, and whether only once nothing is in use. That is
    // so only while every one asking for it says so
    private static void applyQuiet() {

        boolean wanted = false;
        boolean idle = true;

        for (Trigger t : TRIGGERS) {

            if (t.quietHere) {

                wanted = true;
                idle = idle && ctx != null && WebViewSettings.on(ctx, t.quietIdle);
            }
        }

        PlayerService.setQuiet(wanted, wanted && idle);
    }

    private static void powerChanged(boolean plugged) {

        if (plugged) {
            back(CHARGER);
        } else {
            away(CHARGER);
        }
    }

    // A device came or went. Only the chosen ones count, and only when the
    // first of them arrives or the last of them leaves
    private static void bluetoothChanged() {

        if (ctx == null) {
            return;
        }

        boolean here = BtWatch.anyConnected(WebViewSettings.btDevices(ctx));

        if (here == btHere) {
            return;
        }

        btHere = here;

        if (here) {
            back(BLUETOOTH);
        } else {
            away(BLUETOOTH);
        }
    }

    private static boolean anyAwayAction(Trigger t) {

        return WebViewSettings.on(ctx, t.master) && (WebViewSettings.on(ctx, t.pause)
            || WebViewSettings.on(ctx, t.hotspotOff) || WebViewSettings.on(ctx, t.quiet));
    }

    // The charger pulled out, or the last chosen device gone: its
    // countdown starts
    private static void away(Trigger t) {

        if (!anyAwayAction(t) || t.counting) {
            return;
        }

        int grace = WebViewSettings.grace(ctx, t.grace);

        reason = t.kind;
        Hub.note("Power", t.gone() + ", shutting down in " + grace + " s unless it changes back");
        Hub.command("unplugReason", t.kind);
        t.counting = true;
        t.deadline = System.currentTimeMillis() + grace * 1000L;
        MAIN.removeCallbacks(TICK);
        tick();
    }

    // The charger plugged in, or a chosen device connected: its countdown
    // stops, what it stopped starts again and the hotspot can come on
    private static void back(Trigger t) {

        String what = t.back();

        if (hotspotWaiter == t) {

            Hub.note("Power", what + ", the hotspot stays on");
            stopHotspotWait();
        }

        if (t.counting) {

            Hub.note("Power", what + ", nothing was stopped");
            cancel(t, -1);
        }

        if (t.quietHere) {

            t.quietHere = false;
            Hub.note("Power", what + ", the background work it stopped starts again");
            applyQuiet();
        }

        if (WebViewSettings.on(ctx, t.master) && WebViewSettings.on(ctx, t.hotspotOn)) {

            Hub.note("Power", what + ", turning the hotspot on");

            // The player shows a note while it switches and how it went
            Hub.command("hotspotAuto", "on");
            Hotspot.start(ctx);
        }
    }

    // Once a second the player hears how long is left of the countdown
    // ending soonest. Each one ending is carried out on its own
    private static void tick() {

        long now = System.currentTimeMillis();

        for (Trigger t : TRIGGERS) {

            if (t.counting && t.deadline <= now) {
                finish(t);
            }
        }

        Trigger next = soonest();

        if (next == null) {
            return;
        }

        if (!next.kind.equals(reason)) {

            reason = next.kind;
            Hub.command("unplugReason", next.kind);
        }

        Hub.command("unplugCountdown", left());
        MAIN.removeCallbacks(TICK);
        MAIN.postDelayed(TICK, 1000);
    }

    // A countdown ended without the charger or a device coming back
    private static void finish(Trigger t) {

        t.counting = false;
        Hub.command("unplugCountdown", 0);

        if (WebViewSettings.on(ctx, t.pause)) {

            Hub.note("Power", "pausing the music");
            Hub.command("pause", null);
        }

        if (WebViewSettings.on(ctx, t.hotspotOff)) {

            int browsers = WebViewServer.hotspotBrowsers();

            if (WebViewSettings.hotspotWaits(ctx) && browsers > 0) {

                Hub.note("Power", browsers + (browsers == 1 ? " browser is" : " browsers are")
                    + " on the hotspot, it goes off once they are gone");
                Hub.command("hotspotWaiting", browsers);
                hotspotWaiter = t;
                MAIN.removeCallbacks(HOTSPOT_LOOK);
                MAIN.postDelayed(HOTSPOT_LOOK, HOTSPOT_LOOK_MS);
            } else {
                hotspotOff(browsers > 0 ? "the browsers on it are cut off" : "nothing on it");
            }
        }

        if (WebViewSettings.on(ctx, t.quiet)) {

            Hub.note("Power", WebViewSettings.on(ctx, t.quietIdle)
                ? "the background work stops once nothing is in use" : "stopping all background work");
            t.quietHere = true;
            applyQuiet();
        }
    }

    // The hotspot off, the player told so it can say how it went
    private static void hotspotOff(String why) {

        Hub.note("Power", "turning the hotspot off, " + why);
        Hub.command("hotspotAuto", "off");
        Hotspot.stop(ctx);
    }

    // Waiting for the browsers on the hotspot: off once the last has gone,
    // a browser counting as gone a while after its last word
    private static void hotspotLook() {

        if (hotspotWaiter == null) {
            return;
        }

        if (WebViewServer.hotspotBrowsers() > 0) {

            MAIN.postDelayed(HOTSPOT_LOOK, HOTSPOT_LOOK_MS);
            return;
        }

        stopHotspotWait();
        hotspotOff("the last browser on it has gone");
    }

    private static void stopHotspotWait() {

        hotspotWaiter = null;
        MAIN.removeCallbacks(HOTSPOT_LOOK);
    }

    // Turning the hotspot off was switched off, or set not to wait, while it
    // waited for browsers
    static void hotspotSettingChanged() {

        MAIN.post(() -> {

            if (hotspotWaiter == null || ctx == null) {
                return;
            }

            if (!WebViewSettings.on(ctx, hotspotWaiter.hotspotOff)) {

                Hub.note("Power", "turning the hotspot off was switched off, it stays on");
                stopHotspotWait();
            } else if (!WebViewSettings.hotspotWaits(ctx)) {

                stopHotspotWait();
                hotspotOff("set not to wait for the browsers");
            }
        });
    }

    // A countdown stopped, why tells the player: -1 back again, -2
    // skipped, -3 the settings changed. With another still running, the
    // player goes on with that one at the next tick
    private static void cancel(Trigger t, int why) {

        if (!t.counting) {
            return;
        }

        t.counting = false;

        if (soonest() == null) {

            MAIN.removeCallbacks(TICK);
            Hub.command("unplugCountdown", why);
        }
    }
}
