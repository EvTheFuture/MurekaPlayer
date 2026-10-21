/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, handing over between the public address and WireGuard
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
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

// Android runs one VPN at a time, so the public address and a WireGuard
// tunnel cannot be up together. Starting the public address already makes
// Android take WireGuard down. Bringing it back is asked of the WireGuard
// app, which takes a tunnel up or down by its name when another app asks.
// That needs WireGuard's "Allow remote control apps" switched on, under its
// advanced settings, and this app given the permission to control tunnels
final class WireGuard {

    static final String PACKAGE = "com.wireguard.android";
    static final String PERMISSION = PACKAGE + ".permission.CONTROL_TUNNELS";

    private static final String UP = PACKAGE + ".action.SET_TUNNEL_UP";
    private static final String DOWN = PACKAGE + ".action.SET_TUNNEL_DOWN";
    private static final String TUNNEL = "tunnel";

    // The hand over goes one step at a time: the VPN going away is waited
    // for, looking every so often, up to a limit, and a moment more is
    // given after it is gone before the other one is asked for. Then the
    // time WireGuard gets to bring its tunnel up before it is looked for
    private static final long POLL_MS = 300;
    private static final long GONE_LIMIT_MS = 10000;
    private static final long SETTLE_MS = 1000;
    private static final long CHECK_MS = 8000;

    // While VPNs change hands the internet drops for a moment. The player
    // keeps quiet about it for this long
    private static final long QUIET_MS = 25000;

    // A hand over under way, so a second request while it runs is not
    // started on top of it
    private static volatile boolean downBusy = false;

    // The phone kept awake for a hand over. With the screen off the CPU
    // sleeps, and the waits between the steps, here and in WireGuard,
    // stood still until the screen came on again. Let go when the hand
    // over is done, or after the longest one can take
    private static final long AWAKE_MS = 90000;
    private static PowerManager.WakeLock awake;

    private static void stayAwake(Context c) {

        try {

            if (awake == null) {

                PowerManager pm = c.getSystemService(PowerManager.class);

                if (pm == null) {
                    return;
                }

                awake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MurekaPlayer:wireguard");
                awake.setReferenceCounted(false);
            }

            awake.acquire(AWAKE_MS);
        } catch (RuntimeException e) {
            // Without it the hand over still happens, once the phone wakes
        }
    }

    // The screen on for a moment while WireGuard is asked anything. With
    // the screen off Android can freeze WireGuard in the background as
    // soon as it has taken a command in, and it then carries the command
    // out only once something wakes it again, the next command or the
    // screen. A turn on done at the next turn off and the other way round
    // looks like the hand over working the wrong way round
    private static final long SCREEN_MS = 15000;

    @SuppressWarnings("deprecation")
    private static void wakeScreen(Context c) {

        try {

            PowerManager pm = c.getSystemService(PowerManager.class);

            if (pm == null || pm.isInteractive()) {
                return;
            }

            PowerManager.WakeLock screen = pm.newWakeLock(PowerManager.SCREEN_DIM_WAKE_LOCK
                | PowerManager.ACQUIRE_CAUSES_WAKEUP, "MurekaPlayer:wireguard-screen");

            screen.setReferenceCounted(false);
            screen.acquire(SCREEN_MS);
            Hub.note("WireGuard", "the screen is turned on while WireGuard is asked");
        } catch (RuntimeException e) {
            Hub.note("WireGuard", "the screen could not be turned on: " + e.getMessage());
        }
    }

    private static void letSleep() {

        try {

            if (awake != null && awake.isHeld()) {
                awake.release();
            }
        } catch (RuntimeException e) {
            // Let go by its time limit anyway
        }
    }

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    // The phone kept awake while WireGuard holds the tunnel, when switched
    // on. Asleep, the processor stops and WireGuard's keepalives with it,
    // the mobile network then forgets the phone after a minute or two and
    // nothing from the tunnel reaches it until it wakes. Held for a while
    // at a time and looked at again before that runs out, on a handler of
    // its own, since the hand over clears all of MAIN's
    private static final long REACH_HOLD_MS = 15 * 60 * 1000L;
    private static final long REACH_LOOK_MS = 5 * 60 * 1000L;
    private static final Handler REACH = new Handler(Looper.getMainLooper());
    private static PowerManager.WakeLock reach;

