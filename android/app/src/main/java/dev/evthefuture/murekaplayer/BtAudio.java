/*
 * Mureka Player - load and play all Mureka songs of an account
 * Android host, connecting a paired Bluetooth device from the web view
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
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// The phone's paired Bluetooth devices for the web view, and connecting
// one, a speaker say, from there. An app may see its paired devices and
// which are connected, with the Nearby devices permission, but not connect
// one: that takes the privileged Bluetooth permission, which only the
// system and the debugging shell have. So the list is read here and the
// connecting is done by the hotspot helper, through its Binder while it
// keeps running, else once over wireless debugging. Every call is checked
// against the Nearby devices permission first, which is why the lint check
// for it is turned off here
@SuppressLint("MissingPermission")
final class BtAudio {

    // One Bluetooth command at a time, never on the main thread
    private static final ExecutorService RUN = Executors.newSingleThreadExecutor();

    // A Bluetooth address, the only thing passed on to the shell
    private static final Pattern ADDRESS = Pattern.compile("^[0-9A-F]{2}(:[0-9A-F]{2}){5}$");

    // What a device can be asked
    private static final Set<String> ACTIONS = new HashSet<>(Arrays.asList(
        "connect", "disconnect", "active", "on"));

    // The address that stands for Bluetooth itself, switched on
    private static final String ADAPTER = "adapter";

    // The audio and phone call profiles, opened once and kept, asked for
    // how each device is connected
    private static final Map<Integer, BluetoothProfile> PROXIES = new ConcurrentHashMap<>();
    private static volatile boolean opened = false;

    // What is being done to which device now, and how the last command for
    // it went, by address
    private static final Map<String, String> BUSY = new ConcurrentHashMap<>();
    private static final Map<String, String> LAST = new ConcurrentHashMap<>();

    private BtAudio() {
    }

    private static BluetoothAdapter adapter(Context c) {

        BluetoothManager bm = c.getSystemService(BluetoothManager.class);

        return bm != null ? bm.getAdapter() : null;
    }

    // The profiles asked for once, their answers come on the main thread
    private static void openProfiles(Context app, BluetoothAdapter ba) {

        if (opened) {
            return;
        }

        opened = true;

        BluetoothProfile.ServiceListener listener = new BluetoothProfile.ServiceListener() {

            @Override
            public void onServiceConnected(int which, BluetoothProfile proxy) {
                PROXIES.put(which, proxy);
            }

            @Override
            public void onServiceDisconnected(int which) {
                PROXIES.remove(which);
            }
        };

        try {

            ba.getProfileProxy(app, listener, BluetoothProfile.A2DP);
            ba.getProfileProxy(app, listener, BluetoothProfile.HEADSET);

            if (Build.VERSION.SDK_INT >= 33) {
                ba.getProfileProxy(app, listener, BluetoothProfile.LE_AUDIO);
            }
        } catch (RuntimeException e) {

            // Asked again next time
            opened = false;
        }
    }

    // How the profiles see a device: connected when one has it connected,
    // else connecting or disconnecting when one is on the way, else
    // disconnected
    private static int profileState(BluetoothDevice d) {

        int best = BluetoothProfile.STATE_DISCONNECTED;

        for (BluetoothProfile p : PROXIES.values()) {

            int st;

            try {
                st = p.getConnectionState(d);
            } catch (RuntimeException e) {
                st = BluetoothProfile.STATE_DISCONNECTED;
            }

            if (st == BluetoothProfile.STATE_CONNECTED) {
                return st;
            }

            if (st != BluetoothProfile.STATE_DISCONNECTED) {
                best = st;
            }
        }

        return best;
    }

    // Whether the music profile has the device connected
    private static boolean soundConnected(BluetoothDevice d) {

        BluetoothProfile a2dp = PROXIES.get(BluetoothProfile.A2DP);
        BluetoothProfile le = Build.VERSION.SDK_INT >= 33 ? PROXIES.get(BluetoothProfile.LE_AUDIO) : null;

        try {

            if (a2dp != null && a2dp.getConnectionState(d) == BluetoothProfile.STATE_CONNECTED) {
                return true;
            }

            return le != null && le.getConnectionState(d) == BluetoothProfile.STATE_CONNECTED;
        } catch (RuntimeException e) {
            return false;
        }
    }

    // The addresses of the Bluetooth outputs media goes to now. From
    // Android 13 the phone says where media is routed, before that every
    // Bluetooth output counts
    private static Set<String> routed(Context c) {

        Set<String> out = new HashSet<>();
        AudioManager am = c.getSystemService(AudioManager.class);

        if (am == null) {
            return out;
        }

        List<AudioDeviceInfo> devices = new ArrayList<>();

        try {

            if (Build.VERSION.SDK_INT >= 33) {

                AudioAttributes media = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();

                devices.addAll(am.getAudioDevicesForAttributes(media));
            } else {
                Collections.addAll(devices, am.getDevices(AudioManager.GET_DEVICES_OUTPUTS));
            }
        } catch (RuntimeException e) {
            return out;
        }

        for (AudioDeviceInfo info : devices) {

            int type = info.getType();
            boolean bt = type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
                || (Build.VERSION.SDK_INT >= 31
                && (type == AudioDeviceInfo.TYPE_BLE_HEADSET || type == AudioDeviceInfo.TYPE_BLE_SPEAKER));

            if (info.isSink() && bt && info.getAddress() != null) {
                out.add(info.getAddress().toUpperCase(Locale.ROOT));
            }
        }

        return out;
    }

    // Whether an address is among those media goes to. Android may hide the
    // first part of an address, so the end is what is compared
    private static boolean among(Set<String> routed, String address) {

        for (String r : routed) {

            if (r.equals(address) || (r.length() == 17 && address.length() == 17
                && r.substring(12).equals(address.substring(12)))) {
                return true;
            }
        }

        return false;
    }

    // What kind of device it is, from what it says it is: speaker,
    // headphones, carAudio, phone, computer, watch or other
    private static String kind(BluetoothDevice d) {

        BluetoothClass bc;

        try {
            bc = d.getBluetoothClass();
        } catch (RuntimeException e) {
            bc = null;
        }

        if (bc == null) {
            return "other";
        }

        int major = bc.getMajorDeviceClass();
        int device = bc.getDeviceClass();

        if (major == BluetoothClass.Device.Major.AUDIO_VIDEO) {

            if (device == BluetoothClass.Device.AUDIO_VIDEO_CAR_AUDIO) {
                return "carAudio";
            }

            if (device == BluetoothClass.Device.AUDIO_VIDEO_HEADPHONES
                || device == BluetoothClass.Device.AUDIO_VIDEO_WEARABLE_HEADSET
                || device == BluetoothClass.Device.AUDIO_VIDEO_HANDSFREE) {
                return "headphones";
            }

            return "speaker";
        }

        if (major == BluetoothClass.Device.Major.PHONE) {
            return "phone";
        }

        if (major == BluetoothClass.Device.Major.COMPUTER) {
            return "computer";
        }

        if (major == BluetoothClass.Device.Major.WEARABLE) {
            return "watch";
        }

        return "other";
    }

    // The name the phone shows for a device, the one given to it in the
    // phone's own settings first
    private static String name(BluetoothDevice d) {

        String n;

        try {

            n = Build.VERSION.SDK_INT >= 30 ? d.getAlias() : null;

            if (n == null || n.isEmpty()) {
                n = d.getName();
            }
        } catch (RuntimeException e) {
            n = null;
        }

        return n == null || n.isEmpty() ? d.getAddress() : n;
    }

    // The paired devices for the web view: each with its address, name,
    // kind, whether it is connected, whether music goes to it, what is being
    // done to it and how the last command went. Also whether the app may
    // see them and whether the helper that connects them is there
    static String devices(Context c) {

        Context app = c.getApplicationContext();
        boolean ok = BtWatch.permitted(app);
        BluetoothAdapter ba = adapter(app);
        JSONObject o = new JSONObject();
        JSONArray list = new JSONArray();

        try {

            boolean on = ok && ba != null && ba.isEnabled();

            o.put("permission", ok);
            o.put("available", ba != null);
            o.put("enabled", on);
            o.put("helper", Hotspot.helper(app));
            o.put("paired", HelperStart.paired(app));
            o.put("busy", BUSY.getOrDefault(ADAPTER, ""));
            o.put("last", LAST.getOrDefault(ADAPTER, ""));

            if (on) {

                openProfiles(app, ba);

                Set<String> media = routed(app);
                List<JSONObject> rows = new ArrayList<>();

                for (BluetoothDevice d : ba.getBondedDevices()) {

                    String a = d.getAddress() == null ? "" : d.getAddress().toUpperCase(Locale.ROOT);
                    int st = profileState(d);
                    boolean linked = st == BluetoothProfile.STATE_CONNECTED
                        || BtWatch.anyConnected(Collections.singleton(a));
                    JSONObject one = new JSONObject();

                    one.put("address", a);
                    one.put("name", name(d));
                    one.put("kind", kind(d));
                    one.put("connected", linked);
                    one.put("sound", soundConnected(d));
                    one.put("active", linked && among(media, a));
                    one.put("state", st == BluetoothProfile.STATE_CONNECTING ? "connecting"
                        : st == BluetoothProfile.STATE_DISCONNECTING ? "disconnecting" : "");
                    one.put("busy", BUSY.getOrDefault(a, ""));
                    one.put("last", LAST.getOrDefault(a, ""));
                    rows.add(one);
                }

                // Connected first, then the ones that play sound, then by name
                rows.sort((x, y) -> {

                    int cx = x.optBoolean("connected") ? 0 : 1;
                    int cy = y.optBoolean("connected") ? 0 : 1;

                    if (cx != cy) {
                        return cx - cy;
                    }

                    int sx = soundKind(x.optString("kind")) ? 0 : 1;
                    int sy = soundKind(y.optString("kind")) ? 0 : 1;

                    if (sx != sy) {
                        return sx - sy;
                    }

                    return x.optString("name").compareToIgnoreCase(y.optString("name"));
                });

                for (JSONObject one : rows) {
                    list.put(one);
                }
            }

            o.put("devices", list);
        } catch (JSONException | RuntimeException e) {
            return "{}";
        }

        return o.toString();
    }

    private static boolean soundKind(String kind) {
        return "speaker".equals(kind) || "headphones".equals(kind) || "carAudio".equals(kind);
    }

    // A command from the web view for one device, or "on" for Bluetooth
    // itself. Runs in the background, the list shows it going and how it
    // went. False for a command or address that is not one
    static boolean act(Context c, String what, String address) {

        String a = address == null ? "" : address.toUpperCase(Locale.ROOT);
        boolean adapterItself = "on".equals(what);

        if (!ACTIONS.contains(what) || (!adapterItself && !ADDRESS.matcher(a).matches())) {
            return false;
        }

        final Context app = c.getApplicationContext();
        final String key = adapterItself ? ADAPTER : a;
        final String target = adapterItself ? "" : a;

        // Already on its way, a second tap changes nothing
        if (BUSY.putIfAbsent(key, what) != null) {
            return true;
        }

        LAST.remove(key);

        final String who = adapterItself ? "Bluetooth" : nameOf(app, a);

        Hub.note("Bluetooth", who + ": " + what + " asked from the web view");

        RUN.execute(() -> {

            String answer;

            try {
                answer = Hotspot.bluetooth(app, what, target);
            } catch (RuntimeException e) {
                answer = "failed " + e;
            }

            LAST.put(key, answer);
            BUSY.remove(key);
            Hub.note("Bluetooth", who + ": " + answer);
        });

        return true;
    }

    // A device's name for the debug log, its address when it cannot be read
    private static String nameOf(Context app, String address) {

        BluetoothAdapter ba = BtWatch.permitted(app) ? adapter(app) : null;

        if (ba == null) {
            return address;
        }

        try {
            return name(ba.getRemoteDevice(address));
        } catch (RuntimeException e) {
            return address;
        }
    }
}
