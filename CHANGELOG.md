# Changelog

## 2.1.0

In development.

- **Playlists.** Mureka's own playlists, so they show on mureka.ai and on
  every device, can now be made and changed in the player, on the phone
  and in the web view alike:
  - The Playlists page has New playlist, then each playlist with its
    cover, Play and Edit. Edit changes the name and the description, takes
    the cover from the playing song or from a picture, and deletes the
    playlist with a second tap. Liked Songs follows the hearts and has no
    Edit.
  - Opening a playlist shows its songs in the playlist's order, the one
    set in the player, or newest added first as on Mureka, drafts
    included, and a queue made from the list plays them in that order. Play starts it from the top, shuffled
    with shuffle on, never the song paused or stopped before.
  - Over the list of an open playlist, in the mobile player and over the
    web view's big and small lists: its cover, name, number of songs and
    total time, with Play, Shuffle, Edit and a cross back to all songs.
    Play and Shuffle set shuffle off or on as they start. Edit opens the
    playlist's editor, on the Playlists page on the phone and in the
    Playlists popup in the web view.
  - A song's menu has Add to the playlist used last, by name, and Add to
    playlist, which offers the playlists, the latest used first, and New
    playlist. With a playlist open, it also has Remove from the playlist
    and Move to top, Move up, Move down and Move to bottom.
  - Picked songs go into a playlist with Playlist in the bar for picked
    songs, and out of the open playlist with Remove.
  - The songs of an open playlist have a handle to drag them to new
    places, in the mobile player's list and in the web view's list and
    small list, as long as the list stands in the playlist's own order,
    not sorted or searched. The new order holds at once, and the queue
    follows it.
  - Two new buttons for the button row: Playlists opens the playlists,
    and is lit while a playlist is open, and To playlist adds the playing
    song to the playlist used last, and is lit while the song is in it.
    Picking a playlist closes the playlists.
  - In the web view the playlists come over the blurred page, each with
    its cover, name and number of songs. Picking one opens it in the
    lists, Play on its row plays it, and New playlist and All songs sit
    at the top. The pencil on a playlist's row edits it right there,
    without opening it: its cover from the playing song or from a
    picture on the computer, its square chosen as for a song's cover,
    its name and description, Save, Cancel, and Delete with a second
    tap.
  - An open playlist stays open when the player starts again, as the
    queue made from it goes on, so Playing from still names it. It is
    read from Mureka again a moment after the start.
  - The web view's small list has Playlists as a fourth view beside
    Mureka, Queue and Sets, its button going round all four. A playlist
    picked there goes into the queue and plays, and the small list shows
    the queue.
  - Mureka keeps a playlist newest added first and has no way to reorder
    it, short of adding every song again a second apart, minutes for a
    long playlist. So the order set in the player is kept by the player,
    on the device, and goes with the export of song tweaks, Playlist
    orders being one more kind an import can take or leave, the one set
    last winning. Songs added to the playlist elsewhere come on top, songs
    taken out elsewhere drop out. On mureka.ai the playlist keeps
    Mureka's own order.
  - Adding to a playlist, taking out of one and moving in one say so in a
    note with Undo, on the phone and in the web view, which puts the
    playlist back as it was.
- **Song sets.** The versions of a song, made again and again on Mureka,
  can be kept together in a set, to compare them and listen them through.
  A song's menu has Add to a set: a new set with the song, or one of the
  sets used last. In a set, the menu takes it out, moves it to another
  set, renames the set or changes its color, one of the ready ones or any
  color from the color picker. Suggest similar songs lists the songs in no
  set that look like more versions of the set's songs, with why: the same
  or similar lyrics, the same or a similar title, small words like the or
  och left aside, most of the shorter title in the longer one or most of
  their letters alike counting, made in the same generation or shortly
  after one of the
  set's songs. The most alike come first and are ticked, the ones only a
  little alike follow unticked, up to twenty. A song made long before the
  set's oldest song, a month unless set otherwise on the Song sets page,
  is offered but not ticked. Add puts the ticked ones in the
  set. Lyrics count for songs played or opened in the player before, and
  only when they have more than a few words. In the list a set of
  several songs sits where its newest song was made, under a head row
  like the Sets view's, with its name, how many songs, how many public,
  the best rating and the day, and its menu. A tap on the head opens or
  folds it. Its songs go newest first, so new versions come on top, the
  two of one generation in the order Mureka made them, each with a bar
  of the set's color. A done set
  shows its kept and best rated song first instead. A queue made from the list plays a set's songs
  one after another. The playing song shows also in a folded set. The web
  view shows the sets the same way, and its song menu does all of the
  above as well, the custom color and the similar songs too. A trimmed
  song goes into its original's set. Sets travel with song tweaks, in a
  file and in a copied line, where Song sets is a choice of its own.
  Mureka, Queue and Sets are now the three lists everywhere: in the
  player's view menu, with A-Z, Stars and Plays as the sorts of Mureka's
  songs on a row of their own, in the web view's song list and in its
  small list over the main page, whose button goes through the three in
  turn: plain for Mureka, filled for the queue, ringed for the sets. It
  and the sort button keep one width, so the buttons beside them stay put.
  While the sets show, the sort buttons in the same places sort the sets,
  by Last added, Created or Name. The Sets view has a row for each set: its name and color, how many
  songs, how many kept, the best rating and a date. Sorted by the last
  time a song went in, by when it was made or by name, the done sets
  folded together after the others. A set's row says public when any of
  its songs is, draft otherwise, and how many are public, and each song in
  the Sets view carries its public or draft badge whatever the filters. A
  song tapped in the Sets view plays its set on from there, round to the
  songs before it, then the queue goes on. The songs the filters leave out
  are greyed and passed over, as in the list; a tap on one asks: play it
  now, the whole set from there, or after the song playing. Play the set in the set's menu is the same, with Play all of the
  set beside it when the filters leave some out. A tap opens a set in place, a long
  press or the button at its end shows what can be done with it: play
  the set, suggest similar songs, rename it, color it, mark it done, merge
  it into another set or dissolve it. Any number of a set's songs can be
  marked kept, the versions chosen, ticked in the set's color, first in a
  done set. The web view draws the fold arrows and the tick itself, so
  they show in browsers whose fonts lack them. A done set stays folded in
  the list with its color faded.
  Songs picked with Select go into a set together. New songs a load
  finds, made in the last two days and in no set, are offered for a set,
  the songs of one generation together: the set they most likely belong
  to first, by title, lyrics and the set a song went into a short while
  ago, then the latest used sets, a new set, or not now. Asked on the phone
  and in the web views, after the question about the play queue, and
  switched off on the Song sets page. The settings have a
  Song sets page, with the Sets view's sort and a way to dissolve the
  sets left with one song. Its Open the Sets view opens it where the page
  is shown, in the web view the web view's own.
  A Sets button for the button row, on the phone and in the web view,
  switches the sets off and on again: off, every song stands on its own
  in the list and the queue, and the sets are kept as they are. A pressed
  song keeps its set's color.
- **Songs still being made are matched to the sets.** As soon as the
  player sees new songs still being made on Mureka, it lays them against
  the sets, by title, by lyrics when Mureka gives them already, and the
  songs of one generation together, and asks whether to put them in a set
  they look like, on the phone and in the web view. Taken, they are in the
  set the moment they are ready. Songs that look like no set, or only
  like the set used last, are asked about once ready, as before. Songs
  asked about while being made are not asked about again.
- **Queued songs show in the lists.** A song put in the queue by hand, with
  Play next or Play last, has its title in gold in Mureka's songs and the
  Sets view, and its turn among those songs, Q1 the first to play, in
  place of its number, on the phone and in the web view, until it plays.
  With songs put in by hand already, a song's menu also has Play after
  queued, with how many there are, to put it in after the last of them.
  Putting a song in the queue from the list leaves the list where it was
  scrolled to, in the web view and its small list too, which went back to
  the top before, so the songs around it are at hand.
- **A set's place in the list, as chosen.** A set's place in the list, on
  the Song sets page, says where a set goes in Mureka's songs, newest
  first: by its latest change (the default), so a set just made or just
  given a song comes first; by its newest song with a trimmed song as old
  as the song it was trimmed from, so a trim moves neither the set nor the
  trimmed song to the top; or by its newest song as on Mureka, as before.
  With the songs by their publish date, the sets keep Mureka's place.
- **Songs being made show in their set.** A song still being made on
  Mureka that is in a set already leaves the top of the list and shows in
  its set, with the set's colored bar: under the set's name, at the top of
  its songs, folded or not, or just above the set's first song with Fold
  sets off. On the phone and in the web view.
- **Suggest similar songs takes songs still being made.** A song still
  being made on Mureka that looks like the set's songs is listed too, saying
  still being made in place of its date, on the phone and in the web view.
  Added, it is in the set as soon as it is ready.
- **A new set offers the songs like it.** Making a new set from a song, or
  from songs picked together, on the phone or in the web view, opens
  Suggest similar songs for it at once when a song alike enough to be
  ticked is found, to add with one tap or leave with Not now. Songs only a
  little alike do not open it.
- **Other apps keep playing until the player plays.** On an iPhone or iPad,
  the page's sound is ambient until the player first plays a song, so
  opening the player or coming back to it does not take the sound from
  another app's music, should the page make any sound. From the first play
  on it is music as before, heard with the ring switch on silent and on
  the lock screen. The debug log says when the page plays sound the player
  did not start.
- **Notes in the web view keep clear of a box's buttons.** A note that
  would cover a button of a box or a sheet open, the import's say, shows at
  the top of the screen instead.
- **Night mode as a speaker connects.** Each Bluetooth speaker on the
  Sound profiles page has Night mode as it connects: Stays on, Ask or Goes
  off. With night mode on as that speaker connects, Ask asks whether to
  switch it off, on the phone and in the web view, and Goes off switches
  it off by itself. The speaker's volume is its own, so the night
  profile's question about lowering the volume is not asked then. Only a
  speaker connecting while the player runs counts, one already connected
  as the player starts leaves night mode as it is.
- **The Sound profiles page says what is heard.** The profiles are listed
  by name, here, in the drop-downs and in the EQ button's list, and the one
  heard now says in use. While the sound is tweaked live, a Live sound row
  comes first, in use, with Edit to go on tweaking, Save as new, Set back,
  and Overwrite with a drop-down of the profiles, the one it came from
  picked. The live editor overwrites the same way. A profile saved or
  overwritten is the one in use from then on, picked for the speaker
  unless it is set for it already. Each speaker's name on the page is in
  the accent color.
- **Share a whole set.** Share the set, in a set's menu on the phone and in
  the web view, lists its songs all ticked, to untick the ones to leave
  out. Links copies their links on Mureka, an empty line between them, to
  send to anyone, and For the player copies a line for Import in another
  Mureka Player, with the kinds of values chosen as for picked songs.
  Where the device can share, the text can be handed to another app as
  well. A song without a link on Mureka yet is said in the list and left
  out of the links.
- **The web view's trimmer is heard where the songs are.** While the songs
  play on the phone, the trimmer in a web view plays its previews on the
  phone too, over Bluetooth or the phone's speaker and through the sound
  profile in use, the fade included, and its play head follows the sound
  heard there. With the songs playing in the browser, the previews play
  in the browser as before. Should the phone not play a preview, it plays
  in the browser from then on.
- **The EQ button shows the speaker's own profiles.** In its list, As set
  for names the profile it uses now, and the speaker's own profile and
  night profile are ringed and say set for this speaker, or at night, on
  the phone and in the web view. In the web view a night profile has the
  moon in place of the EQ icon.
- **Fold sets.** A Fold sets button beside the sorts in the list's view
  menu, on the phone and in the web view, one beside the sort of the small
  list over the web view's main page, and Fold sets in the song list on
  the Song sets page. On, as before, a set's songs in Mureka's songs
  come together and fold into one row under the set's name. Off, every
  song stays in its own place on its own row with the set's color, so
  Mureka's songs and the Sets view no longer look alike. The queue keeps
  the sets together either way.
- **Sound profiles and night mode.** A Sound profiles page in the settings, on
  the phone and in the web view, holds profiles of nine bands an octave
  apart, 63 Hz to 16 kHz, a volume that can go below the
  device's lowest step, and a compressor at three strengths that holds the
  loud parts down. The page lists the profiles, each with a line on what
  it does and an Edit button that opens its editor, where the bands are
  upright sliders side by side, heard at once while moved, also in the
  web view. A profile can be marked a night profile. Each
  Bluetooth speaker gets a profile and a night profile, the device's own
  speaker and devices not set up one of each, and the profile follows the
  speaker connected. Night mode switches to the night profiles, from a
  Night button for the button row, the menu or the Sound profiles page, on the
  phone and in the web view. Off unless switched on, and not on an iPhone
  or iPad. Switched on during a song streamed from Mureka, the profile
  takes the next song. Only the sound played by the device running the
  app goes through it, which the web view's Sound profiles page says, not music
  playing in a web view's browser. In the app, a night profile can ask,
  as night mode goes off, whether to lower the device's volume as much as
  the profile turned the song down, never below the lowest step, so the
  song does not suddenly get loud. Night mode stays on until it is
  answered. A profile can also cut the bass away below a frequency, a
  high-pass filter set with a slider from 20 to 300 Hz. The EQ button for the button row
  picks any profile by hand for the speaker or headphones in use, until
  another takes over or it is set back, on the phone and in the web view.
  **Tweak the sound now**, from the EQ button or the Sound profiles page,
  changes the sound heard live for the speaker in use, the volume, every
  band, the bass cut and the compressor, starting from the profile in
  use, for a speaker in a new room say. Nothing is saved until **Save to**
  the profile it came from or **Save as new profile**, which is picked
  for the speaker in use and can be renamed. **Set back** forgets it, and
  it is forgotten when another speaker or headphones take over.
- **Settings in the web view answer at once.** A stepper's number moves
  as soon as its minus or plus is pressed, as a switch already did, and
  the device's reading follows.
- **Filters button.** A button for the button row, or a group, that opens
  all the filters, on the phone and in the web view.
- **Button groups.** Any number of button groups can be made on the
  Button groups page of the settings, shared by the mobile player and the
  web view, each with a bar of its own to drop buttons in. A
  button can be in the button row and in any number of groups, once in
  each. A group is put in the button row like any button, on the phone
  and in the web view. There it looks like the button chosen for it and
  shows what that button shows, with a small mark, and a tap opens all its
  buttons over the row. A group can have a name of its own, shown under
  it when the buttons have names. A tap outside or a swipe closes them,
  and if set, they close by themselves a few seconds after the last press,
  fading a little first.
- **New songs into a set before they play.** The question about where
  new songs go in the play queue has Put in a set first: the likeliest
  set, the sets used most or a new one, then the question comes again
  for the queue, on the phone and in the web view.
- **Notes.** A song's menu has Note, a few words kept with the song, shown
  in Information and in the menu, on the phone and in the web view. A trimmed song takes its original's
  note. Notes travel with song tweaks.
- **Songs the filters leave out stay in the list.** The song list shows
  every song, those the filters leave out greyed between the others, in
  every list view on the phone and in both lists of the web view. Several
  in a row fold under the first, whose number gives way to a button of
  one width with how many there are and an arrow that opens and folds
  them, in the accent color, filled while open. A fold opens also
  when its first song started playing since the list was drawn, and in
  the web view one the phone could not send right away is asked for again
  or closes with a note. A tap on one asks how to play it: Play now plays
  only it, then the queue goes on as it was. Play from here plays on down
  the list from it, the songs after it the filters leave out included, as
  shown. Play after this song puts it right after the song playing, and
  Play all after this song, there when more such songs follow, puts them
  all there. They can be put in the queue as usual. The count line says
  how many songs the filters let through and how many they leave out. In the web view only the songs the
  filters let through are numbered, a greyed one has no number and the
  song after it takes the next one. A playlist still shows only its own
  songs. With the published songs listed, newest published first, a draft
  goes where it was made among them. A Library setting, on unless
  changed, shows only the songs the filters let through instead.
- **The queue goes on from a song outside the filters.** With shuffle off,
  a queue playing a song the filters leave out, made again from the list,
  goes on after the last song played that the filters let through, rather
  than from the top, so songs played now with the queue kept leave the
  rest of it as it was.
- **New songs played now while nothing plays come first.** Stopped or
  paused, Play now in the question about new songs puts them in the place
  of the song that would have played, which follows after them, rather
  than after it.
- **Hearts follow a like everywhere.** A song liked or unliked, on the
  phone or in a web view, shows its heart as it is in every list at once,
  the small list over the web view's main page too.
- **Dismiss leaves the other app playing.** On an iPhone or iPad, a play
  Safari held back while another app, a video say, had the sound went
  through on the next tap, Dismiss in the box asking to play on among
  them, and took the sound from that app, which went quiet. The play and
  the sound engine's wake are now called off as soon as the hold is seen,
  the song staying where it was, so only Resume playback starts it. Coming
  back into view plays on once, not once for each of the events that come
  with it.
- **Media buttons come back after a voice assistant.** Android sends
  Bluetooth, headset and steering wheel buttons to the app that last played
  sound, so after a voice assistant, a call or another app spoke, the
  buttons went there and did nothing for the player until it was played
  from its own screen. On Android, while the player is paused, a short
  sound from another app ending, or a Bluetooth output connecting, now
  plays a fraction of a second of silence so the buttons come back. A
  sound longer than three minutes, another music app say, keeps them. The
  debug log notes other apps' sound starting and stopping, and the buttons
  taken back.
- **Why a car's buttons stop arriving, in the debug log.** On Android, the
  debug log notes what the media session tells, the Bluetooth sound
  stream starting and stopping, its link coming and going, and all sound
  playing on the device and where it goes. A new song is told before that
  it plays, so a car hears of the song first.
- **The play head on an iPhone or iPad goes by the song's own clock.** After
  a move in a song it no longer guesses a delay from the sound's levels or
  holds the play head back by a delay measured once before, which left it
  a second or more behind the music, so a song could end before the play
  head reached the end. Only the sound engine's own delay is allowed for,
  and delays kept from before are dropped. A move within a song, by the seek bar,
  the waveform, Previous going back to the start, a key or the lock
  screen, loads the song again and starts it at the new place, as a song
  started anew, when the song goes through the sound engine for the fades.
  Safari otherwise plays on about a second and a half of the old place
  after a jump and then stays that far behind the play head. While a song
  plays through the sound engine, the play head goes by the engine's clock
  from where the song started playing: Safari's own clock for the song
  stands still for a few tenths of a second about half a second after a
  song starts or plays on, and stays that far behind the sound after. The
  page's own clock moves the play head smoothly between the engine's
  steps, which come only a few times a second, and the delay on the way
  out to the speaker or headphones, as the engine tells it, is allowed
  for, about a fifth of a second with Bluetooth headphones. At a pause the
  play head stays where the sound was, and the song plays on from there:
  Safari's own clock would take it back a few tenths of a second, so the
  song is loaded again at that place, in the silence before its fade in.
  A song streamed from Mureka, its stored copy too slow as it started,
  plays on from the stored copy, or from the stream loaded again at that
  place when no copy is stored, and with the sound engine woken only
  after the song plays on, the play head goes by its clock from then. A
  song started from its beginning is heard the delay on the way out later
  still than one loaded at a place, and the play head allows for that
  too. A song still playing stops before the next one loads, as one that
  ended has, since swapped while it plays the new song is heard later
  again. A new song, as from Play when ready after a pause, no longer
  takes the paused song's place and delay: it had started that far into
  itself with the play head off until a pause and play. Play now on new
  songs downloads the first whole before it plays, while the song playing
  goes on, as a song played as soon as it is ready already did, since one
  streamed from Mureka is heard out of step with the play head on an
  iPhone until a pause and play; with nothing playing it still starts at
  once, for the tap to start the sound. After the sound
  engine is stopped and started again for a clock that stood still, the
  play head counts on with the engine from there. The debug log tells how the song's clock, the
  engine's and the play head run the first seconds after a song plays, and
  the delay on the way out whenever it changes.
- **The web view in the add-on and the bookmarklet.** The web view's
  large layout can now fill the screen over the Mureka page itself, with
  the player there playing the music, no app needed. Web view in the
  actions opens it, and in landscape a Web view button in the header
  does too. With Web view in landscape on, it comes by itself when the
  screen turns to landscape and the mobile player comes back in
  portrait. A phone button in the web view's bar goes back to the mobile
  player at any time, and in landscape a round Web view button in the
  corner goes to the web view again, where it was left. Its fullscreen
  is the page's, so it stays on either way. The page is carried inside
  the player, so nothing more is loaded for it, and the release
  bookmarklet's hash covers it too. Where a site does not let the page
  run, the player says so and stays.
- Fold sets in the song list is kept when the player opens again.
- The fade settings say which way they fade: Fade out for a song tapped,
  Fade in when playing on, Silence before the fade in and so on.
- **Play head zoomed in.** A new setting for the zoomed waveform, for the
  mobile player and the web view alike, and each browser can have its
  own. Stays in the middle is the play head as before, with the waveform
  sliding under it and the whole song as a thin line at its foot. Moves
  along the song puts it where the song is, as zoomed out: at the left
  edge at the start, in the middle halfway and at the right edge at the
  end, the view moving with it at an even pace. Everything left of it is
  then the played part, so the thin line and the color past the play
  head are not needed. Dragging it, the play head goes with the finger
  right out to the edge, and past two thirds of the way the waveform
  scrolls on, the faster the further out, up to the whole song in about
  three seconds at the very edge.
- **The song's text reaches the list on a wide screen.** With the small
  list beside the song in the web view, the panel holding the song's text
  now reaches out to the list, so no strip of the cover shows between
  them on a wide screen.
- **Covers over Bluetooth while offline.** With no internet, the cover
  sent to the lock screen and over Bluetooth is the one stored on the
  device, also with Remote artwork URL on, and the app sends its stored
  cover when Mureka's cannot be downloaded.
