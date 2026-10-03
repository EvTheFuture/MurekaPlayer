/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, pairing with wireless debugging and starting the hotspot
 * helper from the phone itself
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
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.RemoteInput;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import io.github.muntashirakon.adb.AdbPairingRequiredException;
import io.github.muntashirakon.adb.AdbStream;
import io.github.muntashirakon.adb.android.AdbMdns;

// The hotspot helper started from the phone, no computer needed. Paired
// once with wireless debugging, the app connects to the phone's own adb
// like a computer would and starts the helper with it. The first start also
// lets the app switch wireless debugging on and off, so later starts, after
// a restart of the phone, need nothing done: wireless debugging is switched
// on for the start and off again. Wireless debugging needs Wi-Fi, so the
// phone has to be on a Wi-Fi network for a start.
//
// Pairing: Android shows the pairing code in a dialog that closes as soon
// as another app is opened, so the code is typed into a notification of
// this app, the dialog stays open behind it
final class HelperStart {

    static final String CHANNEL = "helper";
    private static final int NOTE_ID = 4712;

    // Android's setting for wireless debugging, on or off
    private static final String ADB_WIFI = "adb_wifi_enabled";

    // Whether this app is paired, kept with the other settings
    private static final String PAIRED = "adbPaired";

    // How long the pairing dialog is waited for, and a wireless debugging
    // to connect to
    private static final long PAIR_WAIT_MS = 5 * 60 * 1000L;
    private static final long CONNECT_WAIT_MS = 15000L;

    // One pairing or start at a time, never on the main thread
    private static final ExecutorService RUN = Executors.newSingleThreadExecutor();
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private static AdbMdns pairSearch;
    private static Runnable pairTimeout;
    private static volatile int pairPort = -1;
    private static volatile String pairText = "";
    private static volatile String startText = "";
    private static volatile boolean starting = false;

    private HelperStart() {
    }

    static boolean paired(Context c) {
        return CarSettings.on(c, PAIRED);
    }

    // What pairing is doing, empty when it is not
    static String pairText() {
        return pairText;
    }

    // What the last start of the helper did
    static String startText() {
        return startText;
    }

    static boolean starting() {
        return starting;
    }

    // Whether the app may switch wireless debugging on and off itself,
    // given by the helper's first start
    static boolean canSwitchAdb(Context c) {
        return c.checkSelfPermission(Manifest.permission.WRITE_SECURE_SETTINGS) == PackageManager.PERMISSION_GRANTED;
    }

    // Pairing begins: Developer options open at wireless debugging, and the
    // pairing dialog is looked for
    static void pair(Context context) {

        final Context c = context.getApplicationContext();

        MAIN.post(() -> {

            stopPairSearch();
            pairPort = -1;
            pairText = "Waiting for Pair device with pairing code";
            note(c, false, null);
            openWirelessDebugging(c);

            pairSearch = new AdbMdns(c, AdbMdns.SERVICE_TYPE_TLS_PAIRING, (host, port) -> MAIN.post(() -> {

                if (pairSearch == null) {
                    return;
                }

                pairPort = port;

                if (port > 0) {

                    pairText = "Waiting for the pairing code";
                    note(c, true, null);
                } else {

                    pairText = "Waiting for Pair device with pairing code";
                    note(c, false, null);
                }
            }));
            pairSearch.start();

            // Given up after a while, nothing left waiting
            pairTimeout = () -> {

                if (pairSearch != null) {

                    stopPairSearch();
                    pairText = "";
                    cancelNote(c);
                    Hub.note("Helper", "pairing given up, the pairing dialog was not opened in time");
                }
            };
            MAIN.postDelayed(pairTimeout, PAIR_WAIT_MS);
        });
    }

    // Pairing stopped by hand, from the notification
    static void cancelPairing(Context context) {

        final Context c = context.getApplicationContext();

        MAIN.post(() -> {

            stopPairSearch();
            pairText = "";
            cancelNote(c);
        });
    }

