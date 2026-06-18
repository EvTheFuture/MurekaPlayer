# Mureka Player

A Firefox / LibreWolf add-on that loads all of your published Mureka songs into
one panel on mureka.ai and plays them with a full player. The same player also
runs on browsers without add-on support, such as Safari on iPhone, through a
small bookmarklet.

[![buy-me-a-coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/EvTheFuture)

## Features

- Loads your entire published library through the Mureka API, page by page,
  and caches the list so it opens instantly next time
- Full player with album art, a draggable seek bar, elapsed and remaining time,
  and previous, play/pause, next, shuffle and stop controls
- Audio caching: a played or cached song is stored in the browser for instant,
  offline replay, shown by a dot next to the song
- Folder downloads: saves mp3 files into a Mureka subfolder of your download
  directory with no Save As dialog, one song or the whole library (add-on only)
- Three list views, switchable at any time:
  - Mureka: the published order, numbered
  - Queue: the current song and what plays next
  - A-Z: alphabetical by title
  The number shown for a song is always its position in the Mureka order, so it
  stays the same in every view
- Search box to filter the list by title
- Shuffle as a mode: turning it on while playing keeps the current song and only
  randomizes the upcoming queue
- Media keys and Linux playerctl support through the Media Session API
- Runs on iPhone and other browsers without add-on support via a bookmarklet
- On a phone the player fills the screen, on the desktop it is a draggable
  floating panel

## Files

- manifest.json        Extension manifest
- src/player.js        The player
- src/content.js       Injects the player and relays downloads
- src/background.js    Saves downloads into the Mureka folder
- web/bookmarklet.js   The bookmarklet loader
- icons/               Add-on icons

## Install the add-on (Firefox / LibreWolf)

Load the extension for Firefox or LibreWolf, on desktop or on Firefox for
Android. The player appears on mureka.ai automatically.

## Use without the add-on (iPhone and other browsers)

On browsers that cannot run add-ons, a bookmarklet loads the same player into
the mureka.ai page.

1. Copy the one-liner below
2. Bookmark any page, then edit that bookmark and replace its URL with the
   copied one-liner
3. Open mureka.ai and make sure you are logged in
4. Run the bookmark from the Bookmarks menu. On iPhone this must be the
   Bookmarks menu, not the address bar, because iOS does not allow bookmarklets
   to start from the address bar
5. The player opens over the page. Run the bookmark again to minimize or restore
   it

On desktop you can drag the bookmarklet to your bookmarks toolbar and click it
while on mureka.ai.

```
javascript:(function(){if(window.__murekaPlayerToggle){window.__murekaPlayerToggle();return}var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/gh/EvTheFuture/MurekaPlayer@master/src/player.js";document.body.appendChild(s)})();
```

## Downloads and caching

Downloads and the playback cache are two separate stores. Download saves real
files to disk, and the playback cache lives inside the browser for instant
replay and is what the dot beside a song reflects. The browser cannot read the
contents of the disk download folder, so the dot tracks the cache, not the
folder.

In the add-on, Download saves into a Mureka subfolder of your download directory
with no dialog. In the bookmarklet, playback always works, but the audio cache
and the download buttons depend on the audio host allowing the files to be
fetched, and folder downloads are not available, so the bookmarklet falls back
to a normal browser download.

## Permissions

- downloads: to save songs into the Mureka folder
- access to mureka.ai: to run the player and load the song list
- access to static-cos.mureka.ai: the host that serves the audio files

[![buy-me-a-coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/EvTheFuture)
