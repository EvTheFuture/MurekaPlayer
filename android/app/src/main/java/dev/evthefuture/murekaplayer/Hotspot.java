/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, switching the phone's hotspot through the hotspot helper
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
import android.content.IntentFilter;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Switching the phone's hotspot. Android 16 lets only callers with the
// system's tethering permission do that, which an app cannot be given,
// but the debugging shell has it. Each switch runs HotspotHelper once in
// the foreground over wireless debugging and reads the line it prints.
// A helper left in the background dies when that adb session closes, and
// an abstract socket from the app to the shell is denied by SELinux.
// The hotspot comes on with the phone's own name and password, the same
// as from the quick settings tile
final class Hotspot {

    // One command at a time, never on the main thread
    private static final ExecutorService RUN = Executors.newSingleThreadExecutor();

    // Last one-shot answer, so the page does not open adb just to look
    private static volatile String cachedState = "";
    private static volatile boolean proved = false;

    // How long an answer may take: a quick question, and a switch, which
    // waits for the hotspot to settle
    private static final int QUICK_MS = 2000;
    private static final int SWITCH_MS = 25000;

    private static volatile String lastResult = "";

    private Hotspot() {
    }

    // What the last hotspot command said, for the settings
    static String lastResult() {
        return lastResult;
    }

    // Where the helper stands: running, old (running, from an earlier
    // version of the app) or stopped
    static String helper(Context c) {

        return proved ? "running" : "stopped";
    }

    // The hotspot's state as the last command read it, or empty without one
    static String state() {

        return cachedState;
    }

    // Android's announcement of each hotspot change, kept as a sticky
    // broadcast, and the state in it: disabling, disabled, enabling,
    // enabled, failed
    private static final String AP_STATE_ACTION = "android.net.wifi.WIFI_AP_STATE_CHANGED";
    private static final String AP_STATE_EXTRA = "wifi_state";

    // The hotspot's state right now without the helper: on or off from
    // Android's last announcement, else from the phone's networks. Empty
    // only when neither can be read
    static String liveState(Context c) {

        String told = announced(c);

        if (!told.isEmpty()) {
            return told;
        }

        try {
            return apUp(c) ? "on" : "off";
        } catch (Exception e) {
            return "";
        }
    }

    // Android's last hotspot announcement, empty when there is none
    private static String announced(Context c) {

        try {

            IntentFilter filter = new IntentFilter(AP_STATE_ACTION);
            Context app = c.getApplicationContext();
            Intent last;

            if (Build.VERSION.SDK_INT >= 33) {
                last = app.registerReceiver(null, filter, Context.RECEIVER_EXPORTED);
            } else {
                last = app.registerReceiver(null, filter);
            }

            if (last != null) {

                int st = last.getIntExtra(AP_STATE_EXTRA, -1);

                if (st == 12 || st == 13) {
                    return "on";
                }

                if (st == 10 || st == 11 || st == 14) {
                    return "off";
                }
            }
        } catch (RuntimeException e) {
            return "";
        }

        return "";
    }

    // Whether the hotspot's network is up. From Android 15 the hotspot is a
    // Wi-Fi network marked as local, before that it is a Wi-Fi interface
    // with an address that is not a Wi-Fi the phone has joined. Its name
    // differs between phones, wlan1, ap0 or swlan0 and the like
    private static boolean apUp(Context c) throws Exception {

        Set<String> joined = new HashSet<>();
        ConnectivityManager cm = c.getApplicationContext().getSystemService(ConnectivityManager.class);

        if (cm != null) {

            for (Network n : cm.getAllNetworks()) {

                NetworkCapabilities caps = cm.getNetworkCapabilities(n);
                LinkProperties lp = cm.getLinkProperties(n);

                if (caps == null || lp == null || lp.getInterfaceName() == null
                    || !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    continue;
                }

                if (Build.VERSION.SDK_INT >= 35
                    && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_LOCAL_NETWORK)) {
                    return true;
                }

                joined.add(lp.getInterfaceName());
            }
        }

        for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {

            String name = ni.getName() == null ? "" : ni.getName();
            boolean apName = name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("swlan")
                || name.startsWith("softap");

            if (!ni.isUp() || ni.isLoopback() || !apName || joined.contains(name)) {
                continue;
            }

            for (InetAddress a : Collections.list(ni.getInetAddresses())) {

                if (a instanceof Inet4Address) {
                    return true;
                }
            }
        }

        return false;
    }

    static void start(Context c) {

        final Context app = c.getApplicationContext();

        RUN.execute(new Runnable() {
            @Override
            public void run() {
                command(app, "on");
            }
        });
    }

    static void stop(Context c) {

        final Context app = c.getApplicationContext();

        RUN.execute(new Runnable() {
            @Override
            public void run() {
                command(app, "off");
            }
        });
    }

    // A ping through adb, used by the start button. The line the helper
    // printed, empty when it did not run
    static String prove(Context c) {

        String answer = HelperStart.once(c, "ping");

        proved = answer.startsWith("ok");
        return answer;
    }

    // Where the helper writes what it has to say, a place the shell may
    // write to and adb may read
    static final String HELPER_LOG = "/data/local/tmp/murekaplayer_hotspot.log";

    // One foreground run. No '&', so the process is not killed when the
    // adb session ends, and the line it prints comes back on the stream
    static String shellCommand(Context c, String what) {

        return "pm grant " + c.getPackageName() + " android.permission.WRITE_SECURE_SETTINGS >/dev/null 2>&1; "
            + "CLASSPATH=" + c.getApplicationInfo().sourceDir
            + " app_process /system/bin " + HotspotHelper.class.getName() + " "
            + c.getApplicationInfo().uid + " " + versionCode(c) + " " + what;
    }

    // The same from a computer with adb, for a phone not on Wi-Fi
    static String startCommand(Context c) {
        return "adb shell '" + shellCommand(c, "on") + "'";
    }

    private static void command(Context c, String what) {

        String answer = HelperStart.once(c, what);

        if (answer == null || answer.isEmpty()) {
            lastResult = "Not switched " + what + ", the hotspot helper did not answer";
        } else if (answer.equals(what) || answer.equals("on") || answer.equals("off")) {

            proved = true;
            cachedState = answer.equals(what) ? what : answer;
            lastResult = "Switched " + what;
        } else if (answer.startsWith("refused")) {
            lastResult = "Android refused, error " + answer.substring(7).trim();
        } else if (answer.startsWith("ok")) {

            proved = true;
            lastResult = "The helper answered " + answer;
        } else {
            lastResult = "Asked to switch " + what + ", " + answer;
        }

        Hub.note("Hotspot", lastResult);
    }

    private static long versionCode(Context c) {

        try {

            PackageInfo info = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);

            return info.getLongVersionCode();
        } catch (PackageManager.NameNotFoundException e) {
            return 0;
        }
    }
}
