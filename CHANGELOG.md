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
- On a tablet the app shows the web view as its screen, the same page other
  browsers get, so it gains whatever the web view gains. The Mureka page with
  the player stays behind it, a tap away in the actions menu for signing in,
  and Back or Web view in the player's menu return. Exports and song
  downloads use Android's save dialog. Can be turned off under Mobile player.
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

- The online checks, the Offline and Online badge and playing only the
  stored songs while offline work in the bookmarklet and the add-on too,
  following the browser's own word on its connection. In the background,
  where Safari holds requests back, only a song that will not load can
  take the player offline, and coming back into view checks the
  connection at once. Offline, everything asked for is still tried, Load,
  Rescan, Refresh, a like and the rest, and any answer from Mureka puts
  the player back online at once. Only songs that are not stored stay
  blocked, after a quick check whether Mureka answers after all. A browser
  goes offline only when three checks in a row get no answer, and a
  request that only ran slow there no longer counts.
- A song stored on the device plays from the stored copy once a song has
  played, even with Stream direct URL on, so a slow or patchy connection
  no longer holds up changing songs.
- **Plays offline.** Without internet, or when Mureka cannot be reached,
  the app opens the player on a page of its own at Mureka's address, so
  the library, the stored songs, covers, waveforms and lyrics are all
  there. Only songs stored on the device play: the others are dimmed in
  the list, a tap on one says it is not stored, and next and previous pass
  over them. Nothing is asked of Mureka while offline, so nothing waits for
  a request that cannot succeed. Plays are kept and reported to Mureka once it can be reached
  again. The internet going while the player runs works the same way, and
  so does a connection the phone calls online but that does not reach
  Mureka: a song that will not load makes the player check whether Mureka
  answers, and without an answer it goes offline and plays on from the
  next stored song, checking again every 30 seconds. The same check runs
  whenever any request to Mureka gets no answer, play reports and
  background work included, when the connection drops or changes over,
  when a browser of the web view goes away, and once a minute when
  nothing has been heard from Mureka. A play report that gets no answer
  is kept and sent later. The covers beside the
  playing one show the stored songs that play next and before. A small
  red **Offline** mark shows in the header. When the internet is back the
  mark turns green and says **Online**, then fades away after a few
  seconds, or stays while online with **Online badge** set to Always.
  A double tap on the badge, or on the Power saving mark, folds or opens
  the player, as on the header.
  The web view shows the same badge for the phone's connection, with an
  **Online badge** setting of its own that each browser can also have
  for itself. It also checks its own browser's connection, once a minute,
  when the browser says its connection came or went and when a song will
  not load: **Browser offline** when that browser cannot reach Mureka,
  and **No phone** when it has lost the phone.
  Every song plays again at once, and the app returns to Mureka's site as
  soon as the music is paused. The stored songs are asked to be kept
  for good, so they are not cleared when the phone runs low on space.
- **Every stored song keeps its cover.** However a song gets stored,
  played, cached ahead or cached one by one, its cover is kept with it,
  and songs stored earlier without one get it in the background while
  online. The web view gets the kept cover from the phone when Mureka
  cannot give it, so stored songs show their covers offline there too.

### New: the web view

- Served by the app on port 8080. Only the phone's hotspot and Wi-Fi networks
  may open it, never the mobile network, and **Allow from the phone's
  hotspot** and **Allow from Wi-Fi networks** choose which.
- **Public address (VPN)** gives the phone the fixed address 3.3.3.3, since
  Tesla's browser refuses private addresses: `http://3.3.3.3:8080` works
  every time. Other devices can use `http://murekaplayer.local:8080`, and the
  name can be changed.
- Now playing like the phone: sliding covers with the neighbours peeking out,
  synced rolling lyrics beside or on the cover, quarter stars, like with the
  number of hearts (left out when the one heart is your own), plays, a
  Public or Draft badge, up next, **Playing from** with the source and
  filters, the waveform seek bar and the status line. A dot by the time
  shows how much of the playing song is there, in the browser when the
  music plays there, on the phone otherwise: a cyan pie fading in and out
  while it fills, solid once all of it has come.
