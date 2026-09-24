# Mureka Player for Android

A small app that runs mureka.ai in its own WebView with the shared
`src/player.js`, keeps playing with the screen off, and serves a web view on
the phone's hotspot. A browser in the car opens that page and becomes the
remote: now playing, cover, stars, like, play and pause, previous and next,
seeking, shuffle and repeat, the queue, a song list with search and Play
next, and the player's own settings, all the filters and the artists.

## How it fits together

- **PlayerWeb** owns the one WebView the player runs in. It loads
  https://www.mureka.ai/, tags the page with `data-mureka-host="apk"` and
  injects the player from the app's assets. The build copies
  `../src/player.js` into the assets, so there is only one copy of the player.
  The WebView belongs to the app, not to the screen, so it keeps running with
  the app closed.
- **PlayerService** is a foreground service and creates the WebView. It owns
  the Android media session (lock screen, Bluetooth, steering wheel buttons,
  the vehicle's own now playing), runs the web view server and shows its address
  in the notification. When Mureka turns the session down, it posts a "Sign
  in to Mureka" notification that opens the app.
- **BootReceiver** starts the service when the phone starts and after the
  app is updated, so the web view is there without opening the app.
- **MainActivity** only shows the WebView. Closing it leaves the music and
  the web view running, Quit in the notification ends everything.
- **CarVpn** is a VPN that carries no traffic. It only gives the phone one
  extra address that is not private, 3.3.3.3 unless changed, since Tesla's
  browser refuses private addresses. See "Use in the car".
- **MdnsResponder** answers to `murekaplayer.local`, or the name set in the
  settings, so laptops and tablets on the hotspot or Wi-Fi find the page by
  name. Tesla's browser does not look up local names. It is plain Java, no
  Android classes, and answers with the phone's address on whichever network
  the question came from.
- **CarSettings** holds the web view settings and checks every value.
- **CarServer** listens on port 8080, retrying every 5 seconds if the port is
  busy, and the notification says so when it is not listening. `GET /` is the
  web view, `GET /state?since=` the now
  playing state, answered as soon as there is a newer one than `since`, `GET /list?q=&offset=&limit=` a page of the song
  list, `GET /queue?q=` the whole queue,
  `GET /panel?name=settings|filters|creators` a copy of one of the player's
  panels, and `POST /cmd` runs a command in the player.
- **Hub** passes the player's state out and the commands back in.

Android only delivers the boot broadcast to an app that has been opened at
least once since it was installed, so open it once after installing.

## Queue, settings, filters and artists

- In the Mureka view the chip row ends with **Update**, which opens a small
  menu with Load new songs and Rescan the whole library, the rescan asking
  first. While one runs the chip says Loading or Rescanning and the menu
  offers Stop. After a try that could not reach Mureka it turns red and says
  Load failed or Rescan failed. It is gone in the queue.
- The song list button opens the songs with the same views as the phone:
  **Mureka**, **Queue** and **A-Z**. The queue shows all of it, played songs
  dimmed. Tap a song to jump to it, the cross takes an upcoming song out.
  **Now playing** scrolls to the current song, the round button jumps to the
  top or the end, and covers load as the rows scroll into sight.
- In the queue, the handle at the start of any song, played, playing or still
  to come, drags it to another place, played songs included. The playing
  song keeps playing wherever it goes. The songs it passes slide out of the
  way, and the list
  scrolls when the song is held near its top or bottom. With a mouse the
  whole row drags too. The queue's own order only: while it is sorted or
  searched the handles are dimmed and a tap on one says why.
- Plays and hearts over a thousand show short, 1.0k, 1.3k, 12k, 1.2M.
- The button at the end of a song in the list plays it next, a tick shows
  it is, and a second press takes it out of play next again, back where it
  was in the queue. The heart in each row likes or unlikes the song, as on
  the phone.
- The transport row has its own order, set under Settings, Web view, with
  the same buttons the phone offers: stop, published, vocals and rate. Press and hold a button to move it, or use the
  transport bar editor in Settings to move, add and take out buttons.
- Press and hold a song, or right click it, for the phone's song menu: play,
  play next, add to queue, refresh, download, copy link, information,
  instrumental, set BPM, cache or remove from cache, delete from the list and
  the stars.
- The phone's keyboard shortcuts work here too, `?` lists them. The
  player's version stands small at the foot of that list and of the actions
  menu.
- The menu button next to Settings has load, rescan, clear, cache all,
  playlists, creators, screen off and fullscreen, and under the playing
  song's title the long press choices for it: refresh, download, copy link,
  information, mark instrumental, set BPM, rate, cache and delete.
- Synced lyrics roll like the phone's, five rows that grow, brighten and
  fade as they turn past, beside the cover or on it. Size, side lines,
  spacing and side offset are under Settings, Web view, and start out as
  the mobile player has them. A swipe on the cover plays the song on the
  cover that came in, also when paused.
- On a narrow page the title and stars move in over the right third of the
  playing cover, which darkens there so the text stays readable. The title,
  the second line, up next and the status line walk across with the phone's
  easing when they do not fit, instead of being cut off.
- Most settings have a short explanation under them, on the phone and on
  the web view. The web view's settings scroll in a box that reaches the right
  edge, so the scrollbar never lies over the buttons.
- **Remove ; from lyrics** in the settings takes the semicolons out of the
  lyrics everywhere they show.
- Song rows look like the phone's list: the cache dot, the number, the cover, the title,
  the rating once any song is rated, the heart, the length, and public or
  draft when both are listed.
- The covers slide like the phone's, blurred and blended at the sides. The
  next cover peeks out behind the title and stars, with up next under the
  title. Five covers take part, so while one moves in the next one behind
  it grows and fades in to take its place, and the one on the far side
  fades out. The covers reach out over the page margin and fade out towards
  the screen edge. Swipe the strip, or tap a neighbour, for that song. A
  song change from a button, Bluetooth or the end of a song slides the
  covers the same way in 300 ms, on the web view and on the phone.
- Previous always goes to the previous song, also a few seconds into one.
- A queue saved under other filters, vocals only then and all now for one,
  is built again from what the filters admit now when the player starts.
- **A-Z** sorts the view shown, Mureka's songs or the queue, and a second
  press puts it back in its own order. The list opens at the playing song,
  highlighted like on the phone, and Now playing loads down to it. Played
  rows in the queue line up with the ones that can be taken out.
- Anything still loading shows a turning glyph, the list, the queue, the
  panels and the library while the phone loads it from Mureka.
- The title and stars keep their place whether a song has lyrics or not.
- **Playing from**, a line under up next, names where the queue comes from:
  published or all songs, an artist, a playlist, vocals or instrumental and
  the filters. A tap opens the choices for all of them, applied at once,
  with Edit filters, Artists, Playlists and the song list one tap further.
  The actions menu has it too.
- Filter buttons react at once, the phone catches up after. The number of
  hearts the song has on Mureka shows beside the heart.
- **A-Z** and **Stars** sort the song list step by step: A to Z, Z to A,
  own order, and stars 1 to 5, 5 to 1, own order. Not rated songs come
  last. The phone's list has Stars as a view too. The list's top row is
  grouped: List, Sort and Now playing. Scrolling to the top, the end or the
  playing song eases in and out.
- Up next sits in the lower left corner of the playing cover, Playing from
  right under the stars, and the song's plays and hearts beside the heart.
- **Plays** sorts the song list by how often songs were played, fewest or
  most first, like Stars. The count is known for songs whose details the
  phone has fetched, the others come last. An arrow on the chip shows the
  direction. The filter row is grouped too: Songs, one button for all,
  vocals or instrumental, Library and Filters.
- The song information keeps the lyrics' lines and capitals, and its names
  and values line up in two columns.
- Lyric size in the web view follows the page, so it looks the same in the
  browser and on a large screen.
- The web view hears of song changes at once, also with the phone's screen
  off or the app in the background. In fullscreen, Escape closes the page's
  own dialogs where the browser allows it, holding it leaves fullscreen.
- **Start with** in the settings can also be **As last time**, the list and
  artist the player was showing when it was last used.
- **Up next**, the **waveform seek bar**, where the lyrics go, the names
  under the buttons and the web view's own transport bar are set on the phone
  under Settings, Web view. See "Settings pages" below for where everything
  else lives.
- **Fullscreen** on the main screen, where the browser offers it.
- **Settings** on the main screen, and **Edit filters** and **Artists** in the
  song list, show the phone's own panels with large controls. They are read
  from the player itself, so everything the phone has is there, and every
  tap goes back through the same control on the phone. Filters need Apply
  filters, as on the phone. Artists picks your own library or a creator.

## Who may open the web view

Only the local network, never the mobile network:

- The sender has to be on the hotspot or a Wi-Fi the phone is on, and ask
  for one of the phone's addresses on that network or for the public address.
- Requests arriving on a cellular interface are refused, IPv6 included.
- In the app's settings, under Connections, "Allow from the phone's hotspot"
  and "Allow from Wi-Fi networks" pick which of the two are allowed. Both
  are on from the start. These two rows are not shown on the web view, so
  a browser cannot lock itself out.

## Fullscreen

The player's fullscreen works in the app. The status and navigation bars
step aside and a swipe from the edge brings them back for a moment. Back
leaves fullscreen.

## Sound in the car

The web view has a Sound switch:

- **Phone / Bluetooth**, the phone plays and the car speakers get it over
  Bluetooth. The web view is only the remote.
- **This browser**, the browser plays the song itself. The phone keeps
  playing at a volume too low to hear and stays in charge of the queue, the
  web view follows its position. Not muted, since Android stops muted media
  in the background, which paused the song and broke the next one. If the web view goes away for 8 seconds, the phone takes the
  sound back.

## Build

Needs JDK 17 or newer and the Android SDK with platform 36. On Ubuntu:

```sh
#!/bin/sh
sudo apt install -y openjdk-21-jdk \
    google-android-platform-36-installer \
    google-android-build-tools-36.0.0-installer \
    google-android-platform-tools-installer
```

From the repository root the Makefile does the rest, it finds the JDK, writes
`local.properties` and runs Gradle:

```sh
#!/bin/sh
make release          # app/build/outputs/apk/release/app-release.apk
make install          # build the release APK and put it on the connected phone
make install-debug    # the same with the debug APK
make all              # checks, extension packages and the release APK
```

Or by hand, from this folder:

```sh
#!/bin/sh
echo "sdk.dir=/usr/lib/android-sdk" > local.properties
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew assembleDebug
```

Ubuntu's own `gradle` package is far too old, the wrapper in this folder
fetches the Gradle it needs. The app version comes from `VERSION` in
`src/player.js`, so there is nothing to bump here.

## Use in the car

Tesla's browser has refused private addresses (10.x, 172.16 to 31.x,
192.168.x) since at least 2015, and a hotspot only hands out private ones.
So the app can give the phone a fixed address that is not private:

