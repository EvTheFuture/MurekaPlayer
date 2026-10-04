/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the covers kept on the phone for the web view
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
import android.util.Base64;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// The covers the web view shows, kept in the app's cache folder. The web
// view asks the phone for a cover by its Mureka address, the phone answers
// from here, and fetches it from Mureka first when it does not have it yet.
// The covers of the songs coming up are fetched ahead, whether or not a
// browser is open. The least recently used go once the folder is over its
// size. Nothing here touches what Bluetooth or the lock screen get
final class CoverCache {

    // No cover is larger than this, anything bigger is not taken
    private static final int MAX_FILE = 8 * 1024 * 1024;

    // At most this many downloads from Mureka at once, a page of thumbnails
    // asked for together does not become a burst of requests
    private static final Semaphore NET = new Semaphore(3);

    // One download per cover, a second ask for the same one waits for it
    private static final ConcurrentHashMap<String, Object> LOCKS = new ConcurrentHashMap<>();

    // The covers fetched ahead, one after the other in the background
    private static final ExecutorService AHEAD = Executors.newSingleThreadExecutor();

    // Clearing runs on its own, the status says how far it has come
    private static final ExecutorService CLEAR = Executors.newSingleThreadExecutor();

    private static File dir;
    private static volatile long capBytes = 200L * 1024 * 1024;
    private static volatile String aheadKey = "";
    private static volatile boolean clearing = false;
    private static volatile int clearDone = 0;
    private static volatile int clearTotal = 0;
    private static volatile long trimmedAt = 0;

    // Nothing fetched ahead while the background work is stopped
    private static volatile boolean paused = false;

    private CoverCache() {
    }

    // The folder, made the first time. Safe to call more than once
    static synchronized void init(Context context) {

        if (dir != null || context == null) {
            return;
        }

        dir = new File(context.getApplicationContext().getCacheDir(), "covers");

        if (!dir.isDirectory() && !dir.mkdirs()) {
            Hub.note("Covers", "could not make the cover folder");
        }

        // What the player has for the covers ahead and the size, with
        // every state it publishes
        Hub.addListener(CoverCache::onState);
    }

    // Only Mureka's own pictures over https, never an address of the
    // browser's choosing
    static boolean allowed(String url) {

        try {

            URL parsed = new URL(url);
            String host = parsed.getHost() == null ? "" : parsed.getHost().toLowerCase(Locale.ROOT);

            return "https".equals(parsed.getProtocol()) && (host.equals("mureka.ai") || host.endsWith(".mureka.ai"));
        } catch (MalformedURLException e) {
            return false;
        }
    }

    // The stored cover, fetched from Mureka first when it is not here yet.
    // Null when it could not be had
    static File get(String url) {

        if (dir == null || !allowed(url)) {
            return null;
        }

        File file = new File(dir, name(url));

        if (file.isFile() && file.length() > 0) {

            // Used now, so it is among the last to go
            if (!file.setLastModified(System.currentTimeMillis())) {
                Hub.note("Covers", "could not mark a cover as used");
            }

            return file;
        }

        Object lock = LOCKS.computeIfAbsent(url, k -> new Object());

        synchronized (lock) {

            try {

                // Fetched by someone else while this one waited
                if (file.isFile() && file.length() > 0) {
                    return file;
                }

                // Without internet Mureka is not tried, the player's copy
                // is taken straight away
                if (PlayerWeb.hasNetwork() && download(url, file)) {
                    return file;
                }

                return fromPlayer(url, file) ? file : null;
            } finally {
                LOCKS.remove(url);
            }
        }
    }

    // What kind of picture a stored cover is, from its first bytes
    static String type(File file) {

        byte[] head = new byte[12];

        try (InputStream in = new java.io.FileInputStream(file)) {

            int n = in.read(head);

            if (n >= 3 && (head[0] & 0xff) == 0xff && (head[1] & 0xff) == 0xd8) {
                return "image/jpeg";
            }

            if (n >= 4 && (head[0] & 0xff) == 0x89 && head[1] == 'P' && head[2] == 'N' && head[3] == 'G') {
                return "image/png";
            }

            if (n >= 12 && head[0] == 'R' && head[1] == 'I' && head[2] == 'F' && head[3] == 'F'
                && head[8] == 'W' && head[9] == 'E' && head[10] == 'B' && head[11] == 'P') {
                return "image/webp";
            }

            if (n >= 4 && head[0] == 'G' && head[1] == 'I' && head[2] == 'F') {
                return "image/gif";
            }
        } catch (IOException e) {
            return "image/jpeg";
        }

        return "image/jpeg";
    }

    // How many covers there are, how much room they take, the size allowed,
    // and how far a clearing has come
    static String info() {

        JSONObject o = new JSONObject();
        int count = 0;
        long bytes = 0;

        File[] files = dir != null ? dir.listFiles() : null;

        if (files != null) {

            for (File f : files) {

                if (f.isFile() && !f.getName().endsWith(".part")) {

                    count += 1;
                    bytes += f.length();
                }
            }
        }

        try {

            o.put("count", count);
            o.put("bytes", bytes);
            o.put("capMb", capBytes / (1024 * 1024));
            o.put("clearing", clearing);
            o.put("done", clearDone);
            o.put("total", clearTotal);
        } catch (JSONException e) {
            return "{}";
        }

        return o.toString();
    }

