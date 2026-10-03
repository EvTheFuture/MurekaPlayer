/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, switching the phone's hotspot on and off through Shizuku
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

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.lsposed.hiddenapibypass.HiddenApiBypass;

import rikka.shizuku.Shizuku;

// Switching the phone's hotspot. Android's public API has no call for it,
// but its tethering service lets an app that may modify system settings
// start and stop the hotspot, with the phone's own name and password, the
// same as the quick settings tile. That call is not in the public API, so
// it is reached past Android's checks on hidden calls. That is the way
// used first, with only Android's own permission screen. Should the phone
// or its carrier refuse it, Shizuku, when installed and running, is the
// way left: it runs the system's hotspot command with the debugging
// shell's rights
final class Hotspot {

    private static final String SHIZUKU_PACKAGE = "moe.shizuku.privileged.api";
    private static final int ASK_CODE = 4711;

    // One command at a time, never on the main thread
    private static final ExecutorService RUN = Executors.newSingleThreadExecutor();

    private static volatile String lastResult = "";

    private Hotspot() {
    }

    // TETHERING_WIFI in Android's tethering service
    private static final int TETHER_WIFI = 0;

    // Whether Android lets the app modify system settings, which its
    // tethering service asks of an app switching the hotspot
    static boolean canWrite(Context c) {

        try {
            return Settings.System.canWrite(c);
        } catch (Throwable t) {
            return false;
        }
    }