1. In the player's settings, under Connections, switch on "Public address
   (VPN)". Android asks once whether the app may run a VPN.
2. Switch on the phone's hotspot and connect the car to it.
3. In the car's own browser open `http://3.3.3.3:8080` and bookmark it. It is the
   same every time, whatever address the hotspot picked.

How it works: the VPN has no traffic and only this app inside it. It exists
so Android assigns the address to the phone. The car sends requests for
3.3.3.3 to its gateway, the phone, and since the address is the phone's own
they go straight to the web view server. The hotspot, the car's internet and
every other app are not touched. The Android Auto in the browser apps have
used the same address for years.

- The address can be changed in the settings. Private, loopback, carrier
  grade NAT and multicast addresses are refused. 198.18.0.1 is a clean
  alternative nobody uses, but it is not confirmed to work in a Tesla.
- Android allows one VPN at a time. Starting another VPN app turns this one
  off, and the settings say so. Switch it off and on to get it back, Android
  asks again.
- The notification shows the public address when it is up, and the local name
  and addresses for other devices.

Other devices, a laptop for one, open `http://murekaplayer.local:8080` or the
plain address from the notification. The name can be changed in the
settings, `.local` is added.

## Known limits in this first version

- Google sign in runs in the app's WebView with the WebView markers taken
  out of the user agent. Google may still refuse it.
