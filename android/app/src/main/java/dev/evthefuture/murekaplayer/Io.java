/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, copying and reading streams
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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

// Streams copied and read whole, and a pause, the same way everywhere
final class Io {

    private static final int BUFFER = 32768;

    private Io() {
    }

    // Everything from one stream into the other. With a limit of 0 or more,
    // more than that many bytes stops it with an IOException. Answers how
    // many bytes went
    static long copy(InputStream in, OutputStream out, long max) throws IOException {

        byte[] buf = new byte[BUFFER];
        long total = 0;
        int n;

        while ((n = in.read(buf)) != -1) {

            total += n;

            if (max >= 0 && total > max) {
                throw new IOException("more than " + max + " bytes");
            }

            out.write(buf, 0, n);
        }

        return total;
    }

    // The whole stream, or null once it grows past the limit
    static byte[] readAll(InputStream in, int max) throws IOException {

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[BUFFER];
        int n;

        while ((n = in.read(buf)) != -1) {

            if (out.size() + n > max) {
                return null;
            }

            out.write(buf, 0, n);
        }

        return out.toByteArray();
    }

    // A pause that keeps an interrupt for the caller to see
    static void sleep(long ms) {

        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