    // Android's own screen for that permission, for this app
    static void askWrite(Context c) {

        try {
            c.startActivity(new Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                Uri.parse("package:" + c.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (ActivityNotFoundException e) {
            Hub.note("Hotspot", "no screen to allow modifying system settings on this phone");
        }
    }

    // Where Shizuku stands: missing, stopped, old, denied or ready
    static String status(Context c) {

        try {

            if (!Shizuku.pingBinder()) {
                return installed(c) ? "stopped" : "missing";
            }

            if (Shizuku.isPreV11()) {
                return "old";
            }

            return Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED ? "ready" : "denied";
        } catch (Throwable t) {
            return installed(c) ? "stopped" : "missing";
        }
    }

    // What the last hotspot command said, for the settings
    static String lastResult() {
        return lastResult;
    }

    // Shizuku shows its own question, the answer is read with status later
    static void ask() {

        try {

            if (Shizuku.pingBinder() && !Shizuku.isPreV11()
                && Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED) {
                Shizuku.requestPermission(ASK_CODE);
            }
        } catch (Throwable t) {
            Hub.note("Hotspot", "could not ask Shizuku, " + t.getClass().getSimpleName());
        }
    }

    // The hotspot on: Android's own way first, with the phone's own
    // hotspot settings, then Shizuku with the name and password given here
    static void start(Context c) {

        RUN.execute(() -> {

            if (!builtin(c, true)) {
                startShizuku(c);
            }
        });
    }

    static void stop(Context c) {

        RUN.execute(() -> {

            if (!builtin(c, false)) {
                run(c, "off", new String[] {"cmd", "wifi", "stop-softap"});
            }
        });
    }

    // Android's tethering service, asked like the quick settings tile does.
    // False when it could not be asked at all, so the other way is tried.
    // A refusal that comes later through the answer tries Shizuku from there
    private static boolean builtin(Context c, boolean on) {

        String what = on ? "on" : "off";

        if (Build.VERSION.SDK_INT < 30) {
            return false;
        }

        if (!canWrite(c)) {

            Hub.note("Hotspot", "the player may not modify system settings, Android's way left out");
            return false;
        }

        try {

            // Android's checks on calls outside its public API, lifted for
            // the tethering service only
            HiddenApiBypass.addHiddenApiExemptions("Landroid/net/TetheringManager");

            Object tm = c.getSystemService("tethering");
            Class<?> tmc = Class.forName("android.net.TetheringManager");

            if (tm == null) {
                return false;
            }

            if (!on) {

                tmc.getMethod("stopTethering", int.class).invoke(tm, TETHER_WIFI);
                lastResult = "Switched off";
                Hub.note("Hotspot", "switched off through Android");
                return true;
            }

            Class<?> cbc = Class.forName("android.net.TetheringManager$StartTetheringCallback");

            // The answer comes later, started or refused with a reason
            Object cb = Proxy.newProxyInstance(cbc.getClassLoader(), new Class<?>[] {cbc}, (proxy, method, args) -> {

                String name = method.getName();

                if ("onTetheringStarted".equals(name)) {

                    lastResult = "Switched on";
                    Hub.note("Hotspot", "switched on through Android");
                } else if ("onTetheringFailed".equals(name)) {

                    int error = args != null && args.length > 0 && args[0] instanceof Integer ? (Integer) args[0] : -1;

                    lastResult = "Android refused, error " + error + (error == 14 ? ", the carrier's check" : "");
                    Hub.note("Hotspot", lastResult + ", trying Shizuku");
                    RUN.execute(() -> startShizuku(c));
                } else if ("hashCode".equals(name)) {
                    return System.identityHashCode(proxy);
                } else if ("equals".equals(name)) {
                    return args != null && args.length > 0 && proxy == args[0];
                } else if ("toString".equals(name)) {
                    return "MurekaPlayerTetheringCallback";
                }

                return null;
            });

            tmc.getMethod("startTethering", int.class, java.util.concurrent.Executor.class, cbc)
                .invoke(tm, TETHER_WIFI, c.getMainExecutor(), cb);
            Hub.note("Hotspot", "asked Android to switch " + what);
            return true;
        } catch (Throwable t) {

            Throwable why = t.getCause() != null ? t.getCause() : t;

            lastResult = "Android's way failed, " + why.getClass().getSimpleName();
            Hub.note("Hotspot", lastResult + (why.getMessage() != null ? ": " + why.getMessage() : ""));
            return false;
        }
    }

    // The hotspot on through Shizuku, with the name, password and band from
    // the settings
    private static void startShizuku(Context c) {

        final String ssid = CarSettings.prefs(c).getString(CarSettings.HOTSPOT_SSID, "");
        final String pass = CarSettings.prefs(c).getString(CarSettings.HOTSPOT_PASS, "");
        final String band = CarSettings.prefs(c).getString(CarSettings.HOTSPOT_BAND, "any");

        // Without Shizuku there is nothing more to try, Android's answer
        // stays the one shown
        if (!"ready".equals(status(c))) {

            if (lastResult.isEmpty()) {
                lastResult = "Not switched on, neither Android's way nor Shizuku could be used";
            }

            Hub.note("Hotspot", "Shizuku is not ready either, the hotspot stays as it is");
            return;
        }

        if (ssid.isEmpty()) {

            lastResult = "No hotspot name set for Shizuku";
            Hub.note("Hotspot", "not switched on, no hotspot name in the settings");
            return;
        }

        List<String> cmd = new ArrayList<>();

        cmd.add("cmd");
        cmd.add("wifi");
        cmd.add("start-softap");
        cmd.add(ssid);

        if (pass.isEmpty()) {
            cmd.add("open");
        } else {

            cmd.add("wpa2");
            cmd.add(pass);
        }

        if ("2".equals(band) || "5".equals(band)) {

            cmd.add("-b");
            cmd.add(band);
        }

        run(c, "on", cmd.toArray(new String[0]));
    }

    private static boolean installed(Context c) {

        try {

            c.getPackageManager().getPackageInfo(SHIZUKU_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    // A command through Shizuku, in the background, its answer noted. The
    // way to start a process is not public in the current Shizuku library,
    // it is reached the way other apps do
    private static void run(Context c, String what, String[] cmd) {

        if (!"ready".equals(status(c))) {

            // Android's own answer, when there was one, stays the one shown
            if (lastResult.isEmpty() || lastResult.startsWith("Shizuku")) {
                lastResult = "Not switched " + what + ", neither Android's way nor Shizuku could be used";
            }

            Hub.note("Hotspot", "Shizuku is not ready, the hotspot was not switched " + what);
            return;
        }

        {

            try {

                Method m = Shizuku.class.getDeclaredMethod("newProcess", String[].class, String[].class, String.class);

                m.setAccessible(true);

                Process p = (Process) m.invoke(null, cmd, null, null);
                String out = read(p.getInputStream()) + read(p.getErrorStream());
                boolean done = p.waitFor(15, TimeUnit.SECONDS);
                int code = done ? p.exitValue() : -1;

                lastResult = (code == 0 ? "Switched " + what : "Could not switch " + what + ", " + (done ? "answer " + code : "no answer"))
                    + (out.trim().isEmpty() ? "" : ": " + out.trim());
                Hub.note("Hotspot", lastResult);
            } catch (Throwable t) {

                lastResult = "Could not switch " + what + ", " + t.getClass().getSimpleName();
                Hub.note("Hotspot", lastResult);
            }
        }
    }

    private static String read(InputStream in) throws IOException {

        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] b = new byte[4096];
        int n;

        while ((n = in.read(b)) != -1 && buf.size() < 4096) {
            buf.write(b, 0, n);
        }

        return buf.toString(StandardCharsets.UTF_8.name());
    }
}