    // Holds or lets go as things stand now. Main thread only. A host to
    // ping keeps the phone awake too, a sleeping phone would not ping
    static void keepReachable(Context c) {

        final Context app = c.getApplicationContext();
        String awakeFor = WebViewSettings.wgPingAwake(app);
        boolean pinging = !WebViewSettings.wgPingHost(app).isEmpty()
            && (WebViewSettings.PING_AWAKE_ALWAYS.equals(awakeFor)
            || WebViewSettings.PING_AWAKE_CHARGER.equals(awakeFor) && onCharger(app));
        boolean want = (pinging || WebViewSettings.wgKeepAwake(app) && !WebViewSettings.wgTunnel(app).isEmpty())
            && tunnelUp(app);

        pingLoop(app);
        boolean held = reach != null && reach.isHeld();

        REACH.removeCallbacksAndMessages(null);

        try {

            if (want) {

                if (reach == null) {

                    PowerManager pm = app.getSystemService(PowerManager.class);

                    if (pm == null) {
                        return;
                    }

                    reach = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MurekaPlayer:wireguard-reach");
                    reach.setReferenceCounted(false);
                }

                reach.acquire(REACH_HOLD_MS);

                if (!held) {
                    Hub.note("WireGuard", "keeping the phone awake, so the tunnel stays reachable");
                }

                REACH.postDelayed(() -> keepReachable(app), REACH_LOOK_MS);
            } else if (held) {

                reach.release();
                Hub.note("WireGuard", "the phone may sleep again, the tunnel is not WireGuard's now or the switch is off");
            }
        } catch (RuntimeException e) {
            Hub.note("WireGuard", "could not keep the phone awake: " + e.getMessage());
        }
    }

    // The pings through the tunnel, on a thread of their own since each
    // one waits for its answer. Started once, it looks again at every
    // round whether there is a host and the tunnel is WireGuard's, and
    // says in the debug log when the answers stop or come back
    private static android.os.HandlerThread pingThread;
    private static Handler pingHandler;
    private static volatile boolean pingOk = true;
    private static volatile int pingMisses = 0;
    private static volatile boolean pingUp = false;
    private static volatile boolean pingNone = true;
    private static volatile boolean pingPlugged = false;
    private static final int PING_WAIT_S = 3;

    // Whether the phone is on a charger now, from the battery's last word
    static boolean onCharger(Context c) {

        try {

            android.content.Intent b = c.registerReceiver(null,
                new android.content.IntentFilter(android.content.Intent.ACTION_BATTERY_CHANGED));

            return b != null && b.getIntExtra(android.os.BatteryManager.EXTRA_PLUGGED, 0) != 0;
        } catch (RuntimeException e) {
            return false;
        }
    }

    // Every ping of the last hour: when, answered or not, and how long the
    // answer took in tenths of a millisecond, for the figures in the settings
    private static final long PING_KEEP_MS = 60 * 60 * 1000L;
    private static final java.util.ArrayDeque<long[]> PINGS = new java.util.ArrayDeque<>();
    private static volatile String pingHost = "";
    private static volatile boolean pinging = false;

    private static void notePing(boolean ok, long tenthsMs) {

        long now = System.currentTimeMillis();

        synchronized (PINGS) {

            PINGS.addLast(new long[] { now, ok ? 1 : 0, tenthsMs });

            while (!PINGS.isEmpty() && now - PINGS.peekFirst()[0] > PING_KEEP_MS) {
                PINGS.removeFirst();
            }
        }
    }

    // The figures started over, asked for from the settings
    static void resetPingStats() {

        synchronized (PINGS) {
            PINGS.clear();
        }

        pingMisses = 0;
        pingOk = true;
        Hub.note("WireGuard", "the ping figures were started over");
    }

    // The pings in figures for the settings: whether they run, the last
    // answer, and the loss and the time of the answers over the last five
    // minutes and the last hour
    static String pingStats() {

        JSONObject o = new JSONObject();
        long now = System.currentTimeMillis();

        try {

            o.put("host", pingHost);
            o.put("on", pinging);
            o.put("misses", pingMisses);

            synchronized (PINGS) {

                long[] last = PINGS.peekLast();

                if (last != null) {

                    o.put("lastAgo", (now - last[0]) / 1000);
                    o.put("lastOk", last[1] == 1);
                    o.put("lastMs", last[2] / 10.0);
                }

                long lastOk = 0;

                for (long[] p : PINGS) {

                    if (p[1] == 1) {
                        lastOk = p[0];
                    }
                }

                o.put("okAgo", lastOk > 0 ? (now - lastOk) / 1000 : -1);

                for (long span : new long[] { 5, 60 }) {

                    int sent = 0;
                    int got = 0;
                    long ms = 0;

                    for (long[] p : PINGS) {

                        if (now - p[0] <= span * 60000L) {

                            sent += 1;

                            if (p[1] == 1) {

                                got += 1;
                                ms += p[2];
                            }
                        }
                    }

                    JSONObject w = new JSONObject();

                    w.put("sent", sent);
                    w.put("lost", sent - got);
                    w.put("avgMs", got > 0 ? Math.round(ms / (double) got) / 10.0 : -1);
                    o.put("m" + span, w);
                }
            }
        } catch (JSONException e) {
            // Left as far as it got
        }

        return o.toString();
    }