    // The pairing code typed into the notification
    static void code(Context context, String code) {

        final Context c = context.getApplicationContext();
        final String digits = code == null ? "" : code.replaceAll("[^0-9]", "");
        final int port = pairPort;

        if (digits.length() != 6 || port <= 0) {

            pairText = port <= 0 ? "The pairing dialog is not open" : "The pairing code has six digits";
            MAIN.post(() -> note(c, port > 0, pairText));
            return;
        }

        pairText = "Pairing";
        MAIN.post(() -> note(c, false, null));

        RUN.execute(() -> {

            try {

                AdbLink.get(c).pair("127.0.0.1", port, digits);
                CarSettings.prefs(c).edit().putString(PAIRED, "1").apply();
                Hub.note("Helper", "paired with wireless debugging");

                MAIN.post(() -> {

                    stopPairSearch();
                    pairText = "";
                    cancelNote(c);
                });

                // Started straight away, that is what the pairing was for
                startNow(c);
            } catch (Throwable t) {

                Hub.note("Helper", "pairing failed, " + why(t));
                pairText = "Pairing failed, check the code and try again";
                MAIN.post(() -> note(c, pairPort > 0, pairText));
            }
        });
    }

    // Pairing forgotten, a new one is needed for the next start
    static void unpair(Context context) {

        final Context c = context.getApplicationContext();

        RUN.execute(() -> {

            CarSettings.prefs(c).edit().putString(PAIRED, "0").apply();
            AdbLink.forget(c);
            startText = "";
            Hub.note("Helper", "pairing forgotten");
        });
    }

    // When the player starts, also after a restart of the phone or an
    // update of the app: with the hotspot settings on and the helper not
    // running, it is started, after a moment for the network to come up
    static void atStart(Context context) {

        final Context c = context.getApplicationContext();

        if (!paired(c) || !CarSettings.on(c, CarSettings.CHARGE_SAVE)
            || !(CarSettings.on(c, CarSettings.UNPLUG_HOTSPOT) || CarSettings.on(c, CarSettings.PLUG_HOTSPOT))) {
            return;
        }

        MAIN.postDelayed(() -> start(c), 15000);
    }

    // The helper started, unless it already runs
    static void start(Context context) {

        final Context c = context.getApplicationContext();

        RUN.execute(() -> startNow(c));
    }

    private static void startNow(Context c) {

        if (!paired(c)) {

            startText = "Not paired with wireless debugging yet";
            return;
        }

        starting = true;

        try {

            say("Starting the helper");

            String answer = Hotspot.prove(c);

            if (answer.startsWith("ok")) {
                say("The helper is running");
            } else {
                say("The helper did not start" + (answer.isEmpty() ? "" : ": " + answer.replaceAll("\\s+", " ")));
            }
        } finally {
            starting = false;
        }
    }

    // One foreground helper command over wireless debugging. The line it
    // printed, or why it did not run. Not on the main thread
    static String once(Context c, String what) {

        if (!paired(c)) {
            return "Not paired with wireless debugging yet";
        }

        boolean switchedOn = false;
        AdbLink link = null;

        try {

            if (!adbWifiOn(c)) {

                if (!canSwitchAdb(c)) {
                    return "Wireless debugging is off, switch it on in Developer options and start again";
                }

                Settings.Global.putInt(c.getContentResolver(), ADB_WIFI, 1);
                switchedOn = true;
            }

            link = AdbLink.get(c);

            if (!link.isConnected()) {
                link.autoConnect(c, CONNECT_WAIT_MS);
            }

            if (!link.isConnected()) {
                return "Could not connect to wireless debugging";
            }

            return run(link, Hotspot.shellCommand(c, what)).replaceAll("\\s+", " ").trim();
        } catch (AdbPairingRequiredException e) {

            CarSettings.prefs(c).edit().putString(PAIRED, "0").apply();
            return "Wireless debugging does not know the player any more, pair again";
        } catch (InterruptedException e) {
            return "Wireless debugging was not found, is the phone on Wi-Fi?";
        } catch (Throwable t) {
            return "Could not start the helper, " + why(t);
        } finally {

            if (link != null) {

                try {
                    link.disconnect();
                } catch (IOException e) {
                    // Already gone
                }
            }

            if (switchedOn) {

                try {
                    Settings.Global.putInt(c.getContentResolver(), ADB_WIFI, 0);
                } catch (Throwable t) {
                    Hub.note("Helper", "could not switch wireless debugging off again, " + why(t));
                }
            }
        }
    }

