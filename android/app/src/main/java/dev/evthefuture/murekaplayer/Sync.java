/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, listening together through a relay on a VPN
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

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

// The app's side of listening together. A player sharing what it plays
// posts its state to a small relay (server/murekasync), the players
// listening along read the relay's stream of events. Nothing connects to
// this device. The relay is reached over a VPN with plain HTTP, the VPN
// carrying it encrypted. Android's own HTTP stack refuses plain HTTP to any
// address but this device's (network_security_config.xml, which keeps a
// plain page from posing as Mureka's in the WebView), so the few requests
// go over a socket of their own, to the one address set for the relay.
// HTTP/1.0 keeps the answers simple: no chunks, the relay closes the
// connection at the end. The relay's time on every answer gives the clock
// all players share
final class Sync {

    private static final int CONNECT_MS = 5000;
    private static final int READ_MS = 8000;

    // The stream sends a comment line every 15 s, so this long without a
    // byte means the connection is gone
    private static final int STREAM_READ_MS = 40000;

    // The largest answer read, the stream's events and the room list
    private static final int ANSWER_MAX = 256 * 1024;

    // Clock samples kept, and the best of them used: the one with the
    // shortest round trip, where the way there and back are most alike
    private static final int CLOCK_SAMPLES = 8;
    private static final long CLOCK_EVERY_MS = 60000;

    private static final ExecutorService LEAD = Executors.newSingleThreadExecutor();
    private static final ExecutorService ASK = Executors.newSingleThreadExecutor();

    private static final Object CLOCK_LOCK = new Object();
    private static final long[] clockOffset = new long[CLOCK_SAMPLES];
    private static final long[] clockRtt = new long[CLOCK_SAMPLES];
    private static int clockCount = 0;
    private static int clockNext = 0;
    private static long clockAt = 0;
    private static long clockSaid = Long.MIN_VALUE;

    // The latest state waiting to be posted, a newer one replacing it
    private static final Object LEAD_LOCK = new Object();
    private static String leadState = null;
    private static Relay leadRelay = null;
    private static String leadRoom = "";
    private static String leadKey = "";
    private static boolean leadBusy = false;

    // The stream listened to, ended by a new number
    private static volatile int followGen = 0;
    private static volatile Socket followSocket = null;

    private Sync() {
    }

    // Where the relay is: plain http, a host and a port, and a path under
    // which it answers
    static final class Relay {

        final String host;
        final int port;
        final String base;

        Relay(String host, int port, String base) {

            this.host = host;
            this.port = port;
            this.base = base;
        }
    }

    // The relay's address as set in the player, or null when it is not one
    static Relay parse(String url) {

        if (url == null) {
            return null;
        }

        String u = url.trim();

        if (!u.startsWith("http://")) {
            return null;
        }

        u = u.substring("http://".length());

        int slash = u.indexOf('/');
        String hostPort = slash < 0 ? u : u.substring(0, slash);
        String base = slash < 0 ? "" : u.substring(slash);

        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }

        String host = hostPort;
        int port = 80;
        int colon = hostPort.lastIndexOf(':');

        if (colon > 0 && hostPort.indexOf(']') < colon) {

            try {
                port = Integer.parseInt(hostPort.substring(colon + 1));
            } catch (NumberFormatException e) {
                return null;
            }

            host = hostPort.substring(0, colon);
        }

        if (host.startsWith("[") && host.endsWith("]")) {
            host = host.substring(1, host.length() - 1);
        }

        if (host.isEmpty() || port < 1 || port > 65535 || !host.matches("[A-Za-z0-9.:-]+")
                || !base.matches("[A-Za-z0-9._/-]*")) {
            return null;
        }

