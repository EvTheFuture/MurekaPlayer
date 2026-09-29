# Changelog

## 2.0.0

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
- Exported settings include the app's own: Connections, the public address
  (VPN) and the local name, and Fullscreen. Importing them brings them back,
  asking about the VPN as when switched on by hand.
- Stays reachable when the phone lies still for a long time: the page's
  process is kept important, the player loads again by itself if Android ends
  it anyway, and **Run freely in the background** takes the app out of
  battery saving.
- Play, next and previous from Bluetooth, the steering wheel or the lock
  screen start the music with the screen off and the phone locked.
- **Resend art on resume** sends the cover again when playback picks up, for
  head units that drop it: first a loading ring as the cover, then the
  song's own cover two seconds later. The loading step goes out with an
  invisible change to the title, since Android only tells the car about a
  new cover when the song's text changes. **How the cover is sent again**,
  beside it, can also send the picture only or change just the song's id.
  A Bluetooth device that connects gets the song and cover again a moment
  later.
- **Play when Bluetooth connects**: Never, If it was playing (only when the
  music was playing as the last Bluetooth device went away) or Always.
- **Pause when Bluetooth disconnects**, so the music does not carry on from
  the phone's speaker. Leaves it alone when another Bluetooth device takes
  over or the music plays in a browser.
- An update of the app picks up where it was: the music stays in the
  browser it played in, and a song that was playing plays on from about
  where it was, whatever **Autoplay on start** says. A paused player stays
  paused.
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
- Pull the song list down at its top and let go to load new songs from
  Mureka, as in the mobile player, with a finger or by dragging with a
  mouse. The list stays open with a turning ring until the phone has
  loaded.
- A right click or a press and hold on a cover opens that song's menu, the
  playing song's on the middle cover, as on a row in the list.
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
  the web view goes away.
- The phone's sound choice shows a Bluetooth icon with the device's name
  while the phone's music goes out over Bluetooth, and a phone otherwise.
  From Android 13 it follows where Android actually sends media, so a car
  that is connected but not playing the music shows the phone.
- Volume slider for the phone's media volume, in Android's own steps, which
  over Bluetooth is usually the car stereo's level. The speaker icon follows
  the level, shown as a percentage or as steps. With the music in the browser
  it is the browser's own level.
- Keyboard shortcuts, including volume and mute, `?` lists them. Ctrl with
  left or right skips to the previous or next song, Shift with left goes to
  the start of the song and Shift with right to a second before its end.
  The browser gets a media session, so media keys, MPRIS and playerctl work.
- Export asks whether the file should be saved in the browser or on the phone.
- A phone opening the web view gets the mobile player's look: the header
  at the top, the covers with the lyrics, title, meta and stars laid over
  them, the seek bar, the transport and the song list under it on one
  screen, with the playing from line as the filter button over the list.
  Where the music plays is one button in the header with the three choices
  in a dropdown. Songs is left out, the list is always there.
- The screen goes off by itself after a while untouched while music
  plays. It has its own screen off settings under Web view, apart from the
  mobile player's: on or off, after how long, and the mark with its colour,
  size and how often it moves.
- **Settings for this browser**, at the top of the settings, lets one
  browser keep its own look. The settings it covers are marked with a dot
  where they always are, all under Web view, the order of the buttons
  included. While it is on, a change
  made in that browser applies there only, and the phone and other
  browsers keep theirs. Off by default: switched on, the settings are kept
  in that browser only, never sent anywhere, and switching it off deletes
  them.
- Tesla's fullscreen from its YouTube app is recognised. There the music moves
  to the browser without asking, and the steering wheel's left and right
  skip to the previous and next song instead of seeking.

### Mobile player, add-on and bookmarklet

- **Settings in pages.** The main settings page is a list of pages in
  groups: Views (Mobile player, and Web view in the app), Device (This device,
  and Connections in the app), Music (Library, Playback, Now playing), Data
  (Backup and restore) and Troubleshooting (Developer). Each group and most
  settings have a short explanation, and each section heading is underlined.