    private static synchronized void pingLoop(Context app) {

        if (pingHandler != null) {
            return;
        }

        pingThread = new android.os.HandlerThread("wireguard-ping");
        pingThread.start();
        pingHandler = new Handler(pingThread.getLooper());
        pingHandler.post(new Runnable() {

            @Override
            public void run() {

                String host = WebViewSettings.wgPingHost(app);
                boolean up = tunnelUp(app);

                // The tunnel came or went by itself, WireGuard switched by
                // hand say: the phone is kept awake for it, or let sleep
                boolean plugged = onCharger(app);

                if (up != pingUp || host.isEmpty() != pingNone || plugged != pingPlugged) {

                    pingUp = up;
                    pingNone = host.isEmpty();
                    pingPlugged = plugged;
                    MAIN.post(() -> keepReachable(app));
                }

                // A new host starts its figures afresh
                if (!host.equals(pingHost)) {

                    pingHost = host;

                    synchronized (PINGS) {
                        PINGS.clear();
                    }
                }

                pinging = !host.isEmpty() && up;

                if (pinging) {
                    pingOnce(host);
                } else {

                    pingOk = true;
                    pingMisses = 0;
                }

                pingHandler.postDelayed(this, WebViewSettings.wgPingSeconds(app) * 1000L);
            }
        });
    }

