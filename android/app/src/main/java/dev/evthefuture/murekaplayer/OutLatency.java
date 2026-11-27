/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, the delay of the phone's way out, read for playing in step
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

import android.content.Context;
import android.media.AudioManager;
import android.os.SystemClock;

import java.lang.reflect.Method;

// How long the phone's music takes from the mixer to the ear, as Android
// tells it for the way out in use: the speaker, a wire or Bluetooth with the
// delay the headset or speaker reports. Android keeps this to itself, so it
// is read by name, and 0 where that is not allowed or not there. Read at
// most once a second, as the player asks with every state
final class OutLatency {

    private static Method method;
    private static boolean looked = false;
    private static long readAt = 0;
    private static int lastMs = 0;

    private OutLatency() {
    }

    static synchronized int ms(Context c) {

        long now = SystemClock.elapsedRealtime();

        if (c == null || now - readAt < 1000) {
            return lastMs;
        }

        readAt = now;

        if (!looked) {

            looked = true;

            try {
                method = AudioManager.class.getMethod("getOutputLatency", int.class);
            } catch (NoSuchMethodException | SecurityException e) {
                method = null;
            }
        }

        if (method == null) {
            return 0;
        }

        try {

            AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
            Object r = am == null ? null : method.invoke(am, AudioManager.STREAM_MUSIC);

            // Nothing sensible over five seconds
            lastMs = r instanceof Integer ? Math.max(0, Math.min(5000, (Integer) r)) : 0;
        } catch (ReflectiveOperationException | RuntimeException e) {
            lastMs = 0;
        }

        return lastMs;
    }
}
