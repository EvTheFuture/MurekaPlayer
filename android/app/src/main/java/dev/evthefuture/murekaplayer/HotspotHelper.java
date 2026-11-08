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

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
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
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.List;
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
// btconnect <address> -> how connecting a paired Bluetooth device went
// btdisconnect <address> -> how disconnecting it went
// btactive <address> -> how making it where the music goes went
// bton -> how switching Bluetooth on went
// serve -> keeps running in a session of its own, so it outlives the adb
//     session, until the phone restarts. It hands the app a Binder
//     through the app's helper provider, and the app sends the commands
//     above through it, without wireless debugging, so the hotspot can be
//     switched with no Wi-Fi about. Only the app's own uid is answered.
//     Handed over again whenever the app's process starts anew
//
// Every other command is one run: one line with the answer, then exit
// No lambdas, since it runs from a plain dex without desugaring. The
// Bluetooth calls run as the shell, which holds every Bluetooth
// permission, so the lint check for the app's own is turned off here. So
// are the checks for Android's hidden calls: the limits on them are for
// apps, not for a program run as the shell with app_process
@SuppressLint({"MissingPermission", "BlockedPrivateApi", "DiscouragedPrivateApi", "SoonBlockedPrivateApi"})
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
    static final int CODE_BT_CONNECT = 6;
    static final int CODE_BT_DISCONNECT = 7;
    static final int CODE_BT_ACTIVE = 8;
    static final int CODE_BT_ON = 9;

    // A Bluetooth address, the only thing a Bluetooth command takes
    private static final String BT_ADDRESS = "^[0-9A-F]{2}(:[0-9A-F]{2}){5}$";

    // The A2DP profile and the audio kind of active device, in Android's
    // Bluetooth classes
    private static final int BT_A2DP = 2;
    private static final int BT_ACTIVE_AUDIO = 0;

    // How long a Bluetooth device gets to connect or disconnect, and how
    // long after its link is up it is made where the music goes, if Android
    // has not done that by itself
    private static final long BT_SETTLE_MS = 20000;
    private static final long BT_ACTIVE_AFTER_MS = 2500;

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

    // The shell as the caller for Bluetooth, which from Android 12 takes the
    // caller from the context's attribution. The system context's would
    // name Android itself, which the shell's uid does not own
    private static final class BtContext extends ContextWrapper {

        BtContext(Context base) {
            super(base);
        }

        @Override
        public Context getApplicationContext() {
            return this;
        }

        // Only asked from Android 12, which has attributions
        @TargetApi(31)
        @Override
        public AttributionSource getAttributionSource() {
            return new AttributionSource.Builder(SHELL_UID).setPackageName(SHELL).build();
        }
    }

    public static void main(String[] args) {

        // One command, then exit, or serve, which keeps running
        if (args.length < 3) {

            say("usage: HotspotHelper <app uid> <app version code> <ping|state|on|off|serve|bt...> [address]");
            System.exit(2);
        }

        String version = args[1];
        String what = args[2];
        String address = args.length > 3 ? args[3] : "";
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

            say(handle(what, version, address));
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

    private static String handle(String what, String version, String address) throws Exception {

        if (what.startsWith("bt")) {
            return bluetooth(what.substring(2), address);
        }

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
                        answer = handle("ping", version, "");
                    } else if (code == CODE_STATE) {
                        answer = handle("state", version, "");
                    } else if (code == CODE_ON) {
                        answer = handle("on", version, "");
                    } else if (code == CODE_OFF) {
                        answer = handle("off", version, "");
                    } else if (code == CODE_BT_CONNECT || code == CODE_BT_DISCONNECT || code == CODE_BT_ACTIVE
                        || code == CODE_BT_ON) {

                        // The device's address comes with the call
                        String address = data != null ? data.readString() : null;
                        String what = code == CODE_BT_CONNECT ? "connect"
                            : code == CODE_BT_DISCONNECT ? "disconnect" : code == CODE_BT_ACTIVE ? "active" : "on";

                        answer = bluetooth(what, address == null ? "" : address);
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

                say("the app did not take the Binder");
                sleepQuietly(HANDOVER_GAP_MS);
                continue;
            }

            say("handed over to the app");

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

    // Bluetooth for a paired device: connect it, which Android normally
    // also makes where the music goes, disconnect it, or make it where the
    // music goes when it is connected already. Or Bluetooth switched on.
    // The calls are system ones that need the privileged Bluetooth
    // permission, which the shell has and an app cannot be given
    private static String bluetooth(String what, String address) throws Exception {

        StringBuilder why = new StringBuilder();
        BluetoothAdapter adapter = btAdapter(why);

        if (adapter == null) {
            return "Bluetooth could not be reached from the helper: " + why;
        }

        if ("on".equals(what)) {

            if (adapter.isEnabled()) {
                return "Bluetooth is on";
            }

            Object sent = BluetoothAdapter.class.getMethod("enable").invoke(adapter);

            if (Boolean.FALSE.equals(sent)) {
                return "refused to switch Bluetooth on";
            }

            for (int i = 0; i < 20 && !adapter.isEnabled(); i++) {
                Thread.sleep(500);
            }

            return adapter.isEnabled() ? "Bluetooth is on" : "Bluetooth did not come on within 10 s";
        }

        if (address == null || !address.matches(BT_ADDRESS)) {
            return "not a Bluetooth address";
        }

        if (!adapter.isEnabled()) {
            return "Bluetooth is off";
        }

        BluetoothDevice device = adapter.getRemoteDevice(address);

        if ("connect".equals(what)) {

            String refused = btCall(device, "connect");

            return refused != null ? refused : btSettleConnected(adapter, device);
        }

        if ("disconnect".equals(what)) {

            String refused = btCall(device, "disconnect");

            if (refused != null) {
                return refused;
            }

            long until = System.currentTimeMillis() + BT_SETTLE_MS;

            while (btConnected(device) && System.currentTimeMillis() < until) {
                Thread.sleep(500);
            }

            return btConnected(device) ? "still connected after " + (BT_SETTLE_MS / 1000) + " s" : "disconnected";
        }

        if ("active".equals(what)) {

            if (!btConnected(device)) {
                return "not connected";
            }

            if (!btMakeActive(adapter, device)) {
                return "refused to make it where the music goes";
            }

            for (int i = 0; i < 10; i++) {

                if (Boolean.TRUE.equals(btActive(adapter, device))) {
                    return "the music goes there";
                }

                Thread.sleep(500);
            }

            Boolean active = btActive(adapter, device);

            return active == null ? "asked to make it where the music goes" : "the music still goes elsewhere";
        }

        return "unknown Bluetooth command";
    }

    // Whether Android's own modules, Bluetooth among them, have been told
    // where their services are. An app gets that as it starts, a program
    // run with app_process does not, and without it there is no adapter
    private static boolean modulesReady = false;

    private static synchronized void readyModules(StringBuilder why) {

        if (modulesReady) {
            return;
        }

        modulesReady = true;

        try {

            Method init = Class.forName("android.app.ActivityThread").getDeclaredMethod("initializeMainlineModules");

            init.setAccessible(true);
            init.invoke(null);
        } catch (Throwable t) {
            why.append("modules not set up (").append(t.getCause() != null ? t.getCause() : t).append("); ");
        }
    }

    // The Bluetooth adapter speaking as the shell. Made the way Android
    // makes it for a context, here the shell's, else straight from the
    // Bluetooth manager service, else the default adapter. Null with what
    // went wrong in why
    private static BluetoothAdapter btAdapter(StringBuilder why) {

        readyModules(why);

        try {

            Constructor<BluetoothManager> make = BluetoothManager.class.getDeclaredConstructor(Context.class);

            make.setAccessible(true);

            BluetoothAdapter adapter = make.newInstance(new BtContext(ctx)).getAdapter();

            if (adapter != null) {
                return adapter;
            }

            why.append("the Bluetooth manager had no adapter; ");
        } catch (Throwable t) {
            why.append("no Bluetooth manager (").append(t.getCause() != null ? t.getCause() : t).append("); ");
        }

        BluetoothAdapter direct = btAdapterDirect(why);

        if (direct != null) {
            return direct;
        }

        try {

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();

            if (adapter != null) {
                return adapter;
            }

            why.append("no default adapter");
        } catch (Throwable t) {
            why.append("no default adapter (").append(t).append(")");
        }

        return null;
    }

    // The adapter made from the Bluetooth manager service itself, with the
    // shell as the caller, for when the modules could not be set up
    private static BluetoothAdapter btAdapterDirect(StringBuilder why) {

        if (Build.VERSION.SDK_INT < 31) {
            return null;
        }

        try {

            IBinder service = (IBinder) Class.forName("android.os.ServiceManager")
                .getMethod("getService", String.class).invoke(null, "bluetooth_manager");

            if (service == null) {

                why.append("no Bluetooth manager service; ");
                return null;
            }

            Object manager = Class.forName("android.bluetooth.IBluetoothManager$Stub")
                .getMethod("asInterface", IBinder.class).invoke(null, service);
            AttributionSource who = new AttributionSource.Builder(SHELL_UID).setPackageName(SHELL).build();

            for (Constructor<?> c : BluetoothAdapter.class.getDeclaredConstructors()) {

                Class<?>[] p = c.getParameterTypes();

                if (p.length == 2 && p[0].isInstance(manager) && p[1] == AttributionSource.class) {

                    c.setAccessible(true);
                    return (BluetoothAdapter) c.newInstance(manager, who);
                }
            }

            why.append("no way to make an adapter from the service; ");
        } catch (Throwable t) {
            why.append("no adapter from the service (").append(t.getCause() != null ? t.getCause() : t).append("); ");
        }

        return null;
    }

    // The device's connect or disconnect, every profile it has enabled, a
    // system call from Android 13. Null when it was sent, else why not
    private static String btCall(BluetoothDevice device, String name) {

        Object answer;

        try {
            answer = BluetoothDevice.class.getMethod(name).invoke(device);
        } catch (NoSuchMethodException e) {
            return "this Android version has no " + name + " for a device, Android 13 or later is needed";
        } catch (InvocationTargetException e) {
            return "refused: " + e.getCause();
        } catch (Throwable t) {
            return "refused: " + t;
        }

        // A status code from Android 13, 0 for sent, before that true
        if (answer instanceof Integer && (Integer) answer != 0) {
            return "refused, status " + answer;
        }

        if (Boolean.FALSE.equals(answer)) {
            return "refused";
        }

        return null;
    }

    // Waits for the device to connect and become where the music goes.
    // Android makes a newly connected audio device the active one by
    // itself, if it has not a moment after the link is up, it is asked to
    private static String btSettleConnected(BluetoothAdapter adapter, BluetoothDevice device)
        throws InterruptedException {

        long until = System.currentTimeMillis() + BT_SETTLE_MS;
        long linkedAt = 0;
        boolean asked = false;

        while (System.currentTimeMillis() < until) {

            Boolean active = btActive(adapter, device);

            if (Boolean.TRUE.equals(active)) {
                return "connected, the music goes there";
            }

            if (btConnected(device)) {

                long now = System.currentTimeMillis();

                if (linkedAt == 0) {
                    linkedAt = now;
                } else if (!asked && now - linkedAt >= BT_ACTIVE_AFTER_MS) {

                    asked = true;
                    btMakeActive(adapter, device);
                }

                // Which device is active cannot be read here, connected
                // and asked is as far as it can be followed
                if (active == null && asked) {
                    return "connected";
                }
            }

            Thread.sleep(500);
        }

        if (!btConnected(device)) {
            return "not connected within " + (BT_SETTLE_MS / 1000) + " s, is it on and near?";
        }

        return "connected, but the music does not go there";
    }

    // Whether the device's link is up, a system call
    private static boolean btConnected(BluetoothDevice device) {

        try {
            return Boolean.TRUE.equals(BluetoothDevice.class.getMethod("isConnected").invoke(device));
        } catch (Throwable t) {
            return false;
        }
    }

    // Whether the device is where the music goes, null when that cannot be
    // read, before Android 13
    private static Boolean btActive(BluetoothAdapter adapter, BluetoothDevice device) {

        try {

            Object list = BluetoothAdapter.class.getMethod("getActiveDevices", int.class).invoke(adapter, BT_A2DP);

            if (!(list instanceof List)) {
                return null;
            }

            for (Object one : (List<?>) list) {

                if (one instanceof BluetoothDevice && device.getAddress().equals(((BluetoothDevice) one).getAddress())) {
                    return true;
                }
            }

            return false;
        } catch (Throwable t) {
            return null;
        }
    }

    // The device made where the music goes, a system call. Whether the
    // request was taken
    private static boolean btMakeActive(BluetoothAdapter adapter, BluetoothDevice device) {

        try {

            Object taken = BluetoothAdapter.class.getMethod("setActiveDevice", BluetoothDevice.class, int.class)
                .invoke(adapter, device, BT_ACTIVE_AUDIO);

            return !Boolean.FALSE.equals(taken);
        } catch (Throwable t) {

            say("not made active: " + (t.getCause() != null ? t.getCause() : t));
            return false;
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