    private static void say(String text) {

        startText = text;
        Hub.note("Helper", text);
    }

    // A shell command through the connection, what it printed
    private static String run(AdbLink link, String command) throws Exception {

        AdbStream stream = link.openStream("shell:" + command);
        ByteArrayOutputStream buf = new ByteArrayOutputStream();

        try (InputStream in = stream.openInputStream()) {

            byte[] b = new byte[1024];
            int n;

            while (buf.size() < 4096 && (n = in.read(b)) != -1) {
                buf.write(b, 0, n);
            }
        } catch (IOException e) {
            // The stream closes when the command is done
        } finally {
            stream.close();
        }

        return buf.toString(StandardCharsets.UTF_8.name()).trim();
    }

    // Unknown counts as on, the connection then tells
    private static boolean adbWifiOn(Context c) {

        try {

            ContentResolver cr = c.getContentResolver();

            return Settings.Global.getInt(cr, ADB_WIFI, 0) == 1;
        } catch (Throwable t) {
            return true;
        }
    }

    private static String why(Throwable t) {

        Throwable cause = t.getCause() != null ? t.getCause() : t;
        String msg = cause.getMessage();

        return cause.getClass().getSimpleName() + (msg == null || msg.isEmpty() ? "" : ": " + msg);
    }

    private static void stopPairSearch() {

        if (pairSearch != null) {

            try {
                pairSearch.stop();
            } catch (Throwable t) {
                // Already stopped
            }
        }

        pairSearch = null;

        if (pairTimeout != null) {

            MAIN.removeCallbacks(pairTimeout);
            pairTimeout = null;
        }
    }

    // Developer options, at wireless debugging where the phone allows it
    private static void openWirelessDebugging(Context c) {

        Intent open = new Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)
            .putExtra(":settings:fragment_args_key", "toggle_adb_wireless")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try {
            c.startActivity(open);
        } catch (ActivityNotFoundException e) {
            Hub.note("Helper", "Developer options could not be opened");
        }
    }

    // The pairing notification: waiting for the dialog, or asking for the
    // code with a field to type it in
    private static void note(Context c, boolean askCode, String problem) {

        NotificationManager nm = c.getSystemService(NotificationManager.class);

        if (nm == null) {
            return;
        }

        nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Hotspot helper", NotificationManager.IMPORTANCE_HIGH));

        PendingIntent cancel = PendingIntent.getBroadcast(c, 2,
            new Intent(c, PairReply.class).setAction(PairReply.ACTION_CANCEL),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = new Notification.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_note)
            .setContentTitle("Pairing with wireless debugging")
            .setOngoing(true)
            .setOnlyAlertOnce(!askCode)
            .addAction(new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_note), "Cancel", cancel).build());

        if (askCode) {

            RemoteInput input = new RemoteInput.Builder(PairReply.KEY_CODE).setLabel("Pairing code").build();

            // Mutable, Android fills in the code typed
            PendingIntent reply = PendingIntent.getBroadcast(c, 1,
                new Intent(c, PairReply.class).setAction(PairReply.ACTION_CODE),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);

            b.setContentText(problem != null ? problem : "Type the six digit pairing code shown in the dialog")
                .addAction(new Notification.Action.Builder(Icon.createWithResource(c, R.drawable.ic_note), "Enter code", reply)
                    .addRemoteInput(input).build());
        } else {
            b.setContentText(problem != null ? problem : pairText);
        }

        nm.notify(NOTE_ID, b.build());
    }

    private static void cancelNote(Context c) {

        NotificationManager nm = c.getSystemService(NotificationManager.class);

        if (nm != null) {
            nm.cancel(NOTE_ID);
        }
    }
}
