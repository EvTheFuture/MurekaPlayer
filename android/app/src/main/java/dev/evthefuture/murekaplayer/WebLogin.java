/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, the optional password for the web view
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

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

// The web view's password. Only a salted hash of it is kept, in a file of
// its own that the player's page cannot read. A browser that signs in gets
// a long random key in a cookie, which keeps it signed in until the
// password changes or every browser is signed out
final class WebLogin {

    private static final String PREFS = "web_login";
    private static final String HASH = "hash";
    private static final String SALT = "salt";
    private static final String KEYS = "keys";

    // The cookie that carries a signed in browser's key
    static final String COOKIE = "mp_session";

    // At least this long, a few digits are guessed too easily
    static final int MIN_LENGTH = 4;

    // The browsers kept signed in, the oldest drops off past this
    private static final int MAX_KEYS = 20;

    private static final int ROUNDS = 20000;
    private static final SecureRandom RANDOM = new SecureRandom();

    // Wrong passwords in a row from each device and when its next try is let
    // through. Each wrong one past the first few doubles the wait, up to ten
    // minutes. Counted per device, so one guessing cannot lock out another
    private static final Map<String, long[]> TRIES = new HashMap<>();
    private static final int MAX_DEVICES = 256;

    private WebLogin() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // Whether a password is set
    static boolean on(Context c) {
        return !prefs(c).getString(HASH, "").isEmpty();
    }

    // A new password. Every browser signed in before has to sign in again
    static boolean setPassword(Context c, String password) {

        if (password == null || password.length() < MIN_LENGTH) {
            return false;
        }

        byte[] salt = new byte[16];

        RANDOM.nextBytes(salt);

        String hash = hash(password, salt);

        if (hash == null) {
            return false;
        }

        prefs(c).edit().putString(SALT, hex(salt)).putString(HASH, hash).putString(KEYS, "").commit();
        Hub.note("Web view", "a password was set, every browser signs in again");

        return true;
    }

    // No password any more, the web view is open again
    static void clear(Context c) {

        prefs(c).edit().clear().apply();
        Hub.note("Web view", "the password was removed");
    }

    // Every browser signed out, the password stays
    static void signOutAll(Context c) {

        prefs(c).edit().putString(KEYS, "").apply();
        Hub.note("Web view", "every browser was signed out");
    }

    // Seconds a device waits before its next try, 0 when it may try now
    static synchronized long waitSeconds(String who) {

        long[] t = TRIES.get(who);
        long left = t == null ? 0 : t[1] - System.currentTimeMillis();

        return left > 0 ? (left + 999) / 1000 : 0;
    }

    // A new key for a browser when the password is right, else null. A try
    // made while the device waits is not checked at all
    static synchronized String signIn(Context c, String password, String who) {

        if (!check(c, password, who)) {
            return null;
        }

        String key = newKey(c);

        Hub.note("Web view", "a browser signed in");

        return key;
    }

    // Whether the password is the one set, counting a wrong one against the
    // device that sent it
    static synchronized boolean check(Context c, String password, String who) {

        if (waitSeconds(who) > 0 || password == null) {
            return false;
        }

        SharedPreferences p = prefs(c);
        String salt = p.getString(SALT, "");
        String want = p.getString(HASH, "");
        String got = salt.isEmpty() ? null : hash(password, unhex(salt));

        if (got != null && !want.isEmpty()
            && MessageDigest.isEqual(got.getBytes(StandardCharsets.US_ASCII), want.getBytes(StandardCharsets.US_ASCII))) {

            TRIES.remove(who);
            return true;
        }

        // Many devices at once, the oldest counts are let go
        if (TRIES.size() >= MAX_DEVICES && !TRIES.containsKey(who)) {
            TRIES.clear();
        }

        long[] t = TRIES.get(who);

        if (t == null) {

            t = new long[2];
            TRIES.put(who, t);
        }

        t[0] += 1;

        if (t[0] >= 3) {
            t[1] = System.currentTimeMillis() + Math.min(600000L, 5000L << Math.min(t[0] - 3, 7));
        }

        Hub.note("Web view", "a wrong password from " + who + ", " + t[0] + " in a row");

        return false;
    }

    // A new key kept as signed in, for a browser that has just shown it
    // knows the password
    static synchronized String newKey(Context c) {

        SharedPreferences p = prefs(c);
        byte[] raw = new byte[32];

        RANDOM.nextBytes(raw);

        String key = hex(raw);
        List<String> keys = keys(p);

        keys.add(key);

        while (keys.size() > MAX_KEYS) {
            keys.remove(0);
        }

        p.edit().putString(KEYS, String.join(",", keys)).apply();

        return key;
    }

    // Whether a browser's key is one handed out and still valid
    static boolean valid(Context c, String key) {

        if (key == null || !key.matches("[0-9a-f]{64}")) {
            return false;
        }

        for (String k : keys(prefs(c))) {

            if (MessageDigest.isEqual(k.getBytes(StandardCharsets.US_ASCII),
                key.getBytes(StandardCharsets.US_ASCII))) {
                return true;
            }
        }

        return false;
    }

    // One browser signed out
    static void signOut(Context c, String key) {

        SharedPreferences p = prefs(c);
        List<String> keys = keys(p);

        if (keys.remove(key)) {
            p.edit().putString(KEYS, String.join(",", keys)).apply();
        }
    }

    // The key in a Cookie header, null without one
    static String fromCookie(String header) {
        return cookieValue(header, COOKIE);
    }

    // One cookie's value in a Cookie header, null without it
    static String cookieValue(String header, String name) {

        if (header == null) {
            return null;
        }

        for (String part : header.split(";")) {

            String t = part.trim();

            if (t.startsWith(name + "=")) {
                return t.substring(name.length() + 1).trim();
            }
        }

        return null;
    }

    private static List<String> keys(SharedPreferences p) {

        String all = p.getString(KEYS, "");

        return all.isEmpty() ? new ArrayList<>() : new ArrayList<>(Arrays.asList(all.split(",")));
    }

    private static String hash(String password, byte[] salt) {

        try {

            KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ROUNDS, 256);
            SecretKeyFactory f = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");

            return hex(f.generateSecret(spec).getEncoded());
        } catch (Exception e) {
            return null;
        }
    }

    private static String hex(byte[] b) {

        StringBuilder sb = new StringBuilder();

        for (byte x : b) {
            sb.append(String.format(Locale.ROOT, "%02x", x & 0xff));
        }

        return sb.toString();
    }

    private static byte[] unhex(String s) {

        byte[] out = new byte[s.length() / 2];

        for (int i = 0; i < out.length; i++) {
            out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        }

        return out;
    }
}