- **Trim** in the song menu for your own songs cuts the start or the end
  off, and Mureka makes a new song of it, keeping the original. The trimmer
  shows the song's real waveform: the whole song with the kept part lit and
  its ends to drag, and a close up of the start or the end that zooms from
  30 seconds down to 20 milliseconds, with steps of 10 ms, 100 ms and 1 s
  and typed times. The song's id, its length and the new length show under
  the title, with Trim beside it. **Play end** plays what the close up
  shows before the end and stops on the exact sample where the new song
  will end, **Repeat the end** plays it again and again while the end is
  moved, **Play** and **Pause** play the kept part and stop where it is,
  and a tap on the waveform plays from there. **Fade out the last second**
  fades the preview the way Mureka fades a trimmed song, once the end is
  moved. The new song gets a title of its own and is put at the top of the
  list, marked new. **Delete original**, ticked when confirming, deletes
  the original on Mureka and from the lists here once the new song has
  arrived. While Mureka works, a turning ring covers the page. The web
  view has the same trimmer in its song menu, drawn in the browser, with
  the phone fetching the song and sending the trim to Mureka.
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
- **Report plays to Mureka** also takes Mureka's new mark off a song played
  for the first time, as Mureka's own player does. Before, a song played
  here stayed marked as new on Mureka.
- Your own songs not played yet say **new** where the public or draft
  badge is, as Mureka marks them, in the song list, in the web view's list
  and queue and on its now playing screen. The badge goes back to public or
  draft once the song has been played with **Report plays to Mureka** on.
- **Export song library** under Backup and restore saves every song as the
  player keeps it, without covers or audio, in one compact file. Importing
  it on a new or cleared device fills the library at once instead of
  reading thousands of songs from Mureka again, and Load then picks up
  anything newer. A device that already has songs keeps them and only adds
  the missing ones. The import says so when the file is from another Mureka
  account. From the web view it can be saved in the browser or on the
  phone.
- **Counts max age** is set in minutes, 30 to start with instead of 4
  hours, so the plays, hearts and lyrics shown for a song are fetched from
  Mureka again sooner. A value changed from the old default carries over.
- Deleting the playing song from the list goes on to the next song, and
  a paused player stays paused on it. The covers used to show the deleted
  song's neighbours out of step. Deleting a song beside the playing one
  updates the covers beside it too.
- The dots for cached songs and covers show as soon as the list does when
  the player starts, from what was cached last time. Going through the
  cache itself took several seconds with thousands of songs; it now runs
  in the background and puts the dots right when it is done.
- **Waveform from**, under Mobile player: Mureka's, as before, or **From
  the song**, worked out from the song itself once it is cached, far more
  detailed and in the same colours: the peaks dim, and in front of them
  how loud the song sounds, bright. It is worked out once and kept, and
  Mureka's shows until the song is cached. The web view has the same
  choice of its own, under Web view.
- **Autoplay on start** moved to This device, under Playing by itself.
- Opening the app, or coming back to the page from another tab or app,
  takes the black screen cover away as a tap would, so the player shows
  at once.
- **Start with** can also be **As last time**, the list and artist the player
  showed when it was last used.
- **Remove ; from lyrics** takes Mureka's pause marks out of the lyrics
  everywhere they show.
- The song menu, from a long press or a right click, shows the song's number
  and title at the top, so it is clear which song it opened on.
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
- With numbers over the whole library, the two songs Mureka makes together
  are numbered in the order the list shows them, the upper one higher.
  They came out the wrong way round, 4008 above 4009.
- Large play and like counts are shortened, 1.0k, 12k, 1.2M.
- The tag list's **Popularity** sort is now called **Most songs**.
- **About Mureka Player**, a page of its own at the end of the settings,
  shows the version and whether the player runs as the app, the add-on or a
  bookmarklet. In the app it also lists every address other devices can open
  the web view on, each with its network (the phone's hotspot, its fixed
  address, a joined Wi-Fi, USB tethering, the local name) and whether that
  network is allowed.
- **Debug overlay** replaces the debug line: a see-through layer listing keys,
  taps, media buttons, commands, setting changes and playback events live,
  with the layout numbers at the top. It never takes a tap. **Copy debug
  log** copies it all, **Clear debug log** starts it again, in the web views
  too.
- **What the debug overlays log**: a switch for each kind of line, Keys and
  taps, Media buttons, Bluetooth, Cover, Playback, Commands, Screen and
  page, Setting changes, Network, Errors and Mureka requests (Bluetooth and
  Commands only in the app, where they happen), so the
  overlays and the copied log hold only what is being looked at. In the app
  it applies to the web view's overlay too. Mureka requests lists every
  request the page makes to Mureka, the player's and those of Mureka's own
  site, with what they send, what Mureka answered a play report or a
  request that changes something, and how many songs each list Mureka's
  site reads marks as new.
- **Cover test** under Developer replaces the artwork test button over the
  cover: **Send loading cover** and **Send real cover** send the playing song
  with a loading ring as its cover or with its own, to find out what a car or
  the lock screen takes. A button rings briefly when it has sent, red if
  nothing was playing. The debug overlay lists every cover sent and whether
  the cover downloaded. In the app the buttons send the way chosen under
  **How the cover is sent again**.

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
