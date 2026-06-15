# Mureka Player

A Firefox / LibreWolf add-on that loads all of your published Mureka songs into
one panel on mureka.ai and plays them with a full player.

[![buy-me-a-coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/EvTheFuture)

## Features

- Loads your entire published library through the Mureka API, page by page,
  and caches the list so it opens instantly next time
- Full player with album art, a draggable seek bar, elapsed and remaining time,
  and previous, play/pause, next, shuffle and stop controls
- Audio caching: a played or cached song is stored in the browser for instant,
  offline replay, shown by a dot next to the song
- Folder downloads: saves mp3 files into a Mureka subfolder of your download
  directory with no Save As dialog, one song or the whole library
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

## Files

- manifest.json       Extension manifest
- src/content.js      Injects the player and relays download requests
- src/page.js         The player
- src/background.js   Saves downloads into the Mureka folder
- icons/              Add-on icons

## Downloads and caching

Downloads and the playback cache are two separate stores. Download saves real
files to disk through the browser downloads API, into a Mureka subfolder, with
no dialog. The playback cache lives inside the browser for instant replay and is
what the dot beside a song reflects. An extension cannot read the contents of
the disk download folder, so the dot tracks the cache, not the folder.

## Permissions

- downloads: to save songs into the Mureka folder
- access to mureka.ai: to run the player and load the song list
- access to static-cos.mureka.ai: the host that serves the audio files

[![buy-me-a-coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/EvTheFuture)
