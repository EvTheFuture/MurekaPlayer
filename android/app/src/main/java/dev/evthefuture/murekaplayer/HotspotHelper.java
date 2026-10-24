/*
 * Mureka Player - load and play all Mureka songs of an account
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

import android.content.AttributionSource;
import android.content.Context;
import android.content.ContextWrapper;
import android.os.Binder;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Looper;
import android.os.Parcel;

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
// switch tethering, the app may not. The hotspot is switched the way the
// quick settings tile does it, with the phone's own name and password.
//
// Started over wireless debugging:
// CLASSPATH=<the app's base.apk> app_process /system/bin
//     dev.evthefuture.murekaplayer.HotspotHelper <app uid> <version> <command>
//
// ping -> ok <version code>
// state -> on, off, switching on, switching off, failed or unknown
// on -> on, or refused <error>, or the state when it did not come on
// off -> off, or the state when it did not go off
// serve -> keeps running in a session of its own, so it outlives the adb
//     session, until the phone restarts. It hands the app a Binder
//     through the app's helper provider, and the app sends the commands
//     above through it, without wireless debugging, so the hotspot can be
//     switched with no Wi-Fi about. Only the app's own uid is answered.
//     Handed over again whenever the app's process starts anew
//
// Every other command is one run: one line with the answer, then exit
// No lambdas, since it runs from a plain dex without desugaring
public final class HotspotHelper {

    private static final String SHELL = "com.android.shell";

    // TETHERING_WIFI in Android's tethering service
    private static final int TETHER_WIFI = 0;

    // The app's provider that takes the helper's Binder, and the Binder
    // codes the app sends, the same as in Hotspot
    static final String PROVIDER = "dev.evthefuture.murekaplayer.helper";
    static final String HANDOVER = "helper";
    static final int CODE_PING = 1;
    static final int CODE_STATE = 2;
    static final int CODE_ON = 3;
    static final int CODE_OFF = 4;
    static final int CODE_QUIT = 5;

    // The shell's uid, as the provider sees the helper
    static final int SHELL_UID = 2000;

    // How long to wait between hand overs that did not reach the app
    private static final long HANDOVER_GAP_MS = 5000;

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

        // One command, then exit, or serve, which keeps running
        if (args.length < 3) {

            say("usage: HotspotHelper <app uid> <app version code> <ping|state|on|off|serve>");
            System.exit(2);
        }

        String version = args[1];
        String what = args[2];
        int appUid;

        try {
            appUid = Integer.parseInt(args[0]);
        } catch (NumberFormatException e) {

            say("not a uid: " + args[0]);
            System.exit(2);
            return;
        }

        Looper.prepareMainLooper();

        try {

            ctx = new ShellContext(systemContext());
            tetheringManager();

            if ("serve".equals(what)) {

                serve(appUid, version);
                return;
            }

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

    // Keeps running and answers the app through a Binder. The main thread
    // only waits, the app's calls come in on binder threads
    private static void serve(final int appUid, final String version) {

        final Binder helper = new Binder() {
            @Override
            protected boolean onTransact(int code, Parcel data, Parcel reply, int flags) {

                // Only the app itself, nobody else on the phone
                if (Binder.getCallingUid() != appUid) {
                    return false;
                }

                String answer;

                try {

                    if (code == CODE_PING) {
                        answer = handle("ping", version);
                    } else if (code == CODE_STATE) {
                        answer = handle("state", version);
                    } else if (code == CODE_ON) {
                        answer = handle("on", version);
                    } else if (code == CODE_OFF) {
                        answer = handle("off", version);
                    } else if (code == CODE_QUIT) {

                        // A newer helper took over
                        if (reply != null) {
                            reply.writeString("bye");
                        }

                        new Thread(new Runnable() {
                            @Override
                            public void run() {

                                sleepQuietly(300);
                                System.exit(0);
                            }
                        }).start();
                        return true;
                    } else {
                        return false;
                    }
                } catch (Throwable t) {

                    Throwable why = t.getCause() != null ? t.getCause() : t;

                    answer = "failed " + why;
                }

                if (reply != null) {
                    reply.writeString(answer);
                }

                return true;
            }
        };

        say("serving");

        Thread handing = new Thread(new Runnable() {
            @Override
            public void run() {
                handOverLoop(helper, version);
            }
        });

        handing.setDaemon(true);
        handing.start();
        Looper.loop();
    }

    // Hands the Binder to the app until it has it, and again whenever the
    // app's process ends and comes back. Gone for good, the helper ends
    private static final Object HANDED = new Object();

    private static void handOverLoop(Binder helper, String version) {

        while (true) {

            IBinder app = null;

            try {
                app = handOver(helper, version);
            } catch (NoAppException e) {

                say("the app is gone, ending");
                System.exit(0);
            } catch (Throwable t) {

                Throwable why = t.getCause() != null ? t.getCause() : t;

                say("hand over failed: " + why);
            }

            if (app == null) {

                sleepQuietly(HANDOVER_GAP_MS);
                continue;
            }

            // Waits until the app's process ends, then hands over again
            final IBinder watched = app;
            final boolean[] gone = new boolean[1];

            try {

                watched.linkToDeath(new IBinder.DeathRecipient() {
                    @Override
                    public void binderDied() {

                        synchronized (HANDED) {

                            gone[0] = true;
                            HANDED.notifyAll();
                        }
                    }
                }, 0);
            } catch (Throwable t) {
                gone[0] = true;
            }

            synchronized (HANDED) {

                while (!gone[0]) {

                    try {
                        HANDED.wait();
                    } catch (InterruptedException e) {
                        // Waits on
                    }
                }
            }

            sleepQuietly(HANDOVER_GAP_MS);
        }
    }

    private static final class NoAppException extends Exception {
        NoAppException() {
            super("no app");
        }
    }

    // One hand over through the app's provider, the way the content shell
    // command reaches a provider. The app's own Binder comes back, to see
    // when its process ends. Null when the app did not take it
    private static IBinder handOver(Binder helper, String version) throws Exception {

        Object am = Class.forName("android.app.ActivityManager").getMethod("getService").invoke(null);
        IBinder token = new Binder();
        Method getExt = null;

        for (Method m : am.getClass().getMethods()) {

            if ("getContentProviderExternal".equals(m.getName()) && m.getParameterTypes().length == 4) {
                getExt = m;
            }
        }

        if (getExt == null) {
            throw new IllegalStateException("no getContentProviderExternal");
        }

        Object holder = getExt.invoke(am, PROVIDER, 0, token, "MurekaPlayerHelper");

        if (holder == null) {
            throw new NoAppException();
        }

        Object provider = holder.getClass().getField("provider").get(holder);
        Bundle extras = new Bundle();

        extras.putBinder(HANDOVER, helper);
        extras.putString("version", version);

        Bundle back;

        try {
            back = callProvider(provider, extras);
        } finally {
            removeProvider(am, token);
        }

        return back == null ? null : back.getBinder("app");
    }

    // The provider's call, whose arguments differ between Android versions
    private static Bundle callProvider(Object provider, Bundle extras) throws Exception {

        for (Method m : provider.getClass().getMethods()) {

            if (!"call".equals(m.getName())) {
                continue;
            }

            Class<?>[] p = m.getParameterTypes();

            // Android 12 and later: who calls, authority, method, arg, extras
            if (Build.VERSION.SDK_INT >= 31 && p.length == 5 && p[0] == AttributionSource.class) {

                AttributionSource who = new AttributionSource.Builder(SHELL_UID).setPackageName(SHELL).build();

                return (Bundle) m.invoke(provider, who, PROVIDER, HANDOVER, null, extras);
            }

            // Android 11: package, feature, authority, method, arg, extras
            if (p.length == 6 && p[0] == String.class && p[1] == String.class) {
                return (Bundle) m.invoke(provider, SHELL, null, PROVIDER, HANDOVER, null, extras);
            }

            // Android 10: package, authority, method, arg, extras
            if (p.length == 5 && p[0] == String.class) {
                return (Bundle) m.invoke(provider, SHELL, PROVIDER, HANDOVER, null, extras);
            }
        }

        throw new IllegalStateException("no provider call");
    }

    private static void removeProvider(Object am, IBinder token) {

        try {
            am.getClass().getMethod("removeContentProviderExternalAsUser", String.class, IBinder.class, int.class)
                .invoke(am, PROVIDER, token, 0);
            return;
        } catch (Throwable t) {
            // Older name below
        }

        try {
            am.getClass().getMethod("removeContentProviderExternal", String.class, IBinder.class)
                .invoke(am, PROVIDER, token);
        } catch (Throwable t) {
            // Let go when the helper ends anyway
        }
    }

    private static void sleepQuietly(long ms) {

        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            // Goes on
        }
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
