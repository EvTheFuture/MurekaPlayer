/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, answers to murekaplayer.local on the local network
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

import java.io.IOException;
import java.net.DatagramPacket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.MulticastSocket;
import java.net.NetworkInterface;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.List;

// A very small multicast DNS responder, so a laptop or a tablet can open the
// page by name instead of by an address the hotspot picks anew every time.
// Tesla's browser does not look up local names, it uses the fixed VPN
// address instead. It answers questions for one name, murekaplayer.local
// unless changed, with the phone's address on the network the question came
// from, and announces itself now and then. Plain Java on purpose, no Android
// classes, so it can be tested off device
final class MdnsResponder {

    private static final String GROUP = "224.0.0.251";
    private static final int PORT = 5353;

    // How long the answer may be cached, in seconds. Short, since a hotspot
    // hands out a new address every time it is switched on
    private static final int TTL = 120;

    private static final int TYPE_A = 1;
    private static final int TYPE_ANY = 255;
    private static final int CLASS_IN = 1;

    // The top bit of the class in a question asks for a unicast answer, and
    // the same bit in an answer is the cache flush bit
    private static final int UNICAST = 0x8000;
    private static final int FLUSH = 0x8000;

    private final String name;
    private final List<String> labels = new ArrayList<>();

    private volatile MulticastSocket socket;
    private volatile boolean running = false;

    // What the responder is doing, shown in the settings panel. A port
    // already taken by Android's own responder shows up here
    private volatile String status = "starting";
    private Thread thread;

    MdnsResponder(String name) {

        this.name = name.toLowerCase();

        for (String part : this.name.split("\\.")) {

            if (!part.isEmpty()) {
                labels.add(part);
            }
        }
    }

    String name() {
        return name;
    }

    boolean isRunning() {
        return running;
    }

    String status() {
        return status;
    }

    void start() {

        if (running) {
            return;
        }

        running = true;
        thread = new Thread(this::loop, "mdns");
        thread.setDaemon(true);
        thread.start();
    }

    void stop() {

        running = false;
        status = "stopped";

        MulticastSocket s = socket;

        if (s != null) {
            s.close();
        }
    }

    private void loop() {

        while (running) {

            try {
                serve();
            } catch (IOException e) {

                // The network came or went, or the port is taken, wait and
                // set up again
                if (running) {
                    status = "not answering, " + e.getMessage() + ", trying again";
                }

                sleep(5000);
            }
        }
    }

    private void serve() throws IOException {

        MulticastSocket s = new MulticastSocket(null);

        try {

            s.setReuseAddress(true);
            s.bind(new InetSocketAddress(PORT));
            s.setTimeToLive(255);
            s.setSoTimeout(30000);
            socket = s;

            joinAll(s);
            announce(s);
            status = "answering as " + name;

            byte[] buf = new byte[4096];
            long lastJoin = System.currentTimeMillis();

            while (running) {

                DatagramPacket packet = new DatagramPacket(buf, buf.length);

                try {
                    s.receive(packet);
                } catch (SocketTimeoutException e) {

                    // Nothing asked for a while. New interfaces may have
                    // appeared, the hotspot for one, so join again
                    joinAll(s);
                    announce(s);
                    lastJoin = System.currentTimeMillis();
                    continue;
                }

                answer(s, packet);

                // Membership on a hotspot interface that appeared after the
                // socket was made is only picked up by joining again
                if (System.currentTimeMillis() - lastJoin > 30000) {

                    joinAll(s);
                    lastJoin = System.currentTimeMillis();
                }
            }
        } finally {

            socket = null;
            s.close();
        }
    }

    // Join the multicast group on every interface that can carry it
    private void joinAll(MulticastSocket s) {

        InetSocketAddress group = new InetSocketAddress(GROUP, PORT);

        for (NetworkInterface ni : usableInterfaces()) {

            try {
                s.joinGroup(group, ni);
            } catch (IOException e) {
                // Already joined, or this one will not carry multicast
            }
        }
    }

