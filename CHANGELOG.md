# Changelog

## 1.7.0

The big news is a new Android app. It runs the same player as the add-on and
the bookmarklet, keeps playing with the screen off, and serves a web view that
any browser on the phone's hotspot or Wi-Fi can open: a car's browser, a
laptop or a tablet. The add-on and the bookmarklet get the song management,
the new settings layout and a number of smaller improvements.

### New: Mureka Player for Android

- Runs mureka.ai with the shared `src/player.js` in its own WebView, so the
  app, the add-on and the bookmarklet are the same player.
- Keeps playing with the screen off and with the app closed. A foreground
  service owns the media session, so the lock screen, Bluetooth, steering
  wheel buttons and the car's own now playing screen control it. The
  notification shows the web view's address and has Quit.
- Starts by itself when the phone starts and after an update, so the web view
  is there without opening the app. Posts a "Sign in to Mureka" notification
  when Mureka turns the session down.
- Fullscreen by default: Android's status and navigation bars are hidden
  while the player is on screen, using the whole screen including the strip
  beside a camera cutout. Can be turned off under Mobile player.
- Export uses Android's own save dialog, or Downloads when nobody is there to
  answer. Import picks a file the same way.
- Stays reachable when the phone lies still for a long time: the page's
  process is kept important, the player loads again by itself if Android ends
  it anyway, and **Run freely in the background** takes the app out of
  battery saving.
- Play, next and previous from Bluetooth, the steering wheel or the lock
  screen now start the music with the screen off and the phone locked,
  without the screen having to stay on.
- **Resend art on resume** sends the cover again when playback picks up, for
  head units that drop it. A Bluetooth device that connects gets the song
  and cover again a moment later.
- **Play when Bluetooth connects**: Never, If it was playing (only when the
  music was playing as the last Bluetooth device went away) or Always.
- **Pause when Bluetooth disconnects**, so the music does not carry on from
  the phone's speaker. Leaves it alone when another Bluetooth device takes
  over or the music plays in a browser.
- A play, skip or seek from Bluetooth, the steering wheel or the lock screen
  takes the sound back from a browser to the phone, so a car that falls back
  to Bluetooth is never left silent.

### New: the web view

- Served by the app on port 8080. Only the phone's hotspot and Wi-Fi networks
  may open it, never the mobile network, and **Allow from the phone's
  hotspot** and **Allow from Wi-Fi networks** choose which.
- **Public address (VPN)** gives the phone the fixed address 3.3.3.3, since
  Tesla's browser refuses private addresses: `http://3.3.3.3:8080` works
  every time. Other devices can use `http://murekaplayer.local:8080`, and the
  name can be changed.
- Now playing like the phone: sliding covers with the neighbours peeking out,
  synced rolling lyrics beside or on the cover, half stars, like with the
  number of hearts, plays, a Public or Draft badge, up next, **Playing from**
  with the source and filters, the waveform seek bar and the status line.
- Transport bar with its own order, set with press and hold or the editor in
  the settings, and optional names under the buttons.
- Song list with the Mureka, Queue and A-Z views, sorting by A to Z, stars
  and plays, search, play next (a second press takes it back out), likes,
  and the phone's song menu on press and hold or right click.
- Drag and drop in the queue, for any song including played ones. The playing
  song keeps playing wherever it goes.
- The phone's own settings, filters and artists panels, shown with large
  controls. Every tap goes through the same control on the phone.
- **Update** chip with Load new songs, Rescan the whole library and Stop.
  While the phone works, a line shows progress, how long it has taken and
  about how long is left, and a thin bar on the main screen shows it too.
  A load or rescan that cannot reach Mureka turns red with the reason.
- Sound: **Phone / Bluetooth**, **This browser** (the browser plays, the phone
  follows silently and stays in charge) or **No music in this browser** for a
  second browser that should stay quiet. The phone takes the sound back if
  the web view goes away. A phone that gets stuck while the browser plays no
  longer loops the start of the song.
- Volume slider for the phone's media volume, in Android's own steps, which
  over Bluetooth is usually the car stereo's level. The speaker icon follows
  the level, shown as a percentage or as steps. With the music in the browser
  it is the browser's own level.
