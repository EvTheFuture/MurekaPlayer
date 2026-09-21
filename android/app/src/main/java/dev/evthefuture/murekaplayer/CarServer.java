/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the small web server the car browser connects to
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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
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

import org.json.JSONException;
import org.json.JSONObject;

// Serves the car page and a tiny JSON API on the local network, the phone's
// hotspot in the car. GET / is the page, GET /state the now playing state,
// POST /cmd with {"cmd": "...", "arg": ...} runs a command in the player
final class CarServer {

    // With the sound in the car browser, the phone plays muted. If the car
    // page stops asking for the state for this long, it is gone, and the
    // phone takes the sound back so the music does not go silent
    private static final long CAR_GONE_MS = 8000;

    // Requests larger than this are refused, the API only needs a few bytes
    private static final int MAX_BODY = 16384;

    private final Context context;
    private final int port;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final ScheduledExecutorService watch = Executors.newSingleThreadScheduledExecutor();

    private volatile ServerSocket socket;
    private volatile long lastPoll = 0;
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

        if (s.optBoolean("carAudio", false) && System.currentTimeMillis() - lastPoll > CAR_GONE_MS) {
            Hub.command("carAudio", false);
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
            String line;

            while ((line = readLine(in)) != null && !line.isEmpty()) {

                int colon = line.indexOf(':');

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
                if (!"settings".equals(name) && !"filters".equals(name) && !"creators".equals(name)) {
                    name = "settings";
                }

                sendCall(out, "__murekaHostPanel", JSONObject.quote(name));
            } else if ("POST".equals(method) && "/cmd".equals(path)) {
                runCommand(out, body);
            } else {
                send(out, 404, "text/plain", bytes("Not found"));
            }
        } catch (IOException e) {
            // The car dropped the connection, nothing to answer
        }
    }

    // A page of the song list, straight from the player. The search text and
    // the paging come in as query parameters
    private void sendList(OutputStream out, String query) throws IOException {

        lastPoll = System.currentTimeMillis();

        JSONObject req = new JSONObject();

        try {

            req.put("q", param(query, "q"));
            req.put("view", "alpha".equals(param(query, "view")) ? "alpha" : "mureka");
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

    // Whatever one of the player's host functions returns
    private void sendCall(OutputStream out, String function, String argJson) throws IOException {

        lastPoll = System.currentTimeMillis();

        String json = Hub.request(function, argJson, 4000);

        if (json.isEmpty()) {

            send(out, 503, "application/json", bytes("{\"error\":\"no player\"}"));
            return;
        }

        send(out, 200, "application/json", bytes(json));
    }

    // Whether a connection may use the car page. The sender has to be on a
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
                } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    wifi.add(lp.getInterfaceName());
                }
            }
        }

        wifiInterfaces = wifi;
        cellInterfaces = cell;
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

            // Asking for the sound counts as the car being there
            lastPoll = System.currentTimeMillis();
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
