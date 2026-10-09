/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the small web server the browser showing the web view connects to
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
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.RouteInfo;
import android.os.Build;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.MalformedURLException;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.SynchronousQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// Serves the web view and a tiny JSON API on the local network, the phone's
// hotspot in the web view. GET / is the page, GET /state the now playing state,
// POST /cmd with {"cmd": "...", "arg": ...} runs a command in the player
final class WebViewServer {

    // With the sound in the browser, the phone plays muted. If the web view
    // stops asking for the state for this long, it is gone, and the phone
    // takes the sound back so the music does not go silent. Eight seconds
    // was too short: a car's browser fetching the next song over a slow
    // hotspot could miss that long and lose the music for no good reason
    private static final long CAR_GONE_MS = 25000;

    // A browser that has not asked for the state for this long has gone
    private static final long CLIENT_GONE_MS = 20000;

    // Requests larger than this are refused, the API only needs a few bytes
    private static final int MAX_BODY = 16384;

    // A cover picture from a web view, sent as it is, the largest the
    // storage can still work on
    private static final int MAX_COVER = 20 * 1024 * 1024;

    // Requests served at once. A browser holds two or three, the state it
    // waits for and a song or a cover, so this is plenty for several of
    // them. Anything over it is closed at once rather than queued
    private static final int MAX_REQUESTS = 32;

    // The most header lines one request may send, and how long it may take
    // to send them. A browser sends a dozen in an instant
    private static final int MAX_HEADERS = 100;
    private static final long HEAD_MS = 15000;

    // How long an upload may take as a whole, a cover over a slow hotspot
    private static final long BODY_MS = 60000;

    // The sortings of the song list the player knows, anything else is
    // Mureka's own order
    private static final String[] LIST_VIEWS = {
        "alpha", "alphaDesc", "playsDown", "playsUp", "stars", "starsDown", "starsUp"
    };

    private final Context context;
    private final int port;
    private final ExecutorService pool = new ThreadPoolExecutor(2, MAX_REQUESTS, 30, TimeUnit.SECONDS,
        new SynchronousQueue<>(), new ThreadPoolExecutor.AbortPolicy());
    private final ScheduledExecutorService watch = Executors.newSingleThreadScheduledExecutor();

    private volatile ServerSocket socket;

    // The last time a web view asked for the state. It starts a little in
    // the future, so after the app starts, an update in particular, a
    // browser playing the music has time to find the phone again before
    // the phone takes the sound back
    private static final long START_GRACE_MS = 20000;
    private volatile long lastPoll = System.currentTimeMillis() + START_GRACE_MS;

    // The app's own screen on a tablet shows the web view too. It asks over
    // the device itself and names itself in its user agent. It is not a
    // browser that comes and goes, so it never counts as one: not for the
    // music coming back, not for the browsers here, not for power saving
    static final String APP_AGENT = "MurekaPlayerApp/";

    // The app's own screen proves itself with this cookie, a new random one
    // each time the app starts, set by the app in its own WebView. Another
    // app on the phone can send the app's name, but not this
    static final String APP_COOKIE = "mp_app";
    static final String APP_SECRET = newSecret();

    private static String newSecret() {

        byte[] raw = new byte[32];
        StringBuilder sb = new StringBuilder();

        new SecureRandom().nextBytes(raw);

        for (byte b : raw) {
            sb.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        }

        return sb.toString();
    }

    // Whether a Cookie header carries the app's secret
    static boolean appCookie(String header) {

        String v = WebLogin.cookieValue(header, APP_COOKIE);

        return v != null && MessageDigest.isEqual(v.getBytes(StandardCharsets.US_ASCII),
            APP_SECRET.getBytes(StandardCharsets.US_ASCII));
    }
    private static final ThreadLocal<Boolean> APP_REQUEST = new ThreadLocal<>();

    // Every browser that asked for the state lately, by the id it sends with
    // the request. Two browsers on one page each count once
    private final java.util.Map<String, Long> clients = new java.util.concurrent.ConcurrentHashMap<>();

    // Those of them that came over the phone's hotspot, and how many of them
    // are here now, for the power saving that may wait for them to go
    private final java.util.Set<String> hotspotIds = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private static volatile int hotspotBrowsers = 0;
    private volatile boolean running = false;

    // What the server is doing, shown in the notification so a server that
    // cannot start says so instead of leaving the car with nothing
    private volatile String status = "starting";

    private byte[] page;

    // Which interfaces are the phone's own Wi-Fi connection and which the
    // mobile network, looked up now and then rather than for every request
    private Set<String> wifiInterfaces = new HashSet<>();
    private Set<String> cellInterfaces = new HashSet<>();
    private long interfacesAt = 0;

    static final String PREFS = WebViewSettings.PREFS;

    WebViewServer(Context context, int port) {

        this.context = context.getApplicationContext();
        this.port = port;
        CoverCache.init(this.context);
    }

    boolean listening() {
        return "listening".equals(status);
    }

    String status() {
        return status;
    }

    void start() {

        page = readAsset("webview.html");
        running = true;

        Thread accept = new Thread(this::acceptLoop, "car-server");

        accept.setDaemon(true);
        accept.start();

        watch.scheduleWithFixedDelay(this::checkCar, 2, 2, TimeUnit.SECONDS);
    }

    void stop() {

        running = false;
        status = "stopped";
        watch.shutdownNow();

        try {

            ServerSocket s = socket;

            if (s != null) {
                s.close();
            }
        } catch (IOException e) {
            // Closing anyway
        }

        pool.shutdownNow();
    }

    // Keep a listening socket alive. A port still held by the previous
    // install, or a network that is not up yet, must not leave the car with
    // nothing forever, so this tries again rather than giving up
    private void acceptLoop() {

        while (running) {

            try (ServerSocket s = new ServerSocket()) {

                s.setReuseAddress(true);
                s.bind(new InetSocketAddress(port));
                socket = s;
                status = "listening";

                while (running && !s.isClosed()) {

                    final Socket client = s.accept();

                    try {
                        pool.execute(() -> handle(client));
                    } catch (RejectedExecutionException e) {

                        // Too many at once, this one is turned away
                        closeQuietly(client);
                    }
                }
            } catch (IOException e) {

                if (!running) {
                    break;
                }

                status = "port " + port + " busy, trying again";
            } finally {
                socket = null;
            }

            if (running) {
                sleep(5000);
            }
        }

        if (!running) {
            status = "stopped";
        }
    }