- Anyone on the same network can open the web view and control the player.
  On the phone's own hotspot that is only the car. Turn off "Allow from
  Wi-Fi networks" to keep it to the hotspot.

## Publishing and renaming

The song menu, long press on the phone and the same menu in the web view,
has **Rename** and **Publish** or **Unpublish** for your own songs. Renaming
asks for the new title, on the phone in a plain box and in the web view in a
field in the menu. Publishing sends the song's title and cover with it,
taking it down sends only the song. Mureka decides the outcome, so the song
is read back from it afterwards and the list shows what Mureka really has. A
refused change goes back to what it was and the status line says so. Another
creator's songs have neither choice.

## How the buttons show what is going on

Filled cyan means a real choice that narrows things or a toggle that is on.
Ringed, cyan text and icon with a cyan line drawn inside the button over its
usual background, so nothing moves, means the whole library or something
simply running:

- **Play** is filled while the music plays, ringed while it is paused and
  an ordinary button with nothing loaded.
- **Published** is filled for published songs only and ringed for all
  songs. **Vocals** is filled for vocals or instrumental only and ringed for
  all. The same goes for the two chips in the song list.
- **Songs** is ringed when the library is narrowed by a style, mood, model,
  tempo, date or rating filter, or by a playlist. The vocals choice is not
  counted as a filter.
