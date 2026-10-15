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
