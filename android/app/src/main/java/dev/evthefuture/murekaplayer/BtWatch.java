/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, which Bluetooth devices are connected right now
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

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothA2dp;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHeadset;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.SparseArray;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// Which Bluetooth devices are connected right now, so power saving can
// follow chosen devices, a car's for one, coming and going. Two sources
// together: the audio, phone and LE audio profiles, which are asked for
// their connected devices when anything changes and every 15 seconds, and
// Android's broadcasts for any link coming and going. The broadcasts come
// from the Bluetooth stack's own process, not from the system, so the
// receiver has to be exported to get them. From Android 12 all of this
// needs the Nearby devices permission, without it no device is known.
// Every call is checked against that permission first, which is why the
// lint check for it is turned off here
@SuppressLint("MissingPermission")
final class BtWatch {

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    // How often the profiles are asked again, for a change no broadcast told
    private static final long POLL_MS = 15000;

    // How long the first answers from the profiles are waited for before
    // the devices found so far count as the starting point
    private static final long FIRST_READ_MS = 3000;

    private static Context ctx;
    private static Runnable onChange;
    private static Runnable onReady;
    private static BroadcastReceiver receiver;
    private static boolean ready = false;

    // The profiles kept open, by profile number, to ask again and again
    private static final SparseArray<BluetoothProfile> PROXIES = new SparseArray<>();

    // Devices with a link up, from the broadcasts, and devices a profile
    // says are connected. Changed on the main thread
    private static final Set<String> LINKED = new HashSet<>();
    private static final Set<String> PROFILED = new HashSet<>();

    // Both together, the devices connected now. Read from the settings too
    private static final Set<String> CONNECTED = ConcurrentHashMap.newKeySet();

    private static final Runnable POLL = new Runnable() {

        @Override
        public void run() {

            readProfiles();
            MAIN.postDelayed(this, POLL_MS);
        }
    };

    private static final Runnable FIRST_READ_DONE = BtWatch::becomeReady;

    private BtWatch() {
    }

    // Whether the app may see Bluetooth devices. Before Android 12 the
    // install time permission is enough
    static boolean permitted(Context c) {

        if (Build.VERSION.SDK_INT < 31) {
            return true;
        }

        return c.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
    }

    private static BluetoothAdapter adapter(Context c) {

        BluetoothManager bm = c.getSystemService(BluetoothManager.class);

        return bm != null ? bm.getAdapter() : null;
    }

