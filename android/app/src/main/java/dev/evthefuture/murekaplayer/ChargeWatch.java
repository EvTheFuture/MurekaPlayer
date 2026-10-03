/*
 * Mureka Player - load and play all your Mureka songs
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

// Power saving. What starts it is set in the settings: the charger pulled
// out, or the last of the chosen Bluetooth devices going away. After a
// grace time the player can pause, the hotspot go off and the background
// work stop, so a phone left somewhere warm stays cooler. When the charger
// or one of the devices comes back, the hotspot can come on and the work
// starts again. Nothing happens with the master switch off. The player
// shows the countdown with a button to skip it
final class ChargeWatch {

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    // One runnable for the countdown, so it can be taken off the queue
    // without touching anything else posted there
    private static final Runnable TICK = ChargeWatch::tick;

    private static Context ctx;
    private static BroadcastReceiver receiver;
    private static boolean counting = false;
    private static long deadline = 0;

    // Whether the background work was stopped here, so coming back starts
    // it again, and only then
    private static boolean quietHere = false;

    // What started the countdown running now or the last one, charger or
    // bluetooth, for the player's words
    private static String reason = CarSettings.TRIGGER_CHARGER;

    // Whether one of the chosen Bluetooth devices was connected at the last
    // look, so only a change counts
    private static boolean btHere = false;

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

        cancel(0);
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

    // The Bluetooth watch, started again once the permission is given
    static void startBluetooth() {

        MAIN.post(() -> {

            if (ctx == null) {
                return;
            }

            BtWatch.start(ctx, ChargeWatch::bluetoothChanged);
            btHere = BtWatch.anyConnected(CarSettings.btDevices(ctx));
        });
    }

    // What starts it or which devices count changed in the settings. A
    // countdown running is stopped, and the devices there now are taken as
    // the starting point, so ticking a device that is connected does not
    // count as it coming back
    static void settingsChanged() {

        MAIN.post(() -> {

            if (ctx == null) {
                return;
            }

            if (counting) {

                Hub.note("Power", "settings changed, the countdown stops");
                cancel(-3);
            }

            btHere = BtWatch.anyConnected(CarSettings.btDevices(ctx));
        });
    }

    // Skip shutdown, from the player's notice or the web view's
    static void skip() {

        MAIN.post(() -> {

            if (counting) {

                Hub.note("Power", "shutdown skipped");
                cancel(-2);
            }
        });
    }

    // Seconds left of the countdown, -1 when none runs
    static int left() {
        return counting ? (int) Math.max(0, (deadline - System.currentTimeMillis() + 999) / 1000) : -1;
    }

    // What started the countdown, charger or bluetooth
    static String reason() {
        return reason;
    }

    // Whether the background work is stopped by the power saving now
    static boolean quiet() {
        return quietHere;
    }

    private static boolean byBluetooth() {
        return CarSettings.TRIGGER_BLUETOOTH.equals(CarSettings.trigger(ctx));
    }

    private static void powerChanged(boolean plugged) {

        if (byBluetooth()) {
            return;
        }

        if (plugged) {
            back(CarSettings.TRIGGER_CHARGER);
        } else {
            away(CarSettings.TRIGGER_CHARGER);
        }
    }

    // A device came or went. Only the chosen ones count, and only when the
    // first of them arrives or the last of them leaves
    private static void bluetoothChanged() {

        if (ctx == null) {
            return;
        }

        boolean here = BtWatch.anyConnected(CarSettings.btDevices(ctx));

        if (here == btHere) {
            return;
        }

        btHere = here;

        if (!byBluetooth()) {
            return;
        }

        if (here) {
            back(CarSettings.TRIGGER_BLUETOOTH);
        } else {
            away(CarSettings.TRIGGER_BLUETOOTH);
        }
    }

    private static boolean anyAwayAction() {

        return CarSettings.on(ctx, CarSettings.CHARGE_SAVE) && (CarSettings.on(ctx, CarSettings.UNPLUG_PAUSE)
            || CarSettings.on(ctx, CarSettings.UNPLUG_HOTSPOT)
            || CarSettings.on(ctx, CarSettings.UNPLUG_QUIET));
    }

    // The charger pulled out, or the last chosen device gone: the
    // countdown starts
    private static void away(String why) {

        if (!anyAwayAction() || counting) {
            return;
        }

        int grace = CarSettings.chargeGrace(ctx);

        reason = why;
        Hub.note("Power", (CarSettings.TRIGGER_BLUETOOTH.equals(why) ? "Bluetooth devices gone" : "on battery")
            + ", shutting down in " + grace + " s unless it changes back");
        Hub.command("unplugReason", why);
        counting = true;
        deadline = System.currentTimeMillis() + grace * 1000L;
        tick();
    }

    // The charger plugged in, or a chosen device connected: a countdown
    // stops, the background work starts again and the hotspot can come on
    private static void back(String why) {

        String what = CarSettings.TRIGGER_BLUETOOTH.equals(why) ? "Bluetooth device back" : "on the charger";

        if (counting) {

            Hub.note("Power", what + ", nothing was stopped");
            reason = why;
            Hub.command("unplugReason", why);
            cancel(-1);
        }

        if (quietHere) {

            quietHere = false;
            Hub.note("Power", what + ", the background work starts again");
            PlayerService.setQuiet(false);
        }

        if (CarSettings.on(ctx, CarSettings.CHARGE_SAVE) && CarSettings.on(ctx, CarSettings.PLUG_HOTSPOT)) {

            Hub.note("Power", what + ", turning the hotspot on");
            Hotspot.start(ctx);
        }
    }

    // Once a second the player hears how long is left
    private static void tick() {

        if (!counting) {
            return;
        }

        int left = left();

        if (left <= 0) {

            finish();
            return;
        }

        Hub.command("unplugCountdown", left);
        MAIN.postDelayed(TICK, 1000);
    }

    // The countdown ended without the charger or a device coming back
    private static void finish() {

        counting = false;
        MAIN.removeCallbacks(TICK);
        Hub.command("unplugCountdown", 0);

        if (CarSettings.on(ctx, CarSettings.UNPLUG_PAUSE)) {

            Hub.note("Power", "pausing the music");
            Hub.command("pause", null);
        }

        if (CarSettings.on(ctx, CarSettings.UNPLUG_HOTSPOT)) {

            Hub.note("Power", "turning the hotspot off");
            Hotspot.stop(ctx);
        }

        if (CarSettings.on(ctx, CarSettings.UNPLUG_QUIET)) {

            Hub.note("Power", "stopping all background work");
            quietHere = true;
            PlayerService.setQuiet(true);
        }
    }

    // The countdown stopped, why tells the player: -1 back again, -2
    // skipped, -3 the settings changed
    private static void cancel(int why) {

        if (!counting) {
            return;
        }

        counting = false;
        MAIN.removeCallbacks(TICK);
        Hub.command("unplugCountdown", why);
    }
}