    private static void closeQuietly(Socket s) {

        try {
            s.close();
        } catch (IOException e) {
            // Gone already
        }
    }

    private static void sleep(long ms) {

        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void checkCar() {

        JSONObject s = Hub.state();

        long quiet = System.currentTimeMillis() - lastPoll;

        // Said in the debug log and to the player, so the music moving back
        // to the phone has a reason everyone can see
        if (s.optBoolean("carAudio", false) && quiet > CAR_GONE_MS) {

            Hub.note("Command", "no word from the web view's browser for " + (quiet / 1000) + " s, the music comes back to the phone");
            Hub.command("carGone", quiet / 1000);
        }

        countClients();
    }

    // A browser of the web view was heard from. The app's own screen does
    // not count, it is there while the app is on screen anyway
    private void markPoll() {

        if (!Boolean.TRUE.equals(APP_REQUEST.get())) {
            lastPoll = System.currentTimeMillis();
        }
    }

    // A browser asked for the state, so it is here. Its own id keeps two
    // pages on one machine apart
    private void noteClient(String id, boolean viaHotspot) {

        if (id == null || id.isEmpty() || id.length() > 64) {
            return;
        }

        clients.put(id, System.currentTimeMillis());

        if (viaHotspot) {
            hotspotIds.add(id);
        } else {
            hotspotIds.remove(id);
        }

        countClients();
    }

    // How many browsers of the web view are on the phone's hotspot now
    static int hotspotBrowsers() {
        return hotspotBrowsers;
    }

    // A sender on a network the phone hands out itself: not its Wi-Fi, not
    // the mobile network and not the phone itself. The car on the VPN comes
    // over the hotspot too
    private boolean onHotspot(InetAddress remote) {

        InetAddress r = plainV4(remote);

        if (r == null || r.isLoopbackAddress()) {
            return false;
        }

        NetworkInterface ni = interfaceFor(r);
        String name = ni != null && ni.getName() != null ? ni.getName() : "";

        return !name.isEmpty() && !wifiInterfaces.contains(name) && !isCell(name);
    }

    // How many browsers are here now, into the state so each of them can
    // tell whether it is alone
    private void countClients() {

        long now = System.currentTimeMillis();
        int here = 0;

        boolean left = false;

        int onHotspot = 0;

        for (java.util.Map.Entry<String, Long> e : clients.entrySet()) {

            if (now - e.getValue() > CLIENT_GONE_MS) {

                clients.remove(e.getKey());
                hotspotIds.remove(e.getKey());
                left = true;
            } else {

                here += 1;

                if (hotspotIds.contains(e.getKey())) {
                    onHotspot += 1;
                }
            }
        }

        hotspotBrowsers = onHotspot;

        Hub.setClients(here);

        // A browser that stops asking may have lost the network along with
        // the phone, so the player checks whether Mureka still answers
        if (left) {
            Hub.command("netCheck", "a browser of the web view went away");
        }
    }

    // One request per connection, then close. Plenty for one car browser
    private void handle(Socket client) {

        try (Socket c = client) {

            // Anything that did not come from an allowed local network is
            // closed without a word, the mobile network always among them
            if (!allowed(c.getLocalAddress(), c.getInetAddress())) {
                return;
            }

            c.setSoTimeout(10000);
            APP_REQUEST.set(Boolean.FALSE);

            // Whether it came over the hotspot rather than the phone's Wi-Fi
            boolean viaHotspot = onHotspot(c.getInetAddress());

            InputStream in = c.getInputStream();
            OutputStream out = c.getOutputStream();

            String requestLine = readLine(in);

            if (requestLine == null) {
                return;
            }

            String[] parts = requestLine.split(" ");

            // Only what a browser of the web view sends: GET or POST of a
            // path on this server
            if (parts.length < 2 || !("GET".equals(parts[0]) || "POST".equals(parts[0]))
                || !parts[1].startsWith("/")) {

                send(out, 400, "text/plain", bytes("Bad request"));
                return;
            }

            String method = parts[0];
            String path = parts[1];
            String query = "";
            int q = path.indexOf('?');

            if (q >= 0) {

                query = path.substring(q + 1);
                path = path.substring(0, q);
            }

            int length = 0;
            String range = "";
            String agent = "";
            String host = null;
            String origin = null;
            String contentType = null;
            String cookie = null;
            String line;
            int headers = 0;
            long headUntil = System.currentTimeMillis() + HEAD_MS;

            while ((line = readLine(in)) != null && !line.isEmpty()) {

                // A request that sends headers without end, or one slowly
                // enough to hold the connection, is closed
                headers += 1;

                if (headers > MAX_HEADERS || System.currentTimeMillis() > headUntil) {

                    send(out, 431, "text/plain", bytes("Too many headers"));
                    return;
                }

                int colon = line.indexOf(':');

                // The part of a song the browser asks for, to seek in it
                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("range")) {
                    range = line.substring(colon + 1).trim();
                }

                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("user-agent")) {
                    agent = line.substring(colon + 1);
                }

                // Where the browser thinks it is and which page sent it, to
                // turn away requests from other websites
                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("host")) {
                    host = line.substring(colon + 1).trim();
                }

                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("origin")) {
                    origin = line.substring(colon + 1).trim();
                }

                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("cookie")) {
                    cookie = line.substring(colon + 1).trim();
                }

                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("content-type")) {
                    contentType = line.substring(colon + 1).trim().toLowerCase(Locale.ROOT);
                }

                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("content-length")) {

                    try {
                        length = Integer.parseInt(line.substring(colon + 1).trim());
                    } catch (NumberFormatException e) {
                        length = 0;
                    }
                }
            }

            // Another website open in a browser here may not use the web
            // view: not through a name of its own pointing at the phone, not
            // by sending commands from its page
            if (!sameSite(method, host, origin, contentType)) {

                Hub.note("Web view", "turned away a request from another website for " + path);
                send(out, 403, "text/plain", bytes("Not from this page"));
                return;
            }

            // The app's own screen, from the device itself, named so and
            // with the app's secret
            boolean appScreen = c.getInetAddress() != null && plainV4(c.getInetAddress()).isLoopbackAddress()
                && agent.contains(APP_AGENT) && appCookie(cookie);

            APP_REQUEST.set(appScreen);

            // A request from a web view keeps the phone awake a while
            if (!appScreen) {
                PlayerService.webViewActive();
            }

            boolean big = "/setCover".equals(path) || "/importText".equals(path) || "/importApply".equals(path);

            if (length < 0 || length > (big ? MAX_COVER : MAX_BODY)) {

                send(out, 413, "text/plain", bytes("Too large"));
                return;
            }

            byte[] body = readBody(in, length, System.currentTimeMillis() + BODY_MS);

            // With a password set, all but the page itself and signing in
            // needs a browser that has signed in. The app's own screen never
            String key = WebLogin.fromCookie(cookie);
            boolean pageItself = "GET".equals(method) && ("/".equals(path) || "/index.html".equals(path));

            if ("POST".equals(method) && "/login".equals(path)) {

                signIn(out, body, c.getInetAddress() == null ? "" : plainV4(c.getInetAddress()).getHostAddress());
                return;
            }

            if ("POST".equals(method) && "/logout".equals(path)) {

                WebLogin.signOut(context, key);
                sendCookie(out, "{\"ok\":true}", "");
                return;
            }

            if (!appScreen && !pageItself && WebLogin.on(context) && !WebLogin.valid(context, key)) {

                send(out, 401, "application/json", bytes("{\"login\":true}"));
                return;
            }

            if ("GET".equals(method) && ("/".equals(path) || "/index.html".equals(path))) {
                send(out, 200, "text/html; charset=utf-8", page != null ? page : bytes("webview.html missing"));
            } else if ("GET".equals(method) && "/state".equals(path)) {

                // With since, the answer waits for the next state, so a tap
                // on play shows as soon as the player has acted on it. The
                // player publishes at least once a second, so it never
                // waits long
                String since = param(query, "since");
                String json;

                markPoll();
                if (!appScreen) {
                    noteClient(param(query, "cid"), viaHotspot);
                }

                if (since.isEmpty()) {
                    json = Hub.awaitState(-1, 0);
                } else {
                    json = Hub.awaitState(longNumber(since, -1), 5000);
                }

                markPoll();
                send(out, 200, "application/json", bytes(json));
            } else if ("GET".equals(method) && "/list".equals(path)) {
                sendList(out, query);
            } else if ("GET".equals(method) && "/queue".equals(path)) {

                // The search text goes in as data, quoted, never as code
                JSONObject req = new JSONObject();

                try {
                    req.put("q", param(query, "q"));
                } catch (JSONException e) {
                    // An empty search then
                }

                sendCall(out, "__murekaHostQueue", req.toString());
            } else if ("GET".equals(method) && "/panel".equals(path)) {

                String name = param(query, "name");

                // Only the panels the player offers, never a name from the
                // car put straight into the page
                if (!"settings".equals(name) && !"filters".equals(name) && !"creators".equals(name)
                    && !"info".equals(name) && !"playlists".equals(name)) {
                    name = "settings";
                }

                sendCall(out, "__murekaHostPanel", JSONObject.quote(name));
            } else if ("GET".equals(method) && "/export".equals(path)) {

                // The data behind an export, so the browser showing the web
                // view can save the file itself
                String asked = param(query, "kind");
                String kind = "songs".equals(asked) || "library".equals(asked) || "queue".equals(asked) ? asked : "settings";

                // The song library is thousands of songs and takes the page
                // longer to put together
                sendCall(out, "__murekaHostExport", JSONObject.quote(kind),
                    "library".equals(kind) ? 30000 : 4000);
            } else if ("GET".equals(method) && "/exportName".equals(path)) {

                String asked = param(query, "kind");
                String kind = "songs".equals(asked) || "library".equals(asked) || "queue".equals(asked) ? asked : "settings";

                sendCall(out, "__murekaHostExportName", JSONObject.quote(kind));
            } else if ("GET".equals(method) && "/download".equals(path)) {
                sendDownload(out, param(query, "kind"), param(query, "name"));
            } else if ("GET".equals(method) && path.startsWith("/download/")) {

                // The name as the last part of the address too, for browsers
                // that name a download after its address rather than after
                // the answer's headers
                String named;

                try {
                    named = java.net.URLDecoder.decode(path.substring("/download/".length()), "UTF-8");
                } catch (IllegalArgumentException e) {
                    named = "";
                }

                sendDownload(out, param(query, "kind"), named);
            } else if ("GET".equals(method) && "/parts".equals(path)) {

                // The playing song's waveforms and lyrics, read apart from
                // the state, which goes out every second without them
                sendCall(out, "__murekaHostStateParts", "null");
            } else if ("GET".equals(method) && "/menu".equals(path)) {

                // What the long press menu offers for one song, the id goes
                // in quoted, as data
                sendCall(out, "__murekaHostSongMenu", JSONObject.quote(param(query, "id")));
            } else if ("GET".equals(method) && "/audio".equals(path)) {
                sendAudio(out, param(query, "url"));
            } else if ("GET".equals(method) && "/cover".equals(path)) {
                sendCover(out, param(query, "u"));
            } else if ("GET".equals(method) && "/song".equals(path)) {
                sendSong(out, param(query, "u"), range);
            } else if ("POST".equals(method) && "/cmd".equals(path)) {
                runCommand(out, body);
            } else if ("POST".equals(method) && "/importText".equals(path)) {
                importText(out, query, body);
            } else if ("POST".equals(method) && "/importApply".equals(path)) {
                importApply(out, body);
            } else if ("POST".equals(method) && "/setCover".equals(path)) {
                setCover(out, query, body);
            } else {
                send(out, 404, "text/plain", bytes("Not found"));
            }
        } catch (IOException e) {
            // The car dropped the connection, nothing to answer
        } catch (RuntimeException e) {

            // A request the code did not expect, broken escapes in the
            // address say. The connection is closed, the app runs on
            Hub.note("Server", "A request could not be read: " + e.getClass().getSimpleName());
        } finally {
            APP_REQUEST.remove();
        }
    }

    // The sorting asked for when the player knows it, otherwise Mureka's order
    private static String listView(String asked) {

        for (String view : LIST_VIEWS) {

            if (view.equals(asked)) {
                return view;
            }
        }

        return "mureka";
    }

    // A page of the song list, straight from the player. The search text and
    // the paging come in as query parameters
    private void sendList(OutputStream out, String query) throws IOException {

        markPoll();

        JSONObject req = new JSONObject();

        try {

            req.put("q", param(query, "q"));
            req.put("view", listView(param(query, "view")));
            req.put("offset", number(param(query, "offset"), 0));
            req.put("limit", number(param(query, "limit"), 60));
        } catch (JSONException e) {
            // A default request then
        }

        String json = Hub.requestList(req.toString(), 4000);

        if (json.isEmpty()) {

            send(out, 503, "application/json", bytes("{\"error\":\"no player\"}"));
            return;
        }

        send(out, 200, "application/json", bytes(json));
    }

    // A song's file for the web view, whose trimmer reads it in the
    // browser. The phone's own copy when the song is stored there, from
    // Mureka otherwise. The browser may not fetch it from Mureka itself, the
    // file comes from another address. Only Mureka's own files over https,
    // never an address of the browser's choosing
    private void sendAudio(OutputStream out, String url) throws IOException {

        markPoll();

        URL parsed;

        try {
            parsed = new URL(url);
        } catch (MalformedURLException e) {
            parsed = null;
        }

        String host = parsed != null && parsed.getHost() != null ? parsed.getHost().toLowerCase(Locale.ROOT) : "";

        if (parsed == null || !"https".equals(parsed.getProtocol())
            || !(host.equals("mureka.ai") || host.endsWith(".mureka.ai"))) {

            send(out, 403, "text/plain", bytes("Not a Mureka song"));
            return;
        }

        if (sendStored(out, url)) {
            return;
        }

        HttpURLConnection c = null;

        try {

            c = (HttpURLConnection) parsed.openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(30000);
            c.setInstanceFollowRedirects(true);

            int code = c.getResponseCode();

            if (code != 200) {

                send(out, 502, "text/plain", bytes("Mureka answered " + code));
                return;
            }

            String type = headerValue(c.getContentType(), "audio/mpeg");
            long length = c.getContentLengthLong();
            StringBuilder head = new StringBuilder();

            head.append("HTTP/1.1 200 OK\r\nContent-Type: ").append(type).append("\r\n");

            // The length when Mureka says, so the page can show how much
            // has arrived
            if (length >= 0) {
                head.append("Content-Length: ").append(length).append("\r\n");
            }

            head.append("Cache-Control: no-store\r\nConnection: close\r\n\r\n");
            out.write(head.toString().getBytes(StandardCharsets.US_ASCII));

            try (InputStream in = c.getInputStream()) {

                byte[] buf = new byte[65536];
                int n;

                while ((n = in.read(buf)) != -1) {
                    out.write(buf, 0, n);
                }
            }

            out.flush();
        } catch (IOException e) {

            // Nothing sent yet when Mureka could not be reached, the page
            // hears why. Once the file is under way the connection just ends
            Hub.note("Web view", "song file for the trimmer failed, " + e.getClass().getSimpleName());
        } finally {

            if (c != null) {
                c.disconnect();
            }
        }
    }

    // A cover kept on the phone, fetched from Mureka first when it is not
    // there yet. The browser may keep it for good, a cover's address never
    // shows another picture
    private void sendCover(OutputStream out, String url) throws IOException {

        if (!CoverCache.allowed(url)) {

            send(out, 403, "text/plain", bytes("Not a Mureka cover"));
            return;
        }

        long asked = System.currentTimeMillis();
        java.io.File file = CoverCache.get(url);
        long took = System.currentTimeMillis() - asked;

        if (file == null) {

            Hub.note("Covers", "a cover could not be given to the web view, after " + took + " ms");
            send(out, 502, "text/plain", bytes("Mureka did not give the cover"));
            return;
        }

        // A slow one says so, to see where covers get stuck
        if (took > 3000) {
            Hub.note("Covers", "a cover took " + took + " ms to get from Mureka");
        }

        String head = "HTTP/1.1 200 OK\r\nContent-Type: " + headerValue(CoverCache.type(file), "image/jpeg") + "\r\n"
            + "Content-Length: " + file.length() + "\r\n"
            + "Cache-Control: public, max-age=31536000, immutable\r\nConnection: close\r\n\r\n";

        out.write(head.getBytes(StandardCharsets.US_ASCII));

        try (InputStream in = new java.io.FileInputStream(file)) {

            byte[] buf = new byte[32768];
            int n;

            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
            }
        }

        out.flush();
    }

    // A song for the browser out of the phone's own song cache, read from
    // the player a piece at a time, the part asked for when the browser
    // seeks. A song the phone does not have yet sends the browser to Mureka
    // for it, as before, while the phone fetches it for the next time
    private static final int SONG_PIECE = 256 * 1024;

    private void sendSong(OutputStream out, String url, String range) throws IOException {

        markPoll();

        if (!CoverCache.allowed(url)) {

            send(out, 403, "text/plain", bytes("Not a Mureka song"));
            return;
        }

        String info = Hub.requestLater("__murekaHostSongInfo", JSONObject.quote(url), 8000);
        long size = 0;
        String type = "audio/mpeg";

        try {

            if (!info.isEmpty()) {

                JSONObject o = new JSONObject(info);

                size = (long) o.optDouble("size", 0);
                type = headerValue(o.optString("type", type), "audio/mpeg");
            }
        } catch (JSONException e) {
            size = 0;
        }

        // Not on the phone, the browser gets it from Mureka itself
        if (size <= 0) {

            // The address as plain ASCII, nothing in it may break the line
            String where = headerValue(asciiUrl(url), null);

            if (where == null) {

                send(out, 400, "text/plain", bytes("Bad address"));
                return;
            }

            String head = "HTTP/1.1 302 Found\r\nLocation: " + where + "\r\n"
                + "Content-Length: 0\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";

            out.write(head.getBytes(StandardCharsets.US_ASCII));
            out.flush();
            return;
        }

        long start = 0;
        long end = size - 1;
        boolean partial = false;

        // bytes=start-end, bytes=start- or bytes=-last
        if (range.startsWith("bytes=")) {

            // Only the first range is served. "bytes=," has none at all
            String[] specs = range.substring(6).split(",");
            String spec = specs.length > 0 ? specs[0].trim() : "";
            int dash = spec.indexOf('-');

            try {

                if (dash == 0) {

                    long last = Long.parseLong(spec.substring(1).trim());

                    start = Math.max(0, size - last);
                } else if (dash > 0) {

                    start = Long.parseLong(spec.substring(0, dash).trim());

                    String rest = spec.substring(dash + 1).trim();

                    if (!rest.isEmpty()) {
                        end = Math.min(size - 1, Long.parseLong(rest));
                    }
                }

                partial = true;
            } catch (NumberFormatException e) {

                start = 0;
                end = size - 1;
            }
        }

        if (start > end || start >= size) {

            String head = "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */" + size + "\r\n"
                + "Content-Length: 0\r\nConnection: close\r\n\r\n";

            out.write(head.getBytes(StandardCharsets.US_ASCII));
            out.flush();
            return;
        }

        StringBuilder head = new StringBuilder();

        head.append(partial ? "HTTP/1.1 206 Partial Content\r\n" : "HTTP/1.1 200 OK\r\n");
        head.append("Content-Type: ").append(type).append("\r\n");
        head.append("Content-Length: ").append(end - start + 1).append("\r\n");

        if (partial) {
            head.append("Content-Range: bytes ").append(start).append('-').append(end).append('/').append(size).append("\r\n");
        }

        head.append("Accept-Ranges: bytes\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n");
        out.write(head.toString().getBytes(StandardCharsets.US_ASCII));

        sendPieces(out, url, start, end, size);
    }

    // A stored song in full, read from the player a piece at a time. False
    // when the phone does not have it, nothing is sent then
    private boolean sendStored(OutputStream out, String url) throws IOException {

        String info = Hub.requestLater("__murekaHostStoredInfo", JSONObject.quote(url), 8000);
        long size = 0;
        String type = "audio/mpeg";

        try {

            if (!info.isEmpty()) {

                JSONObject o = new JSONObject(info);

                size = (long) o.optDouble("size", 0);
                type = headerValue(o.optString("type", type), "audio/mpeg");
            }
        } catch (JSONException e) {
            size = 0;
        }

        if (size <= 0) {
            return false;
        }

        // Marked, so the page can say the song is read from the phone
        String head = "HTTP/1.1 200 OK\r\nContent-Type: " + type + "\r\n"
            + "Content-Length: " + size + "\r\nX-Mureka-Stored: 1\r\n"
            + "Cache-Control: no-store\r\nConnection: close\r\n\r\n";

        out.write(head.getBytes(StandardCharsets.US_ASCII));
        sendPieces(out, url, 0, size - 1, size);
        return true;
    }

    // The bytes from start to end of a stored song, asked of the player a
    // piece at a time. Should the player not read on, the connection just
    // ends and the browser asks again from where it got to
    private void sendPieces(OutputStream out, String url, long start, long end, long size) throws IOException {

        long pos = start;

        while (pos <= end) {

            int want = (int) Math.min(SONG_PIECE, end - pos + 1);
            JSONObject ask = new JSONObject();

            try {

                ask.put("u", url);
                ask.put("start", pos);
                ask.put("len", want);
            } catch (JSONException e) {
                break;
            }

            String b64 = Hub.requestLater("__murekaHostSongPart", ask.toString(), 8000);

            // The player could not read on, the connection just ends and the
            // browser asks again from where it got to
            if (b64.isEmpty()) {

                Hub.note("Web view", "a song piece could not be read at " + pos + " of " + size);
                break;
            }

            byte[] piece;

            try {
                piece = java.util.Base64.getDecoder().decode(b64);
            } catch (IllegalArgumentException e) {
                break;
            }

            if (piece.length == 0) {
                break;
            }

            out.write(piece);
            pos += piece.length;
            markPoll();
        }

        out.flush();
    }

    // An export as a real download, under the name asked for. A browser
    // takes the name from the answer's headers, which a page cannot give a
    // file made in the page, some then call it Unknown. Where it is saved
    // is the browser's own choice, or its question
    private void sendDownload(OutputStream out, String asked, String wantedName) throws IOException {

        markPoll();

        String kind = "songs".equals(asked) || "library".equals(asked) || "queue".equals(asked) ? asked : "settings";
        String json = Hub.request("__murekaHostExportText", JSONObject.quote(kind), "library".equals(kind) ? 30000 : 4000);
        String text;
        String name;

        try {

            JSONObject o = new JSONObject(json);

            text = o.getString("text");
            name = o.optString("name", "mureka-player.json");
        } catch (JSONException e) {

            send(out, 503, "text/plain", bytes("The phone did not give the file"));
            return;
        }

        String clean = wantedName == null ? "" : wantedName.replaceAll("[\\\\/:*?\"<>|\\r\\n]+", "_").trim();

        if (!clean.isEmpty()) {
            name = clean.toLowerCase(Locale.ROOT).endsWith(".json") ? clean : clean + ".json";
        }

        byte[] body = text.getBytes(StandardCharsets.UTF_8);
        String ascii = name.replaceAll("[^\\x20-\\x7e]", "_").replace("\"", "_");
        // The plain form of the name only, which every browser reads
        String head = "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n"
            + "Content-Disposition: attachment; filename=\"" + ascii + "\"\r\n"
            + "Content-Length: " + body.length + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";

        out.write(head.getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }

    // Whatever one of the player's host functions returns
    private void sendCall(OutputStream out, String function, String argJson) throws IOException {
        sendCall(out, function, argJson, 4000);
    }

    // The same, waiting longer for a call with a large answer
    private void sendCall(OutputStream out, String function, String argJson, long timeoutMs)
        throws IOException {

        markPoll();

        String json = Hub.request(function, argJson, timeoutMs);

        if (json.isEmpty()) {

            send(out, 503, "application/json", bytes("{\"error\":\"no player\"}"));
            return;
        }

        send(out, 200, "application/json", bytes(json));
    }

    // Whether a connection may use the web view. The sender has to be on a
    // network the phone is on, the hotspot or a Wi-Fi, as the settings
    // allow, and the request has to be for one of the phone's own addresses
    // that is not on the mobile network. The mobile network never, whatever
    // its address looks like. The phone itself, through adb, always
    private boolean allowed(InetAddress local, InetAddress remote) {

        if (local == null || remote == null) {
            return false;
        }

        local = plainV4(local);
        remote = plainV4(remote);

        if (local.isLoopbackAddress()) {
            return true;
        }

        if (!(local instanceof Inet4Address) || !(remote instanceof Inet4Address)) {
            return false;
        }

        // Where the sender is. The interface whose network holds its address
        NetworkInterface ni = interfaceFor(remote);

        if (ni == null) {
            return false;
        }

        refreshInterfaces();

        String name = ni.getName() == null ? "" : ni.getName();

        if (isCell(name)) {
            return false;
        }

        // The request may be for any of the phone's own addresses, except
        // one on the mobile network. The car on the hotspot asks for the
        // address the phone has on another network, such as the one an
        // ESP32 access point hands out, or the VPN's car address
        String car = CarVpn.activeAddress();
        boolean carAddress = car != null && car.equals(local.getHostAddress());

        if (!carAddress) {

            NetworkInterface own;

            try {
                own = NetworkInterface.getByInetAddress(local);
            } catch (IOException e) {
                return false;
            }

            if (own == null || own.getName() == null || isCell(own.getName())) {
                return false;
            }
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean wifi = wifiInterfaces.contains(name);

        // Not the phone's Wi-Fi and not the mobile network, so a network the
        // phone hands out itself, the hotspot, or USB tethering
        return wifi
            ? "1".equals(prefs.getString(WebViewSettings.ALLOW_WIFI, "1"))
            : "1".equals(prefs.getString(WebViewSettings.ALLOW_HOTSPOT, "1"));
    }

    // Whether a request comes from the web view's own page. The address
    // asked for must be the phone's: an IP address, a .local name or
    // localhost, so a website whose name was made to point at the phone
    // gets nothing. A POST must come from a page on that same address, and
    // be of a type a browser only sends from another website after asking
    // first, which this server never agrees to
    static boolean sameSite(String method, String host, String origin, String contentType) {

        String name = hostName(host);

        if (name != null && !ownName(name)) {
            return false;
        }

        if (!"POST".equals(method)) {
            return true;
        }

        if (contentType == null || contentType.isEmpty() || contentType.startsWith("text/plain")
            || contentType.startsWith("multipart/form-data")
            || contentType.startsWith("application/x-www-form-urlencoded")) {
            return false;
        }

        if (origin == null) {
            return true;
        }

        if ("null".equals(origin)) {
            return false;
        }

        try {

            String from = URI.create(origin).getHost();

            return from != null && name != null
                && from.replace("[", "").replace("]", "").equalsIgnoreCase(name.replace("[", "").replace("]", ""));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    // The name part of a Host header, without the port. Null without one
    private static String hostName(String host) {

        if (host == null || host.isEmpty()) {
            return null;
        }

        String h = host.toLowerCase(Locale.ROOT);

        if (h.startsWith("[")) {

            int end = h.indexOf(']');

            return end > 0 ? h.substring(0, end + 1) : h;
        }

        int colon = h.indexOf(':');

        return colon >= 0 ? h.substring(0, colon) : h;
    }

    // An address or name that can only be the phone itself
    private static boolean ownName(String name) {

        if (name.startsWith("[") || "localhost".equals(name) || name.endsWith(".local")) {
            return true;
        }

        return name.matches("\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}");
    }

    // The mobile network, whatever Android or the chip maker calls it
    private boolean isCell(String name) {
        return cellInterfaces.contains(name) || name.startsWith("rmnet") || name.startsWith("ccmni");
    }

    // Interfaces a car or a laptop can be on. Mobile data, VPNs and the
    // translation interfaces for IPv6 only networks are never among them
    private static boolean usable(NetworkInterface ni) throws IOException {

        String name = ni.getName() == null ? "" : ni.getName();

        return ni.isUp() && !ni.isLoopback() && !name.startsWith("rmnet") && !name.startsWith("ccmni")
            && !name.startsWith("v4-") && !name.startsWith("clat") && !name.startsWith("tun")
            && !name.startsWith("dummy");
    }

    // The interface whose IPv4 network holds this address
    private static NetworkInterface interfaceFor(InetAddress remote) {

        try {

            java.util.Enumeration<NetworkInterface> all = NetworkInterface.getNetworkInterfaces();

            if (all == null) {
                return null;
            }

            for (NetworkInterface ni : Collections.list(all)) {

                if (!usable(ni)) {
                    continue;
                }

                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {

                    if (ia.getAddress() instanceof Inet4Address && sameNetwork(ia, remote)) {
                        return ni;
                    }
                }
            }
        } catch (IOException e) {
            // No interfaces to look at
        }

        return null;
    }

    // An IPv4 address that arrived dressed as IPv6, ::ffff:a.b.c.d
    private static InetAddress plainV4(InetAddress a) {

        if (a instanceof Inet6Address) {

            byte[] b = a.getAddress();
            boolean mapped = true;

            for (int i = 0; i < 10; i++) {

                if (b[i] != 0) {
                    mapped = false;
                }
            }

            if (mapped && (b[10] & 0xff) == 0xff && (b[11] & 0xff) == 0xff) {

                try {
                    return InetAddress.getByAddress(new byte[] { b[12], b[13], b[14], b[15] });
                } catch (IOException e) {
                    return a;
                }
            }
        }

        return a;
    }

    // Whether an address is inside the network of one of our addresses. A
    // network of one address, such as the VPN's, holds nobody else
    private static boolean sameNetwork(InterfaceAddress ia, InetAddress remote) {

        int bits = ia.getNetworkPrefixLength();

        if (!(remote instanceof Inet4Address) || bits <= 0 || bits >= 32) {
            return false;
        }

        byte[] a = ia.getAddress().getAddress();
        byte[] b = remote.getAddress();

        for (int i = 0; i < bits; i++) {

            int mask = 1 << (7 - (i % 8));

            if ((a[i / 8] & mask) != (b[i / 8] & mask)) {
                return false;
            }
        }

        return true;
    }

    // Ask Android which interfaces carry the phone's own Wi-Fi and which the
    // mobile network. The hotspot is neither, Android keeps it apart
    @SuppressWarnings("deprecation")
    private synchronized void refreshInterfaces() {

        long now = System.currentTimeMillis();

        if (now - interfacesAt < 10000) {
            return;
        }

        interfacesAt = now;

        Set<String> wifi = new HashSet<>();
        Set<String> cell = new HashSet<>();
        ConnectivityManager cm = context.getSystemService(ConnectivityManager.class);

        if (cm != null) {

            for (Network n : cm.getAllNetworks()) {

                NetworkCapabilities caps = cm.getNetworkCapabilities(n);
                LinkProperties lp = cm.getLinkProperties(n);

                if (caps == null || lp == null || lp.getInterfaceName() == null) {
                    continue;
                }

                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                    cell.add(lp.getInterfaceName());
                } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) && joinedWifi(caps, lp)) {
                    wifi.add(lp.getInterfaceName());
                }
            }
        }

        wifiInterfaces = wifi;
        cellInterfaces = cell;
    }

    // A Wi-Fi the phone has joined, not its own hotspot. From Android 15
    // the hotspot is listed as a Wi-Fi network too, marked as a local
    // network, and it leads nowhere: no internet and no router to go out
    // through, where a joined Wi-Fi has at least one of them
    private static boolean joinedWifi(NetworkCapabilities caps, LinkProperties lp) {

        if (Build.VERSION.SDK_INT >= 35
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_LOCAL_NETWORK)) {
            return false;
        }

        if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) {
            return true;
        }

        for (RouteInfo r : lp.getRoutes()) {

            if (r.isDefaultRoute() && r.hasGateway()) {
                return true;
            }
        }

        return false;
    }

    // One query parameter, URL decoded, or an empty string
    private static String param(String query, String name) {

        for (String pair : query.split("&")) {

            int eq = pair.indexOf('=');
            String key = eq < 0 ? pair : pair.substring(0, eq);

            if (key.equals(name)) {

                String value = eq < 0 ? "" : pair.substring(eq + 1);

                try {
                    return java.net.URLDecoder.decode(value, "UTF-8");
                } catch (java.io.UnsupportedEncodingException e) {
                    return value;
                } catch (IllegalArgumentException e) {

                    // A broken escape such as %zz, taken as no value
                    return "";
                }
            }
        }

        return "";
    }

    private static long longNumber(String text, long fallback) {

        try {
            return Long.parseLong(text.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static int number(String text, int fallback) {

        try {
            return Integer.parseInt(text.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private void runCommand(OutputStream out, byte[] body) throws IOException {

        try {

            JSONObject req = new JSONObject(new String(body, StandardCharsets.UTF_8));
            String cmd = req.optString("cmd", "");
            Object arg = req.opt("arg");

            if (arg == JSONObject.NULL) {
                arg = null;
            }

            if (cmd.isEmpty()) {

                send(out, 400, "application/json", bytes("{\"ok\":false}"));
                return;
            }

            // Asking for the sound counts as the web view being there
            markPoll();

            // The phone's own media volume is the app's business, not the
            // player's, so it never goes into the page
            if ("sysVolume".equals(cmd)) {

                SysVolume.set(arg instanceof Number ? ((Number) arg).intValue()
                    : number(String.valueOf(arg), 0));
                send(out, 200, "application/json", bytes("{\"ok\":true}"));
                return;
            }

            // A web view's own debug log is too long for one line
            String shown = "webDebugLog".equals(cmd) ? "its debug log"
                : cmd + (arg != null ? " " + arg : "");

            Hub.note("Command", "From a web view: " + (shown.length() > 100 ? shown.substring(0, 100) + "..." : shown));
            Hub.command(cmd, arg);
            send(out, 200, "application/json", bytes("{\"ok\":true}"));
        } catch (JSONException e) {
            send(out, 400, "application/json", bytes("{\"ok\":false}"));
        }
    }

    // An export from a web view, pasted there or read from a file there,
    // read on the phone. The answer says what it holds and what differs,
    // for the browser to ask about before importApply
    private void importText(OutputStream out, String query, byte[] body) throws IOException {

        markPoll();

        JSONObject ask = new JSONObject();

        try {

            ask.put("text", new String(body, StandardCharsets.UTF_8));
            ask.put("from", "file".equals(param(query, "from")) ? "file" : "paste");
        } catch (JSONException e) {

            send(out, 400, "application/json", bytes("{\"ok\":false}"));
            return;
        }

        Hub.note("Command", "From a web view: an import, " + (body.length / 1024) + " kB");

        String answer = Hub.requestLater("__murekaHostImportText", ask.toString(), 30000);

        send(out, 200, "application/json", bytes(answer.isEmpty() ? "{\"ok\":false,\"why\":\"The phone did not answer\"}" : answer));
    }

    // An import the browser has asked everything about, put into effect on
    // the phone with its answers
    private void importApply(OutputStream out, byte[] body) throws IOException {

        markPoll();

        String json = new String(body, StandardCharsets.UTF_8);
        String clean;

        // Written out again from what was parsed, never passed on as it came:
        // the parser accepts more than JSON, and the text goes into the
        // player as script
        try {
            clean = new JSONObject(json).toString();
        } catch (JSONException e) {

            send(out, 400, "application/json", bytes("{\"ok\":false}"));
            return;
        }

        String answer = Hub.requestLater("__murekaHostImportApply", clean, 30000);

        send(out, 200, "application/json", bytes(answer.isEmpty() ? "{\"ok\":false,\"why\":\"The phone did not answer\"}" : answer));
    }

    // A new cover for a song from a web view, the picture and the square
    // chosen in it. The player uploads it to Mureka and answers whether it
    // went, which takes a few seconds
    private void setCover(OutputStream out, String query, byte[] body) throws IOException {

        markPoll();

        String id = param(query, "id");
        String type = param(query, "type");

        if (id.isEmpty() || body.length == 0) {

            send(out, 400, "application/json", bytes("{\"ok\":false,\"why\":\"No picture\"}"));
            return;
        }

        JSONObject ask = new JSONObject();

        try {

            ask.put("id", id);
            ask.put("type", type.startsWith("image/") && type.length() < 40 ? type : "image/jpeg");

            for (String k : new String[] { "x", "y", "s", "w", "h" }) {
                ask.put(k, longNumber(param(query, k), 0));
            }

            ask.put("data", java.util.Base64.getEncoder().encodeToString(body));
        } catch (JSONException e) {

            send(out, 400, "application/json", bytes("{\"ok\":false}"));
            return;
        }

        Hub.note("Command", "From a web view: a new cover for " + id + ", " + (body.length / 1024) + " kB");

        String answer = Hub.requestLater("__murekaHostSetCover", ask.toString(), 90000);

        send(out, 200, "application/json", bytes(answer.isEmpty() ? "{\"ok\":false,\"why\":\"The phone did not answer\"}" : answer));
    }

    // A browser signing in with the password. Right, it gets its key in a
    // cookie only this server sees. Wrong, it is told how long to wait
    // before the next try, if at all
    private void signIn(OutputStream out, byte[] body, String who) throws IOException {

        if (!WebLogin.on(context)) {

            send(out, 200, "application/json", bytes("{\"ok\":true}"));
            return;
        }

        String password = "";

        try {
            password = new JSONObject(new String(body, StandardCharsets.UTF_8)).optString("password", "");
        } catch (JSONException e) {
            password = "";
        }

        long wait = WebLogin.waitSeconds(who);

        if (wait > 0) {

            send(out, 429, "application/json", bytes("{\"wait\":" + wait + "}"));
            return;
        }

        String key = WebLogin.signIn(context, password, who);

        if (key == null) {

            send(out, 401, "application/json", bytes("{\"wrong\":true,\"wait\":" + WebLogin.waitSeconds(who) + "}"));
            return;
        }

        sendCookie(out, "{\"ok\":true}", key);
    }

    // An answer that sets the sign in cookie, or clears it when the key is
    // empty. Not readable by the page's scripts and never sent along from
    // another website
    private static void sendCookie(OutputStream out, String json, String key) throws IOException {

        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        String cookie = WebLogin.COOKIE + "=" + key + "; Path=/; HttpOnly; SameSite=Strict; Max-Age="
            + (key.isEmpty() ? "0" : "31536000");

        String head = String.format(Locale.ROOT,
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: %d\r\n"
            + "Set-Cookie: %s\r\n"
            + "Cache-Control: no-store\r\nX-Frame-Options: DENY\r\n"
            + "Content-Security-Policy: frame-ancestors 'none'\r\nX-Content-Type-Options: nosniff\r\n"
            + "Connection: close\r\n\r\n",
            body.length, cookie);

        out.write(head.getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }

    private static void send(OutputStream out, int code, String type, byte[] body) throws IOException {

        String reason = code == 200 ? "OK" : (code == 404 ? "Not Found" : "Error");

        String head = String.format(Locale.ROOT,
            "HTTP/1.1 %d %s\r\nContent-Type: %s\r\nContent-Length: %d\r\n"
            + "Cache-Control: no-store\r\nX-Frame-Options: DENY\r\n"
            + "Content-Security-Policy: frame-ancestors 'none'\r\nX-Content-Type-Options: nosniff\r\n"
            + "Connection: close\r\n\r\n",
            code, reason, headerValue(type, "application/octet-stream"), body.length);

        out.write(head.getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }

    // One header line, without the line break. Null at the end of the stream
    private static String readLine(InputStream in) throws IOException {

        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int b;

        while ((b = in.read()) != -1) {

            if (b == '\n') {
                break;
            }

            if (b != '\r') {
                buf.write(b);
            }

            if (buf.size() > 8192) {
                throw new IOException("Header too long");
            }
        }

        if (b == -1 && buf.size() == 0) {
            return null;
        }

        return buf.toString(StandardCharsets.ISO_8859_1.name());
    }

    // The body as it arrives, never more than it says it has, and grown as
    // the bytes come, so a request claiming a large body without sending it
    // takes no memory. Given up once the time is over
    private static byte[] readBody(InputStream in, int length, long until) throws IOException {

        if (length <= 0) {
            return new byte[0];
        }

        ByteArrayOutputStream body = new ByteArrayOutputStream(Math.min(length, 65536));
        byte[] buf = new byte[65536];
        int got = 0;

        while (got < length) {

            if (System.currentTimeMillis() > until) {
                throw new IOException("Body too slow");
            }

            int n = in.read(buf, 0, Math.min(buf.length, length - got));

            if (n < 0) {
                break;
            }

            body.write(buf, 0, n);
            got += n;
        }

        return body.toByteArray();
    }

    // An address with everything outside plain printable ASCII written as
    // escapes, spaces and line breaks among them. Escapes already in it
    // stay as they are
    private static String asciiUrl(String url) {

        if (url == null) {
            return null;
        }

        StringBuilder sb = new StringBuilder();

        for (byte b : url.getBytes(StandardCharsets.UTF_8)) {

            int v = b & 0xff;

            if (v > 0x20 && v < 0x7f) {
                sb.append((char) v);
            } else {
                sb.append('%').append(String.format(Locale.ROOT, "%02X", v));
            }
        }

        return sb.toString();
    }

    // A value safe to put in a header: printable ASCII only, so nothing in
    // it can end the line and start a header of its own. Anything else
    // gives the fallback
    static String headerValue(String value, String fallback) {

        if (value == null || value.isEmpty()) {
            return fallback;
        }

        for (int i = 0; i < value.length(); i++) {

            char ch = value.charAt(i);

            if (ch < 0x20 || ch > 0x7e) {
                return fallback;
            }
        }

        return value;
    }

    private static byte[] bytes(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    private byte[] readAsset(String name) {

        try (InputStream in = context.getAssets().open(name)) {

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;

            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
            }

            return out.toByteArray();
        } catch (IOException e) {
            return null;
        }
    }

    // The addresses other devices can open the page on, each with the
    // network it is on, the hotspot, a Wi-Fi or USB tethering, and whether
    // the settings let that network in. IPv4 only, never the mobile data
    // side or the VPN
    JSONArray describeAddresses(int port) {

        refreshInterfaces();

        JSONArray out = new JSONArray();
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean allowWifi = "1".equals(prefs.getString(WebViewSettings.ALLOW_WIFI, "1"));
        boolean allowHotspot = "1".equals(prefs.getString(WebViewSettings.ALLOW_HOTSPOT, "1"));

        try {

            java.util.Enumeration<NetworkInterface> all = NetworkInterface.getNetworkInterfaces();

            if (all == null) {
                return out;
            }

            for (NetworkInterface ni : Collections.list(all)) {

                String name = ni.getName() == null ? "" : ni.getName();

                if (!usable(ni) || isCell(name)) {
                    continue;
                }

                boolean wifi = wifiInterfaces.contains(name);
                boolean usb = name.startsWith("rndis") || name.startsWith("usb") || name.startsWith("ncm");
                String net = wifi ? "Wi-Fi" : (usb ? "USB" : "Hotspot");

                for (InetAddress a : Collections.list(ni.getInetAddresses())) {

                    if (!(a instanceof Inet4Address) || a.isLinkLocalAddress()) {
                        continue;
                    }

                    JSONObject o = new JSONObject();

                    o.put("url", "http://" + a.getHostAddress() + ":" + port);
                    o.put("net", net);
                    o.put("allowed", wifi ? allowWifi : allowHotspot);
                    out.put(o);
                }
            }
        } catch (IOException | JSONException e) {
            // What was found so far
        }

        return out;
    }

    // The addresses other devices can reach the page on, on the hotspot or
    // on a Wi-Fi. IPv4 only, never the mobile data side or the VPN
    static List<String> addresses(int port) {

        List<String> out = new ArrayList<>();

        try {

            java.util.Enumeration<NetworkInterface> all = NetworkInterface.getNetworkInterfaces();

            if (all == null) {
                return out;
            }

            for (NetworkInterface ni : Collections.list(all)) {

                if (!usable(ni)) {
                    continue;
                }

                for (InetAddress a : Collections.list(ni.getInetAddresses())) {

                    if (a instanceof Inet4Address && !a.isLinkLocalAddress()) {
                        out.add("http://" + a.getHostAddress() + ":" + port);
                    }
                }
            }
        } catch (IOException e) {
            // No interfaces to list
        }

        return out;
    }
}