- Transport bar with its own order, set with press and hold or the editor in
  the settings, and optional names under the buttons. **Songs** and **List**
  are among its buttons, to be placed or left out like the others, either
  or both: a tap on Songs opens the song list and a swipe up on it a small
  one over the main page, a tap on List opens the small one and a swipe up
  on it the whole list. A swipe down on either, or a second tap on List,
  closes the small list. The small mark on both points up, and down at their
  bottom while the small list is open.
- The small song list reaches from the stars down to the seek bar beside the
  cover. It is see through, hides the stars, Playing from and the lyrics
  while open, opens at the playing song, and keeps its cache dots, titles and
  badges up to date. At its top: the number of songs, **Mureka** or
  **Queue** to switch between the songs and the queue, Sort, Update, Rescan,
  a button for the whole list and Close, and under them what the phone is
  loading with its turning ring and bar. A pull down at its top loads new
  songs as in the big list. As in the phone's list, a round button jumps to
  the top or the end while scrolling, and another goes back to the playing
  song when it is out of sight. **Sort** at its top picks Mureka order, A to Z,
  Z to A, or most or fewest stars or plays first, the same sorting as the
  big list. Sorted by plays, both lists show each song's plays, in the
  small list in place of the stars.
- Play counts and sorting by plays, a switch under Library, Play counts, on
  in the app and off by default in the bookmarklet and the extension. On,
  the mobile list gets a **Plays** view with each song's count, and the web
  view sorts by plays. Mureka's song lists carry no plays, so each song is
  read on its own: every time it starts, and in the background while the
  player is open. Catching up while counts are missing or older than a set
  age (6 hours to 1 week), one song at a random time every 5 to 10, 10 to
  30 or 30 to 60 seconds, then keeping up, 1 to 3, 3 to 10 or 10 to 30
  minutes or off, with only the songs that have most likely gained a play
  since. **Read play counts** catches up at once, a song every 1 to 2
  seconds, with its progress over the lists and a Stop. A table in the
  settings shows where it stands: its status (waiting, fetching, paused,
  idle, off or stopped), catching or keeping up, the countdown, the last
  and the next song, and
  **Fetch next now** reads the next song at once. Counts are kept on the
  device.
- Song list with the Mureka, Queue and A-Z views, sorting by A to Z, stars
  and plays, search, play next (a second press takes it back out), likes,
  and the phone's song menu on press and hold or right click. A small,
  faint #1, #2 and so on in the corner of each line, in the big and the
  small list, gives the song's place in the list as sorted and searched.
  The dot is about the song on the phone: cyan once it is stored, and
  while it is being cached it fades in and out and fills smoothly like a
  pie as the song comes in.
- With the music in the browser, songs are played out of the phone's own
  song cache, over the local network, seeking included. A song the phone
  does not have yet comes from Mureka as before while the phone fetches it
  for the next time, so with Cache ahead or Cache all the browser rarely
  waits for Mureka. Should the phone fail to give a song, it is played
  straight from Mureka. The trimmer and Save as read a stored song from
  the phone too, instead of downloading it again.
- Covers in the web view come from the phone, which keeps them in its own
  cache and fetches the covers of the playing song and of the next ones in
  the queue ahead (**Covers ahead**, 5 by default), and those of every song
  stored ahead even beyond that, whether or not a browser is open. A cover on its way pulses with a cyan pie filling as it comes
  in, then fades in, three at a time, a cover that stops coming is asked
  for again and in the end fetched straight from Mureka. **Cover cache in
  MB** (200 by default) sets how much
  room they may take, those shown longest ago go first, and the settings
  show how many there are, with **Clear cover cache** and its progress.
- The song lists in the web view follow the phone: the queue is read again
  when it is shuffled, rebuilt or moves on, and the song list when the
  filters change.
