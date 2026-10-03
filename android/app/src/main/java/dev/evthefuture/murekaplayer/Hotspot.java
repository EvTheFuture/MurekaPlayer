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

import java.nio.charset.StandardCharsets;
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