- **The Mureka requests log shows playlists and picture uploads.** It now
  also logs what Mureka answers when a playlist is opened, and when a
  picture is uploaded: the upload's host and path, and the parts of the
  storage pass that say where it goes. Keys, tokens and the signature
  are never logged. Requests about making songs (generating, lyrics,
  voices, styles, models, tags and the like) are logged with their whole
  body and a longer answer, the reads among them too. Answers that come
  as a stream of events, connections kept open both ways (what is sent
  and the first messages back), the body of a request handed over whole,
  and requests the site sends past the watched fetch, named from the
  browser's own list of what was loaded, are logged as well, Mureka's AI
  streams for lyrics and styles with what the site made in the ten
  seconds before each answer came (JSON, form fields or a Request of its
  own), its analytics left out, and the text that streamed back. A slow
  request the watched fetch saw is no longer listed a second time. On a
  connection kept open, the pieces of a reply being written are counted
  rather than logged one by one, so up to 300 other messages fit, and a
  list or object under a name that looks secret keeps its shape, only
  the secret values inside it hidden. The site's session recording,
  translation lookups and analytics are left out of what it made. Characters, remixes and voice
  training are logged in full too.
- **Covers larger under the mouse.** In the web view, a cover in a list
  or among the playlists, held under the mouse for about half a second,
  comes up large beside it, and goes as the mouse leaves, presses or the
  list scrolls. A finger keeps its long press.
- **Stop beside what is running.** The line that shows a load, a rescan,
  caching songs or the reading of play counts has a Stop, ringed in red,
  in the mobile player, over the web view's list and in its small list.
  A stopped load or rescan keeps the songs read so far.
- **BPM worked out from the song.** A song's tempo is worked out from the
  song itself once it is stored on the device: the playing song first,
  then the songs coming up next, as many as Cache ahead and at least five,
  one at a time in the background, waiting while the power saving has
  stopped the background work. Not the whole library: a song gets its
  tempo as it comes near, and keeps it.
  Where notes and beats start is measured in a deep, a middle and a
  bright band, the beat is the spacing at which those starts repeat best,
  and a check halfway between beats keeps it from landing on half or
  double the tempo. Only a clear beat is used. Settings, Library, BPM from
  chooses Mureka's first, the song's first or Mureka's only; a BPM set by
  hand still comes first. Information says where the BPM came from and
  shows the other one when they differ, and the debug log compares each
  worked out tempo with Mureka's, with a count when a run is done. Stats
  for nerds has a Tempo part: the BPM in use and where it came from,
  Mureka's, one set by hand, the song's own to a tenth with how sure it
  is in percent (in use, sure enough to use while Mureka's comes first,
  or too unsure to use) and how long it took, its half and double, the
  beat check, and the choice in the settings. The tempo is measured over up to 32 beats for a
  finer value. The beat check, which decides between a tempo and its half
  or double, also asks the deep band, the kick and the bass: real songs
  around 100 BPM have eighth notes and other short sounds halfway nearly
  as strong as the beats, while their kick and bass keep to the beat, so
  a tempo is doubled only when the deep band is strong halfway too, more
  so past 160 BPM. It also finds three beats where two were counted, as
  in songs at 167 and 172 BPM that came out at 111 and 115: over two
  beats the thirds then are as strong as halfway, in the deep band too.
  With Mureka's tempo near the one found it is kept, and near one of the
  others the way there takes less. Tried on real songs with tempos
  measured by hand. Tempos are kept on the device for the BPM filter,
  the lists and sorting; one worked out an older way is kept and used
  until the song comes up and is worked out again. The
  debug log tells how each was settled, and the count how many were
  doubled or halved.
- **The phone's Bluetooth devices from the web view.** A long press on
  the phone's sound choice, or a right click with a mouse, opens the
  phone's paired devices over a blurred page, each with what it is,
  whether it is connected and whether the music goes to it. Connect,
  Disconnect and Play here act on the phone, so a speaker beside the
  computer can be connected while the phone stays where it is. Android
  lets only the system connect a device, so the hotspot helper does it,
  through its Binder while it keeps running, else over wireless
  debugging. Android 13 or later. With Bluetooth off, Switch on turns it
  on, and an old or stopped helper can be started from there.
- **Create songs on Mureka from the player.** Create songs, in the
  Library menu, as a button for the bar and in the web view's song
  lists, opens a page with what Mureka's own create page has: a song
  with lyrics or an instrumental, the model (V9.5, V9, V8, O2, V7.6 or
  V7.5), the title, the lyrics and the style with their counts, a male
  or female voice or one of Mureka's characters, a remix of a song
  uploaded to Mureka before or of a song file uploaded from here, the
  length (automatic or two to five minutes, on a slider with a ten
  second step either way) and the wildness in percent. Title, lyrics and
  style each have a Clear, and Reset starts the whole form over, both
  with Undo. Mureka's helpers write lyrics and a title from a theme,
  write the lyrics better, and write the style out (Match my vibe, and
  Surprise me, which needs nothing written first), the text filling in
  as it comes, then Mureka updated the lyrics or the style, with Undo.
  While Mureka works the page dims under a large turning ring, blurred
  behind, as in the trimmer, with Stop to give up when Mureka is slow or
  does not answer, the heading and Close still in reach. My styles lists
  the styles saved on Mureka, Save style saves the style written. Lyrics
  Mureka would rather write better first are asked about before the
  songs are made. For a remix Mureka's suggested style fills an empty
  style, else it can be taken with a button. Once they are ready, the
  two new songs can play when ready, the one ready first at once and the
  other after it, or both play next, and Put them in a set puts them in
  a set chosen beforehand, shown in its own color, the one the title,
  lyrics and style look most like chosen at first, Change listing the
  sets with their colors and song counts, or in a new set named as typed
  or after the title. In the web view the form is laid out in boxes, a
  few choices joined in one bar whose filled part slides to the one
  chosen, a switch for the set and the buttons that open a list filled.
  Mureka's helpers are ringed in cyan, Save style in grey and No remix
  in red, so they stand apart from the lists. The form is kept between
  visits and shared with the web view, where the same form opens from
  its own Create button, a song file sent through the phone up to 16 MB.
  The two new songs show at the top of the list while they are made. Use
  in Create, in an own song's menu on the phone and in the web view,
  reads the song from Mureka and puts its title, lyrics with their
  section tags, style, model and voice in the form, with Undo.
- **Play when ready can be changed.** Tapping a song still being made
  that was asked to play when ready offers the other way, at once or
  after the playing song, or not to play it, for a tap that went wrong.
- **More volume steps in the Android app.** More steps, under the
  phone's bar in the web view's volume popup, makes the phone's volume
  100 steps instead of its own 15 or so, a percent a press. The phone
  goes to the step at or above the level and the player turns its own
  sound down for the part between that step and the one below, evened
  out by loudness as heard, so a level just under a step is only a
  little quieter than it, even where the phone's lowest steps lie far
  apart. Lower the volume as night mode goes off lowers the level by the
  night profile's dB in percent, the night profile's own gain applies on
  top as before. Kept over a restart, and the phone's own buttons go on
  from their step. Each change is in the debug log under Volume, with
  the step, its dB and the player's share. A Bluetooth speaker with
  absolute volume turns its sound down by its own curve, which can show
  as a jump just past each of the phone's steps, so each speaker in
  Sound profiles, Speakers has a volume step size in dB, as the phone
  says until set by hand, and the volume popup points there. The phone's
  volume buttons can move the 100 steps by 1%, with a box in the volume
  popup and in Sound profiles: with the app on screen a small volume
  popup shows for 1.5 s, and outside the app, while its music plays,
  Android shows its own slider. Stats for nerds shows the real volume,
  the phone's step and its dB and the mixer's share, and a web view
  setting shows the same small in the volume popup. Passing one of the
  phone's steps going up, the player's share changes first and the step
  a moment later, 250 ms over Bluetooth and 80 ms otherwise, so the step
  no longer reaches the speaker before the share is heard and gives a
  short burst; going down, the step changes at once, as one put in later
  gave a short rise.
- **The web view's settings in the bookmarklet and the add-on.** The
  Web view page in Settings showed only in the Android app, so the web
  view shown in the page kept its defaults. It shows now wherever the
  web view does, without the phone's own heat, battery, hotspot and
  WireGuard badges and volume steps.
- **Similar songs: Add greyed out until a song is ticked.** In the web
  view the button that adds the ticked songs to the set looks inactive
  while none is ticked.
- **Questions over the popups in the web view.** A question asked with
  the playlists or the form for making songs open shows on top of them.
- **A playlist's cover from the web view in the page.** Choosing a
  picture for a playlist from the web view shown inside the page changed
  nothing, it now sets the playlist's cover.
- **Popups fit what a phone's browser shows.** The playlists', the
  Bluetooth devices' and the Create popups size themselves to the part
  of the screen really seen, so on an iPhone in Safari the top with
  Create is no longer hidden behind the browser's bars, and the models
  stay in one row.
- **Both new songs play when ready with shuffle on.** Of two songs asked
  to play as soon as they are ready, the second could be woven into the
  queue at random, or offered and put elsewhere, while the first faded
  in; it now waits for its place right after the first. Shuffle switched
  on with a queue put together by hand also keeps the songs put in with
  Play next right after the playing one.
- **Each song of a set numbered in the web view.** A set's songs in the
  list had one number between them, on the first, so the next set's
  first song took the number after it. Each song the filters let through
  now has its own, and a folded set leaves out the numbers of the songs
  it hides.
- **The way back to the playing song shows when it should in the web
  view.** When the song changed on its own to one further down than the
  rows read so far, the button went by where the last song was and
  stayed hidden; it now shows whenever the playing song is not in sight,
  and asks the phone where the song is before reading the list down to
  it. Rows are measured on the screen, it is looked at again now and
  then, and as the page comes back after the phone's browser slept.
- **Import data from a set question.** A question about new songs and
  their set has Import data, here and in the web view, which opens the
  box to paste an export in, for sets already made on another device.
  The set questions wait for the import, at most three minutes, and then
  ask only about the songs it left out of a set; a box closed without an
  import lets them go on at once.
- **Memory in the debug log.** Every five minutes, and a minute after
  the start, a Memory line counts what could pile up: the page's
  elements and the player's, audio elements, links to files held in
  memory, the song list and the player's caches, the log and the tab's
  storage, and the heap where the browser tells it. As the lines from
  before a reload survive into the new page's log, a page a phone's
  browser reloaded for lack of memory shows what grew.
- **Mureka's templates in Create.** Templates beside My styles, on the
  phone and in the web view, lists Mureka's templates by kind of music,
  a page at a time, each with its kinds, what it is and how often it was
  used. A template picked is told to Mureka as used, as its page does,
  and gives the style; the songs made name the template while the style
  is still its text. Each template shows its cover and has Listen, which
  plays its song, the player's own song paused meanwhile and going on
  after; in the web view it plays in the browser, the phone paused
  meanwhile.
- **Lists to pick from fit a phone.** In the lists of saved styles,
  templates and the others, a short list in a phone's browser squeezed
  the rows until their text ran over each other; each row now takes its
  own height, long text showing its first lines.
- **Easy in Create.** Beside With lyrics and Instrumental, Easy takes a
  wish in words and the model, and Mureka's agent writes the lyrics and
  the style and makes two songs, as Mureka's easy mode does: a chat is
  started, the wish sent over the agent's socket, and once Mureka has
  taken it the form closes while the agent works. What it is doing and
  what it says show in the form's line, its songs are played and put in
  a set as chosen, and the socket closes when the agent is done or after
  twenty minutes.
- **The tempo of syncopated songs.** A rhythm with hits three and five
  sixteenths apart repeats almost as well at five sixteenths as at the
  beat, and a song at 130 BPM came out at 103. The tempo worked out now
  looks at the bar, the shortest spacing between 1.2 and 4.4 s at which
  the song repeats about as well as at its best: another beat that
  divides it into 2, 3, 4, 6 or 8 and scores nearly as well takes over
  from one that does not, and three beats are not taken where two were
  counted when the beat splits the bar into 2, 4 or 8. The debug log
  says when the bar decided it, and every song's tempo is worked out
  again as it comes up.
- **Songs made while Mureka keeps its answer.** Mureka can hold its
  answer to making songs for a minute or more while the songs are
  already being made, and after 60 s the player gave up and said it
  failed. The first page of the library is now looked at every 4 s
  meanwhile: a generation new since the request went out, of the title
  asked for, counts as the answer, the form closes and the play and set
  choices follow it, while Mureka's own answer, waited for up to three
  minutes, comes in the background. The debug log says how long each
  took and Mureka's place in line.
- **Rows for songs asked of Mureka.** As Mureka's own page does, two
  rows named as asked show at the top of the list, on the phone and in
  the web view, as soon as Create sends the request, marked Asked of
  Mureka. The real songs take their place as Mureka lists them; the rows
  go if the request fails, and after six minutes at most. A tap on one
  says Mureka has not listed the songs yet.
- **The next song in step on an iPhone.** A song from its beginning, as
  the next one after a song ends, was heard a good while after the play
  head and the waveform until a pause and play, more than the way out's
  delay allowed for. Through the sound engine on an iPhone or iPad such
  a song now starts 50 ms in, so Safari plays it as one loaded at a
  place, the way a pause and play does, in step with the play head.
- **A trimmed song in step on an iPhone.** The new song that plays on
  after a trim was streamed from Mureka, which Safari's sound engine for
  the fades plays out of step with the play head and the waveform until
  a pause and play. It is now downloaded whole first, as a new song
  played at once is, and plays on from the device; not downloaded in
  time, it streams as before.
- **The trimmer's waiting ring as in Create.** While Mureka trims, the
  trimmer behind the ring is dimmed and blurred, on the phone and in the
  web view, with the larger ring Create has.
- **Easy mode goes on in the same chat.** After a song is made in Easy
  mode, the next wish is sent to the same chat with Mureka's agent, so
  it can be a change such as "more rhythm" or "a faster tempo". A line
  above the wish shows which song the chat is about, and New song
  forgets the chat so the next wish starts a new one. The chat is kept
  with the draft, so it is still there after a reload or a restart, on
  the phone and in the web view.
- **An Easy mode song remembers its chat.** Each song made in Easy mode
  keeps the chat it was made in, for the latest 200 generations. Use in
  Create on such a song opens Easy mode in that chat, marked as going on
  in it, so the next wish tells the agent what to change. Other songs
  fill in the form as before.
- **A new chat with the same wish.** Next to New song, New chat, same
  wish forgets the chat and puts the wish it started with back in the
  box, to change or to make again as it is, on the phone and in the web
  view. On a narrow phone the line about the chat sits above the two
  buttons.
- **Instrumental in Easy mode.** A switch below the wish, on the phone
  and in the web view, sends the wish starting with "Instrumental ". The
  box then holds 13 characters less, 1987, so the message stays within
  Mureka's 2000; a longer wish is cut when the switch is turned on.
- **The agent's style and lyrics to start from.** When Mureka's agent
  makes songs, the style, lyrics, title and voice it asks Mureka for are
  kept with the songs, for the latest 100 generations. Use in Create on
  such a song puts them in the form as well, under With lyrics or
  Instrumental, while Easy mode goes on in its chat, so another song can
  be made from them by hand.
- **The web view's Actions in groups.** Actions is laid out as the
  phone's menu, under small headings: the playing song, Library (Load,
  Rescan, Cache all, Clear), Songs (Playing from, Playlists, Creators
  and Create songs, new here), Screen, and Copy and import. The playing
  song's many choices no longer fill the bottom of Actions: its title is
  one row that opens the song's own menu, with its stars. On a phone
  Actions keeps two columns.
- **Use in Create on an Easy mode song brings its style.** When the
  agent's own style and lyrics were not kept, as for songs made before
  2.0.1.84, the song is read from Mureka as other songs are, and its
  title, lyrics and style go in the form. New song in the line about the
  chat then goes to the form with them, to make a new song from the
  style by hand, instead of a blank wish.
- **Max volume as a speaker connects.** Each Bluetooth speaker under
  Sound, Speakers has a switch, off at first, and a slider from 5 to
  100%. With the switch on, the app lowers the volume to that level when
  the speaker connects, if it is higher; a lower volume is left as it
  is. It checks 1.5 and 4 seconds after the speaker becomes the output,
  as Android puts back the speaker's own volume a moment after it
  connects, and it works with More volume steps too. A speaker already
  playing when the app starts keeps its volume. It needs this version of
  the app.
- **Max volume as a speaker connects is one slider.** The switch and the
  level are a single slider from 0 to 100%, off at the left end, as Bass
  cut is, on the phone and in the web view. A speaker set in 2.0.1.87
  keeps its level, or is off when its switch was.
- **Volume now, to try a step size.** Under the volume step size of the
  speaker the music plays on now, or of this device, a slider with 100
  steps sets the volume at once, with the phone's real step, its dB and
  the player's mixer under it, as in the web view's volume popup. It
  follows the volume buttons and the speaker in use, and needs More
  volume steps on and this version of the app.
- **The volume note in the web view shows the real volume.** Moving the
  volume with the keys or arrows, the note with the level has the real
  volume, the phone's step with its dB and the mixer small under it,
  when Volume numbers in the volume popup is on.
- **More volume steps lower evenly between the phone's steps.** Each of
  the phone's steps now falls on a whole percent with the mixer at 0 dB,
  and every percent below it lowers the sound by the same dB, the most
  just above the step below. Before, the percents fell differently in
  each step, so one percent down could lower 0.7 dB in one place and
  nearly a whole step in another, and the cuts were even in loudness,
  not in dB.
- **Sliders in the web view's settings under their names.** Max volume
  as it connects, Volume now and Bass cut have the name on a line of its
  own, in line with the other settings' names, the value at the right of
  it, and the slider the whole width under it. Before, the name sat
  further left than the others.
- **The web view's settings follow the phone after a slider is moved.**
  A slider keeps the focus once let go, and the page was not drawn again
  while a field in it had the focus, so after Volume now or Bass cut was
  moved nothing on the page followed the phone any more, the step and
  mixer under Volume now among it, until something else was tapped. A
  slider no longer holds the drawing back once let go, and the page is
  read again half a second after, when the phone has the result.
- **More volume steps no longer fall back a step after going up past
  one.** Going up past one of the phone's steps, the step is put in a
  moment after the player's own sound. The same level asked for again in
  that moment, as a slider sends its last place twice, dropped the step
  still waiting, so the phone stayed on the step below, and a second
  later the app took that for the volume buttons and moved the level
  down to it: below 6% to Off, and from 7% back to 6%. A step waiting
  now goes in as planned, and Volume now sends each place once.
- **Train the volume steps by ear.** A speaker does not get louder by
  the same amount at each of the phone's steps, so one step size made
  More volume steps dip or jump at some steps. Under Volume now, Train
  the step sizes is a guide, on the phone and in the web view: the song
  playing is heard at a step, turned down by a gap, and at the step
  below in turn, a second each, with a short fade at each change, and -
  or + sets the gap until the change can no longer be heard. It goes
  through a few steps from quiet to loud, the two lowest and some spread
  up to the top, with Back, Skip and Next, and ends with every step's
  gap, set or drawn on a straight line from those set, to save. Each
  speaker and this device keep their own, and a training goes before the
  step size set by hand. Between two steps the player lowers the sound
  by the trained gap of that step, evenly in dB. While training, the
  compressor of the sound profile is off, as it would make the gap heard
  too small.
- **Quieter, for training at night.** A red slider in the guide turns
  the sound down in the player only, on both sides of the comparison
  alike, so the gaps found stay the same. It is apart from the volume
  and gone once the training ends.
- **The training of the volume steps in a popup of its own, without
  breaks in the sound.** Train the step sizes opens a popup on the phone
  and in the web view, the web view's drawn from the state, so the side
  playing shows the moment it changes. Each side plays three seconds,
  and the switch no longer fades the sound out: the player's share
  changes first and the step a moment later, as the share reaches the
  speaker only after Bluetooth's delay. Before, each switch left about a
  third of a second of silence, often heard as two dips, which made the
  comparison hard to hear.
- **Switch delay, found in the same training.** The popup has the
  speaker's delay in ms, set 25 ms at a time until a switch has no dip
  or bump. It is kept with the trained steps and used by More volume
  steps too, which then put the step in after that delay going up and
  going down, so the player's share and the step reach the speaker
  together.
- **Clearer buttons in the training.** Leave out drops the step, to be
  drawn from the others. Keep, next keeps the gap and goes on, Keep,
  done keeps it and leaves the steps still to come to be drawn, and the
  last step has Keep, finish. In the settings, Forget the training is
  red on the left and Train the step sizes on the right.
- **Volume steps for each speaker, trained or typed in.** The volume
  step size is gone, with its Same as this device: each speaker and this
  device have Volume steps instead, with what is in use in a line,
  Forget in red on the left, Edit by hand, and Train by ear in a cyan
  ring on the right while the speaker plays. Edit by hand has a field
  for each of the phone's steps, the dB it is louder than the step
  below, and the switch delay, a step left empty showing what is drawn
  for it from those set. One value alone counts for every step, as the
  step size did, and a step size set before becomes that. A Bluetooth
  speaker no longer takes this device's steps: without its own it goes
  by the phone's curve. The steps are kept with the settings, go along
  in a copy of them, and reach the app at once when a copy is put back.
- **Volume steps for speakers not set up, with the dB shown.** A speaker
  without volume steps of its own takes this device's again, as the
  heading This device and others not set up says, and without those the
  phone's curve. The line under Volume steps always says what is in use
  with its dB, such as As the phone says, about 4.0 dB a step, or Same
  as this device: 3.5 dB a step, and the empty fields of Edit by hand
  show the values in use. A speaker with nothing kept no longer shows a
  switch delay of 0 ms.
- **Buttons spread out in the web view's settings stay inside it.** A
  row of buttons laid out apart, as Forget, Edit by hand and Train by
  ear under Volume steps, ran past the right edge of the settings when
  they did not fit. They now go onto another line, side by side from the
  left, the last one kept at the right.
- **Forget, Edit by hand and Train by ear fit on one line in the web
  view.** The web view gives the action buttons of a settings page the
  width of the widest of them, which made these three too wide to sit
  side by side. A row of buttons spread out keeps their own widths.
- **The volume step size is back, greyed while steps are set.** Under
  Volume steps, Volume step size, dB always shows the step used for
  every step while none is trained or typed in: the speaker's own, else
  this device's, else what the phone says. While trained or typed steps
  are in use it is greyed and cannot be changed, and Forget brings it
  back into use. A step size is no longer turned into a volume step of
  its own.
- **Steps filled in shown in the web view.** A step left empty under
  Edit by hand is drawn on a straight line from the steps set around it,
  and the web view now shows that value greyed instead of a dash, - and
  + going on from it. A small cross beside a step set takes it back to
  the value filled in.