- **Charger and power**, a settings page in the app, for saving power
  when the phone is left alone. **What starts it** is either the phone
  going **On battery** (the charger pulled out) or **Bluetooth
  disconnects**: the last of the ticked Bluetooth devices, a car's for
  one, disconnecting. The paired devices are listed with whether each is
  connected, which needs Android's Nearby devices permission, asked for
  with **Allow Bluetooth access**. After a grace time (60 seconds by
  default) the music can pause and all background work stop, so a phone
  left somewhere warm stays cooler. A note counts down on the phone and in
  the web view, saying "Running on battery" or "Bluetooth disconnected",
  with **Skip shutdown**, and the charger or a ticked device coming back in
  time stops it. When it comes back, the background work starts again.
  The web view stays reachable all along, and while a browser is
  connected to it, from a computer at home say, nothing is stopped.
  **Browsers on the hotspot** chooses what happens when the hotspot is to
  go off while browsers of the web view use it: **Turn off anyway**, the
  default, or **Wait for them**, which turns it off once the last of them
  has gone. **Power saving** under What the debug overlays log shows all
  of it as it happens.
  While the background work is stopped, a small **Power saving** mark
  shows in the player's header, and a tap on it opens the page. The names
  and explanations of the settings follow what starts it.
- **Hotspot**, an experimental and advanced section at the end of Charger
  and power: **Turn off hotspot when on battery** and **Turn on hotspot
  when charging**, or when disconnected and connected with Bluetooth.
  Android lets only the system switch the
  hotspot, so the player brings a small **hotspot helper** of its own. For
  each switch it runs once as the phone's debugging shell, gives one
  command and exits, so nothing is left running. It switches the phone's
  own hotspot, with its own name and password, like the quick settings
  tile, and no other app is involved. The player pairs with **wireless
  debugging** once, the code typed into its notification while the pairing
  dialog stays open, and from then on runs the helper by itself, switching
  wireless debugging on for each switch and off again afterwards (the
  phone has to be on Wi-Fi). It may not work on every phone. A command for
  a computer with adb is there for a phone that is not on Wi-Fi. The page
  shows the pairing, the hotspot's last known state and what the last
  command did, and **Turn on hotspot** and **Turn off hotspot** try it,
  each greyed out while the hotspot already is that way. When the power
  saving turns the hotspot on or off by itself, a note on the phone says so
  while it switches and then whether it worked. When one of the
  hotspot settings is on and the helper is not running, the player starts
  it by itself, with a note that it is starting and one saying whether it
  started, and the web view shows the same. Without a pairing it says
  that pairing is needed.
- **Cache control**, a settings page of its own under Data, gathers what the
  player keeps on the device: Cache ahead, the songs stored with **Cache
  all** and **Clear song cache** (with its progress, the library itself
  stays), the room used, how long song details are kept, and in the app the
  covers for the web view with their size and Clear.
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
  the web view has not been heard from for 25 seconds, and says so in a red
  note on the phone and in that browser once it is back. When the music is
  set to play in a browser that still needs a tap to start it, Space or
  Enter plays it there and Escape puts the question away.
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
- **Export** offers **Copy to clipboard** too, the export as text, for
  devices where a file is hard to hand on. In the web view it copies once
  the phone has sent it over.
- **Import** offers **Paste** besides a file: an export copied as text is
  pasted into a box, with a Paste button where the page may read the
  clipboard. The web view offers **Paste here**, **A file here** or **The
  phone**. The phone reads it and the web view asks everything: what it
  holds, and for song tweaks which value to keep for every song that
  differs, one by one or for all that are left, before the phone imports
  it.
- Export asks whether the file should be saved in the browser or on the phone.
  Saved in the browser, the file name is asked first, filled in with the
  phone's, and the phone hands the file over as a real download under that
  name, so a browser on another phone no longer saves it as Unknown.json.
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
  (Backup and restore) and Troubleshooting (Developer), with Your songs
  (Publishing) between Music and Data. Each group and most
  settings have a short explanation, and each section heading is underlined.
