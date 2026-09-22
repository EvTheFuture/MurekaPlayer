# Mureka Player for Android

A small app that runs mureka.ai in its own WebView with the shared
`src/player.js`, keeps playing with the screen off, and serves a car page on
the phone's hotspot. The car's browser opens that page and becomes the
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
  the car's own now playing), runs the car page server and shows its address
  in the notification. When Mureka turns the session down, it posts a "Sign
  in to Mureka" notification that opens the app.
- **BootReceiver** starts the service when the phone starts and after the
  app is updated, so the car page is there without opening the app.
- **MainActivity** only shows the WebView. Closing it leaves the music and
  the car page running, Quit in the notification ends everything.
- **CarVpn** is a VPN that carries no traffic. It only gives the phone one
  extra address that is not private, 3.3.3.3 unless changed, since Tesla's
  browser refuses private addresses. See "Use in the car".
- **MdnsResponder** answers to `murekaplayer.local`, or the name set in the
  settings, so laptops and tablets on the hotspot or Wi-Fi find the page by
  name. Tesla's browser does not look up local names. It is plain Java, no
  Android classes, and answers with the phone's address on whichever network
  the question came from.
- **CarSettings** holds the car page settings and checks every value.
- **CarServer** listens on port 8080, retrying every 5 seconds if the port is
  busy, and the notification says so when it is not listening. `GET /` is the
  car page, `GET /state?since=` the now
  playing state, answered as soon as there is a newer one than `since`, `GET /list?q=&offset=&limit=` a page of the song
  list, `GET /queue?q=` the whole queue,
  `GET /panel?name=settings|filters|creators` a copy of one of the player's
  panels, and `POST /cmd` runs a command in the player.
- **Hub** passes the player's state out and the commands back in.

Android only delivers the boot broadcast to an app that has been opened at
least once since it was installed, so open it once after installing.

## Queue, settings, filters and artists

- The song list button opens the songs with the same views as the phone:
  **Mureka**, **Queue** and **A-Z**. The queue shows all of it, played songs
  dimmed. Tap a song to jump to it, the cross takes an upcoming song out.
  **Now playing** scrolls to the current song, the round button jumps to the
  top or the end, and covers load as the rows scroll into sight.
- In the queue, the handle at the start of a song still to come drags it to
  another place, the songs it passes sliding out of the way, and the list
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
  the car page. The car's settings scroll in a box that reaches the right
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
  covers the same way in 300 ms, on the car page and on the phone.
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
  car browser and on a large screen.
- The web view hears of song changes at once, also with the phone's screen
  off or the app in the background. In fullscreen, Escape closes the page's
  own dialogs where the browser allows it, holding it leaves fullscreen.
- **Start with** in the settings can also be **As last time**, the list and
  artist the player was showing when it was last used.
- **Up next**, the **waveform seek bar**, where the lyrics go, the names
  under the buttons and the car's own transport bar are set on the phone
  under Settings, Web view. The settings have three pages: what applies
  everywhere, Mobile player and Web view.
- **Fullscreen** on the main screen, where the car's browser offers it.
- **Settings** on the main screen, and **Edit filters** and **Artists** in the
  song list, show the phone's own panels with large controls. They are read
  from the player itself, so everything the phone has is there, and every
  tap goes back through the same control on the phone. Filters need Apply
  filters, as on the phone. Artists picks your own library or a creator.

## Who may open the car page

Only the local network, never the mobile network:

- The sender has to be on the hotspot or a Wi-Fi the phone is on, and ask
  for one of the phone's addresses on that network or for the car address.
- Requests arriving on a cellular interface are refused, IPv6 included.
- In the app's settings, under Web view, "Allow from the phone's hotspot"
  and "Allow from Wi-Fi networks" pick which of the two are allowed. Both
  are on from the start. These two rows are not shown on the car page, so
  the car cannot lock itself out.

## Fullscreen

The player's fullscreen works in the app. The status and navigation bars
step aside and a swipe from the edge brings them back for a moment. Back
leaves fullscreen.

## Sound in the car

The car page has a Sound switch:

- **Phone / Bluetooth**, the phone plays and the car speakers get it over
  Bluetooth. The car page is only the remote.
- **This browser**, the car browser plays the song itself. The phone keeps
  playing at a volume too low to hear and stays in charge of the queue, the
  car page follows its position. Not muted, since Android stops muted media
  in the background, which paused the song and broke the next one. If the car page goes away for 8 seconds, the phone takes the
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
make android          # app/build/outputs/apk/debug/app-debug.apk
make install          # and put it on the connected phone
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

1. In the player's settings, under Car page, switch on "Fixed car address
   (VPN)". Android asks once whether the app may run a VPN.
2. Switch on the phone's hotspot and connect the car to it.
3. In the car's browser open `http://3.3.3.3:8080` and bookmark it. It is the
   same every time, whatever address the hotspot picked.

How it works: the VPN has no traffic and only this app inside it. It exists
so Android assigns the address to the phone. The car sends requests for
3.3.3.3 to its gateway, the phone, and since the address is the phone's own
they go straight to the car page server. The hotspot, the car's internet and
every other app are not touched. The Android Auto in the browser apps have
used the same address for years.

- The address can be changed in the settings. Private, loopback, carrier
  grade NAT and multicast addresses are refused. 198.18.0.1 is a clean
  alternative nobody uses, but it is not confirmed to work in a Tesla.
- Android allows one VPN at a time. Starting another VPN app turns this one
  off, and the settings say so. Switch it off and on to get it back, Android
  asks again.
- The notification shows the car address when it is up, and the local name
  and addresses for other devices.

Other devices, a laptop for one, open `http://murekaplayer.local:8080` or the
plain address from the notification. The name can be changed in the
settings, `.local` is added.

## Known limits in this first version

- Google sign in runs in the app's WebView with the WebView markers taken
  out of the user agent. Google may still refuse it.
- Export in the settings (download or share) does not work inside the app
  yet. Import from a file does.
- Anyone on the same network can open the car page and control the player.
  On the phone's own hotspot that is only the car. Turn off "Allow from
  Wi-Fi networks" to keep it to the hotspot.

## A phone left lying a while

The page the player runs in has a process of its own. Off screen Android
counted it as unimportant and froze it once the phone had lain still a
while, and the web view then got no music until the app was opened. The app
now keeps that process important, keeps the phone awake for a minute and a
half after each request from a web view, so exactly while one is in use,
and loads the player again by itself should Android end the process anyway.
**Run freely in the background**, under Settings, Web view, asks Android to
leave the app out of battery saving, which some phones need on top.

## Media keys and MPRIS

The web view hands the browser a media session: the song, the second line,
the cover, play and pause, next and previous, stop and seeking, all sent on
to the phone. On Linux the browser shows it over MPRIS, so playerctl, media
keys and the desktop's media controls work, elsewhere in the system's own
media controls. A browser shows it while the web view plays the music
itself, Music in this browser.
