/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the web view settings and what counts as a valid value
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
import android.content.SharedPreferences;

// The app's own settings for the web view, stored apart from the player's.
// The player's settings panel reads and writes them through the bridge, and
// every value is checked here, so a typo can never break the web view
final class CarSettings {

    static final String PREFS = "car";

    static final String ALLOW_HOTSPOT = "allowHotspot";
    static final String ALLOW_WIFI = "allowWifi";
    static final String VPN = "carVpn";
    static final String VPN_ADDRESS = "vpnAddress";
    static final String MDNS_NAME = "mdnsName";
    static final String FULLSCREEN = "appFullscreen";

    // What happens when the charger is pulled out and plugged in again, a
    // phone left somewhere warm stays cooler with less running
    static final String CHARGE_SAVE = "chargeSave";
    static final String CHARGE_GRACE = "chargeGrace";
    static final String UNPLUG_PAUSE = "unplugPause";
    static final String UNPLUG_HOTSPOT = "unplugHotspot";
    static final String UNPLUG_QUIET = "unplugQuiet";
    static final String PLUG_HOTSPOT = "plugHotspot";

    // When the hotspot is to go off and browsers of the web view are on it:
    // off anyway, or once they have all gone
    static final String HOTSPOT_OFF_MODE = "hotspotOffMode";
    static final String HOTSPOT_OFF_FORCE = "force";
    static final String HOTSPOT_OFF_WAIT = "wait";

    // What starts the power saving: the charger pulled out, or the chosen
    // Bluetooth devices all gone, stored as their addresses with commas
    static final String SAVE_TRIGGER = "saveTrigger";
    static final String SAVE_BT = "saveBtDevices";
    static final String TRIGGER_CHARGER = "charger";
    static final String TRIGGER_BLUETOOTH = "bluetooth";

    // Up to 32 Bluetooth addresses, upper case, separated by commas
    private static final String BT_LIST = "([0-9A-F]{2}(:[0-9A-F]{2}){5})(,[0-9A-F]{2}(:[0-9A-F]{2}){5}){0,31}";

    // Settings no longer used. The hotspot helper uses the phone's own
    // hotspot name and password, so the ones typed for Shizuku are removed
    private static final String[] RETIRED = {"hotspotSsid", "hotspotPass", "hotspotBand"};

    // Tesla's browser refuses private addresses, 3.3.3.3 is the one the
    // Android Auto in the browser apps have used for years
    static final String DEFAULT_ADDRESS = "3.3.3.3";
    static final String DEFAULT_NAME = "murekaplayer";

    private CarSettings() {
    }

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // Whether the app hides Android's bars while it is on screen
    static boolean fullscreen(Context c) {
        return !"0".equals(prefs(c).getString(FULLSCREEN, "1"));
    }

    static boolean vpnEnabled(Context c) {
        return "1".equals(prefs(c).getString(VPN, "0"));
    }

    static String vpnAddress(Context c) {

        String clean = cleanAddress(prefs(c).getString(VPN_ADDRESS, ""));

        return clean.isEmpty() ? DEFAULT_ADDRESS : clean;
    }

    // The name other devices find the phone by, always ending in .local
    static String mdnsName(Context c) {

        String clean = cleanName(prefs(c).getString(MDNS_NAME, ""));

        return (clean.isEmpty() ? DEFAULT_NAME : clean) + ".local";
    }

    static boolean on(Context c, String key) {
        return "1".equals(prefs(c).getString(key, "0"));
    }

    // Settings left from earlier versions removed, the hotspot password
    // first of all, so it is not kept on the phone for nothing
    static void dropRetired(Context c) {

        SharedPreferences p = prefs(c);
        SharedPreferences.Editor edit = null;

        for (String key : RETIRED) {

            if (p.contains(key)) {

                edit = edit == null ? p.edit() : edit;
                edit.remove(key);
            }
        }

        if (edit != null) {
            edit.apply();
        }
    }

    // What starts the power saving, the charger unless changed
    // Whether turning the hotspot off waits for the browsers on it
    static boolean hotspotWaits(Context c) {
        return HOTSPOT_OFF_WAIT.equals(prefs(c).getString(HOTSPOT_OFF_MODE, HOTSPOT_OFF_FORCE));
    }

    static String trigger(Context c) {

        return TRIGGER_BLUETOOTH.equals(prefs(c).getString(SAVE_TRIGGER, TRIGGER_CHARGER))
            ? TRIGGER_BLUETOOTH : TRIGGER_CHARGER;
    }