- **A note for everything asked of Mureka**: publishing, unpublishing,
  renaming, remixing, likes, refreshing a song, trimming and deleting each
  show a ringed note with a turning ring as soon as Mureka is asked, which
  turns into a filled one with the answer, cyan when it went and red when it
  did not. The web view shows the same notes.
- **A tap outside the song menu** only closes it: the song or button under
  it is not played or pressed.
- **A tap on the playing song** never restarts it, but when the list shows
  other songs than the queue was made from, published only where it began
  with all songs for example, the queue is made again from the list around
  it, and the covers beside it follow.
- The search box has a clear button at its right end while it holds text.
- **On a tablet or a computer, a double tap or double click on the header**
  fills the whole window, the next one folds the player, and a tap on the
  folded header brings back your own size. On a phone it folds and unfolds
  as before. A finger drags the floating player by its header, and on touch
  screens the bottom corners are large, marked grips to resize it with.
- **Songs still being generated** show greyed at the top of your own list,
  in the player and in the web view, with an unknown cover where covers are
  shown. A tap says the song is not finished yet and offers **Play when
  ready**, with a turning ring in front of the song while Mureka is asked
  every five seconds. Once done they join the library with everything
  brought up to date, and a song asked for starts playing at once, in place
  of a song playing meanwhile. Nothing of this is kept over a restart.
- **Choose what an import of song tweaks brings**: ratings, tempos,
  instrumental marks, ignored songs and saved creators each have a switch,
  with how many are new or differ. The first time ratings, ignored songs and
  saved creators are left out, after that the choice from last time is
  ticked again, so two people can share tempos without touching each other's
  ratings. In the player and in the web view.
- **Include Mureka's BPM in song tweaks**, on by default, sends Mureka's
  own tempo along for songs without one set by hand. An import takes it
  only for a song with no tempo at all, as on a device signed in to another
  account, which Mureka gives none.
- **Select to share** in the song menu picks songs to share with someone
  using the player on another account, unpublished ones too. A tap picks a
  song or lets it go, the bar above the list copies or shares them as a
  short line of their ids, about eleven characters a song, Done ends it. The
  other player reads each song from Mureka. Pasted into Import in the other
  player, it asks where they go: play next, at the end of the queue or as
  the whole queue. They play from their links there, kept over a restart,
  with a violet shared badge since they may not be public. The web view has
  Select to share too, in the song menu, with the same short line, and its
  Import asks the same. Once such a song shows up on a list read from
  Mureka, the creator's public songs for one, the published version takes
  its place, with a note saying so. Once a day the shared songs are also
  looked up for new titles and covers.
- **Mureka song links in Import**: pasted share links from Mureka's site,
  one or many, mixed with other text, are read from Mureka and taken in as
  shared songs, also songs not yet published.
- **Heat badge** in the web view, from the Android app: how warm the phone
  is, cool in blue below 40 °C battery, warm from 40, hot from 45, very hot
  from 50, or worse when Android's own heat level says so. A tap shows the
  battery's temperature and, while the hotspot is on, a button that switches
  it off. On by default, under Web view display.
- **Hotspot badge** in the web view, off by default, under Web view display
  in the settings: says beside the network badge whether the phone's
  hotspot is on or off, as the hotspot helper tells it.
- **Ignore in queues** in the song menu marks a song that a queue made from
  the list leaves out, by Play, shuffle, a tap on another song or new songs
  coming in. It still plays when tapped itself, and Play next, Play last,
  Play only this and an imported queue take it as asked. A small crossed
  circle before the title marks it in the lists, **Stop ignoring** takes
  the mark away. Ignored songs go with the exported song tweaks.
- **Retry or Cancel** when a change on Mureka does not go through: rename,
  publish and unpublish, remixing, like, a new cover and delete on Mureka.
  The change stays shown while the player asks, on the phone and in every
  web view, and the first answer anywhere counts. Only Cancel puts it back.
- **Play only this** in the song menu, in the player and in the web view:
  the song plays on its own, to hear it before it goes in the queue. With
  nothing playing, the queue being put together waits and is back as it was
  once the song ends. While a queue plays, it carries on after the song.