- **Volume now follows under the finger in the web view.** The line
  under Volume now, the real volume, the phone's step with its dB and
  the mixer, came with the copy of the settings page, which is not drawn
  again while a finger is on a slider, so it only changed once the
  slider was let go. The web view now draws that line itself from the
  phone's state, as the volume popup does, so it follows while the
  slider is moved back and forth.
- **Step 1 against the lowest, typed in by hand.** Edit by hand starts
  with Step 1, dB louder than the lowest: how much quieter the lowest
  level above silence, 1%, is than the phone's first step. Set, the
  levels under step 1 go down by it evenly in dB, as between the other
  steps. Empty, they go down by their share of step 1 as before, which
  the field shows greyed, about 15.6 dB with 16 steps. It cannot be
  trained, as there is nothing to hear it against, and it has no part in
  drawing the steps from 2 up. Each speaker has its own, this device's
  for those without, and Forget takes it away with the rest. Any value
  typed in is taken away by emptying its field, or with the cross in the
  web view.
- **Switch by hand in the training.** The training no longer switches by
  itself every three seconds: a large Switch button moves between the
  step turned down by the gap and the step below, as often as needed, on
  the phone and in the web view. Each step starts on the step itself.
  With nothing pressed for 15 minutes the training still ends by itself.
- **A training updates the steps set before, or replaces them.** The
  steps set before stay apart from those set now: a step left as it is,
  with Leave as is, the new name of Leave out, keeps its value from
  before. When steps were set before, the end of the training asks with
  two buttons: Save, keep the others keeps those from before for the
  steps not set now, and Save, only these lets them go. The list there
  marks each step set now, kept from before or drawn.
- **Damp the louder steps.** A box in the training, on at first, turns
  both sides down from the third step trained on by as much as the steps
  have risen since the second, so the louder steps are heard about as
  loud and need not be turned down more and more by hand. The first two
  are not damped. Both sides are damped alike, so the gaps found stay
  the same, and Quieter comes on top of it.
- **Each speaker folded under its profiles.** Under Sound profiles a
  speaker shows its Profile and Night profile, and Show more opens the
  rest under them: night mode as it connects, max volume as it connects,
  the volume steps and Volume now, folded again with Show less. Which
  are open is kept while the player runs, on the phone and in the web
  view.
- **Edit by hand in a popup of its own.** The volume steps typed in by
  hand open in a popup on the phone and in the web view: step 1 from the
  lowest, each step and the switch delay, each with - and +, a field to
  type in and a cross to take the value away, a step left empty showing
  greyed what is used for it. Changes are kept at once.
- **The volume steps' buttons line up.** Edit by hand and Train by ear
  sit side by side at the same width across the page, Edit by hand alone
  across it while the speaker does not play, and Forget across it in red
  on a line of its own when there is something to forget. In the web
  view a row of buttons laid out alike keeps that, as its copy of the
  page let it go before.
- **The volume shown in a browser when the phone moves it.** The web
  view in a browser, on a computer or another phone, now shows its
  volume popup for a moment when the phone's volume changes from
  elsewhere, by the phone's buttons or a speaker's highest as it
  connects, as the phone's own screen does for its buttons. A change
  made in that browser, by its volume popup, the arrows, Volume now or a
  training, does not open it.
- **Where the sound goes, by name, in the debug log.** Sound playing on
  the phone now names the device each sound goes to, and says to nowhere
  when Android gives it none. After a quick change from one speaker to
  another the music once played with nothing heard anywhere, the log
  showing the sound going nowhere while the new speaker's stream started
  and stopped three times in 20 ms, which looks like Android leaving it
  on the speaker gone.
- **Copy debug log in a cyan ring, Clear debug log in red**, side by
  side at the same width, on the phone and in the web view.
- **Which Bluetooth device is connected, at a glance.** In the web
  view's Bluetooth list a connected device has a cyan bar on its left
  and a badge beside its name, Connected, or Playing for the one the
  music goes to, which is lit a little too. Under Sound profiles a
  speaker's heading says playing here or connected, kept up while the
  page shows, where it was set once as the page was drawn before.
- **The training's popup wider, and its buttons by their weight.** In
  the web view the training and Edit by hand popups are up to 900 px
  wide, with shorter words under the switch delay, Damp and Quieter, so
  the training fits without scrolling on a screen about 730 px wide. The
  buttons follow one order on the phone and in the web view: the one
  main step filled in cyan at the right, such as Keep, next, Start or
  Save, keep the others; those that also do something ringed in cyan, as
  Switch to step, Keep, done, Save, only these and Train again; Back and
  Leave as is grey; and Cancel as quiet text at the far left. Red is
  kept for what deletes.
- **Damp the louder steps moves Quieter.** With Damp on, Quieter goes up
  by as much as the steps rise from page to page, from the third on, and
  the slider shows it, so the training stays about as loud. Too quiet or
  too loud: move Quieter, the next page goes on from there, and Back
  turns it down again. Quieter reaches 60 dB, and the words under it are
  grey, only its name and slider red.
- **The end of the training asks one question.** Where steps were set
  before, a choice above the list: keep the earlier values for the steps
  not trained this time, or fill them in from the trained ones. The list
  shows what Save keeps, step by step, in columns, each marked trained,
  earlier or filled in, and follows the choice. One Save button in place
  of two, beside Train again, with Cancel at the left, on one row.
- **Filled in from the trained steps by default.** At the end of the
  training the choice starts on filling the steps not trained this time
  in from the trained ones; keeping the earlier values is the other.
- **Each speaker's settings in a dialog.** Under Sound profiles,
  Speakers lists each speaker with whether it plays or is connected and
  its profiles, and Edit opens all its settings in a dialog: the profile
  and night profile, night mode as it connects, max volume as it
  connects, the volume steps with their buttons, and Volume now. The
  folding under each speaker is gone, and so are the profile drop-downs
  in the list. The explanations sit in the dialog beside what they
  explain. The web view draws the same dialog as a popup, closed with
  its round cross, a tap beside it or Escape.
- **Levels under step 1.** A speaker, and the default for the rest, can
  have its own number of levels between Off and step 1, from 1 to 40,
  each with how far apart they are, such as 10 (0.5% apart). Auto keeps
  one at each whole percent. More of them suit a speaker whose lowest
  step is loud already. The volume buttons, the web view's arrow keys
  and its - and + go through them one at a time, the levels show with
  one decimal, such as 2.7%, and a slider lands on the nearest. Set how
  far down the lowest is, the levels go down to it evenly in dB.
- **Words that fit any Android device.** The texts no longer say phone,
  as the player may run on a tablet or a TV too, and never say device
  where a speaker could be meant: the device running the app is the
  Android device, its volume steps Android's volume steps, and the sound
  settings for its own speaker, headphones and speakers not set up are
  Default, with Same as default in a speaker's drop-downs. Default says
  what it covers in the list, and a speaker with both profiles as the
  default's says Profiles as default.
- **A small banner for the volume instead of the popup.** When the
  Android device's volume changes from its buttons or a Bluetooth
  speaker, the web view no longer opens the whole volume popup. A small
  banner at the top shows where the sound plays, the level with a thin
  bar and, when turned on, the real volume, step and mixer. It goes
  after 2.5 s, stays while the pointer is on it, and a tap on it or on
  Adjust opens the volume popup. With the popup already open, the popup
  follows the change as before. In the app's own web view the banner
  also shows a Bluetooth speaker's change when the player has more
  volume steps.
- **The state goes to the app only when it changed.** The player handed
  its whole state to the app every second, and every web view got it and
  drew it again, even with nothing playing. Now it goes at once when
  anything in it changes, or the song does not move on as a playing song
  would (a seek, a stall), and otherwise every five seconds, which also
  keeps the app's Bluetooth check going. The web views already move the
  position on by themselves. Idle and during steady playback that is a
  fifth of the states. The app reads each state once instead of twice.
- **Shared code kept once.** 44 functions the player and the web view's
  page both had, word for word, now live once in src/shared: the
  waveform drawing, the trimmer's working parts, the colour helpers and
  picker, and a few small helpers. make embed writes them into both
  files between BEGIN SHARED and END SHARED lines, before the page goes
  into the player, and the pre-commit hook and make check compare them
  too. No function changed, they only moved.
- **More shared, colours in one place, small Java helpers.**
  - Three more functions the two files had alike, apart from their
    comments, are shared too, 47 in all.
  - The player's colours are constants, first thing in both files:
    ACCENT, ACCENT_RGB and DANGER, from src/shared/palette.js. They take
    the place of 142 written-out cyans, 33 rgba cyans and 13 reds. The
    volume card's bar was a slightly different cyan and now has the same
    one.
  - The volume training's choice, its list of steps and its lines are
    drawn by the same code on the device and in the web view, from
    src/shared/volpop.js. The device gives it inline styles, the web view
    its classes.
  - In the app, whether an address is Mureka's is decided in one place,
    Mureka.java, instead of four, and streams are copied and read by
    Io.java instead of seven loops of their own.
  - Every screen checked looks the same pixel for pixel, apart from the
    volume card's bar.
- **A cropped and zoomed cover stays cropped.** The cover editor's square
  was sent to Mureka as an instruction for its storage to cut the
  uploaded picture, but Mureka keeps a cover's file as it is uploaded,
  so the whole picture showed. Now the square is cut out on the device,
  made 1408 by 1408 pixels as a JPEG, and that is uploaded, for a song's
  cover and a playlist's, from the device and from the web view alike.
- **The web view's server reads requests in blocks.** It read each
  request's head one byte per system call, a few hundred for every
  request, the state asked for each second among them. The head and the
  body now come through one buffer. Each header's name is read once and
  picked in one switch instead of up to nine comparisons per line.
- **The song list is saved once for a burst of changes.** Each change,
  such as a song marked played, made the whole list into text at once,
  and a large list again a second later to pack it. Now a change only
  marks the list, and it is written a second after the first change of a
  burst, made into text once. Changes coming all the time are still
  written every second. Hiding or closing the page, reading a list back
  and switching to another feed's list write it at once.
- **Packing a large list off the page's thread.** A list over 250 KB is
  packed in a worker, made from the same packing code, so the player
  does not stall while it packs. Where the page's rules refuse a worker
  it is packed on the page as before, and when the page is hidden or
  closed always at once on the page, as a worker may not finish then.
- **Another tab's save is no longer written over.** Taking over a list
  another tab saved first wrote this tab's waiting list over it. Now
  the other tab's list is read as it arrived.
- **The web view lays its page out only when something changed.** Its
  frame loop wrote the progress bar and the two times on every frame,
  the same values too, which made the browser lay the whole page out
  sixty times a second even while paused. Now it writes only what
  changed: idle, no layout at all instead of 600 in ten seconds, and
  half the script time. The scrollbar gutters, the buttons that find the
  playing song and the walking lines are checked when the boxes change
  size, their rows change or they scroll, and every three seconds for
  what no event tells, instead of every half second to second. Browsers
  without those watchers check as before.
- **An unchanged settings page is not sent again.** The web view reads
  an open panel every two seconds. It now sends a fingerprint of the
  copy it shows, and an unchanged panel is answered with that alone,
  so it is not sent, read and compared each time. The phone still looks
  at the page each time, so nothing can go stale.
- **One row drawn again for a mark.** A song marked played, stored for
  offline or saved to the downloads has only its own row drawn again,
  the same as a whole drawing would make it. Where the mark could move
  the song, show it or hide it, in the queue, the sets, under a set's
  head, or with a row not built yet, the whole list is drawn as before.
- **A smaller player in the app.** The app's copy of the player leaves
  out the lines that are only comments and every line's indentation,
  2.3 MB down to 1.3 MB, which changes nothing the script does. Each
  line stays a line, so a line number in an error still points at the
  same line of src/player.js. The build stops if the player ever holds
  a template string, where taking indentation off would change text.
  The add-on and the bookmarklet keep loading the readable player: the
  bookmarklet's pinned file is cached after its first load, and the
  add-on stores want readable code.
- **A smaller APK.** The release build is made smaller by R8, most of
  all by leaving out the parts of Bouncy Castle the app never uses. The
  app's own classes and the adb library are kept whole, see
  proguard-rules.pro. Not yet built or tried: pairing with wireless
  debugging, starting the hotspot helper, the hotspot and Bluetooth
  through it, and the web view's settings are the ones to try first.
- **The volume levels counted in one place.** The levels under step 1
  were worked out in the app and again in the web view, which could
  come to disagree. Now the web view's - and +, and its arrow keys, ask
  the app for one level up or down, and the app counts as its own
  buttons do. Each state says which levels lie next to the one it is
  at, so the next one shows at once.
- **Every dialog closes the same way.** The questions over the player
  (a name to type, yes or no, a choice), the volume training, editing
  the steps by hand and a speaker's settings are made by one makeDialog,
  which owns the backdrop, the card and closing. Escape now closes the
  dialog on top as its Cancel or cross would, and whoever waits for the
  answer hears it: before, Escape took a question away without a word,
  left a choice, a yes or no and the volume popups open, and with the
  settings open on a page went back a page under the dialog instead. A
  tap beside a dialog closes it as before, except the training and
  editing by hand, where a stray tap should not lose work. They look the
  same as before, pixel for pixel.
- **The crosses in editing by hand show as crosses.** Two were written
  as a raw character and came out as other letters where the player is
  loaded without its character set.
- **Drum and bass at its own tempo, not half.** In drum and bass the kick
  and the snare take turns, so folded at half the tempo the place
  halfway is the stronger one in the deep band or the middle one, though
  not in all the sound. That now doubles the tempo past 160 BPM too,
  with the starts halfway at least 70% as strong. A song at 175 BPM came
  out at 87: its deep band was 83% as strong halfway where 85% was
  asked, its middle band, the snare, 111%. Now 174, as it measures over
  the whole song. Hip hop at 87, a song at 100 with chords on every
  eighth and funk at 95 with the bass on the off beats stay as they
  were, every band weaker halfway. Tempos are worked out again as songs
  come up, and the debug log and Stats for nerds say when a tempo was
  doubled this way.
- **A new song asked to play shows whatever the filters say.** Made with
  Play when ready or Play next, it is in the lists while it is generated,
  once it is ready and while it waits and plays, even where the filters
  (vocals, published, tags, BPM, model, date, stars) or the list of
  published songs would leave it out, on the device and in the web view.
  Once it has played the filters count again. A search still leaves it
  out, and a playlist's list holds the playlist's songs only.
- **The web view's queue shows the songs being generated that play once
  ready.** Made with Play when ready, they played when done but the queue
  showed nothing of them until then. They now stand right after the
  playing song, greyed with a turning ring, "Plays when ready" or "Plays
  next when ready", in the small list and the whole one; a tap offers the
  same choices as in the song list. The song list sorted A to Z, by stars
  or by plays shows songs being generated too, at the top, as the Mureka
  order did.
