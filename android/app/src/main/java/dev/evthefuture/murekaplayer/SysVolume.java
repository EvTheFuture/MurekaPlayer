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
import android.content.SharedPreferences;
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

    // More steps than Android has: a level in percent, the step at or above
    // it, and the player turning its own sound down by what lies between,
    // along the step's curve. Kept over a restart
    private static final String PREFS = "fine_volume";
    private static boolean fineOn;
    private static float finePct = -1;
    private static int fineStep = -1;
    private static float fineGain = 1;

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

        SharedPreferences prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        fineOn = prefs.getBoolean("on", false);
        finePct = prefs.getFloat("pct", -1);

        if (fineOn && finePct >= 0) {
            applyFine();
        } else {
            fineOn = false;
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

            int level = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

            // Moved by the phone's buttons, or night mode: more steps go on
            // from that step, the player at its whole sound
            if (fineOn && fineStep >= 0 && level != fineStep && max > 0) {

                fineStep = level;
                finePct = level * 100f / max;
                fineGain = 1;
                keepFine();
                Hub.setFine(finePct);
                Hub.command("fineGain", 1.0);
            }

            Hub.setVolume(level, max);
        } catch (RuntimeException e) {
            // No audio service just now, the next check tries again
        }
    }

    // More steps on or off, at a level in percent. Off, the player plays at
    // its whole sound again and the step stays as it is
    static void setFine(boolean on, float pct) {

        if (audio == null) {
            return;
        }

        try {

            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            int cur = audio.getStreamVolume(AudioManager.STREAM_MUSIC);

            fineOn = on;

            if (!on) {

                finePct = -1;
                fineStep = -1;
                fineGain = 1;
                keepFine();
                Hub.setFine(-1);
                Hub.command("fineGain", 1.0);
                return;
            }

            // Turned on without a level, it starts where the step is
            finePct = pct >= 0 ? Math.max(0, Math.min(100, pct)) : (max > 0 ? cur * 100f / max : 0);
            applyFine();
        } catch (RuntimeException e) {
            // Do not disturb can refuse the change, so leave it as it was
        }
    }

    // The step for a level in percent and the player's own sound for the
    // rest: the step at or above it, the sound between the step below's
    // and its own, evened out in loudness as heard, not in dB, so a level
    // just under a step is only a little quieter than the step even where
    // the phone's lowest steps lie far apart
    private static float[] finePlan(float pct, int max, int type, boolean own) {

        float at = pct / 100f * max;
        int step = (int) Math.ceil(at - 0.0001f);

        if (step <= 0) {
            return new float[] { 0, 1 };
        }

        // Below the lowest step only the player can go, by its share of it
        if (at < 1) {
            return new float[] { 1, Math.max(0, at) };
        }

        int below = (int) Math.floor(at);

        if (below >= step) {
            return new float[] { step, 1 };
        }

        float low = stepDb(below, max, type, own);
        float high = stepDb(step, max, type, own);

        // A step that tells no sensible level is taken as a whole step down
        float ratio = Float.isNaN(low) || Float.isInfinite(low) || low > high ? 0.5f : (float) Math.pow(10, (low - high) / 20);
        float share = at - below;
        float gain = ratio + (1 - ratio) * share;

        return new float[] { step, Math.max(0, Math.min(1, gain)) };
    }

    // The level heard at a level in percent, in dB, as the plan makes it
    private static float fineDb(float pct, int max, int type, boolean own) {

        float[] plan = finePlan(pct, max, type, own);

        if (plan[0] <= 0 || plan[1] <= 0) {
            return -200;
        }

        return stepDb((int) plan[0], max, type, own) + (float) (20 * Math.log10(plan[1]));
    }

    // The step for the level, and the player's own sound for the rest
    private static void applyFine() {

        int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

        if (max <= 0) {
            return;
        }

        int type = outputType();
        boolean own = hasCurve(type, max);
        float[] plan = finePlan(finePct, max, type, own);
        int step = (int) plan[0];

        fineStep = step;
        fineGain = plan[1];
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, step, 0);
        keepFine();
        Hub.setFine(finePct);
        Hub.command("fineGain", (double) fineGain);
        Hub.setVolume(audio.getStreamVolume(AudioManager.STREAM_MUSIC), max);
        Hub.note("Volume", "more steps: " + Math.round(finePct * 10) / 10f + "%, step " + step + " of " + max
            + (step > 0 ? " at " + Math.round(stepDb(step, max, type, own) * 10) / 10f + " dB" : "")
            + ", the player at " + Math.round(fineGain * 1000) / 10f + "%"
            + (own ? ", the output's own curve" : ", Android's usual curve"));
    }

    private static void keepFine() {

        if (appContext != null) {
            appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("on", fineOn).putFloat("pct", finePct).apply();
        }
    }

    // The player's own sound under more steps, 1 when they are off
    static float fineGain() {
        return fineOn ? fineGain : 1;
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

            // A whole step asked for, more steps follow it at the player's
            // whole sound
            if (fineOn && max > 0) {

                finePct = want * 100f / max;
                applyFine();
                return;
            }

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

            // With more steps the level goes down by the dB itself, in
            // percent, to the phone's lowest step at most
            if (fineOn && finePct > 0 && max > 0) {

                int type = outputType();
                boolean own = hasCurve(type, max);
                float from = finePct;
                float goal = fineDb(from, max, type, own) - db;
                float lowest = 100f / max;
                float to = from;

                while (to - 0.5f >= lowest && fineDb(to, max, type, own) > goal) {
                    to -= 0.5f;
                }

                finePct = Math.max(lowest, Math.min(from, to));
                applyFine();

                return "{\"from\":" + Math.round(from) + ",\"to\":" + Math.round(finePct) + ",\"max\":100}";
            }

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
