/*
 * Mureka Player - load and play all Mureka songs of an account
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
import android.media.AudioDeviceInfo;
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

    // Android's own media volume curve, the step in percent of the highest
    // and its level in dB, for an output that gives no curve of its own
    private static final float[][] MEDIA_CURVE = { { 1, -58 }, { 20, -40 }, { 60, -17 }, { 100, 0 } };

    // A curve spanning less than this is taken as none, as over Bluetooth
    // with absolute volume, where the speaker turns the sound down itself
    private static final float CURVE_MIN_SPAN_DB = 10;

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

    // Lower the volume by about the dB given, by the levels Android gives
    // the steps of the output in use, never below the lowest step above
    // silent. The answer as JSON: the step before, the step after and the
    // highest step, or empty when nothing could be done
    static String lowerBy(float db) {

        if (audio == null || !(db > 0)) {
            return "{}";
        }

        try {

            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int cur = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
            int want = cur;

            if (max > 0 && cur > 1) {

                int type = outputType();
                boolean own = hasCurve(type, max);
                float goal = stepDb(cur, max, type, own) - db;
                float best = Float.MAX_VALUE;

                // The step closest to the level wanted
                for (int i = 1; i <= cur; i++) {

                    float off = Math.abs(stepDb(i, max, type, own) - goal);

                    if (off < best) {

                        best = off;
                        want = i;
                    }
                }

                audio.setStreamVolume(AudioManager.STREAM_MUSIC, want, 0);
            }

            int now = audio.getStreamVolume(AudioManager.STREAM_MUSIC);

            Hub.setVolume(now, max);

            return "{\"from\":" + cur + ",\"to\":" + now + ",\"max\":" + max + "}";
        } catch (RuntimeException e) {

            // Do not disturb can refuse the change
            return "{}";
        }
    }

    // The kind of output the music most likely plays on: Bluetooth, then
    // headphones, else the speaker
    private static int outputType() {

        int found = AudioDeviceInfo.TYPE_BUILTIN_SPEAKER;
        int rank = 0;

        for (AudioDeviceInfo d : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {

            int t = d.getType();
            int r = 0;

            if (t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_BLE_HEADSET
                || t == AudioDeviceInfo.TYPE_BLE_SPEAKER) {
                r = 3;
            } else if (t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || t == AudioDeviceInfo.TYPE_WIRED_HEADSET
                || t == AudioDeviceInfo.TYPE_USB_HEADSET) {
                r = 2;
            }

            if (r > rank) {

                rank = r;
                found = t;
            }
        }

        return found;
    }

    // Whether the output has a volume curve of its own worth going by
    private static boolean hasCurve(int type, int max) {

        try {

            float low = audio.getStreamVolumeDb(AudioManager.STREAM_MUSIC, 1, type);
            float high = audio.getStreamVolumeDb(AudioManager.STREAM_MUSIC, max, type);

            return !Float.isNaN(low) && !Float.isInfinite(low) && !Float.isNaN(high)
                && !Float.isInfinite(high) && high - low >= CURVE_MIN_SPAN_DB;
        } catch (RuntimeException e) {
            return false;
        }
    }

    // The level of a step in dB, from the output's own curve or Android's
    // usual media curve
    private static float stepDb(int index, int max, int type, boolean own) {

        if (own) {

            try {
                return audio.getStreamVolumeDb(AudioManager.STREAM_MUSIC, index, type);
            } catch (RuntimeException e) {
                // Falls back to the usual curve below
            }
        }

        float pct = index * 100f / max;

        if (pct <= MEDIA_CURVE[0][0]) {
            return MEDIA_CURVE[0][1];
        }

        for (int i = 1; i < MEDIA_CURVE.length; i++) {

            if (pct <= MEDIA_CURVE[i][0]) {

                float[] a = MEDIA_CURVE[i - 1];
                float[] b = MEDIA_CURVE[i];

                return a[1] + (b[1] - a[1]) * (pct - a[0]) / (b[0] - a[0]);
            }
        }

        return 0;
    }
}