- **Listening together (app only).** Players on their own devices
  elsewhere play one queue together, within about a second of each other,
  with the same filters, and any of them may control it, for everyone.
  Built for players on a VPN:
  - A small relay runs on the VPN server: `server/murekasync`, Go with no
    dependencies, Multipath TCP off, an OpenRC script, an install script
    and a README, built with `make server` (static, SERVER_ARCH for another
    machine). It listens on the VPN interface's addresses (`-interface
    wg0`, waiting for it to come up) or on one address (`-listen`). Every
    player only connects out to it, nothing connects to a player and its
    web view stays closed to everyone else.
  - One mode: the players join one room, named the same on all of them
    ("together" unless changed). The first to come holds the queue and
    shares it, without anyone choosing: the song (Mureka's address of the
    file, the title, the cover), playing or not, the place, up to 30 songs
    coming up and the filters. Never the library.
  - Everyone controls: pause, play, skip forward or back, a tap on a song,
    a move in the song, Play next and Play last, and the filters (vocals,
    published, and the smart filters: genres, moods, models, tempo, dates
    and rating), go to the player holding the queue, which does them, so
    they reach everyone. A change shows here at once and stands for 5 s
    while it is taken up. The queue follows the filters without asking,
    picking from the library of the player holding it; songs from another
    player's library come along as plain song links.
  - The player holding the queue leaving, or going quiet for 20 s, one of
    the others takes over with the queue it plays, after a short wait of
    its own so they do not all try at once, and the music goes on for the
    rest. The relay lets another player take over a room quiet for 20 s.
  - A Together button turns it on or off in a tap, in the header and among
    the control buttons, in the app and in the web view (Settings > Mobile
    player or Web view > Control buttons), there also before a relay is
    set: a tap then says so, with a way to the settings. Filled while on.
    Stop stops the music for everyone and keeps the player in the room,
    from any player in it: Play then starts it again, from where it
    stopped, for everyone.
    Songs put in the queue by hand, next, after the queued ones or last,
    are marked with their number in the queue on every player in the room,
    not only on the one holding it, and Play after queued keeps its place
    after them there too. Taken out of the queue on any player, a song
    leaves the shared queue.
    Pause or Stop pressed in the player, in the app or the web view, asks
    first: for everyone in the room, named in the question, or leave the
    room, then pause or stop for this player alone. A box remembers the
    choice, one for Pause and one for Stop, and Settings > Listening
    together has both, Ask among them, to change it again. Media keys, a
    car's among them, ask nothing and act for everyone.
    Leaving, the music goes on as this player's own; a player that only
    played along gets its own queue and filters back.
  - Together's menu: a swipe up on the Together control button, which
    has a small arrow for it as Songs and List do, a right click on it
    with a mouse, or a long press on the one in the header (holding a
    control button still moves it). In the app and in the web view it
    shows the room's name in its header and in the accent color, the
    users in the room, Active rooms on the relay to join with a tap,
    Create a new room, Rename this room, Leave the room in red and
    Settings.
  - Rooms take any name, Thai say, up to 40 letters: the relay gets an id
    worked out from the name, the same on every player, and lists the
    name. The room in the settings is joined a moment after the typing
    stops, not a room for every letter typed. Rename this room, in the
    Together menu, moves everyone in the room to the new name together,
    the queue playing on; anyone in the room may rename it.
  - A player joining takes the room's queue, place and filters, and sends
    filters only when someone changes them, never by joining.
  - Settings > Listening together, in the app and in the web view: Listen
    together, how it stands, the room, Active rooms with a Join button
    each, the name shown, the relay's address, Timing and In the room. On
    after a restart, the player joins again.
  - Timing: each player measures its round trip to the relay (8 tries with
    Test timing, again every minute or so) and the relay's clock, and goes
    by the place heard, the delay of its sound (a Bluetooth speaker's)
    taken off. Off by more than 0.6 s, a seek puts it right, and where
    the seeks land teaches each device how far ahead to aim them. The
    players tell the one holding the queue their timing and how far off
    they are, shown to all under In the room.
  - The app talks to the relay itself, over plain HTTP inside the VPN, with
    a socket of its own: Android's own HTTP stays limited to https and this
    device.
  - The room's key stays on the device, a settings backup leaves it and
    whether it is on out.
- **The add button on a song's row: the song menu's queue choices.** In
  the web view's song lists, the small list over the main page among
  them, the button on the right asks Play next, Play after queued (with
  how many) and Play last, as the song menu does, and Remove from queue
  for a song in it, with a box to remember the choice: a tap then does it
  at once, its icon showing which. Put in already, a tap takes the song
  out again. A long press, or a right click with a mouse, always asks, to
  pick another way, take it out or let the remembered choice go. Kept on
  the phone.
- **A song's menu opens at once in the web view.** The menu waited for
  the phone to weigh every song of the library against the songs of the
  song's set, a second or more on a phone, for songs in a set. The
  similar songs are now found only for Suggest similar songs and a new
  set.
- **A room's name, also when joined from the list of an older relay.**
  A room joined from Active rooms of a relay that does not pass the names
  on was called by its id, such as r-41ca56dfcc895097. A player now takes
  the room's name from the one holding it, and the one holding it from
  one playing along when it has only the id.
- **Songs being made into a set show in it in the queue too.** Waiting
  to play once ready, a new song asked to go into a set had no set mark
  in the queue, and the queue was not read again when it joined the set.
- **Lyrics over the cover with the list beside it, as big as there is
  room for.** In the web view, with the small list beside the song and the
  text over the cover, the lyrics were half the size they have beside the
  cover, also on a large screen where the panel is almost as wide. They now
  go by the panel's width, as big as beside the cover at most and no
  taller than the room under the stars. The panel behind the text blurs
  the cover a little less.
- **Sets without songs.** A set none of whose songs is in the library any
  more, its songs deleted on Mureka or taken out, had no menu in the web
  view's Sets view: the menu was read from the set's first song. It now
  has one, with Rename the set and Remove the set. Settings > Song sets
  counts them and has Remove sets without songs beside Dissolve sets with
  only one song, which no longer takes the empty ones too. Sets with
  songs still being made stay.
- **A control group swipes away sideways only.** An open group of control
  buttons closed with a swipe in any direction, so Together in a group
  could not be swiped up for its menu: the group went instead. It now
  closes only with a swipe left or right, in the app and in the web view.
  In the web view, Together, Songs and List in a group swipe up (and Songs
  and List down) as they do on the bar, with the same small arrow, and a
  right click on Together opens its menu there too.
- **Lyrics ahead.** Each line's roll started as it was sung, so it stood
  in the middle a moment after it was heard. It now starts half a second
  early. Settings > Mobile player > Lyrics ahead, ms sets how early, 0 to
  1500, here and in the web view.
- **Lines Mureka timed far off share the time.** Now and then Mureka times
  a line wrong: it starts right after the line before, which is then
  skipped, or just before the next one, and is skipped itself. A line
  that lasts less than a third of what its words take, and under 1.5 s,
  now shares the time with the neighbour that has more to spare, the two
  split by their words, so both show while they are sung, near enough.
- **A song's end is no interruption.** On Android the pause a song ends
  with comes a moment before the song says it ended, and it was taken as
  an interruption: the song went silent for a fade in. Listening
  together, the player playing along then played the ended song again at
  its very end, with the fade, until the next song came from the one
  holding the room. The sound engine could crackle after that and the
  waveform fall out of step, until a pause and play. A pause in the last
  moment of a song is now its end, and a song ended while listening
  along waits for the next one.
- **The waveform in step after a song change on an iPhone.** When the
  sound engine was not running yet as the next song began, the play head
  was set from Safari's clock for the song, which stands still for a few
  tenths of a second as a song starts, and stayed that far behind the
  sound for the whole song, until a pause and play. It now counts from
  where the song began by the engine's own clock.
- **The play head glides between the clock's steps.** Safari's clock for a
  song moved at times only about six times a second, and the waveform
  moved in jerks. Between two steps the play head now moves on with the
  page's own clock, half a second at most, each step putting it back on
  the clock.
- **No crackle on an iPhone after a song starts on its own.** With the
  song going through the sound engine, the sound at times crackled after
  the next song started by itself, until a pause and play, never after a
  song chosen by hand, which stops the playing song first. The engine is
  now stopped and started again in the moment between two songs, as a
  pause does, with no tap needed, and the log says so with the engine's
  sample rate.
- **The dots of a break pulse.** The next dot to light fades in and out,
  on one beat and off the next at the song's tempo, half a second each
  without one: the first from the break's start, so it is seen waiting,
  then the second, then the third. A pulse is full on the song's beats,
  every second beat counted from the line after the break, which starts
  on one, so every dot is full on a beat. A dot lighting pulses on up to
  full on its next beat, ends exactly there and stays on. The next one
  starts its pulse at once, in step with the beat, with no gap waiting for
  one.
- **The lines before a break roll away.** In a break of 10 s or more, the
  lines sung before it stayed above the dots until the next line came. 3 s
  into the break they now roll on up the drum and out of sight, leaving
  the dots alone, and they stay away as the next lines come. A break too
  short for that keeps them.
- **A gentler page turn of the waveform.** Zoomed in with the play head
  running across page by page, the waveform turned to the next page in a
  third of a second, setting off at full speed. It now takes a little over
  a second, setting off and arriving slowly, faster in between.
  It turns as far as the play head gets meanwhile, so the play head ends
  close to the left edge, 3 % in, rather than further in than the 8 % it
  was set to land at.
- **A song's note on its badge.** A song with a note has a small blue N on
  the lower corner of its Public or Draft badge, in the mobile player's
  list and in the web view's lists and playing song, and the note shows
  under the mouse. A row without a badge has the N on its heart instead.
- **Who comes and goes in a room.** Every player in the room gets a note
  when someone joins it or leaves it. A player leaving says so to the one
  holding the room, so it is told at once; one that just goes away is
  told once it has not been heard from for a while.
- **How many are in the room.** Together has a small count on its corner
  while in a room, and under the mouse the names of everyone in it, on the
  mobile player's Together buttons and in the web view.
- **More in Stats for nerds.** The playing song's set, rating, plays and
  note. The lyrics: lines, breaks, lines Mureka timed far off that were
  shared, the beat the dots pulse to, how far ahead the lines come, the
  drum size and where the drum is. Listening together: the room and its
  id, holding it or playing along, the relay, the round trip and clock
  against it, how late the sound comes out, how far off from the room and
  how far ahead seeks aim, when the room was last heard, and everyone in
  it with how each stands. And how long the player has run, the screen,
  memory in use and the page's elements.
- **Backup and restore says all a song tweaks file holds.** Its note named
  only ratings, tempos, instrumental marks, ignored songs and saved
  creators, while the file holds the song sets, notes and playlist orders
  too, and an import offers each of them.
- **Import conflicts say whose value is whose.** In the web view a value
  that differs was offered as Keep mine or Use the file's, and mine read
  as the device the file came from. It is now Keep the Android device's,
  and on the player itself Keep the one here. A note or a set that
  differs is named as such, where the player said undefined.
- **Notes on the copied song tweaks.** Song tweaks copied to the
  clipboard go as a short line, which carried ratings, tempos,
  instrumental marks, ignored songs and sets but no notes, so a note
  copied from one player never reached the other. The line now carries
  the notes too, Notes among the kinds to copy, on by default. An older
  player reading the line leaves the notes out.
- **Foldable list headers in the web view.** The whole song list and the
  small list beside the song each have a button by Close that folds the
  header away, for more rows on a short screen such as a car's: the whole
  list keeps only its search line, the small list its top line with the
  count, the whole list, the fold and Close. The same button brings the
  header back, and each list remembers it in the browser.
- **The Android device's sound choice tapped again opens its Bluetooth
  devices.** In the web view, with the music already on the Android
  device or its Bluetooth, a tap on that choice opens the device's
  Bluetooth devices to connect another, as a hold or a right click does.
  With the music playing in the browser, a tap still moves it to the
  Android device.
- **A cover can be pasted.** Set cover asks Choose a picture or Paste a
  picture, the latter where the browser lets the player read the
  clipboard, as on an iPhone, and a picture pasted while asked, with
  Ctrl+V or the browser's Paste, is taken too. Then the square is chosen
  in the editor as before. In the mobile player and in the web view, where
  over the Android device's own address the browser only takes Ctrl+V.
- **Paste a picture works on touch screens too.** Paste a picture is always there when a cover is chosen, in the player and the web view. Where the browser lets the page read the clipboard the picture is taken straight away; where it doesn't, such as on a phone or in the web view over the Android device's address, a box opens to paste into: press and hold in it and choose Paste. Ctrl+V is only mentioned where there is a keyboard.
- **Active rooms show each room's name, and under it who plays what.** In the player, its settings and the web view, a room is listed by its name, with a smaller line under it: who holds it, the song, playing or paused, and how many players are in it. A room only known by its id is shown as Room without a name rather than its id. The relay keeps the name a player gave the room when another player only knows it by its id, and tells it to the players in it, so that player takes the name too, as it does from the list of rooms. Needs the relay updated.
- **Left-out songs of sets fold with the others.** In the song lists, and the web view's, a left-out song of a set on a row of its own folds with the left-out songs around it: every set song with Fold sets off, and a set of one song. A folded set keeps its own row, and the songs of an opened set stay shown.
- **A play stuck waiting loads the song again.** After Safari refused a play, the next press of Play could leave the song waiting with its clock standing still, neither playing nor failing. After 1.5 s the song is loaded again where it stood and plays, as a tap on the waveform did by hand.
- **Waveform page turns smooth again.** Since the page turn began landing ahead of the play head, the play head was for a moment left of the view's edge as the turn began, which the waveform took for the song being out of view and turned back for, again and again: it jerked, sped and turned back. The page now waits for the play head to come into view. The play head's pace is measured over a quarter of a second, as Safari's clock steps whole milliseconds, and the turn counts on at most 15 % of a view ahead. The play head lands about 3 % in from the left edge, in the same slow ease in and out.
- **Turning pages, the progress ends at the play head.** With the play head running across page by page, the song's progress on the zoomed waveform, as a bar or coloring the waveform, went as far across the view as the song had come, not to the play head, so the played part was colored by the wrong place. It now ends at the play head, as when it drifts along, in the player and the web view.
- **The whole song's progress while turning pages.** Zoomed in with the play head running across page by page, the thin line at the waveform's foot shows how far into the whole song it is again, as with the play head in the middle, and a press on the lowest third moves through the whole song. Drifting along it stays left out, the play head is as far across as the song. In the player and the web view.
- **Waveform colors for each place of the play head.** In the middle, drifting along and turning pages each keep their own waveform colors and progress look, taken back when the play head is put there again, in the player, the web view's settings on the phone and a browser's own look. The first time, in the middle has the colors it always had, and moving along has the played part in the accent color, the rest grey and the progress off. Reset the waveform colors puts back those of the place chosen.
- **Turning pages, the waveform is the whole song's progress bar.** With the play head running across page by page, the waveform is played and colored up to as far across as the whole song has come, as the thin line at its foot, and grey after, wherever the play head is on the page; the play head goes on its own. Drifting along the two are the same place, and that stays as it was.
- **Shared styles in one style sheet.** The 23 styles the player wrote out most often on its parts, rows, columns, hints, the information rows and boxes, are classes of one style sheet the player adds at start, 162 places in all. Each class is named twice in its rule, so Mureka's own rules for an element or a class do not reach them, as they did not reach the inline styles. A place whose style is read or replaced later keeps it inline. The settings pages draw pixel for pixel as before. The last of the two slightly different cyans, a web view default, is the accent too.
- **Plays kept offline are neither lost nor sent twice.** A play kept for later while the kept ones were being sent was saved over and lost: the list is now read again before each one and the one sent taken off by its song and time. Two tabs with the player no longer send the same kept plays both, one sends them at a time.
- **The version scripts run with any sed.** update-manifest-version.sh and release-bookmarklet.sh write a new file and move it over the old one, rather than sed -i, which takes different arguments in GNU sed, BusyBox and macOS.
- **Find matching sets when creating.** Under Put them in a set, Find matching sets lays every set against what the form has so far: the title against the songs' titles and the set's own name, the lyrics against the songs' lyrics, read first from the stored details where not read yet and for up to 40 songs from Mureka, and the style against the songs' genres and moods. The sets alike come in a list, likeliest first, each with why, under a new set with a name made from the title, the lyrics' first sung line or the style, one no set has yet. Choosing one turns Put them in a set on with it. In the player and the web view.
- **Create at the bottom of the create page too,** within reach after the last setting, in the player and the web view.
- **Page turns earlier and slower.** Turning pages, the waveform turns when the play head is 82 % across instead of 92 %, and the turn takes 2 s instead of 1.1 s, eased in and out, so it moves at about half the speed. The play head still lands a little in from the left edge. In the player and the web view.
- **Page turns to tweak, and the play head's width.** Turning pages, settings say where the page turns, in percent across, where the play head lands, in percent in from the left, and how long the turn takes, eased in and out. By default it turns 18 % from the right edge and the play head lands 18 % in from the left, over 2 s. Played colors turning pages chooses between coloring up to the whole song's progress, as a progress bar, and up to the play head, with the thin line at the foot alone showing the whole song's progress; with the colors kept for each place of the play head, turning pages can have its own color left of the play head. Play head width sets its line from 1 to 8 pixels. In the mobile player and the web view's settings.
- **Find matching sets suggests the best choice.** The list opens with the best choice first, ringed in the accent and marked Best match: the likeliest set when it is clearly alike, else the new set with its suggested name. In the player and the web view.
- **Page turns and the play head's width for each browser too.** A web view with Settings for this browser on can have its own page turn point, landing point, turn time, played colors turning pages and play head width, each marked with the dot, as the other waveform settings.
- **A new song starts its page at once.** Turning pages, a jump of more than a page, a new song starting or a seek far off, goes there at once instead of sliding back across the whole song. A seek within a page still glides.
- **The web view logs how its waveform is drawn.** Each time the look changes, the web view's debug log says which progress look, play head place and colors it draws with, and whether the browser has a look of its own.
- **The web view's settings work again with Settings for this browser.** Since the shared styles became classes in 2.0.1.195, the web view's copy of the settings no longer saw which rows were laid out side by side, which text was small or grey, or the page's name beside Back, as it read only styles written on each element. The page's rows lost their place, and with Settings for this browser on no row was this browser's own any more: a change went to the Android device, while the browser's own look stayed over it, so colors, the progress look, the play head's place and the rest seemed to do nothing. The settings are now read with the shared classes too, and come out as before.
- **A see-through progress color lets the waveform's own colors through.** Coloring the waveform with the song's progress, a progress color partly or wholly see-through is laid over the waveform's played and rest colors instead of leaving it dark: at 0 % the waveform shows in its own colors, at 50 % half each. In the player and the web view.
- **Songs with comments are marked.** A song with comments on Mureka gets a small orange speech bubble with their count on the lower left corner of its badge, or of its heart without a badge, and on the playing song's badge, in the player and the web view. The count comes from the song's details, read when it is played, prepared, opened or by the plays job, and is kept with them. The debug log also keeps Mureka's answers when its own page reads comments, to learn how to show and answer them in the player.
- **Comments on a song.** Comments in the song menu, with the count when known, opens the song's comments on Mureka in the player and the web view: each with who wrote it and when, its replies set in under it, a heart to like it with the count, and Reply. More comments reads the next page. At the foot a field writes a comment, or a reply to the comment chosen, sent with Send or Ctrl+Enter, and shown at once. Uses Mureka's own /api/comment/list, /api/comment/add and /api/comment/like, as its page sends them. The debug log keeps Mureka's whole answers for comments and notifications, to learn the rest: further pages, replies past those sent, deleting and the notifications.
- **Notifications keep the comment counts fresh.** The player reads Mureka's notifications 20 s after start, every ten minutes while in view and on coming back into view after a while, and reads again the songs that the new ones name, a comment, a reply or a like, so their comment marks and plays are up to date without reading every song. It reads them as Mureka's page does, without marking them read, and keeps which it has seen.
- **Notifications and comments as Mureka really sends them.** A notification's song is found where Mureka puts it, object_id for a like, a playlist add or a share and extra_object_id for a comment, and its time is update_time, so the songs of new notifications are now read again; before, none were found. More comments asks after the last_id Mureka answers with.
- **A cleaner debug log.** The site's ad tags, analytics and session recorders are left out of the log, and it keeps 600 lines, 300 of them over a reload, so a capture on Mureka's own pages fits.
- **Delete your own comments.** Your own comments and replies have Delete, asked once more first, a comment going with its replies, and the song read again for its count. Uses Mureka's /api/comment/delete with comment_id and comment_level. In the player and the web view.
- **The debug log keeps Mureka's mention answers.** The people Mureka offers to @-mention in a comment are kept whole in the log, to learn how mentions are sent.
- **Comments tagged with a place in the song.** While the song is the one playing, the comments have Tag my comment at, with where the song is now, sent to Mureka as its moment in whole seconds, to be checked against how Mureka's own page shows it. A tagged comment shows its place, and a tap plays the song from there, the song started first when another is playing. In the player and the web view.
- **A comment's place in the song in milliseconds.** Sent in seconds, the tag did not show on Mureka's page, so the place goes as milliseconds, as other times at Mureka do, and is read back the same way.
- **Share the debug log as a file.** Under Developer, Share the debug log as a file opens the share sheet with the log as a text file, to save to Files or send, where Safari on the iPhone will not paste a long log copied; a download where there is no share sheet. Copy debug log says how big the log is, and the notifications' whole answer is kept the first time only, as the player reads them every ten minutes.
- **Comments are sent without a place in the song.** Mureka's page showed no place for a comment sent with one, in seconds or milliseconds alike, so Tag my comment at is gone and every comment and reply goes as moment -1. A comment Mureka holds with a place still shows it, with its play button. In the player and the web view.
- **The header's fold button on the left.** In the web view the button that folds a list's header away is now first in its row, in the big list's search line and in the small list's top line, so it is in sight without scrolling the row sideways in the car. On a phone the song count in the search field no longer runs under it. The mobile player has no such button.
- **No gap over the web view's list on a phone.** The list starts right under the line below the view chips, and the empty loading line above the list no longer takes room anywhere.
- **Mureka's notifications in the player.** A bell with the count of unread notifications shows in the header while there are some, and Notifications is in the actions menu. The list shows who, what and when, newest first: likes, comments with their text, playlist adds, shared songs looked at and follows, with More notifications for older ones. Tapping one marks it read and plays its song, or opens the song's comments for a comment. Mark all read marks every one read and clears Mureka's own unread mark too, and once none shown is left unread Mureka's mark is cleared as well. Which ones were opened is kept on the device. The list is read again as it opens. In the player and the web view.
- **The notifications bell is always there.** With nothing unread it is a plain grey bell that still opens the list for the older ones, and it turns orange with the count while some are unread. In the player and the web view.
- **Notifications easier to tell apart.** Each has a disc in its kind's colour (pink like, orange comment, violet playlist add, blue shared song looked at, green follow), an accent edge while unread, and the song's cover on the right. The song's title is a link, and it and the cover play the song. A notification with only a number for who it was gets the name from the user's Mureka profile. Older ones load on their own when the list is scrolled near its end, with a turning ring at the bottom, and a ring shows while the list is first read. Opening one leaves the list open behind it, so Escape or Close goes back to it, and the comments show the song's cover beside their title. Each kind is written to the debug log once as Mureka sends it. In the player and the web view.
- **Escape closes the web view's newest dialog first**, as the app's Back button does, so the notifications and the comments close on Escape.
- **The header's badges all the same height, with the same room between them** in the web view, the bell included, whichever are shown and however they are ordered.
- **One veil behind every dialog.** The page behind a dialog is dimmed and blurred the same way everywhere, as behind the Bluetooth devices: one rule in the web view, and one look for the player's dialogs.
- **The Bluetooth devices keep their order** in the web view when one connects or goes away: devices that play sound first, then by name, no longer the connected ones first.
- **Chat in Listening together.** Everyone in a room can write to the others: Chat is first in the Together menu (swipe up on Together, or its menu in the web view), with the count of unread messages from the others on the Together button's upper corner and a toast for each new one while the chat is not open. Messages show who and when, your own on the right; Enter sends, Shift+Enter starts a new line. The relay sends each message to everyone at once and keeps them for those who join later, for 24 hours by default, then they go: `MUREKASYNC_CHAT_KEEP` (`-chat-keep`) sets how long, 0 turns the chat off, and `MUREKASYNC_CHAT_MAX` (`-chat-max`, 200) how many a room keeps. The chat outlives the room, in memory only. In the player and the web view, with the app; the relay needs the update.
- **@mentions in the chat.** Typing @ opens a list of the people in the room and those who wrote, narrowed as you type; the arrows move through it and Tab or Enter picks a name. Mentions are lit in the messages, a message mentioning you gets an orange edge, and its toast says it mentioned you.
- **The chat where the song list is.** The chat opens docked in the list's place, in the small list beside the song in the web view (opened for it), in the list under the song on a phone and over the song list in the player, with Float to have it in a window of its own and Dock to bring it back, remembered. The chat's look and its mentions are one shared part of both views now, src/shared/chat.js.
- **The web view's waveform runs smoothly.** Each word from the phone is off by some tens of milliseconds, and the position shown took in each difference quickly, so the waveform hitched a little a couple of times a second, running up to a fifth fast or slow for a moment. A small difference is now made up at most 3 percent fast or slow, which does not show, with the same accuracy.
- **Times on the 24 hour clock.** The chat's times, the playlist order's date and the debug log's reload line show 15:07, not 3:07 PM, whatever the device's own setting.
- **The chat from the Together button, and a Chat button.** Swiping down on Together opens the room's chat, as swiping up opens its menu. A Chat button can be put in the bar too, left out until it is placed (Settings > Control buttons), with the count of new messages on its corner. In the player and the web view.
- **The chat's window floats.** Float opens the chat in a window over the player instead of a dialog: a little see-through with the page blurred behind it, moved by its top bar and sized from any edge or corner, with a mouse or a finger. Its collapse button tucks it into the nearest edge of the screen as a small tab with the count of new messages, which a tap opens again. Where it was, how big and whether tucked away are remembered. A shared part, src/shared/floatwin.js, for other windows later. In the player and the web view.
- **The web view's chat no longer refused as busy.** A question from a web view to the phone (the chat, the notifications, making songs) took the turn kept for large uploads, one at a time, and held it while the phone answered, so another question meanwhile was refused and read as "The Android device could not be reached". Questions no longer take that turn, and a busy answer says so.
- **The chat's history read from the relay as the chat opens**, in case the room's stream missed it, joined before the relay had the chat say. A relay without the chat says it needs an update.
- **Together shows both its swipes**: an arrow at its top for the menu and one at its foot for the chat, on the phone too. A button group's mark sits in the middle of the button, as the other arrows do.
- **A double tap on the chat window's bar tucks it away**, into the nearest edge, instead of a button of its own between Dock and Close. The room's name in the chat's title is cyan. In the player and the web view.
- **Changing your chat messages.** Edit on a message of your own puts it in the field to change, the up arrow in an empty field takes the last one, and Save sends the change to everyone; Escape leaves it as it was. A changed message says edited. Only the player that wrote a message can change it: each player has a key of its own for the chat, which the relay keeps as a hash. The relay needs the update.
- **Mentions stand out.** Being mentioned while the chat is not open turns the count on Together and Chat pink with an @, and in the app it is also a notification of the phone's, Chat mentions, so it is seen with the app in the background. The toast says who mentioned you.
- **A line where the new messages begin.** Opening the chat, a thin orange line marked New sits between the messages read before and the ones not read yet, and moves to what came while the window was tucked away.
- **Each person in the chat has a colour of their own**, the same on every player, their messages tinted with it and their name in it, kept apart from your own cyan.
- **Links in the chat open.** A link to a song on Mureka asks what to do: play it now, next, after the queued or last, see its info, or open it on Mureka, for a song in your library; others open on Mureka. In the web view the menu comes over a floating chat.
- **Escape tucks the floating chat into its edge** instead of closing it, and closes it from there. Docked, it closes.
- **Opening a set no longer takes the list to the playing song.** Going to the top of a list, or opening or folding a set, stops the list following the playing song, in the web view's lists and the player's.
- **Music starts when the room's holder does not answer.** Playing along in a room that had stopped, a song picked or Play was stopped again at once by the room's stopped state, every time, and when the one holding the room did not take it up (its phone asleep, or a player too old) nothing ever played. A pick or Play now waits a moment for the room, and when it is not taken up this player leaves the room, keeps the queue and plays on its own, saying so; Together joins again.
- **The chat survives a restart of the relay.** It is written to /var/lib/murekasync/chat.json (MUREKASYNC_CHAT_FILE, -chat-file) two seconds after each change and as the relay stops, and read back as it starts, the writers' keys with it so they can still change their messages. Empty keeps it in memory only.
- **The chat can be kept for days.** MUREKASYNC_CHAT_KEEP takes days too, 7d, besides 24h, 30m and the like, and the chat says how long in days from two days up.
- **A player taking a room over hears the others' commands again.** When two players took a room over at once, the one the relay turned away had its stream of commands end for good, but the app still counted it as open, so the next time that player held the room it never read the others' commands: "the sharing player is not reachable" for everyone else, and picks and Play went nowhere. The stream is opened again now.
- **Fewer "Not sent" toasts.** A command that does not get through is told only for something asked for a moment before, and at most every ten seconds, no longer for the player's own hello every 15 s; each one is in the debug log.
- **Songs asked to play show in the list from the press, whatever the filter.** With Published or another creator's songs shown, the two rows a new song shows as from the press of Create, until Mureka lists its songs, were left out of the lists, in the web view and the mobile player alike; the songs asked to play were shown only once Mureka listed them. Now the rows show from the press when the songs are asked to play, when ready or next, and those not asked to play stay out as before.
- **A template's Listen and Copy in its question too.** In the web view, Use the template has Listen and Copy over Cancel and Use it, as in the list, the bar of the song heard under them, the listening stopped as the question is put away. What the browser makes of a template's song when listened to, playing at what volume or why it could not, goes in the debug log, to find out why one is not heard.
- **Male, Female and Character as wide as each other** in Create's voice choice in the web view.
- **Create in the web view: buttons as wide as each other, and a swipe down closes it.** Reset and Create at the top are as wide as each other, and the rows of buttons under the lyrics, the style and the remix lay their buttons out evenly, all as wide, as many across as fit, two on a phone. A swipe down on Create closes it like the other popups, not while a list over it is open or an answer from Mureka is awaited, and not while the form is scrolled down, where a swipe scrolls it.
- **More volume steps: how many, and spread by the dB between Android's steps.** More volume steps, 100 is now More volume steps, with a Steps slider under it from as many as Android's own to 100, 100 unless set. Before, every gap between two of Android's steps had the same 6 or 7 levels on a 15 step device, whatever its dB, so a level was nearly 1 dB in a wide gap at the bottom and a third of that in a narrow one at the top. Now the steps above Android's first are shared out between the gaps by their dB, each gap at least one, so each is about the same dB louder: with gaps trained from 6.5 dB at the bottom to 2 dB at the top and 100 steps, 12 between Android's steps 1 and 2 and 4 between 14 and 15; at 50, 6 and 2; at Android's own number, one each, Android's steps alone. The dB of the steps are those trained or set by hand for the speaker, else Android's own curve. Under the first step, the steps set for the speaker as before. The volume is still shown in percent, and Android's own slider, the web view's and the volume buttons, Volume buttons move them a step at a time, go by these steps.
- **Music plays on by itself only in the tab in front.** In Safari, with the bookmarklet, a song stopped by something else, not by a press, played on as soon as the page was shown, had the focus or came back from the back and forward cache, and a tab in the background could get a focus too, so the music started in a tab not being looked at. It now plays on only while the tab is shown and has the focus, and once more half a second after it is shown, for a tab brought to the front that gets its focus a moment later. The app is as before.
- **Control buttons on one page, with the groups.** Button groups on the main settings page is now Control buttons: Names under the buttons, the bar and its spare buttons, then the button groups below. It shows the bar of the player it is open in, the mobile player's in the mobile player and the web view's in the web view, that browser's own while its Settings for this browser is on, so the bar is no longer on the Mobile player and Web view pages twice over with different words. The mobile player's bar editor says the same as the web view's, and a tap there now takes a button out of the bar or puts it in at the end, as in the web view.
- **The covers in the web view on a phone as bright as in the mobile player.** The shading at the foot of the covers reached up 88 % of their height, where the mobile player's has been a fifth since the lyrics got their own outline, so the whole cover looked tinted. It is a fifth now, and the side covers are no longer dimmed or faded at their outer edge on a phone, only blurred a little, as in the mobile player.
- **Offline, not Browser offline.** The web view's badge for a browser without the internet says just Offline, as "Browser offline" read as if the browser had lost the Android device. Pressed or hovered it still tells which: no internet in this browser, only songs stored on the Android device play.
- **The list's views fit on a phone's screen in the web view.** The views and filters under the bar over the list, Mureka, Queue, Sets, A-Z and the rest, ran on past the foot of the screen, under Safari's bar, with no way to reach the last ones. Opened, they are now scrolled into sight as far as the page goes, and no taller than the room left under the bar, the rest scrolled inside them.
- **Swipes on the lyrics turn the covers again in the web view.** Since the lyrics could be turned, they took every touch for themselves in the web view, so a swipe sideways over them, on a phone where they lie over the cover, no longer turned the covers. Now the covers' own press turns the lyrics when the finger goes up or down on them, and a swipe sideways turns the covers as before. Beside the covers, on a wide screen, the lyrics still take the press themselves.
- **A double tap on the cover's lyrics stays a double tap.** A finger moves a little in a tap; 6 pixels of that already counted as a move in the mobile player, which on the lyrics turned them rather than counting the tap, so a double tap there could miss switching the overlay. A tap may now move up to 10 pixels. The cover's taps, double taps and swipes are in the debug log, to find out more should it happen again.
- **Cancel ringed in red everywhere, and a red fill for what takes something away.** Every Cancel, in questions, dialogs, the trimmer, the cover cropper, the color picker, volume training, the password boxes and the web view's copies of the phone's settings, is ringed in red so the way out looks the same everywhere. A button that removes, deletes, forgets or clears, which was ringed in red, is now filled in red, so it is never taken for Cancel; the actions' Clear tile keeps its ring. In the mobile player and the web view, Cancel's look from one place in src/shared/ui.js.
- **Which kinds to copy or import as a list of boxes to tick in the web view on a phone.** Copy song tweaks, Copy the picked songs or the play queue, and Import song tweaks now ask as the mobile player does: All and None side by side, a box to tick for each kind with its count, then Cancel and Copy or Import, rather than a column of cyan buttons where the kinds, All, None and Copy looked alike. One piece of code in both, uiKinds in src/shared/ui.js.
- **Turn the lyrics with a finger.** Put a finger on the lyrics over the cover and move it up or down: the drum turns with it, a line's height for each line, showing only the lines, and once let go it settles on the nearest line and the song moves there, half a second (the lyrics' head start) before that line is sung. A new fade setting, Fade for a move in the lyrics, under Fades in Settings, on at 0.5 s: the song fades out, moves and fades in again over that long, each way. Let go on the line it started on, the song stays where it is. The web view does the same on its lyrics, beside or over the cover, with a finger or the mouse, and the phone moves the song with its own fade. One piece of code in both, the turning in src/shared/lyrics.js.
- **Swipe after swipe on the cover, song after song.** With a fade set for swipes, a new touch on the cover while the last swipe's song still faded put the cover back on the old song and could drop that swipe; now the touch switches to that song at once, so quick swipes go one song each. On an iPhone the new song's own short stop just after it starts no longer calls a swipe's fade off; it counts as the fade done, as the song is silent then. And a fade called off no longer leaves the cover on the next song with the old one still playing.
- **Create's button clear of Safari's bar.** Room under the Create button at the foot of Create, so Safari's bar over the bottom of the page no longer hides it once scrolled to the end, in the mobile player and the web view on a phone.
- **Record a song to remix.** Beside Upload a song in Create's remix, Record a song records with the microphone: a red button to start and stop, the time and how loud it comes in, then the recording to listen to, Record again or Use it, which uploads it to Mureka as a WAV and makes it ready to remix like a file chosen. At least 10 seconds, stopped at 8 minutes, Mureka's limits for a remix. The song playing pauses as the recording starts. The Android app asks for the microphone the first time and gives it only to Mureka's own page. The web view records too where its browser lets a page use the microphone, which is over https; over the Android device's plain address it says so and points to the mobile player. One piece of code in both, src/shared/record.js.
- **Surprise me as Mureka's, and Random.** Surprise me now sends just what Mureka's own Surprise me does, the style in the field and the song page's scene "general", so Mureka goes somewhere new from that style. Random, beside it, is Surprise me from nothing: the style is left out of what is sent, so Mureka thinks of one of its own, still fitting the lyrics when there are some. Both in the mobile player and the web view.
- **The actions in the web view on a phone as the mobile player's tiles.** The menu button opens the same card of tiles under the header, an icon over a short bold name, in the mobile player's rows: Load, Rescan and Clear, where the songs come from, Create songs and Notifications, Cache all and Night mode, the screen, and the four copy and import tiles. The playing song's menu is a tile on top. The tiles are one piece of code in both, src/shared/actions.js.
- **The buttons' names in the web view on a phone as in the mobile player.** Small and bold, in the buttons' own height, which no longer grow taller with their names on.
- **The mobile player's Create looks right again.** Its choices, With lyrics, the model, the voice and Once they are ready, and its switches use the trimmer's buttons, which since they became shared code took their look only inside the trimmer, so in Create they showed as plain links. Create now takes the same look.
- **More volume steps no longer louder after a start.** The app sends the player its share of the sound as it starts, often before the player has made its audio element. The new element then played at its whole sound, and the same share sent again a moment later changed nothing, so under the phone's first step the song played at the first step's full level, 6% say, while 3.5% was shown, until the volume was moved. The element now starts at the share.
- **The volume's decimals in the web view.** With more volume steps on, the levels under the phone's first step lie between whole percents, 3.3% say, but the web view's volume slider moved in whole steps and showed them rounded, 3%. It now keeps and shows them as they are, from the first step up a whole percent as before.
- **More volume steps keep their level when a speaker connects.** Android often puts in the step it keeps for a Bluetooth speaker a moment before the speaker shows as the output, and the app took that step for the volume buttons, so the level kept was lost and the speaker's own step stayed, also over a restart. A step that comes within 4 seconds before the new output shows now puts the level from before it back. Android's own volume slider, which has whole percents only, no longer rounds a finer level away either.
- **The playlists in the web view on a phone as the mobile player's page.** Playlists with Done, New playlist and All songs side by side, and each playlist with its cover, its name and count, Play and Edit.
- **The song's information in the web view has its cover.** The cover beside the title, bold, as in the mobile player, and the names and values in the mobile player's columns on a phone.
- **The settings in the web view on a phone as in the mobile player.** The same small words, Settings with Done at the top, the links to the pages and the switches, steppers and drop-downs 30 pixels high with small corners, and a switch or drop-down at the right of its name with the explanation running on under it. In a car the settings are as before.
- **A question with a field to type in looks the same in both.** New playlist, a new name and the like have the mobile player's card in the web view on a phone, the question bold over a plain field, from src/shared/ui.js in both. In a car and on a phone the field is one line high again, it had grown to a tall box.
- **Buttons in the mobile player's questions are finger sized on a touch screen.** They were meant to be 44 pixels high there, but each button's own height won.
- **The web view's questions word for word as the mobile player's.** The sets, Left out by the filters, Listening together, the sound profiles, the chat's song links, the new songs and a shared queue now have the mobile player's title and words, and on a phone its filled and ringed answers: the one in use ticked, choices that are each on or off ticked or grey, a set's colors as dots. The words for a song the filters leave out are one piece of code in both, src/shared/misc.js.
- **Questions in the web view on a phone as the mobile player asks them.** A question with answers to choose from, Add to playlist, New cover, Still generating, the sort of the list and the rest, now shows on a phone as the mobile player's: the title, what it is about, the answers as buttons one under the other, filled or ringed, Remember my choice as a box to tick, and Cancel, over the dimmed page. The buttons and the card are one piece of code in both, src/shared/ui.js. Add to playlist, New cover and Still generating also have the mobile player's words in a car.
- **Ticking a box in a question no longer closes it.** A checkbox in the web view's menu counted as typing, which moved the menu away under the finger.
- **The song menu in the web view on a phone is the mobile player's.** A long press on a song in the web view on a phone opens the mobile player's small menu where the finger was, the song's number and title over it, the same rows, colors and lines, and the stars at the foot, drawn from src/shared/menu.js. In a car it keeps its large look. The web view's menu now has the mobile player's order too, Select to share after Play only this and Use in Create before Trim, and Comments in amber.
- **Remove rating in the web view.** Under the stars of a song's menu and of the large rating popup the rating is in words as in the mobile player, 3.25 stars, with Remove rating to go back to not rated.
- **The paste box for a cover is one piece of code.** Paste for a new cover opens the same box in the mobile player and the web view, with the shared dialog look, and reading a pasted or copied picture is shared too, src/shared/cover.js. A click outside the box closes it in both.
- **More of the trimmer, the counts and the stars' taps shared.** The question before Trim and the busy Trim button are shared by both, and so are the short counts (1.2k) and what a tap on a star makes of the rating. Two functions the player had twice under the same name, of which only the second ever counted, are kept once.
- **The trimmer is one page in both.** The trimmer's page, its buttons, switches and the question before Trim, is built by src/shared/trimui.js in the mobile player and the web view, and the web view's on a phone looks as the mobile player's; in a car it keeps its large look. Its painting is shared too.
- **The trimmer's handling and the cover editor are one piece of code.** Dragging the ends on the whole song and in the close up, and playing a part, run from src/shared/trim.js in both, so the web view's trimmer gets the mobile player's later care: a finger may land a little further off an end and still take it, and a drag in the close up must go clearly up or down before it changes the height. The editor for a new cover is src/shared/cover.js in both.
- **The walking lines are one piece of code.** A line too long for its place, the status, the second line under the title, the web view's title and Playing from, walks the same way in both, from src/shared/marquee.js; the web view's walks a little faster for a car's large text, as before.
- **The stars drawn by one piece of code.** A rating's stars, lit in quarters, come from src/shared/stars.js in the mobile player and in the web view alike, the same outline and gold.
- **Questions look the same in both.** A question before something that cannot be undone, Delete on Mureka say, has the mobile player's card in the web view on a phone too, drawn from the same shared look, its Cancel and answer side by side; in a car it keeps its large size.
- **Stats for nerds drawn by one piece of code.** The mobile player and the web view show Stats for nerds from src/shared/stats.js, the same see-through card, title and Close, and the same lines; a car's stays wide.
- **The web view's list bar on a phone as in the mobile player.** Over the list in the web view on a phone is now the mobile player's bar: the view, the vocals and the smart filters with the counts at its right, and a tap opens the views, the sorts, the vocals, the library and the filters over the list, three across with the icon over the name. The row of chips is gone from there.
- **The web view's top on a phone as in the mobile player.** In the web view on a phone the stars and the heart sit at the top of the covers under the status, with the plays and likes at the top right; the line under the title says who is signed in and what the songs come from, as in the mobile player; the actions button has the mobile player's three lines, and the signed out note has its size and colours. Public or draft is in the song's row, as in the mobile player, and in a car beside the stars as before, its marks drawn by the same code as the rows'.
- **Notifications and comments are one dialog each.** Mureka's notifications and a song's comments are drawn by shared code, src/shared/notify.js and src/shared/comments.js, with the small parts both use in src/shared/ui.js, so the mobile player and the web view show them the same way, with the same buttons, and the old copies in each are gone. Deleting your own comment in the web view now asks first, as on the phone, rather than wanting a second tap.
- **The web view's song rows are the mobile player's.** One way of drawing a song's row, src/shared/songrow.js, is used by the mobile player's list and by the web view's lists, the small one and the big one, the queue and the Sets view: the stored dot, the number or a fold's chip, the title, the rating or the plays, the length, the badge with its T, R, N and comment marks, the repeat mark and the heart, and the handle to drag a song in the queue or a playlist. The phone decides what a row shows, its badge too, so both lists say the same. In a car the rows keep their size and the cover after the number; on a phone the web view's rows have the mobile player's sizes, and the place marks under the numbers are left out as in the mobile player. Songs still being generated are drawn the same way too.
- **Power saving on battery and on Bluetooth, each with settings of its own.** Under Charger and power, On battery and When Bluetooth disconnects are now two sections, both can be on, each with its own master switch, grace time, Pause the music, Stop all background work and the hotspot off and on, so Bluetooth disconnecting can turn the hotspot off and keep the work running while on battery stops it. Stop all background work has Only when nothing is in use: the work stops once the hotspot is off, no browser of the web view is connected and no music plays, and goes on again as soon as one of them is; the status says while it waits. A setup with Bluetooth starting it before keeps its settings, now under When Bluetooth disconnects. Browsers on the hotspot is shared by both, under the hotspot.
- **A key for scripts, and mureka-cmd to find the phone.** Browsers give the computer no volume over MPRIS, so the phone's volume and the player can be worked from a script instead, a key bound in the window manager say. Under Web view in the app's settings, Key for scripts shows and copies a key, New key makes another; sent as the header X-Mureka-Key with POST /cmd it works with or without the web view's password, and GET /ping says whether this is the player and the key is right. tools/mureka-cmd finds the Android device by itself, as its address changes: the last address that answered, then murekaplayer.local by avahi-resolve or the system's lookup, the default gateway (the device on its own hotspot), MUREKA_HOSTS, and last every address of the local /24s at once; it remembers the one that answers. mureka-cmd sysVolumeNudge 1 moves one level of more steps, a whole step with more steps off, and the new sysVolumeStep one of Android's own steps.
- **Media keys on this computer, in the Bluetooth popup.** The choice moved from the actions to a checkbox at the foot of Bluetooth on the phone, and a dot on the Bluetooth choice of where the music plays shows it is on, its tooltip saying so too.
- **Media keys here.** A choice under This browser in the web view's actions, kept in that browser: while the music plays on the Android device or over its Bluetooth, the browser shows the playing song to the computer, over MPRIS on Linux and in the media controls elsewhere, and the computer's media keys play, pause, skip and seek it on the Android device. A browser shows a media session only while it plays something, so a near silent sound plays meanwhile, a 30 Hz hum at a thousandth of the loudest; it starts at the first tap or key on the page.
- **A notification that leads to a page of Mureka's opens it.** Mureka's own notices, as a challenge won with Tap to view, carry a page of Mureka's (redirect_url, such as the reward's); tapping one now opens that page in a tab of its own, only pages on mureka.ai over https. On the phone and in the web view.
- **Shift with the arrows: a whole step of the phone.** In the web view, Shift and up or down moves the phone's volume to the next of Android's own steps, past the finer levels of more steps between them; up and down alone still go one level at a time. Listed with the other keys.
- **The app keeps more volume steps over a restart.** Soon after the app started, Android or the speaker often put back a step of its own, a higher one usually, and the app took that for the volume buttons: more steps went on from that step with the player at its whole sound, so the sound came out louder after a restart. For 15 s after the app starts or the sound goes to another output, a step that changes now is put back to the level kept, noted in the log; after that the volume buttons move it as before.
- **The web view on a phone: the badges get the whole width.** The badges shared the width under the name with the volume, music, actions and settings buttons beside them, and the last ones were cut off. The buttons now stand beside the name only, and the badges have a line of their own under them the whole width across, going on to a second line should they still not fit.
- **The trimmer: Quiet spot.** ‹ Quiet spot and Quiet spot › move the chosen end left or right to the quietest place before the sound rises again, never past it, and there to the nearest crossing of zero, looked for 5 s at most. For a glitch at the end: put the end a little before it, then Quiet spot › moves it up to just before the glitch where it is quietest. The status tells how far it moved and how loud it is there. On the phone and in the web view.
- **iPhone, in view: the waveform in step after a new song's stop.** After the stop once a new song started, the song was played on where it stood, after a pause and a move; Safari then went on unheard for about half a second while the play head ran on with the sound engine, so the waveform was that far ahead of the sound for the whole song, until a Pause and Play. The song is now loaded again at its start and played from there, as Play after a pause does, which Safari plays in step.
- **iPhone, in view: a new song's start heard once.** The sound was held silent for the stop after a new song's start only once Safari told the song plays, by when it had played its first tenths of a second and the speaker's delay held more, so the start was heard, then heard again from the stop. The sound is now held silent from the moment the song is asked for, and comes up as the song plays on after the stop; should the song not play within 8 s the silence is let go.
- **Create starts over with Play when ready.** Reset, Start over, left the new songs set to Do not play; a form started over, and a new one, now has Play when ready. Do not play chosen by hand stays as chosen.
- **Remix a song from the library.** Create has Library song beside Choose a song and Upload a song: the own songs, the one playing first and then the newest, found by words of their title. A song chosen opens in the trimmer to choose the part, as an uploaded song does, and goes to Mureka by its song id as Mureka's own page sends it (resource/use with song_id), its lyrics, cover and style kept as Mureka gives them; Choose the part opens it again. On the phone and in the web view.
- **The web view's settings: another page starts at its top.** A page of the settings not opened before was drawn where the last page had been scrolled to; a page other than the one drawn before now starts at its top, and the same page brought up to date stays where it was.
- **More volume steps: Steps up to step 1, evenly apart.** Levels under step 1 counted the levels between Off and step 1, so 10 made 11 gaps of 0.55%, shown as 0.5%, 1.1%, 1.6%. The setting is now Steps up to step 1, the presses from Off to step 1, and offers only counts that part step 1 into even tenths of a percent, for 16 steps 2, 3, 4, 5, 10, 12, 15, 20 and 30, each with how far apart they are; 10 steps are 0.6% apart, 15 are 0.4%. A count set before keeps its number, now as steps.
- **Create's note of songs being made goes once they are ready.** Mureka is making two songs named X, with the place in Mureka's line and the set, stayed on the Create page after the songs were made and played. It now goes once both songs of that generation are listed and ready, or after half an hour; on the phone and in the web view.
- **The web view: only the playing cover moves.** A cover with a moving cover that turned to a side as the next song came kept playing it there, and on, through Stop and Clear the queue, and over another song's picture once the tile came round with another song. Every cover but the playing one now has its moving cover stopped and let go. A Stop that came while a swiped cover waited for its song left the covers as they were; it now clears them.
- **Clearing the queue clears the cover.** Stop leaves the stopped song's cover, its moving cover and the covers beside it in place; Clear the queue now takes them away too, so a moving cover no longer plays on with nothing in the queue.
- **A template asks before it is used, and the list opens where it was left.** A tap on a template asks Use the template X?, saying when its style takes the place of a style written; Cancel leaves the list open. The templates read and where the list stood are kept for the visit, so opening Mureka's templates again shows the same kind, the same templates and the same place, without asking Mureka again. On the phone and in the web view.
- **A template's bar eases in and out.** The bar under a template heard opens with its height eased in and out and its content faded up, and closes the same way, in about 0.2 s, so the templates under it glide instead of jumping. On the phone and in the web view.
- **Templates heard one after another keep the song paused.** Listen on another template played the song on for a moment, and the template starting cut it off as an interruption, which coming back to the page then played on, under the template. The song now stays paused from the first template to the last, coming back to the page leaves it while one is heard, and it plays on when the last one ends or is stopped. In the web view the phone's song played on under the next template; the same fix there.
- **Mureka's templates: Copy, a bar to move in the song, and more as you scroll.** Each template has Copy under Listen, which copies its style without taking it into the form; a browser that copies only right after a tap shows the style with a Copy button instead. A template listened to shows a bar under it with the time, tapped or dragged to move in the song. The next page of templates is read as the list nears its end, More still there. On the phone and in the web view.
- **Stop when stopped clears the queue.** Stop keeps the queue, so Play goes on where it was. Pressed again once stopped, Stop asks whether to clear that queue, songs put in by hand and new songs asked to play included; cleared, Play starts from the list. On the phone and in the web view.
- **White in the list means the filters let it through.** New songs asked to play when ready were listed white whatever the filters said, until they had played, so with Published shown new drafts looked published. They are still listed until they have played, also with the left-out songs hidden, and never folded away, but greyed when the filters leave them out.
- **A new song ready as the playing song ends plays.** Asked to play at once, it waited for a 2 s fade of the playing song, which ended during it: the next song in the queue played instead and the new one was left. A fade now ends before the song does, made shorter when the song is that close to its end, and with too little left the new song plays at once.
- **A remix trimmed keeps its Remix mark.** Mureka gives a song trimmed from a remix without its Remix mark; a song trimmed here from a remix now keeps the R on its badge.
- **The phone's toasts have their height back.** 2.0.1.293 left them without room under their words.
- **Upload bars move nothing.** The toast with an upload bar has its bar from the start, and the Create page keeps the room of its upload bar while there is none, so nothing moves as it comes and goes.
- **Abort.** The button under Create's turning ring is named Abort, on the phone and in the web view.
- **A new cover shows in the web view's lists at once.** A song given a new cover kept its old one in the web view's big and small lists until they were drawn again; the rows already drawn now take the new cover as the phone tells of it.
- **A progress bar for cover uploads.** The toast Uploading the cover has a bar under its words that fills as the picture goes to Mureka, for a song's cover and a playlist's, on the phone and in the web view. From the web view, Sending the cover to the Android device has one too, for the picture on its way from the browser to the phone.
- **iPhone, in view: a new song starts once and is heard.** The stop after a new song's start moved the song back to where it started as it played on, which made the play head go back and forth and, at times, left the sound engine's clock standing: the song moved on unheard until Play and Pause. The song is now moved back while it stands, and plays on with nothing left to do; the engine's clock is looked at 0.4 s after, and if it stands, the song is stopped again, the engine stopped and started, and the song plays on from its start once more.
- **Both new songs asked to play at once: the first is not cut off.** When both songs Mureka made were ready by the time it told their ids, or the first one already played, the second one asked to play at once cut the first off a second after it started. It now plays after it.
- **A progress bar for uploads.** Uploading a song to remix shows a bar under the turning ring, with the share sent and the size: Uploading the song, 42 % of 5.3 MB. From the web view there are two: the song on its way from the browser to the Android device first, Stop letting it go, then the Android device's upload to Mureka. The upload to Mureka's storage now goes by XMLHttpRequest, which tells how much is sent, where fetch does not. In the player and the web view.
- **The toast's second part in one sentence.** They show in the list while they are made, and they play as soon as they are ready.
- **The toast after sending songs, worded as asked.** Two songs sent to Mureka named **Title** / They will be added to the set **Name**, a blank line, then They show in the list while they are made and / They play as soon as they are ready. The place in Mureka's line the same way: **Title** is number 126 in Mureka's line, the set under it, how they play after a blank line.
- **iPhone, screen locked: the start of a new song is heard once again.** Out of view, stopping the sound engine once the new song had started let Safari play the song past it, muted or not, so its start was heard two or three times. The stop after the start is now made only with the page in view, where the song itself is paused; out of view the engine rests before the new song again, as it did before.
- **The toasts after sending songs: centered, a blank line between the parts, names in bold.** The song's title and the set's name are bold, each part has a line with room around it, centered, in the player and the web view.
- **iPhone: a new song keeps its beginning, no fade in.** After its stop of a second against the crackle, a new song was faded in over the first fraction of a second, and in view it went on from where it was stopped, a moment past its start. Now it goes back to where it started and plays at full level at once, the level stepping up over a few milliseconds only so it makes no click, so a song that starts with a bang starts with it. With the screen locked the same.
- **iPhone, screen locked: a new song no longer starts and then starts again.** Stopping the sound engine a second once a new song had started, out of view, let Safari play the song past the stopped engine, heard from its start, and going back to the start after was heard as a restart. Now the song itself is muted while the engine stops, goes back to its start while still silent, and is heard only once the engine runs again, faded in.
- **The toasts after sending songs read better.** Each thing told has a line of its own, in a wider, left aligned toast: Sent to Mureka: two songs, "Title"; In the set "Name", or In the new set "Name"; They show in the list while they are made; They play as soon as they are ready. The place in Mureka's line the same: "Title" is number 126 in Mureka's line, then the set and how they play. In the player and the web view.
- **Choose the part of an uploaded song to remix, on its waveform.** Choosing or uploading a song to remix in Create now opens it in the trimmer, with the same two waveforms, the zoom down to single samples, the nudges and the previews, to choose the part Mureka remixes, 10 seconds to 8 minutes, as Mureka's own Trim for a remix does. Use this part makes Mureka take it; closing keeps nothing new. Choose the part on the remix line opens it again where it was. The remix line tells where the part starts and how long it is. In the player and the web view.
- **Remixes are marked.** A song that came out of a remix, which Mureka marks with its Remix badge (control type 11), gets a small purple R on the top left corner of its badge, or of its heart without one, and on the web view's main page. Songs are marked as they are read from Mureka again.
- **The place in Mureka's line comes back as a toast.** Since the songs went in the background, the place in Mureka's line was only in the note on the form. Now, once Mureka answers, a toast tells it: "Title": number 126 in Mureka's line, and whether they play when ready.
- **The web view's lists no longer blink every few minutes.** In the background the phone reads the details of song after song, about one a minute, and each time it came on a song with comments it counted the song list as changed, so the web view read its lists again whole and they blinked. Now the comment bubbles are painted again in place on the rows shown, the list staying as it is.
- **A heart beside the stars on the playing cover.** The player's cover had the stars only, the web view's the stars and the heart. Now the player's has the heart too, tapped to like or unlike the playing song, pink when liked and light on the cover when not.
- **New notifications show again.** Mureka's list now gives each notification as read, new ones too, and its unread count came back empty, so the bell never lit up though there were new ones. The player keeps its own mark now: the newest notification known as read, set at the first look and by Mark all read. Newer ones are new, orange on the bell and marked in the list, until opened or all are marked read. Mureka's unread count is also asked before the list, in case reading the list counts as reading them. In the player and the web view.
- **iPhone: a new song is stopped a second once it has started, against the crackle.** Twice the crackle came back right after a song change though the sound engine had rested a second before the new song, and each time Song still 1 s or Engine still, made while the song played, ended it. So now, by default, a new song that has started is stopped as long as the engine's rest is set and played on, silent until then and faded in, as Song still does. Out of view, with the screen locked say, where Safari may not let a timer play a song on, the engine stops instead while the song goes on, as Engine still does, and the song goes back to where it was. The engine no longer rests before a new song with this on, only before a move in a song. A switch for it under Developer, iPhone sound tests, Stop a new song once it has started, which takes the place of Play anew after a song change.
- **No more No connection each time the web view comes back.** Back in view after a while away, the request from before had died with the page, and as it failed the web view counted the whole time away as the phone gone, so No connection showed at once and went away by itself a moment later. Now the request from before is given up on the return and the phone asked again at once, and a phone that was fine before has 15 seconds to answer before No connection shows. A phone lost while the page is in view still shows it after 3 seconds.
- **The hotspot is switched on again when Android lets it fail.** Getting into the car, the player switched the hotspot on, Android said it was on and three seconds later that it had failed, as the car's Bluetooth came up, and it stayed off. A hotspot that fails within 30 seconds of the player switching it on is now switched on again 4 seconds later, up to three times, each try in the log.
- **Skip Android's loud volume warning.** A new switch under Sound profiles, Android volume, in the app. Android holds the volume on headphones and Bluetooth at a level it finds loud until OK is tapped on its warning, so a car could not turn it up further without someone picking up the phone. With the switch on, the hotspot helper, running as the debugging shell, tells Android the warning was confirmed, the same call the status bar makes for OK: when the switch goes on, when Bluetooth connects and every half hour while the music plays, after two minutes when a try did not work. A raise held back by the warning goes through. Android asks again after about 20 hours of loud music, and the player confirms again. Needs the helper running, from this version: start it again after updating.
- **The web view's settings on a phone line up.** A setting's control now stays level with its name at the right on a phone, its explanation running the full width under both, instead of in a narrow column beside the control that then widened. A stepper or switch with no explanation, as Turn the page at, % across, no longer drops onto a line of its own at the left when the name is long; the name wraps instead.
- **The chat's Close is now Minimize, and the chat icon lights up for new messages.** The button on the chat window's bar tucks it into its edge, as a double tap on the bar does, rather than closing it, so the chat and the count of new messages stay at hand. Leaving the room still closes it. While a message is unread, the chat icon turns orange, pink when it mentions this player, on the Chat button and on the tab of a chat tucked away, besides the count on its corner. In the player and the web view.
- **Half and Double for a song's BPM.** Where a song's tempo is set by hand, Half and Double halve or double what is in the field, for a song whose tempo is found twice or half as fast as it feels, a jazz song at 85 with a drum and bass groove at 170 say. Save keeps it as the song's tempo, ahead of Mureka's and the one worked out from the song. In the player and the web view.
- **The web view's choice popups no longer scroll sideways.** In Merge into another set and the other popups of choices, a long set name could make a choice wider than its column, and the popup then scrolled sideways. The columns now share the width and a long name wraps inside its choice. The two columns of ringed choices also stay level now; the right one sat a little lower than the left.
- **The times no longer show through the web view's settings.** With the times over the waveform, the time played, the time left and the stats button stayed on top of the settings and the other full pages opened over the player, in a dark band across them. They now stay under whatever is opened over the waveform, in the web view and in the player.
- **No more sets of the same name from Create.** With "A new set" chosen, the form went on asking for a new set after the songs were sent, so the next songs made a second set of the same name. Now the form switches to the set the songs went into, and says so under it. While the name, the set name typed or else the title, stays the same, more songs go into that set. Once the name is changed, the form takes a set of that name, else the set the form looks most like, else a new set, and goes back to the first set if the name is changed back. A set picked by hand stays as picked. A new set asked for with the name of a set already there uses that set, also for Easy. In the player and the web view.
- **Credits on the Create page.** The top of Create shows a line with the credits left, the free credits of the day and when the monthly pack ends. A tap opens the details, as Mureka's own page has them: the credits left, the monthly ones as Mureka counts them, yearly bonus included, the free daily ones, and each pack still in use with what is left and when it ends, to the minute. When the new monthly pack comes a few hours before the old one ends, both show and the line tells how soon the old one ends and how much of it goes unused. Looked up when Create opens, at most once a minute, after songs are sent and on a tap. In the player and the web view.
- **The last page turn eases out at the song's end.** Near the end of a song there is not a whole view left to turn to, and the waveform stopped short where the song ends. That turn now eases in and out to the song's end on its own, the play head going on across it. In the player and the web view.
- **The covers in the player as JPEG.** Mureka hands its covers out as WebP, and a cover copied with a long press, Copy Image, went into some apps as its link rather than as a picture. The covers in the player's cover flow are now asked of Mureka's picture server as JPEG, so Copy Image copies a JPEG.
- **Mureka's account answers in the debug log.** What Mureka answers about the account, its credits and the subscription (`/api/user/account`, `/api/pgc/order/credit/list`, `/api/payment/subscription/status`) is now kept in the debug log at length, the credits no longer blanked as if they were credentials, to learn how to show the credits left and when they expire.
- **No typed letters on the status line.** With Debug mode on, a key typed in a field, in Create say, put "Key "s": typing in a player field" on the status line, where it stayed after the field had closed. Typing in a field is now only in the debug log, the letters blanked there as before.
- **The play head comes no nearer the left edge than set, at any zoom.** Arriving at its own pace, the play head was a little further left a moment before it landed, more so the faster it went, so zoomed in it came closer to the left edge than zoomed out. A turn now aims it that little bit further right, so the nearest it comes to the left edge is the place set, whatever the zoom, as the right side already was.
- **A page turn's play head starts and lands where set, at any zoom.** The turn now follows the play head's own way across the view: it goes on at its pace as the waveform sets off, is eased over to where it lands, and arrives there at its pace again as the waveform comes to rest, with the waveform eased in and out as before. Where it lands is counted from where the song really is, never from its measured pace, so it lands at the place set whether zoomed far in or out, and the turn begins a little sooner when the play head is fast, so it no longer runs past the turn mark while the waveform gets going. In the player and the web view.
- **Create's toast in the present.** Songs sent to Mureka are told as "They show in the list while they are made and play as soon as they are ready", or "play after the playing song", no longer "played".
- **The sound engine rests a second at a song change on iPhone.** The crackle that came with a song change, until a pause and play, ended when the sound engine was stopped for a second with the song going on, where the stop of a few hundredths between two songs did not. Now the engine rests for a second as a song ends, before a song asked for and before a move in the song, while the song is stopped, and the next song or the new place comes once it runs again. Under Developer, iPhone sound tests, Rest the sound engine at a song change turns it off, and The sound engine's rest, seconds sets how long, 1 s unless changed. Engine still, under While it crackles, stops the engine for that same rest, so a shorter one can be tried on a crackle at once.
- **Taps to try while it crackles.** Under Developer, iPhone sound tests, While it crackles: Engine still 1 s stops the sound engine for a second with the song going on, Song still 1 s stops the song for a second and plays it on as it is, without loading it again, and New engine makes a new sound engine and song element with the song going on where it was. Each is one part of what a pause and play does, which ends the crackle, and each is written to the debug log.
- **A sharper crackle meter.** It now looks at two thirds of every second of the sound instead of a twentieth, through a meter of its own, and counts holes: sound dropping straight to nothing for a few samples and back, as sound missing its turn does, which a song's own quiet never does. Sharp jumps are counted only when far beyond the song's own movement, as ordinary music set the old count off too.
- **One more iPhone sound test, the kind of sound.** Mix with other apps until the first play, under Developer, iPhone sound tests, on as before: off, Safari is told the page's sound is music from the start, so the kind is never changed under a running sound engine. The debug log tells the kind and the engine's sample rate where the song goes into the engine, when the player makes it music, and when anything else on the page changes it.
- **A crackle meter in the debug log.** With the song going through the sound engine for fades on an iPhone, once a second a moment of what reaches the speaker is looked at for sudden jumps between two samples and for holes of silence within sound, and every 15 s the debug log tells how many looks were marked, to learn whether a crackle shows there.
- **iPhone sound tests in Developer.** Four switches to find what makes the sound crackle after a song change until a pause and play, each written to the debug log as it is switched: Start songs 50 ms in, Restart the sound engine between songs and A moment of silence before a load, all on as before, and Play anew after a song change, off, which pauses and plays on a new song once it has played 0.3 s, as Play / Pause does. Shown on an iPhone or iPad only.
- **Create sends in the background, as Mureka's own page does.** The form closes at the press and the two rows for the new songs show in the list at once, in their set, also while the lyrics are checked first; no more waiting on "Sending to Mureka" for the minute Mureka may hold its answer. The send and the watch for the songs go on in the background, the answer is in the debug log and in the form's note, and only songs that will not come are told, with a red toast, their rows and a new empty set gone again. Two sends of the same title at once each find their own songs. In the player and the web view.
- **Songs are sent to Mureka at once.** Create no longer reads the first page of the library from Mureka before sending, which held the send back half a second and more; the generations known already are taken from the player's own list, and a new one is told by its time and its title. The send itself is the same as Mureka's own page makes.
- **A short silence before a song is loaded again on iPhone.** A move in the song crackled too, from then on, as the next song coming on its own did, while a pause and play never did and cured it. What a pause and play has that these lacked is a moment with the song stopped before it is loaded again. So now, through the sound engine for fades, a move stops the song silently for 0.4 s, loads it at the new place and fades it back in over 0.2 s; the next song, after a song ends or after the fade for a song asked for, comes 0.4 s after the last one stopped. Several moves in a row load the song once, at the last place.
- **The fades on iPhone wait for the page to be in view again.** A song started with the page out of view, played when ready with the screen locked say, put the sound engine for fades in right then, and the sound crackled from there on until a pause and play, as two logs showed. The engine now waits for a song started or a fade asked for with the page in view, the song plays without fades until then. This comes back from 2.0.1.250, without the emptying of the song element that made every song change crackle.
- **Songs are found when Mureka's answer to making them is lost.** Safari at times drops a request Mureka holds a long time, and the player said the sending failed though Mureka was making the songs. When no answer at all comes, the player now looks for the songs in the library for up to two and a half minutes more, saying so where it waits, and once they show they are played and put in their set as asked. Only when they do not show is the sending told as failed.
- **Songs being sent to Mureka are in their set at once.** The two rows shown while Mureka works on a new song now sit in the set chosen in the form from the moment Create is pressed, no longer only once Mureka has listed the songs, which can take a minute. A new set is made right away for them, named as asked, or New song until Mureka has named the first song, after which it takes that name. Should the songs not be sent after all, a new set still empty goes again. In the player and the web view.
- **No crackle on iPhone when the next song comes on its own.** Between two songs the sound engine for fades is stopped and started again; the next song now comes only once it runs again, up to 0.6 s, where it used to start while the engine was still stopping, and every song that came on its own crackled until a pause and play. Emptying the song element before each song, and leaving the fades out while the page was out of view, from the version before, are taken back: they made it worse, and the crackle came with the page in view as well.
- **The waveform across the whole width, the times over its ends.** The time played, the time left, the song's dot and the stats button now sit over the ends of the waveform, which runs the full width, with the ends darkened a little behind them, fading out toward the middle. A press on a time seeks as on the waveform; the stats button opens the stats as before. In the player and the web view; Settings, Mobile player, Waveform, Times over the waveform puts them back beside it.
- **Moving covers play.** A song made with a moving cover on Mureka now plays it, looped and silent, over its picture, in the player's cover flow and in the web view. The picture stays until the video has come, and when it cannot be had. Settings, Mobile player, Cover and lyrics, Moving covers turns them off. The song list learns of a moving cover from Mureka's feed, a song's detail and Mureka's own search and song pages.
- **The music video maker's answers are logged longer.** With the debug log on, what Mureka answers in its music video maker (the preview, its slots, stages and conversation) is kept up to 6000 characters, not 800, to learn how a video is made.
- **Moving covers are logged.** A song whose cover is a looped video now writes, once, what Mureka sends about that cover to the debug log, from the player's own feed and song details and from Mureka's search and song pages, to learn where the video is kept before the player shows it.
- **A comment's place in the song shows at the right time.** Mureka sends it in seconds, as a comment tagged 75 showed on its page as 01:15; the player read it as milliseconds and put it near the start. It now shows ▶ 01:15 as Mureka does, and plays from there, in the player and the web view.
- **A mention on someone else's song opens its comments.** Mureka sends a mention as 2003 as well as 2004; both now show the comment and what it is on. Tapped, a mention on any song opens that song's comments in the player, yours or someone else's, and one on a video plays the video.
- **The debug log follows Mureka's pages.** With the debug log on it writes the address of Mureka's page each time it moves to another, and what Mureka answers about a video, to learn the address of a video's page and how its comments are read.
- **Mentions in comments read as names.** Mureka sends a comment's mentions as {{M0}}, {{M1}} and so on, with who each one is beside the text, so a comment of mentions showed as a row of those. The comments now show them as @names, in the player and the web view.
- **Comments tagged with a place in the song are logged whole.** Mureka's answer is cut short in the debug log, so a rare tagged comment past the cut went unseen. With the debug log on, every comment that carries a place in the song is now logged on its own, as Mureka sends it.
- **Clear debug log flashes red.** Done, it filled in the accent inside its red ring; a red button now flashes its own red when done.
- **Mentions in comments say where and what.** A "mentioned you at a comment" notification now says what it is on, a song or a video, by name, and shows the comment itself, with an @ icon of its own. Tapped, a mention on one of your songs opens its comments, and one on a video plays the video, in the player and the web view.
- **New notifications are marked New.** Mureka's list can give every notification as read while it still counts some unread, so none looked new. The newest ones, as many as Mureka counts, are now shown as new, with a New tag beside the name as well as the accent bar, and Mark all read is there whenever Mureka counts any unread, in the player and the web view.
- **Close sits at the right of the notifications' title line.** In the player it moved to the left of the line when Mark all read was not shown, and sat higher than the title. It now stays at the right, centred on the line.
- **The bell counts what Mureka counts.** Mureka puts its red dot on its own count of unread notifications, which can include some its list gives as read. The bell now shows that count too, in the player and the web view, and Mark all read clears it on Mureka as well.
- **The bell is as tall as the badge beside it.** In the player's header the bell was shorter than Online or Offline next to it; both are now the same height and sit on the same line.
- **Songs played already no longer come back as queued.** A song put in with Play next or Play last kept that mark after it had played, so going back to an earlier song showed it, and the ones after it, as queued by hand again. The mark now goes as the song plays.
- **A song in the queue twice plays from the place still to come.** Put in again by hand, a song is in the queue twice. Tapped, it went to the first place, back among the songs played already. Deleting the playing one, as Trim with Delete original does, did the same. Both now go on from the place still to come, and a deleted song leaves every place it had.
- **The page turns so the play head lands just where set.** The turn used to aim, once and at its start, at where the play head would be by its end, from how fast it seemed to go, so it landed a little off, more so when the position came in steps. It now aims again all the way through, from where the play head is and the time left, and lands exactly at the "Play head lands at" place, 0 right on the left edge.
- **Zooming the waveform no longer seeks.** Sliding up or down zooms at once, without first holding still, and a finger settling a little up or down while held still counts as held. Before, the small move while settling made it a drag, and letting go seeked. Moving sideways is still a drag and seeks, and so does a tap.
- **t for the chat.** In a room, t brings the chat out with the cursor in the field, and tucks it into its edge when it shows already. Escape in the field tucks it away too. In the player and the web view, and in the list of shortcuts.
- **Leaving a room or taking it over no longer leaves a queue of 31 songs.** A room shares the song playing and the next 30, so a player listening along held only those, and kept only those on playing on alone or holding the room. Shuffle then mixed just them, mostly the latest songs. The rest of the list now goes on after them, shuffled with shuffle on. A queue already cut short this way grows again when a song is started from the list.
- **The chat comes over everything.** Its window and its tab sit over every dialog and every full screen wait, in the player and in the web view. A question the chat asks itself, what to do with a song linked in it, comes over the chat, and touching the chat brings it up again.
- **The marks of the zoomed part are a little bolder.** The lines at either end are a pixel wider, and the played line inside the stretch in view is almost white.
- **The zoomed part of the song shows more clearly.** On the thin line under the zoomed waveform, the stretch in view is brighter, with a glow above it and a fine mark at either end, and it stays visible once the played part reaches it, where it used to vanish.
- **The sound profile in use stands out.** In Sound profiles, the profile heard now has a bar in the accent color beside it and its name in the accent, in the player and now in the web view too, where only the words "in use" told it apart.
- **The zoomed waveform shows where in the song it is.** Zoomed in, the stretch of the song in view is faintly lit on the thin line at the foot of the waveform, with a soft glow above it. In the player and the web view.
- **The question before trimming is easier to read.** One line each for the part kept, the new length (in bold), the old length, what is cut at the start and at the end, and the title it gets, when it was changed in the Title field. It sits on the same blurred veil as every other dialog, and so does the ring while Mureka trims, in the player and in the web view.
- **A set chosen in the web view's song form reaches the phone.** If the phone was busy and did not take the choice, the web view kept showing it while the phone kept the set chosen before, and the new songs went there. The web view now sends the choice again, and Create makes nothing until the phone has the form as chosen. The log also says where the new songs go, both when the set is chosen and when the songs are made.
- **A new set's suggested name drops a version like v9.5.** "Himalaya Deluxe - v9.5" now suggests "Himalaya Deluxe", where it gave "Himalaya Deluxe - v9.".
- **The chat comes with the room.** Joining a room opens its chat tucked into the edge of the screen, with the count of new messages on its tab, and leaving the room closes it. Opening the chat yourself brings it out of the edge.
- **The chat is a floating window only.** The docked mode, over the song list, is gone. Escape tucks the window into its edge and leaves it there; Close closes it.
- **The tucked chat tab turns as you drag it.** It takes the shape for the edge it would settle on while you move it, not only when you let go.
- **A * marks you when the holder doesn't know you're there.** Listening along, if the player holding the room still has not heard from yours half a minute after joining, you are marked * in the list of users, with a note that its player may need the latest version.
- **Everyone in a room is listed and counted.** A player listening along lists itself among the users in the room, marked (you), even when the player holding the room has not heard it. The count on Together also uses how many the relay has listening, and those it counts but nobody knows by name show as "N more, not known by name".
- **Told once when the holder can't hear the room.** If commands to the player holding the room keep failing, a single notice says that player may need the latest version, instead of a toast every few seconds.
- **The folded chat tab can be dragged.** Drag it to any edge and anywhere along it; it stays there next time. A tap opens the chat again.
- **The lyrics roll away after the last line.** They stayed up until the
  song ended, also with half a minute of music to go.
- **Previous goes back a song up to 5 minutes in.** Seconds before it
  restarts, under Settings > Playback, went no higher than 30. It is now
  picked from a list, from 1 s up to 5 min, so previous can go to the
  previous song well into the playing one.
- **Lyrics on a turning drum, with breaks.** The lyrics, on the cover and
  in the web view, now turn on a drum in place of the flat roll:
  - One eye sees the drum from in front of the middle of the lyrics, and
    each line is cut into strips across, each turned to its own place on
    the drum, so the words wrap round it: the lines before and after are
    squeezed more towards their far edge, drawn in a little towards the
    middle and lean out from it, as on a real drum. The lines sit a line
    apart along the drum's face, so at the first drum size they stand 30
    degrees apart, two before and two after the sung one in sight, fading
    towards the edge, and one more each side rolls in and out of sight on
    the drum. Each strip darkens the further round it is, so the sung line
    shows the curve too.
  - Every line has the same text size. The line being sung is not a
    heavier font, which jumped and widened it, but drawn thicker with an
    outline that grows and fades as it rolls.
  - Drum size percent takes the place of line spacing, the drum's radius
    in lines, 60 to 350, 200 at first: a small drum turns the lines far
    round and bends the sung line across its height, a big one shows more
    lines, flatter. The web view has its own drum size, following the
    mobile player's unless set.
  - The drum turns as one piece: the words are painted on it, and only
    its turn moves them. Side line percent and Side line offset are gone,
    they shrank the lines before and after and moved them aside, so a
    line grew or shrank as it rolled past the middle and the words seemed
    to slide over the drum rather than turn with it.
  - Each line has a thin dark outline, so the lyrics read on a light
    cover, and nothing dark lies behind them any more: on the mobile
    player's cover the shading behind the title is the same short one
    with lyrics as without, and in the web view the lyrics on the cover
    have no dark fade.
  - A break of 10 s or more from one line's start to the next, the intro
    too, shows three dots once the line before has ended, lit one by one
    as the break goes. The lines after it roll up into sight from below
    two bars ahead, 2 to 4 s, 3 s without a tempo.
  - Where a line ends: Mureka's own end time where the lyrics give one,
    else worked out from the song: the time per sound of the lines with
    the next one close after, per section when it has three such lines,
    rounded up to whole bars at the song's tempo.
  - A new section of the song straight after a line stands a little
    apart, the lyrics now keep which section each line is in.
  - The code for it is shared by the player and the web view,
    src/shared/lyrics.js.
- **Buttons that take something away are ringed in red.** Remove on a
  button group, Remove password, Forget pairing, Clear debug log, Clear
  song cache, Clear cover cache, Dissolve sets with only one song, Delete
  profile, Delete playlist, Remove in the picked songs' bar, the cross on
  a saved creator and Clear among Load and Rescan: red words in a red
  ring, in the app and in the web view's copy of the settings, where
  Clear debug log and Forget were filled red. The questions after Remove,
  Forget pairing and Clear song cache answer in red too.
- **Play head zoomed in: a mode that runs across.** "Moves along the song"
  kept the play head as far across the view as the song had come, so in
  the middle of a song it sat near the middle and crept only slowly, and
  looked much like "Stays in the middle". It is now named "Drifts along the
  song", and a third mode, "Runs across, page by page", has the waveform
  stand still while the play head runs across it, turning to the next part
  when the play head nears the right edge (landing 8 % in from the left),
  or at once to wherever the song is after a seek out of view. A view
  dragged by hand stays until the play head leaves it. For the mobile
  player and the web view alike, set for each under its own settings page.
- **Create song from this is Mureka's Restore.** It reads what the songs
  were made from with the same call Restore on Mureka's page makes
  (feed/restore), so the form gets the lyrics as they were written, the
  style, the voice and, for a remix, the song it remixed, an uploaded one
  or anyone's song on Mureka, whole as Mureka keeps it. Before, a remix
  lost what it remixed, as the song's own detail does not say. Where
  Restore gives nothing, the song's detail fills the form as before, and:
  - Every request to make songs that holds a remix is also noted with its
    generation, from the player's Create and from Mureka's own site alike.
    Only those requests are looked at, and they go through untouched.
    Kept in this browser's storage, the latest ones up to 400 kB.
  - An uploaded song named in a song's detail is made ready again.
  - The note under the form says which song is remixed, or that the song
    is a remix of a song not known.
  - What Restore gave, and the fields that could name a remix, go to the
    debug log.
- **Create song from this keeps the remix.** On a song made as a remix
  the form got its title, lyrics and style but not the song it remixed, so
  the new song was no remix. Mureka keeps no record of what a remix
  remixed: its song detail only marks it a remix (control type 11). So the
  player now remembers it when the songs are made:
  - Every request to make songs that holds a remix is noted with its
    generation, from the player's Create and from Mureka's own site alike,
    a song on Mureka (anyone's) as well as an uploaded one. Only those
    requests are looked at, and they go through untouched.
  - Use in Create on a song of such a generation puts the same remix in the
    form, whole, as Mureka's site sent it, and the note says which song is
    remixed.
  - A remix found in neither is named a remix in the note, with no song to
    remix.
  - A remix not noted here is looked up in Mureka's own list of what was
    made, a few pages back, where Restore on Mureka's page should be
    reading it from. What a generation there holds goes to the debug log,
    as its fields are not known for sure yet.
  - Kept in this browser's storage, the latest ones up to 400 kB.
  - An uploaded song named in a song's detail is still made ready again,
    and the fields that could name it still go to the debug log.
- **Drum and bass at its own tempo, also when Mureka says half.** With
  Mureka's tempo near the one first found, the beat was kept, so a drum
  and bass song Mureka gives 87 stayed at 87. Kick and snare taking turns
  now overrules that, as Mureka gives such songs half too. It doubles
  only up to 185 BPM, the drum and bass range, as a song in half time
  feel at 105 shows the same and is no 210. Tried on nine real songs and
  six made ones: the drum and bass song is 174 with or without Mureka's
  87, the others as before.
- **A tempo worked out an older way is redone when its Information is
  opened.** It was redone only once the song came up next, so a stored
  song further away kept the old tempo. Opening Information on a stored
  song now works its tempo out at once, ahead of the others, and the BPM
  row changes when it is done. All tempos are worked out again this
  time.

### Build

- **make embed** writes the web view's page into src/player.js between
  the WEBVIEW PAGE markers, as it is, in a String.raw template.
  make check, build.sh and release-bookmarklet.sh refuse to go on when
  the player does not carry the current page, and **make hooks** lets git
  refuse such a commit, comparing the staged copies. The app's copy of
  the player goes without the page.
- **make fdroid** writes the F-Droid build recipe for a tagged release to
  fdroid/, in the form F-Droid keeps it, ready to copy to fdroiddata. It
  checks that the tag carries the version and the store changelog, and,
  when the release APK is there, that it is signed with the release key.
- The app no longer lists the phone state and storage permissions. The
  build added them for a library that names no target Android version,
  the app never used them.
- **make all** removes the release APKs of older versions, each with its
  checksum, once the current one is built, and keeps any newer one.
  **make prune** does it on its own.

## 2.0.1

Android only: for F-Droid. The code is the same as 2.0.0, this release adds
the screenshots of the F-Droid listing. The add-on and the bookmarklet are
unchanged and not released as 2.0.1.

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
  wheel buttons and any Bluetooth media buttons can control it. A
  notification shows the web view's address and has a Quit button.
- Starts by itself when the device starts and after an update, so the web view
  is there without opening the app. Posts a "Sign in to Mureka" notification
  when Mureka turns the session down.
- On a tablet the app shows the web view as its screen, the same page other
  browsers get, so it gains whatever the web view gains. The Mureka page with
  the player stays behind it, a tap away in the actions menu for signing in,
  and Back or Web view in the player's menu to return. Exports and song
  downloads use Android's save dialog. Can be turned off under Mobile player.
- Fullscreen by default: Android's status and navigation bars are hidden
  while the player is on screen, using the whole screen including the strip
  beside a camera cutout. Can be turned off under Mobile player.
- Export uses Android's own save dialog, or Downloads when nobody is there to
  answer. Import picks a file the same way.
- Exported settings include the app's own: Connections, the public address
  (VPN) and the local name, and Fullscreen. Importing them brings them back,
  asking about the VPN as when switched on by hand.
- Stays reachable when the device lies still for a long time: the page's
  process is kept important, the player loads again by itself if Android ends
  it anyway, and **Run freely in the background** takes the app out of
  battery saving.
- Play, next and previous from Bluetooth or the lock screen start the music
  with the screen off and the device locked.
- **Resend art on resume** sends the cover again when playback picks up, for
  head units that drop it: first a loading ring as the cover, then the
  song's own cover two seconds later. The loading step goes out with an
  invisible change to the title, since Android only tells the Bluetooth
  device about a new cover when the song's text changes.
  **How the cover is sent again**, beside it, can also send the picture only
  or change just the song's id. A Bluetooth device that connects gets the
  song and cover again a moment later.
- **Play when Bluetooth connects**: Never, If it was playing (only when the
  music was playing as the last Bluetooth device went away) or Always.
- **Pause when Bluetooth disconnects**, so the music does not carry on from
  the phone's speaker. Leaves it alone when another Bluetooth device takes
  over or the music plays in a browser.
- An update of the app picks up where it was: the music stays in the
  browser it played in, and a song that was playing plays on from about
  where it was, whatever **Autoplay on start** says. A paused player stays
  paused.
- A play, skip or seek from Bluetooth or the lock screen takes the sound
  back from a browser to the phone, so a device that falls back to
  Bluetooth is never left silent.
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
- **Plays offline.** Without internet, or when Mureka cannot be reached, the
  app opens the player on a page of its own at Mureka's address, so the
  library, the stored songs, covers, waveforms and lyrics are all there. Only
  songs stored on the device play: the others are dimmed in the list, a tap on
  one says it is not stored, and next and previous pass over them. Nothing is
  asked of Mureka while offline, so nothing waits for a request that cannot
  succeed. Plays are kept and reported to Mureka once it can be reached again.
  The internet going while the player runs works the same way, and so does a
  connection the phone calls online but that does not reach Mureka: a song
  that will not load makes the player check whether Mureka answers, and
  without an answer it goes offline and plays on from the next stored song,
  checking again every 30 seconds. The same check runs whenever any request to
  Mureka gets no answer, play reports and background work included, when the
  connection drops or changes over, when a browser of the web view goes away,
  and once a minute when nothing has been heard from Mureka. A play report
  that gets no answer is kept and sent later. The covers beside the playing
  one show the stored songs that play next and before. A small red **Offline**
  mark shows in the header. When the internet is back the mark turns green and
  says **Online**, then fades away after a few seconds, or stays while online
  with **Online badge** set to Always. A double tap on the badge, or on the
  Power saving mark, folds or opens the player, as on the header. The web view
  shows the same badge for the phone's connection, with an **Online badge**
  setting of its own that each browser can also have for itself. It also
  checks its own browser's connection, once a minute, when the browser says
  its connection came or went and when a song will not load: **Browser
  offline** when that browser cannot reach Mureka, and **No phone** when it
  has lost the phone. Every song plays again at once, and the app returns to
  Mureka's site as soon as the music is paused. The stored songs are asked to
  be kept for good, so they are not cleared when the device runs low on space.
- **Every stored song keeps its cover.** However a song gets stored,
  played, cached ahead or cached one by one, its cover is kept with it,
  and songs stored earlier without one get it in the background while
  online. The web view gets the kept cover from the phone when Mureka
  cannot give it, so stored songs show their covers offline there too.

### New: the web view

- Served by the app on port 8080. Only the phone's hotspot and Wi-Fi networks
  may open it, never the mobile network, and **Allow from the phone's
  hotspot** and **Allow from Wi-Fi networks** choose which. **Allow from a
  VPN**, off by default, lets devices in through a VPN the phone is on, such
  as WireGuard, from private addresses only.
- **Public address (VPN)** gives the phone the fixed address 3.3.3.3, since
  Tesla's browser refuses private addresses: `http://3.3.3.3:8080` works
  every time. Other devices can use `http://murekaplayer.local:8080`, and the
  name can be changed. **Only while the hotspot is on** leaves Android's one
  VPN to another app the rest of the time, and a **WireGuard tunnel** named
  in the settings is turned off before the public address comes and on again
  when it goes. **Hotspot** and **WireGuard** On and Off turn the hotspot or
  the tunnel on or off at once, on the phone and in the web view, which also
  shows how the connections stand. The lit button says whether the hotspot
  is on and whether the tunnel is up, a button pressed in the web view shows
  inset until the phone has switched. Who may reach the web view is only set
  on the phone. **WireGuard's battery use** shows whether it is Unrestricted,
  which Android needs before WireGuard may start its tunnel from the
  background, and opens WireGuard's app settings to set it. **Keep
  WireGuard reachable with the screen off**, off by default, keeps the
  device awake while WireGuard holds the tunnel, since a sleeping device
  stops its keepalives and the mobile network soon forgets it.