- Keyboard shortcuts, including volume and mute, `?` lists them. The browser
  gets a media session, so media keys, MPRIS and playerctl work.
- Export asks whether the file should be saved in the browser or on the phone.
- Tesla's fullscreen from its YouTube app is recognised. There the music moves
  to the browser without asking, and the steering wheel's left and right
  skip to the previous and next song instead of seeking.

### Mobile player, add-on and bookmarklet

- **Settings in pages.** The main settings page is a list of pages in
  groups: Views (Mobile player, and Web view in the app), Device (This device,
  and Connections in the app), Music (Library, Playback, Now playing), Data
  (Backup and restore) and Troubleshooting (Developer). Each group and most
  settings have a short explanation, and each section heading is underlined.
- **Rename**, **Publish** and **Unpublish** in the song menu for your own
  songs, and **Allow remixing** or **No remixing** for songs with lyrics.
  When Mureka refuses a change on a published song, the player offers to take
  it down, make the change and publish it again.
- The song information shows whether remixing is allowed, and a running bar
  while the details are fetched from Mureka, in red with the reason if that
  fails.
- A load or rescan that cannot reach Mureka turns the Load or Rescan button
  red and keeps the reason on the status line, instead of a summary that
  looked like success.
- **Keep the screen on**: Never, While playing or Always, under This device.
  A paused player no longer keeps the screen on for good.
- **Previous restarts the song**, with **Seconds before it restarts** (3 to
  start with). Applies to every previous button, from the player, the lock
  screen, Bluetooth, a steering wheel and the web view. Turn it off to always
  go to the previous song.
- **Autoplay on start** moved to This device, under Playing by itself.
- **Start with** can also be **As last time**, the list and artist the player
  showed when it was last used.
- **Remove ; from lyrics** takes Mureka's pause marks out of the lyrics
  everywhere they show.
- A **Stars** view sorts the list by rating.
- Play next can be taken back, and the song returns to where it was in the
  queue.
- A queue saved under other filters is rebuilt from the current filters when
  the player starts.
- A song change from a button, Bluetooth or the end of a song slides the
  covers like a swipe.
- The buttons show their state the same way everywhere: filled when on or
  narrowing things down, ringed for all songs or something paused or running,
  plain when off. Play is filled while playing, ringed while paused and plain
  when stopped. Repeat all is filled, repeat one ringed.
- Large play and like counts are shortened, 1.0k, 12k, 1.2M.
- The tag list's **Popularity** sort is now called **Most songs**.
- **About Mureka Player**, a page of its own at the end of the settings,
  shows the version and whether the player runs as the app, the add-on or a
  bookmarklet. In the app it also lists every address other devices can open
  the web view on, each with its network (hotspot, the fixed hotspot
  address, Wi-Fi, USB, the local name) and whether that network is allowed.
- **Debug overlay** replaces the debug line: a see-through layer listing keys,
  taps, media buttons, commands, setting changes and playback events live,
  with the layout numbers at the top. It never takes a tap. **Copy debug
  log** copies it all.

### Build

- New `android/` folder and a root `Makefile`: `make all` runs the checks,
  builds the extension packages and the release APK, `make install` installs
  the release APK, `make install-debug` the debug one. The JDK is found by
  itself and the manifest is brought to the player's version first.
- The first build asks which key signs the APKs, suggesting the one it
  finds in `~/.android`, checks its password and keeps the answers in
  `android/keystore.properties`, which git ignores. `make signing` asks
  again. `make release` saves the APK as `mureka-player-<version>.apk` with
  a SHA-256 file and shows who signed it. Debug builds use the same key, so
  both install over each other.
- `adb-reconnect.sh` reconnects adb to a phone over the network.

### Known limits

- Google sign in inside the app's WebView may still be refused by Google.
- Anyone on the same network can open the web view. Turn off **Allow from
  Wi-Fi networks** to keep it to the phone's hotspot.
- The Tesla greys out next and previous while a normal browser page plays the
  music. **Offer seeking to the browser**, under Developer, is there to test
  whether it changes that.