    // Started with the service, and again once the permission is given.
    // Ready runs once, when the devices connected already are known, and
    // changed after that whenever a device comes or goes, both on the main
    // thread. Main thread only
    static void start(Context c, Runnable changed, Runnable whenReady) {

        stop();
        ctx = c.getApplicationContext();
        onChange = changed;
        onReady = whenReady;

        BluetoothAdapter ba = permitted(ctx) ? adapter(ctx) : null;

        if (ba == null) {

            becomeReady();
            return;
        }

        receiver = new BroadcastReceiver() {

            @Override
            public void onReceive(Context context, Intent intent) {
                handle(intent);
            }
        };

        IntentFilter filter = new IntentFilter();

        filter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
        filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
        filter.addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED);
        filter.addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED);
        filter.addAction(BluetoothAdapter.ACTION_STATE_CHANGED);

        // Exported: these come from the Bluetooth stack's process, which a
        // receiver that is not exported does not hear. They are protected
        // broadcasts, no other app can send them
        if (Build.VERSION.SDK_INT >= 33) {
            ctx.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            ctx.registerReceiver(receiver, filter);
        }

        openProfile(ba, BluetoothProfile.A2DP);
        openProfile(ba, BluetoothProfile.HEADSET);

        if (Build.VERSION.SDK_INT >= 33) {
            openProfile(ba, BluetoothProfile.LE_AUDIO);
        }

        MAIN.postDelayed(FIRST_READ_DONE, FIRST_READ_MS);
        MAIN.postDelayed(POLL, POLL_MS);
    }

    static void stop() {

        MAIN.removeCallbacks(POLL);
        MAIN.removeCallbacks(FIRST_READ_DONE);

        if (receiver != null && ctx != null) {

            try {
                ctx.unregisterReceiver(receiver);
            } catch (IllegalArgumentException e) {
                // Already gone
            }
        }

        receiver = null;

        BluetoothAdapter ba = ctx != null ? adapter(ctx) : null;

        for (int i = 0; i < PROXIES.size(); i++) {

            if (ba != null) {

                try {
                    ba.closeProfileProxy(PROXIES.keyAt(i), PROXIES.valueAt(i));
                } catch (RuntimeException e) {
                    // Already closed
                }
            }
        }

        PROXIES.clear();
        LINKED.clear();
        PROFILED.clear();
        CONNECTED.clear();
        ready = false;
        onChange = null;
        onReady = null;
    }

    // The first answers are in, or long enough was waited: what is known now
    // is the starting point, and changes count from here on
    private static void becomeReady() {

        MAIN.removeCallbacks(FIRST_READ_DONE);

        if (ready) {
            return;
        }

        ready = true;

        Runnable r = onReady;

        if (r != null) {
            r.run();
        }
    }

    // One profile opened and kept, to be asked for its devices
    private static void openProfile(BluetoothAdapter ba, int profile) {

        try {

            ba.getProfileProxy(ctx, new BluetoothProfile.ServiceListener() {

                @Override
                public void onServiceConnected(int which, BluetoothProfile proxy) {

                    PROXIES.put(which, proxy);
                    readProfiles();

                    // Every profile asked has answered
                    if (PROXIES.size() >= (Build.VERSION.SDK_INT >= 33 ? 3 : 2)) {
                        becomeReady();
                    }
                }

                @Override
                public void onServiceDisconnected(int which) {

                    PROXIES.remove(which);
                    readProfiles();
                }
            }, profile);
        } catch (RuntimeException e) {
            // The profile is not there on this phone
        }
    }

    // Every open profile asked which devices it has connected now
    private static void readProfiles() {

        Set<String> now = new HashSet<>();

        for (int i = 0; i < PROXIES.size(); i++) {

            try {

                for (BluetoothDevice d : PROXIES.valueAt(i).getConnectedDevices()) {
                    now.add(key(d));
                }
            } catch (RuntimeException e) {
                // Nothing known from this profile right now
            }
        }

        PROFILED.clear();
        PROFILED.addAll(now);
        update();
    }

    private static void handle(Intent intent) {

        String action = intent != null ? intent.getAction() : null;

        if (action == null) {
            return;
        }

        if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(action)) {

            int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1);

            // Bluetooth switched off, every device is gone with it
            if (state == BluetoothAdapter.STATE_OFF || state == BluetoothAdapter.STATE_TURNING_OFF) {

                LINKED.clear();
                PROFILED.clear();
                update();
            }

            return;
        }

        BluetoothDevice device = deviceOf(intent);

        if (device != null && BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)) {
            LINKED.add(key(device));
        } else if (device != null && BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) {
            LINKED.remove(key(device));
        }

        // A profile coming or going, or a link: the profiles are asked again
        readProfiles();
    }

    // Connected now is a link up or a profile connected. Told only when it
    // changed, and only once the starting point is known
    private static void update() {

        Set<String> now = new HashSet<>(LINKED);

        now.addAll(PROFILED);

        if (now.equals(CONNECTED)) {
            return;
        }

        CONNECTED.retainAll(now);
        CONNECTED.addAll(now);

        Runnable r = onChange;

        if (ready && r != null) {
            r.run();
        }
    }

    // The device in a broadcast. Android 13 has a typed way to read it,
    // older versions only the untyped one
    @SuppressWarnings("deprecation")
    private static BluetoothDevice deviceOf(Intent intent) {

        if (Build.VERSION.SDK_INT >= 33) {
            return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice.class);
        }

        return intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
    }

    private static String key(BluetoothDevice d) {
        return d.getAddress() == null ? "" : d.getAddress().toUpperCase(Locale.ROOT);
    }

    // Whether any of these addresses is connected now
    static boolean anyConnected(Set<String> addresses) {

        for (String a : addresses) {

            if (CONNECTED.contains(a)) {
                return true;
            }
        }

        return false;
    }

    // The paired devices, each with its address, its name and whether it is
    // connected now, for the settings
    static String devices(Context c) {

        JSONObject o = new JSONObject();
        JSONArray list = new JSONArray();
        boolean ok = permitted(c);
        BluetoothAdapter ba = adapter(c);

        try {

            o.put("permission", ok);
            o.put("available", ba != null);
            o.put("enabled", ok && ba != null && ba.isEnabled());

            if (ok && ba != null) {

                List<BluetoothDevice> paired = new ArrayList<>(ba.getBondedDevices());

                paired.sort((a, b) -> name(a).compareToIgnoreCase(name(b)));

                for (BluetoothDevice d : paired) {

                    JSONObject one = new JSONObject();

                    one.put("address", key(d));
                    one.put("name", name(d));
                    one.put("connected", CONNECTED.contains(key(d)));
                    list.put(one);
                }
            }

            o.put("devices", list);
        } catch (JSONException | RuntimeException e) {
            return "{}";
        }

        return o.toString();
    }

    // The name the phone shows for a device, the one given to it in the
    // phone's own settings first
    private static String name(BluetoothDevice d) {

        String n = null;

        try {

            if (Build.VERSION.SDK_INT >= 30) {
                n = d.getAlias();
            }

            if (n == null || n.isEmpty()) {
                n = d.getName();
            }
        } catch (RuntimeException e) {
            n = null;
        }

        return n == null || n.isEmpty() ? key(d) : n;
    }
}
