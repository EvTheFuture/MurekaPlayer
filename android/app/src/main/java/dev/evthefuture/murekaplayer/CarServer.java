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
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.HttpURLConnection;
import java.net.InterfaceAddress;
import java.net.MalformedURLException;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// Serves the web view and a tiny JSON API on the local network, the phone's
// hotspot in the web view. GET / is the page, GET /state the now playing state,
// POST /cmd with {"cmd": "...", "arg": ...} runs a command in the player
final class CarServer {

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

    // The sortings of the song list the player knows, anything else is
    // Mureka's own order
    private static final String[] LIST_VIEWS = {
        "alpha", "alphaDesc", "playsDown", "playsUp", "stars", "starsDown", "starsUp"
    };

    private final Context context;
    private final int port;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final ScheduledExecutorService watch = Executors.newSingleThreadScheduledExecutor();

    private volatile ServerSocket socket;

    // The last time a web view asked for the state. It starts a little in
    // the future, so after the app starts, an update in particular, a
    // browser playing the music has time to find the phone again before
    // the phone takes the sound back
    private static final long START_GRACE_MS = 20000;
    private volatile long lastPoll = System.currentTimeMillis() + START_GRACE_MS;

    // Every browser that asked for the state lately, by the id it sends with
    // the request. Two browsers on one page each count once
    private final java.util.Map<String, Long> clients = new java.util.concurrent.ConcurrentHashMap<>();
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

    static final String PREFS = CarSettings.PREFS;

    CarServer(Context context, int port) {

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

        page = readAsset("car.html");
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

                    pool.execute(() -> handle(client));
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

    // A browser asked for the state, so it is here. Its own id keeps two
    // pages on one machine apart
    private void noteClient(String id) {

        if (id == null || id.isEmpty() || id.length() > 64) {
            return;
        }

        clients.put(id, System.currentTimeMillis());
        countClients();
    }

    // How many browsers are here now, into the state so each of them can
    // tell whether it is alone
    private void countClients() {

        long now = System.currentTimeMillis();
        int here = 0;

        for (java.util.Map.Entry<String, Long> e : clients.entrySet()) {

            if (now - e.getValue() > CLIENT_GONE_MS) {
                clients.remove(e.getKey());
            } else {
                here += 1;
            }
        }

        Hub.setClients(here);
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

            // A request from a web view keeps the phone awake a while
            PlayerService.webViewActive();

            InputStream in = c.getInputStream();
            OutputStream out = c.getOutputStream();

            String requestLine = readLine(in);

            if (requestLine == null) {
                return;
            }

            String[] parts = requestLine.split(" ");

            if (parts.length < 2) {

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
            String line;

            while ((line = readLine(in)) != null && !line.isEmpty()) {

                int colon = line.indexOf(':');

                // The part of a song the browser asks for, to seek in it
                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("range")) {
                    range = line.substring(colon + 1).trim();
                }

                if (colon > 0 && line.substring(0, colon).trim().equalsIgnoreCase("content-length")) {

                    try {
                        length = Integer.parseInt(line.substring(colon + 1).trim());
                    } catch (NumberFormatException e) {
                        length = 0;
                    }
                }
            }

            if (length < 0 || length > MAX_BODY) {

                send(out, 413, "text/plain", bytes("Too large"));
                return;
            }

            byte[] body = readBody(in, length);

            if ("GET".equals(method) && ("/".equals(path) || "/index.html".equals(path))) {
                send(out, 200, "text/html; charset=utf-8", page != null ? page : bytes("car.html missing"));
            } else if ("GET".equals(method) && "/state".equals(path)) {

                // With since, the answer waits for the next state, so a tap
                // on play shows as soon as the player has acted on it. The
                // player publishes at least once a second, so it never
                // waits long
                String since = param(query, "since");
                String json;

                lastPoll = System.currentTimeMillis();
                noteClient(param(query, "cid"));

                if (since.isEmpty()) {
                    json = Hub.awaitState(-1, 0);
                } else {
                    json = Hub.awaitState(longNumber(since, -1), 5000);
                }

                lastPoll = System.currentTimeMillis();
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
                String kind = "songs".equals(asked) || "library".equals(asked) ? asked : "settings";

                // The song library is thousands of songs and takes the page
                // longer to put together
                sendCall(out, "__murekaHostExport", JSONObject.quote(kind),
                    "library".equals(kind) ? 30000 : 4000);
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
            } else {
                send(out, 404, "text/plain", bytes("Not found"));
            }
        } catch (IOException e) {
            // The car dropped the connection, nothing to answer
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

        lastPoll = System.currentTimeMillis();

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

    // A song's file from Mureka, handed on to the web view, whose trimmer
    // reads it in the browser. The browser may not fetch it from Mureka
    // itself, the file comes from another address. Only Mureka's own files
    // over https, never an address of the car's choosing
    private void sendAudio(OutputStream out, String url) throws IOException {

        lastPoll = System.currentTimeMillis();

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

            String type = c.getContentType() != null ? c.getContentType() : "audio/mpeg";
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

        String head = "HTTP/1.1 200 OK\r\nContent-Type: " + CoverCache.type(file) + "\r\n"
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

        lastPoll = System.currentTimeMillis();

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
                type = o.optString("type", type);
            }
        } catch (JSONException e) {
            size = 0;
        }

        // Not on the phone, the browser gets it from Mureka itself
        if (size <= 0) {

            String head = "HTTP/1.1 302 Found\r\nLocation: " + url + "\r\n"
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

            String spec = range.substring(6).split(",")[0].trim();
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
            lastPoll = System.currentTimeMillis();
        }

        out.flush();
    }

    // Whatever one of the player's host functions returns
    private void sendCall(OutputStream out, String function, String argJson) throws IOException {
        sendCall(out, function, argJson, 4000);
    }

    // The same, waiting longer for a call with a large answer
    private void sendCall(OutputStream out, String function, String argJson, long timeoutMs)
        throws IOException {

        lastPoll = System.currentTimeMillis();

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
            ? "1".equals(prefs.getString(CarSettings.ALLOW_WIFI, "1"))
            : "1".equals(prefs.getString(CarSettings.ALLOW_HOTSPOT, "1"));
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
            lastPoll = System.currentTimeMillis();

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

    private static void send(OutputStream out, int code, String type, byte[] body) throws IOException {

        String reason = code == 200 ? "OK" : (code == 404 ? "Not Found" : "Error");

        String head = String.format(Locale.ROOT,
            "HTTP/1.1 %d %s\r\nContent-Type: %s\r\nContent-Length: %d\r\n"
            + "Cache-Control: no-store\r\nConnection: close\r\n\r\n",
            code, reason, type, body.length);

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

    private static byte[] readBody(InputStream in, int length) throws IOException {

        byte[] body = new byte[length];
        int got = 0;

        while (got < length) {

            int n = in.read(body, got, length - got);

            if (n < 0) {
                break;
            }

            got += n;
        }

        return body;
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
        boolean allowWifi = "1".equals(prefs.getString(CarSettings.ALLOW_WIFI, "1"));
        boolean allowHotspot = "1".equals(prefs.getString(CarSettings.ALLOW_HOTSPOT, "1"));

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