- **Remove this and all after** and **Remove this and all before** in the
  song menu of a queue row, in the player and in the web view. On the
  playing song they take away the others, and it keeps playing.
- **Moving songs in the queue** in the player's queue view: a handle on each
  row to drag the song to another place, with a finger, a pen or the mouse,
  as in the web view.
- **Remove from queue** in the song menu, in the player and in the web view,
  for a song still to come in the queue. The small list over the web view's
  main page shows the queue with the same handles as the big list: drag a
  song to another place, and a cross takes one still to come out.
- **Play last** in the song menu, in the player and in the web view, beside
  Play next. With the player stopped, Play next and Play last put a queue
  together by hand: it holds only the songs put in, Play starts it, Repeat
  all goes round those songs and the list does not fill it up. A tap on one
  of its songs plays from there.
- **Copy tweaks, Copy songs, Copy queue and Import** at the foot of the menu under the
  three lines, in the player and in the web view. Copy puts the song tweaks
  or the song library on the clipboard at once and says so, and Import opens
  the box to paste an export into, with any differences asked about as in
  Import.
- **The play queue exported and imported**: Copy queue at the foot of the
  menu under the three lines, and Export play queue under Backup and restore,
  in the player and in the web view. Imported, it replaces the queue here as
  one put together by hand. With a song playing it asks whether to keep it,
  with the imported songs after it, or to stop it and play the imported
  queue at once. A paused song goes and Play starts the imported queue.
  The export carries each song's full links to its audio and cover, so a
  player signed in to another account plays the songs too, from their
  links, and keeps them in the queue across a restart.
- **Songs deleted on Mureka** are noticed by Load and by Refresh on a song:
  a song missing between the songs of a list page is looked up on Mureka,
  and only when Mureka no longer has it is it removed here, with its stored
  audio and cover. Ratings and tempos are kept. Under Library, **Ask** shows
  which songs first, **Remove** takes them away at once, and **Rescan only**
  leaves it to a full Rescan. Refresh on a song also reads the list page the
  song is on and brings the songs on it up to date.
- **Back to the playing song**: a round target button shows over the list
  while the playing song is scrolled out of sight, and a tap brings it back
  to the middle. The status line says which song plays with its number in
  the list, as in "Playing: #4064 - Title".
- **Progress over the list** while loading, rescanning or caching: what is
  going on, how far it has come, how long it has taken and about how long is
  left, with a bar when the size is known, as in the web view.
- **Hide player on a phone** folds the player into a small rounded bar at
  the top, which can be dragged anywhere on the screen so nothing on Mureka's
  page stays out of reach. A double tap opens the player full screen again,
  and the next fold starts at the top.
- **Trim** in the song menu for your own songs cuts the start or the end
  off, and Mureka makes a new song of it, keeping the original. The trimmer
  shows the song's real waveform: the whole song with the kept part lit and
  its ends to drag, and a close up of the start or the end that zooms from
  30 seconds down to 20 milliseconds, by pinching it with two fingers, the
  wheel or the zoom buttons, with steps of 10 ms, 100 ms and 1 s and typed
  times. The song's id, its length and the new length show under the title,
  with Trim beside it. **Play end** plays what the close up shows before the
  end and stops on the exact sample where the new song will end, **Repeat
  the end** plays it again and again while the end is moved, **Play** and
  **Pause** play the kept part and stop where it is, and a tap on the
  waveform plays from there. **Fade out the last second** fades the preview
  the way Mureka fades a trimmed song, once the end is moved. The new song
  gets a title of its own and is put at the top of the list, marked new,
  with the original's rating, tempo, instrumental mark and ignored mark, and
  liked when the original was. A small gold T on the public or draft badge
  marks every trimmed song, from Mureka's own mark, so also songs trimmed on
  Mureka's site or another device, once a Load or Rescan has read them. A
  song trimmed here counts as trimmed straight away until then. It shows
  wherever that badge shows: the lists, and the playing song in the web
  view. **Delete original**, ticked when confirming, deletes the original on
  Mureka and from the lists here once the new song has arrived. While Mureka
  works, a turning ring covers the page. The web view has the same trimmer
  in its song menu, drawn in the browser, with the phone fetching the song
  and sending the trim to Mureka. Music playing when the trimmer opens
  pauses and goes on where it was once it closes. When the song trimmed was
  the one playing, its new version goes on at the same place in the music
  instead.
