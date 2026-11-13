/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, which addresses are Mureka's own
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

import java.net.MalformedURLException;
import java.net.URL;
import java.util.Locale;

// Whether a host or an address is Mureka's own. The app only loads its
// page, hands its songs and covers on and gives its bridge to it, so the
// rule is kept in this one place
final class Mureka {

    private Mureka() {
    }

    // mureka.ai itself or any name under it, in any case
    static boolean isHost(String host) {

        if (host == null) {
            return false;
        }

        String h = host.toLowerCase(Locale.ROOT);

        return h.equals("mureka.ai") || h.endsWith(".mureka.ai");
    }

    // An https address on one of Mureka's hosts
    static boolean isUrl(String url) {

        if (url == null) {
            return false;
        }

        try {

            URL parsed = new URL(url);

            return "https".equals(parsed.getProtocol()) && isHost(parsed.getHost());
        } catch (MalformedURLException e) {
            return false;
        }
    }
}