    // Say who we are without being asked, which fills in caches and covers
    // the moment the hotspot comes up
    private void announce(MulticastSocket s) {

        for (NetworkInterface ni : usableInterfaces()) {

            for (InetAddress address : addressesOf(ni)) {

                byte[] response = buildResponse(new InetAddress[] { address });

                try {

                    s.setNetworkInterface(ni);
                    s.send(new DatagramPacket(response, response.length,
                        InetAddress.getByName(GROUP), PORT));
                } catch (IOException e) {
                    // This interface cannot send right now
                }
            }
        }
    }

    // Answer a question for our name, with the address the asker can reach
    private void answer(MulticastSocket s, DatagramPacket packet) {

        Question q = parse(packet.getData(), packet.getLength());

        if (q == null) {
            return;
        }

        InetAddress best = addressFor(packet.getAddress());

        if (best == null) {
            return;
        }

        byte[] response = buildResponse(new InetAddress[] { best });

        try {

            if (q.unicast) {
                s.send(new DatagramPacket(response, response.length, packet.getAddress(), packet.getPort()));
            } else {

                // A group answer has to leave on the network the question
                // came from, not on whichever one Android would pick
                NetworkInterface ni = interfaceFor(packet.getAddress());

                if (ni != null) {
                    s.setNetworkInterface(ni);
                }

                s.send(new DatagramPacket(response, response.length, InetAddress.getByName(GROUP), PORT));
            }
        } catch (IOException e) {
            // The asker is gone already
        }
    }

    // Our address on the same network as whoever asked, so a phone with both
    // a hotspot and Wi-Fi answers with the right one
    InetAddress addressFor(InetAddress asker) {

        InetAddress fallback = null;

        for (NetworkInterface ni : usableInterfaces()) {

            for (InterfaceAddress ia : ni.getInterfaceAddresses()) {

                if (!(ia.getAddress() instanceof Inet4Address)) {
                    continue;
                }

                if (fallback == null) {
                    fallback = ia.getAddress();
                }

                if (asker != null && sameNetwork(ia, asker)) {
                    return ia.getAddress();
                }
            }
        }

        return fallback;
    }

    // The interface on the same network as whoever asked
    private static NetworkInterface interfaceFor(InetAddress asker) {

        if (asker == null) {
            return null;
        }

        for (NetworkInterface ni : usableInterfaces()) {

            for (InterfaceAddress ia : ni.getInterfaceAddresses()) {

                if (ia.getAddress() instanceof Inet4Address && sameNetwork(ia, asker)) {
                    return ni;
                }
            }
        }

        return null;
    }

    private static boolean sameNetwork(InterfaceAddress ia, InetAddress other) {

        byte[] mine = ia.getAddress().getAddress();
        byte[] theirs = other.getAddress();

        if (mine.length != 4 || theirs.length != 4) {
            return false;
        }

        int bits = ia.getNetworkPrefixLength();

        for (int i = 0; i < 32; i++) {

            if (i >= bits) {
                return true;
            }

            int mask = 1 << (7 - (i % 8));

            if ((mine[i / 8] & mask) != (theirs[i / 8] & mask)) {
                return false;
            }
        }

        return true;
    }

    private static List<NetworkInterface> usableInterfaces() {

        List<NetworkInterface> out = new ArrayList<>();

        try {

            Enumeration<NetworkInterface> all = NetworkInterface.getNetworkInterfaces();

            if (all == null) {
                return out;
            }

            for (NetworkInterface ni : Collections.list(all)) {

                String name = ni.getName() == null ? "" : ni.getName();

                if (!ni.isUp() || ni.isLoopback() || name.startsWith("rmnet") || name.startsWith("ccmni")
                    || name.startsWith("v4-") || name.startsWith("clat") || name.startsWith("tun")
                    || name.startsWith("dummy")) {

                    continue;
                }

                if (!addressesOf(ni).isEmpty()) {
                    out.add(ni);
                }
            }
        } catch (IOException e) {
            // No interfaces to list
        }

        return out;
    }

