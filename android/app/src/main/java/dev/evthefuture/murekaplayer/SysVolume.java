/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the phone's own media volume, read and set from the web view
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
import android.media.AudioManager;
import android.os.Handler;
import android.os.Looper;

// The media volume of the phone, the one the volume buttons move. Over
// Bluetooth with absolute volume this is the audio system's own level, so the
// web view can show and move it like any other control. Android tells us
// when it changes, and a slow check catches the phones that do not
final class SysVolume {

    // Not a public constant, but the broadcast every Android version sends
    private static final String VOLUME_CHANGED = "android.media.VOLUME_CHANGED_ACTION";
    private static final long CHECK_MS = 3000;

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private static Context appContext;
    private static AudioManager audio;
    private static BroadcastReceiver watcher;

    private static final Runnable CHECK = new Runnable() {

        @Override
        public void run() {

            read();
            MAIN.postDelayed(this, CHECK_MS);
        }
    };

    private SysVolume() {
    }

    static void start(Context c) {

        if (appContext != null) {
            return;
        }

        appContext = c.getApplicationContext();
        audio = appContext.getSystemService(AudioManager.class);

        watcher = new BroadcastReceiver() {

            @Override
            public void onReceive(Context context, Intent intent) {
                read();
            }
        };

        try {
            appContext.registerReceiver(watcher, new IntentFilter(VOLUME_CHANGED));
        } catch (SecurityException | IllegalArgumentException e) {
            watcher = null;
        }

        read();
        MAIN.postDelayed(CHECK, CHECK_MS);
    }

    static void stop() {

        MAIN.removeCallbacks(CHECK);

        if (appContext != null && watcher != null) {

            try {
                appContext.unregisterReceiver(watcher);
            } catch (IllegalArgumentException e) {
                // It was never registered, nothing to take down
            }
        }

        watcher = null;
        audio = null;
        appContext = null;
    }

    // What the volume is now, into the state the web view reads
    static void read() {

        if (audio == null) {
            return;
        }

        try {
            Hub.setVolume(audio.getStreamVolume(AudioManager.STREAM_MUSIC),
                audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        } catch (RuntimeException e) {
            // No audio service just now, the next check tries again
        }
    }

    // Move the volume to one of the steps Android offers. Over Bluetooth
    // with absolute volume this travels on to the audio system
    static void set(int level) {

        if (audio == null) {
            return;
        }

        try {

            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int want = Math.max(0, Math.min(max, level));

            // No system volume panel over the page, the slider is
            // already showing what happens
            audio.setStreamVolume(AudioManager.STREAM_MUSIC, want, 0);
            Hub.setVolume(audio.getStreamVolume(AudioManager.STREAM_MUSIC), max);
        } catch (RuntimeException e) {
            // Do not disturb can refuse the change, so leave it as it was
        }
    }
}