    // The addresses of the Bluetooth devices chosen for the power saving
    static java.util.Set<String> btDevices(Context c) {

        java.util.Set<String> out = new java.util.HashSet<>();
        String v = prefs(c).getString(SAVE_BT, "");

        for (String a : v.split(",")) {

            if (!a.trim().isEmpty()) {
                out.add(a.trim().toUpperCase(java.util.Locale.ROOT));
            }
        }

        return out;
    }

    // Seconds to wait after the charger is pulled out, 60 unless changed
    static int chargeGrace(Context c) {

        try {
            return Math.max(0, Math.min(3600, Integer.parseInt(prefs(c).getString(CHARGE_GRACE, "60"))));
        } catch (NumberFormatException e) {
            return 60;
        }
    }

    // Store a value from the settings panel. A value that does not pass is
    // not stored, so the last good one stays, and false tells the caller
    static boolean store(Context c, String key, String value) {

        String v = value == null ? "" : value.trim();

        // The chosen devices may be none at all, the only value that can
        // be empty
        if (SAVE_BT.equals(key)) {

            v = v.toUpperCase(java.util.Locale.ROOT).replace(" ", "");

            if (!v.isEmpty() && !v.matches(BT_LIST)) {
                return false;
            }

            prefs(c).edit().putString(key, v).apply();

            return true;
        }

        if (VPN_ADDRESS.equals(key)) {

            v = v.isEmpty() ? DEFAULT_ADDRESS : cleanAddress(v);
        } else if (MDNS_NAME.equals(key)) {

            v = v.isEmpty() ? DEFAULT_NAME : cleanName(v);
        } else if (VPN.equals(key) || ALLOW_HOTSPOT.equals(key) || ALLOW_WIFI.equals(key)
            || FULLSCREEN.equals(key) || CHARGE_SAVE.equals(key) || UNPLUG_PAUSE.equals(key) || UNPLUG_HOTSPOT.equals(key)
            || UNPLUG_QUIET.equals(key) || PLUG_HOTSPOT.equals(key)) {

            v = "1".equals(v) ? "1" : "0";
        } else if (SAVE_TRIGGER.equals(key)) {

            v = TRIGGER_BLUETOOTH.equals(v) ? TRIGGER_BLUETOOTH : TRIGGER_CHARGER;
        } else if (HOTSPOT_OFF_MODE.equals(key)) {

            v = HOTSPOT_OFF_WAIT.equals(v) ? HOTSPOT_OFF_WAIT : HOTSPOT_OFF_FORCE;
        } else if (CHARGE_GRACE.equals(key)) {

            if (!v.matches("[0-9]{1,4}") || Integer.parseInt(v) > 3600) {
                return false;
            }
        } else {
            return false;
        }

        if (v.isEmpty()) {
            return false;
        }

        prefs(c).edit().putString(key, v).apply();

        return true;
    }

    // A plain IPv4 address a browser will open and the phone may take as its
    // own. Private, loopback, link local, carrier grade NAT and multicast
    // ranges are refused, an empty string means not usable
    static String cleanAddress(String text) {

        String[] parts = text == null ? new String[0] : text.trim().split("\\.", -1);

        if (parts.length != 4) {
            return "";
        }

        int[] o = new int[4];

        for (int i = 0; i < 4; i++) {

            if (!parts[i].matches("[0-9]{1,3}")) {
                return "";
            }

            o[i] = Integer.parseInt(parts[i]);

            if (o[i] > 255) {
                return "";
            }
        }

        boolean refused = o[0] == 0
            || o[0] == 10
            || o[0] == 127
            || (o[0] == 100 && o[1] >= 64 && o[1] <= 127)
            || (o[0] == 169 && o[1] == 254)
            || (o[0] == 172 && o[1] >= 16 && o[1] <= 31)
            || (o[0] == 192 && o[1] == 168)
            || (o[0] >= 224 && o[0] <= 239)
            || o[0] == 255;

        if (refused) {
            return "";
        }

        return o[0] + "." + o[1] + "." + o[2] + "." + o[3];
    }

    // One DNS label: letters, digits and dashes, not starting or ending with
    // a dash. A typed .local at the end is taken off, it is added again later
    static String cleanName(String text) {

        String v = text == null ? "" : text.trim().toLowerCase(java.util.Locale.ROOT);

        if (v.endsWith(".")) {
            v = v.substring(0, v.length() - 1);
        }

        if (v.endsWith(".local")) {
            v = v.substring(0, v.length() - ".local".length());
        }

        if (!v.matches("[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?")) {
            return "";
        }

        return v;
    }
}