    // Every stored cover removed, one after the other, the status counting
    static void clear() {

        if (dir == null || clearing) {
            return;
        }

        File[] files = dir.listFiles();

        clearing = true;
        clearDone = 0;
        clearTotal = files == null ? 0 : files.length;

        CLEAR.execute(() -> {

            int failed = 0;

            if (files != null) {

                for (File f : files) {

                    if (!f.delete() && f.exists()) {
                        failed += 1;
                    }

                    clearDone += 1;
                }
            }

            Hub.note("Covers", "cache cleared, " + clearTotal + " files" + (failed > 0 ? ", " + failed + " could not be removed" : ""));
            clearing = false;
        });
    }

    static void setPaused(boolean on) {

        paused = on;

        // Asked again in full once it may fetch again
        if (!on) {
            aheadKey = "";
        }
    }

    // From each state: the size allowed and the covers of the songs coming
    // up, the ones not here yet fetched in the background
    private static void onState(JSONObject state) {

        if (state == null || paused) {
            return;
        }

        int mb = state.optInt("coverCacheMB", 0);

        if (mb >= 10 && mb <= 10000) {
            capBytes = mb * 1024L * 1024L;
        }

        JSONArray ahead = state.optJSONArray("coverAhead");

        if (ahead == null) {
            return;
        }

        String key = ahead.toString();

        // The same covers as last time, nothing new to fetch
        if (key.equals(aheadKey)) {
            return;
        }

        aheadKey = key;

        List<String> urls = new ArrayList<>();

        for (int i = 0; i < ahead.length(); i++) {

            String url = ahead.optString(i, "");

            if (!url.isEmpty() && allowed(url)) {
                urls.add(url);
            }
        }

        AHEAD.execute(() -> {

            for (String url : urls) {

                // A newer list has come, this one is out of date
                if (!key.equals(aheadKey)) {
                    return;
                }

                get(url);
            }
        });
    }

    // One cover from Mureka into the folder, written to a side file first
    // so a half written cover is never served
    private static boolean download(String url, File file) {

        File part = new File(dir, file.getName() + ".part");
        HttpURLConnection c = null;
        boolean got = false;

        // Waiting for a turn has its limit too, a browser waiting on this
        // answer gives up after a while anyway
        try {

            if (!NET.tryAcquire(20, java.util.concurrent.TimeUnit.SECONDS)) {

                Hub.note("Covers", "no turn to fetch a cover, the others are slow");
                return false;
            }
        } catch (InterruptedException e) {

            Thread.currentThread().interrupt();
            return false;
        }

        try {

            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(20000);
            c.setInstanceFollowRedirects(true);

            if (c.getResponseCode() != 200) {

                Hub.note("Covers", "Mureka answered " + c.getResponseCode() + " for a cover");
                return false;
            }

            long total = 0;

            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(part)) {

                byte[] buf = new byte[32768];
                int n;

                while ((n = in.read(buf)) != -1) {

                    total += n;

                    if (total > MAX_FILE) {
                        throw new IOException("cover too large");
                    }

                    out.write(buf, 0, n);
                }
            }

            got = total > 0 && part.renameTo(file);
        } catch (IOException e) {
            Hub.note("Covers", "could not fetch a cover, " + e.getClass().getSimpleName());
        } finally {

            if (c != null) {
                c.disconnect();
            }

            NET.release();

            if (!got && part.exists() && !part.delete()) {
                Hub.note("Covers", "could not remove a half fetched cover");
            }
        }

        if (got) {
            trimSoon();
        }

        return got;
    }

    // The cover the player keeps with a song stored on the phone, for when
    // Mureka cannot give it, offline for one. Kept here too after that
    private static boolean fromPlayer(String url, File file) {

        String data = Hub.requestLater("__murekaHostKeptCover", JSONObject.quote(url), 5000);
        int comma = data.indexOf(',');

        if (!data.startsWith("data:image/") || comma < 0) {
            return false;
        }

        byte[] picture;

        try {
            picture = Base64.decode(data.substring(comma + 1), Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            return false;
        }

        if (picture.length == 0 || picture.length > MAX_FILE) {
            return false;
        }

        File part = new File(dir, file.getName() + ".part");
        boolean got = false;

        try (OutputStream out = new FileOutputStream(part)) {

            out.write(picture);
            out.close();
            got = part.renameTo(file);
        } catch (IOException e) {
            Hub.note("Covers", "could not keep the player's cover, " + e.getClass().getSimpleName());
        } finally {

            if (!got && part.exists() && !part.delete()) {
                Hub.note("Covers", "could not remove a half written cover");
            }
        }

        if (got) {
            trimSoon();
        }

        return got;
    }

    // Over the size allowed, the covers used longest ago go until it is
    // back under nine tenths of it. Looked at at most every ten seconds
    private static void trimSoon() {

        long now = System.currentTimeMillis();

        if (now - trimmedAt < 10000 || dir == null) {
            return;
        }

        trimmedAt = now;

        File[] files = dir.listFiles();

        if (files == null) {
            return;
        }

        long bytes = 0;

        for (File f : files) {
            bytes += f.length();
        }

        if (bytes <= capBytes) {
            return;
        }

        Arrays.sort(files, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));

        long goal = capBytes * 9 / 10;
        int removed = 0;

        for (File f : files) {

            if (bytes <= goal) {
                break;
            }

            long size = f.length();

            if (f.delete()) {

                bytes -= size;
                removed += 1;
            }
        }

        Hub.note("Covers", "over the size allowed, " + removed + " covers used longest ago removed");
    }

    // A cover's file name, from its address
    private static String name(String url) {

        try {

            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] hash = md.digest(url.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();

            for (byte b : hash) {
                sb.append(String.format(Locale.ROOT, "%02x", b & 0xff));
            }

            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            return Integer.toHexString(url.hashCode()) + "-" + url.length();
        }
    }
}