- Now playing like the phone: sliding covers with the neighbours peeking out,
  synced rolling lyrics beside or on the cover, quarter stars, like with the
  number of hearts (left out when the one heart is your own), plays, a
  Public or Draft badge, **Playing from** with the source and filters, the
  waveform seek bar and the status line. Beside the cover the text starts
  a little below its top. With up next on, the cover names the song playing,
  with a play mark or a pause mark fading in and out, and under it, smaller
  and dimmer, the one up next with the next mark. A dot by the time
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
  small list in place of the stars. A search field of its own under its top
  finds songs in it, the queue too, by title or a song's whole ID, to play
  next or add to the queue from there; closing the list clears it.
- The jumps to the top, the end and the playing song in every song list,
  the player's, the web view's and its small list, ease in and out as one
  movement, the same in every browser. A long way skips the middle while it
  moves fastest, so it still slows gently at the end. A finger, the mouse or
  the wheel on the list stops it where it is.
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
  cache and fetches the covers of the playing song and of the next ones in the
  queue ahead (**Covers ahead**, 5 by default), and those of every song stored
  ahead even beyond that, whether or not a browser is open. A cover on its way
  pulses with a cyan pie filling as it comes in, then fades in, three at a
  time, a cover that stops coming is asked for again and in the end fetched
  straight from Mureka. **Cover cache in MB** (200 by default) sets how much
  room they may take, those shown longest ago go first, and the settings show
  how many there are, with **Clear cover cache** and its progress.