- **Load** and **Rescan** are ringed while they run.
- **Repeat** is filled for repeat all and ringed for repeat one.

## Sound here, there or nowhere

The sound switch has a third button, **No music in this browser**. It is
this browser's own choice: nothing is sent to the phone, so the phone and
any other browser go on exactly as before. It is meant for two browsers
open at once, where only one of them should play. Each browser tells the
phone who it is when it asks for the state, so the phone knows how many are
connected, and the button stays greyed while this is the only one, since
turning the sound off there would leave nothing playing it. Choosing Phone
or This browser again lifts it. When a page opens with the music set to play
in the browser, the start prompt offers the same choice beside Play the music
here and Use the phone instead, as long as another browser is connected.

A **Public** or **Draft** badge for the playing song, the same as in the
list, sits on the line of the stars and counts, so the second line under the
title never moves. It is left out for another creator's songs, which are all
public.

## What the phone is working on

Above the list the web view shows what the phone is doing: loading new
songs, rescanning the library or caching songs. A rescan reads the library
again, so what it had before is about what it will have after, and caching
knows exactly how many songs it will fetch. Both show a bar, "90 of about
300" and "45 of 60". A quick load has no number to go by and only turns its
glyph. The line also says how long it has been going, and once there is a
pace to go by, about how long is left.

The main screen shows it too, without words: a thin bar level with the foot
of the playing cover, starting where the song's title starts and ending with
a turning update icon. A quick load, whose size is not known, shows only the
turning icon.

When a Load or Rescan cannot reach Mureka, a name that does not resolve,
no network, a server error or no answer in time, the line says so in red
with the reason, the Update chip turns red, and the Songs button on the main
screen gets a red dot. The phone's own Load and Rescan buttons turn red too
and the status line keeps the reason. The next one that gets through clears
it all.

