/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, starts the player when the phone starts
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
import android.content.SharedPreferences;

// Starts the service after the phone has started, and again after the app
// was updated, so the web view is there without opening the app first.
// Android only delivers this once the app has been opened at least once
public class BootReceiver extends BroadcastReceiver {

    // When the app was last updated, so the player can tell that it was
    // started again by an update and pick up where it was
    private static final String PREFS = "start";
    private static final String UPDATED_AT = "updatedAt";

    // How long after an update the player's start still counts as caused
    // by it
    private static final long UPDATE_FRESH_MS = 5 * 60 * 1000;

    @Override
    public void onReceive(Context context, Intent intent) {

        String action = intent.getAction();

        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {

            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putLong(UPDATED_AT, System.currentTimeMillis()).commit();
        }

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {

            context.startForegroundService(new Intent(context, PlayerService.class)
                .setAction(PlayerService.ACTION_BOOT));
        }
    }

    // Whether the app was just updated, answered yes once, so the next
    // ordinary start of the player is not taken for one after an update
    static boolean takeUpdateRestart(Context context) {

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long at = prefs.getLong(UPDATED_AT, 0);

        if (at == 0) {
            return false;
        }

        prefs.edit().remove(UPDATED_AT).apply();

        return System.currentTimeMillis() - at < UPDATE_FRESH_MS;
    }
}
