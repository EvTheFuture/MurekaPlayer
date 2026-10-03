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

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// Which Bluetooth devices are connected right now, so power saving can
// follow chosen devices, a car's for one, coming and going. The devices
// already connected are read from the audio, phone and LE audio profiles
// when the watch starts, and Android tells about every connection after
// that. From Android 12 this needs the Nearby devices permission, without
// it no device is known. Every call is checked against that permission
// first, which is why the lint check for it is turned off here
@SuppressLint("MissingPermission")
final class BtWatch {

    private static Context ctx;
    private static Runnable onChange;
    private static BroadcastReceiver receiver;

    // The addresses of the devices connected now. Changed on the main
    // thread, where Android delivers the broadcasts and the profiles, and
    // read from the settings as well
    private static final Set<String> CONNECTED = ConcurrentHashMap.newKeySet();

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
    // The callback runs on the main thread whenever a device comes or goes.
    // Main thread only
    static void start(Context c, Runnable changed) {

        ctx = c.getApplicationContext();
        onChange = changed;
        stopReceiver();
        CONNECTED.clear();

        if (!permitted(ctx)) {
            return;
        }

        BluetoothAdapter ba = adapter(ctx);

        if (ba == null) {
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

        if (Build.VERSION.SDK_INT >= 33) {
            ctx.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            ctx.registerReceiver(receiver, filter);
        }

        readProfile(ba, BluetoothProfile.A2DP);
        readProfile(ba, BluetoothProfile.HEADSET);

        if (Build.VERSION.SDK_INT >= 33) {
            readProfile(ba, BluetoothProfile.LE_AUDIO);
        }
    }

    static void stop() {

        stopReceiver();
        CONNECTED.clear();
        onChange = null;
    }

    private static void stopReceiver() {

        if (receiver != null && ctx != null) {

            try {
                ctx.unregisterReceiver(receiver);
            } catch (IllegalArgumentException e) {
                // Already gone
            }
        }

        receiver = null;
    }

    // The devices one profile has connected now, read once and let go
    private static void readProfile(final BluetoothAdapter ba, int profile) {

        try {

            ba.getProfileProxy(ctx, new BluetoothProfile.ServiceListener() {

                @Override
                public void onServiceConnected(int which, BluetoothProfile proxy) {

                    boolean changed = false;

                    try {

                        for (BluetoothDevice d : proxy.getConnectedDevices()) {

                            if (CONNECTED.add(key(d))) {
                                changed = true;
                            }
                        }
                    } catch (RuntimeException e) {
                        // Nothing known from this profile
                    }

                    ba.closeProfileProxy(which, proxy);

                    if (changed) {
                        notifyChange();
                    }
                }

                @Override
                public void onServiceDisconnected(int which) {
                    // Read once only, nothing kept to drop
                }
            }, profile);
        } catch (RuntimeException e) {
            // The profile is not there on this phone
        }
    }

    private static void handle(Intent intent) {

        String action = intent != null ? intent.getAction() : null;

        if (action == null) {
            return;
        }

        if (BluetoothAdapter.ACTION_STATE_CHANGED.equals(action)) {

            int state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1);

            // Bluetooth switched off, every device is gone with it
            if ((state == BluetoothAdapter.STATE_OFF || state == BluetoothAdapter.STATE_TURNING_OFF)
                && !CONNECTED.isEmpty()) {

                CONNECTED.clear();
                notifyChange();
            }

            return;
        }

        BluetoothDevice device = deviceOf(intent);

        if (device == null) {
            return;
        }

        String key = key(device);
        boolean changed;

        if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) {
            changed = CONNECTED.remove(key);
        } else if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)) {
            changed = CONNECTED.add(key);
        } else {

            // A profile connecting means the device is there. A profile
            // going away alone does not, the link may still carry another
            int state = intent.getIntExtra(BluetoothProfile.EXTRA_STATE, -1);

            changed = state == BluetoothProfile.STATE_CONNECTED && CONNECTED.add(key);
        }

        if (changed) {
            notifyChange();
        }
    }

    private static void notifyChange() {

        Runnable r = onChange;

        if (r != null) {
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
