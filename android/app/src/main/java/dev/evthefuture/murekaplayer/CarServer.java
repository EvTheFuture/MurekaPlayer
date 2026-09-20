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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
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
    private byte[] page;

    CarServer(Context context, int port) {

        this.context = context.getApplicationContext();
        this.port = port;
    }

    void start() {

        page = readAsset("car.html");

        Thread accept = new Thread(this::acceptLoop, "car-server");

        accept.setDaemon(true);
        accept.start();

        watch.scheduleWithFixedDelay(this::checkCar, 2, 2, TimeUnit.SECONDS);
    }

    void stop() {

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

    private void acceptLoop() {

        try (ServerSocket s = new ServerSocket()) {

            s.setReuseAddress(true);
            s.bind(new InetSocketAddress(port));
            socket = s;

            while (!s.isClosed()) {

                final Socket client = s.accept();

                pool.execute(() -> handle(client));
            }
        } catch (IOException e) {
            // Closed by stop, or the port was taken
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
            int q = path.indexOf('?');

            if (q >= 0) {
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

                lastPoll = System.currentTimeMillis();
                send(out, 200, "application/json", bytes(Hub.stateJson()));
            } else if ("POST".equals(method) && "/cmd".equals(path)) {
                runCommand(out, body);
            } else {
                send(out, 404, "text/plain", bytes("Not found"));
            }
        } catch (IOException e) {
            // The car dropped the connection, nothing to answer
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

    // The addresses the car can reach the page on, on the hotspot or on a
    // shared Wi-Fi. Only private IPv4 networks, never the mobile data side
    static List<String> addresses(int port) {

        List<String> out = new ArrayList<>();

        try {

            java.util.Enumeration<NetworkInterface> all = NetworkInterface.getNetworkInterfaces();

            if (all == null) {
                return out;
            }

            for (NetworkInterface ni : Collections.list(all)) {

                String name = ni.getName() == null ? "" : ni.getName();

                // Mobile data and VPNs can carry private addresses too, but
                // the car can never reach the phone through them
                if (!ni.isUp() || ni.isLoopback() || name.startsWith("rmnet") || name.startsWith("ccmni")
                    || name.startsWith("v4-") || name.startsWith("clat") || name.startsWith("tun")
                    || name.startsWith("dummy")) {

                    continue;
                }

                for (InetAddress a : Collections.list(ni.getInetAddresses())) {

                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) {
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
