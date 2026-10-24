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
import android.net.NetworkRequest;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Parcel;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

// Switching the phone's hotspot. Android 16 lets only callers with the
// system's tethering permission do that, which an app cannot be given,
// but the debugging shell has it. HotspotHelper is started once over
// wireless debugging, in a session of its own so it outlives the adb
// session, and keeps running until the phone restarts. It hands the app a
// Binder through HelperProvider, and every switch goes through that, with
// no wireless debugging and so no Wi-Fi needed. A socket between the app
// and the shell is denied by SELinux, a Binder is not. Without a running
// helper, a switch runs the helper once over wireless debugging instead,
// which needs Wi-Fi. The hotspot comes on with the phone's own name and
// password, the same as from the quick settings tile
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

    // Wireless debugging only runs while the phone is on a Wi-Fi, so a
    // switch asked for before the phone has joined one, getting into the
    // car or leaving home say, cannot reach the helper. It is tried again
    // as soon as the phone joins a Wi-Fi, else every so often, for a while.
    // A newer switch takes the place of one still waiting
    private static final long RETRY_MS = 20000L;
    private static final long RETRY_FOR_MS = 5 * 60 * 1000L;
    private static final long WIFI_SETTLE_MS = 4000L;
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static volatile int switchSeq = 0;
    private static ConnectivityManager.NetworkCallback wifiWait;

    // The running helper's Binder and the app version it was started from
    private static volatile IBinder helperBinder;
    private static volatile String helperVersion = "";

    private Hotspot() {
    }

    // The running helper hands over its Binder, when it starts and when the
    // app's process starts anew. One started before it is asked to end
    static void setHelper(Context c, IBinder binder, String version) {

        IBinder old = helperBinder;

        helperBinder = binder;
        helperVersion = version == null ? "" : version;
        proved = true;

        try {

            binder.linkToDeath(new IBinder.DeathRecipient() {
                @Override
                public void binderDied() {

                    if (helperBinder == binder) {

                        helperBinder = null;
                        Hub.note("Helper", "the running hotspot helper ended");
                    }
                }
            }, 0);
        } catch (Exception e) {
            // Already gone, the next switch finds out
        }

        if (old != null && old != binder && old.isBinderAlive()) {
            RUN.execute(() -> ask(old, HotspotHelper.CODE_QUIT));
        }

        Hub.note("Helper", "the hotspot helper keeps running, version " + helperVersion
            + (String.valueOf(versionCode(c)).equals(helperVersion) ? "" : ", from an earlier version of the app")
            + ", switching needs no Wi-Fi");
    }

    // Whether a helper is running and reachable
    static boolean helperRunning() {

        IBinder b = helperBinder;

        return b != null && b.isBinderAlive();
    }

    // One command to the running helper, its answer, or null when it could
    // not be reached
    private static String ask(IBinder b, int code) {

        Parcel data = Parcel.obtain();
        Parcel reply = Parcel.obtain();

        try {

            if (!b.transact(code, data, reply, 0)) {
                return null;
            }

            return reply.readString();
        } catch (Exception e) {
            return null;
        } finally {

            data.recycle();
            reply.recycle();
        }
    }

    // What the last hotspot command said, for the settings
    static String lastResult() {
        return lastResult;
    }

    // Where the helper stands: running, old (running, from an earlier
    // version of the app, to be started again) or stopped
    static String helper(Context c) {

        if (!helperRunning()) {
            return "stopped";
        }

        return String.valueOf(versionCode(c)).equals(helperVersion) ? "running" : "old";
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
        begin(c, "on");
    }

    static void stop(Context c) {
        begin(c, "off");
    }

    // A switch, which replaces one still waiting to be tried again
    private static void begin(Context c, String what) {

        final Context app = c.getApplicationContext();
        final int seq = ++switchSeq;
        final long until = System.currentTimeMillis() + RETRY_FOR_MS;

        MAIN.post(() -> stopWifiWait(app));
        RUN.execute(() -> attempt(app, what, seq, until));
    }

    private static void attempt(Context app, String what, int seq, long until) {

        if (seq != switchSeq) {
            return;
        }

        // Switched meanwhile, by hand from the quick settings say
        if (what.equals(liveState(app))) {

            cachedState = what;
            lastResult = "Switched " + what;
            Hub.note("Hotspot", "the hotspot is " + what + " already");
            return;
        }

        String answer = command(app, what);

        if (!unreachable(answer) || seq != switchSeq) {
            return;
        }

        if (System.currentTimeMillis() >= until) {

            Hub.note("Hotspot", "switching " + what + " given up, wireless debugging was not reachable for "
                + (RETRY_FOR_MS / 60000) + " minutes");
            return;
        }

        boolean wifi = onWifi(app);

        Hub.note("Hotspot", (wifi ? "on a Wi-Fi" : "not on a Wi-Fi") + ", switching " + what + " is tried again "
            + (wifi ? "in " + (RETRY_MS / 1000) + " s" : "once the phone joins a Wi-Fi, or in " + (RETRY_MS / 1000) + " s"));

        // Whichever comes first, a Wi-Fi joined or the time, tries again
        final AtomicBoolean done = new AtomicBoolean(false);
        final Runnable again = () -> {

            if (done.compareAndSet(false, true)) {

                stopWifiWait(app);
                RUN.execute(() -> attempt(app, what, seq, until));
            }
        };

        MAIN.post(() -> {

            if (!wifi) {
                waitForWifi(app, () -> MAIN.postDelayed(again, WIFI_SETTLE_MS));
            }

            MAIN.postDelayed(again, RETRY_MS);
        });
    }

    // What once() says when wireless debugging could not be reached, as
    // opposed to the helper answering or Android refusing
    private static boolean unreachable(String answer) {

        return answer != null && (answer.startsWith("Wireless debugging was not found")
            || answer.startsWith("Could not connect to wireless debugging")
            || answer.startsWith("Wireless debugging is off")
            || answer.startsWith("Could not start the helper"));
    }

    // Whether the phone has joined a Wi-Fi, its own hotspot not counted
    private static boolean onWifi(Context c) {

        ConnectivityManager cm = c.getSystemService(ConnectivityManager.class);

        if (cm == null) {
            return false;
        }

        try {

            for (Network n : cm.getAllNetworks()) {

                NetworkCapabilities caps = cm.getNetworkCapabilities(n);

                if (caps == null || !caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    continue;
                }

                if (Build.VERSION.SDK_INT >= 35 && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_LOCAL_NETWORK)) {
                    continue;
                }

                return true;
            }
        } catch (RuntimeException e) {
            return false;
        }

        return false;
    }

    // Main thread only. Calls then once, when the phone joins a Wi-Fi
    private static void waitForWifi(Context c, Runnable then) {

        stopWifiWait(c);

        ConnectivityManager cm = c.getSystemService(ConnectivityManager.class);

        if (cm == null) {
            return;
        }

        NetworkRequest req = new NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .build();

        wifiWait = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                MAIN.post(then);
            }
        };

        try {
            cm.registerNetworkCallback(req, wifiWait);
        } catch (RuntimeException e) {
            wifiWait = null;
        }
    }

    private static void stopWifiWait(Context c) {

        if (wifiWait == null) {
            return;
        }

        ConnectivityManager cm = c.getSystemService(ConnectivityManager.class);

        try {

            if (cm != null) {
                cm.unregisterNetworkCallback(wifiWait);
            }
        } catch (RuntimeException e) {
            // Already gone
        }

        wifiWait = null;
    }

    // How long a helper just started gets to hand over its Binder
    private static final long HANDOVER_WAIT_MS = 10000L;

    // Starts the helper to keep running, used by the start button and the
    // starts the player makes by itself. Ok with the version once it has
    // handed over its Binder. If it does not, the helper is at least tried
    // once over wireless debugging, so switching works on Wi-Fi as before
    static String prove(Context c) {

        if ("running".equals(helper(c))) {
            return "ok " + helperVersion + ", already running";
        }

        String answer = HelperStart.once(c, "serve");

        if (answer.startsWith("started")) {

            long until = System.currentTimeMillis() + HANDOVER_WAIT_MS;

            while (!"running".equals(helper(c)) && System.currentTimeMillis() < until) {

                try {
                    Thread.sleep(250);
                } catch (InterruptedException e) {

                    Thread.currentThread().interrupt();
                    break;
                }
            }

            if ("running".equals(helper(c))) {

                // Wireless debugging off again, the helper should outlive it,
                // which a moment later shows
                HelperStart.serveDone(c);

                try {
                    Thread.sleep(2000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }

                if ("running".equals(helper(c))) {
                    return "ok " + helperVersion + ", keeps running";
                }

                Hub.note("Helper", "the helper ended when wireless debugging went off");
            }

            // What the helper said, from its log on the phone, into the
            // debug log, so why it did not reach the app can be seen
            if (!helperRunning()) {

                String said = HelperStart.once(c, "log");

                Hub.note("Helper", "the helper did not reach the app or did not keep running, its log: "
                    + (said.isEmpty() ? "empty" : said));
            }
        }

        HelperStart.serveDone(c);

        answer = HelperStart.once(c, "ping");
        proved = answer.startsWith("ok");

        return proved ? answer + ", not kept running, each switch needs Wi-Fi" : answer;
    }

    // Where the helper writes what it has to say, a place the shell may
    // write to and adb may read
    static final String HELPER_LOG = "/data/local/tmp/murekaplayer_hotspot.log";

    // One foreground run, the line it prints comes back on the stream. To
    // serve, the helper goes into a session of its own, with no terminal,
    // so the adb session closing does not end it, and what it says goes to
    // the log file
    static String shellCommand(Context c, String what) {

        String args = " /system/bin " + HotspotHelper.class.getName() + " "
            + c.getApplicationInfo().uid + " " + versionCode(c) + " " + what;
        String run = "CLASSPATH=" + c.getApplicationInfo().sourceDir + " app_process" + args;
        String grant = "pm grant " + c.getPackageName() + " android.permission.WRITE_SECURE_SETTINGS >/dev/null 2>&1; ";

        // In a session of its own, deaf to the hang up that comes when the
        // adb session ends, and the adb session held a moment longer while
        // it starts. The log says when the shell part ran
        if ("serve".equals(what)) {
            return grant + "(setsid sh -c 'echo launched; CLASSPATH=" + c.getApplicationInfo().sourceDir
                + " exec nohup app_process" + args + "' </dev/null >" + HELPER_LOG + " 2>&1 &); sleep 1; echo started";
        }

        // The end of what a helper started to serve has said, and whether
        // one is still running
        if ("log".equals(what)) {
            return "tail -c 1500 " + HELPER_LOG + " 2>&1; echo; echo running: "
                + "$(ps -A -o PID,ARGS 2>/dev/null | grep -c '[H]otspotHelper.* serve')";
        }

        return grant + run;
    }

    // The helper started to keep running from a computer with adb, for a
    // phone not on Wi-Fi. In double quotes, the command has single ones
    static String startCommand(Context c) {
        return "adb shell \"" + shellCommand(c, "serve") + "\"";
    }

    // One switch, through the running helper when there is one, else over
    // wireless debugging. What the helper or once() said
    private static String command(Context c, String what) {

        IBinder b = helperBinder;
        String answer = null;

        if (b != null && b.isBinderAlive()) {

            answer = ask(b, "on".equals(what) ? HotspotHelper.CODE_ON : HotspotHelper.CODE_OFF);

            if (answer == null) {
                Hub.note("Hotspot", "the running helper did not answer, trying over wireless debugging");
            }
        }

        if (answer == null) {
            answer = HelperStart.once(c, what);
        }

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

        return answer;
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