    // One ping with Android's own ping command, which an app may use, and
    // a small packet to the discard port beside it, so something goes
    // through the tunnel even where the ping command is missing
    private static void pingOnce(String host) {

        boolean ok = false;
        long tenths = 0;
        Process p = null;

        try {

            p = new ProcessBuilder("/system/bin/ping", "-c", "1", "-W", String.valueOf(PING_WAIT_S), host)
                .redirectErrorStream(true).start();

            if (p.waitFor(PING_WAIT_S + 2, java.util.concurrent.TimeUnit.SECONDS)) {

                ok = p.exitValue() == 0;

                // How long the answer took, from the "time=12.3 ms" it prints
                byte[] out = new byte[4096];
                int n = p.getInputStream().read(out);
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("time=([0-9.]+) ?ms")
                    .matcher(n > 0 ? new String(out, 0, n, java.nio.charset.StandardCharsets.US_ASCII) : "");

                if (m.find()) {
                    tenths = Math.round(Double.parseDouble(m.group(1)) * 10);
                }
            }
        } catch (java.io.IOException | NumberFormatException e) {
            // No ping command, the packet below still goes
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {

            if (p != null) {
                p.destroy();
            }
        }

        try (java.net.DatagramSocket s = new java.net.DatagramSocket()) {

            byte[] b = new byte[] { 0 };

            s.send(new java.net.DatagramPacket(b, b.length, java.net.InetAddress.getByName(host), 9));
        } catch (java.io.IOException | RuntimeException e) {
            // A name that does not resolve, said with the ping's answer
        }

        notePing(ok, tenths);

        if (ok) {

            if (!pingOk) {
                Hub.note("WireGuard", "the pinged host " + host + " answers again after " + pingMisses + " missed");
            }

            pingOk = true;
            pingMisses = 0;
        } else {

            pingMisses += 1;

            if (pingOk) {
                Hub.note("WireGuard", "no answer from the pinged host " + host + " through the tunnel");
            }

            pingOk = false;
        }
    }

    // What was last asked of WireGuard, for the settings
    private static volatile String last = "";

    private WireGuard() {
    }

    static String last() {
        return last;
    }

    static boolean installed(Context c) {

        try {

            c.getPackageManager().getPackageInfo(PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    static boolean allowed(Context c) {
        return c.checkSelfPermission(PERMISSION) == PackageManager.PERMISSION_GRANTED;
    }

    // Whether Android leaves WireGuard out of its battery saving. Without
    // that, a WireGuard asleep in the background is not let start its
    // tunnel when asked, which can work once, while it was used a moment
    // ago, and not the next time
    static boolean unrestricted(Context c) {

        PowerManager pm = c.getSystemService(PowerManager.class);

        try {
            return pm == null || pm.isIgnoringBatteryOptimizations(PACKAGE);
        } catch (RuntimeException e) {
            return true;
        }
    }

    // How it stands, for the settings: not used, not installed, needs the
    // permission, held back by battery saving, or ready
    static String status(Context c) {

        String tunnel = WebViewSettings.wgTunnel(c);

        if (tunnel.isEmpty()) {
            return "off";
        }

        if (!installed(c)) {
            return "not installed";
        }

        if (!allowed(c)) {
            return "needs permission";
        }

        if (!unrestricted(c)) {
            return "battery restricted";
        }

        return "ready";
    }

    // The tunnel down before the public address comes up. WireGuard is
    // asked, its VPN going away is waited for, and only then does the
    // public address start, so the two never fight over Android's one VPN.
    // Without a tunnel to hand over it starts at once
    static void downThen(Context c, Runnable then) {

        final Context app = c.getApplicationContext();

        if (!usable(app)) {

            then.run();
            return;
        }

        if (downBusy) {
            return;
        }

        downBusy = true;
        MAIN.removeCallbacksAndMessages(null);
        stayAwake(app);
        wakeScreen(app);
        quiet();
        say(app, "Turning WireGuard off", "wait");
        send(app, false);
        whenNoVpn(app, () -> {

            downBusy = false;

            // Android takes it from WireGuard anyway when the public
            // address comes, so it goes on either way
            if (vpnUp(app)) {
                tell(app, "WireGuard did not turn off, the public address takes over", false);
            } else {
                tell(app, "WireGuard is off", true);
            }

            then.run();

            // A moment for the public address to come up before sleeping
            MAIN.postDelayed(WireGuard::letSleep, 5000);
        });
    }

    // The tunnel up again once the public address is gone, really gone and
    // a moment after
    static void upSoon(Context c) {

        final Context app = c.getApplicationContext();

        if (WebViewSettings.wgTunnel(app).isEmpty()) {
            return;
        }

        // A hand over asked for again replaces one still waiting
        MAIN.removeCallbacksAndMessages(null);
        downBusy = false;
        stayAwake(app);
        wakeScreen(app);
        quiet();
        say(app, "Turning WireGuard on", "wait");
        whenNoVpn(app, () -> resetThenUp(app, 0));
    }

    // Up, with the screen on again for a retry
    private static void resetThenUp(Context c, int tried) {

        if (tried > 0) {
            wakeScreen(c);
        }

        send(c, true, tried);
    }

    // Turning the tunnel on or off by hand from the settings, to try the
    // hand over without moving the hotspot. The same commands, the same
    // look afterwards and the same notes
    static void test(Context c, boolean up) {

        final Context app = c.getApplicationContext();

        if (WebViewSettings.wgTunnel(app).isEmpty()) {

            tell(app, "Type the WireGuard tunnel's name first", false);
            return;
        }

        MAIN.removeCallbacksAndMessages(null);
        downBusy = false;
        stayAwake(app);
        wakeScreen(app);
        quiet();

        if (up) {

            say(app, "Turning WireGuard on", "wait");
            send(app, true, 0);
            REACH.postDelayed(() -> keepReachable(app), CHECK_MS);
            return;
        }

        say(app, "Turning WireGuard off", "wait");
        send(app, false);
        MAIN.postDelayed(() -> {

            letSleep();
            keepReachable(app);

            if (vpnUp(app)) {
                tell(app, "WireGuard did not turn off", false);
            } else {
                tell(app, "WireGuard is off", true);
            }
        }, CHECK_MS);
    }

    // A tunnel named and WireGuard there to take it, with the permission
    private static boolean usable(Context c) {
        return !WebViewSettings.wgTunnel(c).isEmpty() && installed(c) && allowed(c);
    }

    // Run once no VPN is up any more, or after the limit whatever, a
    // moment after that
    private static void whenNoVpn(Context c, Runnable then) {

        final long until = System.currentTimeMillis() + GONE_LIMIT_MS;

        final Runnable look = new Runnable() {
            @Override
            public void run() {

                if (vpnUp(c) && System.currentTimeMillis() < until) {

                    MAIN.postDelayed(this, POLL_MS);
                    return;
                }

                if (vpnUp(c)) {
                    Hub.note("WireGuard", "a VPN is still up after " + (GONE_LIMIT_MS / 1000) + " s, going on anyway");
                }

                MAIN.postDelayed(then, SETTLE_MS);
            }
        };

        MAIN.postDelayed(look, POLL_MS);
    }

    // The player keeps quiet about the internet coming and going meanwhile
    static void quiet() {
        Hub.command("netQuiet", QUIET_MS);
    }

    // How many more times turning the tunnel on is asked for when no VPN
    // came up. WireGuard may be held back by Android a moment after the
    // public address went, or while it is asleep in the background
    private static final int RETRIES = 2;

    private static void send(final Context c, boolean up) {
        send(c, up, 0);
    }

    private static void send(final Context c, boolean up, final int tried) {

        final String tunnel = WebViewSettings.wgTunnel(c);

        // No tunnel named, nothing to do and nothing to say
        if (tunnel.isEmpty()) {
            return;
        }

        // Taking it down needs no help, Android does that anyway when the
        // public address comes, so only a missing way back is said
        if (!up && (!installed(c) || !allowed(c))) {
            return;
        }

        // Said every time, a hand over that does not happen must say why
        if (!installed(c)) {

            tell(c, "WireGuard is not installed, " + tunnel + " was not turned " + (up ? "on" : "off"), false);
            return;
        }

        if (!allowed(c)) {

            tell(c, "WireGuard not turned " + (up ? "on" : "off")
                + ", the app may not control its tunnels, type the tunnel's name again in the settings to be asked", false);
            return;
        }

        // Android refuses WireGuard's VPN service from the background
        // unless its battery use is Unrestricted, so asking again would
        // not help. Asked once all the same, in case it is in front
        boolean held = up && !unrestricted(c);

        if (held && tried > 0) {
            return;
        }

        try {

            Intent i = new Intent(up ? UP : DOWN);

            // Reaches WireGuard after a force stop too, and is handled at
            // once rather than queued with the background broadcasts
            i.setPackage(PACKAGE);
            i.putExtra(TUNNEL, tunnel);
            i.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES | Intent.FLAG_RECEIVER_FOREGROUND);
            c.sendBroadcast(i);
            last = (up ? "asked to turn on " : "asked to turn off ") + tunnel;
            Hub.note("WireGuard", last);
        } catch (RuntimeException e) {

            tell(c, "Could not ask WireGuard: " + e.getMessage(), false);
            return;
        }

        if (!up) {
            return;
        }

        // WireGuard says nothing back, so whether a VPN came up is looked
        // at a little later. Not yet, it is asked again, and only after the
        // last try is it said that it did not work
        MAIN.postDelayed(() -> {

            // The public address came back meanwhile, the hotspot is on again
            if (CarVpn.activeAddress() != null) {
                return;
            }

            if (vpnUp(c)) {

                tell(c, "WireGuard turned " + tunnel + " on" + (tried > 0 ? ", on try " + (tried + 1) : ""), true);
                letSleep();
                keepReachable(c);
                return;
            }

            if (held) {

                letSleep();
                tell(c, "WireGuard did not turn " + tunnel + " on, Android does not let it start in the background."
                    + " Set WireGuard's battery use to Unrestricted, under Connections", false);
                return;
            }

            if (tried < RETRIES) {

                Hub.note("WireGuard", "no VPN up after try " + (tried + 1) + ", asking again");
                resetThenUp(c, tried + 1);
                return;
            }

            letSleep();
            tell(c, "WireGuard did not turn " + tunnel + " on after " + (tried + 1) + " tries. Check that Allow"
                + " remote control apps is on in WireGuard, that the name is the same as there, and that"
                + " WireGuard's battery use is Unrestricted, so Android lets it start in the background", false);
        }, CHECK_MS);
    }

    // Whether any VPN is up, WireGuard's when the public address is not
    // Whether WireGuard's tunnel is up, as near as the app can tell.
    // Android does not say whose a VPN is, but it runs one at a time, so
    // a VPN up while the public address is not is taken to be WireGuard's
    static boolean tunnelUp(Context c) {
        return installed(c) && CarVpn.activeAddress() == null && vpnUp(c);
    }

    private static boolean vpnUp(Context c) {

        ConnectivityManager cm = c.getSystemService(ConnectivityManager.class);

        if (cm == null) {
            return false;
        }

        for (Network n : cm.getAllNetworks()) {

            NetworkCapabilities caps = cm.getNetworkCapabilities(n);

            if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                return true;
            }
        }

        return false;
    }

    // Into the debug log, the settings and the player's own note, which
    // the web views show too
    static void tell(Context c, String text, boolean ok) {
        say(c, text, ok ? "ok" : "bad");
    }

    // The same with the look of the note: done, failed, or under way, which
    // stays until the next note takes its place
    private static void say(Context c, String text, String kind) {

        last = text;
        Hub.note("WireGuard", text);
        Log.i("MurekaPlayer", "WireGuard: " + text);

        try {

            JSONObject o = new JSONObject();

            o.put("text", text);
            o.put("ok", !"bad".equals(kind));
            o.put("kind", kind);
            Hub.command("appToast", o);
        } catch (JSONException e) {
            // The log has it
        }
    }
}
