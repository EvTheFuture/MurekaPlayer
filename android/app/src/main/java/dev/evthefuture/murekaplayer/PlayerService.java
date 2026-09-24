/*
 * Mureka Player - load and play all your Mureka songs
 * Android host, keeps playing in the background and owns the media controls
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

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.Icon;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.VpnService;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

// A foreground service, so Android keeps the app and its WebView running with
// the screen off. It owns the media session, which is what the lock screen,
// Bluetooth, the steering wheel buttons and the web view's now playing talk to,
// and it runs the small web server the browser showing the web view connects to
public class PlayerService extends Service implements Hub.Listener {

    static final int PORT = 8080;

    private static final String CHANNEL = "playback";
    private static final String CHANNEL_SIGNIN = "signin";
    private static final int NOTIFICATION_ID = 1;
    private static final int SIGNIN_ID = 2;

    // Started by BootReceiver, the phone just started or the app was updated
    static final String ACTION_BOOT = "boot";

    private static final String ACTION_TOGGLE = "toggle";
    private static final String ACTION_NEXT = "next";
    private static final String ACTION_PREV = "prev";
    private static final String ACTION_QUIT = "quit";

    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    // The running service, for the settings panel and the VPN to reach
    private static PlayerService instance;

    // Held for a while after each request from a web view, so a phone left
    // left alone and gone to sleep wakes up for the web view and stays up
    // while it is in use, even with the music paused
    private PowerManager.WakeLock clientLock;

    private final Handler main = MAIN;
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private MediaSession session;
    private CarServer server;
    private MdnsResponder mdns;
    private WifiManager.MulticastLock multicastLock;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    // What is showing now, so the notification and the metadata are only
    // rebuilt when something the user can see has changed
    private String title = "";
    private String subtitle = "";
    private long durationMs = 0;
    private boolean playing = false;
    private String shownKey = "";
    private String metaKey = "";

    // Whether the player was playing at the last state, and whether it asks
    // for the cover to be sent again when it picks up
    private boolean wasPlaying = false;
    private boolean artOnResume = false;
    private AudioDeviceCallback deviceWatcher;

    // The cover of the playing song, fetched once per song
    private String artUrl = "";
    private Bitmap art;

    // Whether the foreground state has been claimed, and with which types
    private int foregroundTypes = 0;

    // Whether the sign in notification is showing
    private boolean signinShown = false;

    // The web view addresses, looked up again now and then since the hotspot
    // may be switched on after the app started
    private List<String> addresses;
    private long addressesAt = 0;

    @Override
    @SuppressWarnings("deprecation")
    public void onCreate() {

        super.onCreate();

        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Playback", NotificationManager.IMPORTANCE_LOW);

        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);

        // Asking to sign in is worth a sound and a heads up, playback is not
        NotificationChannel signin = new NotificationChannel(CHANNEL_SIGNIN, "Sign in",
            NotificationManager.IMPORTANCE_HIGH);

        nm.createNotificationChannel(signin);

        // The phone's media volume, so the web view can show and move it
        SysVolume.start(this);

        // Bluetooth coming back wants the song and its cover again
        watchAudioDevices();

        session = new MediaSession(this, "MurekaPlayer");
        session.setCallback(new MediaSession.Callback() {

            @Override
            public void onPlay() {
                Hub.command("play", null);
            }

            @Override
            public void onPause() {
                Hub.command("pause", null);
            }

            @Override
            public void onStop() {
                Hub.command("pause", null);
            }

            @Override
            public void onSkipToNext() {
                Hub.command("next", null);
            }

            @Override
            public void onSkipToPrevious() {
                Hub.command("prev", null);
            }

            @Override
            public void onSeekTo(long pos) {
                Hub.command("seek", pos / 1000.0);
            }
        });
        session.setSessionActivity(openAppIntent());
        session.setActive(true);

        PowerManager pm = getSystemService(PowerManager.class);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MurekaPlayer:playback");
        wakeLock.setReferenceCounted(false);
        clientLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MurekaPlayer:webview");
        clientLock.setReferenceCounted(false);

        WifiManager wm = getApplicationContext().getSystemService(WifiManager.class);
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MurekaPlayer:stream");
        wifiLock.setReferenceCounted(false);

        // Multicast has to be allowed through before the name can be
        // answered on Wi-Fi, a hotspot does not need it but it does no harm
        multicastLock = wm.createMulticastLock("MurekaPlayer:mdns");
        multicastLock.setReferenceCounted(false);

        try {
            multicastLock.acquire();
        } catch (RuntimeException e) {
            // Without it the name only works on the hotspot
        }

        server = new CarServer(this, PORT);
        server.start();

        instance = this;

        // The local name for other devices and the web view's fixed address
        applySettings();

        Hub.addListener(this);
    }

    // A web view setting changed in the player's settings panel
    static void settingsChanged() {

        MAIN.post(() -> {

            if (instance != null) {
                instance.applySettings();
            }
        });
    }

    // The VPN came up, went down or changed, show it in the notification
    static void carChanged() {

        MAIN.post(() -> {

            if (instance != null) {
                instance.updateNotification();
            }
        });
    }

    // A web view asked for something. The CPU stays awake for a minute and
    // a half after the last request, the web view asks at least every half
    // minute while it is open, so it is awake exactly while one is in use
    static void webViewActive() {

        PlayerService s = instance;

        if (s != null && s.clientLock != null) {
            s.clientLock.acquire(90 * 1000L);
        }
    }

    static String mdnsStatus() {

        PlayerService s = instance;

        return s != null && s.mdns != null ? s.mdns.status() : "off";
    }

    // Bring the name and the VPN in line with the settings. Only what
    // changed is restarted
    private void applySettings() {

        String name = CarSettings.mdnsName(this);

        if (mdns == null || !mdns.name().equals(name)) {

            if (mdns != null) {
                mdns.stop();
            }

            mdns = new MdnsResponder(name);
            mdns.start();
        }

        if (CarSettings.vpnEnabled(this)) {

            // Without the permission the settings panel asks for it, a
            // service cannot show the question itself
            if (VpnService.prepare(this) == null) {
                startCarVpn(CarVpn.ACTION_START);
            } else if (CarVpn.activeAddress() == null) {
                CarVpn.setStatus("needs permission, switch it off and on in the settings");
            }
        } else if (CarVpn.activeAddress() != null) {
            startCarVpn(CarVpn.ACTION_STOP);
        } else if (!"off".equals(CarVpn.status())) {
            CarVpn.setStatus("off");
        }

        updateNotification();
    }

    private void startCarVpn(String action) {

        try {
            startService(new Intent(this, CarVpn.class).setAction(action));
        } catch (RuntimeException e) {
            CarVpn.setStatus("could not start: " + e.getMessage());
        }
    }

    // The player's WebView. Built after the service is safely in the
    // foreground, and never allowed to take the service down with it, since
    // the web view has to work even if the page itself will not start
    private void ensurePlayer() {

        if (PlayerWeb.exists()) {
            return;
        }

        try {
            PlayerWeb.get(this);
        } catch (Throwable t) {

            main.postDelayed(this::ensurePlayer, 5000);
        }
    }

    // Claim the foreground state, or widen it. Android 15 does not let a boot
    // start claim media playback, so a boot start is a special use service
    // until the app is opened, which then adds media playback. The music
    // plays either way, the type only tells Android what the service is for
    private void goForeground(boolean fromBoot) {

        int types = fromBoot
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            : ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK | ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;

        // A boot start after the app already claimed more keeps what it has
        if (foregroundTypes != 0 && (foregroundTypes | types) == foregroundTypes) {
            return;
        }

        foregroundTypes |= types;

        try {
            startForeground(NOTIFICATION_ID, buildNotification(), foregroundTypes);
        } catch (RuntimeException e) {

            // Refused, most likely media playback from the background. Fall
            // back to what is always allowed rather than crashing
            foregroundTypes = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
            startForeground(NOTIFICATION_ID, buildNotification(), foregroundTypes);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        String action = intent != null ? intent.getAction() : null;

        // Every start must reach startForeground in time, the notification
        // buttons included, so this comes first
        goForeground(ACTION_BOOT.equals(action));
        ensurePlayer();

        if (ACTION_TOGGLE.equals(action)) {
            Hub.command("toggle", null);
        } else if (ACTION_NEXT.equals(action)) {
            Hub.command("next", null);
        } else if (ACTION_PREV.equals(action)) {
            Hub.command("prev", null);
        } else if (ACTION_QUIT.equals(action)) {

            Hub.command("pause", null);
            Hub.quit();
            stopSelf();
        }

        // Brought back by Android if it ever has to stop the service
        return START_STICKY;
    }

    @Override
    public void onDestroy() {

        Hub.removeListener(this);
        SysVolume.stop();

        if (deviceWatcher != null) {

            AudioManager am = getSystemService(AudioManager.class);

            if (am != null) {
                am.unregisterAudioDeviceCallback(deviceWatcher);
            }

            deviceWatcher = null;
        }
        instance = null;

        if (CarVpn.activeAddress() != null) {
            startCarVpn(CarVpn.ACTION_STOP);
        }

        if (server != null) {
            server.stop();
        }

        if (mdns != null) {
            mdns.stop();
        }

        if (multicastLock != null && multicastLock.isHeld()) {
            multicastLock.release();
        }

        getSystemService(NotificationManager.class).cancel(SIGNIN_ID);
        session.setActive(false);
        session.release();
        wakeLock.release();
        wifiLock.release();

        if (clientLock != null) {
            clientLock.release();
        }

        io.shutdownNow();
        stopForeground(STOP_FOREGROUND_REMOVE);

        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // A new state from the player, about once a second
    @Override
    public void onState(JSONObject s) {

        title = s.optString("title", "");
        subtitle = s.optString("subtitle", "");
        playing = s.optBoolean("playing", false);
        artOnResume = s.optBoolean("artOnResume", false);
        durationMs = (long) (s.optDouble("duration", 0) * 1000);

        long positionMs = (long) (s.optDouble("position", 0) * 1000);
        String cover = s.optString("cover", "");

        // Hold the CPU and the Wi-Fi awake while music plays, let them sleep
        // when it is paused
        if (playing) {

            wakeLock.acquire(6 * 60 * 60 * 1000L);
            wifiLock.acquire();
        } else {

            wakeLock.release();
            wifiLock.release();
        }

        session.setPlaybackState(new PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
                | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP
                | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                | PlaybackState.ACTION_SEEK_TO)
            .setState(title.isEmpty() ? PlaybackState.STATE_NONE
                : (playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED),
                positionMs, playing ? 1f : 0f)
            .build());

        if (!cover.equals(artUrl)) {

            artUrl = cover;
            art = null;
            fetchArt(cover);
        }

        updateMetadata();

        // Picking up again after a pause is where a head unit loses the
        // cover, and the metadata is the same as before, so nothing would be
        // sent without this
        if (playing && !wasPlaying && artOnResume) {
            resendMetadata();
        }

        wasPlaying = playing;
        updateNotification();
        updateSignin("no".equals(s.optString("signedIn", "unknown")),
            "yes".equals(s.optString("signedIn", "unknown")));
    }

    // Mureka turned the session down. An app in the background may not open
    // its own screen, so a notification asks, and a tap opens the app on the
    // sign in page. It goes away by itself once the player is signed in
    private void updateSignin(boolean signedOut, boolean signedIn) {

        NotificationManager nm = getSystemService(NotificationManager.class);

        if (signedOut && !signinShown) {

            signinShown = true;
            nm.notify(SIGNIN_ID, new Notification.Builder(this, CHANNEL_SIGNIN)
                .setSmallIcon(R.drawable.ic_note)
                .setContentTitle("Sign in to Mureka")
                .setContentText("The player is not signed in. Tap to open it and sign in.")
                .setContentIntent(openAppIntent())
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .build());
        } else if (signedIn && signinShown) {

            signinShown = false;
            nm.cancel(SIGNIN_ID);
        }
    }

    private void updateMetadata() {

        String key = title + "|" + subtitle + "|" + durationMs + "|" + (art != null);

        if (key.equals(metaKey)) {
            return;
        }

        metaKey = key;

        MediaMetadata.Builder b = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, subtitle)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, subtitle)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs);

        if (art != null) {
            b.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
        }

        session.setMetadata(b.build());
    }

    // Send the song again even though nothing about it changed. A head unit
    // ignores metadata it already has, so the song goes out without its
    // cover first and with it straight after, which is a change either way
    private void resendMetadata() {

        final Bitmap keep = art;

        art = null;
        metaKey = "";
        updateMetadata();
        art = keep;
        metaKey = "";

        main.postDelayed(() -> {

            metaKey = "";
            updateMetadata();
        }, 400);
    }

    // A car stereo or headphones that has just connected asks for the song
    // over AVRCP, and some ask too early, so it is sent again a moment after
    private void watchAudioDevices() {

        AudioManager am = getSystemService(AudioManager.class);

        if (am == null) {
            return;
        }

        deviceWatcher = new AudioDeviceCallback() {

            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] added) {

                boolean bluetooth = false;

                for (AudioDeviceInfo info : added) {

                    if (info.getType() == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) {
                        bluetooth = true;
                    }
                }

                if (!bluetooth || title.isEmpty()) {
                    return;
                }

                main.postDelayed(PlayerService.this::resendMetadata, 1500);
            }
        };

        am.registerAudioDeviceCallback(deviceWatcher, main);
    }

    private void updateNotification() {

        String key = title + "|" + subtitle + "|" + playing + "|" + (art != null) + "|" + carText();

        if (key.equals(shownKey) || foregroundTypes == 0) {
            return;
        }

        shownKey = key;
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification());
    }

    // Where a browser finds the player: the fixed public address when the
    // VPN is up, then the name and the addresses for other devices
    private String carText() {

        long now = System.currentTimeMillis();

        if (addresses == null || now - addressesAt > 10000) {

            addresses = CarServer.addresses(PORT);
            addressesAt = now;
        }

        if (server != null && !server.listening()) {
            return "Web view not running: " + server.status();
        }

        if (addresses.isEmpty() && CarVpn.activeAddress() == null) {
            return "Web view: switch on the hotspot or Wi-Fi";
        }

        String publicAddr = CarVpn.activeAddress();
        String name = "http://" + CarSettings.mdnsName(this) + ":" + PORT;
        String local = name + (addresses.isEmpty() ? "" : "  or  " + String.join("  ", addresses));

        if (publicAddr != null) {
            return "Web view: http://" + publicAddr + ":" + PORT + "  Local: " + local;
        }

        if (CarSettings.vpnEnabled(this)) {
            return "Public address " + CarVpn.status() + "  Local: " + local;
        }

        return "Web view: " + local;
    }

    private Notification buildNotification() {

        Notification.Builder b = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_note)
            .setContentTitle(title.isEmpty() ? getString(R.string.app_name) : title)
            .setContentText(subtitle.isEmpty() ? carText() : subtitle)
            .setSubText(subtitle.isEmpty() ? null : carText())
            .setContentIntent(openAppIntent())
            .setOngoing(true)
            .setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setStyle(new Notification.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2))
            .addAction(action(android.R.drawable.ic_media_previous, "Previous", ACTION_PREV, 1))
            .addAction(playing
                ? action(android.R.drawable.ic_media_pause, "Pause", ACTION_TOGGLE, 2)
                : action(android.R.drawable.ic_media_play, "Play", ACTION_TOGGLE, 2))
            .addAction(action(android.R.drawable.ic_media_next, "Next", ACTION_NEXT, 3))
            .addAction(action(android.R.drawable.ic_menu_close_clear_cancel, "Quit", ACTION_QUIT, 4));

        if (art != null) {
            b.setLargeIcon(art);
        }

        return b.build();
    }

    private Notification.Action action(int icon, String label, String act, int request) {

        Intent i = new Intent(this, PlayerService.class).setAction(act);
        PendingIntent pi = PendingIntent.getService(this, request, i,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new Notification.Action.Builder(Icon.createWithResource(this, icon), label, pi).build();
    }

    private PendingIntent openAppIntent() {

        Intent i = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);

        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // Download and shrink the cover off the main thread. A newer song that
    // arrives meanwhile wins, the late one is dropped
    @SuppressWarnings("deprecation")
    private void fetchArt(final String url) {

        if (url.isEmpty()) {
            return;
        }

        io.execute(() -> {

            Bitmap bmp = null;

            try {

                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();

                c.setConnectTimeout(10000);
                c.setReadTimeout(15000);

                try (InputStream in = c.getInputStream()) {
                    bmp = BitmapFactory.decodeStream(in);
                } finally {
                    c.disconnect();
                }

                if (bmp != null && Math.max(bmp.getWidth(), bmp.getHeight()) > 512) {

                    float f = 512f / Math.max(bmp.getWidth(), bmp.getHeight());

                    bmp = Bitmap.createScaledBitmap(bmp, Math.round(bmp.getWidth() * f),
                        Math.round(bmp.getHeight() * f), true);
                }
            } catch (Exception e) {
                bmp = null;
            }

            final Bitmap done = bmp;

            main.post(() -> {

                if (url.equals(artUrl) && done != null) {

                    art = done;
                    updateMetadata();
                    updateNotification();
                }
            });
        });
    }
}
