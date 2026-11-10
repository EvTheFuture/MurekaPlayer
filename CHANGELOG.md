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