The information dialog shows a line with a running bar while it gets a
song's details from Mureka, and says in red why when that fails.

In the actions menu and the song menu, Remove from cache and Delete from
list always share a row: an empty cell finishes the row before them when
needed.

## Remixing

The song menu has **Allow remixing** or **No remixing**, Mureka's own
switch for whether other people may remix the song. It is offered only for
songs Mureka itself counts as having lyrics, and the instrumental mark set
by hand in the player has no say in that. The
information dialog shows where it stands, as Allowed, Not allowed, or a dash
when the song was cached before the player kept the field. Opening the
information for a song reads it from Mureka and remembers it.

Mureka may refuse a change on a song that is already published, renaming
included. When it does, the phone and the web view both ask whether to take
the song off Mureka, make the change and publish it again. Answering on
either side closes the question on the other. A no leaves everything as it
was, and a step that fails stops the run rather than leaving the song down
without trying to put it back.

## The phone's screen timeout

**Keep the screen on**, under Settings, This device, has three choices:

- **Never** leaves the screen to the phone's own timeout, also while music
  plays and while the black screen is up. The black screen comes first and
  Android turns the screen off when its own timeout runs out. This is what
  the app starts with.
- **While playing** keeps the screen on while music plays and while the
  black screen is up, so a phone in a holder does not lock in the middle of
  a drive. Paused or stopped, the phone's own timeout applies. This is what
  a browser starts with, so an iPhone does not lock and ask for Face ID.
- **Always** keeps the screen on as long as the player is open, so the
  phone never locks and Bluetooth buttons always reach it.

The old on and off switch, Keep the screen on when paused, carries over:
on becomes Always, off takes the new start value.

A play, next or previous from Bluetooth, the steering wheel or the lock
screen used to wait, with the screen dark and the music paused, until the
phone was unlocked: the phone handed the command to the page and went back to
sleep before the page could act on it. Each command now holds the phone
awake for a minute and a half, long enough for the page to start the music,
after which playing keeps it awake by itself.

That was not all of it. With the screen off, Android tells the page's
WebView that its window is hidden, and the page's paused song then does not
start again while it stays hidden. The lock screen showed the song playing,
since the page had said play, but no sound came until the phone was
unlocked and the page was on screen again. For 15 seconds after each
command the WebView now tells the page its window is visible, which is long
enough for the song to get going. Once it plays it keeps playing with the
screen off, as it always has, and the rest of the time the page sees its
window as it really is, so a paused player with the screen off costs
nothing and the screen can stay off.

## Fullscreen in the app

The app hides Android's status and navigation bars while it is on screen, so
the player fills the phone. It is a window setting, not the page's
fullscreen, so it needs no tap and is there from the first frame. A swipe
from an edge brings the bars back for a moment and they hide themselves
again, which every app has to live with. Settings, Mobile player,
Fullscreen turns it off. The page's own fullscreen has nothing left to give
in the app, so the Fullscreen button in the actions menu, the Start in
fullscreen setting and the tap gate that went with it are not shown there.
With it on the page uses the whole screen, the
strip beside a camera cutout included, so nothing is left over. The
keyboard is still kept clear, or it would cover what is being typed.

## The cover on the car screen

The app's own media session is what the lock screen, the car stereo and
Bluetooth see, and it used to skip an update whose title, second line and
cover were the same as the last one. Picking up again after a pause is
exactly that case, so a head unit that had forgotten the cover never got it
back until the song changed. With **Resend art on resume** on in the
settings, the song is now sent again when playback picks up: first without
the cover and 400 ms later with it, since an identical update is ignored
further down the line. A Bluetooth device that connects gets the same
treatment a second and a half later, whatever the setting says, because
that is when a car stereo asks for the song and some ask too early.

## Volume

