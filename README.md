# Mureka Player

[![Latest release](https://img.shields.io/github/v/release/EvTheFuture/MurekaPlayer?display_name=tag&label=Latest%20release)](https://github.com/EvTheFuture/MurekaPlayer/releases/latest)

A player for your whole Mureka library, on mureka.ai. It comes as an Android
app, as a browser add-on for Firefox, LibreWolf and Chromium based browsers,
and as a bookmarklet for browsers without add-ons, such as Safari on iPhone.
All three run the same player. The Android app also serves a web view, so any
browser on the phone's hotspot or Wi-Fi, a laptop, a tablet or a car's
browser, can show what plays and control it.

[![buy-me-a-coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/EvTheFuture)

## Features

- Loads your whole library, published songs and drafts, page by page, and
  keeps it, so the player opens at once the next time
- Sliding covers, synced lyrics, a waveform seek bar that zooms, quarter
  star ratings, likes, shuffle and repeat
- A play queue with play next, play last and songs dragged to another place
- Views for Mureka's order, the queue, A to Z, stars and plays, a search by
  title or by a song's ID, and filters for style, mood, tempo, rating and
  more
- Your own songs can be renamed, published and unpublished, given a new
  cover, trimmed and deleted on Mureka
- Songs stored on the device play offline, with their covers and lyrics
- Song tweaks, settings, the library and the play queue export and import,
  as a file or as a short line to paste, and songs can be shared with
  someone on another account
- Media keys, the lock screen and Bluetooth control it through the media
  session, and playerctl works on Linux
- On a phone the player fills the screen, on a larger screen it is a panel
  that can be moved and resized

What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

## The Android app

Download the APK from the
[latest release](https://github.com/EvTheFuture/MurekaPlayer/releases/latest)
and open it on the device. Android asks once to allow installing apps from
where it came from. Open the app once after installing and sign in to
Mureka.

- Keeps playing with the screen off and the app closed, controlled from the
  lock screen and any Bluetooth device.
- Starts by itself when the device starts and after an update.
- Serves the web view on port 8080, to the phone's hotspot and Wi-Fi
  networks, never the mobile network. The addresses are in the notification
  and under About Mureka Player in the settings. A password for the web view
  can be set under Web view.
- **Public address (VPN)** gives the phone the fixed address 3.3.3.3 for
  browsers that refuse private addresses, Tesla's among them. Other devices
  can use `http://murekaplayer.local:8080`.
- **Charger and power** can pause the music and stop the background work
  when the device goes on battery or a Bluetooth device disconnects, and
  switch the phone's hotspot with a small helper of its own (experimental).
- A WireGuard tunnel can be handed over to and from the public address as
  the hotspot goes on and off.

How the app is built and signed is described in
[android/README.md](android/README.md).

## The web view

Open the address the app shows in any browser on the same hotspot or Wi-Fi.
It shows what plays with its cover, lyrics and waveform, the song list and
the queue, and the phone's own settings, filters and artists. The music can
play on the phone and its Bluetooth device, in that browser, or not at all
in a second browser. Each browser can keep its own look under **Settings for
this browser**.

## Install the add-on

Load the add-on in Firefox or LibreWolf, on the desktop or in Firefox for
Android, or in a Chromium based browser such as Chrome or Vivaldi. The player
appears on mureka.ai by itself. `make addons` builds both packages.

## Use without the add-on (iPhone and other browsers)

On browsers that cannot run add-ons, a bookmarklet loads the same player into
the mureka.ai page. To set one up: bookmark any page, edit that bookmark and
replace its URL with one of the one-liners below, open mureka.ai while logged
in, then run the bookmark from the Bookmarks menu. On iPhone it must be run from
the Bookmarks menu, not the address bar, because iOS does not allow bookmarklets
to start from the address bar. The player opens over the page, and running the
bookmark again minimizes or restores it. On desktop you can instead drag the
bookmarklet to your bookmarks toolbar.

### Latest release (recommended)

Loads the released version. The browser checks it against its hash, so it
runs exactly the released code. A new release comes with a new one-liner here.

```
javascript:(function(){if(window.__murekaPlayerToggle){window.__murekaPlayerToggle();return}var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/gh/EvTheFuture/MurekaPlayer@latest/src/player.js";document.body.appendChild(s)})();
```

### Newest in-development version

Loads the most recent committed code, fetched again on every run so it is
never stale. Use this only if you want the bleeding edge, as it is a little
slower to open.

```
javascript:(function(){if(window.__murekaPlayerToggle){window.__murekaPlayerToggle();return}var s=document.createElement("script");s.src="https://evthefuture.github.io/MurekaPlayer/src/player.js?v="+Date.now();document.body.appendChild(s)})();
```

## Downloads and caching

Downloads and the song cache are two separate stores. Download saves a real
file, asking for its name first, and the song cache lives inside the browser
or the app for instant and offline playing. The dot beside a song shows the
cache, not the files downloaded.

In the add-on, Download saves into a Mureka subfolder of your download
directory with no dialog. In the app it uses Android's save dialog, and where
the browser can hand files to other apps, **Share** sends the song on. In the
bookmarklet, playing always works, but the cache and downloads depend on the
audio host allowing the files to be fetched, and a download is a normal
browser download.

## Permissions of the add-on

- downloads: to save songs into the Mureka folder
- access to mureka.ai: to run the player and load the song list
- access to static-cos.mureka.ai: the host that serves the audio files

## Files

- src/player.js              The player, shared by the app, the add-on and the bookmarklet
- src/content.js             Injects the player and relays downloads
- src/background.js          Saves downloads into the Mureka folder
- manifest.json              The add-on's manifest
- icons/                     The add-on's icons
- web/bookmarklet.js         The bookmarklet loader, readable source
- web/bookmarklet.min.js     Bookmarklet for the latest release
- web/bookmarklet-dev.min.js Bookmarklet for the newest in-development version
- android/                   The Android app
- fastlane/, fdroid/         Store texts and the F-Droid build recipe
- Makefile                   Checks, add-on packages, the APK and releases
- build.sh                   Builds the add-on packages
- release-bookmarklet.sh     Pins the release bookmarklet to a tag
- privacy.html               The privacy policy

## Development

`make help` lists what the Makefile does: `make check`, `make addons`,
`make release`, `make install` and `make bookmarklet` among others.

To run the add-on in Firefox on Android:
`web-ext run -t firefox-android --adb-device IP_ADDRESS:5555 --firefox-apk org.mozilla.firefox`

[![buy-me-a-coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/EvTheFuture)
