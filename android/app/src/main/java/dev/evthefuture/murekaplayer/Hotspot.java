/*
 * Mureka Player - load and play all your Mureka songs
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
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.LocalSocket;
import android.net.LocalSocketAddress;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// Switching the phone's hotspot. Android 16 lets only callers with the
// system's tethering permission do that, which an app cannot be given,
// but the debugging shell has it. So the hotspot helper, a small part of
// this app, runs as the shell (see HotspotHelper) and the app asks it
// over a local socket. The hotspot comes on with the phone's own name and
// password, the same as from the quick settings tile
final class Hotspot {

    // One command at a time, never on the main thread
    private static final ExecutorService RUN = Executors.newSingleThreadExecutor();

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

        String answer = ask("ping", QUICK_MS);

        if (answer == null || !answer.startsWith("ok")) {
            return "stopped";
        }

        return answer.equals("ok " + versionCode(c)) ? "running" : "old";
    }

    // The hotspot's state as the helper reads it, or empty without one
    static String state() {

        String answer = ask("state", QUICK_MS);

        return answer == null ? "" : answer;
    }

    static void start(Context c) {
        RUN.execute(() -> command("on"));
    }

    static void stop(Context c) {
        RUN.execute(() -> command("off"));
    }

    // Where the helper writes what it has to say, a place the shell may
    // write to and adb may read
    static final String HELPER_LOG = "/data/local/tmp/murekaplayer_hotspot.log";

    // The shell command that starts the helper, run through adb. It first
    // lets the app switch wireless debugging on and off, for the starts
    // after a restart of the phone. A helper already running, perhaps from
    // an earlier version, is asked by the new one to make room. setsid
    // keeps the new one running after adb has gone
    static String shellCommand(Context c) {

        return "pm grant " + c.getPackageName() + " android.permission.WRITE_SECURE_SETTINGS >/dev/null 2>&1; "
            + "CLASSPATH=" + c.getApplicationInfo().sourceDir
            + " setsid app_process /system/bin --nice-name=murekaplayer_hotspot "
            + HotspotHelper.class.getName() + " " + c.getApplicationInfo().uid + " " + versionCode(c)
            + " >" + HELPER_LOG + " 2>&1 </dev/null &";
    }

    // The same from a computer with adb, for a phone not on Wi-Fi
    static String startCommand(Context c) {
        return "adb shell '" + shellCommand(c) + "'";
    }

    private static void command(String what) {

        String answer = ask(what, SWITCH_MS);

        if (answer == null) {
            lastResult = "Not switched " + what + ", the hotspot helper is not running";
        } else if (answer.equals(what)) {
            lastResult = "Switched " + what;
        } else if (answer.startsWith("refused")) {
            lastResult = "Android refused, error " + answer.substring(7).trim();
        } else if (answer.equals("denied")) {
            lastResult = "The hotspot helper does not know this app, start it again";
        } else {
            lastResult = "Asked to switch " + what + ", the hotspot is " + answer;
        }

        Hub.note("Hotspot", lastResult);
    }

    // One question to the helper, its answer, or null when it is not
    // running or did not answer in time
    private static String ask(String what, int timeoutMs) {

        LocalSocket s = new LocalSocket();

        try {

            s.connect(new LocalSocketAddress(HotspotHelper.SOCKET, LocalSocketAddress.Namespace.ABSTRACT));
            s.setSoTimeout(timeoutMs);

            OutputStream out = s.getOutputStream();

            out.write((what + "\n").getBytes(StandardCharsets.UTF_8));
            out.flush();

            BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
            String line = in.readLine();

            return line == null ? null : line.trim();
        } catch (IOException e) {
            return null;
        } finally {

            try {
                s.close();
            } catch (IOException e) {
                // Already gone
            }
        }
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