The speaker at the bottom left of the web view opens a volume slider. With
the music on the phone it is the phone's own media volume, the one its
volume buttons move, in Android's own steps. Over Bluetooth with absolute
volume, which most car stereos and every recent Android have, that is the
car stereo's level, so the number in the car follows the slider and the
other way round: turning the knob in the car moves the slider within a few
seconds. Do not disturb can refuse a change, and then the slider goes back
to where the phone is.

The number of steps is Android's own, read with getStreamMaxVolume, never a
fixed number, so a phone with 15 steps shows 0 to 15 and one with 25 shows 0
to 25. The step itself is what the slider shows, and 0 shows as Off. The
speaker at the bottom follows the level: crossed out and faint at Off, then
one wave up to a third, two waves up to two thirds and the full one above
that.

How the level is written is a setting, Settings, Web view, Volume shown as:
a percentage, which is how it starts, or the step the phone counts. The
steps are the phone's own either way, only the words change. This browser's
own level is always a percentage, since that is what it is.

From a keyboard the arrows up and down move it a step, plus and minus do the
same, m turns the sound off and back to where it was, and v opens the slider.
The keys a media keyboard sends work too. Without the slider open a short
word shows where the volume landed.

With Music in this browser the slider is this browser's own level instead,
from 0 to 100 percent, kept for the next visit. The audio system's volume still
sits on top of it, and nothing on the phone is touched.

## Export and import

Export in the app's settings hands the file to Android, which asks where it
goes with its own dialog, the same one every app uses. Off screen, with
nobody there to answer, the file lands in Downloads instead and the settings
line says so. Import picks a file the same way.

Export in the web view asks first whether the file is wanted in the browser
showing the page or on the phone. The browser saves it where it saves
downloads, the phone asks for a place as above.

## A phone left lying a while

The page the player runs in has a process of its own. Off screen Android
counted it as unimportant and froze it once the phone had lain still a
while, and the web view then got no music until the app was opened. The app
now keeps that process important, keeps the phone awake for a minute and a
half after each request from a web view, so exactly while one is in use,
and loads the player again by itself should Android end the process anyway.
**Run freely in the background**, under Settings, This device, asks Android to
leave the app out of battery saving, which some phones need on top.

## Media keys and MPRIS

The web view hands the browser a media session: the song, the second line,
the cover, play and pause, next and previous, stop and seeking, all sent on
to the phone. On Linux the browser shows it over MPRIS, so playerctl, media
keys and the desktop's media controls work, elsewhere in the system's own
media controls. A browser shows it while the web view plays the music
itself, Music in this browser.

## A stuck phone

With Music in this browser, the phone plays along nearly silent and the web
view follows its place. A phone left in the background can get stuck
loading a song while it still says it plays, its clock standing still. The
web view then no longer pulls its own sound back to that frozen place,
which used to loop the first seconds of the song. It keeps playing, hands
the phone its place every ten seconds, which can also get the phone going
again, and asks for the next song when the song ends here.

## Settings pages

The main settings page is now only a list of pages, in groups:

- **Views**: Mobile player and Web view, how the player looks in each place.
  Fullscreen and the black screen belong to the view and stay in Mobile
  player.
- **Device**: Connections (in the app only: hotspot, Wi-Fi, the public
  address, the address, the local name and the status) and This device
  (Keep the screen on, and Run freely in the background in the
  app). These are about the phone or computer itself and will never be
  synced between devices.
- **Music**: Library (Start with, Refresh on open, numbers across the whole
  library, how long counts are kept), Playback (Autoplay, reporting plays,
  songs cached ahead, playing straight from Mureka's link) and Now playing
  (the two lock screen lines, artwork, resending the cover and the lyrics'
  semicolons). These are the settings a future sync would carry.
- **Data**: Backup and restore, with export, import and Google Drive.
- **Troubleshooting**: Developer, with the debug tools.

Each page has a back button to the list. The web view's copy of the
settings has the same pages, apart from Connections, so a browser still
cannot lock itself out.