- The song lists in the web view follow the phone: the queue is read again
  when it is shuffled, rebuilt or moves on, and the song list when the
  filters change.
- **Charger and power**, a settings page in the app, for saving power when the
  phone is left alone. **What starts it** is either the phone going **On
  battery** (the charger pulled out) or **Bluetooth disconnects**: the last of
  the ticked Bluetooth devices disconnecting. The paired devices are listed
  with whether each is connected, which needs Android's Nearby devices
  permission, asked for with **Allow Bluetooth access**. After a grace time
  (60 seconds by default) the music can pause and all background work stop, so
  a device left somewhere warm stays cooler. A note counts down on the phone
  and in the web view, saying "Running on battery" or "Bluetooth
  disconnected", with **Skip shutdown**, and the charger or a ticked device
  coming back in time stops it. When it comes back, the background work starts
  again. The web view stays reachable all along, and while a browser is
  connected to it, from a computer at home say, nothing is stopped. **Browsers
  on the hotspot** chooses what happens when the hotspot is to go off while
  browsers of the web view use it: **Turn off anyway**, the default, or **Wait
  for them**, which turns it off once the last of them has gone. **Power
  saving** under What the debug overlays log shows all of it as it happens.
  While the background work is stopped, a small **Power saving** mark shows in
  the player's header, and a tap on it opens the page. The names and
  explanations of the settings follow what starts it.