- **Download** in the song menu asks for the file name first, filled in
  with the song's title followed by its id in brackets, ready to change.
  Where the browser can hand files to other apps, on a phone for one,
  **Share** sits beside Download and opens the share sheet with the song
  under that name, to keep it in Files, put it in Drive or send it on.
  Tapped before the song is ready, it asks again once it is.
  In the web view the song is saved under that name too, the phone
  fetching it for the browser.
- **Rename**, **Publish** and **Unpublish** in the song menu for your own
  songs, and **Allow remixing** or **Disallow remixing**, instrumentals included.
  Publishing copies the song's link to the clipboard, in the web view to
  that browser's, and a short note on the page says it is published and the
  link copied.
- **Set cover** in the song menu for your own songs, in the web view too:
  pick a picture and choose the square in the cover editor, dragging to
  move it and zooming with two fingers, the mouse wheel or the slider.
  The picture is uploaded to Mureka as it is, and Mureka's storage cuts
  out the square at 1408 by 1408 pixels, so nothing is lost to the browser
  and privacy settings that scramble pictures read back from a page make
  no difference. The new cover shows at once everywhere. A published song
  Mureka refuses can be taken down and published again, as with Rename.
- **Delete on Mureka** in the song menu for your own songs, in the web
  view too, deletes the song from your library on Mureka for good after
  asking first, and then from the list and the cache on the device.
- **Publishing settings**, a page of their own under Your songs: **Copy the
  link when publishing**, on by default, and **Always disallow remixing
  first**, which tells Mureka to disallow remixing before every publish, and
  does not publish if Mureka refuses that.
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
  showed when it was last used. It is the default, also for settings kept
  from before, where Published was stored whether it was picked or not.
- **Remove ; from lyrics** takes Mureka's pause marks out of the lyrics
  everywhere they show.
- The song menu, from a long press or a right click, shows the song's number
  and title at the top, so it is clear which song it opened on.
- A **Stars** view sorts the list by rating.
- **How much of the song is here**, as in the web view: a small cyan pie
  before the time by the seek bar, solid once the playing song is stored on
  the device, and while it is being stored or loaded a pie that fades in
  and out and fills as more of it comes in. A song being cached in the
  list shows the same filling pie in place of its pulsing dot.
- **Quarter stars**: ratings go in quarters, 4, 4.25, 4.5 and 4.75, where
  they went in halves. A tap on a star lights it in full, and a tap on the
  star the rating already sits in takes a quarter off before it comes back
  full, so star 5 runs 5, 4.75, 4.5, 4.25 and 5 again, while 3.5 with a tap
  on star 5 becomes 5. The first star runs down to 0. The star shows the
  part lit, the lists and texts the number, like 4.25★, and **Minimum
  stars** steps in quarters. The same in the web view and with the 0 to 5
  keys.
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
- **Debug log** under Developer: the log is kept only while it is switched
  on or a debug overlay is shown, so a log can be made while the player is
  used as usual. Mureka requests in it have anything that looks like a
  token, password or signature blanked out.
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
  a SHA-256 file and shows who signed it. It signs with the release key
  only: without one set, or with a debug signed result, it stops and
  publishes nothing. Debug builds use the same key, so both install over
  each other.
- `adb-reconnect.sh` reconnects adb to a phone over the network.

### Known limits

- Google sign in inside the app's WebView may still be refused by Google.
- Anyone on the same network can open the web view. Turn off **Allow from
  Wi-Fi networks** to keep it to the phone's hotspot.
- The Tesla greys out next and previous while a normal browser page plays the
  music. **Offer seeking to the browser**, under Developer, is there to test
  whether it changes that.