    // Every ordinary IPv4 address on this interface. Anything a screen or a
    // laptop on the same network could reach us at
    private static List<InetAddress> addressesOf(NetworkInterface ni) {

        List<InetAddress> out = new ArrayList<>();

        for (InterfaceAddress ia : ni.getInterfaceAddresses()) {

            InetAddress a = ia.getAddress();

            if (a instanceof Inet4Address && !a.isLoopbackAddress() && !a.isLinkLocalAddress()) {
                out.add(a);
            }
        }

        return out;
    }

    private static void sleep(long ms) {

        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    // What a question asked for, once it turned out to be about our name
    private static final class Question {
        boolean unicast;
    }

    // Read a query and say whether it asks for our name. Anything else, and
    // any answer packet, is ignored
    Question parse(byte[] data, int length) {

        if (length < 12) {
            return null;
        }

        int flags = ((data[2] & 0xff) << 8) | (data[3] & 0xff);

        // Only queries, and only the standard kind
        if ((flags & 0x8000) != 0 || ((flags >> 11) & 0x0f) != 0) {
            return null;
        }

        int questions = ((data[4] & 0xff) << 8) | (data[5] & 0xff);
        int pos = 12;

        for (int i = 0; i < questions; i++) {

            StringBuilder asked = new StringBuilder();

            while (pos < length) {

                int len = data[pos] & 0xff;

                pos += 1;

                if (len == 0) {
                    break;
                }

                // A pointer, which a question should not use. Give up
                if ((len & 0xc0) != 0) {
                    return null;
                }

                if (pos + len > length) {
                    return null;
                }

                if (asked.length() > 0) {
                    asked.append('.');
                }

                asked.append(new String(data, pos, len, java.nio.charset.StandardCharsets.UTF_8));
                pos += len;
            }

            if (pos + 4 > length) {
                return null;
            }

            int type = ((data[pos] & 0xff) << 8) | (data[pos + 1] & 0xff);
            int klass = ((data[pos + 2] & 0xff) << 8) | (data[pos + 3] & 0xff);

            pos += 4;

            boolean mine = asked.toString().equalsIgnoreCase(name);
            boolean wanted = type == TYPE_A || type == TYPE_ANY;

            if (mine && wanted && (klass & 0x7fff) == CLASS_IN) {

                Question q = new Question();

                q.unicast = (klass & UNICAST) != 0;

                return q;
            }
        }

        return null;
    }

    // One answer packet with an A record per address
    byte[] buildResponse(InetAddress[] addresses) {

        List<Byte> out = new ArrayList<>();

        // No transaction id, a response, authoritative
        putShort(out, 0);
        putShort(out, 0x8400);
        putShort(out, 0);
        putShort(out, addresses.length);
        putShort(out, 0);
        putShort(out, 0);

        for (InetAddress address : addresses) {

            for (String label : labels) {

                byte[] raw = label.getBytes(java.nio.charset.StandardCharsets.UTF_8);

                out.add((byte) raw.length);

                for (byte b : raw) {
                    out.add(b);
                }
            }

            out.add((byte) 0);
            putShort(out, TYPE_A);
            putShort(out, CLASS_IN | FLUSH);
            putShort(out, TTL >> 16);
            putShort(out, TTL & 0xffff);
            putShort(out, 4);

            for (byte b : address.getAddress()) {
                out.add(b);
            }
        }

        byte[] packet = new byte[out.size()];

        for (int i = 0; i < packet.length; i++) {
            packet[i] = out.get(i);
        }

        return packet;
    }

    private static void putShort(List<Byte> out, int value) {

        out.add((byte) ((value >> 8) & 0xff));
        out.add((byte) (value & 0xff));
    }
}