        return new Relay(host, port, base);
    }

    // A room name as the relay takes it
    static boolean roomOk(String room) {
        return room != null && room.matches("[a-z0-9][a-z0-9-]{0,39}");
    }

    // One answer: its status and body
    static final class Answer {

        final int status;
        final String body;

        Answer(int status, String body) {

            this.status = status;
            this.body = body;
        }
    }

    private static Socket open(Relay r, int readMs) throws IOException {

        Socket s = new Socket();

        s.connect(new InetSocketAddress(r.host, r.port), CONNECT_MS);
        s.setSoTimeout(readMs);
        s.setTcpNoDelay(true);

        return s;
    }

    private static void sendRequest(OutputStream out, Relay r, String method, String path, String key, byte[] body)
            throws IOException {

        StringBuilder head = new StringBuilder();

        head.append(method).append(' ').append(r.base).append(path).append(" HTTP/1.0\r\n");
        head.append("Host: ").append(r.host).append(':').append(r.port).append("\r\n");
        head.append("User-Agent: MurekaPlayer\r\n");

        if (key != null) {
            head.append("X-Room-Key: ").append(key).append("\r\n");
        }

        if (body != null) {
            head.append("Content-Type: application/json\r\n");
            head.append("Content-Length: ").append(body.length).append("\r\n");
        }

        head.append("\r\n");
        out.write(head.toString().getBytes(StandardCharsets.UTF_8));

        if (body != null) {
            out.write(body);
        }

        out.flush();
    }

    // A line of the answer's head, read byte by byte so nothing of the body
    // is taken along
    private static String headLine(InputStream in) throws IOException {

        ByteArrayOutputStream line = new ByteArrayOutputStream();
        int c;

        while ((c = in.read()) != -1) {

            if (c == '\n') {
                break;
            }

            if (c != '\r') {
                line.write(c);
            }

            if (line.size() > 8192) {
                throw new IOException("header line too long");
            }
        }

        if (c == -1 && line.size() == 0) {
            throw new IOException("connection closed");
        }

        return line.toString("UTF-8");
    }

    // The status of an answer, its head read past
    private static int readHead(InputStream in) throws IOException {

        String status = headLine(in);
        String[] parts = status.split(" ");

        if (parts.length < 2 || !parts[0].startsWith("HTTP/")) {
            throw new IOException("not an HTTP answer");
        }

        int code;

        try {
            code = Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            throw new IOException("not an HTTP answer");
        }

        while (!headLine(in).isEmpty()) {
            // Headers are not needed
        }

        return code;
    }

    // One request and its whole answer
    static Answer exchange(Relay r, String method, String path, String key, byte[] body) throws IOException {

        try (Socket s = open(r, READ_MS)) {

            sendRequest(s.getOutputStream(), r, method, path, key, body);

            InputStream in = s.getInputStream();
            int status = readHead(in);
            ByteArrayOutputStream out = new ByteArrayOutputStream();

            Io.copy(in, out, ANSWER_MAX);

            return new Answer(status, out.toString("UTF-8"));
        }
    }

    // A sample of the relay's clock: its time against this device's, at the
    // middle of the round trip
    private static void clockSample(long sent, long back, long relay) {

        if (relay <= 0 || back < sent) {
            return;
        }

        synchronized (CLOCK_LOCK) {

            clockOffset[clockNext] = relay - (sent + back) / 2;
            clockRtt[clockNext] = back - sent;
            clockNext = (clockNext + 1) % CLOCK_SAMPLES;
            clockCount = Math.min(CLOCK_SAMPLES, clockCount + 1);
            clockAt = System.currentTimeMillis();
        }
    }

    // How far the relay's clock is ahead of this device's, from the sample
    // with the shortest round trip, and that round trip; null before any
    static long[] clock() {

        synchronized (CLOCK_LOCK) {

            if (clockCount == 0) {
                return null;
            }

            int best = 0;

            for (int i = 1; i < clockCount; i++) {

                if (clockRtt[i] < clockRtt[best]) {
                    best = i;
                }
            }

            return new long[] { clockOffset[best], clockRtt[best] };
        }
    }

    // A few samples of the relay's clock, when the last are old or few
    private static void clockCheck(Relay r, int samples) {

        boolean fresh;

        synchronized (CLOCK_LOCK) {
            fresh = clockCount >= 3 && System.currentTimeMillis() - clockAt < CLOCK_EVERY_MS;
        }

        if (fresh) {
            return;
        }

        for (int i = 0; i < samples; i++) {

            try {

                long sent = System.currentTimeMillis();
                Answer a = exchange(r, "GET", "/time", null, null);
                long back = System.currentTimeMillis();

                if (a.status == 200) {
                    clockSample(sent, back, new JSONObject(a.body).optLong("t", 0));
                }
            } catch (Exception e) {
                break;
            }
        }

        clockTell();
    }

    // The page hears the clock when it moved by more than a little
    private static void clockTell() {

        long[] c = clock();

        if (c == null) {
            return;
        }

        if (clockSaid != Long.MIN_VALUE && Math.abs(c[0] - clockSaid) < 15) {
            return;
        }

        clockSaid = c[0];

        try {

            JSONObject o = new JSONObject();

            o.put("type", "clock");
            o.put("offset", c[0]);
            o.put("rtt", c[1]);
            PlayerWeb.syncToPage(o);
        } catch (Exception e) {
            // Left out
        }
    }

    private static void tell(String type, String key1, Object value1, String key2, Object value2) {

        try {

            JSONObject o = new JSONObject();

            o.put("type", type);

            if (key1 != null) {
                o.put(key1, value1);
            }

            if (key2 != null) {
                o.put(key2, value2);
            }

            PlayerWeb.syncToPage(o);
        } catch (Exception e) {
            // Left out
        }
    }

    // The sharing player's state to post. Only the latest counts: one still
    // waiting is replaced, and one post runs at a time
    static void lead(String url, String room, String key, String json) {

        Relay r = parse(url);

        if (r == null || !roomOk(room) || key == null || key.length() < 16 || json == null) {

            tell("lead", "ok", false, "error", "The address, the room or the key is not right");
            return;
        }

        synchronized (LEAD_LOCK) {

            leadRelay = r;
            leadRoom = room;
            leadKey = key;
            leadState = json;

            if (leadBusy) {
                return;
            }

            leadBusy = true;
        }

        LEAD.execute(Sync::leadRun);
    }

    private static void leadRun() {

        while (true) {

            Relay r;
            String room;
            String key;
            String json;

            synchronized (LEAD_LOCK) {

                if (leadState == null) {

                    leadBusy = false;
                    return;
                }

                r = leadRelay;
                room = leadRoom;
                key = leadKey;
                json = leadState;
                leadState = null;
            }

            clockCheck(r, 5);

            try {

                // The time the state was made, also on the relay's clock
                JSONObject state = new JSONObject(json);
                long[] c = clock();

                if (c != null && state.has("at")) {
                    state.put("relayAt", state.getLong("at") + c[0]);
                }

                byte[] body = state.toString().getBytes(StandardCharsets.UTF_8);
                long sent = System.currentTimeMillis();
                Answer a = exchange(r, "POST", "/room/" + room, key, body);
                long back = System.currentTimeMillis();
                JSONObject answer = new JSONObject(a.body.isEmpty() ? "{}" : a.body);

                if (a.status == 200) {

                    clockSample(sent, back, answer.optLong("t", 0));
                    tell("lead", "ok", true, "listeners", answer.optInt("listeners", 0));
                } else {
                    tell("lead", "ok", false, "error", answer.optString("error", "HTTP " + a.status));
                }
            } catch (Exception e) {
                tell("lead", "ok", false, "error", "The relay could not be reached");
            }
        }
    }

    // Sharing stopped: the room closes and the listeners hear it
    static void leadStop(String url, String room, String key) {

        Relay r = parse(url);

        synchronized (LEAD_LOCK) {
            leadState = null;
        }

        if (r == null || !roomOk(room) || key == null) {
            return;
        }

        LEAD.execute(() -> {

            try {
                exchange(r, "DELETE", "/room/" + room, key, null);
            } catch (Exception e) {
                // The room closes by itself when nothing comes
            }
        });
    }

    // The rooms open on the relay, for picking one to listen along with
    static void rooms(String url) {

        Relay r = parse(url);

        if (r == null) {

            tell("rooms", "ok", false, "error", "The relay's address is not right");
            return;
        }

        ASK.execute(() -> {

            try {

                Answer a = exchange(r, "GET", "/rooms", null, null);

                if (a.status != 200) {

                    tell("rooms", "ok", false, "error", "HTTP " + a.status);
                    return;
                }

                tell("rooms", "ok", true, "data", new JSONObject(a.body));
            } catch (Exception e) {
                tell("rooms", "ok", false, "error", "The relay could not be reached");
            }
        });
    }

    // Listening along with a room, until stopped or the room ends. A lost
    // connection is tried again, after longer and longer pauses
    static void follow(String url, String room) {

        Relay r = parse(url);

        followStop();

        if (r == null || !roomOk(room)) {

            tell("follow", "status", "error", "error", "The address or the room is not right");
            return;
        }

        int gen = followGen;
        Thread t = new Thread(() -> followRun(r, room, gen), "sync-follow");

        t.setDaemon(true);
        t.start();
    }

    static void followStop() {

        followGen += 1;

        Socket s = followSocket;

        followSocket = null;

        if (s != null) {

            try {
                s.close();
            } catch (IOException e) {
                // Closed already
            }
        }
    }

    private static void followRun(Relay r, String room, int gen) {

        long pause = 2000;

        while (gen == followGen) {

            clockCheck(r, 5);
            tell("follow", "status", "connecting", null, null);

            String ended = followOnce(r, room, gen);

            if (gen != followGen) {
                return;
            }

            if (ended != null) {

                tell("follow", "status", ended, null, null);
                return;
            }

            tell("follow", "status", "lost", null, null);
            Io.sleep(pause);
            pause = Math.min(15000, pause * 2);
        }
    }

    // One connection to the room's stream. Answers why listening ended for
    // good, "end" or "gone", or null for a connection lost
    private static String followOnce(Relay r, String room, int gen) {

        Socket s = null;

        try {

            s = open(r, STREAM_READ_MS);
            followSocket = s;

            if (gen != followGen) {
                return null;
            }

            sendRequest(s.getOutputStream(), r, "GET", "/room/" + room + "/events", null, null);

            InputStream in = s.getInputStream();
            int status = readHead(in);

            if (status == 404) {
                return "gone";
            }

            if (status != 200) {
                return null;
            }

            tell("follow", "status", "listening", null, null);

            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
            String kind = "";
            StringBuilder data = new StringBuilder();
            String line;

            while ((line = reader.readLine()) != null && gen == followGen) {

                if (line.isEmpty()) {

                    if (data.length() > 0) {

                        if ("end".equals(kind)) {
                            return "end";
                        }

                        if ("state".equals(kind)) {
                            followEvent(data.toString());
                        }
                    }

                    kind = "";
                    data.setLength(0);
                    continue;
                }

                if (line.startsWith(":")) {

                    // Now and then, the clock looked at again between events
                    clockCheck(r, 3);
                    continue;
                }

                if (line.startsWith("event:")) {
                    kind = line.substring(6).trim();
                } else if (line.startsWith("data:")) {

                    if (data.length() + line.length() > ANSWER_MAX) {
                        return null;
                    }

                    data.append(line.substring(5).trim());
                }
            }

            return null;
        } catch (Exception e) {
            return null;
        } finally {

            if (s != null) {

                try {
                    s.close();
                } catch (IOException e) {
                    // Closed already
                }
            }

            if (followSocket == s) {
                followSocket = null;
            }
        }
    }

    // A state event to the page, as JSON read here, so only data reaches
    // the page, along with the clock
    private static void followEvent(String data) {

        try {

            JSONObject o = new JSONObject();
            long[] c = clock();

            o.put("type", "state");
            o.put("data", new JSONObject(data));
            o.put("offset", c != null ? c[0] : 0);
            o.put("clock", c != null);
            PlayerWeb.syncToPage(o);
        } catch (Exception e) {
            // Not a state
        }
    }
}