- **Hotspot**, an experimental and advanced section at the end of Charger
  and power: **Turn off hotspot when on battery** and **Turn on hotspot
  when charging**, or when disconnected and connected with Bluetooth.
  Android lets only the system switch the
  hotspot, so the player brings a small **hotspot helper** of its own. It
  runs as the phone's debugging shell and keeps running until the phone
  restarts, and the app turns the hotspot on and off through it, with no
  Wi-Fi needed, out in town too. It switches the phone's
  own hotspot, with its own name and password, like the quick settings
  tile, and no other app is involved. The player pairs with **wireless
  debugging** once, the code typed into its notification while the pairing
  dialog stays open, and from then on starts the helper by itself, with
  wireless debugging switched on for it and off again (the phone has to be
  on Wi-Fi for the start, once after each restart of the phone). USB
  debugging is switched on for it, since with it off Android ends every
  process started over adb when wireless debugging goes off. Without a
  running helper, each switch runs the helper once over wireless debugging
  instead and needs Wi-Fi. A switch that cannot reach it is tried again as
  soon as the phone joins a Wi-Fi, else every 20 seconds, for five
  minutes, and left alone when the hotspot is already that way. It
  may not work on every device. A command for
  a computer with adb is there for a phone that is not on Wi-Fi. The page
  shows the pairing, the hotspot's last known state and what the last
  command did, and **Turn on hotspot** and **Turn off hotspot** try it,
  each greyed out while the hotspot already is that way. When the power
  saving turns the hotspot on or off by itself, a note on the phone says so
  while it switches and then whether it worked. When one of the
  hotspot settings is on and the helper is not running, the player starts
  it by itself, with a note that it is starting and one saying whether it
  started, and the web view shows the same. It tries again as soon as the
  device joins a Wi-Fi, which wireless debugging needs, and the web view's
  notice about it has **Start the helper now**. Without a pairing it says
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
- **Now playing** in the song list keeps the playing song in sight as the
  songs change, lit while it does, until the playing song is scrolled out
  of sight by hand. The small list does the same from when it opens at the
  playing song or its button finds it, and so does the phone's own list:
  scrolled away from the playing song, the list stays put when the next
  song starts, until the button that finds the playing song is pressed.
- Stars show a tap at once, the phone confirms a moment later.
- Popups, the settings, the other panels, the whole song list and the small
  one close with a swipe down from anywhere but their rows, buttons and a
  search field not in use included, with a finger or dragged with the mouse
  (on the list itself it still loads new songs), and popups without a close
  button have a quiet cross in their top right corner. Typing in one on a
  touch screen moves it up above the keyboard, so renaming a song shows what
  is typed.
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
- The phone's sound choice shows a Bluetooth icon with the device's name while
  the phone's music goes out over Bluetooth, and a phone otherwise. From
  Android 13 it follows where Android actually sends media, so a Bluetooth
  device that is connected but not playing the music shows the phone.
- Volume slider for the phone's media volume, in Android's own steps, which
  over Bluetooth is usually the Bluetooth device's own level. The speaker icon
  follows the level, shown as a percentage or as steps. With the music in the
  browser it is the browser's own level.
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
  mobile player's: on or off, after how long, and the mark with its color,
  size and how often it moves.
- **Settings for this browser**, at the top of the settings, lets one
  browser keep its own look. The settings it covers are marked with a dot
  where they always are, all under Web view, the order of the buttons
  and the waveform's colors included. While it is on, a change
  made in that browser applies there only, and the phone and other
  browsers keep theirs. Off by default: switched on, the settings are kept
  in that browser only, never sent anywhere, and switching it off deletes
  them.
- Tesla's fullscreen from its YouTube app is recognised. There the music moves
  to the browser without asking, and the steering wheel's left and right
  skip to the previous and next song instead of seeking.

### Mobile player, add-on and bookmarklet

- **The counts on a phone** sit in the bar with the list's view, to the
  right, as much of them as fits, which leaves the song list one row more.
- **Settings are never lost to a bad read or full storage.** Settings that
  could not be read are kept aside before anything is saved over them, and
  when the browser's storage is full the player says the settings could not
  be saved.
  A large song list is stored packed, in about a ninth of the room, so a
  library of thousands of songs fits in what a browser keeps for a site,
  Safari's included.
- **Settings in pages.** The main settings page is a list of pages in
  groups: Views (Mobile player, and Web view in the app), Device (This device,
  and Connections in the app), Music (Library, Playback, Now playing), Data
  (Backup and restore) and Troubleshooting (Developer), with Your songs
  (Publishing) between Music and Data. Each group and most
  settings have a short explanation, and each section heading is underlined.
