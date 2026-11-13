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

import java.util.HashMap;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

import org.json.JSONException;
import org.json.JSONObject;

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

    // The phone's volume buttons moving more steps by 1%, and the level
    // in dB of the step in use, for the stats and the volume popup
    private static boolean buttons;
    private static float fineStepDb = Float.NaN;

    // Passing a step, the player's share changes first and the step a
    // moment later: the share is heard only once the sound already on its
    // way has played out, Bluetooth's buffer most of all, while a step
    // over Bluetooth with absolute volume reaches the speaker at once. The
    // step going up before the share went down was heard as a short burst.
    // The step waiting, and the wait for each kind of output
    private static volatile int stepWaiting = -1;
    private static final long STEP_WAIT_BT_MS = 250;
    private static final long STEP_WAIT_MS = 80;
    private static final Runnable STEP_LATER = new Runnable() {
        @Override
        public void run() {
            takeWaitingStep();
        }
    };

    // The size of each step in dB set by hand in the player's sound
    // profiles for each Bluetooth speaker by its address, and for this
    // phone and the speakers not set up, as the phone's own curve can be
    // far from what a speaker with absolute volume does with it. 0 or
    // less goes by the curve. The one for the output in use, and the
    // output it was looked up for
    private static final Map<String, Float> HAND_BY_ADDRESS = new HashMap<>();
    private static float handFallback = 0;
    private static float handDb = -1;
    private static String outKey = null;
    private static final float HAND_MAX_DB = 30;

    // The gap in dB to the step below for each of the phone's steps, found
    // by ear in the player's training, for each speaker by its address and
    // for this phone and the speakers not trained. Only the steps trained
    // are kept, those between drawn on a straight line from them, and
    // beyond the first and the last the nearest is used. A speaker's own
    // training goes before its step size set by hand, and this phone's
    // before the step size for the speakers not set up. The ones for the
    // output in use, null when it has none
    private static final Map<String, TreeMap<Integer, Float>> GAPS_BY_ADDRESS = new HashMap<>();
    private static TreeMap<Integer, Float> gapsFallback = new TreeMap<>();
    private static TreeMap<Integer, Float> gaps = null;

    // How long a speaker takes to play what the player sends, found in the
    // same training, by the address and for this phone and the speakers
    // not trained, in ms. With it the player's share and the step reach
    // the speaker at the same moment, going up and going down. -1 for the
    // output in use when there is none, the waits below used instead
    private static final Map<String, Integer> DELAY_BY_ADDRESS = new HashMap<>();

    // How much quieter the lowest level above silence is than the phone's
    // first step, in dB, typed in by hand, for each speaker and for this
    // phone and the speakers without. Set, the levels under the first step
    // go down by it evenly in dB, else by the share of the first step. The
    // one for the output in use, 0 when there is none
    private static final Map<String, Float> LOW_BY_ADDRESS = new HashMap<>();
    private static float lowFallback = 0;
    private static float lowDb = 0;
    private static final float LOW_MAX_DB = 60;
    private static int delayFallback = -1;
    private static int stepDelay = -1;

    // The training: the step trained and the one below it in turn, the
    // step turned down by the player by the gap being tried, so the two
    // sound the same once the gap is right. Both turned down alike by the
    // quieter amount for training at night. Switched from one to the other
    // when asked, with no break in the sound between them
    private static boolean training = false;
    private static int trainStep = 2;
    private static float trainGap = 3;
    private static float trainQuiet = 0;
    private static long trainDelay = 250;
    private static boolean trainUpper = false;
    private static int trainBefore = -1;
    private static String trainKey = null;
    private static final long TRAIN_FADE_MS = 30;
    private static final long TRAIN_DELAY_MAX_MS = 1000;

    // Left on with nothing asked for a while, as a closed page cannot say
    // so, the training ends by itself
    private static final long TRAIN_IDLE_MS = 15 * 60 * 1000;
    private static final Runnable TRAIN_IDLE = new Runnable() {
        @Override
        public void run() {
            stopTrain();
        }
    };
    private static final Runnable TRAIN_STEP = new Runnable() {
        @Override
        public void run() {
            putTrainStep();
        }
    };

    // The highest volume in percent a Bluetooth speaker may start at, set
    // for each speaker by its address in the player's sound profiles. As
    // it connects a volume above it is lowered to it, one below is left
    // alone. The output last seen, null before the first look, so a
    // speaker already playing when the app starts keeps its volume
    private static final Map<String, Integer> CAP_BY_ADDRESS = new HashMap<>();
    private static String seenKey = null;

    // Android puts back the volume a speaker had a moment after it
    // connects, so the volume is checked a little later, and once more
    private static final long CAP_FIRST_MS = 1500;
    private static final long CAP_AGAIN_MS = 4000;
    private static final Runnable CAP_CHECK = new Runnable() {
        @Override
        public void run() {
            capVolume();
        }
    };

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
        buttons = prefs.getBoolean("buttons", false);
        Hub.setVolButtons(buttons);
        readStepSizes(prefs.getString("step_sizes", "{}"));

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
        MAIN.removeCallbacks(CAP_CHECK);
        MAIN.removeCallbacks(TRAIN_IDLE);
        MAIN.removeCallbacks(TRAIN_STEP);
        training = false;
        seenKey = null;

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
            boolean moved = refreshOutput();

            // Moved by the phone's buttons, or night mode: more steps go on
            // from that step, the player at its whole sound. Not while a
            // step of its own is still waiting to be put in
            if (fineOn && !training && fineStep >= 0 && level != fineStep && max > 0 && stepWaiting < 0) {

                fineStep = level;
                finePct = stepPct(level, max);
                fineGain = 1;
                keepFine();
                Hub.setFine(finePct);
                Hub.command("fineGain", 1.0);
            }

            // Another output, with a step size of its own perhaps
            if (moved && fineOn && !training && max > 0) {
                applyFine();
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

                takeWaitingStep();
                finePct = -1;
                fineStep = -1;
                fineGain = 1;
                keepFine();
                Hub.setFine(-1);
                Hub.setFineInfo(Float.NaN, 0);
                Hub.command("fineGain", 1.0);
                PlayerService.volumeKeys();
                return;
            }

            // Turned on without a level, it starts where the step is
            finePct = pct >= 0 ? Math.max(0, Math.min(100, pct)) : stepPct(cur, max);
            applyFine();
        } catch (RuntimeException e) {
            // Do not disturb can refuse the change, so leave it as it was
        }
    }

    // Where one of the phone's steps sits in percent, on a whole percent,
    // so each step is reached exactly by going a percent at a time
    static float stepPct(int step, int max) {
        return max > 0 ? Math.round(100f * Math.max(0, Math.min(max, step)) / max) : 0;
    }

    // The step for a level in percent and the player's own sound for the
    // rest. On a step the player plays at its whole sound. Going down from
    // it the player lowers the sound by the same dB for each percent, the
    // percent just above the step below lowered the most, and one more
    // down is that step at its whole sound again. So every step has the
    // same cuts under it, whatever the percent it falls on
    private static float[] finePlan(float pct, int max, int type, boolean own) {

        float p = Math.max(0, Math.min(100, pct));

        if (p <= 0 || max <= 0) {
            return new float[] { 0, 1 };
        }

        int step = 1;

        while (step < max && stepPct(step, max) < p - 0.0001f) {
            step++;
        }

        float high = stepPct(step, max);
        float low = stepPct(step - 1, max);

        if (p >= high - 0.0001f || high <= low) {
            return new float[] { step, 1 };
        }

        // Below the lowest step only the player can go: down evenly in dB
        // to the lowest percent when how far is typed in, else by the
        // share of the step
        if (step == 1) {

            if (lowDb > 0 && high > 1) {

                float down = lowDb * (high - Math.max(1, p)) / (high - 1);

                // Under a whole percent, the rest of the way by its share
                float share = p < 1 ? p : 1;

                return new float[] { 1, (float) Math.pow(10, -down / 20) * share };
            }

            return new float[] { 1, Math.max(0, p / high) };
        }

        // The gap between the step and the one below, a step that tells no
        // sensible level taken as 6 dB
        float gap = stepDb(step, max, type, own) - stepDb(step - 1, max, type, own);

        if (Float.isNaN(gap) || Float.isInfinite(gap) || gap <= 0) {
            gap = 6;
        }

        float down = gap * (high - p) / (high - low);
        float gain = (float) Math.pow(10, -down / 20);

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

        // The training has the steps and the player's share to itself, the
        // level asked for meanwhile goes in once it ends
        if (training) {

            keepFine();
            Hub.setFine(finePct);
            return;
        }

        int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

        if (max <= 0) {
            return;
        }

        refreshOutput();

        int type = outputType();
        boolean own = hasCurve(type, max);
        float[] plan = finePlan(finePct, max, type, own);
        int step = (int) plan[0];

        int was = stepWaiting >= 0 ? stepWaiting : audio.getStreamVolume(AudioManager.STREAM_MUSIC);
        long wait = 0;

        fineStep = step;
        fineGain = plan[1];
        fineStepDb = step > 0 ? stepDb(step, max, type, own) : Float.NaN;

        // Going up, the share first, then the step once the share is
        // heard, as a step too early is a burst. Going down, the step at
        // once with the share, as the share rising is heard late anyway: a
        // step put in after it was a short rise, at once it can only be a
        // short dip. The same step asked for again, as a slider sends its
        // last place twice, leaves one still waiting to go in as planned:
        // dropped, the phone stayed on the step below, and the next check
        // took that for the volume buttons and moved the level down to it
        if (step != was) {
            MAIN.removeCallbacks(STEP_LATER);
        }

        // The speaker's delay found by ear: the share at once and the step
        // after it, either way, so both are heard at the same moment
        if (step != was && stepDelay >= 0) {

            wait = stepDelay;
            Hub.command("fineGain", (double) fineGain);
            stepWaiting = step;

            if (wait > 0) {
                MAIN.postDelayed(STEP_LATER, wait);
            } else {
                takeWaitingStep();
            }
        } else if (step > was) {

            boolean bluetooth = type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || type == AudioDeviceInfo.TYPE_BLE_HEADSET
                || type == AudioDeviceInfo.TYPE_BLE_SPEAKER;

            wait = bluetooth ? STEP_WAIT_BT_MS : STEP_WAIT_MS;
            Hub.command("fineGain", (double) fineGain);
            stepWaiting = step;
            MAIN.postDelayed(STEP_LATER, wait);
        } else if (step < was) {

            stepWaiting = step;
            takeWaitingStep();
            Hub.command("fineGain", (double) fineGain);
        } else {
            Hub.command("fineGain", (double) fineGain);
        }

        keepFine();
        Hub.setFine(finePct);
        Hub.setFineInfo(fineStepDb, fineGain > 0 ? (float) (20 * Math.log10(fineGain)) : -200);
        PlayerService.volumeKeys();
        Hub.note("Volume", "more steps: " + Math.round(finePct * 10) / 10f + "%, step " + step + " of " + max
            + (step != was ? " from " + was + (wait > 0 ? " after " + wait + " ms" : " at once") : "")
            + (step > 0 ? " at " + Math.round(stepDb(step, max, type, own) * 10) / 10f + " dB" : "")
            + ", the player at " + Math.round(fineGain * 1000) / 10f + "%"
            + (handDb > 0 ? ", " + handDb + " dB a step set by hand"
                : (own ? ", the output's own curve" : ", Android's usual curve")));
    }

    // The step waiting for the player's share to be heard put in, now
    private static void takeWaitingStep() {

        MAIN.removeCallbacks(STEP_LATER);

        int step = stepWaiting;

        stepWaiting = -1;

        if (step < 0 || audio == null) {
            return;
        }

        try {

            audio.setStreamVolume(AudioManager.STREAM_MUSIC, step, 0);
            Hub.setVolume(audio.getStreamVolume(AudioManager.STREAM_MUSIC), audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        } catch (RuntimeException e) {
            // Do not disturb can refuse the change, the next check sees it
        }
    }

    // The step sizes set by hand in the player's sound profiles, as JSON:
    // the fallback and a dB for each speaker's address. Kept, and the
    // level in use evened out by them at once
    static void setStepSizes(String json) {

        if (audio == null) {
            return;
        }

        try {

            readStepSizes(json);
            appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("step_sizes", json).apply();
            outKey = null;

            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

            if (fineOn && max > 0) {
                applyFine();
            } else {
                refreshOutput();
            }
        } catch (RuntimeException e) {
            // No audio service just now, the sizes apply with the next change
        }
    }

    private static void readStepSizes(String json) {

        HAND_BY_ADDRESS.clear();
        CAP_BY_ADDRESS.clear();
        GAPS_BY_ADDRESS.clear();
        DELAY_BY_ADDRESS.clear();
        LOW_BY_ADDRESS.clear();
        lowFallback = 0;
        delayFallback = -1;
        gapsFallback = new TreeMap<>();
        handFallback = 0;

        try {

            JSONObject o = new JSONObject(json == null ? "{}" : json);
            JSONObject devices = o.optJSONObject("devices");

            handFallback = cleanStep(o.optDouble("fallback", 0));

            if (devices != null) {

                Iterator<String> keys = devices.keys();

                while (keys.hasNext()) {

                    String a = keys.next();

                    HAND_BY_ADDRESS.put(a.toUpperCase(Locale.ROOT), cleanStep(devices.optDouble(a, 0)));
                }
            }

            JSONObject trained = o.optJSONObject("gaps");

            if (trained != null) {

                Iterator<String> keys = trained.keys();

                while (keys.hasNext()) {

                    String a = keys.next();
                    TreeMap<Integer, Float> one = readGaps(trained.optJSONObject(a));

                    if (!one.isEmpty()) {
                        GAPS_BY_ADDRESS.put(a.toUpperCase(Locale.ROOT), one);
                    }
                }
            }

            gapsFallback = readGaps(o.optJSONObject("fallbackGaps"));

            JSONObject delays = o.optJSONObject("delays");

            if (delays != null) {

                Iterator<String> keys = delays.keys();

                while (keys.hasNext()) {

                    String a = keys.next();
                    int ms = delays.optInt(a, -1);

                    if (ms >= 0 && ms <= TRAIN_DELAY_MAX_MS) {
                        DELAY_BY_ADDRESS.put(a.toUpperCase(Locale.ROOT), ms);
                    }
                }
            }

            int fbDelay = o.optInt("fallbackDelay", -1);

            delayFallback = fbDelay >= 0 && fbDelay <= TRAIN_DELAY_MAX_MS ? fbDelay : -1;

            JSONObject lows = o.optJSONObject("lows");

            if (lows != null) {

                Iterator<String> keys = lows.keys();

                while (keys.hasNext()) {

                    String a = keys.next();
                    float db = (float) lows.optDouble(a, 0);

                    if (db > 0 && db <= LOW_MAX_DB) {
                        LOW_BY_ADDRESS.put(a.toUpperCase(Locale.ROOT), db);
                    }
                }
            }

            float fbLow = (float) o.optDouble("fallbackLow", 0);

            lowFallback = fbLow > 0 && fbLow <= LOW_MAX_DB ? fbLow : 0;

            JSONObject caps = o.optJSONObject("caps");

            if (caps != null) {

                Iterator<String> keys = caps.keys();

                while (keys.hasNext()) {

                    String a = keys.next();
                    int pct = caps.optInt(a, 0);

                    if (pct > 0 && pct <= 100) {
                        CAP_BY_ADDRESS.put(a.toUpperCase(Locale.ROOT), pct);
                    }
                }
            }
        } catch (JSONException e) {
            // Nothing readable, the curve for every output
        }
    }

    // The gaps of one output, by the step, as sent: each a step and its dB
    private static TreeMap<Integer, Float> readGaps(JSONObject o) {

        TreeMap<Integer, Float> out = new TreeMap<>();

        if (o == null) {
            return out;
        }

        Iterator<String> keys = o.keys();

        while (keys.hasNext()) {

            String k = keys.next();
            float db = cleanStep(o.optDouble(k, 0));

            try {

                int step = Integer.parseInt(k);

                if (step >= 1 && step <= 200 && db > 0) {
                    out.put(step, db);
                }
            } catch (NumberFormatException e) {
                // Not a step, left out
            }
        }

        return out;
    }

    // The gap to the step below of a step, from the steps trained
    private static float gapAt(int step) {

        Map.Entry<Integer, Float> low = gaps.floorEntry(step);
        Map.Entry<Integer, Float> high = gaps.ceilingEntry(step);

        if (low == null) {
            return high.getValue();
        }

        if (high == null || low.getKey().equals(high.getKey())) {
            return low.getValue();
        }

        float t = (step - low.getKey()) / (float) (high.getKey() - low.getKey());

        return low.getValue() + (high.getValue() - low.getValue()) * t;
    }

    private static float cleanStep(double db) {
        return Double.isNaN(db) || db <= 0 ? 0 : (float) Math.min(HAND_MAX_DB, db);
    }

    // The gap in dB between two steps by the phone's own curve, for a
    // Bluetooth speaker or this phone, near the step in use, -1 when the
    // curve tells none. Shown in the sound profiles as what the phone says
    static float curveStepDb(boolean bluetooth) {

        if (audio == null) {
            return -1;
        }

        try {

            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

            if (max < 2) {
                return -1;
            }

            int type = bluetooth ? AudioDeviceInfo.TYPE_BLUETOOTH_A2DP : AudioDeviceInfo.TYPE_BUILTIN_SPEAKER;
            boolean own = hasCurve(type, max);
            int cur = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
            int high = Math.max(2, Math.min(max, cur));
            float d = curveDb(high, max, type, own) - curveDb(high - 1, max, type, own);

            return Float.isNaN(d) || Float.isInfinite(d) || d <= 0 ? -1 : Math.round(d * 10) / 10f;
        } catch (RuntimeException e) {
            return -1;
        }
    }

    // The output in use, and its step size set by hand when it changed.
    // True when it did
    private static boolean refreshOutput() {

        String key = outputKey();

        watchConnect(key);

        if (key.equals(outKey)) {
            return false;
        }

        // Another output in the middle of training: the training is over.
        // The step sizes sent again only make the output looked up anew
        if (training && trainKey != null && !key.equals(trainKey)) {
            MAIN.post(SysVolume::stopTrain);
        }

        outKey = key;

        // A speaker set up in the player has its own, the others and this
        // phone the fallback, set for this device. Trained or typed gaps go
        // first, then a step size from before
        String address = key.startsWith("bt:") ? key.substring(3) : "";
        Float own = address.isEmpty() ? null : HAND_BY_ADDRESS.get(address);
        TreeMap<Integer, Float> ownGaps = address.isEmpty() ? null : GAPS_BY_ADDRESS.get(address);

        gaps = null;
        handDb = -1;

        Integer ownDelay = address.isEmpty() ? null : DELAY_BY_ADDRESS.get(address);
        Float ownLow = address.isEmpty() ? null : LOW_BY_ADDRESS.get(address);

        lowDb = ownLow != null ? ownLow : lowFallback;

        stepDelay = ownDelay != null ? ownDelay : (address.isEmpty() ? delayFallback : -1);

        if (ownGaps != null && !ownGaps.isEmpty()) {
            gaps = ownGaps;
        } else if (own != null && own > 0) {
            handDb = own;
        } else if (!gapsFallback.isEmpty()) {
            gaps = gapsFallback;
        } else if (handFallback > 0) {
            handDb = handFallback;
        }

        return true;
    }

    // A speaker with a highest volume set has just become the output: its
    // volume checked once Android has put it back
    private static void watchConnect(String key) {

        if (key.equals(seenKey)) {
            return;
        }

        String was = seenKey;

        seenKey = key;
        MAIN.removeCallbacks(CAP_CHECK);

        if (was == null || !key.startsWith("bt:") || !CAP_BY_ADDRESS.containsKey(key.substring(3))) {
            return;
        }

        Hub.note("Volume", "a speaker with a highest volume of " + CAP_BY_ADDRESS.get(key.substring(3)) + "% connected");
        MAIN.postDelayed(CAP_CHECK, CAP_FIRST_MS);
        MAIN.postDelayed(CAP_CHECK, CAP_AGAIN_MS);
    }

    // The volume of the speaker in use lowered to its highest, when above
    private static void capVolume() {

        if (audio == null) {
            return;
        }

        try {

            // What the volume is now, with more steps following a step
            // Android put back
            read();

            String key = outputKey();
            Integer cap = key.startsWith("bt:") && !training ? CAP_BY_ADDRESS.get(key.substring(3)) : null;
            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

            if (cap == null || max <= 0) {
                return;
            }

            if (fineOn && finePct >= 0) {

                if (finePct > cap) {

                    Hub.note("Volume", "lowered from " + Math.round(finePct) + "% to " + cap + "%, the speaker's highest as it connects");
                    finePct = cap;
                    applyFine();
                }

                return;
            }

            int cur = audio.getStreamVolume(AudioManager.STREAM_MUSIC);

            // The step at or under the highest, never silent
            int want = Math.max(1, (int) Math.floor(cap * max / 100f + 0.0001f));

            if (cur > want) {

                audio.setStreamVolume(AudioManager.STREAM_MUSIC, want, 0);
                Hub.note("Volume", "lowered from step " + cur + " to " + want + " of " + max + ", the speaker's highest of " + cap + "% as it connects");
                Hub.setVolume(audio.getStreamVolume(AudioManager.STREAM_MUSIC), max);
            }
        } catch (RuntimeException e) {
            // Do not disturb can refuse the change, so leave it as it was
        }
    }

    // The training on, its step, gap and quieter amount changed, or off,
    // as JSON from the player: on, step, gap and quiet, in dB
    static void train(String json) {

        if (audio == null) {
            return;
        }

        try {

            JSONObject a = new JSONObject(json == null ? "{}" : json);
            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

            if (!a.optBoolean("on", false) || max < 2) {

                stopTrain();
                return;
            }

            int step = Math.max(2, Math.min(max, a.optInt("step", 2)));
            boolean upper = a.optBoolean("upper", true);
            float gap = (float) Math.max(0, Math.min(HAND_MAX_DB, a.optDouble("gap", 3)));
            float quiet = (float) Math.max(0, Math.min(40, a.optDouble("quiet", 0)));

            trainDelay = Math.max(0, Math.min(TRAIN_DELAY_MAX_MS, a.optLong("delay", 250)));
            boolean fresh = !training || step != trainStep;

            trainGap = gap;
            trainQuiet = quiet;

            // Left on with nothing asked for a while, as a closed page
            // cannot say so, the training ends by itself
            MAIN.removeCallbacks(TRAIN_IDLE);
            MAIN.postDelayed(TRAIN_IDLE, TRAIN_IDLE_MS);

            if (!training) {

                MAIN.removeCallbacks(STEP_LATER);
                stepWaiting = -1;
                trainBefore = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
                trainKey = outputKey();
                training = true;
                Hub.note("Volume", "training on, from step " + trainBefore + " of " + max);
            }

            trainStep = step;

            // A new step, or the other side asked for, is switched to, a new
            // gap or quieter amount is heard at once in the side playing
            if (fresh || upper != trainUpper) {

                MAIN.removeCallbacks(TRAIN_STEP);
                trainUpper = !upper;

                if (fresh) {
                    Hub.note("Volume", "training step " + step + " against " + (step - 1) + ", the gap " + gap + " dB, "
                        + quiet + " dB quieter, the step " + trainDelay + " ms after the player");
                }

                trainSwitch();
            } else {
                Hub.command("fineGainFade", trainFadeArg(trainUpper ? trainGain(true) : trainGain(false)));
            }
        } catch (JSONException | RuntimeException e) {
            stopTrain();
        }
    }

    // The player's share for a side: the step trained turned down by the
    // gap, the one below as it is, both by the quieter amount
    private static double trainGain(boolean upper) {
        return Math.pow(10, -((upper ? trainGap : 0) + trainQuiet) / 20.0);
    }

    private static JSONObject trainFadeArg(double gain) {

        JSONObject o = new JSONObject();

        try {

            o.put("g", gain);
            o.put("ms", TRAIN_FADE_MS);
        } catch (JSONException e) {
            // Plain numbers always go in
        }

        return o;
    }

    // The other side, without a break in the sound: the player's share
    // first and the step after the speaker's delay, as the share is heard
    // only once Bluetooth's buffer has played out while the step reaches
    // the speaker at once. With the delay right nothing is heard at the
    // change but the change itself, a delay off is a short dip or bump
    private static void trainSwitch() {

        if (!training || audio == null) {
            return;
        }

        trainUpper = !trainUpper;
        MAIN.removeCallbacks(TRAIN_STEP);

        // The side playing, for the training's popup to show at once
        Hub.command("volTrainSide", trainUpper);
        Hub.command("fineGainFade", trainFadeArg(trainGain(trainUpper)));

        if (trainDelay > 0) {
            MAIN.postDelayed(TRAIN_STEP, trainDelay);
        } else {
            putTrainStep();
        }

    }

    // The phone's step for the side playing
    private static void putTrainStep() {

        if (!training || audio == null) {
            return;
        }

        try {

            audio.setStreamVolume(AudioManager.STREAM_MUSIC, trainUpper ? trainStep : trainStep - 1, 0);
            Hub.setVolume(audio.getStreamVolume(AudioManager.STREAM_MUSIC), audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC));
        } catch (RuntimeException e) {
            // Do not disturb can refuse the change, tried again next time
        }
    }

    // The training over: the level as asked for put back, with more steps
    // as they were, or the step from before it and the whole sound
    static void stopTrain() {

        MAIN.removeCallbacks(TRAIN_IDLE);
        MAIN.removeCallbacks(TRAIN_STEP);

        if (!training) {
            return;
        }

        training = false;
        Hub.note("Volume", "training off");

        if (audio == null) {
            return;
        }

        try {

            int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

            if (fineOn && max > 0) {

                // Put back from wherever the training left it
                fineStep = -1;
                applyFine();
                return;
            }

            if (trainBefore >= 0) {
                audio.setStreamVolume(AudioManager.STREAM_MUSIC, trainBefore, 0);
            }

            Hub.command("fineGain", 1.0);
            Hub.setVolume(audio.getStreamVolume(AudioManager.STREAM_MUSIC), max);
        } catch (RuntimeException e) {
            // Do not disturb can refuse the change, so leave it as it was
        }
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

    // Whether the phone's volume buttons move more steps by 1%: set, and
    // more steps on
    static boolean buttonsOn() {
        return buttons && fineOn && audio != null;
    }

    static void setButtons(boolean on) {

        buttons = on;

        if (appContext != null) {
            appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("buttons", on).apply();
        }

        Hub.setVolButtons(on);
        Hub.note("Volume", on ? "the volume buttons move more steps by 1%" : "the volume buttons move the phone's own steps");
        PlayerService.volumeKeys();
    }

    // More steps' level now in percent, -1 while off
    static float finePct() {
        return fineOn ? finePct : -1;
    }

    // A press of a volume button: more steps 1% up or down from the whole
    // percent nearest. Shown in the app's volume popup when the press came
    // with the app on screen
    static void nudge(int dir, boolean shown) {

        if (!fineOn || audio == null) {
            return;
        }

        float pct = Math.max(0, Math.min(100, Math.round(finePct) + dir));

        if (pct != finePct) {
            setFine(true, pct);
        }

        if (shown) {
            Hub.volKey();
        }
    }

    // More steps as they are, for the stats: on, the level, the step and
    // its dB, the player's share in dB and the step size set by hand
    static String fineInfo() {

        try {

            JSONObject o = new JSONObject();
            int max = audio == null ? 0 : audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);

            o.put("on", fineOn);
            o.put("buttons", buttons);
            o.put("max", max);

            // The output in use, a Bluetooth speaker by its address, for
            // the volume to try under that speaker in the sound profiles
            if (audio != null) {
                o.put("output", outputKey());
            }

            if (fineOn) {

                o.put("pct", Math.round(finePct * 10) / 10.0);
                o.put("step", fineStep);
                o.put("gain", Math.round(fineGain * 1000) / 1000.0);
                o.put("gainDb", fineGain > 0 ? Math.round(200 * Math.log10(fineGain)) / 10.0 : -200);

                if (!Float.isNaN(fineStepDb) && !Float.isInfinite(fineStepDb)) {
                    o.put("stepDb", Math.round(fineStepDb * 10) / 10.0);
                }

                o.put("handDb", handDb > 0 ? handDb : 0);
            }

            o.put("trained", gaps != null && !gaps.isEmpty());
            o.put("delay", stepDelay);
            o.put("lowDb", lowDb);

            if (training) {

                JSONObject t = new JSONObject();

                t.put("step", trainStep);
                t.put("upper", trainUpper);
                t.put("gap", trainGap);
                t.put("quiet", trainQuiet);
                o.put("train", t);
            }

            return o.toString();
        } catch (JSONException | RuntimeException e) {
            return "{}";
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

            // A whole step asked for, more steps follow it at the player's
            // whole sound
            if (fineOn && max > 0) {

                finePct = stepPct(want, max);
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
                float lowest = stepPct(1, max);
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

        AudioDeviceInfo d = bestOutput();

        return d == null ? AudioDeviceInfo.TYPE_BUILTIN_SPEAKER : d.getType();
    }

    // The output, a Bluetooth speaker by its address, else its kind, to
    // look up its step size
    private static String outputKey() {

        AudioDeviceInfo d = bestOutput();

        if (d == null) {
            return "here";
        }

        int t = d.getType();
        String address = d.getAddress();

        if ((t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_BLE_HEADSET
            || t == AudioDeviceInfo.TYPE_BLE_SPEAKER) && address != null && !address.isEmpty()) {
            return "bt:" + address.toUpperCase(Locale.ROOT);
        }

        return "here:" + t;
    }

    // The output the music most likely plays on, none for the speaker
    private static AudioDeviceInfo bestOutput() {

        AudioDeviceInfo found = null;
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
                found = d;
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

    // The level of a step in dB: even steps of the size set by hand, else
    // the curve
    private static float stepDb(int index, int max, int type, boolean own) {

        // Trained: the gaps of the steps above it, added up from the top
        if (gaps != null && !gaps.isEmpty()) {

            float db = 0;

            for (int i = Math.max(1, index + 1); i <= max; i++) {
                db -= gapAt(i);
            }

            return db;
        }

        if (handDb > 0) {
            return -(max - index) * handDb;
        }

        return curveDb(index, max, type, own);
    }

    // The level of a step in dB, from the output's own curve or Android's
    // usual media curve
    private static float curveDb(int index, int max, int type, boolean own) {

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
