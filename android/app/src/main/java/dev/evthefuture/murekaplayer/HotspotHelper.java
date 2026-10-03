/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, the hotspot helper that runs as the debugging shell
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
import android.content.ContextWrapper;
import android.os.IBinder;
import android.os.Looper;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

// The hotspot helper. Not part of the running app: it runs as the
// debugging shell with app_process, from the app's own APK. The shell may
// switch tethering, the app may not. Each run takes one command, prints
// one line with the answer and exits, so nothing is left running between
// switches. The hotspot is switched the way the quick settings tile does
// it, with the phone's own name and password.
//
// The app runs it over wireless debugging, in the foreground, and reads
// the line it prints from the shell stream:
// CLASSPATH=<the app's base.apk> app_process /system/bin
//     dev.evthefuture.murekaplayer.HotspotHelper <app uid> <version> <command>
//
// ping -> ok <version code>
// state -> on, off, switching on, switching off, failed or unknown
// on -> on, or refused <error>, or the state when it did not come on
// off -> off, or the state when it did not go off
//
// No lambdas, kept the same as the tested version run from a plain dex
public final class HotspotHelper {

    private static final String SHELL = "com.android.shell";

    // TETHERING_WIFI in Android's tethering service
    private static final int TETHER_WIFI = 0;

    private static Context ctx;
    private static Object tm;
    private static Class<?> tmc;

    private HotspotHelper() {
    }

    // The system context, naming the shell as the caller. The uid is the
    // shell's anyway, the name only has to match it
    private static final class ShellContext extends ContextWrapper {

        ShellContext(Context base) {
            super(base);
        }

        @Override
        public String getPackageName() {
            return SHELL;
        }

        @Override
        public String getOpPackageName() {
            return SHELL;
        }
    }

    public static void main(String[] args) {

        // Foreground, one command, then exit. A helper left in the
        // background would end when the adb session closes
        if (args.length < 3) {

            say("usage: HotspotHelper <app uid> <app version code> <ping|state|on|off>");
            System.exit(2);
        }

        String version = args[1];
        String what = args[2];

        try {
            Integer.parseInt(args[0]);
        } catch (NumberFormatException e) {

            say("not a uid: " + args[0]);
            System.exit(2);
            return;
        }

        // prepareMainLooper() is deprecated. Same result: a looper on
        // this thread, registered as the main one for the framework
        Looper.prepare();

        try {

            Field main = Looper.class.getDeclaredField("sMainLooper");

            main.setAccessible(true);

            if (main.get(null) == null) {
                main.set(null, Looper.myLooper());
            }
        } catch (Throwable t) {
            // Newer Android without that field, the thread looper is enough
        }

        try {

            ctx = new ShellContext(systemContext());
            tetheringManager();
            say(handle(what, version));
        } catch (Throwable t) {

            Throwable why = t.getCause() != null ? t.getCause() : t;

            say("could not start: " + why);
            System.exit(1);
            return;
        }

        System.exit(0);
    }

    // The answer, one line on the shell stream the app reads, flushed at
    // once so it is there even if the helper ends right after
    private static void say(String text) {

        System.out.println(text);
        System.out.flush();
    }

    private static String handle(String what, String version) throws Exception {

        if ("ping".equals(what)) {
            return "ok " + version;
        }

        if ("state".equals(what)) {
            return apState();
        }

        if ("on".equals(what)) {

            String refused = start();

            if (refused != null) {
                return refused;
            }

            return settle("on");
        }

        if ("off".equals(what)) {

            // No answer comes back from this call, the state tells
            tmc.getMethod("stopTethering", int.class).invoke(tm, TETHER_WIFI);
            return settle("off");
        }

        return "unknown command";
    }

    // The hotspot takes a moment to change, the state is read until it is
    // where it was asked to go, for up to about 5 s
    private static String settle(String want) throws InterruptedException {

        String state = apState();

        for (int i = 0; i < 10 && !want.equals(state); i++) {

            Thread.sleep(500);
            state = apState();
        }

        return state;
    }

    // Asks for the hotspot like the quick settings tile does. Null when it
    // started or no answer came, else refused with the service's error
    private static String start() throws Exception {

        final CountDownLatch done = new CountDownLatch(1);
        final String[] refused = new String[1];
        Class<?> cbc = Class.forName("android.net.TetheringManager$StartTetheringCallback");

        // The callback is an interface, so a proxy implements it
        InvocationHandler handler = new InvocationHandler() {
            @Override
            public Object invoke(Object proxy, Method method, Object[] a) {

                String name = method.getName();

                if ("onTetheringStarted".equals(name)) {
                    done.countDown();
                } else if ("onTetheringFailed".equals(name)) {

                    refused[0] = "refused " + (a != null && a.length > 0 ? a[0] : "?");
                    done.countDown();
                } else if ("hashCode".equals(name)) {
                    return System.identityHashCode(proxy);
                } else if ("equals".equals(name)) {
                    return a != null && a.length > 0 && proxy == a[0];
                } else if ("toString".equals(name)) {
                    return "MurekaPlayerHotspotCallback";
                }

                return null;
            }
        };
        Object cb = Proxy.newProxyInstance(cbc.getClassLoader(), new Class<?>[] {cbc}, handler);

        // Answers arrive on a binder thread and are handled right there
        Executor direct = new Executor() {
            @Override
            public void execute(Runnable task) {
                task.run();
            }
        };

        tmc.getMethod("startTethering", int.class, Executor.class, cbc).invoke(tm, TETHER_WIFI, direct, cb);
        done.await(15, TimeUnit.SECONDS);
        return refused[0];
    }

    // A tethering manager talking straight to the tethering service
    private static void tetheringManager() throws Exception {

        tmc = Class.forName("android.net.TetheringManager");

        final Method getService = Class.forName("android.os.ServiceManager").getMethod("getService", String.class);
        Supplier<IBinder> connector = new Supplier<IBinder>() {
            @Override
            public IBinder get() {

                try {
                    return (IBinder) getService.invoke(null, "tethering");
                } catch (Exception e) {
                    return null;
                }
            }
        };
        Constructor<?> make = tmc.getConstructor(Context.class, Supplier.class);

        tm = make.newInstance(ctx, connector);
    }

    // Android's system context, made the way tools run through app_process
    // do it
    private static Context systemContext() throws Exception {

        Class<?> atc = Class.forName("android.app.ActivityThread");
        Constructor<?> make = atc.getDeclaredConstructor();

        make.setAccessible(true);

        Object at = make.newInstance();
        Field current = atc.getDeclaredField("sCurrentActivityThread");

        current.setAccessible(true);
        current.set(null, at);

        try {

            Field system = atc.getDeclaredField("mSystemThread");

            system.setAccessible(true);
            system.setBoolean(at, true);
        } catch (NoSuchFieldException e) {
            // Older or newer Android without it, works anyway
        }

        Method get = atc.getDeclaredMethod("getSystemContext");

        get.setAccessible(true);
        return (Context) get.invoke(at);
    }

    // The hotspot's state as Wi-Fi reports it
    private static String apState() {

        try {

            Object wm = ctx.getSystemService(Context.WIFI_SERVICE);
            int state = (Integer) wm.getClass().getMethod("getWifiApState").invoke(wm);

            switch (state) {
                case 10:
                    return "switching off";
                case 11:
                    return "off";
                case 12:
                    return "switching on";
                case 13:
                    return "on";
                case 14:
                    return "failed";
                default:
                    return "unknown";
            }
        } catch (Throwable t) {
            return "unknown";
        }
    }
}
