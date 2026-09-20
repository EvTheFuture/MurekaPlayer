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
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
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
// Bluetooth, the steering wheel buttons and the car's now playing talk to,
// and it runs the small web server the car browser connects to
public class PlayerService extends Service implements Hub.Listener {

    static final int PORT = 8080;

    private static final String CHANNEL = "playback";
    private static final int NOTIFICATION_ID = 1;

    private static final String ACTION_TOGGLE = "toggle";
    private static final String ACTION_NEXT = "next";
    private static final String ACTION_PREV = "prev";
    private static final String ACTION_QUIT = "quit";

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    private MediaSession session;
    private CarServer server;
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

    // The cover of the playing song, fetched once per song
    private String artUrl = "";
    private Bitmap art;

    // The car page addresses, looked up again now and then since the hotspot
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

        WifiManager wm = getApplicationContext().getSystemService(WifiManager.class);
        wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MurekaPlayer:stream");
        wifiLock.setReferenceCounted(false);

        startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);

        server = new CarServer(this, PORT);
        server.start();

        Hub.addListener(this);
        onState(Hub.state());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        String action = intent != null ? intent.getAction() : null;

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

        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {

        Hub.removeListener(this);

        if (server != null) {
            server.stop();
        }

        session.setActive(false);
        session.release();
        wakeLock.release();
        wifiLock.release();
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
        updateNotification();
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

    private void updateNotification() {

        String key = title + "|" + subtitle + "|" + playing + "|" + (art != null) + "|" + carText();

        if (key.equals(shownKey)) {
            return;
        }

        shownKey = key;
        getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, buildNotification());
    }

    // Where the car browser finds the player, one line for each network
    private String carText() {

        long now = System.currentTimeMillis();

        if (addresses == null || now - addressesAt > 10000) {

            addresses = CarServer.addresses(PORT);
            addressesAt = now;
        }

        if (addresses.isEmpty()) {
            return "Car page: switch on the hotspot or Wi-Fi";
        }

        return "Car page: " + String.join("  ", addresses);
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
