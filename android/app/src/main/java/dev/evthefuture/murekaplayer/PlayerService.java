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
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.Icon;
import android.media.AudioAttributes;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.VpnService;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.view.KeyEvent;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONArray;
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

    // Pause when the Bluetooth output the music plays on goes away, and
    // whether the music plays in a browser rather than on the phone
    private boolean pauseOnDisconnect = false;
    private boolean soundInBrowser = false;

    // Start playing when a Bluetooth output connects: never, if it was
    // playing when the last one went away, or always. Android reports the
    // outputs already there as soon as the watcher is set up, which is not
    // a connection, so that first report is skipped
    private String playOnConnect = "never";
    private boolean firstDeviceReport = true;

    // Whether the music played as the last Bluetooth output went away, kept
    // on disk so a restart of the app in between does not lose it
    private static final String BT_PREFS = "bluetooth";
    private static final String BT_WAS_PLAYING = "wasPlaying";
    private AudioDeviceCallback deviceWatcher;

    // The cover of the playing song, fetched once per song
    private String artUrl = "";
    private Bitmap art;

    // A picture sent in between when the cover is sent again, so the real
    // cover after it is a change a head unit cannot skip. Drawn once, when
    // first needed
    private Bitmap loadingArt;

    // Counts the covers sent, so a newer send cancels a real cover still
    // waiting to follow the loading one
    private int artRound = 0;

    // How long the loading cover stays before the real one follows, time
    // for the head unit to fetch it
    private static final long ART_SWAP_MS = 2000;

    // How the cover is sent again, the player's setting under Developer:
    // "art" changes only the picture, "id" sends the loading cover as if it
    // were another song and the real cover as the song again, "title" also
    // adds a space to the title with the loading cover. Android only tells
    // the head unit about a new cover when the song's text changes, and in
    // a car tried only "title" brought a new cover, so it is the default.
    // And the playing song's id, for the song's identity
    private String coverResend = "title";
    private String songId = "";

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
        // Play, skips and seeks from here first take the sound back from a
        // browser: they come from Bluetooth, a steering wheel or the lock
        // screen, so the music is wanted from the phone. Pause does not, a
        // car pausing the phone as it switches to a browser must not undo
        // the switch
        session.setCallback(new MediaSession.Callback() {

            // A hardware button, from Bluetooth, a headset or a steering
            // wheel, before Android turns it into one of the calls below.
            // Only noted for the debug overlay, Android still handles it
            @Override
            public boolean onMediaButtonEvent(Intent intent) {

                KeyEvent key = keyOf(intent);

                if (key != null) {
                    Hub.note("Media", "Media button " + KeyEvent.keyCodeToString(key.getKeyCode())
                        + (key.getAction() == KeyEvent.ACTION_DOWN ? " down" : " up")
                        + (key.getRepeatCount() > 0 ? " repeat " + key.getRepeatCount() : ""));
                }

                return super.onMediaButtonEvent(intent);
            }

            @Override
            public void onPlay() {

                Hub.note("Media", "Media session: play");
                Hub.command("takeSound", null);
                Hub.command("play", null);
            }

            @Override
            public void onPause() {

                Hub.note("Media", "Media session: pause");
                Hub.command("pause", null);
            }

            @Override
            public void onStop() {

                Hub.note("Media", "Media session: stop");
                Hub.command("pause", null);
            }

            @Override
            public void onSkipToNext() {

                Hub.note("Media", "Media session: next");
                Hub.command("takeSound", null);
                Hub.command("next", null);
            }

            @Override
            public void onSkipToPrevious() {

                Hub.note("Media", "Media session: previous");
                Hub.command("takeSound", null);
                Hub.command("prev", null);
            }

            @Override
            public void onSeekTo(long pos) {

                Hub.note("Media", "Media session: seek to " + pos + " ms");
                Hub.command("takeSound", null);
                Hub.command("seek", pos / 1000.0);
            }

            // Not used for anything yet, noted so the debug overlay shows
            // what a car or headset sends
            @Override
            public void onFastForward() {
                Hub.note("Media", "Media session: fast forward, not used");
            }

            @Override
            public void onRewind() {
                Hub.note("Media", "Media session: rewind, not used");
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

        // Power saving, following the charger or chosen Bluetooth devices
        ChargeWatch.start(this);

        // The hotspot name and password once typed for Shizuku, not needed
        // any more
        CarSettings.dropRetired(this);

        // The hotspot helper started through wireless debugging when the
        // hotspot settings need it, after a restart of the phone too
        HelperStart.atStart(this);

        // The local name for other devices and the web view's fixed address
        applySettings();

        Hub.addListener(this);
    }

    // The key inside a media button intent. Android 13 has a typed way to
    // read it, older versions only the untyped one
    @SuppressWarnings("deprecation")
    private static KeyEvent keyOf(Intent intent) {

        if (intent == null) {
            return null;
        }

        if (Build.VERSION.SDK_INT >= 33) {
            return intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent.class);
        }

        return intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
    }

    // The background work stopped by the power saving: the covers fetched
    // ahead, the player's own background reading and caching, and the locks
    // keeping the CPU and Wi-Fi awake. The web view's server keeps running,
    // so a browser can still connect, at home on a computer say, and while
    // one is connected nothing is stopped. The music, playing or not, keeps
    // its own lock. quietWanted is what the power saving asks for, quiet
    // what is in force
    private boolean quietWanted = false;
    private boolean quiet = false;

    static void setQuiet(boolean on) {

        MAIN.post(() -> {

            if (instance != null) {

                instance.quietWanted = on;
                instance.applyQuiet();
            }
        });
    }

    // A browser of the web view came or went
    static void clientsChanged() {

        MAIN.post(() -> {

            if (instance != null && instance.quietWanted) {
                instance.applyQuiet();
            }
        });
    }

    private void applyQuiet() {

        int browsers = Hub.clients();
        boolean on = quietWanted && browsers == 0;

        if (on == quiet) {
            return;
        }

        if (quietWanted) {
            Hub.note("Power", on ? "no browser connected, the background work stops"
                : "a browser connected, the background work goes on");
        }

        quiet = on;
        CoverCache.setPaused(on);
        Hub.command("quiet", on);

        if (on) {

            if (!playing) {

                wakeLock.release();
                wifiLock.release();
            }

            if (clientLock != null) {
                clientLock.release();
            }
        }

        updateNotification();
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
    // A command for the player, from a Bluetooth button, the steering wheel,
    // the lock screen or a web view. With the music paused the phone holds
    // nothing awake, and a phone that has gone to sleep hands the command to
    // the page and sleeps again before the page gets to run it. It then ran
    // only once the screen was unlocked. Held for a while, the page gets the
    // time to start the music, and playing holds the phone awake by itself
    static void commandArrived() {

        PlayerService s = instance;

        if (s != null && s.clientLock != null) {
            s.clientLock.acquire(90 * 1000L);
        }
    }

    static void webViewActive() {

        PlayerService s = instance;

        // Even with the power saving on: a browser connecting ends it, and
        // the phone must stay awake long enough to see that
        if (s != null && s.clientLock != null) {
            s.clientLock.acquire(90 * 1000L);
        }
    }

    // Where other devices can open the web view, for the About page
    static JSONArray webAddresses() {

        PlayerService s = instance;

        return s != null && s.server != null ? s.server.describeAddresses(PORT) : new JSONArray();
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
        ChargeWatch.stop();
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
        coverResend = s.optString("coverResend", "title");
        songId = s.optString("id", "");
        pauseOnDisconnect = s.optBoolean("pauseOnDisconnect", false);
        playOnConnect = s.optString("playOnConnect", "never");
        soundInBrowser = s.optBoolean("carAudio", false);
        durationMs = (long) (s.optDouble("duration", 0) * 1000);

        long positionMs = (long) (s.optDouble("position", 0) * 1000);
        String cover = s.optString("cover", "");

        // The route can also change without a device coming or going, for
        // a call or an output picked by hand, so it is looked at again now
        // and then as the player reports
        if (System.currentTimeMillis() - lastBtCheck > 5000) {
            reportBluetooth();
        }

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

    // Send the song when something about it changed
    private void updateMetadata() {

        String key = metaKeyNow();

        if (key.equals(metaKey)) {
            return;
        }

        metaKey = key;
        pushMetadata(art, false);
    }

    // What the song sent last was, to tell a change from the same again
    private String metaKeyNow() {

        return title + "|" + subtitle + "|" + durationMs + "|" + (art != null);
    }

    // Hand the song to the media session with the given picture as its
    // cover, or none. Sent as another song, for the loading cover when the
    // setting asks for it, the song gets another id, and with "title" a
    // space after its title too, so the head unit takes it for a new song
    // and fetches its cover. Only while the setting is not "art" does the
    // song carry an id at all, so that way sends what it always did
    private void pushMetadata(Bitmap picture, boolean asOther) {

        boolean withId = !"art".equals(coverResend) && !songId.isEmpty();
        String shown = asOther && "title".equals(coverResend) ? title + " " : title;

        MediaMetadata.Builder b = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, shown)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, subtitle)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, shown)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, subtitle)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs);

        if (withId) {
            b.putString(MediaMetadata.METADATA_KEY_MEDIA_ID, asOther ? songId + ":cover" : songId);
        }

        if (picture != null) {
            b.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, picture);
        }

        session.setMetadata(b.build());
    }

    // Send the song again even though nothing about it changed. A head unit
    // ignores metadata it already has, and some also ignore a song sent
    // without a cover, so sending it first without one changed nothing. A
    // real picture that is not the cover goes out first, the loading ring,
    // and the real cover follows once the head unit has had time to fetch
    // it. Both are pictures it has not shown yet
    private void resendMetadata() {

        if (title.isEmpty()) {
            return;
        }

        final int round = ++artRound;

        pushMetadata(loadingArt(), true);

        // Counted as sent, so a state arriving meanwhile does not send the
        // real cover early and cut the loading one short
        metaKey = metaKeyNow();
        Hub.note("Cover", "loading cover sent" + resendWay() + ", the real one follows in " + (ART_SWAP_MS / 1000) + " s");

        main.postDelayed(() -> {

            if (round != artRound) {
                return;
            }

            pushMetadata(art, false);
            metaKey = metaKeyNow();
            Hub.note("Cover", art != null ? "real cover sent" : "the real cover has not loaded yet");
        }, ART_SWAP_MS);
    }

    // The debug buttons: "loading" sends only the loading cover, to see
    // whether the head unit shows a new picture at all, "real" sends the
    // song's own cover again. Either cancels a real cover still waiting
    static void testArt(final String which) {

        MAIN.post(() -> {

            if (instance != null) {
                instance.sendTestArt(which);
            }
        });
    }

    private void sendTestArt(String which) {

        artRound++;

        if (title.isEmpty()) {

            Hub.note("Cover", "nothing is playing");
            return;
        }

        boolean loading = "loading".equals(which);

        pushMetadata(loading ? loadingArt() : art, loading);

        // Stays until the song or its cover changes, so it can be looked at
        metaKey = metaKeyNow();

        if (loading) {
            Hub.note("Cover", "loading cover sent" + resendWay());
        } else {
            Hub.note("Cover", art != null ? "real cover sent" : "the real cover has not loaded, sent without one");
        }
    }

    // How the loading cover went out, for the debug overlay
    private String resendWay() {

        if ("id".equals(coverResend)) {
            return " as another song";
        }

        if ("title".equals(coverResend)) {
            return " as another song with a touched title";
        }

        return "";
    }

    // A dark square with a loading ring, the player's colours. Plainly not
    // a song's cover, and a picture of its own for the head unit
    private Bitmap loadingArt() {

        if (loadingArt != null) {
            return loadingArt;
        }

        final int size = 512;
        Bitmap bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
        RectF box = new RectF(156, 156, 356, 356);

        canvas.drawColor(Color.rgb(29, 29, 34));
        ring.setStyle(Paint.Style.STROKE);
        ring.setStrokeWidth(40);
        ring.setStrokeCap(Paint.Cap.ROUND);

        // The track of the ring, then the turning part over it
        ring.setColor(Color.rgb(58, 58, 66));
        canvas.drawArc(box, 0, 360, false, ring);
        ring.setColor(Color.rgb(72, 225, 235));
        canvas.drawArc(box, -90, 100, false, ring);

        loadingArt = bmp;

        return loadingArt;
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
                boolean first = firstDeviceReport;

                // Android moves the sound over a moment after a device
                // connects, so it is looked at again once it has
                reportBluetooth();
                main.postDelayed(PlayerService.this::reportBluetooth, 1500);

                firstDeviceReport = false;

                for (AudioDeviceInfo info : added) {

                    if (isBluetoothOutput(info)) {
                        bluetooth = true;
                    }
                }

                if (!bluetooth || first) {
                    return;
                }

                Hub.note("Bluetooth", "Bluetooth audio connected");

                if (!title.isEmpty()) {
                    main.postDelayed(PlayerService.this::resendMetadata, 1500);
                }

                // A moment for Android to move the sound over before it starts
                boolean start = "always".equals(playOnConnect)
                    || ("resume".equals(playOnConnect) && wasPlayingAtDisconnect());

                if (start) {
                    main.postDelayed(PlayerService.this::playForBluetooth, 2000);
                } else if ("resume".equals(playOnConnect)) {
                    Hub.note("Bluetooth", "Not playing, it was not playing when Bluetooth went away");
                }
            }

            // A Bluetooth output went away. With the setting on and the
            // music playing on the phone, it is paused, unless another
            // Bluetooth output is still there and takes the sound over
            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removed) {

                boolean bluetooth = false;

                reportBluetooth();

                for (AudioDeviceInfo info : removed) {

                    if (isBluetoothOutput(info)) {
                        bluetooth = true;
                    }
                }

                if (!bluetooth) {
                    return;
                }

                Hub.note("Bluetooth", "Bluetooth audio disconnected");

                for (AudioDeviceInfo info : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {

                    if (isBluetoothOutput(info)) {

                        Hub.note("Bluetooth", "Another Bluetooth output is still there, playing on");
                        return;
                    }
                }

                // The last one is gone. Remembered before any pause below,
                // for If it was playing on the next connection
                rememberPlaying(playing && !soundInBrowser);

                if (!pauseOnDisconnect || !playing || soundInBrowser) {
                    return;
                }

                Hub.note("Bluetooth", "Pausing, the Bluetooth output went away");
                Hub.command("pause", null);
            }
        };

        am.registerAudioDeviceCallback(deviceWatcher, main);
    }

    private void rememberPlaying(boolean was) {

        getSharedPreferences(BT_PREFS, MODE_PRIVATE).edit().putBoolean(BT_WAS_PLAYING, was).apply();
    }

    private boolean wasPlayingAtDisconnect() {

        return getSharedPreferences(BT_PREFS, MODE_PRIVATE).getBoolean(BT_WAS_PLAYING, false);
    }

    // Play on the Bluetooth output that just connected, unless the music
    // already plays. The sound is taken back from a browser first, or it
    // would play there and not be heard in the car or the headphones
    private void playForBluetooth() {

        if (playing) {
            return;
        }

        Hub.note("Bluetooth", "Playing, Bluetooth connected");
        Hub.command("takeSound", null);
        Hub.command("play", null);
    }

    // Bluetooth outputs: classic audio and, from Android 12, LE Audio
    // Tell the web view whether the music goes out over Bluetooth. From
    // Android 13 the phone says where media is routed right now, so a
    // Bluetooth device that is connected but not playing, say during a call
    // or with the sound switched to the phone, is not counted. Before that,
    // or if the phone will not say, a connected Bluetooth audio device is
    // taken as where the music goes, which is what Android does by itself
    private long lastBtCheck = 0;

    private void reportBluetooth() {

        AudioManager am = getSystemService(AudioManager.class);

        lastBtCheck = System.currentTimeMillis();

        if (am == null) {
            return;
        }

        AudioDeviceInfo out = null;
        boolean known = false;

        if (Build.VERSION.SDK_INT >= 33) {

            try {

                AudioAttributes media = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();

                for (AudioDeviceInfo info : am.getAudioDevicesForAttributes(media)) {

                    if (out == null && isBluetoothOutput(info)) {
                        out = info;
                    }
                }

                known = true;
            } catch (RuntimeException e) {
                known = false;
            }
        }

        if (!known) {

            for (AudioDeviceInfo info : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {

                if (out == null && isBluetoothOutput(info)) {
                    out = info;
                }
            }
        }

        String name = "";

        if (out != null) {

            try {

                CharSequence product = out.getProductName();

                name = product != null ? product.toString().trim() : "";
            } catch (RuntimeException e) {
                name = "";
            }
        }

        Hub.setBluetooth(out != null, name);
    }

    private static boolean isBluetoothOutput(AudioDeviceInfo info) {

        if (!info.isSink()) {
            return false;
        }

        int type = info.getType();

        if (type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) {
            return true;
        }

        return Build.VERSION.SDK_INT >= 31
            && (type == AudioDeviceInfo.TYPE_BLE_HEADSET || type == AudioDeviceInfo.TYPE_BLE_SPEAKER);
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

                if (bmp == null) {
                    Hub.note("Cover", "downloaded but could not be read");
                } else {
                    Hub.note("Cover", "loaded " + bmp.getWidth() + "x" + bmp.getHeight());
                }

                if (bmp != null && Math.max(bmp.getWidth(), bmp.getHeight()) > 512) {

                    float f = 512f / Math.max(bmp.getWidth(), bmp.getHeight());

                    bmp = Bitmap.createScaledBitmap(bmp, Math.round(bmp.getWidth() * f),
                        Math.round(bmp.getHeight() * f), true);
                }
            } catch (Exception e) {

                bmp = null;
                Hub.note("Cover", "could not load, " + e.getClass().getSimpleName()
                    + (e.getMessage() != null ? " " + e.getMessage() : ""));
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
