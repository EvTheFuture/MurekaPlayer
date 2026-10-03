/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, what happens when the charger is pulled out or plugged in
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

// Power saving with the charger. Pulled out, after a grace time the player
// can pause, the hotspot go off and the background work stop, so a phone
// left somewhere warm stays cooler. Plugged in again, the hotspot can come
// on and the work starts again. Nothing happens with the master switch
// off. The player shows the countdown with a button to skip it
final class ChargeWatch {

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private static Context ctx;
    private static BroadcastReceiver receiver;
    private static boolean counting = false;
    private static long deadline = 0;

    // Whether the background work was stopped here, so plugging in starts
    // it again, and only then
    private static boolean quietHere = false;

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
                    unplugged();
                } else if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
                    plugged();
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
    }

    static void stop() {

        cancel(0);

        if (receiver != null && ctx != null) {

            try {
                ctx.unregisterReceiver(receiver);
            } catch (IllegalArgumentException e) {
                // Already gone
            }
        }

        receiver = null;
    }

    // Skip shutdown, from the player's notice or the web view's
    static void skip() {

        MAIN.post(() -> {

            if (counting) {

                Hub.note("Charger", "shutdown skipped");
                cancel(-2);
            }
        });
    }

    // Seconds left of the countdown, -1 when none runs
    static int left() {
        return counting ? (int) Math.max(0, (deadline - System.currentTimeMillis() + 999) / 1000) : -1;
    }

    private static boolean anyUnplugAction() {

        return CarSettings.on(ctx, CarSettings.CHARGE_SAVE) && (CarSettings.on(ctx, CarSettings.UNPLUG_PAUSE)
            || CarSettings.on(ctx, CarSettings.UNPLUG_HOTSPOT)
            || CarSettings.on(ctx, CarSettings.UNPLUG_QUIET));
    }

    private static void unplugged() {

        if (!anyUnplugAction() || counting) {
            return;
        }

        int grace = CarSettings.chargeGrace(ctx);

        Hub.note("Charger", "pulled out, shutting down in " + grace + " s unless it comes back");
        counting = true;
        deadline = System.currentTimeMillis() + grace * 1000L;
        tick();
    }

    private static void plugged() {

        if (counting) {

            Hub.note("Charger", "plugged in again, nothing was stopped");
            cancel(-1);
        }

        if (quietHere) {

            quietHere = false;
            Hub.note("Charger", "plugged in, the background work starts again");
            PlayerService.setQuiet(false);
        }

        if (CarSettings.on(ctx, CarSettings.CHARGE_SAVE) && CarSettings.on(ctx, CarSettings.PLUG_HOTSPOT)) {

            Hub.note("Charger", "plugged in, switching the hotspot on");
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
        MAIN.postDelayed(ChargeWatch::tick, 1000);
    }

    // The countdown ended without the charger coming back
    private static void finish() {

        counting = false;
        MAIN.removeCallbacksAndMessages(null);
        Hub.command("unplugCountdown", 0);

        if (CarSettings.on(ctx, CarSettings.UNPLUG_PAUSE)) {

            Hub.note("Charger", "out, pausing the music");
            Hub.command("pause", null);
        }

        if (CarSettings.on(ctx, CarSettings.UNPLUG_HOTSPOT)) {

            Hub.note("Charger", "out, switching the hotspot off");
            Hotspot.stop(ctx);
        }

        if (CarSettings.on(ctx, CarSettings.UNPLUG_QUIET)) {

            Hub.note("Charger", "out, stopping the background work");
            quietHere = true;
            PlayerService.setQuiet(true);
        }
    }

    // The countdown stopped, why tells the player: -1 plugged in again, -2
    // skipped
    private static void cancel(int why) {

        if (!counting) {
            return;
        }

        counting = false;
        MAIN.removeCallbacksAndMessages(null);
        Hub.command("unplugCountdown", why);
    }
}