- **Drop-downs for every choice.** A setting with more than on and off is
  a drop-down beside its name, in place of a row of buttons or a button
  that changed its word on each tap, in the web view's copy of the settings
  too. Every switch, button, drop-down and color swatch in the settings has
  the same height. A setting's control sits at the right of its name, and
  the explanation runs on under the control once past it. A choice too long
  for a narrow screen fades out at its end in the web view.
- **A volume for every browser playing.** The web view's volume popup has a
  bar for each browser the song is heard out of, named by browser and
  system, with this browser marked as such, and each can be set from any of
  them. The volume button and keys change it where the song is heard: the
  phone, this browser, or another browser playing it.
  Safari on an iPhone or iPad, which ignores a page's own volume, gets its
  level through a sound engine of its own.
- **Tapping the playing song in the queue** leaves it playing where it is,
  as in the list, instead of starting it over.
- **A song published from the player** takes its place at the top of the
  published songs at once, with today's publish date, instead of sinking
  below them with a number among the drafts.
- **Numbers across the whole library** follow the order the songs were
  made in every list, so the newest song has the highest number and a song
  keeps its number when the list switches between published, drafts and
  all.
- **A fade for a new song.** A song still being made, asked to play as
  soon as it is ready, comes in with the playing song fading out first.
  Browsers playing the music fade along. On an iPhone or iPad, where Safari
  ignores a page's volume, the song goes through a sound engine of its own
  for the fade, which plays on with the screen locked. A song changed or
  paused meanwhile calls the fade off.
- **Public address from another VPN.** A switch under Connections for a VPN
  that is on anyway, WireGuard say, with the public address among its own
  addresses: the app then starts no VPN of its own and leaves that one
  alone, and the address works while it is up, also for browsers at the
  VPN's other end. Off, everything works as before. Android 14 and later
  drops connections from the hotspot to an address a VPN lists only once,
  so the address goes in twice, for WireGuard 3.3.3.3/31, 3.3.3.3/32, and
  Connections warns when it is there only once.
- **Security review before 2.0.** Deleting on Mureka from a web view needs
  a web view password. Other websites in a browser can no longer reach the
  web view's addresses, the server closes slow or crowding connections and
  takes imports of up to 12 MB and covers of up to 8 MB, one at a time. The
  app's own commands, browser names with hidden marks and invented browser
  ids are refused. The app shows Mureka's pages only over https, opens other
  apps only after a tap, keeps nothing for backups or a new phone, and
  pairing the hotspot helper and the WireGuard ping settings are on the
  phone only. The debug log no longer notes keys typed in fields, and
  blanks more kinds of secrets. A question from the phone that comes over
  another one takes no tap for a moment, and only closes itself.
- **No code from elsewhere.** The Google Drive sign in, never switched on,
  is gone with the script it would have loaded from Google, so the add-on
  runs only its own files, as Mozilla's add-on rules ask.
- **Wireless debugging's address.** About lists the address and port a
  computer connects to wireless debugging on, looked for while About
  shows, or says it is off.
- **The hotspot helper in the hotspot's panel.** The web view's hotspot
  panel says in green that the helper is running, or in red that it is
  not, with a button that starts it in place of the switches.
- **Badges in any order.** In the web view a badge is held and dragged to
  another place, with a finger or the mouse, as the control buttons, the
  others sliding aside. The order is kept on the phone for every browser,
  or for this browser alone while it has settings of its own. When a
  badge comes, goes or changes width, the others glide to their new places.
- **Battery badge.** The web view shows the phone's battery as a badge
  without a frame after the heat badge, filled as far as it is charged, green from half,
  yellow from a fifth and red below, with a lightning bolt while it
  charges and a plug while plugged in but not charging. Pointing at it or
  a tap tells the percent and how it charges, and it can show the percent
  beside it. Each browser may show it or not.
- **Status under the badges when it is narrow.** With too little room
  beside the badges to read the status, on a phone held sideways for one,
  the status moves under the badges, two rows between the buttons. When
  the badges would not fit between the buttons, the buttons take less room
  on each side of their icons.
- **A host pinged through WireGuard.** Under Connections, a host on the far
  side of the tunnel, the WireGuard server's inside address say, is pinged
  every 20 seconds unless set otherwise while WireGuard holds the tunnel,
  so traffic goes through it all the time. The phone is kept awake for it
  on a charger, or always or never as chosen. How it stands shows the last
  answer and the loss and answer time over the last five minutes and the
  last hour, with a button to start the figures over, and the debug log
  says when the answers stop and come back.
- **WireGuard restarted when the pings go unanswered.** A setting under
  Connections turns WireGuard off and on again once not one ping has
  been answered for a number of seconds, which sets the tunnel up afresh.
  Another restart waits at least as long again, and How it stands says
  how many restarts there were and when the last one was. Off unless set.
- **A new song is downloaded before it plays.** A song asked to play as
  soon as it is ready is fetched whole onto the device first, while the
  playing song goes on, and then fades in from there rather than streaming
  from Mureka. Not fetched within 20 seconds, it streams as before.
- **Fades for every way of switching songs.** Under Playback, each way
  has its own switch and its own seconds: a new song when ready or played
  now from the question offering new songs (on, 1.5 s), a song tapped or Next and Previous on the screen, a swipe on the
  cover, media controls such as the lock screen, Bluetooth or a steering
  wheel, and keyboard shortcuts (each off, 0.5 s), and a fade in when a
  paused song plays on (on, 0.5 s), after a pause or after another app had
  the sound, which on an iPhone also hides the short stutter Safari makes
  then. The seconds step by half a second or are typed, also in the web
  view, as finely as 0.25. A second switch while a fade runs goes at once.
  On an iPhone the sound engine for the fades is woken on every play and
  when the player comes back into view, and a note asks for a tap when
  Safari keeps it asleep. The pause Safari sends from the lock screen
  controls when another app takes the sound counts as an interruption, so
  the song plays on when the player is back in view. After an
  interruption such as an alarm, the fade in waits for the sound engine to
  run again. A setting under Playback, Silence before fading in, keeps a
  song playing on silent for a while first, half a second unless changed,
  in steps of a tenth.
- **Another app keeping the sound.** When Safari holds a play back because
  another app such as a video app still has the sound, a box asks to play
  on, as Safari only gives the sound back after a tap: Dismiss and a large
  Resume playback button. It can be swiped away and goes by itself once
  the song plays. Dismissed or swiped away, the song stays paused as if
  paused by hand, also when the player comes back into view. A switch
  under Playback, on unless changed, shows a short note asking for Play
  instead.
- **Another app keeps its sound.** A tap or a key on the page with the
  song paused, Dismiss in the box among them, no longer wakes the
  player's sound engine on an iPhone or iPad, which took the sound from
  another app playing and left both quiet. The engine wakes when a song
  plays.
- **Sound that stops coming through.** Safari on an iPhone or iPad can
  stop passing the player's sound on while it says all is well, after a
  long time in the background or after another sound on the page, and
  until now only restarting Safari helped. While a song plays the player
  checks that its sound engine moves on and that sound reaches the
  speaker. When it does not, the engine is restarted, and should that not
  help, the song pauses where it is and the box asks for a tap: Resume
  playback makes a new sound engine and plays on from the same place. The
  trimmer's own sound engine now closes with the trimmer.
- **No jumping back in a browser playing the music.** When the phone's
  silent copy of the song drifts, the phone is set to the place heard in
  the browser instead of the browser jumping back to it. A jump made on
  purpose, or a difference of more than 8 seconds, is still followed.
- **A browser without the music lets go of it.** With No music in this
  browser chosen, or the music on the phone, the web view drops the song
  and its media controls, so a call, a notification or another app taking
  the sound no longer pauses the music on the phone or in another browser.
- **The queue goes on the way the list reads.** Without shuffle, the
  songs after the playing one are those after it in the list as it is
  ordered now, also songs played earlier in the queue, instead of every
  song not played yet, which after many songs left whole stretches of the
  list out. A refresh that adds, removes, publishes or unpublishes songs
  makes a queue built from the list follow it, as a filter does.
- **Badges in the queue.** On the phone and in the web view, a song in the
  queue carries its badge whenever it tells something: new while not
  played yet, a draft while the published songs are listed, public while
  the drafts are listed, and every song while all are listed. A song made
  by trimming without a badge carries its T on the heart's corner, so its
  row keeps the same columns as the rows around it.
- **New songs outside the filters.** A Library setting offers new songs
  found by a refresh to the play queue even when the filters set leave them
  out, such as a draft while only published songs are listed. Ignored songs
  are still left out.
- **Instrumental by short lyrics.** A Library setting counts a song as
  instrumental when its lyrics are shorter than a number of characters, 20
  unless changed, spaces not counted, as with a prompt holding only a note
  such as [Instrumental]. The lyrics are known for songs played, coming up
  next, opened in Information or read for the play counts. 0 switches it
  off.
- **A note for everything asked of Mureka**: publishing, unpublishing,
  renaming, remixing, likes, refreshing a song, trimming and deleting each
  show a ringed note with a turning ring as soon as Mureka is asked, which
  turns into a filled one with the answer, cyan when it went and red when it
  did not. The web view shows the same notes.
- **Icons in the song menu**: each row has an icon before its name, the
  same in the player and the web views, so a row is found at a glance.
- **A tap on a cover** opens that song's menu, the playing song's or a
  side cover's, as a long press on a row of the list does. A long press or
  a right click on a cover opens it too. In the player a double tap still
  changes what shows over the cover.
- **A tap outside the song menu** only closes it: the song or button under
  it is not played or pressed.
- **A tap on the playing song** never restarts it, but when the list shows
  other songs than the queue was made from, published only where it began
  with all songs for example, the queue is made again from the list around
  it, and the covers beside it follow.
- The search box has a clear button at its right end while it holds text.
- **Find a song by its ID**: the song's ID in Information has a copy
  button, and the ID pasted whole into the search box, in the player or the
  web view, finds that song. The ID is Mureka's own, the same for everyone,
  so a friend can send it. A copy button in the web view copies in that
  browser.
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
  of a song playing meanwhile. **Play this after the playing song** waits
  instead: once ready, the song goes in to play next and starts when the
  playing song ends. With more than one song generating, **Play all new
  after the playing song** does that for the tapped song and then every
  other one, each going in as it is ready, in list order, so nothing is cut
  off and nothing goes quiet. Nothing of this is kept over a restart.
- **Look for new songs while in use**: when the player or a web view opens
  or comes back into view, and again while it stays in view, it looks for
  new songs each time the last look is older than the minutes set, in steps
  of five. Only the newest, as on open.
- **New songs with the play queue in view** are offered to it on a Load,
  however they came in: found by the Load, done generating, or newly published
  while only published songs are shown: play now, which puts them after the
  playing song and starts the first at once, the rest of the queue following
  them, play next, add to the end, replace the queue with the playing song
  playing on, or leave them out for now. Left out, they still show in the
  Mureka list. Asked on the phone and in the web view, the first answer
  anywhere counts.
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
  short line of their ids, about eleven characters a song, Done ends it.
  Before it is copied, a box asks what goes along: tempos, instrumental
  marks, ratings and ignored songs, each with a switch, All and None,
  remembered for next time. Pasted into Import in the other player, it asks
  where they go: play next, at the end of the queue or as the whole queue,
  or only takes the values along as song tweaks. Songs the other player
  already has come straight from its library. The others go into the queue
  at once, known only by their id, and are read from Mureka as they are
  needed: the first few right away, a row as soon as it is in sight with
  the next few after it, the songs coming up as many as are cached ahead,
  and a song about to play before it plays. So a line of any length comes
  in at once, and a song Mureka no longer has is passed over. The same goes
  for an imported play queue. The values that came along fill in where
  the other player has none, and where one differs from its own, or was
  removed there on purpose, Import asks which to keep, one by one or for
  all at once. They play from their links there, kept over a restart,
  with a violet shared badge since they may not be public. The web view has
  Select to share too, in the song menu, with the same line and box, and
  its Import asks the same. Once such a song shows up on a list read from
  Mureka, the creator's public songs for one, the published version takes
  its place, with a note saying so. Once a day the shared songs are also
  looked up for new titles and covers.
- **Copy to clipboard as a short line**: song tweaks and the play queue
  copied to the clipboard go as the same short line as shared songs, with
  the same box for what goes along. A line of song tweaks carries what a
  file does, values removed included, and its Import asks as a file's
  does. A copied play queue marks the song that was playing, and Import
  asks whether the songs played before it come along. Files stay as before,
  and a play queue file carries your own tempos and instrumental marks too,
  taken in the same way as with shared songs. A tempo goes along
  whether set by hand or Mureka's own, so a song the other player reads from
  Mureka by its id, which comes without a tempo, still has one.
- **Mureka song links in Import**: pasted share links from Mureka's site,
  one or many, mixed with other text, are read from Mureka and taken in as
  shared songs, also songs not yet published.
- **Heat badge** in the web view, from the Android app: how warm the phone is,
  cool in blue below 40 °C battery, warm in yellow from 40, hot in orange from
  45, very hot in red from 50, or worse when Android's own heat level says so.
  The limits can be set under Web view display. A tap shows the battery's
  temperature, Android's heat level with the limits behind it, and, while the
  hotspot is on, a button that switches it off. It can show the word, the word
  and the temperature, or the temperature alone. On by default, and each
  browser can have its own choice.
- **Password for the web view**, optional, at the top of the Web view page
  in the settings, on the phone or in the web view, where changing or
  removing it needs the current one. A browser asks for it once and stays
  signed in until the password changes or all browsers are signed out, the
  app's own screen never asks. While none is set, the app and each browser
  ask at every start whether to set one, with Never show again. Wrong
  passwords make the device wait longer each time, and past ten wrong ones
  from all devices together every browser waits, so many addresses do not
  help someone guessing.
- **Lyric position** for the web view, under Web view in the settings,
  moves the lyrics up or down, beside the cover and on it. Each browser can
  have its own.
- **Signed in account** in the web view, beside the badges, and on a phone
  on a second line of the header together with the badges.
- **Hotspot badge** in the web view, off by default, under Web view display
  in the settings: an icon after the heat badge, cyan while the
  phone's hotspot is on, grey while it is off and dashed when the phone
  cannot tell, read from Android itself. A tap offers to switch the hotspot
  on or off, which goes through the hotspot helper. Each browser can show
  it or not on its own. A tap opens a panel with how the hotspot stands,
  how this browser reaches the phone, and a note before a switch that
  would cut this browser off.
- **WireGuard badge** in the web view, off by default: before the hotspot
  badge, a white shield ringed in WireGuard's red while its tunnel is up
  and grey while it is down. A tap opens the same kind of panel to turn
  the tunnel on or off, with a note for a browser on the public address
  before WireGuard takes the phone's one VPN from it, and for one that came
  through the VPN before the tunnel goes. Each browser can show it or not
  on its own.
- **Account name** in the web view can be switched off under Web view
  display, for each browser on its own, leaving more room on a narrow
  screen.
- **Song list beside the song.** With room beside the cover, the small song
  list slides in over the whole column beside it, and the title, stars,
  heart and lyrics slide over the dimmed cover, so they stay in reach.
  Closing the list slides both back. When there is room, Always or Never,
  under Web view display, for each browser on its own.
- **Show cover** in the web view's song menu shows the song's cover large,
  at its full size, where pressing and holding it, or a right click, gives
  the browser's own menu to copy or save it.
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
- **Copy tweaks, Copy songs, Copy queue and Import** at the foot of the menu
  under the three lines, in the player and in the web view. Copy puts the song
  tweaks or the song library on the clipboard at once and says so, and Import
  opens the box to paste an export into, with any differences asked about as
  in Import.
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
  waveform plays from there. **Fade out the last two seconds** fades the preview
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
- **Trimmer keeps its zoom**: the close up opens as wide as it was left
  last time, on the phone and in each browser with the web view.
- **Trimmer gain**: the close up's height can be magnified up to 256 times,
  so quiet clicks and crackles near the end show. Drag up or down in the
  close up, use Shift with the wheel, or press More gain and Less gain.
  The gain shows in the close up's corner. Only the drawing changes, not
  the song or what is heard.
- **Download** in the song menu asks for the file name first, filled in
  with the song's title followed by its id in brackets, ready to change.
  Where the browser can hand files to other apps, on a phone for one,
  **Share** sits beside Download and opens the share sheet with the song
  under that name, to keep it in Files, put it in Drive or send it on.
  Tapped before the song is ready, it asks again once it is.
  In the web view the song is saved under that name too, the phone
  fetching it for the browser.
- **Drafts** as a third way of showing your own library, beside Published
  and All songs: only the songs not published. The Published button, the
  feed button and the web view's button and chips go through all three, a
  pencil marks Drafts.
- **Rename**, **Publish** and **Unpublish** in the song menu for your own
  songs, and **Allow remixing** or **Disallow remixing**, instrumentals
  included. Publishing copies the song's link to the clipboard, in the web
  view to that browser's, and a short note on the page says it is published
  and the link copied. A title Mureka does not accept, when publishing or
  renaming, is said plainly, with a field to change it and try again, on the
  phone and in the web view.
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
  screen, Bluetooth and the web view. Turn it off to always go to the previous
  song.
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
  detailed and in the same colors: the peaks dim, and in front of them
  how loud the song sounds, bright. It is worked out once and kept, and
  Mureka's shows until the song is cached. The web view has the same
  choice of its own, under Web view.
- **Color when played**, **Color still to play** and **Play head color**
  for the waveform, under Mobile player and Web view, Waveform, each with
  how much of it shows, picked over the settings. The quieter outer part of
  the waveform from the song takes them darker. The play head shows on the
  waveform zoomed out too. **Reset the waveform colors** puts all of the
  waveform's colors back as they came, and the waveform colored as the way
  the song's progress shows.
- **Zoom into the waveform**, in the player and the web views: pinch, the
  mouse wheel over it, or a press held still a moment and then slid up zooms
  in up to 32 times. Pinch, sliding down after the hold, or a double tap zooms
  out. A press that moves sideways first stays a drag. Zoomed in, the play
  head stays in the middle and the waveform moves under it, easing in from the
  start and out toward the end, with a thin progress line of the whole song
  along its foot. Dragging along that line moves through the whole song, as
  zoomed out. From the waveform's left edge it also shows how far into the
  whole song it is, and that edge can be dragged at any height to move
  through the whole song, the waveform following, the play head coming first
  when the two are close. It has one color on the played part, left of the
  play head, and another where it reaches past it. **Song's progress on the
  waveform** picks how: a bar over the waveform, a bar behind it, the
  waveform itself colored, the thin line at its foot then in the same
  color, or off, the waveform colored as it comes. Zoomed out it lies on
  the played part, in the same color. **Progress color up to the play
  head** and **Progress color past the play head**, each with how much of
  it shows, are picked over the settings. The progress past the play head
  comes in the same color as Color when played. All under Mobile player and
  Web view, Waveform, the look also for each browser on its own.
  Dragging past two thirds of the way to an edge scrolls the waveform that
  way, faster the nearer the edge. **Remember the waveform zoom level**, under
  Mobile player and Web view, keeps the zoom for the next time the player
  opens, each browser its own, and a web view can have it set for itself
  alone.
- **Autoplay on start** moved to This device, under Playing by itself.
- **Play on after a quick restart**, under This device, Playing by itself:
  opened again within that many seconds after it closed while playing, a
  reload or a restart of the app, the player plays on from the same song
  and second. Half a minute unless set, 0 turns it off. Later than that it
  opens paused, unless Autoplay on start is on. A browser that wants a tap
  first gets Tap Play to play on from where it was.
- Opening the app, or coming back to the page from another tab or app,
  takes the black screen cover away as a tap would, so the player shows
  at once.
- **Start with** can also be **As last time**, the list and artist the player
  showed when it was last used. It is the default, also for settings kept
  from before, where Published was stored whether it was picked or not.
- **Remove ; from lyrics** takes Mureka's pause marks out of the lyrics
  everywhere they show.
- The song menu, from a long press or a right click, shows the song's number
  and title at the top, so it is clear which song it opened on. The row
  being pressed lights up, and stays lit while its menu is open, in the
  player and in the web view's lists.
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
- With numbers over the whole library, the numbers count down the list in
  its own order, also while it is newest published first and for songs that
  came in from another library. Songs published in another order than they
  were made came out the wrong way round, 1000 above 1001.
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
  with the layout numbers at the top. Taps go through it, except on the
  cross in its top right corner, which turns it off. **Copy debug
  log** copies it all, **Clear debug log** starts it again, in the web views
  too.
- The song menu, the settings, Information and Stats for nerds close with a
  swipe down, with a finger or dragged with the mouse.
- **Stats for nerds** under Developer: a small ringed i after the time
  opens what the player knows about the playing song: where the sound and
  the cover come from, how long the song took to be heard, the file's size,
  format and bit rate, how much of it is loaded, the cover's size and
  resolution, which waveform shows and how it was made, the next song made
  ready, how much is stored and how full the store is, the song list's
  size as text and as stored, and the library: its source, songs published
  and drafts, how many get through the filters and which filter leaves how
  many out, ignored songs, the queue, songs still generating, shared songs
  and how many are rated or have a tempo or instrumental mark. The web views
  show the same for the song on the phone, behind the same i.
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
  with a loading ring as its cover or with its own, to find out what a
  Bluetooth device or the lock screen takes. A button rings briefly when it
  has sent, red if nothing was playing. The debug overlay lists every cover
  sent and whether the cover downloaded. In the app the buttons send the way
  chosen under **How the cover is sent again**.

### Build

- New `android/` folder and a root `Makefile`: `make all` runs the checks,
  builds the browser add-ons and the release APK, `make addons` only the
  add-ons, `make install` installs
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
- `adb-reconnect.sh` reconnects adb to an Android device over the network.
- The app's version code has two digits for each of the first three parts
  of the version and four for the build, so 2.0.0 is 200000000 and a
  build number up to 9999 never sorts past the next version. A version
  too large for that stops the build.
- The APK carries no Google dependency metadata in its signing block,
  which F-Droid does not accept. F-Droid builds the app from the release
  tag, finds it the same as the APK on GitHub and ships that APK, signed
  with the release key, so either can update the other.

### Known limits

- Google sign in inside the app's WebView may still be refused by Google.
- Without a password set, anyone on the same network can open the web view.
  Set a **Password for the web view**, or turn off **Allow from Wi-Fi
  networks** to keep it to the phone's hotspot.
- The Tesla greys out next and previous while a normal browser page plays the
  music. **Offer seeking to the browser**, under Developer, is there to test
  whether it changes that.
