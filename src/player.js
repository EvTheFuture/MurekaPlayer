/*
 * Mureka Player - load and play all your Mureka songs
 * Standalone bookmarklet player, runs inside the mureka.ai page
 *
 * Copyright (C) 2026 EvTheFuture
 * https://github.com/EvTheFuture/MurekaPlayer
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

(function () {
    "use strict";

    // Guard against the bookmarklet being tapped twice
    // If the player is already on the page, toggle it instead of building another
    if (window.__murekaPlayerLoaded) {

        if (typeof window.__murekaPlayerToggle === "function") {
            window.__murekaPlayerToggle();
        }

        return;
    }

    window.__murekaPlayerLoaded = true;

    // The player only works on mureka.ai, where it can reach the API with your
    // session cookie. Keep the site origin in one place for redirects and links
    const SITE_ORIGIN = "https://www.mureka.ai";

    // Whether the current page is mureka.ai or one of its subdomains
    function onMurekaSite() {

        const host = location.hostname;

        return host === "mureka.ai"
            || host === "www.mureka.ai"
            || host.endsWith(".mureka.ai");
    }

    // Run from another site the bookmarklet cannot reach the API, so send the
    // browser to mureka.ai instead of building a player that cannot load
    if (!onMurekaSite()) {
        location.href = SITE_ORIGIN + "/";
        return;
    }

    // Player version, shown in the panel header so an update is easy to confirm
    // Keep this in sync with the version field in manifest.json
    const VERSION = "1.5.0.2";

    // The two feeds this player can load
    // published returns only your published songs
    // all returns every song you made, including drafts and unpublished ones
    // One library for your own songs. The mysong feed returns everything,
    // drafts and published alike, each carrying its publish state, so published
    // is a filter over the single cache rather than a second feed with its own
    // cache and its own cursor that goes stale while the other is refreshed
    const OWN_FEED = {
        label: "Mine",
        queryType: "mysong",
        endpoint: "/api/pgc/feed/list",
        t: "1",
        cacheKey: "mureka_autoload_mysong"
    };

    // The cache the old separate Published feed used, merged in once on upgrade
    const LEGACY_PUBLISHED_KEY = "mureka_autoload_publishedmysong";

    // Which feed is active, published by default
    // Which songs of your own library the list shows, all or published only
    let publishFilter = "published";

    // Shortcut to the active feed config
    // While a creator is selected this returns a creator config instead, so the
    // loader, cache key and status line all follow that creator transparently
    function feed() {

        if (creatorSource) {

            return {
                label: creatorSource.stage_name,
                endpoint: "/api/pgc/user/published/songs",
                creator: true,
                user_id: creatorSource.user_id,
                cacheKey: "mureka_autoload_creator_" + creatorSource.user_id
            };
        }

        return OWN_FEED;
    }

    // Songs requested per page
    // The server caps this at 20 no matter what we ask for, so 20 it is
    const PAGE_SIZE = 20;

    // Delay between page requests in milliseconds
    // The pages must be fetched in sequence, so raise this only if rate limited
    const PAGE_DELAY = 0;

    // Number of already cached songs that must appear in a row before we stop
    // A single republished song keeps its id, so one match is not enough
    const KNOWN_STREAK_STOP = 5;

    // Host that serves the audio files, the song mp3_url path is appended to it
    const AUDIO_BASE = "https://static-cos.mureka.ai/";

    // Cache API bucket name where downloaded mp3 files are stored for replay
    const AUDIO_CACHE = "mureka_audio_cache_v1";

    // Cache API bucket for re-encoded cover art data urls, so a cover downloads
    // and re-encodes only once and then persists across sessions, like the audio
    const ART_STORE = "mureka_art_cache_v1";

    // localStorage key for songs the user marked as instrumental by hand.
    // Mureka needs plain text instructions in the lyrics prompt sometimes, so a
    // track can carry lyrics text while still being an instrumental
    const MANUAL_INSTRUMENTAL_KEY = "mureka_manual_instrumental_v1";

    // localStorage key for tempos entered by hand. Mureka leaves bpm unset on
    // some songs, and without it they can only ever be excluded from a tempo
    // filter, so a value can be supplied and is then used like a real one
    const MANUAL_BPM_KEY = "mureka_manual_bpm_v1";

    // localStorage key for star ratings, song_id to 0 to 5. A song missing
    // from it has never been rated, which is kept apart from zero stars
    const RATING_KEY = "mureka_rating_v1";

    // Star colours, lit and unlit. An unrated song shows grey outlines, a
    // rated one gold outlines, so zero stars and not rated look different
    const STAR_GOLD = "#f5c518";
    const STAR_EMPTY = "#6a6a74";

    // Cache API bucket for the per song detail payload, the play and like
    // counts plus the timed lyrics. Counts change over time, so every entry
    // carries the moment it was stored and is refetched once it is too old
    const DETAIL_STORE = "mureka_detail_cache_v1";

    // Cache API bucket for the per song waveform. Only the feed responses carry
    // wave_list, so it is persisted here as feed pages arrive and read on play
    const WAVE_STORE = "mureka_wave_cache_v1";

    // Default number of upcoming songs to cache ahead, now also a user setting
    const PREFETCH_DEFAULT = 3;

    // Album art coverflow, the center cover takes this fraction of the width and
    // the previous and next covers peek in on the sides. Lower shows more of the
    // neighbors, 0.5 shows exactly half of each
    const ART_CENTER_FRACTION = 0.6;

    // Strongest blur on a side cover at its furthest from center, in pixels
    const ART_SIDE_BLUR = 3;

    // Side covers are drawn slightly smaller so they look like they sit behind
    // the playing cover, 1 is the same size as the main cover
    const ART_SIDE_SCALE = 0.8;

    // How many covers to keep ready on each side, two lets a swipe pull the next
    // one in from beyond the edge
    const ART_SIDE_TILES = 2;

    // localStorage key that remembers whether the panel is minimized
    const MINIMIZED_KEY = "mureka_player_minimized";

    // localStorage key that remembers the panel position
    const POS_KEY = "mureka_player_pos";

    // localStorage key that remembers the panel width and list height
    const SIZE_KEY = "mureka_player_size";

    // localStorage key that remembers the user settings object
    const SETTINGS_KEY = "mureka_player_settings";

    // localStorage key that enables developer only features like Copy JSON
    // Toggle from the console with localStorage.setItem("mureka_player_debug", "1")
    const DEBUG_KEY = "mureka_player_debug";

    // localStorage key that remembers which songs have been downloaded to disk
    // The extension cannot read the download folder, so we track requests here
    const DOWNLOADED_KEY = "mureka_player_downloaded";

    // localStorage key that remembers the logged in user id once it is learned
    // It is read from your own feed so the followed creators list can load
    const SELF_KEY = "mureka_player_self";

    // localStorage key that remembers creators added by hand in the picker
    const CREATORS_KEY = "mureka_player_creators";

    // localStorage key that remembers the last source, your feed or a creator
    const SOURCE_KEY = "mureka_player_source";

    // localStorage key that remembers the play queue across restarts
    const QUEUE_KEY = "mureka_player_queue";

    // Shared style for the floating dropdowns, positioned and shown at runtime
    const POPUP_CSS = [
        "position:fixed",
        "z-index:1000001",
        "background:#26262c",
        "color:#fff",
        "font:13px/1.4 sans-serif",
        "border:1px solid #3a3a42",
        "border-radius:8px",
        "box-shadow:0 8px 24px rgba(0,0,0,0.5)",
        "padding:8px",
        "box-sizing:border-box",
        "display:none",
        "flex-direction:column",
        "gap:6px"
    ].join(";");

    // User settings, loaded once on startup, published is the default start feed
    let settings = loadSettings();

    // The last browsed source, used to reopen on your feed or a creator
    let startupSource = loadSource();

    // Honor the remembered feed, or the chosen start feed, before its cache loads
    // A remembered creator is applied after the UI is built, see applyStartupSource
    publishFilter = (startupSource && startupSource.kind === "feed")
        ? startupSource.feed
        : settings.startFeed;

    // The creator whose library is being browsed, or null for your own library
    // When set, feed() returns a creator config so the loader and cache follow it
    // This must be declared before the cache is loaded below, because loadCache
    // calls feed(), which reads creatorSource. A later declaration would leave it
    // in its temporal dead zone, making feed() throw and the cache load come up
    // empty, which forced a full reload on every startup
    let creatorSource = null;

    // Cached data, loaded once on startup
    let cache = loadCache();

    // Set of song_ids that have been requested for download to disk
    // The extension cannot read the folder, so this is the best we can track
    let downloadedIds = loadDownloadedIds();

    // The user playlists, loaded on demand, and the currently selected one
    // activePlaylist is null for the whole library, or {playlist_id, name, ids}
    let playlists = [];
    let activePlaylist = null;

    // True while a playlist load is in progress
    let playlistsLoading = false;

    // The logged in user id, learned from your own feed, used to list who you follow
    let selfUserId = loadSelfUserId();

    // Creators you follow plus any added by hand, loaded on demand into the picker
    let followedCreators = [];
    let savedCreators = loadSavedCreators();

    // True while the followed creators list is loading
    let creatorsLoading = false;

    // Live filter text for the creator picker, lowercased, empty shows all
    let creatorQuery = "";

    // Play, favorite and share counts for the now playing song, or null
    let nowPlayingCounts = null;

    // Whether the floating action and view dropdowns are open
    // Both start closed so the panel opens compact every time
    let actionsOpen = false;

    // True while the settings panel is on screen, so the blackout holds off
    let settingsOpen = false;

    // Every settings row registers a redraw here, so opening the panel can put
    // all of them back in step with what is actually stored
    const settingsRefreshers = [];
    let viewMenuOpen = false;

    // True while a load run is in progress
    let running = false;

    // The last raw feed response, kept for the debug Copy last feed JSON action
    let lastFeedResponse = null;

    // Identifies the active load run, bumped to cancel a run and to stop a load
    // that started on one feed from writing into another after a feed switch
    let loadToken = 0;

    // True while a cache-all run is in progress
    let cacheRunning = false;

    // Object URL of the blob currently feeding the audio element, for cleanup
    let currentObjectUrl = null;

    // A playable URL prepared for the song coming up next, resolved from the
    // cache while the current song is still playing. Starting the next song in
    // the background only works if play is called without waiting on anything
    // first, and this is what makes that possible even with no signal
    let nextReady = null;

    // Incremented on each play, lets a slow blob fetch know it is now stale
    let playToken = 0;

    // Base URL for audio files, defaults to the known host
    // Falls back to detection from the site player only if this stops working
    let audioBase = AUDIO_BASE;

    // The song object currently playing, null when nothing plays
    let currentSong = null;

    // Cache of recent cover images by song id, held as data urls so returning
    // to a recent track shows its art at once without a refetch. Data urls carry
    // the bytes inline, avoiding the blob url loading and memory bugs on iOS
    const ART_CACHE_MAX = 5;
    const artCache = new Map();

    // Rising token so a slow cover fetch learns a newer track has taken over
    let artFetchToken = 0;

    // Shared audio element for the built in player
    let audio = null;

    // True once any song has played in this session
    // Guards against wiping the cache when the audio base URL is wrong
    let playbackWorks = false;

    // The play queue, a list of song_ids, and the position of the current song
    // Next and previous move the position, the queue is fully materialized so the
    // queue view can show what is coming up
    let queue = [];
    let queuePos = -1;

    // When true the queue is built and rebuilt in random order
    // Starts from the default play mode chosen in settings
    let shuffleMode = settings.shuffle;

    // Repeat mode, one of all, one or none
    // Starts from the default repeat chosen in settings
    let repeatMode = settings.repeat;

    // Saved playback state so Stop can be resumed by Play
    let resumeState = null;

    // A one-shot seek applied once the next song has loaded, used when resuming
    let pendingSeek = 0;

    // Timestamp of the last periodic queue save, throttles writes during play
    let lastQueueSave = 0;

    // UI element references
    let statusEl = null;
    let authWarnEl = null;
    let countsEl = null;
    let listEl = null;
    let listWrapEl = null;
    let pullEl = null;
    let toTopBtn = null;

    // Rows are built lazily as the list is scrolled. These hold what the list
    // would show, how many rows of it exist as elements, and the per render
    // facts each row needs. A library of thousands of songs must not become
    // thousands of live elements on every redraw, which is what was running
    // the phone out of memory
    let lazyRows = [];
    let lazyRendered = 0;
    let lazyKeep = 0;
    let lazyKey = "";
    let lazyState = null;

    // How many rows go in at a time
    const RENDER_CHUNK = 120;

    // The panel colour, used by the panel, the backdrop behind it and the page
    // backgrounds it takes over, so the three can never drift apart
    const PANEL_BACKGROUND = "#1d1d22";

    // The padding the phone layout gives the panel
    const PANEL_PAD_MOBILE = "8px";

    // What the page looked like before the panel took its colours over, so it
    // can be handed back untouched the moment the panel folds away
    let savedRootBackground = null;
    let savedThemeColors = null;
    let addedThemeMeta = null;

    // Safari paints the strip around the page, and tints its own toolbars,
    // from the page rather than from anything drawn on top of it. No element
    // can reach those areas, which is why a sheet behind the panel leaves them
    // black. The page itself is asked for the panel colour instead, through
    // the root background for the strip and through theme-color for the bars,
    // and both are put back exactly as they were when the panel folds away
    function paintPageBehind(active) {

        const root = document.documentElement;

        if (active && savedRootBackground === null) {
            savedRootBackground = root.style.backgroundColor;
        }

        if (active) {
            root.style.backgroundColor = PANEL_BACKGROUND;
        } else if (savedRootBackground !== null) {

            root.style.backgroundColor = savedRootBackground;
            savedRootBackground = null;
        }

        // A site may ship several of these, one per colour scheme, and the one
        // that applies is whichever matches, so they all have to be handled
        let metas = Array.prototype.slice.call(
            document.querySelectorAll('meta[name="theme-color"]'));

        if (active && !metas.length && !addedThemeMeta) {

            addedThemeMeta = document.createElement("meta");
            addedThemeMeta.setAttribute("name", "theme-color");
            document.head.appendChild(addedThemeMeta);
        }

        if (addedThemeMeta) {
            metas = metas.concat([addedThemeMeta]);
        }

        if (active) {

            if (savedThemeColors === null) {

                savedThemeColors = metas.map(function (m) {
                    return m.getAttribute("content");
                });
            }

            metas.forEach(function (m) {
                m.setAttribute("content", PANEL_BACKGROUND);
            });

        } else if (savedThemeColors !== null) {

            metas.forEach(function (m, i) {

                const was = savedThemeColors[i];

                if (was === null || was === undefined) {
                    m.removeAttribute("content");
                } else {
                    m.setAttribute("content", was);
                }
            });

            savedThemeColors = null;
        }
    }

    // True while the on screen keyboard is covering part of the panel. Set by
    // the search field handling, read by the sizing, which must not hand the
    // panel the tall viewport while the keyboard is over the lower half of it
    let keyboardUp = false;

    // iOS Safari zooms the whole page when a focused field has a font smaller
    // than this, and never zooms back out. Every field the user can type into
    // is set to it, which is the only way to refuse that behaviour without
    // disabling pinch zoom for the whole site
    const INPUT_FONT = "16px/1.3 sans-serif";

    // A jump to either end scrolls smoothly for a while, and none of that
    // scrolling is the user, so the edge button must not react to it
    let edgeJumpUntil = 0;

    // Direction aware scroll button state
    let toTopDir = "up";
    let toTopTimer = 0;
    let lastListScroll = 0;
    let programmaticScrollAt = 0;
    let loadButton = null;
    let rescanButton = null;
    let feedButton = null;
    let cacheButton = null;
    let downloadButton = null;

    // Which button started the run that is going on, "load" or "rescan", so
    // the one that was actually pressed is the one that turns into Stop. Both
    // call into the same loader, and labelling Load as Stop during a rescan
    // pointed at a button the user never touched
    let runOwner = null;

    // The sheet painted behind the panel on phones, see where it is built
    let backdropEl = null;

    // The panel, its header, its collapsible body and the minimize indicator
    let panelEl = null;
    let headerEl = null;
    let selfNameEl = null;

    // The logged in user's stage name, used for the ${artist} template tag
    let selfName = "";

    // Refreshers for the live template previews shown in settings
    let metaPreviewUpdaters = [];
    let sourceSepEl = null;
    let sourceEl = null;
    let bodyEl = null;
    let minimizeBtn = null;

    // The actions menu entry that folds and unfolds the panel, kept so its
    // label and icon can follow the state rather than always saying Hide
    let foldButton = null;

    // The menu entry that enters and leaves fullscreen, kept so its label and
    // icon can follow the state
    let fullscreenButton = null;

    // The transport row and the buttons it can hold, keyed by the names used
    // in the controlOrder setting
    let controlRowEl = null;
    let controlButtons = {};

    // The published or all toggle when placed in the transport row
    let publishedCtrlBtn = null;

    // The opener for the smart filter sheet, and the on off switch beside it
    let smartFilterBtn = null;
    let smartToggleBtn = null;

    // The vocals, instrumental or all cycle when placed in the transport row
    let vocalsCtrlBtn = null;

    // Long press state for rearranging the transport row in the player itself.
    // A short press must still work the button, so nothing moves until the
    // press has been held, and the click that follows a drag is swallowed
    let ctrlDragName = null;
    let ctrlHoldTimer = null;
    let ctrlGhost = null;
    let ctrlGhostDX = 0;
    let ctrlGhostDY = 0;
    let ctrlStartX = 0;
    let ctrlStartY = 0;
    let ctrlSuppressClick = false;
    let ctrlDocMove = null;
    let ctrlDocUp = null;

    // Timestamp of the last header click, so minimize needs a double click
    let lastHeaderClickT = 0;
    let minimized = false;

    // Current anchor, the side and edge offset are kept so growth keeps the dock
    let anchorLeft = 8;
    let anchorSide = "bottom";
    let anchorOffset = 16;

    // The view buttons, keyed by view name
    let viewButtons = {};

    // The vocals filter buttons, keyed by filter value
    let filterButtons = {};

    // Set of song_ids whose mp3 is present in the audio cache
    let cachedIds = new Set();

    // Set of song_ids whose cover is present in the persistent art store
    let artCachedIds = new Set();

    // Set of song_ids that are being cached right now, shown by a pulsing dot
    let cachingIds = new Set();

    // Current search box text, lowercased, empty means show all
    let searchQuery = "";

    // The list row of the currently playing song, used to scroll it into view
    let playingItemEl = null;

    // Which list view is active, one of mureka, queue or alpha
    let listView = settings.view;

    // The right-click options popup, built once and reused
    let contextMenuEl = null;

    // The song information overlay, built once and repopulated per song
    let infoEl = null;
    let infoBodyEl = null;
    let infoToken = 0;

    // The settings overlay and its controls, built once and reused
    let settingsEl = null;
    let startPublishedBtn = null;
    let startAllBtn = null;

    // The collapsible top action menu and its toggle in the header
    let actionsWrapEl = null;
    let actionsToggleBtn = null;

    // The floating view and filter dropdown and the bar that toggles it
    let viewMenuEl = null;
    let viewMenuBar = null;

    // The playlists overlay, its list container and the open button
    let playlistsEl = null;
    let playlistsListEl = null;
    let playlistButton = null;

    // Creator picker overlay parts and the action tile that opens it
    let creatorsEl = null;
    let creatorsListEl = null;
    let creatorsInputEl = null;
    let creatorButton = null;

    // Player UI element references
    let artWrapEl = null;
    let playerArt = null;
    let artPlaceholderEl = null;
    let playerTitle = null;
    let playerMetaEl = null;

    // The art and transport block. It lives at this scope because the keyboard
    // handling below runs outside the builder that creates it
    let playerEl = null;

    // Bring the art and transport block back after the keyboard has gone
    function showPlayerBlock() {

        if (!playerEl || playerEl.style.display !== "none") {
            return;
        }

        playerEl.style.display = "block";

        if (!swipeActive) {
            positionArt(0);
        }
    }

    // Take it away while the keyboard covers the lower half of the panel
    function hidePlayerBlock() {

        if (!playerEl || playerEl.style.display === "none") {
            return;
        }

        playerEl.style.display = "none";
    }

    // The walking text controller for the meta line. It is often longer than
    // the panel, and an ellipsis hides the tempo and the moods, which are the
    // useful part. The status line above the art uses one of its own
    let metaMarquee = null;
    let statusMarquee = null;

    // The last status text, kept so the line can be put back after its
    // marquee is built, which happens after the first status is set
    let statusText = "";

    // How long the text rests at the left before it starts, and again each time
    // it comes back around
    const META_SCROLL_DELAY = 3000;

    // Pixels per second, slow enough to read
    const META_SCROLL_SPEED = 40;

    // The clear space that follows the text before the next copy of it, about
    // twenty spaces at this size
    const META_SCROLL_GAP = 72;

    let playerCountsEl = null;

    // Synced lyric display, five stacked rows rolled on advance, rows are
    // {t: ms, text} for the current song only
    let lyricBox = null;
    let lyricSlots = [];

    // Overlay elements controlled by the art overlay mode
    let bottomScrimEl = null;
    let bottomWrapEl = null;

    // Toast shown when the overlay mode is cycled by a double tap
    let artToastEl = null;

    // Last tap on the art, for double tap detection on touch devices
    let lastArtTapT = 0;

    // Time of the last touch end on the art, to ignore the dblclick that iOS
    // synthesizes after a double tap
    let lastArtTouchEndT = 0;
    let lastArtTapX = 0;
    let lastArtTapY = 0;
    let lyricRows = [];
    let lyricIdx = -1;

    // Waveform seek bar, the normalized wave data for the current song
    let waveData = null;
    let waveCanvas = null;
    let seekBar = null;
    let curTimeEl = null;
    let remTimeEl = null;
    let playPauseBtn = null;
    let shuffleBtn = null;
    let repeatBtn = null;

    // True while the user is dragging the seek bar, so timeupdate does not fight it
    let isSeeking = false;

    // True when the last pause came from the user, either the panel button or
    // the MediaSession pause action. A pause without this flag is an operating
    // system interruption, such as a call or another app taking the audio
    let userPaused = false;

    // True while a track change is swapping the source. The media load
    // algorithm flips paused on a source change, and some engines fire a pause
    // event for it, which must not be mistaken for an interruption
    let switchingTrack = false;

    // The playToken that already got one retry after a load error, so a play
    // that fails twice stops instead of looping through retries
    let errorRetryToken = -1;

    // How many songs in a row failed to start. With no signal the queue should
    // skip past songs it cannot load rather than stopping, but not forever
    let playFailStreak = 0;

    // Album art coverflow and swipe state
    // artTiles is the row of cover images, the middle one is the current song
    let artTiles = [];
    let swipeActive = false;
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeDir = 0;
    let currentSwipeOffset = 0;

    // Rising token so a new touch cancels any glide still animating
    let artGlideToken = 0;

    // The landing action of a glide still in flight, so it can be committed
    // rather than dropped if another gesture starts first
    let artGlidePending = null;

    // Pull to refresh state for the song list
    let pullArmed = false;
    let pulling = false;
    let pullStartY = 0;
    let pullDist = 0;
    let refreshing = false;

    // Small promise based delay helper
    function sleep(ms) {

        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }

    // fetch with a deadline. A request with no signal can hang until the
    // network stack finally gives up, which ties up the connection pool and
    // stalls the audio stream, so every background request uses this
    function timedFetch(resource, options, ms) {

        const opts = options || {};
        const limit = ms || 15000;

        if (typeof AbortController === "undefined") {
            return fetch(resource, opts);
        }

        const controller = new AbortController();

        const timer = setTimeout(function () {
            controller.abort();
        }, limit);

        const merged = Object.assign({}, opts, { signal: controller.signal });

        return fetch(resource, merged).finally(function () {
            clearTimeout(timer);
        });
    }

    // Read the cache from localStorage, return an empty cache on failure
    function loadCache() {

        try {
            const raw = localStorage.getItem(feed().cacheKey);

            if (raw) {

                const parsed = JSON.parse(raw);

                // Fill in fields that older cache versions may be missing
                if (!Array.isArray(parsed.songs)) {
                    parsed.songs = [];
                }

                // Re-trim so old caches shed dropped fields on their next save
                // Skip anything not a real song so one bad entry cannot throw here
                parsed.songs = parsed.songs.filter(function (s) {
                    return s && s.song_id !== undefined && s.song_id !== null;
                }).map(trim);

                if (typeof parsed.complete !== "boolean") {
                    parsed.complete = false;
                }

                if (parsed.lastCursor === undefined) {
                    parsed.lastCursor = null;
                }

                mergeLegacyPublished(parsed);

                return parsed;
            }
        } catch (e) {
        }

        const empty = { songs: [], updated: 0, complete: false, lastCursor: null };

        mergeLegacyPublished(empty);

        return empty;
    }

    // Published used to be a separate feed with its own cache, which may hold
    // songs this one has not paged back to yet. Fold those in once so nothing
    // disappears on upgrade, then drop the old key. Only your own library has a
    // legacy cache, a creator feed never did
    function mergeLegacyPublished(target) {

        if (creatorSource) {
            return;
        }

        try {

            const raw = localStorage.getItem(LEGACY_PUBLISHED_KEY);

            if (!raw) {
                return;
            }

            const old = JSON.parse(raw);
            const songs = Array.isArray(old && old.songs) ? old.songs : [];

            const known = new Set(target.songs.map(function (s) {
                return s.song_id;
            }));

            let added = 0;

            for (const s of songs) {

                if (!isUsableSong(s) || known.has(s.song_id)) {
                    continue;
                }

                known.add(s.song_id);
                target.songs.push(trim(s));
                added += 1;
            }

            // Merged songs came from the published feed, so the combined list is
            // no longer a complete page run and should be scanned again
            if (added > 0) {

                target.complete = false;
                target.lastCursor = null;
            }

            localStorage.removeItem(LEGACY_PUBLISHED_KEY);
        } catch (e) {
        }
    }

    // Remove every other creator cache, freeing space for the active one
    // The own feed caches and the active key are kept
    function pruneCreatorCaches(keepKey) {

        try {
            const remove = [];

            for (let i = 0; i < localStorage.length; i += 1) {

                const k = localStorage.key(i);

                if (k && k.indexOf("mureka_autoload_creator_") === 0 && k !== keepKey) {
                    remove.push(k);
                }
            }

            remove.forEach(function (k) {
                localStorage.removeItem(k);
            });
        } catch (e) {
        }
    }

    // Persist the cache to localStorage
    // If storage is full, drop other creator caches and retry once so the
    // active library always saves and survives a restart
    function saveCache() {

        const key = feed().cacheKey;
        const payload = JSON.stringify(cache);

        try {
            localStorage.setItem(key, payload);
            return;
        } catch (e) {
        }

        pruneCreatorCaches(key);

        try {
            localStorage.setItem(key, payload);
        } catch (e) {
        }
    }

    // Read the settings from localStorage, falling back to safe defaults
    // Published is the default start feed, refresh on open is off for both feeds
    // Autoplay is off, the default play mode is not shuffled, repeat is all
    function loadSettings() {

        const defaults = {
            startFeed: "published",
            refreshOnStart: false,
            absoluteNumbers: false,
            autoPlay: false,
            shuffle: false,
            repeat: "all",
            prefetchCount: PREFETCH_DEFAULT,
            vocalFilter: "all",
            view: "mureka",
            reportPlays: true,
            artTest: false,
            artOverlayMode: "all",
            directAudio: true,
            remoteArtwork: false,
            artOnResume: false,
            controlOrder: "repeat,shuffle,stop,play",
            controlLabels: false,
            tagGenres: [],
            tagMoods: [],
            tagMode: "and",
            tagSort: "count",
            tagModels: [],
            dateEnabled: false,
            dateMode: "age",
            dateField: "created",
            dateAgeValue: 4,
            dateAgeUnit: "weeks",
            dateFrom: "",
            dateTo: "",
            ratingEnabled: false,
            ratingMin: 1,
            ratingUnrated: "hide",
            artStars: true,
            smartEnabled: true,
            bpmEnabled: false,
            bpmMin: 0,
            bpmMax: 0,
            bpmUnknown: "any",
            carBlackout: false,
            carGate: false,
            carAutoBlack: 20,
            blackoutText: "\u266B",
            blackoutColor: "#333333",
            blackoutSize: 64,
            blackoutDrift: 25,
            countsMaxAge: 4,
            waveSeek: true,
            lyricSize: 18,
            lyricSideMul: 0.8,
            lyricLineMul: 1.5,
            lyricShift: 0,
            lyricSideShift: 0,
            metaTitle: "${title}",
            metaSubtitle: "${genre}",
            debugLine: false
        };

        try {
            const raw = localStorage.getItem(SETTINGS_KEY);

            if (raw) {

                const parsed = JSON.parse(raw);
                // Used to be one flag per feed. With a single library either
                // of them meaning yes still means yes
                const ros = parsed.refreshOnStart;
                const refreshOnStart = (ros === true)
                    || (ros !== null && typeof ros === "object"
                        && (ros.published === true || ros.all === true));
                const repeat = (parsed.repeat === "one" || parsed.repeat === "none")
                    ? parsed.repeat
                    : "all";

                let prefetchCount = parseInt(parsed.prefetchCount, 10);

                if (!isFinite(prefetchCount) || prefetchCount < 0) {
                    prefetchCount = PREFETCH_DEFAULT;
                }

                if (prefetchCount > 50) {
                    prefetchCount = 50;
                }

                const vocalFilter = (parsed.vocalFilter === "vocal"
                    || parsed.vocalFilter === "instrumental")
                    ? parsed.vocalFilter
                    : "all";

                // Remembered list view, one of mureka, queue or alpha
                const view = (parsed.view === "queue" || parsed.view === "alpha")
                    ? parsed.view
                    : "mureka";

                return {
                    startFeed: parsed.startFeed === "all" ? "all" : "published",
                    refreshOnStart: refreshOnStart,
                    absoluteNumbers: parsed.absoluteNumbers === true,
                    autoPlay: parsed.autoPlay === true,
                    shuffle: parsed.shuffle === true,
                    repeat: repeat,
                    prefetchCount: prefetchCount,
                    vocalFilter: vocalFilter,
                    view: view,
                    reportPlays: parsed.reportPlays !== false,
                    artTest: parsed.artTest === true,
                    artOverlayMode: ["none", "info", "all"].indexOf(parsed.artOverlayMode) !== -1
                        ? parsed.artOverlayMode
                        : (parsed.lyricsOn === false ? "info" : "all"),
                    directAudio: parsed.directAudio !== false,
                    remoteArtwork: parsed.remoteArtwork === true,
                    artOnResume: parsed.artOnResume === true,
                    controlLabels: parsed.controlLabels === true,
                    tagGenres: Array.isArray(parsed.tagGenres) ? parsed.tagGenres : [],
                    tagMoods: Array.isArray(parsed.tagMoods) ? parsed.tagMoods : [],
                    tagMode: parsed.tagMode === "or" ? "or" : "and",
                    tagSort: parsed.tagSort === "alpha" ? "alpha" : "count",
                    tagModels: Array.isArray(parsed.tagModels) ? parsed.tagModels : [],
                    dateEnabled: parsed.dateEnabled === true,
                    dateMode: parsed.dateMode === "range" ? "range" : "age",
                    dateField: parsed.dateField === "published" ? "published" : "created",
                    dateAgeValue: (typeof parsed.dateAgeValue === "number"
                        && parsed.dateAgeValue >= 1 && parsed.dateAgeValue <= 999)
                        ? parsed.dateAgeValue : 4,
                    dateAgeUnit: (parsed.dateAgeUnit === "days" || parsed.dateAgeUnit === "months")
                        ? parsed.dateAgeUnit : "weeks",
                    dateFrom: isDayString(parsed.dateFrom) ? parsed.dateFrom : "",
                    dateTo: isDayString(parsed.dateTo) ? parsed.dateTo : "",
                    ratingEnabled: parsed.ratingEnabled === true,
                    ratingMin: (typeof parsed.ratingMin === "number"
                        && parsed.ratingMin >= 0 && parsed.ratingMin <= 5)
                        ? parsed.ratingMin : 1,
                    ratingUnrated: (parsed.ratingUnrated === "any" || parsed.ratingUnrated === "only")
                        ? parsed.ratingUnrated : "hide",
                    artStars: parsed.artStars !== false,
                    smartEnabled: parsed.smartEnabled !== false,
                    bpmEnabled: parsed.bpmEnabled === true,
                    bpmMin: typeof parsed.bpmMin === "number" ? parsed.bpmMin : 0,
                    bpmMax: typeof parsed.bpmMax === "number" ? parsed.bpmMax : 0,
                    bpmUnknown: (parsed.bpmUnknown === "hide" || parsed.bpmUnknown === "only")
                        ? parsed.bpmUnknown
                        : (parsed.bpmHideUnknown === true ? "hide" : "any"),
                    controlOrder: typeof parsed.controlOrder === "string" && parsed.controlOrder
                        ? parsed.controlOrder
                        : "repeat,shuffle,stop,play",
                    carBlackout: parsed.carBlackout === true,
                    carGate: parsed.carGate === true,
                    carAutoBlack: (typeof parsed.carAutoBlack === "number"
                        && parsed.carAutoBlack >= 0 && parsed.carAutoBlack <= 300)
                        ? parsed.carAutoBlack : 20,
                    blackoutText: typeof parsed.blackoutText === "string"
                        ? parsed.blackoutText : "\u266B",
                    blackoutColor: typeof parsed.blackoutColor === "string"
                        ? parsed.blackoutColor : "#333333",
                    blackoutSize: (typeof parsed.blackoutSize === "number"
                        && parsed.blackoutSize >= 12 && parsed.blackoutSize <= 240)
                        ? parsed.blackoutSize : 64,
                    blackoutDrift: (typeof parsed.blackoutDrift === "number"
                        && parsed.blackoutDrift >= 5 && parsed.blackoutDrift <= 120)
                        ? parsed.blackoutDrift : 25,
                    countsMaxAge: (typeof parsed.countsMaxAge === "number"
                        && parsed.countsMaxAge >= 1 && parsed.countsMaxAge <= 72)
                        ? parsed.countsMaxAge : 4,
                    waveSeek: parsed.waveSeek !== false,
                    lyricSize: (typeof parsed.lyricSize === "number" && parsed.lyricSize >= 12 && parsed.lyricSize <= 30)
                        ? parsed.lyricSize : 18,
                    lyricSideMul: (typeof parsed.lyricSideMul === "number" && parsed.lyricSideMul >= 0.5 && parsed.lyricSideMul <= 1)
                        ? parsed.lyricSideMul : 0.8,
                    lyricLineMul: (typeof parsed.lyricLineMul === "number" && parsed.lyricLineMul >= 1 && parsed.lyricLineMul <= 2)
                        ? parsed.lyricLineMul : 1.5,
                    lyricShift: (typeof parsed.lyricShift === "number" && parsed.lyricShift >= -30 && parsed.lyricShift <= 30)
                        ? parsed.lyricShift : 0,
                    lyricSideShift: (typeof parsed.lyricSideShift === "number" && parsed.lyricSideShift >= -20 && parsed.lyricSideShift <= 20)
                        ? parsed.lyricSideShift : 0,
                    metaTitle: typeof parsed.metaTitle === "string"
                        ? parsed.metaTitle
                        : "${title}",
                    metaSubtitle: typeof parsed.metaSubtitle === "string"
                        ? parsed.metaSubtitle
                        : "${genre}",
                    debugLine: parsed.debugLine === true
                };
            }
        } catch (e) {
        }

        return defaults;
    }

    // Persist the settings object to localStorage
    function saveSettings() {

        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
        }
    }

    // Read the set of downloaded song_ids from localStorage
    function loadDownloadedIds() {

        try {
            const raw = localStorage.getItem(DOWNLOADED_KEY);

            if (raw) {
                return new Set(JSON.parse(raw));
            }
        } catch (e) {
        }

        return new Set();
    }

    // Persist the set of downloaded song_ids
    function saveDownloadedIds() {

        try {
            localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(Array.from(downloadedIds)));
        } catch (e) {
        }
    }

    // Read the remembered logged in user id, or null when not learned yet
    function loadSelfUserId() {

        try {
            const raw = localStorage.getItem(SELF_KEY);

            if (raw) {
                return raw;
            }
        } catch (e) {
        }

        return null;
    }

    // Read creators added by hand, an array of {user_id, stage_name}
    function loadSavedCreators() {

        try {
            const raw = localStorage.getItem(CREATORS_KEY);

            if (raw) {

                const parsed = JSON.parse(raw);

                if (Array.isArray(parsed)) {
                    return parsed;
                }
            }
        } catch (e) {
        }

        return [];
    }

    // Persist the hand added creators list
    function saveSavedCreators() {

        try {
            localStorage.setItem(CREATORS_KEY, JSON.stringify(savedCreators));
        } catch (e) {
        }
    }

    // Add a creator to the saved list if it is not already there
    function addSavedCreator(userId, name) {

        const id = String(userId);

        const exists = savedCreators.some(function (c) {
            return String(c.user_id) === id;
        });

        if (!exists) {
            savedCreators.push({ user_id: id, stage_name: name || ("User " + id) });
            saveSavedCreators();
        }
    }

    // Remove a creator from the saved list by id
    function removeSavedCreator(userId) {

        const id = String(userId);

        savedCreators = savedCreators.filter(function (c) {
            return String(c.user_id) !== id;
        });

        saveSavedCreators();
    }

    // Learn the logged in user id from your own feed response the first time
    // Only called outside creator mode, where every feed item is yours
    function recordSelfUserId(root) {

        if (selfUserId !== null) {
            return;
        }

        try {
            const data = root && root.data;

            if (!data) {
                return;
            }

            // The own feed family carries items under feeds, some under list
            const arrays = [data.feeds, data.list];

            for (const arr of arrays) {

                if (Array.isArray(arr)) {

                    for (const f of arr) {

                        if (f && f.user && f.user.user_id) {
                            selfUserId = String(f.user.user_id);
                            localStorage.setItem(SELF_KEY, selfUserId);
                            return;
                        }
                    }
                }
            }

            // Fallback, your own songs store files under a path with your id
            // This catches feeds that omit the user object on your own songs
            const m = JSON.stringify(root).match(/files\/(\d{6,})\//);

            if (m) {
                selfUserId = m[1];
                localStorage.setItem(SELF_KEY, selfUserId);
            }
        } catch (e) {
        }
    }

    // Resolve the logged in user id on demand by probing your own feed
    // This lets the picker map your own profile to your library before a Load
    async function ensureSelfUserId() {

        if (selfUserId !== null) {
            return selfUserId;
        }

        try {
            const params = new URLSearchParams();

            params.set("time", String(Date.now()));
            params.set("t", OWN_FEED.t);
            params.set("size", "20");
            params.set("query_type", OWN_FEED.queryType);
            params.set("listRenderType", OWN_FEED.queryType);

            const url = OWN_FEED.endpoint + "?" + params.toString();
            const res = await timedFetch(url, { credentials: "include" });

            if (res.ok) {

                const json = await res.json();

                recordSelfUserId(json);
            }
        } catch (e) {
        }

        return selfUserId;
    }

    // Reopen on the last browsed source without ever forcing a full reload
    // A remembered creator is restored only from its cache, never loaded fresh
    function applyStartupSource() {

        if (!startupSource || startupSource.kind !== "creator") {

            // Own feed, the filter and cache were already set at init
            return;
        }

        // Your own profile is just your own library, never a separate creator view
        if (selfUserId !== null && String(startupSource.user_id) === String(selfUserId)) {
            return;
        }

        creatorSource = { user_id: startupSource.user_id, stage_name: startupSource.stage_name };

        // A creator has no access to your playlists, so drop the filter
        activePlaylist = null;
        updatePlaylistButton();

        const creatorCache = loadCache();

        // Restore the creator only when its songs are cached, never reload here
        if (creatorCache.songs.length > 0) {

            cache = creatorCache;
            cachedIds = new Set();

            updateCreatorButton();
            updateFeedButton();
            renderList();
            refreshCachedIds();

            const n = cache.songs.length;

            setStatus("Browsing " + creatorSource.stage_name + ", " + n
                + " cached song" + (n === 1 ? "" : "s"));

        } else {

            // No cached songs for this creator, stay on your own library
            creatorSource = null;
            updateCreatorButton();
            updateFeedButton();
        }
    }

    // Persist which source is showing now, your own feed or a creator
    function saveSource() {

        try {
            let data;

            if (creatorSource) {

                data = {
                    kind: "creator",
                    user_id: creatorSource.user_id,
                    stage_name: creatorSource.stage_name
                };

            } else {

                data = { kind: "feed", feed: publishFilter };
            }

            localStorage.setItem(SOURCE_KEY, JSON.stringify(data));
        } catch (e) {
        }
    }

    // Read the remembered source, returning null when there is none or it is bad
    function loadSource() {

        try {
            const raw = localStorage.getItem(SOURCE_KEY);

            if (raw) {

                const p = JSON.parse(raw);

                if (p && p.kind === "creator" && p.user_id) {

                    return {
                        kind: "creator",
                        user_id: String(p.user_id),
                        stage_name: p.stage_name || ("User " + p.user_id)
                    };
                }

                if (p && p.kind === "feed") {

                    return { kind: "feed", feed: p.feed === "all" ? "all" : "published" };
                }
            }
        } catch (e) {
        }

        return null;
    }

    // Persist the current queue so it survives a restart
    // Falls back to the resume state when nothing is live, as after Stop
    function saveQueue() {

        try {
            let q = queue;
            let pos = queuePos;

            // Use the live position while playing, otherwise keep the resume time
            // so closing before pressing Play does not reset it to the start
            let time = 0;

            if (audio && audio.src && isFinite(audio.currentTime)) {
                time = audio.currentTime;
            } else if (resumeState && resumeState.time) {
                time = resumeState.time;
            }

            // After Stop the live queue is empty, persist the resume point instead
            if ((pos < 0 || q.length === 0) && resumeState && resumeState.queue.length) {
                q = resumeState.queue;
                pos = resumeState.queuePos;
                time = resumeState.time || 0;
            }

            if (pos < 0 || pos >= q.length || q.length === 0) {
                localStorage.removeItem(QUEUE_KEY);
                return;
            }

            const cur = q[pos];

            localStorage.setItem(QUEUE_KEY, JSON.stringify({
                ids: q.map(function (s) {
                    return s.song_id;
                }),
                currentId: cur ? cur.song_id : null,
                pos: pos,
                time: time,
                shuffle: shuffleMode
            }));
        } catch (e) {
        }
    }

    // Rebuild the saved queue from the songs now loaded, ready to resume on Play
    // Songs no longer present are dropped, the position follows the saved song
    function restoreQueue() {

        let saved = null;

        try {
            saved = JSON.parse(localStorage.getItem(QUEUE_KEY));
        } catch (e) {
        }

        if (!saved || !Array.isArray(saved.ids) || saved.ids.length === 0) {
            return;
        }

        const byId = new Map(cache.songs.map(function (s) {
            return [s.song_id, s];
        }));

        const rebuilt = [];

        saved.ids.forEach(function (id) {

            const s = byId.get(id);

            if (s) {
                rebuilt.push(s);
            }
        });

        // None of the saved songs are in this library, so this queue is not ours
        if (rebuilt.length === 0) {
            return;
        }

        queue = rebuilt;

        // Point at the saved current song, falling back to the saved index
        let pos = 0;

        if (saved.currentId !== undefined && saved.currentId !== null) {

            const i = queue.findIndex(function (s) {
                return s.song_id === saved.currentId;
            });

            if (i !== -1) {
                pos = i;
            }
        } else if (typeof saved.pos === "number") {
            pos = saved.pos;
        }

        if (pos < 0) {
            pos = 0;
        }

        if (pos >= queue.length) {
            pos = queue.length - 1;
        }

        queuePos = pos;

        // Restore the shuffle state the queue was built with
        if (typeof saved.shuffle === "boolean" && saved.shuffle !== shuffleMode) {
            shuffleMode = saved.shuffle;
            updateShuffleButton();
        }

        // Show the song as loaded and paused, Play resumes it at the saved time
        currentSong = queue[queuePos];
        resumeState = { queue: queue, queuePos: queuePos, time: saved.time || 0 };

        updatePlayerInfo(currentSong);
        renderList();
        scrollToPlaying();

        setStatus("Resumed queue, press play to continue");
    }

    // Refresh the active feed on open when the user has asked for it
    // This only checks the top for new songs, it never re-pages the library
    function maybeAutoRefresh() {

        if (settings.refreshOnStart) {
            run(true);
        }
    }

    // Start playback on open when the user has asked for it and songs exist
    function maybeAutoPlay() {

        if (settings.autoPlay && cache.songs.length > 0) {
            startPlay();
        }
    }

    // A song still being generated comes back with no length yet. It has no
    // audio to play and its details are not final, so it is skipped on the way
    // into the library and picked up by a later load once it has finished
    function isUsableSong(s) {

        if (!s || s.song_id === undefined || s.song_id === null) {
            return false;
        }

        return typeof s.duration_milliseconds === "number" && s.duration_milliseconds > 0;
    }

    // Keep only the fields we actually need, to save space
    // description is not used anywhere, so it is dropped
    function trim(s) {

        // The feed is the only response carrying the waveform, so persist it
        // here before it is trimmed away. The store skips already saved songs
        if (Array.isArray(s.wave_list) && s.wave_list.length > 0) {
            saveWaveToStore(s.song_id, s.wave_list);
        }

        return {
            song_id: s.song_id,
            title: s.title,
            genres: s.genres,
            moods: s.moods,
            duration_milliseconds: s.duration_milliseconds,
            mp3_url: s.mp3_url,
            cover: s.cover,
            share_key: s.share_key,
            generate_at: s.generate_at,
            publish_state: s.publish_state,
            publish_at: s.publish_at,
            is_liked: s.is_liked === true,
            model: s.model,
            bpm: s.bpm,
            generation_method: s.generation_method
        };
    }

    // Song ids the user marked as instrumental by hand, loaded once on startup
    let manualInstrumental = loadManualInstrumental();

    // song_id to bpm, for tempos filled in by hand
    let manualBpm = loadManualBpm();

    function loadManualBpm() {

        try {

            const raw = JSON.parse(localStorage.getItem(MANUAL_BPM_KEY));

            if (raw && typeof raw === "object") {

                const map = new Map();

                for (const key of Object.keys(raw)) {

                    const value = Number(raw[key]);

                    if (isFinite(value) && value > 0) {
                        map.set(String(key), value);
                    }
                }

                return map;
            }
        } catch (e) {
        }

        return new Map();
    }

    function saveManualBpm() {

        try {

            const out = {};

            manualBpm.forEach(function (value, key) {
                out[key] = value;
            });

            localStorage.setItem(MANUAL_BPM_KEY, JSON.stringify(out));
        } catch (e) {
        }
    }

    // The tempo to use for a song, the hand entered one when there is one
    function effectiveBpm(song) {

        const manual = manualBpm.get(String(song.song_id));

        if (isFinite(manual) && manual > 0) {
            return manual;
        }

        const bpm = Number(song.bpm);

        return isFinite(bpm) && bpm > 0 ? bpm : 0;
    }

    // Whether this song's tempo was supplied by hand
    function hasManualBpm(song) {

        return manualBpm.has(String(song.song_id));
    }

    // Ask for a tempo and keep it, or clear one that was set before
    function promptManualBpm(song) {

        const current = effectiveBpm(song);
        const answer = window.prompt("BPM for " + (song.title || "Untitled"),
            current > 0 ? String(current) : "");

        if (answer === null) {
            return;
        }

        const typed = String(answer).trim();

        // Emptying the field is how a hand entered tempo is taken away again
        if (typed === "") {

            if (!hasManualBpm(song)) {
                return;
            }

            manualBpm.delete(String(song.song_id));
            saveManualBpm();
            refreshAfterBpmChange(song);
            setStatus("BPM cleared for " + (song.title || "Untitled"));

            return;
        }

        const value = Number(typed);

        if (!isFinite(value) || value <= 0) {

            setStatus("Not a tempo, nothing changed");
            return;
        }

        manualBpm.set(String(song.song_id), Math.round(value));
        saveManualBpm();
        refreshAfterBpmChange(song);
        setStatus("BPM set to " + Math.round(value) + " for " + (song.title || "Untitled"));
    }

    // A tempo change moves the song in and out of the tempo filter, and shows
    // up in the meta line and the info panel, so all of those are redrawn
    function refreshAfterBpmChange(song) {

        applySmartFilters();

        if (currentSong && currentSong.song_id === song.song_id) {
            updatePlayerInfo(currentSong);
        }
    }

    // song_id to a whole number of stars, loaded once on startup
    let ratings = loadRatings();

    function loadRatings() {

        try {

            const raw = JSON.parse(localStorage.getItem(RATING_KEY));

            if (raw && typeof raw === "object") {

                const map = new Map();

                for (const key of Object.keys(raw)) {

                    const value = Number(raw[key]);

                    if (isFinite(value) && value >= 0 && value <= 5) {
                        map.set(String(key), Math.round(value));
                    }
                }

                return map;
            }
        } catch (e) {
        }

        return new Map();
    }

    function saveRatings() {

        try {

            const out = {};

            ratings.forEach(function (value, key) {
                out[key] = value;
            });

            localStorage.setItem(RATING_KEY, JSON.stringify(out));
        } catch (e) {
        }
    }

    // A song's rating, 0 to 5, or null when it has never been rated
    function getRating(song) {

        const r = ratings.get(String(song.song_id));

        return typeof r === "number" ? r : null;
    }

    // Set a rating, or pass null to take the song back to not rated
    function setRating(song, value) {

        const id = String(song.song_id);

        if (value === null) {
            ratings.delete(id);
        } else {
            ratings.set(id, Math.max(0, Math.min(5, Math.round(value))));
        }

        saveRatings();
        afterRatingChange(song);
    }

    // The rating in words, for captions and the info panel
    function ratingText(r) {

        if (r === null) {
            return "Not rated";
        }

        if (r === 0) {
            return "Rated, no stars";
        }

        return r + (r === 1 ? " star" : " stars");
    }

    // Everything that shows a rating is brought up to date. The queue is left
    // alone on purpose, rating the playing song must not reshuffle what is
    // coming up, the filter applies again the next time the queue is built
    function afterRatingChange(song) {

        renderList();

        if (tagSheetOpen && tagSheetRefresh) {
            tagSheetRefresh();
        }

        refreshNowStars();
        updateRateButton();

        if (currentSong && currentSong.song_id === song.song_id) {

            applyCoverText(currentSong);

            // The lock screen and Bluetooth only need the update when the
            // templates actually show the stars
            if (/\$\{stars\}/.test((settings.metaTitle || "") + (settings.metaSubtitle || ""))) {
                reassertNowPlaying();
            }
        }
    }

    // One star as an SVG, painted later by paintStar
    function makeStarSvg(size) {

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");

        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.style.display = "block";

        const path = document.createElementNS(ns, "path");

        path.setAttribute("d", "M12 2.6l2.83 5.9 6.47.78-4.77 4.47 1.24 6.43L12 17.02"
            + "l-5.77 3.16 1.24-6.43L2.7 9.28l6.47-.78z");
        path.setAttribute("stroke-width", "1.6");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");

        svg.appendChild(path);
        svg.starPath = path;

        return svg;
    }

    // Lit stars are filled gold. Unlit ones are outlined, gold once the song
    // has been rated at all and grey while it has not
    function paintStar(svg, lit, rated) {

        svg.starPath.setAttribute("fill", lit ? STAR_GOLD : "none");
        svg.starPath.setAttribute("stroke", (lit || rated) ? STAR_GOLD : STAR_EMPTY);
    }

    // A row of five tappable stars for whichever song getSong returns. A tap
    // lights that star and every one before it. Tapping the top lit star again
    // sets zero stars, and the caption offers the way back to not rated.
    // opts.size is the star size, opts.pad the extra tap area around each,
    // opts.caption adds the state line underneath
    function makeStarBar(getSong, opts) {

        const size = opts.size || 24;
        const pad = typeof opts.pad === "number" ? opts.pad : 6;

        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px";

        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:center";

        const stars = [];

        let caption = null;
        let captionText = null;
        let clearBtn = null;

        const paint = function () {

            const song = getSong();
            const r = song ? getRating(song) : null;

            for (let i = 0; i < stars.length; i += 1) {
                paintStar(stars[i], r !== null && i < r, r !== null);
            }

            if (caption) {

                captionText.textContent = song ? ratingText(r) : "";
                clearBtn.style.display = r === null ? "none" : "inline";
            }
        };

        for (let n = 1; n <= 5; n += 1) {

            const btn = document.createElement("button");

            btn.type = "button";
            btn.setAttribute("aria-label", n + (n === 1 ? " star" : " stars"));
            btn.style.cssText = [
                "background:transparent",
                "border:none",
                "margin:0",
                "padding:" + pad + "px",
                "line-height:0",
                "cursor:pointer",
                "touch-action:manipulation",
                "-webkit-tap-highlight-color:transparent"
            ].join(";");

            const svg = makeStarSvg(size);

            btn.appendChild(svg);
            stars.push(svg);

            btn.addEventListener("click", function (ev) {

                // Keep the menu open and the art from treating it as a tap
                ev.preventDefault();
                ev.stopPropagation();

                const song = getSong();

                if (!song) {
                    return;
                }

                const current = getRating(song);

                setRating(song, current === n ? 0 : n);
                paint();
            });

            row.appendChild(btn);
        }

        wrap.appendChild(row);

        if (opts.caption) {

            caption = document.createElement("div");
            caption.style.cssText = "display:flex;align-items:center;gap:10px;font-size:12px;color:#aaa";

            captionText = document.createElement("span");

            clearBtn = document.createElement("span");
            clearBtn.textContent = "Remove rating";
            clearBtn.style.cssText = "color:#48e1eb;cursor:pointer;text-decoration:underline";

            clearBtn.addEventListener("click", function (ev) {

                ev.preventDefault();
                ev.stopPropagation();

                const song = getSong();

                if (song) {

                    setRating(song, null);
                    paint();
                }
            });

            caption.appendChild(captionText);
            caption.appendChild(clearBtn);
            wrap.appendChild(caption);
        }

        // Taps between the stars must not close a menu around the bar either
        wrap.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });

        paint();

        return { el: wrap, paint: paint };
    }

    // The star row over the cover for the playing song, and the transport
    // button that opens the large rating popup, both built with the panel
    let nowStarsBar = null;
    let rateCtrlBtn = null;
    let rateIconSvg = null;

    // Show the cover stars for the playing song, or hide them
    function refreshNowStars() {

        if (!nowStarsBar) {
            return;
        }

        const show = settings.artStars === true && !!currentSong;

        nowStarsBar.el.style.display = show ? "flex" : "none";

        if (show) {
            nowStarsBar.paint();
        }
    }

    // The rate button icon follows the playing song's rating
    function updateRateButton() {

        if (!rateIconSvg) {
            return;
        }

        const r = currentSong ? getRating(currentSong) : null;

        if (r === null) {

            rateIconSvg.starPath.setAttribute("fill", "none");
            rateIconSvg.starPath.setAttribute("stroke", "currentColor");

        } else {
            paintStar(rateIconSvg, r > 0, true);
        }

        updateControlLabels();
    }

    // A popup holding only the large star bar, opened from the rate button
    // for the playing song. It reuses the options popup and closes the same
    // way, with a tap anywhere else
    function showRatingPopup(anchor, song) {

        if (!contextMenuEl || !song) {
            return;
        }

        contextMenuEl.textContent = "";

        const title = document.createElement("div");
        title.textContent = song.title || "Untitled";
        title.style.cssText = "padding:6px 8px 0;font-weight:600;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";

        const bar = makeStarBar(function () {
            return song;
        }, { size: 36, pad: 7, caption: true });

        bar.el.style.padding = "6px 4px 8px";

        contextMenuEl.appendChild(title);
        contextMenuEl.appendChild(bar.el);

        // Measure the width only after the title has room to be read
        title.style.maxWidth = Math.min(320, window.innerWidth - 32) + "px";

        contextMenuEl.style.display = "block";

        const r = anchor.getBoundingClientRect();
        const w = contextMenuEl.offsetWidth;
        const h = contextMenuEl.offsetHeight;

        let left = r.left + r.width / 2 - w / 2;

        left = Math.max(8, Math.min(left, window.innerWidth - w - 8));

        // Above the button, or below it when there is no room above
        let top = r.top - h - 8;

        if (top < 8) {
            top = Math.min(r.bottom + 8, window.innerHeight - h - 8);
        }

        contextMenuEl.style.left = left + "px";
        contextMenuEl.style.top = Math.max(8, top) + "px";
    }

    function loadManualInstrumental() {

        try {

            const raw = JSON.parse(localStorage.getItem(MANUAL_INSTRUMENTAL_KEY));

            if (Array.isArray(raw)) {
                return new Set(raw.map(String));
            }
        } catch (e) {
        }

        return new Set();
    }

    function saveManualInstrumental() {

        try {
            localStorage.setItem(MANUAL_INSTRUMENTAL_KEY,
                JSON.stringify(Array.from(manualInstrumental)));
        } catch (e) {
        }
    }

    // Whether the user marked this song as instrumental by hand
    function isManualInstrumental(song) {

        return manualInstrumental.has(String(song.song_id));
    }

    // Flip the manual instrumental mark and remember it across restarts
    function toggleManualInstrumental(song) {

        const id = String(song.song_id);

        if (manualInstrumental.has(id)) {

            manualInstrumental.delete(id);
            setStatus("No longer marked instrumental: " + (song.title || "Untitled"));

        } else {

            manualInstrumental.add(id);
            setStatus("Marked as instrumental: " + (song.title || "Untitled"));
        }

        saveManualInstrumental();
        renderList();

        // The now playing meta line shows the instrumental tag, and the lyric
        // rows appear or disappear with the mark
        if (currentSong && currentSong.song_id === song.song_id) {

            refreshNowPlayingMeta();
            updateLyricLine(true);
        }
    }

    // True when a song has no vocals
    // Mureka encodes this as generation_method 7, every other value, including
    // the remix and studio methods, counts as having vocals. A song the user
    // marked by hand counts as instrumental whatever the server says
    function isInstrumental(song) {

        return song.generation_method === 7 || isManualInstrumental(song);
    }

    // Whether a song passes the current vocals filter
    // all shows everything, vocal hides instrumentals, instrumental shows only them
    function passesVocalFilter(song) {

        if (settings.vocalFilter === "vocal") {
            return !isInstrumental(song);
        }

        if (settings.vocalFilter === "instrumental") {
            return isInstrumental(song);
        }

        return true;
    }

    // Whether a song belongs to the active playlist
    // With no active playlist the whole library passes
    function passesPlaylist(song) {

        if (!activePlaylist) {
            return true;
        }

        return activePlaylist.ids.has(song.song_id);
    }

    // Whether a song passes every active filter, vocals and playlist together
    // True when the song passes the published filter. Creator libraries are
    // published by definition, so the filter only applies to your own songs
    function passesPublishFilter(song) {

        if (creatorSource || publishFilter !== "published") {
            return true;
        }

        return song.publish_state === 1;
    }

    // The smart filter sheet, built the first time it is opened
    let tagSheetEl = null;
    let tagSheetOpen = false;
    let tagSheetRefresh = null;

    // How many of each list are shown as top used before the rest
    const TAG_TOP_COUNT = 10;

    // Everything a tag or bpm change has to touch, in one place
    function applySmartFilters() {

        saveSettings();
        updateFilterButtons();
        updateSmartFilterButton();
        updateViewMenuBar();
        renderList();
        rebuildUpcoming();

        if (tagSheetRefresh) {
            tagSheetRefresh();
        }
    }

    function openTagSheet() {

        if (!tagSheetEl) {
            buildTagSheet();
        }

        closeViewMenu();
        tagSheetOpen = true;
        tagSheetEl.style.display = "flex";

        if (tagSheetRefresh) {
            tagSheetRefresh();
        }
    }

    function closeTagSheet() {

        tagSheetOpen = false;

        if (tagSheetEl) {
            tagSheetEl.style.display = "none";
        }
    }

    // A tag list. Rows are drawn rather than using a native checkbox, which
    // styles differently on every platform and was awkward to hit, and the
    // whole row is the target
    function buildTagList(kind, getSelected) {

        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;gap:6px";

        const heading = document.createElement("div");
        // Models are single valued per song, so ticking several means any of
        // them, whatever the match setting says for genres and moods
        const headings = {
            genres: "Genres",
            moods: "Moods",
            models: "Models, any of the ticked"
        };

        heading.textContent = headings[kind] || kind;
        heading.style.cssText = "color:#bbb";

        const box = document.createElement("div");
        box.style.cssText = "max-height:220px;overflow:auto;display:flex;flex-direction:column;border:1px solid #3a3a42;border-radius:6px;padding:4px;background:#26262c";

        const makeRow = function (name, total) {

            const on = getSelected().indexOf(name) !== -1;

            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:6px;cursor:pointer;"
                + (on ? "background:#2f3a3c" : "background:transparent");

            const tick = document.createElement("span");
            tick.textContent = on ? "\u2713" : "";
            tick.style.cssText = "flex:0 0 auto;width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font:700 13px/1 sans-serif;"
                + (on
                    ? "background:#48e1eb;color:#000;border:1px solid #48e1eb"
                    : "background:transparent;color:transparent;border:1px solid #4a4a54");

            const text = document.createElement("span");
            text.textContent = name;
            text.style.cssText = "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                + (on ? "color:#48e1eb" : "color:#fff");

            const num = document.createElement("span");
            num.textContent = String(total);
            num.style.cssText = "flex:0 0 auto;color:#888;font-variant-numeric:tabular-nums";

            row.appendChild(tick);
            row.appendChild(text);
            row.appendChild(num);

            row.addEventListener("click", function () {

                const list = getSelected();
                const at = list.indexOf(name);

                if (at === -1) {
                    list.push(name);
                } else {
                    list.splice(at, 1);
                }

                applySmartFilters();
            });

            return row;
        };

        const render = function () {

            const map = tagIndex()[kind];
            const all = Array.from(map.entries());

            // One flat list. There are few enough tags that splitting them into
            // most used and the rest only made them harder to find
            if (settings.tagSort === "alpha") {

                all.sort(function (a, b) {
                    return a[0].localeCompare(b[0]);
                });

            } else {

                all.sort(function (a, b) {
                    return b[1] - a[1] || a[0].localeCompare(b[0]);
                });
            }

            box.textContent = "";

            if (all.length === 0) {

                const empty = document.createElement("div");
                empty.textContent = "No tags";
                empty.style.cssText = "color:#888;padding:6px 4px";
                box.appendChild(empty);

                return;
            }

            for (const entry of all) {
                box.appendChild(makeRow(entry[0], entry[1]));
            }
        };

        wrap.appendChild(heading);
        wrap.appendChild(box);

        return { el: wrap, render: render };
    }

    function buildTagSheet() {

        tagSheetEl = document.createElement("div");
        tagSheetEl.style.cssText = [
            "position:absolute",
            "inset:0",
            "background:#1d1d22",
            "border-radius:10px",
            "padding:12px",
            "box-sizing:border-box",
            "overflow:auto",
            "display:none",
            "flex-direction:column",
            "gap:12px",
            "z-index:8"
        ].join(";");

        const head = document.createElement("div");
        head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const heading = document.createElement("div");
        heading.textContent = "Filters";
        heading.style.cssText = "font-weight:600";

        const doneBtn = makeButton("Done", "#48e1eb", "#000", closeTagSheet);
        doneBtn.style.flex = "0 0 auto";
        doneBtn.style.padding = "6px 14px";

        head.appendChild(heading);
        head.appendChild(doneBtn);

        // How many songs survive the current settings. Every change redraws
        // this, so an over restrictive Match all is obvious while the sheet is
        // still open rather than after closing it onto an empty list
        const countEl = document.createElement("div");
        countEl.style.cssText = "font-weight:600;font-size:15px";

        const countHintEl = document.createElement("div");
        countHintEl.style.cssText = "color:#888;font-size:12px;margin-top:-6px";

        // Park the whole thing without losing what is ticked
        const enableRow = makeBoolRow("Filters enabled",
            function () { return settings.smartEnabled; },
            function (v) { settings.smartEnabled = v; applySmartFilters(); });

        // Match all or match any, across both lists
        const modeRow = document.createElement("div");
        modeRow.style.cssText = "display:flex;gap:6px";

        const andBtn = makeButton("Match all", "#333", "#fff", function () {
            settings.tagMode = "and";
            applySmartFilters();
        });

        const orBtn = makeButton("Match any", "#333", "#fff", function () {
            settings.tagMode = "or";
            applySmartFilters();
        });

        modeRow.appendChild(andBtn);
        modeRow.appendChild(orBtn);

        // How the tag lists are ordered
        const sortRow = document.createElement("div");
        sortRow.style.cssText = "display:flex;gap:6px";

        const countSortBtn = makeButton("Popularity", "#333", "#fff", function () {
            settings.tagSort = "count";
            applySmartFilters();
        });

        const alphaSortBtn = makeButton("A to Z", "#333", "#fff", function () {
            settings.tagSort = "alpha";
            applySmartFilters();
        });

        sortRow.appendChild(countSortBtn);
        sortRow.appendChild(alphaSortBtn);

        const bpmLabel = document.createElement("div");
        bpmLabel.textContent = "Tempo";
        bpmLabel.style.cssText = "color:#bbb";

        const bpmEnableRow = makeBoolRow("Filter by tempo",
            function () { return settings.bpmEnabled; },
            function (v) { settings.bpmEnabled = v; applySmartFilters(); });

        const bpmMinRow = makeStepperRow("Lowest BPM, 0 for no limit",
            function () { return settings.bpmMin; },
            function (v) { settings.bpmMin = v; applySmartFilters(); }, 0, 300, 5);

        const bpmMaxRow = makeStepperRow("Highest BPM, 0 for no limit",
            function () { return settings.bpmMax; },
            function (v) { settings.bpmMax = v; applySmartFilters(); }, 0, 300, 5);

        const bpmUnknownLabel = document.createElement("div");
        bpmUnknownLabel.textContent = "Songs with no BPM";
        bpmUnknownLabel.style.cssText = "color:#bbb";

        const bpmUnknownRow = document.createElement("div");
        bpmUnknownRow.style.cssText = "display:flex;gap:6px";

        const unknownBtns = {};

        const makeUnknownBtn = function (mode, label) {

            const btn = makeButton(label, "#333", "#fff", function () {
                settings.bpmUnknown = mode;
                applySmartFilters();
            });

            unknownBtns[mode] = btn;
            bpmUnknownRow.appendChild(btn);
        };

        makeUnknownBtn("any", "Include");
        makeUnknownBtn("hide", "Hide");
        makeUnknownBtn("only", "Only these");

        const genreList = buildTagList("genres", function () {
            return settings.tagGenres;
        });

        const moodList = buildTagList("moods", function () {
            return settings.tagMoods;
        });

        const modelList = buildTagList("models", function () {
            return settings.tagModels;
        });

        // Date filter, either the last so many days, weeks or months, or a
        // span between two calendar days picked with the native date picker
        const dateLabel = document.createElement("div");
        dateLabel.textContent = "Date";
        dateLabel.style.cssText = "color:#bbb";

        const dateEnableRow = makeBoolRow("Filter by date",
            function () { return settings.dateEnabled; },
            function (v) { settings.dateEnabled = v; applySmartFilters(); });

        // A row of segmented buttons, one lit, kept for the refresh to paint
        const makeSegRow = function (options, get, set) {

            const row = document.createElement("div");
            row.style.cssText = "display:flex;gap:6px";

            const btns = {};

            for (const opt of options) {

                const btn = makeButton(opt[1], "#333", "#fff", function () {
                    set(opt[0]);
                    applySmartFilters();
                });

                btns[opt[0]] = btn;
                row.appendChild(btn);
            }

            const paint = function () {

                for (const k of Object.keys(btns)) {

                    const on = get() === k;

                    btns[k].style.background = on ? "#48e1eb" : "#333";
                    btns[k].style.color = on ? "#000" : "#fff";
                }
            };

            return { el: row, paint: paint };
        };

        const dateFieldRow = makeSegRow(
            [["created", "Created"], ["published", "Published"]],
            function () { return settings.dateField; },
            function (v) { settings.dateField = v; });

        const dateModeRow = makeSegRow(
            [["age", "Last"], ["range", "Between"]],
            function () { return settings.dateMode; },
            function (v) { settings.dateMode = v; });

        const dateAgeRow = makeStepperRow("How many",
            function () { return settings.dateAgeValue; },
            function (v) { settings.dateAgeValue = Math.round(v); applySmartFilters(); }, 1, 999, 1);

        const dateUnitRow = makeSegRow(
            [["days", "Days"], ["weeks", "Weeks"], ["months", "Months"]],
            function () { return settings.dateAgeUnit; },
            function (v) { settings.dateAgeUnit = v; });

        // A labelled native date field. Empty leaves that end of the span open
        const makeDayRow = function (label, key) {

            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

            const name = document.createElement("span");
            name.textContent = label;

            const input = document.createElement("input");
            input.type = "date";
            input.style.cssText = [
                "flex:0 1 auto",
                "min-width:0",
                "padding:6px 8px",
                "border:1px solid #3a3a42",
                "border-radius:6px",
                "background:#26262c",
                "color:#fff",
                "color-scheme:dark"
            ].join(";");

            // Below this size iOS zooms the page into a focused field
            input.style.font = INPUT_FONT;

            const commit = function () {

                settings[key] = isDayString(input.value) ? input.value : "";
                applySmartFilters();
            };

            input.addEventListener("change", commit);

            // Keep the site keyboard shortcuts from seeing the typing
            input.addEventListener("keydown", function (ev) {
                ev.stopPropagation();
            });

            row.appendChild(name);
            row.appendChild(input);

            return { el: row, input: input, key: key };
        };

        const dateFromRow = makeDayRow("From", "dateFrom");
        const dateToRow = makeDayRow("To", "dateTo");

        const dateClearRow = document.createElement("div");
        dateClearRow.style.cssText = "display:flex;gap:6px";

        dateClearRow.appendChild(makeButton("Clear dates", "#333", "#fff", function () {

            settings.dateFrom = "";
            settings.dateTo = "";
            applySmartFilters();
        }));

        // Rating filter, a minimum number of stars, with songs never rated
        // handled separately from songs rated zero stars
        const ratingLabel = document.createElement("div");
        ratingLabel.textContent = "Rating";
        ratingLabel.style.cssText = "color:#bbb";

        const ratingEnableRow = makeBoolRow("Filter by rating",
            function () { return settings.ratingEnabled; },
            function (v) { settings.ratingEnabled = v; applySmartFilters(); });

        const ratingMinRow = makeStepperRow("Minimum stars",
            function () { return settings.ratingMin; },
            function (v) { settings.ratingMin = Math.round(v); applySmartFilters(); }, 0, 5, 1);

        const ratingUnratedLabel = document.createElement("div");
        ratingUnratedLabel.textContent = "Songs not yet rated";
        ratingUnratedLabel.style.cssText = "color:#bbb";

        const ratingUnratedRow = makeSegRow(
            [["any", "Include"], ["hide", "Hide"], ["only", "Only these"]],
            function () { return settings.ratingUnrated; },
            function (v) { settings.ratingUnrated = v; });

        const clearRow = document.createElement("div");
        clearRow.style.cssText = "display:flex;gap:6px";

        clearRow.appendChild(makeButton("Clear all filters", "#444", "#fff", function () {

            settings.tagGenres = [];
            settings.tagMoods = [];
            settings.tagModels = [];
            settings.bpmMin = 0;
            settings.bpmMax = 0;
            settings.bpmUnknown = "any";
            settings.bpmEnabled = false;
            settings.dateEnabled = false;
            settings.dateFrom = "";
            settings.dateTo = "";
            settings.ratingEnabled = false;
            applySmartFilters();
        }));

        // Changes already take effect as they are made, so this is the way out
        // from the foot of the sheet without scrolling back up to Done
        clearRow.appendChild(makeButton("Apply filters", "#48e1eb", "#000", function () {

            applySmartFilters();
            closeTagSheet();
        }));

        tagSheetRefresh = function () {

            // Every toggle and number in this sheet was registered as a
            // settings row, and those are only redrawn when the settings panel
            // opens. Without this a change made elsewhere, Clear all filters in
            // particular, leaves a toggle showing the opposite of the truth
            settingsRefreshers.forEach(function (fn) {
                fn();
            });

            // The tempo controls are only meaningful once tempo filtering is on
            const showBpm = settings.bpmEnabled ? "flex" : "none";

            bpmUnknownLabel.style.display = settings.bpmEnabled ? "" : "none";
            bpmUnknownRow.style.display = showBpm;

            // A range is meaningless while only the songs without a tempo are
            // wanted, so those two rows step aside
            const showRange = settings.bpmEnabled && settings.bpmUnknown !== "only";

            bpmMinRow.style.display = showRange ? "flex" : "none";
            bpmMaxRow.style.display = showRange ? "flex" : "none";

            for (const mode of Object.keys(unknownBtns)) {

                const on = settings.bpmUnknown === mode;

                unknownBtns[mode].style.background = on ? "#48e1eb" : "#333";
                unknownBtns[mode].style.color = on ? "#000" : "#fff";
            }

            const sortByCount = settings.tagSort !== "alpha";

            countSortBtn.style.background = sortByCount ? "#48e1eb" : "#333";
            countSortBtn.style.color = sortByCount ? "#000" : "#fff";
            alphaSortBtn.style.background = sortByCount ? "#333" : "#48e1eb";
            alphaSortBtn.style.color = sortByCount ? "#fff" : "#000";

            // Measured over the songs that actually match, so the span
            // describes the current selection rather than the whole library
            const matching = cache.songs.filter(passesFilters);
            const bounds = bpmBounds(matching);
            const matches = matching.length;

            countEl.textContent = matches === 0
                ? "No songs match"
                : matches + (matches === 1 ? " song matches" : " songs match");

            countEl.style.color = matches === 0 ? "#ff8a8a" : "#48e1eb";

            countHintEl.textContent = "of " + cache.songs.length + " in the library"
                + (bounds.high > 0
                    ? ", these span " + bounds.low + " to " + bounds.high + " BPM"
                    : "");

            const isAnd = settings.tagMode !== "or";

            andBtn.style.background = isAnd ? "#48e1eb" : "#333";
            andBtn.style.color = isAnd ? "#000" : "#fff";
            orBtn.style.background = isAnd ? "#333" : "#48e1eb";
            orBtn.style.color = isAnd ? "#fff" : "#000";

            // The date controls follow the switch and the chosen mode
            const showDate = settings.dateEnabled;
            const isRange = settings.dateMode === "range";

            dateFieldRow.el.style.display = showDate ? "flex" : "none";
            dateModeRow.el.style.display = showDate ? "flex" : "none";
            dateAgeRow.style.display = showDate && !isRange ? "flex" : "none";
            dateUnitRow.el.style.display = showDate && !isRange ? "flex" : "none";
            dateFromRow.el.style.display = showDate && isRange ? "flex" : "none";
            dateToRow.el.style.display = showDate && isRange ? "flex" : "none";
            dateClearRow.style.display = showDate && isRange ? "flex" : "none";

            dateFieldRow.paint();
            dateModeRow.paint();
            dateUnitRow.paint();

            // The rating controls follow their switch, and a minimum means
            // nothing while only the unrated songs are wanted
            const showRating = settings.ratingEnabled;

            ratingMinRow.style.display = showRating && settings.ratingUnrated !== "only"
                ? "flex" : "none";
            ratingUnratedLabel.style.display = showRating ? "" : "none";
            ratingUnratedRow.el.style.display = showRating ? "flex" : "none";
            ratingUnratedRow.paint();

            // A field being edited is left alone, so the picker is not reset
            // under the finger
            for (const row of [dateFromRow, dateToRow]) {

                if (document.activeElement !== row.input) {
                    row.input.value = settings[row.key] || "";
                }
            }

            genreList.render();
            moodList.render();
            modelList.render();
        };

        tagSheetEl.appendChild(head);
        tagSheetEl.appendChild(enableRow);
        tagSheetEl.appendChild(modeRow);
        tagSheetEl.appendChild(sortRow);
        tagSheetEl.appendChild(bpmLabel);
        tagSheetEl.appendChild(bpmEnableRow);
        tagSheetEl.appendChild(bpmMinRow);
        tagSheetEl.appendChild(bpmMaxRow);
        tagSheetEl.appendChild(bpmUnknownLabel);
        tagSheetEl.appendChild(bpmUnknownRow);
        tagSheetEl.appendChild(dateLabel);
        tagSheetEl.appendChild(dateEnableRow);
        tagSheetEl.appendChild(dateFieldRow.el);
        tagSheetEl.appendChild(dateModeRow.el);
        tagSheetEl.appendChild(dateAgeRow);
        tagSheetEl.appendChild(dateUnitRow.el);
        tagSheetEl.appendChild(dateFromRow.el);
        tagSheetEl.appendChild(dateToRow.el);
        tagSheetEl.appendChild(dateClearRow);
        tagSheetEl.appendChild(ratingLabel);
        tagSheetEl.appendChild(ratingEnableRow);
        tagSheetEl.appendChild(ratingMinRow);
        tagSheetEl.appendChild(ratingUnratedLabel);
        tagSheetEl.appendChild(ratingUnratedRow.el);
        tagSheetEl.appendChild(countEl);
        tagSheetEl.appendChild(countHintEl);
        tagSheetEl.appendChild(genreList.el);
        tagSheetEl.appendChild(moodList.el);
        tagSheetEl.appendChild(modelList.el);
        tagSheetEl.appendChild(clearRow);

        panelEl.appendChild(tagSheetEl);
    }

    // The tag vocabulary, built from the library and rebuilt only when it
    // changes. Counting every tag of every song on each render would be wasted
    // work on a library of thousands
    let tagIndexCache = null;
    let tagIndexStamp = "";

    function tagIndex() {

        const stamp = cache.songs.length + ":" + cache.updated;

        if (tagIndexCache && tagIndexStamp === stamp) {
            return tagIndexCache;
        }

        const genres = new Map();
        const moods = new Map();
        const models = new Map();

        const count = function (map, list) {

            if (!Array.isArray(list)) {
                return;
            }

            for (const raw of list) {

                const name = String(raw || "").trim();

                if (!name) {
                    continue;
                }

                map.set(name, (map.get(name) || 0) + 1);
            }
        };

        for (const song of cache.songs) {

            count(genres, song.genres);
            count(moods, song.moods);

            // A song carries one model, counted through the same helper
            if (song.model) {
                count(models, [song.model]);
            }
        }

        tagIndexCache = { genres: genres, moods: moods, models: models };
        tagIndexStamp = stamp;

        return tagIndexCache;
    }

    // The lowest and highest bpm the library actually holds, so the range
    // control covers the real spread instead of a guessed one
    function bpmBounds(songs) {

        const list = songs || cache.songs;

        let low = 0;
        let high = 0;

        for (const song of list) {

            const bpm = effectiveBpm(song);

            if (bpm <= 0) {
                continue;
            }

            if (low === 0 || bpm < low) {
                low = bpm;
            }

            if (bpm > high) {
                high = bpm;
            }
        }

        return { low: Math.floor(low), high: Math.ceil(high) };
    }

    // True when any tag filter is set at all
    function tagFilterActive() {

        if (!settings.smartEnabled) {
            return false;
        }

        return settings.tagGenres.length > 0 || settings.tagMoods.length > 0;
    }

    // True when the bpm range has been narrowed from the full spread
    function bpmFilterActive() {

        if (!settings.smartEnabled || !settings.bpmEnabled) {
            return false;
        }

        return settings.bpmUnknown !== "any" || settings.bpmMin > 0 || settings.bpmMax > 0;
    }

    // Whether the song carries the ticked tags. Match all needs every ticked
    // tag present, match any needs one of them
    function passesTagFilter(song) {

        if (!tagFilterActive()) {
            return true;
        }

        const has = function (list, name) {

            if (!Array.isArray(list)) {
                return false;
            }

            return list.some(function (raw) {
                return String(raw || "").trim() === name;
            });
        };

        const wanted = [];

        for (const name of settings.tagGenres) {
            wanted.push(has(song.genres, name));
        }

        for (const name of settings.tagMoods) {
            wanted.push(has(song.moods, name));
        }

        if (settings.tagMode === "or") {

            return wanted.some(function (hit) {
                return hit;
            });
        }

        return wanted.every(function (hit) {
            return hit;
        });
    }

    // Whether the song sits inside the chosen tempo range. A song with no bpm
    // is kept unless it is explicitly hidden, so narrowing the range does not
    // quietly drop everything the server never tagged
    function passesBpmFilter(song) {

        if (!bpmFilterActive()) {
            return true;
        }

        const bpm = effectiveBpm(song);
        const known = bpm > 0;

        // Only, for finding the songs still missing a tempo so it can be
        // supplied by hand. Hide, for keeping them out of a tempo selection
        if (!known) {
            return settings.bpmUnknown !== "hide";
        }

        if (settings.bpmUnknown === "only") {
            return false;
        }

        if (settings.bpmMin > 0 && bpm < settings.bpmMin) {
            return false;
        }

        if (settings.bpmMax > 0 && bpm > settings.bpmMax) {
            return false;
        }

        return true;
    }

    // True when at least one model is ticked
    function modelFilterActive() {

        if (!settings.smartEnabled) {
            return false;
        }

        return settings.tagModels.length > 0;
    }

    // A song passes when its model is one of the ticked ones. This is its own
    // filter, combined with the others like tempo is, since a song has only
    // one model and match all across several would never match anything
    function passesModelFilter(song) {

        if (!modelFilterActive()) {
            return true;
        }

        const model = String(song.model || "").trim();

        return settings.tagModels.indexOf(model) !== -1;
    }

    // A calendar day as typed into a date field, YYYY-MM-DD
    function isDayString(value) {

        return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    }

    // The start or the end of a calendar day in local time, as Unix seconds,
    // or null for an empty or unreadable day
    function daySeconds(value, endOfDay) {

        if (!isDayString(value)) {
            return null;
        }

        const parts = value.split("-").map(Number);
        const d = endOfDay
            ? new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999)
            : new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);

        if (isNaN(d.getTime())) {
            return null;
        }

        return d.getTime() / 1000;
    }

    // The window the date filter admits, as {from, to} in Unix seconds with
    // either end possibly null for open, or null when nothing is set. Worked
    // out once a minute rather than once per song, the list asks per song
    let dateWindowMemo = null;
    let dateWindowKey = "";

    function dateWindow() {

        const key = [
            settings.dateMode,
            settings.dateAgeValue,
            settings.dateAgeUnit,
            settings.dateFrom,
            settings.dateTo,
            Math.floor(Date.now() / 60000)
        ].join("|");

        if (key === dateWindowKey) {
            return dateWindowMemo;
        }

        let result = null;

        if (settings.dateMode === "range") {

            let from = daySeconds(settings.dateFrom, false);
            let to = daySeconds(settings.dateTo, true);

            // Picked the wrong way round, so take them as the span they mark
            if (from !== null && to !== null && from > to) {

                from = daySeconds(settings.dateTo, false);
                to = daySeconds(settings.dateFrom, true);
            }

            if (from !== null || to !== null) {
                result = { from: from, to: to };
            }

        } else {

            const n = settings.dateAgeValue;

            if (n > 0) {

                // Counted back on the calendar, so a month is a real month and
                // not thirty days
                const start = new Date();

                if (settings.dateAgeUnit === "days") {
                    start.setDate(start.getDate() - n);
                } else if (settings.dateAgeUnit === "months") {
                    start.setMonth(start.getMonth() - n);
                } else {
                    start.setDate(start.getDate() - n * 7);
                }

                result = { from: start.getTime() / 1000, to: null };
            }
        }

        dateWindowKey = key;
        dateWindowMemo = result;

        return result;
    }

    function dateFilterActive() {

        if (!settings.smartEnabled || !settings.dateEnabled) {
            return false;
        }

        return dateWindow() !== null;
    }

    // A song passes when the chosen date falls inside the window. Drafts have
    // no publish date, so filtering on it leaves them out
    function passesDateFilter(song) {

        if (!dateFilterActive()) {
            return true;
        }

        const stamp = settings.dateField === "published"
            ? song.publish_at
            : song.generate_at;

        if (typeof stamp !== "number" || stamp <= 0) {
            return false;
        }

        const w = dateWindow();

        if (w.from !== null && stamp < w.from) {
            return false;
        }

        if (w.to !== null && stamp > w.to) {
            return false;
        }

        return true;
    }

    // A short description of the date filter for the bar and tooltips
    function dateFilterLabel() {

        if (!dateFilterActive()) {
            return "";
        }

        const prefix = settings.dateField === "published" ? "published " : "";

        if (settings.dateMode === "range") {

            const from = settings.dateFrom;
            const to = settings.dateTo;

            if (from && to) {
                return prefix + (from <= to ? from + " to " + to : to + " to " + from);
            }

            return prefix + (from ? "since " + from : "until " + to);
        }

        const n = settings.dateAgeValue;
        const unit = settings.dateAgeUnit === "days"
            ? "day"
            : (settings.dateAgeUnit === "months" ? "month" : "week");

        return prefix + "last " + (n === 1 ? unit : n + " " + unit + "s");
    }

    // True when the rating filter would leave anything out
    function ratingFilterActive() {

        if (!settings.smartEnabled || !settings.ratingEnabled) {
            return false;
        }

        return settings.ratingMin > 0 || settings.ratingUnrated !== "any";
    }

    // Rated songs pass from the minimum up. Songs never rated are handled on
    // their own, kept, hidden, or the only ones shown, which is the way to
    // find what still needs rating
    function passesRatingFilter(song) {

        if (!ratingFilterActive()) {
            return true;
        }

        const r = getRating(song);

        if (r === null) {
            return settings.ratingUnrated !== "hide";
        }

        if (settings.ratingUnrated === "only") {
            return false;
        }

        return r >= settings.ratingMin;
    }

    // A short description of the rating filter for the bar and tooltips
    function ratingFilterLabel() {

        if (!ratingFilterActive()) {
            return "";
        }

        if (settings.ratingUnrated === "only") {
            return "not rated";
        }

        const min = settings.ratingMin;
        let text = min > 0
            ? (min === 5 ? "5 stars" : min + "+ stars")
            : "rated";

        if (settings.ratingUnrated === "any") {
            text += " or not rated";
        }

        return text;
    }

    function passesFilters(song) {

        return passesVocalFilter(song) && passesPlaylist(song) && passesPublishFilter(song)
            && passesTagFilter(song) && passesBpmFilter(song)
            && passesModelFilter(song) && passesDateFilter(song)
            && passesRatingFilter(song);
    }

    // How many songs the list is currently showing, filters applied
    function shownSongCount() {

        return cache.songs.filter(passesFilters).length;
    }

    // Remove duplicate songs by song_id, keeping the first occurrence
    function dedupe(list) {

        const seen = new Set();
        const out = [];

        for (const s of list) {

            if (seen.has(s.song_id)) {
                continue;
            }

            seen.add(s.song_id);
            out.push(s);
        }

        return out;
    }

    // Walk the parsed response and collect every song across all feeds
    // The list is feeds, each feed holds one or more songs under songs
    function extractSongs(node) {

        let out = [];

        if (Array.isArray(node)) {

            // A direct array of song objects, take all of them
            if (node.length > 0 && node[0] && typeof node[0] === "object" && "song_id" in node[0]) {
                return node.slice();
            }

            for (const item of node) {
                out = out.concat(extractSongs(item));
            }

            return out;
        }

        if (node && typeof node === "object") {

            // A single song object, as the creator endpoint nests under feeds[].song
            // Return it directly so we do not recurse into its own fields
            if ("song_id" in node) {
                return [node];
            }

            // A feed wrapper holds the song under "song" with the viewer like flag
            // beside it as is_liked. The wrapper flag is the authoritative one for
            // the logged in user, so copy it onto the song before returning it
            if (node.song && typeof node.song === "object" && "song_id" in node.song) {

                if (typeof node.is_liked === "boolean") {
                    node.song.is_liked = node.is_liked;
                }

                return [node.song];
            }

            for (const key of Object.keys(node)) {
                out = out.concat(extractSongs(node[key]));
            }
        }

        return out;
    }

    // Cursor for the next page
    // The API gives the next cursor as data.last_id, otherwise fall back
    function getCursor(root, songs) {

        if (root && root.data && root.data.last_id !== undefined && root.data.last_id !== null) {
            return root.data.last_id;
        }

        if (songs.length === 0) {
            return null;
        }

        const last = songs[songs.length - 1];

        return last.generate_at || last.song_id || null;
    }

    // Whether the API says more pages exist, returns true, false, or null
    function hasMore(root) {

        if (root && root.data && typeof root.data.more === "boolean") {
            return root.data.more;
        }

        return null;
    }

    // Fetch a single page from the feed API
    async function fetchPage(cursor) {

        const params = new URLSearchParams();

        params.set("time", String(Date.now()));

        if (feed().creator) {

            // The creator endpoint pages a single user public songs by user_id
            // It expects last_id 0 for the first page, then the returned last_id
            params.set("user_id", String(feed().user_id));
            params.set("size", String(PAGE_SIZE));
            params.set("last_id", (cursor === null || cursor === undefined) ? "0" : String(cursor));

        } else {

            params.set("t", feed().t);
            params.set("size", String(PAGE_SIZE));
            params.set("query_type", feed().queryType);
            params.set("listRenderType", feed().queryType);

            if (cursor !== null && cursor !== undefined) {
                params.set("last_id", String(cursor));
            }
        }

        const url = feed().endpoint + "?" + params.toString();

        // credentials include sends the login cookies so the API authorises us
        const res = await timedFetch(url, { credentials: "include" });

        // A rejected request must not be mistaken for an empty final page
        if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }

        const json = await res.json();

        apiOk = true;

        // Keep the raw page for the debug Copy last feed JSON action
        lastFeedResponse = json;

        return json;
    }

    // Show the dash only when both the user name and the source are visible
    function updateSourceSeparator() {

        if (!sourceSepEl) {
            return;
        }

        const bothShown = selfNameEl
            && selfNameEl.style.display !== "none"
            && sourceEl
            && sourceEl.style.display !== "none";

        sourceSepEl.style.display = bothShown ? "inline" : "none";
    }

    // Show the logged in user name in the header, or hide it when not known
    function setSelfName(name) {

        selfName = name || "";

        if (!selfNameEl) {
            return;
        }

        if (name) {
            selfNameEl.textContent = name;
            selfNameEl.style.display = "inline";
        } else {
            selfNameEl.textContent = "";
            selfNameEl.style.display = "none";
        }

        updateSourceSeparator();
    }

    // Show or hide the logged out warning banner
    function setAuthWarn(show) {

        if (authWarnEl) {
            authWarnEl.style.display = show ? "block" : "none";
        }
    }

    // Ask Mureka for your own profile to confirm you are logged in
    // Returns true when logged in, false when logged out, null when it could
    // not be determined, for example a network error
    async function checkAuth() {

        try {
            const url = "/api/pgc/profile?time=" + Date.now();
            const res = await timedFetch(url, { credentials: "include" });

            if (!res.ok) {
                return null;
            }

            const json = await res.json();
            const user = json && json.code === 0 && json.data && json.data.user;

            if (user && user.user_id != null) {

                // Capture the logged in user id while we have it
                if (selfUserId === null) {

                    selfUserId = String(user.user_id);

                    try {
                        localStorage.setItem(SELF_KEY, selfUserId);
                    } catch (e) {
                    }
                }

                // Show who is logged in
                setSelfName(user.stage_name || "");

                return true;
            }

            // Logged out, drop the name from the header
            setSelfName(null);

            return false;

        } catch (e) {
            return null;
        }
    }

    // Probe the profile endpoint and update the logged out banner
    // A null result leaves the banner as it is, so a blip does not flip it
    async function refreshAuthBanner() {

        const authed = await checkAuth();

        if (authed === true) {
            setAuthWarn(false);
        } else if (authed === false) {
            setAuthWarn(true);
        }
    }

    // Entry point for the Load / refresh button
    // While the library is not fully cached it resumes loading older songs
    // Once everything is cached it only checks the top for new songs
    async function run(light) {

        if (running) {

            // A second press stops the load, invalidate the active run
            running = false;
            runOwner = null;
            loadToken += 1;
            updateButton();
            return;
        }

        running = true;
        runOwner = "load";
        const myToken = ++loadToken;

        // Confirm login state for your own feed and warn if logged out
        if (!creatorSource) {
            refreshAuthBanner();
        }

        updateButton();

        try {

            if (cache.songs.length === 0) {

                // Nothing cached yet, do the initial load from the top downward
                await continueLoad(myToken);

            } else {

                // Always check the top for new or republished songs first, so new
                // tracks are picked up whether or not the library finished loading
                await refreshNew(myToken);

                // A full Load also keeps filling older songs when not yet complete
                // Refresh on open stays light and skips this
                if (light !== true
                    && cache.complete !== true
                    && running
                    && myToken === loadToken) {

                    await continueLoad(myToken);
                }
            }

        } catch (e) {

            // The API is unreachable, the cached songs still work offline
            setStatus("Could not reach Mureka, showing " + cache.songs.length + " cached songs");

        } finally {

            // Only clear the running state if a newer run has not taken over
            if (myToken === loadToken) {
                running = false;
                runOwner = null;
                updateButton();
            }

            renderList();
            refreshCachedIds();
        }
    }

    // Deep refresh, page the whole feed from the top without clearing first
    // Adds new songs and refreshes the publish date, like flag and publish
    // state on songs already cached, so a late published older song appears
    // and every field is brought up to date in place
    async function rescan() {

        if (running) {

            running = false;
            runOwner = null;
            loadToken += 1;
            updateButton();
            return;
        }

        running = true;
        runOwner = "rescan";
        const myToken = ++loadToken;

        if (!creatorSource) {
            refreshAuthBanner();
        }

        updateButton();

        try {
            await refreshNew(myToken, true);
        } catch (e) {
            setStatus("Could not reach Mureka, showing " + cache.songs.length + " cached songs");
        } finally {

            if (myToken === loadToken) {
                running = false;
                runOwner = null;
                updateButton();
            }

            renderList();
            refreshCachedIds();
        }
    }

    // Keep fetching older pages from where we left off until the end is reached
    // Progress and the cursor are saved each page, so it can resume after a stop
    async function continueLoad(myToken) {

        // Map of cached songs by id, so we can update fields on ones we already have
        const known = new Map(cache.songs.map(function (s) {
            return [s.song_id, s];
        }));

        let cursor = cache.lastCursor || null;

        while (running && myToken === loadToken) {

            let page;

            try {
                page = await fetchPage(cursor);
            } catch (e) {
                setStatus("Network error, paused");
                break;
            }

            // A feed switch or stop happened during the request
            // Drop this page unwritten so it cannot land in the wrong cache
            if (myToken !== loadToken) {
                break;
            }

            // Learn the logged in user id from your own feed for the picker
            if (!creatorSource) {
                recordSelfUserId(page);
            }

            const songs = extractSongs(page);

            // An empty page means the whole library has been loaded
            if (songs.length === 0) {
                cache.complete = true;
                cache.lastCursor = null;
                saveCache();
                break;
            }

            for (const s of songs) {

                // Still generating, so it has no audio to play and its details
                // are not final. A later load picks it up once it is finished
                if (!isUsableSong(s)) {
                    continue;
                }

                const existing = known.get(s.song_id);

                if (!existing) {

                    const fresh = trim(s);
                    known.set(s.song_id, fresh);
                    cache.songs.push(fresh);

                } else {

                    // Keep the like flag current on a song we already cached
                    existing.is_liked = s.is_liked === true;
                }
            }

            // Grow the active queue with the songs just loaded
            extendQueueWithNew();

            const newCursor = getCursor(page, songs);
            const more = hasMore(page);

            cache.updated = Date.now();
            renderList();

            // The API explicitly says there are no more pages
            if (more === false) {
                cache.complete = true;
                cache.lastCursor = null;
                saveCache();
                break;
            }

            // A null cursor means there is nothing more to page through
            if (newCursor === null) {
                cache.complete = true;
                cache.lastCursor = null;
                saveCache();
                break;
            }

            // If the cursor stops moving the endpoint is not paginating, bail
            if (newCursor === cursor) {
                cache.lastCursor = cursor;
                saveCache();
                setStatus("Stopped, the list did not page past " + cache.songs.length + " songs");
                break;
            }

            cursor = newCursor;
            cache.lastCursor = cursor;
            saveCache();

            setStatus("Loading older songs, total: " + cache.songs.length);

            await sleep(PAGE_DELAY);
        }

        if (cache.complete === true) {
            setStatus("All songs loaded, total: " + cache.songs.length);
        } else {
            setStatus("Paused at " + cache.songs.length + " songs, Load again to continue");
        }
    }

    // Walk the newest pages and add new or republished songs to the front
    // Stops after a run of cached songs, which marks the old data boundary
    async function refreshNew(myToken, deep) {

        const known = new Set(cache.songs.map(function (s) {
            return s.song_id;
        }));

        // Snapshot the original list so each progress merge concatenates the
        // fresh pages with the unchanged base, not with a previous merge
        const baseSongs = cache.songs.slice();

        const fresh = [];

        // Every song id the server returned, including ones still generating
        // that are not added to the list. A rescan prunes what it did not see,
        // and an unfinished song is very much still there
        const seen = new Set();

        let cursor = null;
        let knownStreak = 0;
        let newCount = 0;
        let stop = false;
        let reachedEnd = false;

        while (running && myToken === loadToken && !stop) {

            let page;

            try {
                page = await fetchPage(cursor);
            } catch (e) {
                setStatus("Network error, stopped");
                break;
            }

            // A feed switch or stop happened during the request
            // Drop this page unwritten so it cannot land in the wrong cache
            if (myToken !== loadToken) {
                return;
            }

            // Learn the logged in user id from your own feed for the picker
            if (!creatorSource) {
                recordSelfUserId(page);
            }

            const songs = extractSongs(page);

            if (songs.length === 0) {
                reachedEnd = true;
                break;
            }

            for (const s of songs) {

                // Still generating, so leave it out of the list. It is added to
                // seen anyway, otherwise a rescan would treat it as deleted
                if (!isUsableSong(s)) {

                    seen.add(s.song_id);
                    continue;
                }

                if (known.has(s.song_id)) {
                    knownStreak += 1;
                } else {
                    knownStreak = 0;
                    newCount += 1;
                }

                fresh.push(trim(s));

                // A deep rescan pages the whole feed, the streak stop that ends
                // a quick refresh early is skipped so every song is revisited
                if (!deep && knownStreak >= KNOWN_STREAK_STOP) {
                    stop = true;
                    break;
                }
            }

            setStatus((deep ? "Rescanning, songs: " : "Checking for new songs, found: ")
                + (deep ? fresh.length : newCount));

            // Merge the pages seen so far into the cache and render through the
            // normal path, so during the scan the list is deduped and publish
            // sorted exactly as it will be after a restart, not a raw concat.
            // The token guard skips this if the feed was switched mid scan
            if (myToken === loadToken) {
                cache.songs = dedupe(fresh.concat(baseSongs));
                renderList();
            }

            if (stop) {
                break;
            }

            const more = hasMore(page);

            if (more === false) {
                reachedEnd = true;
                break;
            }

            const newCursor = getCursor(page, songs);

            if (newCursor === null) {
                reachedEnd = true;
                break;
            }

            // The cursor stopped moving, so the endpoint is not paginating.
            // That is a stalled scan and not the end of the library, and
            // treating it as the end would let the prune below throw away
            // every song past the first page
            if (newCursor === cursor) {
                break;
            }

            cursor = newCursor;

            await sleep(PAGE_DELAY);
        }

        // A feed switch during the last await would make this write the wrong cache
        if (myToken !== loadToken) {
            return;
        }

        // A song that was published and is now a draft, or the other way
        // round, is easy to miss in a total that only moved by a few. Count
        // the crossings in both directions against the copies held before the
        // scan, while those copies still carry the old publish state
        const wasById = new Map(baseSongs.map(function (s) {
            return [s.song_id, s];
        }));

        const counted = new Set();

        let nowPublished = 0;
        let nowDraft = 0;

        for (const s of fresh) {

            const before = wasById.get(s.song_id);

            // Shifting pagination can hand the same song back twice, and a
            // song with no cached copy is simply new, not a change
            if (!before || counted.has(s.song_id)) {
                continue;
            }

            counted.add(s.song_id);

            const wasPublished = before.publish_state === 1;
            const isPublished = s.publish_state === 1;

            if (wasPublished === isPublished) {
                continue;
            }

            if (isPublished) {
                nowPublished += 1;
            } else {
                nowDraft += 1;
            }
        }

        // New and republished songs move to the front, duplicates are dropped
        // A deep rescan rebuilds the whole list, so the fresh fields, publish
        // date, like flag and publish state, replace the older cached copies
        cache.songs = dedupe(fresh.concat(baseSongs));
        cache.updated = Date.now();

        // A deep rescan that ran to the end has now seen the entire library
        let removed = 0;

        // True when the deleted song sweep was held back because the feed
        // could not be trusted to list everything
        let pruneSkipped = false;

        if (deep && reachedEnd) {

            cache.complete = true;
            cache.lastCursor = null;

            // Logged out, your own feed returns nothing at all, or the
            // published songs only. Every draft would then look deleted and
            // be thrown away along with its audio, cover and waveform, so the
            // login is confirmed before anything is removed. A creator
            // library is public by definition and needs no such check
            let mayPrune = true;

            if (!creatorSource) {

                mayPrune = (await checkAuth()) === true;

                // The feed was switched while the login was being confirmed,
                // so this run no longer owns the cache it was writing into
                if (myToken !== loadToken) {
                    return;
                }
            }

            // A scan that ran to the end without returning a single song is
            // not an empty library, it is a feed that answered with nothing.
            // Pruning on that would wipe everything
            if (mayPrune && fresh.length === 0 && seen.size === 0) {
                mayPrune = false;
            }

            if (mayPrune) {

                // Everything the server still has was just seen, so anything
                // left in the cache was deleted upstream. Drop it and its
                // stored data
                const live = new Set(seen);

                for (const s of fresh) {
                    live.add(s.song_id);
                }

                const gone = cache.songs.filter(function (s) {
                    return !live.has(s.song_id);
                });

                for (const s of gone) {

                    await forgetSong(s);
                    removed += 1;
                }

                if (removed > 0) {
                    saveManualInstrumental();
                }

            } else {

                // Nothing was removed, so the library is not known to be in
                // step with the server and must not be marked complete
                cache.complete = false;
                pruneSkipped = true;
            }
        }

        saveCache();

        // Grow the active queue with any songs the refresh brought in
        extendQueueWithNew();

        // Only the counts that are not zero, so an ordinary refresh stays
        // short and a rescan that actually changed something says what
        const total = cache.songs.length;
        const shown = shownSongCount();
        const parts = ["total: " + total];

        if (shown !== total) {
            parts.push("shown here: " + shown);
        }

        parts.push("new: " + newCount);

        if (nowPublished > 0) {
            parts.push("newly published: " + nowPublished);
        }

        if (nowDraft > 0) {
            parts.push("back to draft: " + nowDraft);
        }

        if (removed > 0) {
            parts.push("removed: " + removed);
        }

        if (pruneSkipped) {
            parts.push("nothing removed, sign in to Mureka so drafts are not"
                + " mistaken for deleted songs");
        }

        setStatus((deep
            ? (pruneSkipped ? "Rescanned, " : "Rescan complete, ")
            : "Up to date, ") + parts.join(", "));
    }

    // Wipe the cache and reset the view
    function clearCache() {

        // Stop any load in progress so it cannot refill the cache we just cleared
        if (running) {
            running = false;
            updateButton();
        }

        // Invalidate the active load token even if the flag was already cleared
        loadToken += 1;

        cache = { songs: [], updated: 0, complete: false, lastCursor: null };
        saveCache();
        cachedIds = new Set();
        renderList();
        setStatus("Cache cleared");
    }

    // Switch between the published feed and the all songs feed
    // Each feed keeps its own cache, so this just swaps which one is shown
    // While browsing a creator this instead returns to your own current feed
    function switchFeed() {

        // Cancel any load in progress so it cannot write into the new feed cache
        if (running) {
            running = false;
            updateButton();
        }

        // Invalidate the active load token even if the flag was already cleared
        loadToken += 1;

        if (creatorSource) {

            // Leaving a creator returns to your own library, whose cache and
            // wave scan differ, so those are reset here and not on a filter flip
            waveScanCursor = null;
            waveScanDone = false;
            creatorSource = null;
            updateCreatorButton();
            cache = loadCache();
            cachedIds = new Set();
            refreshCachedIds();

        } else {

            // One library, so this only changes which part of it is shown. No
            // reload, no second cursor, and nothing to go stale
            publishFilter = publishFilter === "published" ? "all" : "published";
        }

        updateFeedButton();
        renderList();

        // The set of songs the filter admits just changed, so what plays next
        // has to change with it. The current song is kept, only the upcoming
        // part is rebuilt, exactly as the vocals filter does
        rebuildUpcoming();

        const n = shownSongCount();

        setStatus(feed().label + ", " + n + " song"
            + (n === 1 ? "" : "s")
            + (cache.songs.length === 0 ? ", press Load" : ""));

        saveSource();

        // Creator feeds never warn, your own feed re-checks login state
        if (creatorSource) {
            setAuthWarn(false);
        } else {
            refreshAuthBanner();
        }

        // Refresh the newly opened feed when the user asked for it
        maybeAutoRefresh();
    }

    // Show the active feed name on the feed button
    // This always reflects your own feed, creator state shows on its own tile
    // Show the current source under the title, the active feed or creator name
    function updateSourceLabel() {

        if (!sourceEl) {
            return;
        }

        if (creatorSource) {
            sourceEl.textContent = creatorSource.stage_name || "Creator";
        } else {
            sourceEl.textContent = publishFilter === "published"
                ? "Published"
                : "All songs";
        }

        sourceEl.style.display = "inline";
        updateSourceSeparator();
    }

    function updateFeedButton() {

        if (feedButton) {
            feedButton.labelEl.textContent = publishFilter === "published"
                ? "Published"
                : "All";
        }

        if (publishedCtrlBtn) {

            const onlyPublished = publishFilter === "published";

            // A tick for published only, an open circle for everything
            setTransportIcon(publishedCtrlBtn, onlyPublished ? "\u2713" : "\u25CB");
            updateControlLabels();
            publishedCtrlBtn.title = onlyPublished ? "Showing published, tap for all" : "Showing all, tap for published";

            // Greyed and inert while browsing a creator
            publishedCtrlBtn.style.opacity = creatorSource ? "0.35" : "1";
            publishedCtrlBtn.style.cursor = creatorSource ? "default" : "pointer";
            publishedCtrlBtn.disabled = !!creatorSource;
        }

        updateSourceLabel();
    }

    // Try to learn the audio base URL from the site own audio element
    function detectBase() {

        const audios = document.querySelectorAll("audio");

        for (const a of audios) {

            const src = a.currentSrc || a.src || "";

            const idx = src.indexOf("cos-prod/");

            if (idx !== -1) {
                return src.slice(0, idx);
            }
        }

        return null;
    }

    // Build a playable URL for a song
    function songUrl(song) {

        const path = song.mp3_url || "";

        if (path.indexOf("http") === 0) {
            return path;
        }

        if (!audioBase) {
            audioBase = detectBase();
        }

        if (!audioBase) {
            return null;
        }

        return audioBase + path;
    }

    // Build the album art URL for a song, served from the same host
    function coverUrl(song) {

        const path = song.cover || "";

        if (path === "") {
            return "";
        }

        if (path.indexOf("http") === 0) {
            return path;
        }

        return AUDIO_BASE + path;
    }

    // Return a URL to feed the audio element
    // Uses a cached copy if present, otherwise downloads and stores it
    // Falls back to streaming the direct URL if caching is not possible
    async function getPlayableUrl(song) {

        const direct = songUrl(song);

        if (!direct) {
            return null;
        }

        try {
            const store = await caches.open(AUDIO_CACHE);
            let resp = await store.match(direct);

            if (!resp) {

                // Mark as caching so its dot pulses while the file downloads
                cachingIds.add(song.song_id);
                renderList();

                // A longer deadline than the background work, this is the file
                // being played, but it must still fail rather than hang, or
                // playback dies silently with no error to recover from
                const net = await timedFetch(direct, {}, 30000);

                if (net && net.ok) {
                    await store.put(direct, net.clone());
                    resp = net;

                    // The full file is now stored, so light its cached marker
                    cachedIds.add(song.song_id);
                }

                cachingIds.delete(song.song_id);
                renderList();
            }

            if (resp) {
                const blob = await resp.blob();

                return URL.createObjectURL(blob);
            }
        } catch (e) {

            // Make sure a failed fetch does not leave the dot pulsing
            if (cachingIds.delete(song.song_id)) {
                renderList();
            }
        }

        return direct;
    }

    // Throw away a prepared next URL, releasing its blob
    function dropNextReady() {

        if (nextReady && nextReady.url && nextReady.url.indexOf("blob:") === 0) {
            URL.revokeObjectURL(nextReady.url);
        }

        nextReady = null;
    }

    // Prepare a URL for the song that plays next, from the cache when it is
    // there. Done ahead of time so the moment the current song ends the next
    // can be started synchronously, which the background requires
    async function prepareNextReady() {

        const pos = queuePos + 1;

        if (pos >= queue.length || !queue[pos]) {

            dropNextReady();
            return;
        }

        const song = queue[pos];

        if (nextReady && nextReady.song_id === song.song_id) {
            return;
        }

        dropNextReady();

        const direct = songUrl(song);

        if (!direct) {
            return;
        }

        try {
            const store = await caches.open(AUDIO_CACHE);
            const resp = await store.match(direct);

            if (!resp) {
                return;
            }

            const blob = await resp.blob();

            // The queue may have moved on while the blob was being read
            if (queuePos + 1 < queue.length && queue[queuePos + 1]
                && queue[queuePos + 1].song_id === song.song_id) {

                nextReady = { song_id: song.song_id, url: URL.createObjectURL(blob) };

            } else {
                URL.revokeObjectURL(URL.createObjectURL(blob));
            }
        } catch (e) {
        }
    }

    // Ensure a song mp3 is stored in the cache, returns true on success
    async function fetchToCache(song) {

        const url = songUrl(song);

        if (!url) {
            return false;
        }

        try {
            const store = await caches.open(AUDIO_CACHE);

            if (await store.match(url)) {
                return true;
            }

            // Mark as caching so its dot pulses while the file downloads
            cachingIds.add(song.song_id);
            renderList();

            const net = await timedFetch(url);

            if (!net || !net.ok) {
                return false;
            }

            await store.put(url, net.clone());
            cachedIds.add(song.song_id);

            return true;
        } catch (e) {
            return false;
        } finally {

            if (cachingIds.delete(song.song_id)) {
                renderList();
            }
        }
    }

    // The player runs either inside the extension or as a web bookmarklet
    // The extension content script tags the document, so the player knows to use
    // the folder download relay, otherwise it falls back to a browser download
    function isExtensionHost() {

        return document.documentElement.getAttribute("data-mureka-host") === "extension";
    }

    // Pick the download path for the current host
    function requestDownload(items) {

        if (isExtensionHost()) {
            downloadViaExtension(items);
        } else {
            downloadViaBrowser(items);
        }
    }

    // Extension path, relay to the content script, which saves into the Mureka
    // folder through the background downloads API with no Save As dialog
    function downloadViaExtension(items) {

        window.postMessage({
            source: "mureka-player-page",
            type: "downloadMany",
            items: items
        }, "*");
    }

    // The content script reports back how many files were saved
    window.addEventListener("message", function (ev) {

        if (ev.source !== window) {
            return;
        }

        const data = ev.data;

        if (!data || data.source !== "mureka-player-content") {
            return;
        }

        if (data.type === "downloadResult") {
            setStatus("Saved " + data.ok + " to the Mureka folder"
                + (data.fail ? ", " + data.fail + " failed" : ""));
        }
    });

    // Web path, save through a normal browser download, best effort
    // A plain page cannot choose a folder, and a cross origin download needs the
    // audio host to allow CORS. When it does, the blob is fetched and saved with
    // a real file name, otherwise the file is counted as failed
    async function downloadViaBrowser(items) {

        let ok = 0;
        let fail = 0;

        for (const item of items) {

            try {
                const res = await fetch(item.url);

                if (!res.ok) {
                    throw new Error("HTTP " + res.status);
                }

                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");

                // Drop the Mureka/ prefix, a page download cannot set a folder
                a.href = objectUrl;
                a.download = item.filename.replace(/^Mureka\//, "");

                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(objectUrl);

                ok += 1;
            } catch (e) {
                fail += 1;
            }

            // A short gap keeps the browser from dropping a big batch
            await sleep(200);
        }

        setStatus("Saved " + ok
            + (fail ? ", " + fail + " failed, the audio host blocked the download" : ""));
    }

    // Build a safe file name for a downloaded song
    function fileName(song) {

        const base = (song.title || "track").replace(/[\\/:*?"<>|]+/g, "_").trim();

        return base + " [" + song.song_id + "].mp3";
    }

    // Ask the browser to keep the cache instead of evicting it under pressure
    async function requestPersistentStorage() {

        if (!navigator.storage || !navigator.storage.persist) {
            return;
        }

        try {
            await navigator.storage.persist();
        } catch (e) {
        }
    }

    // Rebuild the set of cached song_ids by scanning the audio cache keys
    async function refreshCachedIds() {

        try {
            const store = await caches.open(AUDIO_CACHE);
            const requests = await store.keys();

            const urls = new Set(requests.map(function (r) {
                return r.url;
            }));

            const ids = new Set();

            for (const song of cache.songs) {

                const url = songUrl(song);

                if (url && urls.has(url)) {
                    ids.add(song.song_id);
                }
            }

            cachedIds = ids;
            renderList();
        } catch (e) {
        }

        refreshArtCachedIds();
    }

    // Rebuild the set of cover cached song_ids by scanning the art store keys
    async function refreshArtCachedIds() {

        try {

            const store = await caches.open(ART_STORE);
            const requests = await store.keys();
            const prefix = "https://mureka-art-cache/";
            const ids = new Set();

            for (const r of requests) {

                if (r.url.indexOf(prefix) === 0) {
                    ids.add(decodeURIComponent(r.url.slice(prefix.length)));
                }
            }

            artCachedIds = ids;
            renderList();
        } catch (e) {
        }
    }

    // Delete a single song mp3 from the audio cache
    async function removeFromCache(song) {

        const url = songUrl(song);

        if (!url) {
            return false;
        }

        try {
            const store = await caches.open(AUDIO_CACHE);

            return await store.delete(url);
        } catch (e) {
            return false;
        }
    }

    // Remove every stored trace of a song, the audio, the cover and the wave
    async function purgeSongData(song) {

        const id = String(song.song_id);

        await removeFromCache(song);

        try {

            const artStore = await caches.open(ART_STORE);

            await artStore.delete(artStoreKey(song.song_id));
        } catch (e) {
        }

        try {

            const waveStore = await caches.open(WAVE_STORE);

            await waveStore.delete(waveStoreKey(song.song_id));
        } catch (e) {
        }

        cachedIds.delete(song.song_id);
        artCachedIds.delete(id);
        artCache.delete(song.song_id);
    }

    // Drop a song from the library list and throw away everything cached for
    // it. Used both by the delete menu row and by the rescan prune
    async function forgetSong(song) {

        const idx = cache.songs.findIndex(function (s) {
            return s.song_id === song.song_id;
        });

        if (idx !== -1) {
            cache.songs.splice(idx, 1);
        }

        // Take it out of the queue too, keeping the current position sane
        const qi = queue.findIndex(function (s) {
            return s.song_id === song.song_id;
        });

        if (qi !== -1) {

            queue.splice(qi, 1);

            if (qi < queuePos) {
                queuePos -= 1;
            }
        }

        manualInstrumental.delete(String(song.song_id));

        if (ratings.delete(String(song.song_id))) {
            saveRatings();
        }
        await purgeSongData(song);
    }

    // Delete one song from the list on request
    async function deleteOne(song) {

        const title = song.title || "Untitled";

        await forgetSong(song);
        saveManualInstrumental();
        saveCache();
        renderList();
        setStatus("Removed from the list: " + title);
    }

    // Cache one song, then update its marker
    async function cacheOne(song) {

        setStatus("Caching: " + (song.title || "Untitled"));

        const ok = await fetchToCache(song);

        if (ok) {
            cachedIds.add(song.song_id);
            renderList();
            setStatus("Cached: " + (song.title || "Untitled"));
        } else {
            setStatus("Could not cache, the audio host may have blocked it");
        }
    }

    // Remove one song from the cache, then update its marker
    async function removeOne(song) {

        const ok = await removeFromCache(song);

        cachedIds.delete(song.song_id);
        renderList();

        setStatus(ok
            ? "Removed from cache: " + (song.title || "Untitled")
            : "Was not in the cache: " + (song.title || "Untitled"));
    }

    // Download one song to disk, caching it on the way if needed
    async function downloadOne(song) {

        const url = songUrl(song);

        if (!url) {
            setStatus("No URL for this song");
            return;
        }

        requestDownload([{ url: url, filename: "Mureka/" + fileName(song) }]);

        // Remember it so a later Download all can skip it
        downloadedIds.add(song.song_id);
        saveDownloadedIds();
        renderList();

        setStatus("Saving to the Mureka folder: " + (song.title || "Untitled"));
    }

    // Re-fetch one song from the detail endpoint to pick up a changed title etc
    async function refreshOne(song) {

        setStatus("Refreshing: " + (song.title || "Untitled"));

        try {
            const url = "/api/pgc/song/detail?time=" + Date.now() + "&song_id=" + song.song_id;
            const res = await timedFetch(url, { credentials: "include" });

            if (!res.ok) {
                setStatus("Refresh failed, HTTP " + res.status);
                return;
            }

            const json = await res.json();
            const fresh = json && json.data && json.data.song;

            if (!fresh || fresh.song_id !== song.song_id) {
                setStatus("Refresh returned no matching song");
                return;
            }

            const idx = cache.songs.findIndex(function (s) {
                return s.song_id === song.song_id;
            });

            if (idx === -1) {
                return;
            }

            // Mutate in place so the queue and current song see the update too
            Object.assign(cache.songs[idx], trim(fresh));
            saveCache();
            renderList();

            if (currentSong && currentSong.song_id === song.song_id) {
                updatePlayerInfo(currentSong);
            }

            setStatus("Refreshed: " + (cache.songs[idx].title || "Untitled"));

        } catch (e) {
            setStatus("Refresh failed");
        }
    }

    // Format a number of seconds as m:ss
    function formatTime(seconds) {

        if (!isFinite(seconds) || seconds < 0) {
            return "0:00";
        }

        const total = Math.floor(seconds);
        const mins = Math.floor(total / 60);
        const secs = total % 60;

        return mins + ":" + (secs < 10 ? "0" : "") + secs;
    }

    // Create the shared audio element on first use
    function ensureAudio() {

        if (audio) {
            return;
        }

        audio = new Audio();

        // Attach the element to the page. Firefox only exposes a media element
        // to the OS media controls and MPRIS, where playerctl can see it, when
        // it is connected to the document. A detached element is not registered
        audio.id = "mureka-player-audio";
        audio.preload = "auto";
        (document.body || document.documentElement).appendChild(audio);

        audio.addEventListener("ended", function () {
            handleSongEnded();
        });

        // A song that starts playing proves the audio base URL is correct
        audio.addEventListener("playing", function () {

            playbackWorks = true;
            userPaused = false;
            switchingTrack = false;
            playFailStreak = 0;

            // Keep the screen awake and start the countdown to the blackout
            requestWakeLock();
            resetIdleTimer();

            // iOS drops the action handlers and the now playing ownership after
            // an interruption, so claim them again every time playback starts
            setupMediaSession();

            // Direct mode streams the file into the element, so the copy kept
            // for offline replay is fetched only once playback is running,
            // never in parallel with the initial buffering
            if (settings.directAudio && currentSong
                && !cachedIds.has(currentSong.song_id)
                && !cachingIds.has(currentSong.song_id)) {

                fetchToCache(currentSong);
            }

            if (npCoverSent) {

                // Resume of the same song, re-assert the cover after a call or
                // other interruption dropped it
                sendNowPlaying();

            } else {

                // First run of this song, send once the cover is also ready
                npPlaying = true;
                tryNowPlaying();
            }

            updateMediaPosition();
        });

        audio.addEventListener("error", function () {

            // The source swap ended in an error rather than playing, so clear
            // the flag or the next real interruption pause would be ignored
            switchingTrack = false;
            handlePlayError();
        });

        // Set the seek bar range once the duration is known
        audio.addEventListener("loadedmetadata", function () {

            // Apply a one-shot resume seek now that the duration is known
            if (pendingSeek > 0 && isFinite(audio.duration)) {

                try {
                    audio.currentTime = Math.min(pendingSeek, audio.duration - 0.5);
                } catch (e) {
                }
            }

            pendingSeek = 0;
            updateSeekDisplay();
        });

        setupMediaSession();
        startWatchdog();

        // Move the seek bar and time labels as the song plays
        audio.addEventListener("timeupdate", function () {

            if (!isSeeking) {
                updateSeekDisplay();
            }

            updateLyricLine();

            // Persist the position now and then so a restart resumes near here
            const now = Date.now();

            if (now - lastQueueSave > 5000) {
                lastQueueSave = now;
                saveQueue();
            }
        });

        audio.addEventListener("play", function () {

            userPaused = false;

            // Re-claim the controls, iOS hands them to whatever played last
            setupMediaSession();
            resendArtOnResume();
            updatePlayPause();

            if ("mediaSession" in navigator) {

                try {
                    navigator.mediaSession.playbackState = "playing";
                } catch (e) {
                }
            }

            // Clear a stale Stopped or Paused line once playback is running
            if (currentSong) {
                setStatus("Playing: " + (currentSong.title || "Untitled"));
            }

            // Only refresh the scrubber position on resume. Re-sending the
            // metadata would re-send the cover, and iOS caps covers per song
            updateMediaPosition();
        });

        audio.addEventListener("pause", function () {

            // A source swap flips paused and may fire this on some engines.
            // The next song is already starting, so nothing below applies
            if (switchingTrack) {
                return;
            }

            updatePlayPause();

            // Keep the saved position current when the user pauses
            saveQueue();

            if ("mediaSession" in navigator) {

                try {
                    navigator.mediaSession.playbackState = "paused";
                } catch (e) {
                }
            }

            // Stop clears currentSong first, so this only fires for a real pause
            if (!currentSong) {
                return;
            }

            // Nothing playing, so let the screen sleep normally again, unless
            // the cover is up, which needs the phone to stay unlocked
            if (!isBlackedOut()) {
                releaseWakeLock();
            }

            resetIdleTimer();

            if (userPaused || audio.ended) {

                setStatus("Paused: " + (currentSong.title || "Untitled"));
                return;
            }

            // Nobody asked for this pause, so the system interrupted playback.
            // Keep the song, the queue and the position, and re-assert the
            // handlers so the next hardware play reaches us. The metadata is
            // only re-sent once its cover already went out, an empty artwork
            // list makes iOS show the page logo and spends a cover send
            setupMediaSession();

            if (npCoverSent || settings.artOnResume) {
                sendNowPlaying();
            }

            updateMediaPosition();
            setStatus("Interrupted: " + (currentSong.title || "Untitled"));
        });
    }

    // Retry a failed play through fetch. A cached copy plays at once, otherwise
    // the fetch yields a real HTTP status, which the media error never does.
    // Returns playing, stale when a newer play took over, gone on a 404, or
    // failed for anything transient such as a dropped connection
    async function retryFromFetch(song) {

        const direct = songUrl(song);

        if (!direct) {
            return "failed";
        }

        const token = playToken;

        try {
            const store = await caches.open(AUDIO_CACHE);
            let resp = await store.match(direct);

            if (!resp) {

                // Pulse the dot while the file downloads, like fetchToCache
                cachingIds.add(song.song_id);
                renderList();

                const net = await timedFetch(direct);

                cachingIds.delete(song.song_id);
                renderList();

                // Only a 404 proves the file is gone. Anything else can be a
                // dropped connection, a proxy error or an expired link
                if (net.status === 404) {
                    return "gone";
                }

                if (!net.ok) {
                    return "failed";
                }

                await store.put(direct, net.clone());
                cachedIds.add(song.song_id);
                resp = net;
            }

            const blob = await resp.blob();

            // The user moved on while the file was loading
            if (token !== playToken || !currentSong || currentSong.song_id !== song.song_id) {
                return "stale";
            }

            setCurrentSrc(URL.createObjectURL(blob));
            startAudioPlayback();

            return "playing";
        } catch (e) {

            if (cachingIds.delete(song.song_id)) {
                renderList();
            }

            return "failed";
        }
    }

    // Recover from a load error. The first failure of a play is retried through
    // fetch, which serves the cached copy or reports a real HTTP status. Only a
    // 404 removes the song from the list, a dropped connection never does, so
    // a flaky link cannot quietly prune the library
    async function handlePlayError() {

        if (!currentSong) {
            return;
        }

        const failed = currentSong;
        const title = failed.title || "Untitled";
        const token = playToken;

        // The retry itself failed, stop here and leave the queue in place so
        // the next play press starts again from the same song
        if (errorRetryToken === token) {

            // A stored copy that will not decode is not worth keeping
            removeFromCache(failed);
            cachedIds.delete(failed.song_id);
            renderList();
            updatePlayPause();
            setStatus("Could not play, press play to retry: " + title);
            return;
        }

        errorRetryToken = token;

        const outcome = await retryFromFetch(failed);

        // A newer play took over during the retry, nothing more to do
        if (token !== playToken) {
            return;
        }

        if (outcome === "playing" || outcome === "stale") {
            return;
        }

        if (outcome === "failed") {

            updatePlayPause();
            playFailStreak += 1;

            // With no signal and no stored copy a song cannot start, so move
            // on to the next one instead of leaving playback dead. A run of
            // failures means the whole queue is unreachable, so stop then
            if (playFailStreak < 3 && queuePos < queue.length - 1) {

                setStatus("Skipping, could not play: " + title);
                playNext();
                return;
            }

            setStatus("Could not play, press play to retry: " + title);
            return;
        }

        // The file is gone. Only prune once something has played, so a wrong
        // audio base does not wipe the whole library
        if (!playbackWorks) {
            setStatus("Could not play, check the audio URL: " + title);
            return;
        }

        const idx = cache.songs.findIndex(function (s) {
            return s.song_id === failed.song_id;
        });

        if (idx !== -1) {
            cache.songs.splice(idx, 1);
            saveCache();
        }

        setStatus("Removed deleted song: " + title);

        // Drop the failed song from the queue, the next one shifts into its place
        currentSong = null;

        const qi = queue.findIndex(function (s) {
            return s.song_id === failed.song_id;
        });

        if (qi !== -1) {
            queue.splice(qi, 1);
        }

        renderList();
        playCurrent();
    }

    // Fisher Yates shuffle, returns a new shuffled copy of the array
    function shuffleCopy(arr) {

        const out = arr.slice();

        for (let i = out.length - 1; i > 0; i -= 1) {

            const j = Math.floor(Math.random() * (i + 1));
            const tmp = out[i];

            out[i] = out[j];
            out[j] = tmp;
        }

        return out;
    }

    // Build the play queue from song objects, optionally starting at one song
    // Holding objects keeps playback working even after switching feeds
    // Sequential keeps the Mureka order, shuffle randomizes it
    function buildQueue(startId) {

        // The song after this one is about to change, so anything prepared
        // for the old next is no longer wanted
        dropNextReady();

        let songs = orderedSongs().filter(passesFilters);

        // If the chosen start song is hidden by the filter, fall back to the full
        // library so a direct play request always works
        if (startId !== null && startId !== undefined) {

            const inPool = songs.some(function (s) {
                return s.song_id === startId;
            });

            if (!inPool) {
                songs = orderedSongs().slice();
            }
        }

        if (songs.length === 0) {
            queue = [];
            queuePos = -1;
            return;
        }

        if (shuffleMode) {

            if (startId === null || startId === undefined) {
                queue = shuffleCopy(songs);
                queuePos = 0;
                return;
            }

            const start = songs.find(function (s) {
                return s.song_id === startId;
            });

            const rest = shuffleCopy(songs.filter(function (s) {
                return s.song_id !== startId;
            }));

            queue = [start].concat(rest);
            queuePos = 0;
            return;
        }

        queue = songs;
        queuePos = (startId === null || startId === undefined)
            ? 0
            : Math.max(0, songs.findIndex(function (s) {
                return s.song_id === startId;
            }));
    }

    // Start playback from scratch, respecting the current shuffle mode
    function startPlay() {

        if (cache.songs.length === 0) {
            setStatus("Cache is empty, load first");
            return;
        }

        // Resume from where Stop or a restored session left off, keeping the
        // saved position within the song
        if (resumeState && resumeState.queue.length) {

            queue = resumeState.queue;
            queuePos = resumeState.queuePos;
            pendingSeek = resumeState.time || 0;
            resumeState = null;
            playCurrent();
            return;
        }

        // A live queue is still loaded, for example after an interruption cleared
        // the audio source. Continue it instead of building a fresh shuffle, so
        // songs already played this session are not heard again
        if (queue.length && queuePos >= 0 && queuePos < queue.length) {
            playCurrent();
            return;
        }

        buildQueue(null);
        playCurrent();
    }

    // Play a single song and continue from it per the current mode
    function playFrom(songId) {

        const exists = cache.songs.some(function (s) {
            return s.song_id === songId;
        });

        if (!exists) {
            return;
        }

        // Tapping the song that is already loaded never restarts it. Playing,
        // it is left alone, paused, it carries on from where it was. Losing
        // your place in a track you are part way through is the worst possible
        // answer to a mistaken tap. The queue is untouched either way, so a
        // shuffle order is not regenerated
        // With no audio loaded yet, as just after a restored queue, fall through
        if (currentSong && currentSong.song_id === songId && audio && audio.src) {

            if (audio.paused) {
                startAudioPlayback();
            }

            return;
        }

        buildQueue(songId);
        playCurrent();
    }

    // Insert a song to play right after the current one
    // With nothing playing yet, just start from that song
    function addNext(song) {

        if (queuePos < 0 || queuePos >= queue.length) {
            playFrom(song.song_id);
            return;
        }

        // Drop any later copy so the song does not also play again further on
        for (let i = queue.length - 1; i > queuePos; i -= 1) {

            if (queue[i].song_id === song.song_id) {
                queue.splice(i, 1);
            }
        }

        queue.splice(queuePos + 1, 0, song);
        renderList();

        // The next cover changed, so refresh the coverflow neighbors
        setArtTransition("none");
        setArtSources();
        positionArt(0);

        // Make sure the new next song is cached ready to play
        prefetchNext();

        setStatus("Playing next: " + (song.title || "Untitled"));
    }

    // Advance to the next song in the queue
    // Called when a song finishes on its own, repeat one replays the same song
    function handleSongEnded() {

        if (repeatMode === "one") {
            playCurrent();
            return;
        }

        playNext();
    }

    function playNext() {

        if (queuePos < queue.length - 1) {
            queuePos += 1;
            playCurrent();
            return;
        }

        // At the end, rebuild the whole queue and start over when repeating all
        // Rebuilding respects the active vocal filter and reshuffles, instead of
        // replaying earlier songs that no longer match the current filter
        if (repeatMode === "all") {

            buildQueue(null);

            if (queue.length > 0) {
                playCurrent();
                return;
            }
        }

        // Otherwise report finished
        queuePos = queue.length;
        playCurrent();
    }

    // Go to the previous song, or restart the current one if a few seconds in
    function playPrev() {

        if (audio && audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }

        if (queuePos > 0) {
            queuePos -= 1;
            playCurrent();
        } else if (repeatMode === "all" && queue.length > 0) {

            // At the first song, wrap around to the last when repeating all
            queuePos = queue.length - 1;
            playCurrent();
        } else if (audio) {
            audio.currentTime = 0;
        }
    }

    // Append newly loaded songs to the active queue so a running play-all keeps
    // growing as the library finishes loading
    // Existing order is preserved, only filter passing songs not already queued
    // are added, at the end, so the current upcoming order is not disturbed
    function extendQueueWithNew() {

        try {

            if (queuePos < 0 || queue.length === 0) {

                return;
            }

            const inQueue = new Set(queue.map(function (s) {

                return s.song_id;
            }));

            const added = orderedSongs().filter(function (s) {

                return passesFilters(s) && !inQueue.has(s.song_id);
            });

            if (added.length === 0) {

                return;
            }

            // Keep the played history and the current song untouched, and weave
            // the new songs into the not yet played part so nothing already in
            // the queue is reordered. Random spots when shuffle is on, otherwise
            // after the existing upcoming songs
            const head = queue.slice(0, queuePos + 1);
            const upcoming = queue.slice(queuePos + 1);

            if (shuffleMode) {

                for (const song of added) {

                    const at = Math.floor(Math.random() * (upcoming.length + 1));
                    upcoming.splice(at, 0, song);
                }

            } else {

                for (const song of added) {

                    upcoming.push(song);
                }
            }

            queue = head.concat(upcoming);
        } catch (e) {
        }
    }

    // Rebuild the upcoming part of the queue, keeping the current song and history
    // Applies the vocals filter and shuffle mode, then refreshes caching and art
    // Does nothing when nothing is playing, the next play picks up the changes
    function rebuildUpcoming() {

        dropNextReady();

        if (queuePos < 0 || queuePos >= queue.length) {
            return;
        }

        const played = queue.slice(0, queuePos + 1);

        const playedIds = new Set(played.map(function (s) {
            return s.song_id;
        }));

        // Songs not yet reached, kept in the Mureka sorted order then optionally
        // shuffled. orderedSongs is the displayed order, so with shuffle off the
        // queue matches the list. The vocals and playlist filters still apply
        let upcoming = orderedSongs().filter(function (s) {
            return !playedIds.has(s.song_id) && passesFilters(s);
        });

        if (shuffleMode) {
            upcoming = shuffleCopy(upcoming);
        }

        queue = played.concat(upcoming);
        renderList();

        // The upcoming order changed, keep the saved queue in step
        saveQueue();

        // Start caching the newly ordered upcoming songs first, so a slow or
        // failing coverflow refresh can never block the prefetch
        prefetchNext();

        // The upcoming order changed, so refresh the coverflow neighbors
        setArtTransition("none");
        setArtSources();
        positionArt(0);
    }

    // Toggle shuffle as a mode
    // While playing, this rebuilds only the upcoming songs, the current one stays
    function toggleShuffle() {

        shuffleMode = !shuffleMode;
        updateShuffleButton();
        rebuildUpcoming();
        setStatus(modeStatusText());

        // Remember the choice for the next session
        settings.shuffle = shuffleMode;
        saveSettings();
    }

    // Highlight the shuffle button when shuffle mode is active
    function updateShuffleButton() {

        if (!shuffleBtn) {
            return;
        }

        shuffleBtn.style.background = shuffleMode ? "#48e1eb" : "#333";
        shuffleBtn.style.color = shuffleMode ? "#000" : "#fff";
    }

    // Readable label for the current repeat mode
    function repeatLabel() {

        if (repeatMode === "all") {
            return "all";
        }

        if (repeatMode === "one") {
            return "one";
        }

        return "off";
    }

    // Combined mode line showing both shuffle and repeat state
    function modeStatusText() {

        return "Shuffle " + (shuffleMode ? "on" : "off") + ", repeat " + repeatLabel();
    }

    // Cycle repeat through all, one and none, remembering the choice
    function cycleRepeat() {

        if (repeatMode === "all") {
            repeatMode = "one";
        } else if (repeatMode === "one") {
            repeatMode = "none";
        } else {
            repeatMode = "all";
        }

        updateRepeatButton();

        // Update the playing row badge and the side cover greying for the new mode
        renderList();
        setArtTransition("none");
        positionArt(0);

        setStatus(modeStatusText());

        // Remember the choice for the next session
        settings.repeat = repeatMode;
        saveSettings();
    }

    // Update the repeat button icon and highlight to match the mode
    function updateRepeatButton() {

        if (!repeatBtn) {
            return;
        }

        // Replace the icon, repeat one shows a 1 inside the loop
        setTransportIcon(repeatBtn, makeRepeatIcon(repeatMode === "one"));

        const on = repeatMode !== "none";
        repeatBtn.style.background = on ? "#48e1eb" : "#333";
        repeatBtn.style.color = on ? "#000" : "#fff";
        repeatBtn.title = "Repeat: " + repeatLabel();
    }

    // Switch the list view and refresh
    function setView(view) {

        listView = view;

        // Remember the view so the next startup opens on it
        settings.view = view;
        saveSettings();

        updateViewButtons();
        updateViewMenuBar();
        closeViewMenu();

        // Drop the scroll button on a view change and ignore the scroll that
        // the re-render and scroll into view trigger right after
        fadeToTopBtn();
        programmaticScrollAt = Date.now();

        renderList();
        scrollToPlaying();

        lastListScroll = listEl ? listEl.scrollTop : 0;
    }

    // Scroll the list so the currently playing song is centered, if present
    function scrollToPlaying() {

        if (!listEl || !playingItemEl) {
            return;
        }

        const target = playingItemEl.offsetTop
            - (listEl.clientHeight / 2)
            + (playingItemEl.offsetHeight / 2);

        // This is our own scroll, not the user, so the jump button stays hidden
        programmaticScrollAt = Date.now();

        listEl.scrollTop = Math.max(0, target);
    }

    // Point the scroll button at the matching edge for the scroll direction,
    // down jumps to the end of the list, up jumps back to the beginning
    function setToTopArrow(dir) {

        if (!toTopBtn || toTopDir === dir) {
            return;
        }

        toTopDir = dir;

        const down = dir === "down";

        toTopBtn.textContent = down ? "\u2193" : "\u2191";
        toTopBtn.title = down ? "Scroll to end" : "Scroll to top";
        toTopBtn.setAttribute("aria-label", down ? "Scroll to end" : "Scroll to top");
    }

    // Reveal the scroll button and arm the idle fade timer
    function showToTopBtn() {

        if (!toTopBtn) {
            return;
        }

        toTopBtn.style.opacity = "1";
        toTopBtn.style.pointerEvents = "auto";

        if (toTopTimer) {
            window.clearTimeout(toTopTimer);
        }

        // Fade the button away after a spell with no scrolling
        toTopTimer = window.setTimeout(fadeToTopBtn, 5000);
    }

    // Fade the scroll button out and stop it catching taps
    function fadeToTopBtn() {

        if (toTopTimer) {
            window.clearTimeout(toTopTimer);
            toTopTimer = 0;
        }

        if (!toTopBtn) {
            return;
        }

        toTopBtn.style.opacity = "0";
        toTopBtn.style.pointerEvents = "none";
    }

    // Jump to the end when the down arrow shows, the beginning when up shows
    function scrollListEdge() {

        if (!listEl) {
            return;
        }

        // The end of the list only exists once every row has been built
        if (toTopDir === "down") {
            renderMoreRows(Infinity);
        }

        const target = toTopDir === "down" ? listEl.scrollHeight : 0;

        // The button has done its job, and the smooth scroll that follows is
        // not the user, so it must not bring the button straight back
        fadeToTopBtn();
        edgeJumpUntil = Date.now() + 2500;

        listEl.scrollTo({ top: target, behavior: "smooth" });
    }

    // How far the list must be pulled before a release triggers a refresh
    const PULL_TRIGGER = 64;

    // The maximum visual travel of the pull, the drag past this is absorbed
    const PULL_MAX = 90;

    // Convert raw finger travel into a damped pull so it feels rubbery
    function dampPull(dy) {

        return Math.min(PULL_MAX, dy * 0.5);
    }

    // Reflect the current pull distance on the indicator, fully lit when ready
    function updatePullIndicator(dist) {

        if (!pullEl) {
            return;
        }

        const ratio = Math.min(1, dist / PULL_TRIGGER);
        pullEl.style.opacity = String(ratio);
        pullEl.firstChild.style.transform = "rotate(" + (dist * 3) + "deg)";
    }

    // Animate the list back to rest and clear the pull state
    function resetPull() {

        pulling = false;
        pullArmed = false;
        pullDist = 0;

        if (!listEl) {
            return;
        }

        listEl.style.transition = "transform 0.2s ease";
        listEl.style.transform = "translateY(0)";

        if (pullEl) {
            pullEl.style.opacity = "0";
            pullEl.firstChild.style.animation = "";
        }

        // Drop the transition again so the next live drag is not animated
        window.setTimeout(function () {

            if (listEl) {
                listEl.style.transition = "";
            }
        }, 220);
    }

    // Hold the list open with a spinning icon while a refresh runs
    async function triggerPullRefresh() {

        if (running) {
            resetPull();
            return;
        }

        refreshing = true;
        listEl.style.transition = "transform 0.2s ease";
        listEl.style.transform = "translateY(44px)";

        if (pullEl) {
            pullEl.style.opacity = "1";
            pullEl.firstChild.style.transform = "";
            pullEl.firstChild.style.animation = "mureka-spin 0.8s linear infinite";
        }

        try {
            await run();
        } catch (err) {
            // Ignore, run reports its own status
        }

        refreshing = false;
        resetPull();
    }

    // Fullscreen on an iPhone is dismissed by a downward swipe, and WebKit runs
    // that gesture from anywhere in the list, not only at its ends, so a drag
    // meant to move a little further up the list drops out of fullscreen
    // instead. A gesture the browser owns cannot be turned off and no CSS
    // reaches it. The one thing that does is taking the touch: while fullscreen
    // is on, the move events are consumed and the list is scrolled by hand, so
    // that gesture never sees a swipe to act on
    //
    // Nothing is lost by it. The pull to refresh runs from the same handler,
    // and the flick keeps gliding after the finger leaves, both driven here
    // rather than by the browser
    function handScrollActive() {

        return isFullscreen() && isIosLike();
    }

    // What the page had before fullscreen locked it, so it gets it back
    let savedRootOverflow = null;
    let savedBodyOverflow = null;

    // The fullscreen state the layout was last brought in line with, and the
    // routine that does it, set once the panel is built. Safari drops
    // fullscreen by itself when the app is switched or the page goes to the
    // background, and the change event for that is either never delivered or
    // handled while the page is hidden, where the measurements are wrong. The
    // page then kept the fullscreen height and the page scroll lock, which
    // pushed the bottom of the panel, and of the filter sheet filling it, off
    // the screen until fullscreen was entered and left again by hand
    let appliedFullscreen = null;
    let fullscreenRefresh = null;

    // Bring the layout in line when the real fullscreen state has moved on
    // without the change being handled
    function syncFullscreenState() {

        if (fullscreenRefresh && appliedFullscreen !== isFullscreen()) {
            fullscreenRefresh();
        }
    }

    // Fullscreen here is asked for on the page itself, which is what lets the
    // menu and the overlays stay visible, since they are not inside the panel.
    // The cost is that a drag which reaches the page is read by WebKit as the
    // swipe that leaves fullscreen, and no amount of handling inside an element
    // changes that, because the gesture belongs to the page and not to the
    // element. Taking the page scroll away leaves that gesture nothing to act
    // on. The list is scrolled by hand while this is on, so nothing is lost
    //
    // touch-action tells the browser not to treat these touches as a gesture of
    // its own in the first place, which is the part preventDefault cannot do,
    // since by the time a move event is delivered the browser has often already
    // decided what the touch is
    function updateFullscreenScrollLock() {

        const active = handScrollActive();
        const root = document.documentElement;
        const body = document.body;

        if (listEl) {
            listEl.classList.toggle("mureka-hand-scroll", active);
        }

        if (active) {

            if (savedRootOverflow === null) {

                savedRootOverflow = root.style.overflow;
                savedBodyOverflow = body ? body.style.overflow : "";
            }

            root.style.overflow = "hidden";

            if (body) {
                body.style.overflow = "hidden";
            }

            return;
        }

        if (savedRootOverflow !== null) {

            root.style.overflow = savedRootOverflow;

            if (body) {
                body.style.overflow = savedBodyOverflow;
            }

            savedRootOverflow = null;
            savedBodyOverflow = null;
        }
    }

    // Live drag state for the hand driven scroll
    let dragging = false;
    let dragMoved = false;
    let dragStartY = 0;
    let dragLastY = 0;
    let dragLastT = 0;

    // Pixels per millisecond, carried into the glide when the finger lifts
    let dragVelocity = 0;
    let glideFrame = 0;

    // Where the current pull began, which is not where the touch began, since
    // the list may have been scrolled up to its top first
    let pullFromY = 0;

    // Below this a touch is a tap, above it a drag, so a tap still reaches the
    // row under it and still opens a song
    const DRAG_SLOP = 4;

    // How much of its speed the glide keeps each frame, and the speed below
    // which it has arrived. Both are per frame rather than per pixel, so they
    // feel the same on any screen
    const GLIDE_FRICTION = 0.94;
    const GLIDE_STOP = 0.02;

    function nowMs() {

        return window.performance && performance.now
            ? performance.now()
            : Date.now();
    }

    function stopGlide() {

        if (glideFrame) {

            cancelAnimationFrame(glideFrame);
            glideFrame = 0;
        }
    }

    // Keep the list moving after the finger leaves, slowing to a stop
    function startGlide() {

        let velocity = dragVelocity;

        const step = function () {

            glideFrame = 0;

            if (Math.abs(velocity) < GLIDE_STOP || !listEl) {
                return;
            }

            const before = listEl.scrollTop;

            // One frame worth of travel at the current speed
            listEl.scrollTop += velocity * 16;

            // Ran into an end, so there is nowhere left to glide
            if (listEl.scrollTop === before) {
                return;
            }

            velocity *= GLIDE_FRICTION;
            glideFrame = requestAnimationFrame(step);
        };

        stopGlide();
        glideFrame = requestAnimationFrame(step);
    }

    // Begin a possible pull only when the list is already at the very top
    function onListTouchStart(ev) {

        if (refreshing || ev.touches.length !== 1) {
            pullArmed = false;
            dragging = false;
            return;
        }

        if (handScrollActive()) {

            stopGlide();

            dragging = true;
            dragMoved = false;
            dragStartY = ev.touches[0].clientY;
            dragLastY = dragStartY;
            dragLastT = nowMs();
            dragVelocity = 0;
            pulling = false;
            pullArmed = false;
            return;
        }

        dragging = false;

        if (listEl.scrollTop <= 0) {
            pullArmed = true;
            pulling = false;
            pullStartY = ev.touches[0].clientY;
        } else {
            pullArmed = false;
        }
    }

    // Track the drag, taking over only while pulling down from the top
    function onListTouchMove(ev) {

        if (dragging) {
            onHandScrollMove(ev);
            return;
        }

        if (!pullArmed || refreshing) {
            return;
        }

        const dy = ev.touches[0].clientY - pullStartY;

        if (dy > 0 && listEl.scrollTop <= 0) {
            pulling = true;
            ev.preventDefault();
            pullDist = dampPull(dy);
            listEl.style.transform = "translateY(" + pullDist + "px)";
            updatePullIndicator(pullDist);
        } else if (dy < 0) {

            // The finger moved up, hand the gesture back to normal scrolling
            if (pulling) {
                resetPull();
            }

            pullArmed = false;
        }
    }

    // Move the list with the finger, and pull it open at the top
    function onHandScrollMove(ev) {

        if (refreshing || !listEl || ev.touches.length !== 1) {
            return;
        }

        const y = ev.touches[0].clientY;

        if (!dragMoved && Math.abs(y - dragStartY) > DRAG_SLOP) {
            dragMoved = true;
        }

        if (!dragMoved) {
            dragLastY = y;
            return;
        }

        // From here the touch belongs to the list, which is what keeps the
        // dismiss gesture from ever seeing it
        ev.preventDefault();

        const moment = nowMs();
        const dy = y - dragLastY;
        const dt = Math.max(1, moment - dragLastT);

        dragLastY = y;
        dragLastT = moment;

        // Already at the top and still heading down, so this is the refresh
        // gesture rather than a scroll
        if (!pulling && dy > 0 && listEl.scrollTop <= 0) {

            pulling = true;
            pullFromY = y;
        }

        if (pulling) {

            const pulled = y - pullFromY;

            // Pushed back up past where it started, so it is a scroll again
            if (pulled <= 0) {

                resetPull();
                pulling = false;

            } else {

                pullDist = dampPull(pulled);
                listEl.style.transform = "translateY(" + pullDist + "px)";
                updatePullIndicator(pullDist);
                return;
            }
        }

        listEl.scrollTop -= dy;
        dragVelocity = -dy / dt;
    }

    // On release, refresh if pulled far enough, otherwise spring back
    function onListTouchEnd() {

        if (dragging) {

            dragging = false;

            if (pulling) {

                if (pullDist >= PULL_TRIGGER) {
                    triggerPullRefresh();
                } else {
                    resetPull();
                }

                return;
            }

            if (dragMoved) {
                startGlide();
            }

            return;
        }

        if (!pulling) {
            pullArmed = false;
            return;
        }

        if (pullDist >= PULL_TRIGGER) {
            triggerPullRefresh();
        } else {
            resetPull();
        }
    }

    // Highlight the active view button
    function updateViewButtons() {

        Object.keys(viewButtons).forEach(function (name) {

            const btn = viewButtons[name];

            if (!btn) {
                return;
            }

            const active = name === listView;

            btn.style.background = active ? "#48e1eb" : "#333";
            btn.style.color = active ? "#000" : "#fff";
        });
    }

    // Change the vocals filter, save it and re-render the list
    function setVocalFilter(value) {

        settings.vocalFilter = value;
        saveSettings();
        updateFilterButtons();
        updateVocalsCtrlButton();
        updateViewMenuBar();
        closeViewMenu();

        // Rebuild the upcoming queue so the filter takes effect while playing,
        // then re-render so the list and counts update in every view
        rebuildUpcoming();
        renderList();
    }

    // Highlight the active vocals filter button
    // Show which way the vocals filter is set on the transport button
    function updateVocalsCtrlButton() {

        if (!vocalsCtrlBtn) {
            return;
        }

        const mode = settings.vocalFilter;

        // The same icons the filter rows under the search box use, so the two
        // ways of setting this look like the one thing they are
        const icon = mode === "vocal"
            ? iconVocals()
            : (mode === "instrumental" ? iconInstrumental() : iconAll());

        setTransportIcon(vocalsCtrlBtn, icon);
        updateControlLabels();

        vocalsCtrlBtn.title = mode === "vocal"
            ? "Vocals only, tap for instrumental"
            : (mode === "instrumental" ? "Instrumental only, tap for all" : "All songs, tap for vocals");

        // Highlighted whenever it is actually filtering something out
        const on = mode !== "all";

        vocalsCtrlBtn.style.background = on ? "#48e1eb" : "#333";
        vocalsCtrlBtn.style.color = on ? "#000" : "#fff";
    }

    // A filter left on from last time must be visible, otherwise a short list
    // looks like lost songs rather than a filter doing its job
    function updateSmartFilterButton() {

        if (!smartFilterBtn) {
            return;
        }

        const on = tagFilterActive() || bpmFilterActive()
            || modelFilterActive() || dateFilterActive() || ratingFilterActive();

        // Only the on off switch beside it shows whether filtering is live.
        // This one just opens the sheet, and lighting both made two buttons
        // claim the same state
        smartFilterBtn.style.background = "#333";
        smartFilterBtn.style.color = "#fff";

        const bits = [];

        for (const name of settings.tagGenres) {
            bits.push(name);
        }

        for (const name of settings.tagMoods) {
            bits.push(name);
        }

        if (settings.bpmMin > 0 || settings.bpmMax > 0) {
            bits.push((settings.bpmMin || "0") + " to " + (settings.bpmMax || "any") + " BPM");
        }

        for (const name of settings.tagModels) {
            bits.push(name);
        }

        if (dateFilterActive()) {
            bits.push(dateFilterLabel());
        }

        if (ratingFilterActive()) {
            bits.push(ratingFilterLabel());
        }

        smartFilterBtn.labelEl.textContent = "Edit filters";
        smartFilterBtn.title = on
            ? "Filtering by " + bits.join(", ")
            : "Filter by genre, mood, tempo, date, model and rating";

        if (smartToggleBtn) {

            const hasAny = settings.tagGenres.length > 0 || settings.tagMoods.length > 0
                || settings.tagModels.length > 0 || settings.bpmEnabled
                || settings.dateEnabled || settings.ratingEnabled;

            smartToggleBtn.labelEl.textContent = settings.smartEnabled ? "Filters on" : "Filters off";
            smartToggleBtn.style.background = on ? "#48e1eb" : "#333";
            smartToggleBtn.style.color = on ? "#000" : "#fff";

            // Nothing to switch when nothing is set up
            smartToggleBtn.style.opacity = hasAny ? "1" : "0.4";
            smartToggleBtn.disabled = !hasAny;
        }
    }

    function updateFilterButtons() {

        Object.keys(filterButtons).forEach(function (value) {

            const btn = filterButtons[value];

            if (!btn) {
                return;
            }

            const active = value === settings.vocalFilter;

            btn.style.background = active ? "#48e1eb" : "#333";
            btn.style.color = active ? "#000" : "#fff";
        });
    }

    // Update the compact bar label to show the current view and filter
    function updateViewMenuBar() {

        if (!viewMenuBar) {
            return;
        }

        const v = listView === "queue"
            ? "Queue"
            : (listView === "alpha" ? "A-Z" : "Mureka");

        const f = settings.vocalFilter === "vocal"
            ? "Vocals"
            : (settings.vocalFilter === "instrumental" ? "Instrumental" : "All");

        // Name the smart filters on the bar itself. A short list with no reason
        // on screen reads as lost songs, and this is the line the eye lands on
        const parts = [v, f];

        for (const name of settings.tagGenres) {
            parts.push(name);
        }

        for (const name of settings.tagMoods) {
            parts.push(name);
        }

        if (bpmFilterActive() && (settings.bpmMin > 0 || settings.bpmMax > 0)) {

            parts.push((settings.bpmMin || 0) + " to "
                + (settings.bpmMax > 0 ? settings.bpmMax : "any") + " BPM");
        }

        if (modelFilterActive()) {

            for (const name of settings.tagModels) {
                parts.push(name);
            }
        }

        if (dateFilterActive()) {
            parts.push(dateFilterLabel());
        }

        if (ratingFilterActive()) {
            parts.push(ratingFilterLabel());
        }

        const filtering = tagFilterActive() || bpmFilterActive()
            || modelFilterActive() || dateFilterActive() || ratingFilterActive();

        viewMenuBar.textContent = "";

        // A funnel in front of the text while a smart filter is on, so an
        // active filter is visible without reading the whole line
        if (filtering) {

            const mark = iconFilter();

            mark.setAttribute("width", "13");
            mark.setAttribute("height", "13");
            mark.style.cssText = "flex:0 0 auto;color:#48e1eb";

            viewMenuBar.appendChild(mark);
        }

        const label = document.createElement("span");

        label.textContent = parts.join("  \u00B7  ") + "  \u25BE";

        viewMenuBar.appendChild(label);
    }

    // The songs to show for the current view
    // The number shown per song is always its Mureka position, set in renderSongs
    // The songs in their canonical order for the current source
    // Your own Published feed, once fully loaded, is ordered by publish date
    // newest published first, matching the Mureka website, so a freshly
    // published older song appears at the top. Every other case keeps the
    // creation order the API returns
    function orderedSongs() {

        if (!creatorSource && publishFilter === "published" && cache.complete) {

            return cache.songs.slice().sort(function (a, b) {
                return (b.publish_at || 0) - (a.publish_at || 0);
            });
        }

        return cache.songs;
    }

    function displaySongs() {

        if (listView === "alpha") {

            return cache.songs.slice().sort(function (a, b) {
                return (a.title || "").trim().localeCompare((b.title || "").trim());
            });
        }

        if (listView === "queue") {

            // The full queue, played songs included so you can scroll back
            // Played songs are greyed out in renderSongs
            return queue.slice();
        }

        // Default Mureka view, the canonical order for the current source
        return orderedSongs();
    }

    // Play whatever song the queue currently points at
    async function playCurrent() {

        if (queuePos < 0 || queuePos >= queue.length) {
            currentSong = null;
            renderList();
            updatePlayerInfo(null);
            setStatus("Playback finished");
            return;
        }

        const song = queue[queuePos];

        // A removed song left a hole, skip past it
        if (!song) {
            queue.splice(queuePos, 1);
            playCurrent();
            return;
        }

        ensureAudio();
        currentSong = song;

        // Drop counts from the previous song until the detail call returns
        nowPlayingCounts = null;

        // Show art and title right away, even while the audio is still loading
        updatePlayerInfo(song);
        renderList();
        scrollToPlaying();

        // Mark this as the current play, a newer play makes this one stale
        const token = playToken + 1;
        playToken = token;

        // Offline the direct stream cannot work, so fall through to the cache
        // path below, which serves the stored copy and keeps playback going
        // A URL prepared while the previous song played needs no waiting at
        // all, so it is the first choice, and it works with no signal since it
        // came out of the cache
        if (nextReady && nextReady.song_id === song.song_id) {

            const ready = nextReady.url;

            nextReady = null;
            setCurrentSrc(ready);
            startAudioPlayback();

        } else if (settings.directAudio && (navigator.onLine !== false || document.hidden)) {

            // songUrl is synchronous, so the source is set and play is called
            // with the user activation still valid. iOS drops that token across
            // an await, which silently rejects the play and blocks a resume.
            // Hidden, this is tried even when the browser claims to be offline:
            // that flag flickers on a drive, and a direct attempt that fails is
            // still better than an awaited path that is refused for certain

            const direct = songUrl(song);

            if (!direct) {
                setStatus("Could not build a URL for this song");
                return;
            }

            setCurrentSrc(direct);
            startAudioPlayback();

            // The copy for offline replay is fetched once playing fires, see
            // the playing listener in ensureAudio, so it never competes with
            // the stream for bandwidth

        } else {

            const url = await getPlayableUrl(song);

            // A newer play started while fetching, drop this one
            if (token !== playToken) {

                if (url && url.indexOf("blob:") === 0) {
                    URL.revokeObjectURL(url);
                }

                return;
            }

            if (!url) {
                setStatus("Could not build a URL for this song");
                return;
            }

            setCurrentSrc(url);
            startAudioPlayback();
        }

        // Remember the queue and position so a restart can resume here
        saveQueue();

        // Tell Mureka the song was played, unless the user opted out
        if (settings.reportPlays) {
            reportPlay(song);
        }

        // Fetch play and like counts to show under the now playing title. The
        // previous song's lyrics and waveform must not linger while it loads
        lyricRows = [];
        lyricIdx = -1;
        waveData = null;
        updateLyricLine(true);
        updateSeekMode();
        loadWaveForSong(song);
        fetchNowPlayingCounts(song);

        // The current song is cached now, get upcoming songs ready in the background
        prefetchNext();
    }

    // Report a play to Mureka, fire and forget so it never blocks playback
    // The body matches the site, play_type 1 is a normal play, playlist_id 0
    async function reportPlay(song) {

        try {
            await fetch("/api/pgc/song/play/report", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    time: Date.now(),
                    song_id: song.song_id,
                    play_type: 1,
                    playlist_id: 0
                })
            });
        } catch (e) {
        }
    }

    // Fetch play, favorite and share counts for the now playing song
    // The counts live at the data level of the detail response, beside song
    // Only apply them while this song is still the current one
    // A stable Cache API key for a song's stored detail entry
    function detailStoreKey(id) {

        return "https://mureka-detail-cache/" + encodeURIComponent(id);
    }

    // Read a song's stored detail entry, or null when it has none
    async function loadDetailFromStore(id) {

        try {

            const store = await caches.open(DETAIL_STORE);
            const res = await store.match(detailStoreKey(id));

            if (!res) {

                return null;
            }

            return await res.json();
        } catch (e) {

            return null;
        }
    }

    // Persist a song's detail entry, replacing any older copy
    async function saveDetailToStore(id, entry) {

        try {

            const store = await caches.open(DETAIL_STORE);

            await store.put(detailStoreKey(id), new Response(JSON.stringify(entry), {
                headers: { "Content-Type": "application/json" }
            }));
        } catch (e) {
        }
    }

    // Whether a stored entry is still inside the age allowed by the settings
    function detailIsFresh(entry) {

        if (!entry || typeof entry.t !== "number") {
            return false;
        }

        const hours = settings.countsMaxAge || 4;

        return (Date.now() - entry.t) < hours * 3600000;
    }

    // Pulse the counts line while the numbers are being refetched, the same
    // fading blink the song list uses for a cover or song being cached
    function setCountsLoading(on) {

        if (!playerCountsEl) {
            return;
        }

        playerCountsEl.style.animation = on
            ? "mureka-pulse 1s ease-in-out infinite"
            : "";
    }

    // Show a stored or freshly fetched detail entry for the song
    function applyDetail(song, entry) {

        if (!currentSong || currentSong.song_id !== song.song_id) {
            return;
        }

        nowPlayingCounts = {
            song_id: song.song_id,
            play_count: entry.play_count,
            fav_count: entry.fav_count,
            share_count: entry.share_count
        };

        // The lyrics ride along in the same entry, so a stored one needs no
        // request at all and the rows appear as soon as the song starts
        lyricRows = Array.isArray(entry.lyrics) ? entry.lyrics : [];
        lyricIdx = -1;
        updateLyricLine(true);
        refreshNowPlayingMeta();
    }

    // Fetch the detail endpoint and store what it gives us
    async function fetchDetail(song) {

        try {
            const url = "/api/pgc/song/detail?time=" + Date.now()
                + "&song_id=" + song.song_id;

            const res = await timedFetch(url, { credentials: "include" });
            const json = await res.json();

            if (!json || json.code !== 0 || !json.data) {
                return null;
            }

            apiOk = true;

            const d = json.data;

            const entry = {
                play_count: d.play_count,
                fav_count: d.fav_count,
                share_count: d.share_count,
                lyrics: buildLyricRows(d.lyrics || (d.song && d.song.lyrics)),
                t: Date.now()
            };

            saveDetailToStore(song.song_id, entry);

            // The detail response is not known to carry the waveform, but if it
            // ever does, take it, without clobbering one loaded from the store
            const w = normalizeWave(extractWaveList(d));

            if (w) {

                saveWaveToStore(song.song_id, w);

                if (currentSong && currentSong.song_id === song.song_id) {

                    waveData = w;
                    updateSeekMode();
                }
            }

            return entry;
        } catch (e) {

            return null;
        }
    }

    // Bring a song's counts up to date without touching the display, used to
    // refresh the songs coming up next in the background
    async function prefetchDetail(song) {

        if (navigator.onLine === false) {
            return;
        }

        const stored = await loadDetailFromStore(song.song_id);

        if (detailIsFresh(stored)) {
            return;
        }

        await fetchDetail(song);
    }

    // Show the counts and lyrics for the song now playing. A stored entry is
    // shown at once, and only refetched when it is older than the setting
    async function fetchNowPlayingCounts(song) {

        const mine = currentSong && currentSong.song_id === song.song_id;

        if (mine) {
            setCountsLoading(false);
        }

        const stored = await loadDetailFromStore(song.song_id);

        if (stored) {
            applyDetail(song, stored);
        }

        // A stored entry with no lyrics for a song that sings is suspect. The
        // detail may have been fetched while the song was still being made,
        // before its lyrics existed, and it would then sit in the store for
        // hours looking fresh. Ask again rather than trust it
        const lyricsMissing = stored
            && (!Array.isArray(stored.lyrics) || stored.lyrics.length === 0)
            && !isInstrumental(song);

        if (detailIsFresh(stored) && !lyricsMissing) {
            return;
        }

        // Blink the numbers while they are being refreshed from the server
        if (mine) {
            setCountsLoading(true);
        }

        const entry = await fetchDetail(song);

        if (currentSong && currentSong.song_id === song.song_id) {
            setCountsLoading(false);
        }

        if (entry) {
            applyDetail(song, entry);
        }
    }

    // Cache the next songs in the queue so playback does not wait on the network
    async function prefetchNext() {

        // Needs no network, only the cache, so it happens before the online
        // check and even when there is no signal
        await prepareNextReady();

        // Nothing to gain from queueing requests that cannot succeed
        if (navigator.onLine === false) {
            return;
        }

        for (let i = 1; i <= settings.prefetchCount; i += 1) {

            const pos = queuePos + i;

            if (pos >= queue.length) {
                break;
            }

            const song = queue[pos];

            if (!song) {
                continue;
            }

            // Pre-cache the cover too, cacheArt skips if it is already stored
            await cacheArt(song);

            // Refresh the counts ahead of time, so the numbers are already
            // current when the song reaches the top of the queue
            await prefetchDetail(song);

            if (cachedIds.has(song.song_id)) {
                continue;
            }

            const ok = await fetchToCache(song);

            if (ok) {

                cachedIds.add(song.song_id);
                renderList();

                // The immediate next song just became available from the cache
                if (i === 1) {
                    await prepareNextReady();
                }
            }
        }
    }

    // Start the element and deal with the returned promise. A rejected play is
    // exactly what a blocked resume after an interruption looks like, so it is
    // surfaced and the handlers are re-registered instead of failing silently
    function startAudioPlayback() {

        // Nothing loaded, as after Stop or a restored queue, so start or resume
        // through the queue instead of playing an empty element
        if (!audio || !audio.src) {
            startPlay();
            return;
        }

        // An element that failed to load stays dead until its source is reset,
        // so a play press after a network error reloads the current song
        if (audio.error) {
            playCurrent();
            return;
        }

        userPaused = false;

        const started = audio.play();

        if (!started || typeof started.catch !== "function") {
            return;
        }

        started.catch(function (err) {

            switchingTrack = false;

            // A pending play is aborted by a quick skip to the next song, that
            // is not a blocked resume and not worth a status line
            if (err && err.name === "AbortError") {
                return;
            }

            setStatus("Playback blocked: " + ((err && err.name) || "error"));
            updatePlayPause();
            setupMediaSession();
        });
    }

    // Point the audio element at a URL, cleaning up the previous blob URL
    function setCurrentSrc(url) {

        // The load that follows flips paused, mark it so the pause listener
        // does not read that as an interruption, cleared once playing fires
        switchingTrack = true;

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }

        if (url.indexOf("blob:") === 0) {
            currentObjectUrl = url;
        }

        audio.src = url;
        updateSeekDisplay();
    }

    // Stop playback and clear the queue
    function stopPlay() {

        dropNextReady();

        // This pause is deliberate, so the pause listener must not take the
        // interruption path and re-send now playing for a song being stopped
        userPaused = true;

        if (audio) {
            audio.pause();
        }

        // Remember where we were so Play resumes the same song and queue
        if (currentSong && queue.length) {

            resumeState = {
                queue: queue,
                queuePos: queuePos,
                time: (audio && isFinite(audio.currentTime)) ? audio.currentTime : 0
            };
        }

        // Persist the resume point so it also survives a restart
        saveQueue();

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }

        // Unload the audio so Play routes through resume instead of the old song
        if (audio) {
            audio.removeAttribute("src");
            audio.load();
        }

        // Clear the live state so the art and queue highlight disappear
        currentSong = null;
        queue = [];
        queuePos = -1;
        renderList();
        updatePlayerInfo(null);
        updatePlayPause();
        setStatus("Stopped");
    }

    // Download every cached song mp3 into the audio cache for instant replay
    async function cacheAll() {

        if (cacheRunning) {
            cacheRunning = false;
            return;
        }

        if (cache.songs.length === 0) {
            setStatus("Cache is empty, load first");
            return;
        }

        cacheRunning = true;
        updateCacheButton();

        let done = 0;
        let ok = 0;
        let fail = 0;

        for (const song of cache.songs) {

            if (!cacheRunning) {
                break;
            }

            // Pre-cache the cover alongside the audio
            await cacheArt(song);

            const success = await fetchToCache(song);

            done += 1;

            if (success) {
                ok += 1;
                cachedIds.add(song.song_id);
                renderList();
            } else {
                fail += 1;
            }

            setStatus("Caching " + done + " / " + cache.songs.length + ", stored " + ok);
        }

        cacheRunning = false;
        updateCacheButton();
        refreshCachedIds();

        if (ok === 0 && fail > 0) {
            setStatus("Caching failed, the audio host blocked the download");
        } else {
            setStatus("Cached " + ok + " songs" + (fail ? ", " + fail + " failed" : ""));
        }
    }

    // Save the songs visible under the current filters into the Mureka folder
    // Honors the vocals and playlist filters and skips already downloaded songs
    async function downloadAll() {

        if (cache.songs.length === 0) {
            setStatus("Cache is empty, load first");
            return;
        }

        // Only the songs that pass the active filters, minus the ones we have
        // already requested before, so repeat runs only fetch the new ones
        const pending = cache.songs.filter(function (s) {
            return passesFilters(s) && !downloadedIds.has(s.song_id);
        });

        const items = pending.map(function (s) {
            return { url: songUrl(s), filename: "Mureka/" + fileName(s) };
        }).filter(function (it) {
            return it.url;
        });

        if (items.length === 0) {
            setStatus("Nothing new to download for the current view");
            return;
        }

        // Mark them as downloaded up front, the folder is not readable from here
        pending.forEach(function (s) {
            downloadedIds.add(s.song_id);
        });
        saveDownloadedIds();
        renderList();

        setStatus("Saving " + items.length + " songs to the Mureka folder...");
        requestDownload(items);
    }

    // Reflect the running state on the cache button
    function updateCacheButton() {

        if (!cacheButton) {
            return;
        }

        cacheButton.labelEl.textContent = cacheRunning ? "Stop" : "Cache all";
        setButtonIcon(cacheButton, cacheRunning ? iconStop() : iconCache());
    }

    // Position a floating dropdown just under an anchor, spanning the panel width
    // Fixed positioning keeps it above the player without reflowing the content
    // Everything is clamped to the viewport so the dropdown never runs off screen
    function placePopupUnder(popup, anchorEl) {

        const margin = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const pr = panelEl.getBoundingClientRect();
        const ar = anchorEl.getBoundingClientRect();

        // Follow the panel width, but never wider than the viewport
        let width = Math.min(pr.width, vw) - margin * 2;

        if (width < 120) {
            width = vw - margin * 2;
        }

        // Align with the panel, then keep the whole dropdown on screen
        let left = pr.left + margin;
        const maxLeft = vw - width - margin;

        if (left > maxLeft) {
            left = maxLeft;
        }

        if (left < margin) {
            left = margin;
        }

        // Sit just under the anchor, clamped to the viewport height
        let top = ar.bottom + 4;
        const maxTop = vh - 60;

        if (top > maxTop) {
            top = maxTop;
        }

        if (top < 4) {
            top = 4;
        }

        popup.style.left = left + "px";
        popup.style.width = width + "px";
        popup.style.top = top + "px";
    }

    // Close the floating action dropdown
    function closeActions() {

        actionsOpen = false;

        if (actionsWrapEl) {
            actionsWrapEl.style.display = "none";
        }
    }

    // Close the floating view and filter dropdown
    function closeViewMenu() {

        viewMenuOpen = false;

        if (viewMenuEl) {
            viewMenuEl.style.display = "none";
        }
    }

    // Open or close the floating action dropdown
    function toggleActions() {

        if (actionsOpen) {
            closeActions();
            return;
        }

        // Only one dropdown open at a time
        closeViewMenu();
        actionsOpen = true;

        if (actionsWrapEl) {
            actionsWrapEl.style.display = "flex";
            placePopupUnder(actionsWrapEl, actionsToggleBtn);
        }
    }

    // Open or close the floating view and filter dropdown
    function toggleViewMenu() {

        if (viewMenuOpen) {
            closeViewMenu();
            return;
        }

        closeActions();
        viewMenuOpen = true;

        if (viewMenuEl) {
            viewMenuEl.style.display = "flex";
            placePopupUnder(viewMenuEl, viewMenuBar);
        }
    }

    // Close both dropdowns, used on outside clicks, scroll, resize and drag
    function closeDropdowns() {

        closeActions();
        closeViewMenu();
    }

    // Full screen black overlay used as a stand in for the screen switching
    // off. The phone must stay unlocked to keep the controls reachable without
    // Face ID, so the screen is kept awake and simply painted black instead
    let blackoutEl = null;

    // The screen wake lock, held while the player is visible and playing
    let wakeLock = null;

    // Idle timer that drops the blackout in when nothing has been touched
    let idleTimer = null;

    // The dim mark drawn on the cover, and the timer that keeps moving it
    let blackoutMarkEl = null;
    let driftTimer = null;

    // True once an API call has succeeded, which only happens with a live
    // login. On the sign in page nothing succeeds, so the cover stays away
    // instead of hiding the form the user is trying to fill in
    let apiOk = false;

    // The start gate, a single big button shown instead of the player until
    // fullscreen has been entered. Fullscreen is only granted from a real tap,
    // which a timer can never produce, so this manufactures the one tap needed
    let gateEl = null;

    // True only when fullscreen was left through the menu toggle. Switching
    // apps or backgrounding the browser also drops fullscreen, and that is not
    // a decision to stop using it, so the gate must still offer the way back.
    // Pressing Exit full is a decision, so the gate stays out of the way then
    let leftFullscreenOnPurpose = false;

    // The page background from before the cover went up, so it can be put back
    let priorPageBackground = null;

    // The fade out currently running, so showing again can cancel it before its
    // completion handler hides a cover that is meant to be visible
    let blackoutHideAnim = null;

    // When the cover went up. The tap that raises it also produces a pointer
    // event afterwards, which would land on the cover and dismiss it at once,
    // so events within a short grace period after showing are ignored
    let blackoutShownAt = 0;

    // Ask the system to keep the screen on, so the phone does not lock and
    // ask for Face ID while driving. Safari has supported this since 16.4
    async function requestWakeLock() {

        if (!navigator.wakeLock || wakeLock || document.hidden) {
            return;
        }

        try {
            wakeLock = await navigator.wakeLock.request("screen");

            // The system drops the lock whenever the page is hidden
            wakeLock.addEventListener("release", function () {
                wakeLock = null;
            });
        } catch (e) {

            wakeLock = null;
        }
    }

    // Give the screen back to the system
    function releaseWakeLock() {

        if (!wakeLock) {
            return;
        }

        try {
            wakeLock.release();
        } catch (e) {
        }

        wakeLock = null;
    }

    // Cover everything with black. On an OLED screen the pixels are then off,
    // so this costs almost nothing and reads as a screen that went dark, while
    // the phone stays unlocked and one tap brings the player straight back
    function showBlackout() {

        if (!blackoutEl) {
            buildBlackout();
        }

        const wasUp = blackoutEl.style.display === "block";

        // Stop a fade out that is still running, otherwise its finish handler
        // hides the cover a moment after it has been shown again
        if (blackoutHideAnim) {

            blackoutHideAnim.cancel();
            blackoutHideAnim = null;
        }

        blackoutEl.style.display = "block";
        blackoutShownAt = Date.now();

        // Paint the document itself black as well. The cover is one element,
        // and anything that relayouts it, the system turning the screen off,
        // fullscreen being dropped and re-entered, leaves a frame where the
        // page shows through. A black page underneath makes that frame black
        if (priorPageBackground === null) {

            priorPageBackground = document.documentElement.style.background || "";
            document.documentElement.style.background = "#000";
        }

        // A dark screen is no use if the phone then locks and asks for Face ID
        requestWakeLock();

        // Fade in, so the screen dims rather than snapping to black. Skipped
        // when the cover is already up, otherwise a re-show would flash
        if (!wasUp && blackoutEl.animate) {

            blackoutEl.animate([
                { opacity: 0 },
                { opacity: 1 }
            ], { duration: 450, easing: "ease-out" });
        }

        // Real fullscreen hides the browser chrome, which is the difference
        // between a dark screen and a dark page. It is requested on the page
        // rather than on the cover, because a fullscreen element that gets
        // hidden drops fullscreen with it, and it must outlive the cover.
        // Staying fullscreen is the whole point: the browser only grants this
        // from a real tap, so the automatic blackout can never ask for itself.
        // Enter it once from the Screen off button and every later cover is
        // already free of the status and address bars
        enterFullscreen();

        startDrift();
    }

    // Whether the gate should stand in front of the player right now
    function gateWanted() {

        // Nothing to gate when the browser will not go fullscreen anyway
        if (!fullscreenSupported()) {
            return false;
        }

        // Independent of the screen off cover. Fullscreen is worth having on
        // its own, since it gives the player the whole screen with no address
        // bar, and it can only ever be entered from a real tap
        if (!settings.carGate) {
            return false;
        }

        // A folded panel is out of the way on purpose, so it must not put a
        // full size button back in front of the page
        if (minimized) {
            return false;
        }

        // The user asked to leave, so do not ask them back in
        if (leftFullscreenOnPurpose) {
            return false;
        }

        return !(document.fullscreenElement || document.webkitFullscreenElement);
    }

    // Put the gate up, building it the first time it is needed
    function showGate() {

        if (!panelEl) {
            return;
        }

        if (!gateEl) {

            gateEl = document.createElement("div");
            gateEl.style.cssText = [
                "position:absolute",
                "left:0",
                "right:0",
                "bottom:0",
                "background:#1d1d22",
                "display:flex",
                "align-items:center",
                "justify-content:center",
                "padding:12px",
                "box-sizing:border-box",
                "z-index:9"
            ].join(";");

            const btn = document.createElement("button");

            btn.textContent = "Activate Fullscreen";
            btn.style.cssText = [
                "width:100%",
                "height:100%",
                "min-height:120px",
                "border:none",
                "border-radius:12px",
                "background:#48e1eb",
                "color:#000",
                "font:700 28px/1.2 sans-serif",
                "padding:12px",
                "white-space:normal",
                "cursor:pointer"
            ].join(";");

            // The tap that dismisses the gate is the activation fullscreen
            // needs, so ask for it here and nowhere else at startup
            btn.addEventListener("click", function () {

                enterFullscreen();
                requestWakeLock();
                hideGate();
                resetIdleTimer();
            });

            gateEl.appendChild(btn);
            panelEl.appendChild(gateEl);
        }

        // Start below the header, so the settings and actions buttons stay
        // reachable and the gate can be turned off again. The header sits
        // inside the panel padding, so its own height is not where it ends,
        // its offset within the panel is. Measured on every show, because the
        // header wraps differently at different panel widths
        const headBottom = headerEl
            ? headerEl.offsetTop + headerEl.offsetHeight
            : 34;

        gateEl.style.top = (headBottom + 10) + "px";
        gateEl.style.display = "flex";
    }

    // Take the gate away and let the player through
    function hideGate() {

        if (gateEl) {
            gateEl.style.display = "none";
        }
    }

    // Keep the gate in step with the fullscreen state
    // Take the gate down whenever it no longer applies. It is never put up
    // here, only offerGate does that, at the two moments that count
    function refreshGate() {

        if (!gateWanted()) {
            hideGate();
        }
    }

    // Put the gate up if it applies. Called at startup and when the page comes
    // back from another app, and nowhere else. Fullscreen changes, iOS showing
    // its own bars, or switching the setting on must not raise it, otherwise
    // it keeps reappearing over the player during ordinary use
    function offerGate() {

        if (gateWanted()) {
            showGate();
        }
    }

    // Whether this browser will put an ordinary element fullscreen at all.
    // Safari on iPhone allows it for video only, and reports false here, so
    // everything fullscreen is hidden there rather than offered and refused.
    // Tested by feature, an iPad or a future iPhone that gains support will
    // simply get the controls
    function fullscreenSupported() {

        if (document.fullscreenEnabled === true || document.webkitFullscreenEnabled === true) {
            return true;
        }

        return false;
    }

    // Safari on iPhone ships element fullscreen behind a switch the user has to
    // turn on. There is no way to feature test for the switch existing, only
    // for the result, so the platform is identified to decide between offering
    // instructions and hiding the controls altogether
    function isIosLike() {

        const ua = navigator.userAgent || "";

        if (/iPhone|iPad|iPod/.test(ua)) {
            return true;
        }

        // iPadOS reports itself as a Mac, with a touch screen
        return ua.indexOf("Macintosh") !== -1 && navigator.maxTouchPoints > 1;
    }

    // Whether fullscreen is worth putting in front of the user at all. Where it
    // can be switched on it is, with an explanation, rather than hidden
    function fullscreenOffered() {

        return fullscreenSupported() || isIosLike();
    }

    // A plain message box inside the panel, with one way out
    function showNotice(title, body) {

        if (!panelEl) {
            return;
        }

        const back = document.createElement("div");
        back.style.cssText = [
            "position:absolute",
            "inset:0",
            "background:rgba(0,0,0,0.6)",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "padding:16px",
            "box-sizing:border-box",
            "z-index:10"
        ].join(";");

        const card = document.createElement("div");
        card.style.cssText = [
            "background:#26262c",
            "border:1px solid #3a3a42",
            "border-radius:10px",
            "padding:14px",
            "max-width:320px",
            "display:flex",
            "flex-direction:column",
            "gap:10px"
        ].join(";");

        const head = document.createElement("div");
        head.textContent = title;
        head.style.cssText = "font-weight:600";

        const text = document.createElement("div");
        text.textContent = body;
        text.style.cssText = "color:#ccc;font-size:13px;line-height:1.5";

        const okBtn = makeButton("Got it", "#48e1eb", "#000", function () {
            back.remove();
        });

        card.appendChild(head);
        card.appendChild(text);
        card.appendChild(okBtn);
        back.appendChild(card);

        // A tap outside the card closes it too
        back.addEventListener("click", function (ev) {

            if (ev.target === back) {
                back.remove();
            }
        });

        panelEl.appendChild(back);
    }

    // Tell the user where the switch is, once they have asked for fullscreen
    function showFullscreenHelp() {

        showNotice("Fullscreen is switched off in Safari",
            "Open Settings, then Safari, Advanced, Feature Flags, and turn on"
            + " Fullscreen API. Reload this page afterwards and the fullscreen"
            + " controls will start working.");
    }

    // True while the page is showing fullscreen
    function isFullscreen() {

        return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }

    // Leave fullscreen. No user gesture is needed to get out again
    function exitFullscreen() {

        if (!isFullscreen()) {
            return;
        }

        if (document.exitFullscreen) {

            const left = document.exitFullscreen();

            if (left && typeof left.catch === "function") {

                left.catch(function () {
                });
            }

        } else if (document.webkitExitFullscreen) {

            try {
                document.webkitExitFullscreen();
            } catch (e) {
            }
        }
    }

    // Keep the menu entry showing the action it would actually perform
    function updateFullscreenButton() {

        if (!fullscreenButton) {
            return;
        }

        const on = isFullscreen();

        fullscreenButton.labelEl.textContent = on ? "Exit full" : "Fullscreen";
        fullscreenButton.iconEl.textContent = "";
        fullscreenButton.iconEl.appendChild(on ? iconExitFullscreen() : iconFullscreen());
    }

    // Ask for fullscreen on the page. Only a real user gesture is granted it,
    // so a refusal from the idle timer is expected and simply ignored
    function enterFullscreen() {

        if (!fullscreenSupported()) {
            return;
        }

        if (document.fullscreenElement || document.webkitFullscreenElement) {
            return;
        }

        const target = document.documentElement;

        if (target.requestFullscreen) {

            const started = target.requestFullscreen();

            if (started && typeof started.catch === "function") {

                started.catch(function () {
                });
            }

        } else if (target.webkitRequestFullscreen) {

            try {
                target.webkitRequestFullscreen();
            } catch (e) {
            }
        }
    }

    // Build the cover once and keep it for later
    function buildBlackout() {

        blackoutEl = document.createElement("div");
        blackoutEl.style.cssText = [
            "position:fixed",
            "inset:0",
            "background:#000",
            "z-index:2147483647",
            "touch-action:none",
            "cursor:pointer",
            "overflow:hidden"
        ].join(";");

        // The mark that shows the screen is covered rather than off. It is kept
        // dim and moved around, because a static bright element on an OLED
        // panel is exactly how burn in happens
        blackoutMarkEl = document.createElement("div");
        blackoutMarkEl.style.cssText = "position:absolute;opacity:0;font:64px/1.1 sans-serif;white-space:nowrap;pointer-events:none;max-width:100%;overflow:hidden";

        blackoutEl.appendChild(blackoutMarkEl);

        blackoutEl.addEventListener("pointerdown", function (ev) {

            ev.preventDefault();
            ev.stopPropagation();

            // Ignore the tail of the gesture that opened the cover
            if (Date.now() - blackoutShownAt < 600) {
                return;
            }

            // Only a real finger or mouse dismisses the cover. A script on the
            // page dispatching pointer events would otherwise wake the screen
            // on its own, which looks like the cover flickering
            if (ev.isTrusted === false) {

                if (isDebug()) {
                    setStatus("Ignored a synthetic tap on the cover");
                }

                return;
            }

            if (isDebug()) {
                setStatus("Cover dismissed by " + (ev.pointerType || "pointer"));
            }

            hideBlackout();
        });

        document.body.appendChild(blackoutEl);
    }

    // Put the mark somewhere new, well inside the edges, and fade it in and out
    // again. Fading rather than sitting lit keeps the average brightness of any
    // one pixel very low
    function driftMark() {

        if (!blackoutMarkEl || !settings.blackoutText) {
            return;
        }

        blackoutMarkEl.textContent = settings.blackoutText;
        blackoutMarkEl.style.color = settings.blackoutColor;
        blackoutMarkEl.style.fontSize = (settings.blackoutSize || 64) + "px";

        const w = blackoutEl.clientWidth || window.innerWidth;
        const h = blackoutEl.clientHeight || window.innerHeight;
        const markW = blackoutMarkEl.offsetWidth || 40;
        const markH = blackoutMarkEl.offsetHeight || 20;

        // Keep clear of the edges, where notches and rounded corners sit, but
        // give the padding up rather than push the mark off screen when it is
        // nearly as wide as the display
        const roomX = Math.max(0, w - markW);
        const roomY = Math.max(0, h - markH);
        const padX = Math.min(Math.round(w * 0.12), Math.floor(roomX / 2));
        const padY = Math.min(Math.round(h * 0.12), Math.floor(roomY / 2));
        const spanX = Math.max(0, roomX - padX * 2);
        const spanY = Math.max(0, roomY - padY * 2);

        const left = Math.min(padX + Math.random() * spanX, roomX);
        const top = Math.min(padY + Math.random() * spanY, roomY);

        blackoutMarkEl.style.left = Math.round(left) + "px";
        blackoutMarkEl.style.top = Math.round(top) + "px";

        if (!blackoutMarkEl.animate) {

            blackoutMarkEl.style.opacity = "1";
            return;
        }

        // The fade lasts as long as the gap between moves, so the mark is on
        // screen nearly all the time rather than blinking once and leaving a
        // long dark wait. It still moves, which is what avoids burn in
        const span = Math.max(4, settings.blackoutDrift || 25) * 1000;

        blackoutMarkEl.animate([
            { opacity: 0 },
            { opacity: 1, offset: 0.08 },
            { opacity: 1, offset: 0.88 },
            { opacity: 0 }
        ], { duration: span });
    }

    // Show the mark now and keep moving it for as long as the cover is up
    function startDrift() {

        stopDrift();

        if (!settings.blackoutText) {
            return;
        }

        driftMark();

        driftTimer = setInterval(driftMark, (settings.blackoutDrift || 25) * 1000);
    }

    function stopDrift() {

        if (driftTimer) {

            clearInterval(driftTimer);
            driftTimer = null;
        }
    }

    // Take the black cover away and start counting idle time again
    function hideBlackout() {

        stopDrift();

        // Give the page its own background back
        if (priorPageBackground !== null) {

            document.documentElement.style.background = priorPageBackground;
            priorPageBackground = null;
        }

        if (blackoutEl) {

            // Fade back out, then take the cover away once it is invisible
            if (blackoutEl.animate) {

                const out = blackoutEl.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], { duration: 350, easing: "ease-in" });

                blackoutHideAnim = out;

                out.onfinish = function () {

                    // A newer show has taken over, leave the cover alone
                    if (blackoutHideAnim !== out) {
                        return;
                    }

                    blackoutHideAnim = null;
                    blackoutEl.style.display = "none";
                };

            } else {
                blackoutEl.style.display = "none";
            }
        }

        // Fullscreen deliberately stays. Waking the screen should not hand the
        // address bar back, and keeping it means the next automatic cover is
        // chrome free without needing a tap it is not allowed to ask for.
        // The back gesture or Escape leaves it when actually wanted
        resetIdleTimer();
    }

    // True while the black cover is up
    function isBlackedOut() {

        return blackoutEl !== null && blackoutEl.style.display !== "none";
    }

    // Restart the countdown to the blackout. It only ever arms while something
    // is actually playing, so the panel never goes dark while it is being used
    function resetIdleTimer() {

        if (idleTimer) {

            clearTimeout(idleTimer);
            idleTimer = null;
        }

        const wait = settings.carAutoBlack;

        if (!settings.carBlackout || !wait || wait <= 0) {
            return;
        }

        idleTimer = setTimeout(function () {

            idleTimer = null;

            // Hidden tabs come back through the visibility handler, so just
            // wait rather than arming a countdown nobody can see
            if (document.hidden) {
                return;
            }

            // Only once the session is known good. The add on injects into
            // every mureka.ai page, including sign in, where covering the
            // screen would hide the form and lock the user out
            if (!apiOk && !currentSong) {
                return;
            }

            // Never cover a field that is being typed into
            const active = document.activeElement;

            if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA"
                || active.isContentEditable)) {

                resetIdleTimer();
                return;
            }

            // Idle is idle, whether something is playing, paused, or has not
            // been started at all. Turning the setting on is the consent
            if (settingsOpen || actionsOpen || viewMenuOpen) {

                resetIdleTimer();
                return;
            }

            showBlackout();
        }, wait * 1000);
    }

    // The last time a stall was escalated to a full reload, so an element that
    // stays dead is not reloaded over and over
    let lastEscalateT = 0;

    // Pending stall check. Foregrounding fires visibilitychange, focus and
    // sometimes pageshow together, and they must share a single check
    let resyncTimer = null;

    // The watchdog interval and the position it last sampled
    let watchdogTimer = null;
    let watchdogLast = -1;

    // Bring the UI and the element back in step after the page was in the
    // background. Two things go wrong on iOS. The element can be paused with
    // no pause event delivered, leaving the display stale, and it can report
    // that it is playing while the clock stands still, because the audio
    // session was lost without the element noticing
    function resyncPlayback() {

        // Coming back to the foreground drops the wake lock, so take it again
        requestWakeLock();

        if (!audio) {
            return;
        }

        // Always correct the display and the lock screen state, this is free
        updatePlayPause();

        if ("mediaSession" in navigator) {

            try {
                navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
            } catch (e) {
            }
        }

        // Never fight a pause the user asked for, and nothing to do after Stop
        if (!currentSong || userPaused || !audio.src) {
            return;
        }

        if (audio.paused) {

            setupMediaSession();
            resendArtOnResume();
            startAudioPlayback();
            return;
        }

        // It claims to be playing, so check whether the clock is really moving
        scheduleStallCheck();
    }

    // Sample the position now and judge it shortly after, with only one check
    // in flight so the several foreground events cannot each nudge the element
    function scheduleStallCheck() {

        if (resyncTimer || !audio) {
            return;
        }

        const before = audio.currentTime;

        resyncTimer = setTimeout(function () {

            resyncTimer = null;
            checkStalled(before);
        }, 700);
    }

    // Decide whether playback is genuinely stuck and recover it if so
    function checkStalled(before) {

        // Never touch playback while nobody is watching. Pausing releases the
        // audio session, and the play that follows can be refused, which ends
        // playback for good rather than recovering it. A check scheduled while
        // visible can still fire after the screen has gone off, so the state is
        // tested here and not only by the caller.
        //
        // The cover counts as not watching. It is only a black div over a live
        // page, and the wake lock keeps the screen on, so the page stays
        // visible and document.hidden stays false while it is up
        if (document.hidden || isBlackedOut()) {
            return;
        }

        if (!audio || audio.paused || !currentSong || userPaused) {
            return;
        }

        if (audio.currentTime !== before) {

            // Moving as it should, so bring the lock screen scrubber in step.
            // Doing this only here keeps a frozen position off the lock screen
            updateMediaPosition();
            return;
        }

        // Frozen while claiming to play. Pausing and starting the same source
        // is what recovers it by hand, so try that first, it keeps the position
        const at = audio.currentTime;

        audio.pause();
        setupMediaSession();
        startAudioPlayback();

        // play on a stalled element can leave its promise pending for ever,
        // never resolving and never rejecting, while paused flips to false so
        // everything looks fine. So confirm the clock actually moved, and fall
        // back to loading the source again when it did not
        setTimeout(function () {

            // Reloading the source unseen is the surest way to lose playback
            // altogether, so the escalation waits for someone to be looking
            if (document.hidden || isBlackedOut()) {
                return;
            }

            if (!audio || !currentSong || userPaused) {
                return;
            }

            if (audio.currentTime !== at) {
                return;
            }

            if (Date.now() - lastEscalateT < 10000) {
                return;
            }

            lastEscalateT = Date.now();

            // Come back a second early, so the resumed audio does not clip
            pendingSeek = at > 1 ? at - 1 : 0;
            setStatus("Restarting playback: " + (currentSong.title || "Untitled"));
            playCurrent();
        }, 1200);
    }

    // Catch a stall that happens while the page is in the foreground, which no
    // visibility or focus event would report. Timers are frozen in the
    // background on iOS, so this only runs when it can actually help
    function startWatchdog() {

        if (watchdogTimer) {
            return;
        }

        watchdogTimer = setInterval(function () {

            if (document.hidden || isBlackedOut() || !audio || audio.paused
                || !currentSong || userPaused) {

                watchdogLast = -1;
                return;
            }

            const now = audio.currentTime;

            if (watchdogLast >= 0 && now === watchdogLast) {
                checkStalled(now);
            }

            watchdogLast = now;
        }, 5000);
    }

    // Abandons a transport chip drag, set once the editor has been built
    let endControlDrag = function () {
    };

    // Every transport button that can be placed, in a fixed reference order
    const CONTROL_NAMES = ["prev", "play", "stop", "next", "shuffle", "repeat", "published", "vocals", "rate"];

    // A fresh icon for the editor, the real buttons keep their own nodes
    function controlChipIcon(name) {

        if (name === "shuffle") {
            return makeShuffleIcon();
        }

        if (name === "repeat") {
            return makeRepeatIcon(false);
        }

        // The editor chip carries the same icon the button shows at rest
        if (name === "vocals") {
            return iconAll();
        }

        if (name === "rate") {
            return makeStarSvg(20);
        }

        const drawn = {
            prev: iconPrev,
            play: iconPlay,
            stop: iconStop,
            next: iconNext
        };

        if (drawn[name]) {
            return drawn[name]();
        }

        const span = document.createElement("span");

        span.textContent = name === "published" ? "\u2713" : "?";
        span.style.cssText = "font-size:18px;line-height:1";

        return span;
    }

    // Build the drag and drop editor for the transport row. Two lists of names
    // are the single source of truth, the upper row being the bar as it appears
    // in the player and the lower one the buttons that are not shown. The DOM
    // is only ever a rendering of those lists, which is what keeps a chip from
    // ending up in both rows at once
    function buildControlEditor() {

        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;gap:6px";

        let activeNames = [];
        let disabledNames = [];

        // One chip element per name, reused across renders so it keeps its
        // identity, which the movement animation depends on
        const chips = {};

        // The name being dragged, null when nothing is
        let dragName = null;
        let holdTimer = null;
        let startX = 0;
        let startY = 0;

        // A floating copy of the chip that follows the pointer. The chip itself
        // stays in the row as the gap, so the copy is what stays visible when
        // the pointer wanders outside both rows
        let dragGhost = null;
        let ghostDX = 0;
        let ghostDY = 0;

        const makeLabel = function (text) {

            const el = document.createElement("div");

            el.textContent = text;
            el.style.cssText = "color:#888;font-size:11px";

            return el;
        };

        const makeRow = function () {

            const row = document.createElement("div");

            row.style.cssText = [
                "display:flex",
                "flex-wrap:wrap",
                "gap:6px",
                "min-height:46px",
                "padding:6px",
                "border:1px dashed #3a3a42",
                "border-radius:8px",
                "background:#26262c"
            ].join(";");

            return row;
        };

        const activeRow = makeRow();
        const disabledRow = makeRow();

        // Read the lists out of the setting, dropping anything unknown and any
        // repeat, then put whatever is left over into the disabled row
        const loadNames = function () {

            const seen = {};

            activeNames = String(settings.controlOrder || "")
                .split(",")
                .map(function (name) {
                    return name.trim().toLowerCase();
                })
                .filter(function (name) {

                    if (CONTROL_NAMES.indexOf(name) === -1 || seen[name]) {
                        return false;
                    }

                    seen[name] = true;

                    return true;
                });

            disabledNames = CONTROL_NAMES.filter(function (name) {
                return !seen[name];
            });
        };

        // Save the bar and redraw the real transport row
        const commit = function () {

            // An empty bar would leave nothing to press, so keep play
            if (activeNames.length === 0) {

                activeNames = ["play"];
                disabledNames = CONTROL_NAMES.filter(function (name) {
                    return name !== "play";
                });
            }

            settings.controlOrder = activeNames.join(",");
            saveSettings();
            applyControlOrder();
        };

        // Put the chips where the lists say they go. Every chip that has moved
        // is animated from where it used to be, so the others visibly slide
        // aside and open the gap the dragged one drops into
        const render = function (animate) {

            const before = {};

            if (animate) {

                for (const name of CONTROL_NAMES) {

                    if (chips[name] && chips[name].isConnected) {
                        before[name] = chips[name].getBoundingClientRect();
                    }
                }
            }

            for (const name of activeNames) {
                activeRow.appendChild(chips[name]);
            }

            for (const name of disabledNames) {
                disabledRow.appendChild(chips[name]);
            }

            if (!animate) {
                return;
            }

            for (const name of CONTROL_NAMES) {

                const old = before[name];

                if (!old || name === dragName || !chips[name].animate) {
                    continue;
                }

                const now = chips[name].getBoundingClientRect();
                const dx = old.left - now.left;
                const dy = old.top - now.top;

                if (dx === 0 && dy === 0) {
                    continue;
                }

                chips[name].animate([
                    { transform: "translate(" + dx + "px, " + dy + "px)" },
                    { transform: "translate(0, 0)" }
                ], { duration: 220, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
            }
        };

        // Which row the pointer is over, or null when it is over neither
        const rowAt = function (x, y) {

            for (const row of [activeRow, disabledRow]) {

                const r = row.getBoundingClientRect();

                if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
                    return row;
                }
            }

            return null;
        };

        // Move the dragged name into the row under the pointer, at the position
        // the pointer is closest to. The index is worked out from the chips
        // that are not being dragged, so it can be used directly
        const dragTo = function (x, y) {

            const row = rowAt(x, y);

            if (!row) {
                return;
            }

            const toList = row === activeRow ? activeNames : disabledNames;
            const fromList = activeNames.indexOf(dragName) !== -1 ? activeNames : disabledNames;

            const others = (row === activeRow ? activeNames : disabledNames).filter(function (name) {
                return name !== dragName;
            });

            let index = others.length;

            for (let i = 0; i < others.length; i += 1) {

                const r = chips[others[i]].getBoundingClientRect();

                if (y < r.bottom && x < r.left + r.width / 2) {

                    index = i;
                    break;
                }
            }

            const from = fromList.indexOf(dragName);

            // Nothing to do when it would land exactly where it already is
            if (fromList === toList && from === index) {
                return;
            }

            fromList.splice(from, 1);
            toList.splice(index, 0, dragName);
            render(true);
        };

        // Declared here so the handlers can remove themselves again
        let onDocMove = null;
        let onDocUp = null;

        const detach = function () {

            if (!onDocMove) {
                return;
            }

            document.removeEventListener("pointermove", onDocMove, true);
            document.removeEventListener("pointerup", onDocUp, true);
            document.removeEventListener("pointercancel", onDocUp, true);
            onDocMove = null;
            onDocUp = null;
        };

        const endDrag = function () {

            detach();

            if (holdTimer) {

                clearTimeout(holdTimer);
                holdTimer = null;
            }

            if (!dragName) {
                return;
            }

            const chip = chips[dragName];

            if (dragGhost) {

                dragGhost.remove();
                dragGhost = null;
            }

            chip.style.opacity = "1";
            chip.style.transform = "none";
            chip.style.boxShadow = "none";
            dragName = null;
            commit();
        };

        const makeChip = function (name) {

            const chip = document.createElement("div");

            chip.dataset.control = name;
            chip.title = "Drag to move, on a touch screen press and hold first";
            chip.style.cssText = [
                "display:flex",
                "flex-direction:column",
                "align-items:center",
                "justify-content:center",
                "gap:3px",
                "min-width:52px",
                "padding:6px 8px",
                "border-radius:8px",
                "background:#333",
                "color:#fff",
                "font:600 10px/1 sans-serif",
                "cursor:grab",
                "touch-action:none",
                "user-select:none",
                "-moz-user-select:none"
            ].join(";");

            const icon = document.createElement("span");
            icon.style.cssText = "display:flex;align-items:center;justify-content:center;height:20px";
            icon.appendChild(controlChipIcon(name));

            const label = document.createElement("span");
            label.textContent = name;

            chip.appendChild(icon);
            chip.appendChild(label);

            // Pick the chip up, whatever decided the press counts as a grab
            const lift = function () {

                dragName = name;

                const r = chip.getBoundingClientRect();

                // Where inside the chip the pointer is, so the copy keeps the
                // same grip point instead of jumping to a corner
                ghostDX = startX - r.left;
                ghostDY = startY - r.top;

                dragGhost = chip.cloneNode(true);
                dragGhost.style.position = "fixed";
                dragGhost.style.left = r.left + "px";
                dragGhost.style.top = r.top + "px";
                dragGhost.style.width = r.width + "px";
                dragGhost.style.height = r.height + "px";
                dragGhost.style.margin = "0";
                dragGhost.style.pointerEvents = "none";
                dragGhost.style.zIndex = "2147483647";
                dragGhost.style.transform = "scale(1.1)";
                dragGhost.style.boxShadow = "0 6px 16px rgba(0,0,0,0.55)";
                dragGhost.style.opacity = "0.95";

                document.body.appendChild(dragGhost);

                // The chip left behind marks the gap it would drop into
                chip.style.opacity = "0.25";
            };

            chip.addEventListener("pointerdown", function (ev) {

                startX = ev.clientX;
                startY = ev.clientY;

                // Listen on the document rather than capturing on the chip.
                // Re-parenting an element releases its pointer capture, and the
                // chips are re-parented on every reorder, which would cut the
                // drag off after the first move and strand the floating copy
                detach();

                onDocMove = function (e) {

                    // A press that turns into a swipe before the hold completes
                    // was meant as a scroll, so it never becomes a drag
                    if (holdTimer) {

                        if (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8) {

                            clearTimeout(holdTimer);
                            holdTimer = null;
                        }

                        return;
                    }

                    if (!dragName) {
                        return;
                    }

                    e.preventDefault();

                    if (dragGhost) {

                        dragGhost.style.left = (e.clientX - ghostDX) + "px";
                        dragGhost.style.top = (e.clientY - ghostDY) + "px";
                    }

                    dragTo(e.clientX, e.clientY);
                };

                onDocUp = function () {
                    endDrag();
                };

                document.addEventListener("pointermove", onDocMove, true);
                document.addEventListener("pointerup", onDocUp, true);
                document.addEventListener("pointercancel", onDocUp, true);

                // A mouse press is already a deliberate grab, so it picks the
                // chip up at once. A finger has to be held, because the same
                // press would otherwise be a scroll of the settings panel
                if (ev.pointerType === "mouse") {

                    lift();
                    return;
                }

                holdTimer = setTimeout(function () {

                    holdTimer = null;
                    lift();
                }, 350);
            });

            return chip;
        };

        for (const name of CONTROL_NAMES) {
            chips[name] = makeChip(name);
        }

        // Redraw from the stored setting whenever the panel is opened
        const reload = function () {

            loadNames();
            render(false);
        };

        reload();
        settingsRefreshers.push(reload);

        // Let the panel abandon a drag that is somehow still open when it closes
        endControlDrag = endDrag;

        wrap.appendChild(makeLabel("Transport bar, long press a button to move it"));
        wrap.appendChild(activeRow);
        wrap.appendChild(makeLabel("Not shown"));
        wrap.appendChild(disabledRow);

        return wrap;
    }

    // Lay out the transport row from the controlOrder setting. Unknown names
    // are skipped, and an order that names nothing usable falls back to the
    // default rather than leaving the row empty
    function applyControlOrder() {

        if (!controlRowEl) {
            return;
        }

        const wanted = String(settings.controlOrder || "")
            .split(",")
            .map(function (name) {
                return name.trim().toLowerCase();
            })
            .filter(function (name) {
                return controlButtons[name];
            });

        const order = wanted.length > 0
            ? wanted
            : ["repeat", "shuffle", "stop", "play"];

        updateControlLabels();
        controlRowEl.textContent = "";

        // A name used twice would move the same element, not copy it, so each
        // button is placed at most once
        const placed = {};

        for (const name of order) {

            if (placed[name]) {
                continue;
            }

            placed[name] = true;
            controlRowEl.appendChild(controlButtons[name]);
        }
    }

    // The transport row as a list of names, in the order it is laid out
    function currentControlNames() {

        return String(settings.controlOrder || "")
            .split(",")
            .map(function (name) {
                return name.trim().toLowerCase();
            })
            .filter(function (name) {
                return controlButtons[name];
            });
    }

    // Re-lay the row and slide every button that moved, so a rearrangement in
    // the player reads the same way as one in the settings editor
    function applyControlOrderAnimated() {

        const before = new Map();

        for (const name of Object.keys(controlButtons)) {

            const el = controlButtons[name];

            if (el && el.isConnected) {
                before.set(name, el.getBoundingClientRect());
            }
        }

        applyControlOrder();

        for (const name of Object.keys(controlButtons)) {

            const el = controlButtons[name];
            const old = before.get(name);

            if (!old || !el.isConnected || name === ctrlDragName || !el.animate) {
                continue;
            }

            const now = el.getBoundingClientRect();
            const dx = old.left - now.left;

            if (dx === 0) {
                continue;
            }

            el.animate([
                { transform: "translateX(" + dx + "px)" },
                { transform: "translateX(0)" }
            ], { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
        }
    }

    // Finish a transport drag, saving the new order
    function endControlRowDrag() {

        if (ctrlDocMove) {

            document.removeEventListener("pointermove", ctrlDocMove, true);
            document.removeEventListener("pointerup", ctrlDocUp, true);
            document.removeEventListener("pointercancel", ctrlDocUp, true);
            ctrlDocMove = null;
            ctrlDocUp = null;
        }

        if (ctrlHoldTimer) {

            clearTimeout(ctrlHoldTimer);
            ctrlHoldTimer = null;
        }

        if (!ctrlDragName) {
            return;
        }

        if (ctrlGhost) {

            ctrlGhost.remove();
            ctrlGhost = null;
        }

        const el = controlButtons[ctrlDragName];

        if (el) {
            el.style.opacity = "1";
        }

        ctrlDragName = null;
        saveSettings();
        setStatus("Transport row rearranged");
    }

    // Move the held button to wherever the pointer is along the row
    function dragControlTo(x) {

        if (!ctrlDragName || !controlRowEl) {
            return;
        }

        const names = currentControlNames();

        const others = names.filter(function (name) {
            return name !== ctrlDragName;
        });

        let index = others.length;

        for (let i = 0; i < others.length; i += 1) {

            const r = controlButtons[others[i]].getBoundingClientRect();

            if (x < r.left + r.width / 2) {

                index = i;
                break;
            }
        }

        others.splice(index, 0, ctrlDragName);

        const next = others.join(",");

        if (next === settings.controlOrder) {
            return;
        }

        settings.controlOrder = next;
        applyControlOrderAnimated();
    }

    // Long press any transport button to rearrange the row in place. A normal
    // press still works the button, only a held one picks it up
    function enableControlRowDragging() {

        for (const name of Object.keys(controlButtons)) {

            const btn = controlButtons[name];

            if (!btn || btn.dataset.dragArmed === "1") {
                continue;
            }

            btn.dataset.dragArmed = "1";

            // Chromium on Android, Vivaldi included, decides at touch start
            // whether the browser owns the gesture. Left to itself it starts a
            // pan as soon as the held finger moves and sends pointercancel,
            // which ended the drag at once. preventDefault on the move cannot
            // take it back, only touch-action can, which is also what lets the
            // chips in the settings editor move. The row never scrolls, so
            // nothing is lost by claiming the touch. iOS worked without this
            btn.style.touchAction = "none";

            // A long press must not select the label or raise a callout
            btn.style.userSelect = "none";
            btn.style.webkitUserSelect = "none";
            btn.style.webkitTouchCallout = "none";

            // Android raises a context menu on a long press, which would land
            // right as the button is picked up
            btn.addEventListener("contextmenu", function (ev) {
                ev.preventDefault();
            });

            // A drag ends with a click on the button underneath, which would
            // otherwise start playback or flip a mode, so it is swallowed once
            btn.addEventListener("click", function (ev) {

                if (!ctrlSuppressClick) {
                    return;
                }

                ctrlSuppressClick = false;
                ev.preventDefault();
                ev.stopPropagation();
            }, true);

            btn.addEventListener("pointerdown", function (ev) {

                // A second finger while a button is already held is ignored
                if (ctrlDragName) {
                    return;
                }

                // Drop any listeners a press that never saw its pointerup left
                // behind, before attaching this press's own
                endControlRowDrag();

                ctrlStartX = ev.clientX;
                ctrlStartY = ev.clientY;

                ctrlDocMove = function (e) {

                    if (ctrlHoldTimer) {

                        // Moved before the hold completed, so it was a swipe
                        if (Math.abs(e.clientX - ctrlStartX) > 8
                            || Math.abs(e.clientY - ctrlStartY) > 8) {

                            clearTimeout(ctrlHoldTimer);
                            ctrlHoldTimer = null;
                        }

                        return;
                    }

                    if (!ctrlDragName) {
                        return;
                    }

                    e.preventDefault();

                    if (ctrlGhost) {

                        ctrlGhost.style.left = (e.clientX - ctrlGhostDX) + "px";
                        ctrlGhost.style.top = (e.clientY - ctrlGhostDY) + "px";
                    }

                    dragControlTo(e.clientX);
                };

                ctrlDocUp = function () {
                    endControlRowDrag();
                };

                document.addEventListener("pointermove", ctrlDocMove, true);
                document.addEventListener("pointerup", ctrlDocUp, true);
                document.addEventListener("pointercancel", ctrlDocUp, true);

                // Held long enough to mean rearrange rather than press. Longer
                // than the settings editor, because these are live controls and
                // picking one up by accident would be worse than a missed drag
                ctrlHoldTimer = setTimeout(function () {

                    ctrlHoldTimer = null;
                    ctrlDragName = name;
                    ctrlSuppressClick = true;

                    const r = btn.getBoundingClientRect();

                    ctrlGhostDX = ctrlStartX - r.left;
                    ctrlGhostDY = ctrlStartY - r.top;

                    ctrlGhost = btn.cloneNode(true);
                    ctrlGhost.style.position = "fixed";
                    ctrlGhost.style.left = r.left + "px";
                    ctrlGhost.style.top = r.top + "px";
                    ctrlGhost.style.width = r.width + "px";
                    ctrlGhost.style.height = r.height + "px";
                    ctrlGhost.style.margin = "0";
                    ctrlGhost.style.pointerEvents = "none";
                    ctrlGhost.style.zIndex = "2147483647";
                    ctrlGhost.style.transform = "scale(1.08)";
                    ctrlGhost.style.boxShadow = "0 6px 16px rgba(0,0,0,0.55)";

                    document.body.appendChild(ctrlGhost);

                    btn.style.opacity = "0.3";
                }, 550);
            });
        }
    }

    // Toggle between play and pause for the current song
    function togglePlayPause() {

        if (!audio || !audio.src) {

            // Nothing loaded yet, start playback in the current mode
            startPlay();
            return;
        }

        if (audio.paused) {

            startAudioPlayback();

        } else {

            userPaused = true;
            audio.pause();
        }
    }

    // Update the play/pause icon to match the audio state
    function updatePlayPause() {

        if (!playPauseBtn) {
            return;
        }

        const playing = audio && !audio.paused && audio.src;

        // Pause glyph while playing, play glyph while paused
        setTransportIcon(playPauseBtn, playing ? iconPause() : iconPlay());
        updateControlLabels();

        if ("mediaSession" in navigator) {

            try {
                navigator.mediaSession.playbackState = playing ? "playing" : "paused";
            } catch (e) {
            }
        }
    }

    // The song one step from the current one, honoring the repeat all wrap
    function neighborSong(step) {

        if (queue.length === 0) {
            return null;
        }

        const pos = queuePos + step;

        if (pos < 0) {
            return repeatMode === "all" ? queue[queue.length - 1] : null;
        }

        if (pos >= queue.length) {
            return repeatMode === "all" ? queue[0] : null;
        }

        return queue[pos];
    }

    // Set the same CSS transition on every cover tile
    function setArtTransition(value) {

        artTiles.forEach(function (img) {
            img.style.transition = value;
        });
    }

    // Point each cover tile at the song that many steps from the current one
    // Rotate the tile array so a tile already showing a given cover can become
    // the center without swapping its image source. The array is reordered, the
    // DOM is left alone since stacking is by explicit z-index
    function rotateArtTiles(shift) {

        const n = artTiles.length;
        const s = ((shift % n) + n) % n;

        if (s === 0) {

            return;
        }

        artTiles = artTiles.slice(s).concat(artTiles.slice(0, s));
        playerArt = artTiles[ART_SIDE_TILES];
    }

    function setArtSources() {

        // If the new current cover already sits on a neighbor tile, rotate the
        // strip so that tile becomes the center. Swapping the center tile's own
        // image source instead flashes the old cover while the new one decodes
        if (currentSong) {

            const curCover = coverUrl(currentSong);
            const center = artTiles[ART_SIDE_TILES];

            if (curCover && center.dataset.cover !== curCover) {

                for (let i = 0; i < artTiles.length; i += 1) {

                    if (i !== ART_SIDE_TILES && artTiles[i].dataset.cover === curCover) {

                        rotateArtTiles(i - ART_SIDE_TILES);
                        break;
                    }
                }
            }
        }

        for (let i = 0; i < artTiles.length; i += 1) {

            const rel = i - ART_SIDE_TILES;
            const song = (rel === 0) ? currentSong : neighborSong(rel);
            const cover = song ? coverUrl(song) : "";

            if (cover) {

                // Only touch the source when the cover actually changes, so a
                // recycled tile keeps its already decoded image
                if (artTiles[i].dataset.cover !== cover) {

                    artTiles[i].src = cover;
                    artTiles[i].dataset.cover = cover;
                }

                artTiles[i].style.visibility = "visible";

                // A cover shown in the carousel has been downloaded to display
                // it, so store it too. The current song is stored by the play
                // path, so only the neighbors need it here
                if (rel !== 0) {
                    cacheArt(song);
                }

            } else {

                artTiles[i].removeAttribute("src");
                artTiles[i].dataset.cover = "";
                artTiles[i].style.visibility = "hidden";
            }
        }
    }

    // Lay out the tiles for a drag offset, blurring each by its distance from center
    function positionArt(drag) {

        if (!artWrapEl) {
            return;
        }

        const w = artWrapEl.clientWidth;
        const cover = artWrapEl.clientHeight;

        if (cover === 0) {
            return;
        }

        // Slot geometry. The center slot holds the playing cover at full size.
        // The side slots are anchored so the scaled cover's outer edge touches
        // the container edge, sitting behind the center cover
        const xC = (w - cover) / 2;
        const xL = (ART_SIDE_SCALE - 1) * cover / 2;
        const xR = w - (ART_SIDE_SCALE + 1) * cover / 2;

        // Swipe progress, the center follows the finger and a full swipe spans
        // the distance from the center slot to a side anchor
        const travel = xC - xL;
        const p = travel > 0 ? Math.max(-1, Math.min(1, drag / travel)) : 0;
        const t = Math.abs(p);
        const range = 1 - ART_SIDE_SCALE;

        // In repeat one the sides are not where playback heads next, so grey
        // and fade them as a hint that the current song keeps repeating
        const repeatingOne = repeatMode === "one";

        for (let i = 0; i < artTiles.length; i += 1) {

            const rel = i - ART_SIDE_TILES;
            const isSide = rel !== 0;

            let x;
            let scale;
            let z;

            if (rel === 0) {

                // The playing cover follows the finger and shrinks toward the
                // side size, dropping behind the incoming cover half way
                x = xC + drag;
                scale = 1 - t * range;
                z = t > 0.5 ? 2 : 3;

            } else if (rel === -1 && p > 0) {

                // Swiping toward previous, this cover travels from its left
                // anchor to the center, growing to full size on the way
                x = xL + (xC - xL) * t;
                scale = ART_SIDE_SCALE + range * t;
                z = t > 0.5 ? 3 : 2;

            } else if (rel === 1 && p < 0) {

                // Swiping toward next, same journey from the right anchor
                x = xR + (xC - xR) * t;
                scale = ART_SIDE_SCALE + range * t;
                z = t > 0.5 ? 3 : 2;

            } else if (rel === -1 || rel === 1) {

                // The far side stays pinned at its anchor beneath the moving cover
                x = rel === -1 ? xL : xR;
                scale = ART_SIDE_SCALE;
                z = 1;

            } else {

                // Spare tiles wait hidden beneath the side anchors
                x = rel < 0 ? xL : xR;
                scale = ART_SIDE_SCALE;
                z = 0;
            }

            artTiles[i].style.transform = "translateX(" + x + "px) scale(" + scale + ")";
            artTiles[i].style.zIndex = String(z);

            // Blur follows how far the tile is from full size
            const factor = range > 0 ? (1 - scale) / range : 0;
            const blur = factor * ART_SIDE_BLUR;

            const filters = [];

            if (blur > 0.05) {
                filters.push("blur(" + blur.toFixed(2) + "px)");
            }

            if (repeatingOne && isSide) {
                filters.push("grayscale(1)");
            }

            artTiles[i].style.filter = filters.length ? filters.join(" ") : "none";

            artTiles[i].style.opacity = (repeatingOne && isSide) ? "0.3" : "1";

            // Only the cover on top blends, and only on the side that overlaps
            // the swap partner. A gradient mask makes that side semi transparent
            // while the far side stays opaque, so the cover behind it stays
            // hidden instead of shining through
            let mask = "none";

            if (t > 0 && z === 3) {

                const cross = (0.5 + 0.5 * Math.min(1, Math.abs(t - 0.5) / 0.25)).toFixed(3);
                const fadeRight = p < 0 ? t < 0.5 : t >= 0.5;

                mask = fadeRight
                    ? "linear-gradient(to right, #000 40%, rgba(0,0,0," + cross + ") 70%)"
                    : "linear-gradient(to right, rgba(0,0,0," + cross + ") 30%, #000 60%)";
            }

            artTiles[i].style.webkitMaskImage = mask;
            artTiles[i].style.maskImage = mask;
        }
    }

    // The distance one swipe travels to change song, equal to a cover width
    // How far a swipe travels to complete, the distance from the center slot to
    // an edge anchored side slot
    function artStep() {

        if (!artWrapEl) {
            return 0;
        }

        const w = artWrapEl.clientWidth;
        const cover = artWrapEl.clientHeight;

        return (w - ART_SIDE_SCALE * cover) / 2;
    }

    // Begin tracking a swipe on the cover
    function onArtTouchStart(ev) {

        if (!currentSong || ev.touches.length !== 1) {
            return;
        }

        const t = ev.touches[0];

        // Finish any glide still animating so its song change is not lost, then
        // reset to a clean rest layout before the new gesture starts
        commitArtGlide();
        positionArt(0);

        artGlideToken += 1;
        swipeActive = true;
        swipeDir = 0;
        swipeStartX = t.clientX;
        swipeStartY = t.clientY;

        setArtTransition("none");
    }

    // Glide the whole strip with the finger once a horizontal swipe is locked in
    function onArtTouchMove(ev) {

        if (!swipeActive) {
            return;
        }

        const t = ev.touches[0];
        const dx = t.clientX - swipeStartX;
        const dy = t.clientY - swipeStartY;

        // Lock the gesture direction on the first real movement
        if (swipeDir === 0) {

            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
                return;
            }

            swipeDir = Math.abs(dx) > Math.abs(dy) ? 1 : 2;
        }

        // A vertical gesture is a scroll, leave it to the page
        if (swipeDir !== 1) {
            return;
        }

        // Keep the page from scrolling or going back during the swipe
        ev.preventDefault();

        currentSwipeOffset = dx;
        positionArt(dx);
    }

    // On release, advance to the neighbor if dragged far enough, else snap back
    function onArtTouchEnd(ev) {

        // Stamp every touch end, so a synthesized dblclick can be told apart
        // from a real mouse double click
        lastArtTouchEndT = Date.now();

        if (!swipeActive) {
            return;
        }

        swipeActive = false;

        if (swipeDir !== 1) {

            // No swipe direction was locked, so this was a tap. Two taps close
            // together in time and place cycle the art overlay mode
            if (swipeDir === 0 && ev && ev.type === "touchend") {

                const t = ev.changedTouches && ev.changedTouches[0];

                if (t) {

                    const now = Date.now();

                    if (now - lastArtTapT < 320
                        && Math.abs(t.clientX - lastArtTapX) < 24
                        && Math.abs(t.clientY - lastArtTapY) < 24) {

                        lastArtTapT = 0;
                        cycleOverlayMode();

                    } else {

                        lastArtTapT = now;
                        lastArtTapX = t.clientX;
                        lastArtTapY = t.clientY;
                    }
                }
            }

            return;
        }

        const moved = currentSwipeOffset;
        const step = artStep();
        const threshold = Math.max(40, step * 0.3);

        if (moved <= -threshold && neighborSong(1)) {

            // Glide fully to the next cover, then play it on landing
            animateArt(moved, -step, function () {

                currentSwipeOffset = 0;
                playNext();
            });

        } else if (moved >= threshold && neighborSong(-1)) {

            animateArt(moved, step, function () {

                currentSwipeOffset = 0;
                playPrev();
            });

        } else {

            // Not far enough, glide back with no change
            animateArt(moved, 0, function () {

                currentSwipeOffset = 0;
            });
        }
    }

    // Glide the swipe offset from one value to another, driving positionArt each
    // frame so the scale and crossfade animate smoothly through the crossover. A
    // rising token lets a new touch cancel a glide in progress
    function animateArt(from, to, done) {

        // Commit any earlier glide first so its song change is not lost
        commitArtGlide();

        const token = ++artGlideToken;
        const start = performance.now();
        const duration = 220;

        artGlidePending = done || null;

        setArtTransition("none");

        const frame = function (now) {

            if (token !== artGlideToken) {
                return;
            }

            const k = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - k, 3);

            positionArt(from + (to - from) * eased);

            if (k < 1) {

                requestAnimationFrame(frame);

            } else {

                artGlidePending = null;

                if (done) {
                    done();
                }
            }
        };

        requestAnimationFrame(frame);
    }

    // Finish a glide still in flight at once, running its landing action so a
    // fast follow up gesture cannot drop the pending song change
    function commitArtGlide() {

        if (!artGlidePending) {
            return;
        }

        const done = artGlidePending;

        artGlidePending = null;
        artGlideToken += 1;
        done();
    }

    // Update the title and the cover strip for the current song
    // Build the small meta line shown under the now playing title
    // Joins the genres, moods, bpm and model that are present
    // Set the album art overlay lines from the same templates used over Bluetooth
    function applyCoverText(song) {

        if (!song) {

            return;
        }

        if (playerTitle) {
            playerTitle.textContent = formatMeta(settings.metaTitle, song)
                || (song.title || "Untitled");
        }

        setMetaText(formatMeta(settings.metaSubtitle, song));
    }

    // Put the meta line up, walking it across when it does not fit
    function setMetaText(text) {

        if (!metaMarquee) {
            return;
        }

        metaMarquee.setText(text);
    }

    // Turn a one line box into a marquee. The text waits at the left, slides
    // itself plus a gap fully out to the left, then comes straight back in
    // from the right and waits again, so the beginning is always readable.
    // The box keeps its own styling, only its contents are taken over
    function makeMarquee(box) {

        // One track holds both copies and is the thing that moves, so the two
        // can never drift apart
        const track = document.createElement("span");
        track.style.cssText = "display:inline-block;white-space:nowrap;will-change:transform";

        // Both are inline-block, a plain inline span reports no width at all
        // and the overflow test would never fire
        const first = document.createElement("span");
        first.style.cssText = "display:inline-block;white-space:nowrap";

        // A second copy trails the first, so as the end of the line leaves on
        // the left the beginning is already arriving on the right
        const second = document.createElement("span");
        second.style.cssText = "display:none;white-space:nowrap";

        track.appendChild(first);
        track.appendChild(second);

        box.textContent = "";
        box.appendChild(track);

        let anim = null;
        let timer = null;

        const start = function () {

            if (!track.animate) {
                return;
            }

            // Measured from the box, which is accurate for a fractional width
            const textWidth = Math.ceil(first.getBoundingClientRect().width);
            const overflow = textWidth - box.clientWidth;

            if (overflow <= 2) {
                return;
            }

            // Show the trailing copy and space it off the first
            first.style.marginRight = META_SCROLL_GAP + "px";
            second.style.display = "inline-block";

            // Travel exactly one line plus the gap. At the end the second copy
            // sits where the first began, so resetting to zero is invisible
            // and the line is on screen throughout
            const distance = textWidth + META_SCROLL_GAP;
            const duration = (distance / META_SCROLL_SPEED) * 1000;

            // Ease away from the rest position and ease back into the next
            // one, holding a steady readable speed in between
            const frames = [
                { transform: "translateX(0)", offset: 0, easing: "ease-in" },
                { transform: "translateX(" + (-distance * 0.05) + "px)", offset: 0.09, easing: "linear" },
                { transform: "translateX(" + (-distance * 0.95) + "px)", offset: 0.91, easing: "ease-out" },
                { transform: "translateX(" + (-distance) + "px)", offset: 1 }
            ];

            anim = track.animate(frames, { duration: duration });

            anim.onfinish = function () {

                anim = null;
                track.style.transform = "none";

                // Back at the left edge, so rest here exactly as at the start
                timer = setTimeout(function () {

                    timer = null;
                    start();
                }, META_SCROLL_DELAY);
            };
        };

        const setText = function (text) {

            const value = text || "";

            // The same line again, so let a walk already under way carry on
            // rather than snapping it back to the left. Both the status and
            // the meta line are rewritten far more often than they change
            if (first.textContent === value) {
                return;
            }

            if (timer) {

                clearTimeout(timer);
                timer = null;
            }

            if (anim) {

                anim.cancel();
                anim = null;
            }

            track.style.transform = "none";
            first.style.marginRight = "0px";
            first.textContent = value;

            // The trailing copy is only needed while scrolling
            second.style.display = "none";
            second.textContent = value;

            if (!value) {
                return;
            }

            // Measured after the text is in place, and only worth doing when
            // the line is actually too long for the box
            timer = setTimeout(function () {

                timer = null;
                start();
            }, META_SCROLL_DELAY);
        };

        return { setText: setText };
    }

    // Build the plays and likes line for the current song, empty until known
    function playerCountsText(song) {

        if (!nowPlayingCounts || nowPlayingCounts.song_id !== song.song_id) {
            return "";
        }

        const c = nowPlayingCounts;
        const parts = [];

        if (typeof c.play_count === "number") {
            parts.push("\u25B6 " + c.play_count + " plays");
        }

        if (typeof c.fav_count === "number") {
            parts.push("\u2665 " + c.fav_count + " likes");
        }

        return parts.join("  \u00B7  ");
    }

    // Rewrite the meta and counts lines for the current song
    // Used directly and again when the counts call returns
    function refreshNowPlayingMeta() {

        if (!currentSong) {
            return;
        }

        // Counts just arrived, update the in-panel overlay text
        applyCoverText(currentSong);

        if (playerCountsEl) {
            playerCountsEl.textContent = playerCountsText(currentSong);
        }

        // Only re-push the media session metadata when the templates use the
        // counts, since re-sending carries the cover and iOS caps covers per song
        if (/\$\{(plays|likes)\}/.test((settings.metaTitle || "") + (settings.metaSubtitle || ""))) {

            reassertNowPlaying();
        }
    }

    function updatePlayerInfo(song) {

        updateMediaMetadata(song);

        refreshNowStars();
        updateRateButton();

        if (!playerTitle) {
            return;
        }

        if (!song) {

            playerTitle.textContent = "Nothing playing";
            nowPlayingCounts = null;

            // Drop the lyric line and waveform of the stopped song
            lyricRows = [];
            lyricIdx = -1;
            waveData = null;
            updateLyricLine(true);
            updateSeekMode();

            setMetaText("");

            if (playerCountsEl) {
                playerCountsEl.textContent = "";
            }

            if (artPlaceholderEl) {
                artPlaceholderEl.style.display = "flex";
            }

            updateSeekDisplay();
            updatePlayPause();
            return;
        }

        applyCoverText(song);

        if (playerCountsEl) {
            playerCountsEl.textContent = playerCountsText(song);
        }

        if (artPlaceholderEl) {
            artPlaceholderEl.style.display = coverUrl(song) ? "none" : "flex";
        }

        // Refill the strip around the new current song and reset its position
        setArtTransition("none");
        setArtSources();
        positionArt(0);
        currentSwipeOffset = 0;

        updatePlayPause();
    }

    // Update the seek bar position and the elapsed and remaining time labels
    // Extract a lyric row's start time in milliseconds, accepting the field
    // name variants the API might use, or null when the row has no timing
    function rowStartMs(row) {

        if (!row || typeof row !== "object") {
            return null;
        }

        const keys = ["start_ms", "begin_ms", "start_time", "begin_time",
            "start", "begin", "time", "offset"];

        for (const key of keys) {

            const v = row[key];

            if (typeof v === "number" && isFinite(v) && v >= 0) {
                return v;
            }
        }

        return null;
    }

    // Flatten the timed lyric segments into one sorted list of {t, text}.
    // Rows without timing are skipped, an empty result disables the display
    function buildLyricRows(lyrics) {

        const out = [];

        if (!Array.isArray(lyrics)) {
            return out;
        }

        lyrics.forEach(function (seg) {

            if (!seg || !Array.isArray(seg.rows)) {
                return;
            }

            seg.rows.forEach(function (r) {

                if (!r || typeof r.text !== "string" || r.text === "") {
                    return;
                }

                const t = rowStartMs(r);

                if (t !== null) {
                    out.push({ t: t, text: r.text });
                }
            });
        });

        out.sort(function (a, b) {
            return a.t - b.t;
        });

        // Timestamps might be in seconds, convert when far too small to be ms
        if (out.length > 0 && out[out.length - 1].t < 600) {

            for (const r of out) {
                r.t = r.t * 1000;
            }
        }

        return out;
    }

    // Lyric roll layout, five stacked rows, index 0 exit above through 4 entry
    // below, each with its resting y offset, font size, color and opacity. A one
    // line advance animates every row up from the geometry of the row beneath it
    // The five lyric slots, computed from the configurable current line size.
    // Index 0 exit above, 1 previous, 2 current, 3 next, 4 entry below. Exit and
    // entry sit only half a line beyond their neighbor and shrink, so a leaving
    // or arriving line rolls a short way and fades in both opacity and size,
    // like text curving over the back of a cylinder
    let LYRIC_SLOTS = [];

    // Uniform line box height for the lyric rows, set by computeLyricSlots
    let lyricLineH = 24;

    function computeLyricSlots() {

        const base = Math.max(10, settings.lyricSize || 18);
        const side = Math.round(base * (settings.lyricSideMul || 0.8));
        const edge = Math.round(side * 0.7);
        const dim = "#dddddd";
        const white = "#ffffff";

        // One line box height for every row keeps the gaps between lines even
        // despite the different font sizes, with text vertically centered. The
        // multiplier is configurable, smaller pulls the side lines closer
        lyricLineH = Math.round(base * (settings.lyricLineMul || 1.5));
        const half = Math.round(lyricLineH * 0.5);

        // Optional horizontal inset for the non current lines
        const sx = settings.lyricSideShift || 0;

        const prevY = half;
        const curY = prevY + lyricLineH;
        const nextY = curY + lyricLineH;

        LYRIC_SLOTS = [
            { y: prevY - half, x: sx, size: edge, color: dim, op: 0, z: 0 },
            { y: prevY, x: sx, size: side, color: dim, op: 0.75, z: 2 },
            { y: curY, x: 0, size: base, color: white, op: 1, z: 3 },
            { y: nextY, x: sx, size: side, color: dim, op: 0.75, z: 2 },
            { y: nextY + half, x: sx, size: edge, color: dim, op: 0, z: 0 }
        ];

        return nextY + half + lyricLineH;
    }

    // Apply the computed slot geometry to the row elements and size the box
    function applyLyricLayout() {

        if (!lyricBox || lyricSlots.length < 5) {
            return;
        }

        const boxH = computeLyricSlots();

        for (let i = 0; i < 5; i += 1) {

            const s = LYRIC_SLOTS[i];
            const el = lyricSlots[i];

            el.style.top = s.y + "px";
            el.style.left = s.x + "px";
            el.style.fontSize = s.size + "px";
            el.style.lineHeight = lyricLineH + "px";
            el.style.height = lyricLineH + "px";
            el.style.color = s.color;
            el.style.zIndex = String(s.z);
            el.style.fontWeight = i === 2 ? "600" : "400";
        }

        lyricBox.style.height = boxH + "px";

        // Positive shifts the whole lyric block down, negative up
        lyricBox.style.transform = "translateY(" + (settings.lyricShift || 0) + "px)";

        updateLyricLine(true);
    }

    // Reflect the overlay mode on the scrim, the info block and the counts.
    // The single scrim element animates its height and opacity between the
    // per mode targets, so the fade stays one smooth gradient with no seams
    function refreshOverlay(lyricActive) {

        if (!bottomScrimEl || !bottomWrapEl) {
            return;
        }

        const mode = settings.artOverlayMode;

        // Invisible stars must not take taps meant for the cover underneath
        if (nowStarsBar) {
            nowStarsBar.el.style.pointerEvents = mode === "none" ? "none" : "auto";
        }

        if (mode === "none") {

            bottomScrimEl.style.opacity = "0";
            bottomWrapEl.style.opacity = "0";

            if (playerCountsEl) {
                playerCountsEl.style.opacity = "0";
            }

            if (statusEl) {
                statusEl.style.opacity = "0";
            }

            return;
        }

        // Tall shading only while lyrics actually show. Info alone needs just
        // enough to back the title and meta, so the art above stays untinted
        // A little taller when the star row sits under the meta line
        const starsShown = nowStarsBar && nowStarsBar.el.style.display !== "none";

        bottomScrimEl.style.height = lyricActive ? "88%" : (starsShown ? "28%" : "20%");
        bottomScrimEl.style.opacity = "1";
        bottomWrapEl.style.opacity = "1";

        if (playerCountsEl) {
            playerCountsEl.style.opacity = "1";
        }

        if (statusEl) {
            statusEl.style.opacity = "1";
        }
    }

    // Advance the overlay mode, none to info to all, remember it and confirm
    // with a short toast over the art
    function cycleOverlayMode() {

        const order = ["none", "info", "all"];
        const labels = { none: "Overlays off", info: "Song info", all: "Info + lyrics" };
        const idx = order.indexOf(settings.artOverlayMode);

        settings.artOverlayMode = order[(idx + 1) % order.length];
        saveSettings();
        updateLyricLine(true);
        showArtToast(labels[settings.artOverlayMode]);
    }

    // Show a short confirmation pill centered on the art
    function showArtToast(text) {

        if (!artWrapEl) {
            return;
        }

        if (!artToastEl) {

            artToastEl = document.createElement("div");
            artToastEl.style.cssText = [
                "position:absolute",
                "left:50%",
                "top:50%",
                "transform:translate(-50%,-50%)",
                "background:rgba(0,0,0,0.65)",
                "color:#fff",
                "font-size:13px",
                "padding:6px 14px",
                "border-radius:16px",
                "pointer-events:none",
                "opacity:0",
                "z-index:6",
                "white-space:nowrap"
            ].join(";");

            artWrapEl.appendChild(artToastEl);
        }

        artToastEl.textContent = text;

        if (!artToastEl.animate) {

            return;
        }

        try {

            artToastEl.getAnimations().forEach(function (a) {
                a.cancel();
            });
        } catch (e) {
        }

        artToastEl.animate([
            { opacity: 0 },
            { opacity: 1, offset: 0.15 },
            { opacity: 1, offset: 0.75 },
            { opacity: 0 }
        ], {
            duration: 1400,
            easing: "ease-in-out"
        });
    }

    // The text for the lyric row at the given offset from the current one
    function lyricTextAt(off) {

        const r = lyricIdx + off;

        return (r >= 0 && r < lyricRows.length) ? lyricRows[r].text : "";
    }

    // Place the five rows at rest with no animation, used on load and on a jump
    function setLyricRows(texts) {

        for (let i = 0; i < 5; i += 1) {

            const s = LYRIC_SLOTS[i];

            lyricSlots[i].textContent = texts[i];
            lyricSlots[i].style.transform = "translate(0px, 0px) scale(1)";
            lyricSlots[i].style.color = s.color;
            lyricSlots[i].style.zIndex = String(s.z);
            lyricSlots[i].style.opacity = texts[i] ? String(s.op) : "0";
        }
    }

    // Roll the five rows up one line. Each row shows the text that was one slot
    // below it, so it animates from that lower slot's position, size, color and
    // opacity into its own, which reads as the whole stack rolling up
    function rollLyricRows(texts) {

        for (let i = 0; i < 5; i += 1) {

            const dest = LYRIC_SLOTS[i];
            const from = LYRIC_SLOTS[i + 1] || dest;

            lyricSlots[i].textContent = texts[i];
            lyricSlots[i].style.transform = "translate(0px, 0px) scale(1)";
            lyricSlots[i].style.color = dest.color;
            lyricSlots[i].style.zIndex = String(dest.z);
            lyricSlots[i].style.opacity = texts[i] ? String(dest.op) : "0";

            if (!lyricSlots[i].animate) {
                continue;
            }

            try {

                lyricSlots[i].getAnimations().forEach(function (a) {
                    a.cancel();
                });
            } catch (e) {
            }

            const fromX = from.x - dest.x;
            const fromY = from.y - dest.y;
            const fromScale = from.size / dest.size;
            const fromOp = texts[i] ? from.op : 0;

            lyricSlots[i].animate([
                {
                    transform: "translate(" + fromX + "px, " + fromY + "px) scale(" + fromScale + ")",
                    opacity: fromOp,
                    color: from.color
                },
                {
                    transform: "translate(0px, 0px) scale(1)",
                    opacity: texts[i] ? dest.op : 0,
                    color: dest.color
                }
            ], {
                duration: 340,
                easing: "ease-out"
            });
        }
    }

    // Update the lyric rows to the current playback position. A single line
    // advance rolls, any other change like a jump or a seek just sets in place
    function updateLyricLine(force) {

        if (!lyricBox || lyricSlots.length < 5) {
            return;
        }

        // A song marked instrumental by hand has lyrics text only because
        // Mureka needs instructions in the prompt, so never show them
        const active = settings.artOverlayMode === "all"
            && lyricRows.length > 0
            && audio
            && !(currentSong && isManualInstrumental(currentSong));

        refreshOverlay(active);

        if (!active) {

            lyricBox.style.display = "none";
            lyricIdx = -1;
            return;
        }

        lyricBox.style.display = "block";

        const ms = isFinite(audio.currentTime) ? audio.currentTime * 1000 : 0;

        // The rows are sorted, take the last one that has started
        let idx = -1;

        for (let i = 0; i < lyricRows.length; i += 1) {

            if (lyricRows[i].t <= ms) {
                idx = i;
            } else {
                break;
            }
        }

        if (idx === lyricIdx && !force) {
            return;
        }

        const step = idx - lyricIdx;

        lyricIdx = idx;

        const texts = [
            lyricTextAt(-2),
            lyricTextAt(-1),
            lyricTextAt(0),
            lyricTextAt(1),
            lyricTextAt(2)
        ];

        if (step === 1 && !force) {
            rollLyricRows(texts);
        } else {
            setLyricRows(texts);
        }
    }

    // A stable Cache API key for a song's stored waveform
    function waveStoreKey(id) {

        return "https://mureka-wave-cache/" + encodeURIComponent(id);
    }

    // Persist a song's waveform, skipping songs already stored
    async function saveWaveToStore(id, list) {

        try {

            const store = await caches.open(WAVE_STORE);
            const key = waveStoreKey(id);

            if (await store.match(key)) {
                return;
            }

            await store.put(key, new Response(JSON.stringify(list), {
                headers: { "Content-Type": "application/json" }
            }));
        } catch (e) {
        }
    }

    // Read a song's stored waveform, or null when it has none yet
    async function loadWaveFromStore(id) {

        try {

            const store = await caches.open(WAVE_STORE);
            const res = await store.match(waveStoreKey(id));

            if (!res) {

                return null;
            }

            return await res.json();
        } catch (e) {

            return null;
        }
    }

    // Background wave collection. Songs cached before waves were persisted have
    // no stored waveform, and only the feed carries it, so this scans the feed
    // in the background, saving every wave it passes. The cursor persists for
    // the session, so each scan resumes where the previous one stopped instead
    // of re-reading the same pages
    let waveScanRunning = false;
    let waveScanCursor = null;
    let waveScanDone = false;

    async function collectWaves(wantId) {

        // One scan at a time, and never beside a manual library load
        if (waveScanRunning || waveScanDone || running) {
            return;
        }

        waveScanRunning = true;

        try {

            let cursor = waveScanCursor;
            let pages = 0;

            // A cap keeps one run bounded, the next run resumes from the cursor
            while (pages < 40) {

                let page;

                try {
                    page = await fetchPage(cursor);
                } catch (e) {
                    break;
                }

                const songs = extractSongs(page);

                if (songs.length === 0) {
                    waveScanDone = true;
                    break;
                }

                let foundWant = false;

                for (const s of songs) {

                    if (Array.isArray(s.wave_list) && s.wave_list.length > 0) {

                        await saveWaveToStore(s.song_id, s.wave_list);

                        if (wantId !== null && s.song_id === wantId) {
                            foundWant = true;
                        }
                    }
                }

                pages += 1;

                const more = hasMore(page);
                const next = getCursor(page, songs);

                if (more === false || next === null || next === cursor) {
                    waveScanDone = true;
                    break;
                }

                cursor = next;
                waveScanCursor = cursor;

                // The wanted song is covered, stop here and resume later
                if (foundWant) {
                    break;
                }

                await sleep(PAGE_DELAY);
            }
        } finally {
            waveScanRunning = false;
        }

        // The wanted song may have its wave stored now, show it
        if (wantId !== null && currentSong && currentSong.song_id === wantId && !waveData) {
            loadWaveForSong(currentSong);
        }
    }

    // Load the stored waveform for the song now starting, if it has one
    async function loadWaveForSong(song) {

        const id = song.song_id;
        const stored = await loadWaveFromStore(id);

        // A different song took over while reading
        if (!currentSong || currentSong.song_id !== id) {
            return;
        }

        const w = normalizeWave(stored);

        if (w) {

            waveData = w;
            updateSeekMode();

        } else {

            // Not stored yet, collect it from the feed in the background. When
            // the scan reaches this song it re-loads and shows the wave
            collectWaves(id);
        }
    }

    // Find the wave list in a detail response, tolerating different locations
    // and formats. It may sit beside the song or inside it, be a plain array,
    // a JSON encoded string, or a comma separated string
    function extractWaveList(d) {

        if (!d || typeof d !== "object") {
            return null;
        }

        const spots = [
            d.wave_list,
            d.song && d.song.wave_list,
            d.waveform,
            d.song && d.song.waveform,
            d.wave,
            d.song && d.song.wave
        ];

        for (let c of spots) {

            if (typeof c === "string" && c.length > 0) {

                // A JSON encoded array, or a bare comma separated list
                try {
                    c = JSON.parse(c);
                } catch (e) {
                    c = c.split(",");
                }
            }

            if (Array.isArray(c) && c.length > 0) {
                return c;
            }
        }

        return null;
    }

    // Normalize a wave list to floats between 0 and 1, or null when unusable
    function normalizeWave(w) {

        if (!Array.isArray(w) || w.length === 0) {
            return null;
        }

        let max = 0;

        for (const v of w) {

            const n = Number(v);

            if (isFinite(n) && n > max) {
                max = n;
            }
        }

        if (max <= 0) {
            return null;
        }

        return w.map(function (v) {

            const n = Number(v);

            return isFinite(n) && n > 0 ? n / max : 0;
        });
    }

    // Choose between the waveform canvas and the classic slider
    function updateSeekMode() {

        if (!waveCanvas || !seekBar) {
            return;
        }

        const useWave = settings.waveSeek && waveData !== null;

        waveCanvas.style.display = useWave ? "block" : "none";
        seekBar.style.display = useWave ? "none" : "";

        if (useWave) {
            drawWave();
        }
    }

    // Draw the waveform bars, played part cyan, optionally previewing a seek
    function drawWave(previewFrac) {

        if (!waveCanvas || !waveData) {
            return;
        }

        const cssW = waveCanvas.clientWidth;
        const cssH = waveCanvas.clientHeight;

        if (cssW === 0 || cssH === 0) {
            return;
        }

        // Match the backing store to the display size and pixel density
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(cssW * dpr);
        const h = Math.round(cssH * dpr);

        if (waveCanvas.width !== w || waveCanvas.height !== h) {
            waveCanvas.width = w;
            waveCanvas.height = h;
        }

        const ctx = waveCanvas.getContext("2d");
        ctx.clearRect(0, 0, w, h);

        const barW = 2 * dpr;
        const gap = 1 * dpr;
        const count = Math.max(1, Math.floor(w / (barW + gap)));
        const duration = (audio && isFinite(audio.duration)) ? audio.duration : 0;

        let frac = 0;

        if (typeof previewFrac === "number") {
            frac = previewFrac;
        } else if (duration > 0 && audio) {
            frac = audio.currentTime / duration;
        }

        for (let i = 0; i < count; i += 1) {

            // Each bar shows the peak of its slice of the wave
            const a = Math.floor(i * waveData.length / count);
            const b = Math.max(a + 1, Math.floor((i + 1) * waveData.length / count));
            let peak = 0;

            for (let j = a; j < b; j += 1) {

                if (waveData[j] > peak) {
                    peak = waveData[j];
                }
            }

            const bh = Math.max(2 * dpr, peak * (h - 2 * dpr));
            const x = i * (barW + gap);
            const y = (h - bh) / 2;

            ctx.fillStyle = ((i + 0.5) / count) <= frac ? "#48e1eb" : "#555";
            ctx.fillRect(x, y, barW, bh);
        }
    }

    function updateSeekDisplay() {

        if (!seekBar) {
            return;
        }

        const duration = (audio && isFinite(audio.duration)) ? audio.duration : 0;
        const current = (audio && isFinite(audio.currentTime)) ? audio.currentTime : 0;

        seekBar.max = duration > 0 ? duration : 0;

        if (!isSeeking) {
            seekBar.value = current;
        }

        if (curTimeEl) {
            curTimeEl.textContent = formatTime(current);
        }

        if (remTimeEl) {

            const remaining = duration > 0 ? (duration - current) : 0;

            remTimeEl.textContent = "-" + formatTime(remaining);
        }

        if (waveCanvas && waveData && !isSeeking && waveCanvas.style.display !== "none") {
            drawWave();
        }

        updateMediaPosition();
    }

    // Register media key handlers so playerctl and hardware keys control playback
    function setupMediaSession() {

        if (!("mediaSession" in navigator)) {
            return;
        }

        // setActionHandler throws for actions the browser does not support
        // Track what the browser accepted, so a silently refused action can be
        // seen instead of looking like a broken handler
        const accepted = [];
        const refused = [];

        const setHandler = function (action, fn) {

            try {

                navigator.mediaSession.setActionHandler(action, fn);
                accepted.push(action);

            } catch (e) {
                refused.push(action);
            }
        };

        setHandler("play", function () {

            // Starts, resumes or reloads as needed, see startAudioPlayback
            startAudioPlayback();
        });

        setHandler("pause", function () {

            // A pause the user asked for, not an interruption
            userPaused = true;

            if (audio) {
                audio.pause();
            }
        });

        setHandler("previoustrack", function () {
            playPrev();
        });

        setHandler("nexttrack", function () {
            playNext();
        });

        setHandler("stop", function () {
            stopPlay();
        });

        setHandler("seekto", function (details) {

            if (audio && details && typeof details.seekTime === "number") {
                audio.currentTime = details.seekTime;
                updateSeekDisplay();
            }
        });

        // In debug mode report what the browser took, since a refusal here is
        // indistinguishable from a handler that simply never gets called
        if (isDebug() && refused.length > 0) {
            setStatus("Media actions refused: " + refused.join(", "));
        }
    }

    // Guess an image MIME type from a URL, defaulting to jpeg
    // Draw a cover blob to a clean square JPEG of the given size and return it
    // as a data url, or null on failure. Re-encoding through a canvas strips any
    // odd format, color profile or metadata, and the data url form avoids the
    // blob url loading and memory issues iOS has with media session artwork
    async function makeScaledDataUrl(blob, size, quality) {

        try {

            if (!self.createImageBitmap) {

                return null;
            }

            const bmp = await createImageBitmap(blob);
            const canvas = document.createElement("canvas");

            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(bmp, 0, 0, size, size);

            if (bmp.close) {

                bmp.close();
            }

            return canvas.toDataURL("image/jpeg", quality);
        } catch (e) {

            return null;
        }
    }

    // Re-encode a cover to a clean JPEG data url at up to maxSize, never scaling
    // past the source resolution so it stays as sharp as the original without
    // wasting bytes. Returns the data url and its real pixel size, or null
    async function makeCoverDataUrl(blob, maxSize, quality) {

        try {

            if (!self.createImageBitmap) {

                return null;
            }

            const bmp = await createImageBitmap(blob);
            const src = Math.max(bmp.width, bmp.height) || maxSize;
            const size = Math.max(1, Math.min(maxSize, src));
            const canvas = document.createElement("canvas");

            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(bmp, 0, 0, size, size);

            if (bmp.close) {

                bmp.close();
            }

            return { url: canvas.toDataURL("image/jpeg", quality), size: size };
        } catch (e) {

            return null;
        }
    }

    // Build an artwork list from local blobs, the real 128px downscale first as
    // the primary, then the full cover for the large lock screen view
    // Revoke the object urls currently referenced by the media session
    // Retire a batch of old object urls. The revoke waits a short grace so the
    // song that replaces them has time to load its own cover before the old
    // urls are released, which avoids blanking the art during the swap
    // Artwork list for a song from its cached data urls, smallest first, which
    // is the size iOS picks from. Data urls carry the image inline, so there is
    // no blob url for iOS to load, cache badly, or leak
    function artworkFor(song) {

        // Chromium fetches artwork in the browser process and is happier with
        // an ordinary https url than with a few hundred kilobytes of base64.
        // The data urls exist because iOS would not take blob urls, so which
        // form is used is a setting rather than a guess about the browser
        if (settings.remoteArtwork) {

            const remote = coverUrl(song);

            return remote ? [{ src: remote, sizes: "512x512", type: "image/jpeg" }] : [];
        }

        const entry = artCache.get(song.song_id);

        if (!entry) {

            return [];
        }

        const list = [];

        if (entry.small) {

            list.push({ src: entry.small, sizes: "128x128", type: "image/jpeg" });
        }

        if (entry.large) {

            const dim = entry.largeSize + "x" + entry.largeSize;

            list.push({ src: entry.large, sizes: dim, type: "image/jpeg" });
        }

        return list;
    }

    // Build the Media Session artwork list, the one cover repeated at the sizes
    // iOS picks from, smallest first, each tagged with an explicit type
    // Values for the now playing template tags for one song
    function metaTagValues(song) {

        const genre = (song.genres && song.genres.length) ? song.genres.join(", ") : "";
        const mood = (song.moods && song.moods.length) ? song.moods.join(", ") : "";
        const artist = creatorSource ? (creatorSource.stage_name || "") : (selfName || "");
        const duration = song.duration_milliseconds
            ? formatTime(song.duration_milliseconds / 1000)
            : "";

        // Play and like counts are fetched per song and only valid for that song
        const counts = (nowPlayingCounts && nowPlayingCounts.song_id === song.song_id)
            ? nowPlayingCounts
            : null;
        const plays = (counts && typeof counts.play_count === "number")
            ? String(counts.play_count)
            : "";
        const likes = (counts && typeof counts.fav_count === "number")
            ? String(counts.fav_count)
            : "";

        return {
            title: song.title || "",
            genre: genre,
            mood: mood,
            bpm: effectiveBpm(song) > 0 ? String(effectiveBpm(song)) : "",
            model: song.model || "",
            artist: artist,
            duration: duration,
            plays: plays,
            likes: likes,
            ctime: song.generate_at ? fmtDate(song.generate_at) : "",
            ptime: song.publish_at ? fmtDate(song.publish_at) : "",
            mode: modeStatusText(),
            instrumental: isInstrumental(song) ? "Instrumental" : "",
            stars: starsText(song)
        };
    }

    // Expand a now playing template. ${tag} inserts a value. Text inside [ ] is
    // kept only when every tag inside it has a value, so labels and separators
    // disappear cleanly when a field is missing
    // Five star characters for the templates, lit ones filled. Empty while
    // the song is not rated, so a bracket section around it drops away
    function starsText(song) {

        const r = getRating(song);

        if (r === null) {
            return "";
        }

        return "\u2605".repeat(r) + "\u2606".repeat(5 - r);
    }

    function formatMeta(template, song) {

        if (!template) {
            return "";
        }

        const values = metaTagValues(song);

        // Drop bracket sections that contain an empty tag, resolve the rest
        let result = template.replace(/\[([^\[\]]*)\]/g, function (whole, inner) {

            let filled = true;

            const text = inner.replace(/\$\{(\w+)\}/g, function (m, key) {

                const v = values[key];

                if (v === undefined || v === "") {
                    filled = false;
                    return "";
                }

                return v;
            });

            return filled ? text : "";
        });

        // Resolve any tags outside brackets
        result = result.replace(/\$\{(\w+)\}/g, function (m, key) {

            const v = values[key];

            return (v === undefined) ? "" : v;
        });

        return result.trim();
    }

    // Preview text for a template using the currently loaded song
    function metaPreviewText(template) {

        if (!currentSong) {

            return "(no song loaded)";
        }

        const out = formatMeta(template, currentSong);

        return out || "(empty)";
    }

    function setMediaMetadata(song, artwork) {

        // Build the two visible lines from the user templates, falling back to
        // the title and genre when a template is empty or expands to nothing
        const title = formatMeta(settings.metaTitle, song) || (song.title || "Untitled");
        const subtitle = formatMeta(settings.metaSubtitle, song)
            || (song.genres || []).join(", ")
            || "Mureka";

        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: subtitle,
                album: "Mureka",
                artwork: artwork
            });
        } catch (e) {
        }
    }

    // Store a song's cover blobs, evicting the oldest over the limit. The blobs
    // are held directly, so evicted ones are freed by the garbage collector
    function artCachePut(id, entry) {

        if (artCache.has(id)) {
            artCache.delete(id);
        }

        artCache.set(id, entry);

        while (artCache.size > ART_CACHE_MAX) {

            const oldest = artCache.keys().next().value;
            artCache.delete(oldest);
        }
    }

    // Drop all cached covers and free the live object urls
    function clearArtBlob() {

        artCache.clear();
    }

    // Fetch the cover as a local blob and swap it into the Media Session. Local
    // bytes mean Bluetooth does not have to refetch a remote URL for every
    // track, which is what makes the art drop to a generic icon over time
    // A stable Cache API key for a song's stored cover entry
    function artStoreKey(id) {

        return "https://mureka-art-cache/" + encodeURIComponent(id);
    }

    // Read a song's re-encoded cover entry from the persistent cache, or null
    async function loadArtFromStore(id) {

        try {

            const store = await caches.open(ART_STORE);
            const res = await store.match(artStoreKey(id));

            if (!res) {

                return null;
            }

            return await res.json();
        } catch (e) {

            return null;
        }
    }

    // Persist a song's re-encoded cover entry so it survives across sessions
    async function saveArtToStore(id, entry) {

        try {

            const store = await caches.open(ART_STORE);
            const body = JSON.stringify(entry);

            await store.put(artStoreKey(id), new Response(body, {
                headers: { "Content-Type": "application/json" }
            }));

            artCachedIds.add(String(id));
            scheduleDotRefresh();
        } catch (e) {
        }
    }

    // Coalesce list re-renders after covers are stored, so the dots update
    // without redrawing on every single cover during a bulk cache
    let dotRefreshTimer = null;

    function scheduleDotRefresh() {

        if (dotRefreshTimer) {
            return;
        }

        dotRefreshTimer = setTimeout(function () {

            dotRefreshTimer = null;
            renderList();
        }, 300);
    }

    // Fetch, re-encode and persist a song's cover so it is ready offline and on
    // first play, the same way the audio is cached. Skips the work if already
    // stored, and does not touch the media session
    async function cacheArt(song) {

        const id = song.song_id;

        // Already in memory for a recent song
        if (artCache.has(id)) {
            return;
        }

        const url = coverUrl(song);

        if (!url) {
            return;
        }

        // Already persisted from a previous session or run
        const stored = await loadArtFromStore(id);

        if (stored && stored.small) {
            return;
        }

        let blob;

        try {

            const res = await timedFetch(url);

            if (!res || !res.ok) {
                return;
            }

            blob = await res.blob();
        } catch (e) {

            return;
        }

        const small = await makeScaledDataUrl(blob, 128, 0.85);
        const big = await makeCoverDataUrl(blob, 1024, 0.82);

        if (!small && !big) {
            return;
        }

        saveArtToStore(id, {
            small: small,
            large: big ? big.url : null,
            largeSize: big ? big.size : 0
        });
    }

    async function loadArtBlob(song, url) {

        if (!url) {
            return;
        }

        const id = song.song_id;

        // Already have this song's art in memory
        if (artCache.has(id)) {
            return;
        }

        const token = ++artFetchToken;

        // Persistent cache first. A stored cover skips both the download and the
        // re-encode and survives across sessions, like the audio cache does
        const stored = await loadArtFromStore(id);

        if (stored && stored.small) {

            if (token !== artFetchToken || !currentSong || currentSong.song_id !== id) {
                return;
            }

            artCachePut(id, stored);

            if (id === npWantId) {
                tryNowPlaying();
            }

            return;
        }

        let blob;

        try {
            const res = await timedFetch(url);

            if (!res || !res.ok) {
                return;
            }

            blob = await res.blob();
        } catch (e) {
            return;
        }

        // A newer song started while fetching, drop this stale cover
        if (token !== artFetchToken) {
            return;
        }

        if (!currentSong || currentSong.song_id !== id) {
            return;
        }

        // Re-encode the cover to clean JPEG data urls, a small one for compact
        // slots and a large one up to 1024 for a sharp lock screen and car
        // display. The large one is capped to the source so it never upscales
        const small = await makeScaledDataUrl(blob, 128, 0.85);
        const big = await makeCoverDataUrl(blob, 1024, 0.82);

        // A newer track took over during the async work, drop this cover
        if (token !== artFetchToken || !currentSong || currentSong.song_id !== id) {

            return;
        }

        if (!small && !big) {

            return;
        }

        const entry = {
            small: small,
            large: big ? big.url : null,
            largeSize: big ? big.size : 0
        };

        artCachePut(id, entry);

        // Persist so this cover never has to download or re-encode again
        saveArtToStore(id, entry);

        // The cover for the wanted song decoded, send if playback is also running
        if (id === npWantId) {
            tryNowPlaying();
        }
    }

    // Tell the OS what is playing, so playerctl and the lock screen show the
    // right title and art. The cover is shown at once from its remote URL, then
    // swapped for a local blob that Bluetooth reads more reliably
    // Re-assert the Now Playing metadata for the current song. Pressing play
    // after a call or another app took the media slot must refresh the lock
    // screen and Bluetooth art, which are otherwise only set on a track change
    function reassertNowPlaying() {

        if (!currentSong) {
            return;
        }

        sendNowPlaying();
        updateMediaPosition();
    }

    // Debug artwork test, a transparent tap area over the art cycles through
    // marker covers plus the real one, to see which the system will show
    let testBtn = null;
    let testIcons = null;
    let testArtIndex = 0;
    let testArtToken = 0;

    // Build a recognizable solid color marker cover with a big label as a data
    // url, used by the artwork test button
    function makeTestIcon(label, color) {

        const size = 128;
        const canvas = document.createElement("canvas");

        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d");

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 72px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, size / 2, size / 2);

        return canvas.toDataURL("image/jpeg", 0.9);
    }

    // The marker covers, built once on first use
    function testArtSet() {

        if (!testIcons) {

            testIcons = [
                { name: "Marker 1 red", art: makeTestIcon("1", "#cc3344") },
                { name: "Marker 2 green", art: makeTestIcon("2", "#2f9e52") },
                { name: "Marker 3 blue", art: makeTestIcon("3", "#3366cc") }
            ];
        }

        return testIcons;
    }

    // Push the next test cover to the media session and show a two second sent
    // note in the artist line so it can be checked over Bluetooth
    function sendTestArt() {

        if (!currentSong || !("mediaSession" in navigator)) {

            return;
        }

        const icons = testArtSet();
        const idx = testArtIndex % 4;

        testArtIndex += 1;

        let artwork;
        let label;

        if (idx < 3) {

            artwork = [{ src: icons[idx].art, sizes: "128x128", type: "image/jpeg" }];
            label = icons[idx].name;

        } else {

            artwork = artworkFor(currentSong);
            label = "Real cover";
        }

        const title = formatMeta(settings.metaTitle, currentSong)
            || currentSong.title
            || "Untitled";

        // Push the test cover now with a sent confirmation in the artist line
        try {

            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: "Sent: " + label,
                album: "Mureka",
                artwork: artwork
            });
        } catch (e) {
        }

        setStatus("Sent " + label);

        const token = ++testArtToken;

        // After two seconds, restore the normal artist line but keep the test
        // cover on screen so it can still be inspected
        setTimeout(function () {

            if (currentSong && token === testArtToken) {

                setMediaMetadata(currentSong, artwork);
            }
        }, 2000);
    }

    // Show the artwork test tap area only while debug mode is on
    function updateTestButton() {

        if (testBtn) {

            testBtn.style.display = settings.artTest ? "block" : "none";
        }
    }

    // Now Playing send state. A track change coalesces into a single send once
    // the cover has decoded and playback is running, so the cover goes out
    // complete, after iOS has the session, and within the per song cover cap
    let npWantId = null;
    let npPlaying = false;
    let npCoverSent = false;
    let npFallback = null;

    // Push the current metadata and cover to the media session now
    function sendNowPlaying() {

        if (!currentSong) {
            return;
        }

        // Ownership of the controls and the handlers go together on iOS, so
        // re-register whenever the now playing metadata is pushed
        setupMediaSession();
        setMediaMetadata(currentSong, artworkFor(currentSong));
    }

    // Push the metadata again on a resume. iOS counts distinct cover updates
    // per song and grey boxes the artwork once too many go out, which is why
    // this is off by default. Chromium has no such limit, so on Android it can
    // be left on and the art is refreshed every time playback picks up again
    function resendArtOnResume() {

        if (!settings.artOnResume || !currentSong) {
            return;
        }

        sendNowPlaying();
    }

    // Send the first cover for the current song once it has decoded and playback
    // is running, and only once
    function tryNowPlaying() {

        if (npCoverSent || !currentSong) {
            return;
        }

        if (!npPlaying || !artCache.has(currentSong.song_id)) {
            return;
        }

        npCoverSent = true;

        if (npFallback) {

            clearTimeout(npFallback);
            npFallback = null;
        }

        sendNowPlaying();
    }

    // Fallback when the cover or playback is slow, so the lock screen never
    // stays blank. If the cover was not ready, tryNowPlaying still sends it later
    function forceNowPlaying() {

        npFallback = null;

        if (npCoverSent || !currentSong) {
            return;
        }

        // Only force a send when the cover is ready. Sending with no cover makes
        // iOS show the page logo, so wait for the cover to arrive instead
        if (!artCache.has(currentSong.song_id)) {
            return;
        }

        sendNowPlaying();
        npCoverSent = true;
    }

    function updateMediaMetadata(song) {

        if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") {
            return;
        }

        if (npFallback) {

            clearTimeout(npFallback);
            npFallback = null;
        }

        if (!song) {

            npWantId = null;
            clearArtBlob();

            try {
                navigator.mediaSession.playbackState = "none";
            } catch (e) {
            }

            return;
        }

        // Start a fresh coalesced send for this song
        npWantId = song.song_id;
        npPlaying = false;
        npCoverSent = false;

        // Do not send yet, an empty artwork makes iOS show the page logo. Wait
        // for the cover so the lock screen goes straight from the old cover to
        // the new one, the send happens in the readiness gate below
        npFallback = setTimeout(forceNowPlaying, 700);

        // Decode the cover if we do not have it yet
        if (!artCache.has(song.song_id)) {

            const art = coverUrl(song);

            if (art) {
                loadArtBlob(song, art);
            }
        }

        tryNowPlaying();
    }

    // Report the current position so playerctl shows progress and can seek
    function updateMediaPosition() {

        if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) {
            return;
        }

        if (!audio) {
            return;
        }

        const duration = audio.duration;

        if (!isFinite(duration) || duration <= 0) {
            return;
        }

        let position = audio.currentTime;

        if (!isFinite(position) || position < 0) {
            position = 0;
        }

        if (position > duration) {
            position = duration;
        }

        try {
            navigator.mediaSession.setPositionState({
                duration: duration,
                position: position,
                playbackRate: audio.playbackRate || 1
            });
        } catch (e) {
        }
    }

    // Build the floating control panel
    function buildPanel() {

        const panel = document.createElement("div");
        panelEl = panel;
        panel.id = "mureka-player-panel";

        panel.style.cssText = [
            "position:fixed",
            "top:16px",
            "left:16px",
            "z-index:999999",
            "background:#1d1d22",
            "color:#fff",
            "font:13px/1.4 sans-serif",
            "text-size-adjust:100%",
            "-webkit-text-size-adjust:100%",
            "padding:12px",
            "border-radius:10px",
            "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
            "width:300px",
            "display:flex",
            "flex-direction:column",
            "gap:10px"
        ].join(";");

        // Header bar, drag to move the panel, click to minimize or expand
        const header = document.createElement("div");
        headerEl = header;
        header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:move;user-select:none;-moz-user-select:none";
        header.title = "Drag to move, click to minimize or expand";

        const headerTitle = document.createElement("div");
        headerTitle.textContent = "Mureka Player";
        headerTitle.style.cssText = "font-weight:600";

        // Show the running version so an update is easy to confirm at a glance
        const versionEl = document.createElement("span");
        versionEl.textContent = "v" + VERSION;
        versionEl.style.cssText = "margin-left:6px;font-weight:400;color:#888;font-size:11px";
        headerTitle.appendChild(versionEl);

        // Sub line under the title, the logged in user name then the active
        // source separated by a dash, for example: EvTheFuture - All feed
        const headerSub = document.createElement("div");
        headerSub.style.cssText = "margin-top:1px;font-weight:400;font-size:11px";

        // Logged in user name, filled by the profile probe, hidden until known
        selfNameEl = document.createElement("span");
        selfNameEl.style.cssText = "display:none;color:#48e1eb";

        // Dash between the name and the source, shown only when both are present
        sourceSepEl = document.createElement("span");
        sourceSepEl.textContent = " - ";
        sourceSepEl.style.cssText = "display:none;color:#888";

        // Current source, your active feed (Published / All) or the creator name
        sourceEl = document.createElement("span");
        sourceEl.style.cssText = "display:none;color:#888";

        headerSub.appendChild(selfNameEl);
        headerSub.appendChild(sourceSepEl);
        headerSub.appendChild(sourceEl);
        headerTitle.appendChild(headerSub);

        minimizeBtn = document.createElement("span");
        minimizeBtn.title = "Minimize or expand";
        minimizeBtn.style.cssText = "flex:0 0 auto;color:#aaa;font-size:17px;cursor:pointer;line-height:1;padding:2px";

        // The arrow is an explicit control, so one click is enough here
        minimizeBtn.addEventListener("mousedown", function (ev) {
            ev.stopPropagation();
        });

        minimizeBtn.addEventListener("click", function (ev) {

            ev.stopPropagation();
            toggleMinimize();
        });

        // The bookmarklet panel is fullscreen, so a minimize arrow is not useful
        if (!isExtensionHost()) {
            minimizeBtn.style.display = "none";
        }

        // Hamburger that collapses or expands the top action menu to save space
        actionsToggleBtn = document.createElement("span");
        actionsToggleBtn.textContent = "\u2630";
        actionsToggleBtn.title = "Show or hide the action buttons";
        actionsToggleBtn.style.cssText = "flex:0 0 auto;color:#aaa;font-size:19px;cursor:pointer;line-height:1;padding:2px";

        // Keep the toggle from starting a drag or minimizing the panel
        actionsToggleBtn.addEventListener("mousedown", function (ev) {
            ev.stopPropagation();
        });

        actionsToggleBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            toggleActions();
        });

        // Gear that opens the settings overlay
        const settingsBtn = document.createElement("span");
        settingsBtn.textContent = "\u2699";
        settingsBtn.title = "Settings";
        settingsBtn.style.cssText = "flex:0 0 auto;color:#aaa;font-size:20px;cursor:pointer;line-height:1;padding:2px";

        // Keep the gear from starting a drag or toggling minimize
        settingsBtn.addEventListener("mousedown", function (ev) {
            ev.stopPropagation();
        });

        settingsBtn.addEventListener("click", function (ev) {
            ev.stopPropagation();
            openSettings();
        });

        // Right side of the header holds the action toggle, gear and minimize
        const headerRight = document.createElement("div");
        headerRight.style.cssText = "display:flex;align-items:center;gap:10px;flex:0 0 auto";
        headerRight.appendChild(actionsToggleBtn);
        headerRight.appendChild(settingsBtn);
        headerRight.appendChild(minimizeBtn);

        header.appendChild(headerTitle);
        header.appendChild(headerRight);
        header.addEventListener("mousedown", startDrag);

        // Everything below the header lives in the body, which can collapse
        bodyEl = document.createElement("div");
        bodyEl.id = "mureka-player-body";

        // Keep the list and coverflow z-indexes in their own stacking context,
        // so they cannot paint over the overlays that open on top of the panel
        bodyEl.style.isolation = "isolate";

        statusEl = document.createElement("div");
        statusEl.style.marginBottom = "8px";

        // Hidden warning banner, shown when a load looks like you are logged out
        // Tapping it opens mureka.ai so you can sign in
        authWarnEl = document.createElement("div");
        authWarnEl.style.cssText = [
            "display:none",
            "margin-bottom:8px",
            "padding:7px 9px",
            "border-radius:6px",
            "background:#5a1f22",
            "border:1px solid #b3464b",
            "color:#ffd9db",
            "font-size:12px",
            "line-height:1.35",
            "cursor:pointer"
        ].join(";");
        authWarnEl.title = "Open mureka.ai to sign in";
        authWarnEl.textContent = "You appear to be logged out of Mureka. Tap here"
            + " to open the sign in page. Songs still load, but your likes, plays"
            + " and private drafts are missing.";

        authWarnEl.addEventListener("click", function () {
            location.href = SITE_ORIGIN + "/";
        });

        // The menu is grouped by what the buttons actually do. Syncing the
        // library, choosing which library to look at, putting audio on the
        // device, and controlling how the panel is displayed
        const makeActionRow = function () {

            const row = document.createElement("div");

            row.style.cssText = "display:flex;gap:6px";

            return row;
        };

        // Keeping the library in step with the server
        const rowLibrary = makeActionRow();

        loadButton = makeActionButton(iconLoad(), "Load", "#48e1eb", "#000", run);

        rescanButton = makeActionButton(iconLoad(), "Rescan", "#444", "#fff", rescan);
        rescanButton.title = "Full refresh, page the whole library and update publish"
            + " dates and likes in place, no need to Clear first";

        const clearButton = makeActionButton(iconClear(), "Clear", "#444", "#fff", clearCache);

        rowLibrary.appendChild(loadButton);
        rowLibrary.appendChild(rescanButton);
        rowLibrary.appendChild(clearButton);

        // Choosing which collection of songs the list shows
        const rowSource = makeActionRow();

        feedButton = makeActionButton(iconFeed(), feed().label, "#444", "#fff", switchFeed);
        feedButton.title = "Switch between published and all songs";

        playlistButton = makeActionButton(iconPlaylists(), "Playlists", "#444", "#fff", openPlaylists);
        creatorButton = makeActionButton(iconCreators(), "Creators", "#444", "#fff", openCreators);
        creatorButton.title = "Browse another creator published songs";

        rowSource.appendChild(feedButton);
        rowSource.appendChild(playlistButton);
        rowSource.appendChild(creatorButton);

        // Putting the audio on the device, for offline listening or for keeps
        const rowStorage = makeActionRow();

        cacheButton = makeActionButton(iconCache(), "Cache all", "#444", "#fff", cacheAll);
        downloadButton = makeActionButton(iconDownload(), "Download list", "#444", "#fff", downloadAll);
        downloadButton.title = "Download the songs shown under the current filter";

        rowStorage.appendChild(cacheButton);
        rowStorage.appendChild(downloadButton);

        // How the panel itself is shown, all three change the display and
        // nothing else, which is why they sit together
        const rowDisplay = makeActionRow();

        // The gate only appears before fullscreen is entered, so this is the
        // way back in after leaving it, and the way in without the gate at all
        fullscreenButton = makeActionButton(iconFullscreen(), "Fullscreen", "#444", "#fff", function () {

            closeActions();

            if (!fullscreenSupported()) {

                showFullscreenHelp();
                return;
            }

            if (isFullscreen()) {

                leftFullscreenOnPurpose = true;
                exitFullscreen();
                return;
            }

            enterFullscreen();
        });

        const blackoutButton = makeActionButton(iconBlackout(), "Screen off", "#444", "#fff", function () {

            closeActions();
            requestWakeLock();
            showBlackout();
        });

        // Folding away matters most on a phone, where the panel fills the
        // screen. Without it a user who is not signed in cannot reach the
        // Mureka login form underneath. The header stays, so tapping it brings
        // the player back
        foldButton = makeActionButton(iconFold(), "Hide player", "#444", "#fff", function () {

            closeActions();
            toggleMinimize();

            if (minimized) {
                setStatus("Tap the header or use the menu to open it again");
            }
        });

        if (fullscreenOffered()) {
            rowDisplay.appendChild(fullscreenButton);
        }
        rowDisplay.appendChild(blackoutButton);
        rowDisplay.appendChild(foldButton);

        // Floating dropdown for the action buttons, opens over the player
        // It lives on the body and is fixed positioned, so toggling it does not
        // move the player content around
        actionsWrapEl = document.createElement("div");
        actionsWrapEl.style.cssText = POPUP_CSS;
        actionsWrapEl.appendChild(rowLibrary);
        actionsWrapEl.appendChild(rowSource);
        actionsWrapEl.appendChild(rowStorage);
        actionsWrapEl.appendChild(rowDisplay);

        // Keep clicks inside the dropdown from closing it
        actionsWrapEl.addEventListener("mousedown", function (ev) {
            ev.stopPropagation();
        });

        actionsWrapEl.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });

        document.body.appendChild(actionsWrapEl);

        // Player block, album art on top, then title, seek bar and play control
        // Assigned to the shared reference so the keyboard handling can reach it
        playerEl = document.createElement("div");
        playerEl.style.marginBottom = "8px";

        // A box that holds the masked strip, plus optional side nav buttons that
        // must sit outside the mask so they are not faded at the edges
        const artBox = document.createElement("div");
        artBox.style.cssText = "position:relative;margin-bottom:8px";

        // The album art is a coverflow strip, the center cover with side covers
        // that peek in and fade and blur toward the edges
        artWrapEl = document.createElement("div");
        artWrapEl.id = "mureka-player-art-wrap";
        artWrapEl.style.cssText = "position:relative;width:100%;border-radius:8px;overflow:hidden;background:#1d1d22;touch-action:pan-y";

        // A short, wide window, the center cover is a square of this height
        artWrapEl.style.aspectRatio = String(1 / ART_CENTER_FRACTION);

        // Build the row of cover tiles, the middle one is the current song
        artTiles = [];

        for (let i = 0; i < ART_SIDE_TILES * 2 + 1; i += 1) {

            const tile = document.createElement("img");

            tile.style.cssText = "position:absolute;top:0;left:0;height:100%;aspect-ratio:1/1;object-fit:cover;will-change:transform,filter";
            artWrapEl.appendChild(tile);
            artTiles.push(tile);
        }

        // Keep a handle on the center tile
        playerArt = artTiles[ART_SIDE_TILES];
        playerArt.id = "mureka-player-art";

        // Swipe the covers left or right to move to the next or previous song
        artWrapEl.addEventListener("touchstart", onArtTouchStart, { passive: true });
        artWrapEl.addEventListener("touchmove", onArtTouchMove, { passive: false });
        artWrapEl.addEventListener("touchend", onArtTouchEnd);
        artWrapEl.addEventListener("touchcancel", onArtTouchEnd);

        // Desktop counterpart of the touch double tap. iOS synthesizes a
        // dblclick after a double tap as well, which would cycle the mode
        // twice, so a recent touch tap makes this one a no-op
        artWrapEl.addEventListener("dblclick", function (ev) {

            ev.preventDefault();

            if (Date.now() - lastArtTouchEndT < 700) {
                return;
            }

            cycleOverlayMode();
        });

        // Re-seat the strip when the viewport changes, for example on rotation
        window.addEventListener("resize", function () {

            if (!swipeActive) {
                positionArt(0);
            }
        });

        artBox.appendChild(artWrapEl);

        // On a mouse device the swipe gesture is unavailable, so add subtle
        // chevron buttons over the peeking side covers to move between tracks
        const desktopPointer = !!(window.matchMedia
            && window.matchMedia("(hover: hover) and (pointer: fine)").matches);

        if (desktopPointer) {

            const makeArtNav = function (side, glyph, title, handler) {

                const btn = document.createElement("button");

                btn.textContent = glyph;
                btn.title = title;
                btn.style.cssText = [
                    "position:absolute",
                    "top:0",
                    side + ":0",
                    "height:100%",
                    "width:22%",
                    "border:none",
                    "background:transparent",
                    "color:#fff",
                    "opacity:0.4",
                    "display:flex",
                    "align-items:center",
                    "justify-content:center",
                    "font-size:26px",
                    "line-height:1",
                    "cursor:pointer",
                    "z-index:3",
                    "text-shadow:0 1px 4px rgba(0,0,0,0.85)",
                    "transition:opacity 0.15s"
                ].join(";");

                btn.addEventListener("mouseenter", function () {
                    btn.style.opacity = "0.9";
                });

                btn.addEventListener("mouseleave", function () {
                    btn.style.opacity = "0.4";
                });

                btn.addEventListener("click", handler);

                return btn;
            };

            artBox.appendChild(makeArtNav("left", "\u2039", "Previous", playPrev));
            artBox.appendChild(makeArtNav("right", "\u203A", "Next", playNext));
        }

        // Now playing title, overlaid at the bottom of the art over a scrim
        playerTitle = document.createElement("div");
        playerTitle.textContent = "Nothing playing";
        playerTitle.style.cssText = "font-weight:700;font-size:18px;line-height:1.15;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.9),0 0 2px rgba(0,0,0,0.8)";

        // Small meta line under the title, genre, mood, bpm and model
        playerMetaEl = document.createElement("div");
        playerMetaEl.style.cssText = "color:#dcdce0;font-size:12px;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-shadow:0 1px 3px rgba(0,0,0,0.9)";

        // The text is moved without moving the box, see makeMarquee
        metaMarquee = makeMarquee(playerMetaEl);

        // Plays and likes for the current song, shown at the top of the art
        playerCountsEl = document.createElement("div");
        playerCountsEl.style.cssText = "color:#eaeaec;font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,0.9)";

        // A faint note shown in the art area when the current song has no cover
        artPlaceholderEl = document.createElement("div");
        artPlaceholderEl.textContent = "\u266A";
        artPlaceholderEl.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#2e2e36;font-size:64px;pointer-events:none";

        // Dark gradient behind the top status so its text stays readable
        const topScrim = document.createElement("div");
        topScrim.style.cssText = "position:absolute;left:0;right:0;top:0;height:40%;border-radius:8px 8px 0 0;background:linear-gradient(to bottom,rgba(29,29,34,0.85),transparent);pointer-events:none;z-index:4";

        // Dark gradient behind the bottom title block for the same reason
        const bottomScrim = document.createElement("div");
        bottomScrim.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:88%;border-radius:0 0 8px 8px;background:linear-gradient(to top,rgba(29,29,34,0.95) 0%,rgba(29,29,34,0.75) 40%,rgba(29,29,34,0.35) 70%,rgba(29,29,34,0) 100%);pointer-events:none;z-index:4;transition:height 0.25s ease,opacity 0.25s ease";
        bottomScrimEl = bottomScrim;

        // Status sits at the top of the art, one clipped line, never blocks
        // swipe, with the plays and likes in the upper right corner beside it
        const topWrap = document.createElement("div");
        topWrap.style.cssText = "position:absolute;left:10px;right:10px;top:7px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;pointer-events:none;z-index:4";
        statusEl.style.cssText = "flex:1;min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;color:#eaeaec;text-shadow:0 1px 3px rgba(0,0,0,0.9);transition:opacity 0.25s ease";

        // A rescan summary is longer than the panel is wide, and an ellipsis
        // cut off the very numbers worth reading, so the line walks across
        // like the meta line under the title does
        statusMarquee = makeMarquee(statusEl);
        statusMarquee.setText(statusText);
        playerCountsEl.style.cssText = "flex:0 0 auto;color:#eaeaec;font-size:12px;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,0.9);transition:opacity 0.25s ease";
        topWrap.appendChild(statusEl);
        topWrap.appendChild(playerCountsEl);

        // Title, meta and counts sit at the bottom of the art over the scrim
        const bottomWrap = document.createElement("div");
        bottomWrap.style.cssText = "position:absolute;left:10px;right:10px;bottom:8px;pointer-events:none;z-index:4;transition:opacity 0.25s ease";
        bottomWrapEl = bottomWrap;

        // Five stacked lyric rows in a positioned box, rolled by updateLyricLine.
        // Geometry and box height come from applyLyricLayout, driven by the
        // configurable font size, so the extra gap here is the air above the title
        lyricBox = document.createElement("div");
        lyricBox.style.cssText = "position:relative;overflow:visible;margin-bottom:20px";

        lyricSlots = [];

        for (let i = 0; i < 5; i += 1) {

            const el = document.createElement("div");

            el.style.cssText = "position:absolute;left:0;right:0;opacity:0;"
                + "text-shadow:0 1px 3px rgba(0,0,0,0.8);transform-origin:left center;"
                + "white-space:nowrap;overflow:hidden;text-overflow:ellipsis";

            lyricSlots.push(el);
            lyricBox.appendChild(el);
        }

        applyLyricLayout();

        bottomWrap.appendChild(lyricBox);
        bottomWrap.appendChild(playerTitle);
        bottomWrap.appendChild(playerMetaEl);

        // Stars for the playing song, tappable straight on the cover. The
        // overlay around them ignores the pointer, these take it back. The
        // negative margin lines the first star up with the text, the padding
        // around each star is only there to make it easier to hit
        nowStarsBar = makeStarBar(function () {
            return currentSong;
        }, { size: 20, pad: 5, caption: false });

        nowStarsBar.el.style.alignItems = "flex-start";
        nowStarsBar.el.style.margin = "0 0 -5px -5px";
        nowStarsBar.el.style.pointerEvents = "auto";
        nowStarsBar.el.style.width = "max-content";
        nowStarsBar.el.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.9))";

        bottomWrap.appendChild(nowStarsBar.el);
        refreshNowStars();

        // Layer the overlays over the coverflow, the tiles stay swipeable below
        artBox.appendChild(artPlaceholderEl);
        artBox.appendChild(topScrim);
        artBox.appendChild(bottomScrim);
        artBox.appendChild(topWrap);
        artBox.appendChild(bottomWrap);

        // Transparent tap area over the art, shown only in debug mode, cycles
        // the artwork test on each tap
        testBtn = document.createElement("button");
        testBtn.title = "Debug, send a test cover over Bluetooth";
        testBtn.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;z-index:5;border:none;background:transparent;cursor:pointer;display:none";
        testBtn.addEventListener("click", sendTestArt);
        artBox.appendChild(testBtn);
        updateTestButton();

        const seekRow = document.createElement("div");
        seekRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;height:28px";

        curTimeEl = document.createElement("span");
        curTimeEl.textContent = "0:00";
        curTimeEl.style.cssText = "font-variant-numeric:tabular-nums;min-width:34px";

        seekBar = document.createElement("input");
        seekBar.type = "range";
        seekBar.id = "mureka-seek-bar";
        seekBar.min = "0";
        seekBar.max = "0";
        seekBar.value = "0";
        seekBar.step = "0.1";
        seekBar.style.cssText = "flex:1;accent-color:#48e1eb;cursor:pointer";

        remTimeEl = document.createElement("span");
        remTimeEl.textContent = "-0:00";
        remTimeEl.style.cssText = "font-variant-numeric:tabular-nums;min-width:40px;text-align:right";

        // While dragging, preview the time without letting timeupdate override it
        seekBar.addEventListener("input", function () {

            isSeeking = true;

            const value = parseFloat(seekBar.value) || 0;
            const duration = (audio && isFinite(audio.duration)) ? audio.duration : 0;

            curTimeEl.textContent = formatTime(value);
            remTimeEl.textContent = "-" + formatTime(duration > 0 ? duration - value : 0);
        });

        // On release, jump the audio to the chosen position
        seekBar.addEventListener("change", function () {

            if (audio && isFinite(audio.duration)) {
                audio.currentTime = parseFloat(seekBar.value) || 0;
            }

            isSeeking = false;
            updateSeekDisplay();
        });

        // Waveform seek canvas, shown instead of the slider when wave data is
        // available and the setting is on. touch-action none keeps a seek drag
        // from scrolling the page
        waveCanvas = document.createElement("canvas");
        waveCanvas.style.cssText = "flex:1;height:28px;min-width:0;display:none;cursor:pointer;touch-action:none";

        // Fraction of the canvas width for a pointer event, clamped to 0..1
        const waveFrac = function (ev) {

            const rect = waveCanvas.getBoundingClientRect();

            if (rect.width <= 0) {
                return 0;
            }

            return Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        };

        // Preview the labels and progress while pressing or dragging
        const wavePreview = function (frac) {

            const duration = (audio && isFinite(audio.duration)) ? audio.duration : 0;
            const t = frac * duration;

            curTimeEl.textContent = formatTime(t);
            remTimeEl.textContent = "-" + formatTime(duration > 0 ? duration - t : 0);
            drawWave(frac);
        };

        waveCanvas.addEventListener("pointerdown", function (ev) {

            if (!audio || !isFinite(audio.duration)) {
                return;
            }

            ev.preventDefault();
            isSeeking = true;

            try {
                waveCanvas.setPointerCapture(ev.pointerId);
            } catch (e) {
            }

            wavePreview(waveFrac(ev));
        });

        waveCanvas.addEventListener("pointermove", function (ev) {

            if (isSeeking && audio && isFinite(audio.duration)) {
                wavePreview(waveFrac(ev));
            }
        });

        waveCanvas.addEventListener("pointerup", function (ev) {

            if (!isSeeking) {
                return;
            }

            if (audio && isFinite(audio.duration)) {
                audio.currentTime = waveFrac(ev) * audio.duration;
            }

            isSeeking = false;
            updateSeekDisplay();
        });

        waveCanvas.addEventListener("pointercancel", function () {

            isSeeking = false;
            updateSeekDisplay();
        });

        seekRow.appendChild(curTimeEl);
        seekRow.appendChild(seekBar);
        seekRow.appendChild(waveCanvas);
        seekRow.appendChild(remTimeEl);

        // Transport row, icon buttons for previous, play/pause, stop, next, shuffle, repeat
        const controlRow = document.createElement("div");
        controlRow.style.cssText = "display:flex;gap:8px";
        controlRowEl = controlRow;

        // All six are built, the controlOrder setting decides which of them go
        // into the row and in which order. Previous and next are off by
        // default because the album art swipe already does that job, and fewer
        // buttons means a much larger target for each, which matters in a car
        playPauseBtn = makeIconButton(iconPlay(), "Play / Pause", togglePlayPause);
        shuffleBtn = makeIconButton(makeShuffleIcon(), "Shuffle (toggle)", toggleShuffle);
        repeatBtn = makeIconButton(makeRepeatIcon(false), "Repeat", cycleRepeat);

        // Flips between published only and every song. Greyed out while a
        // creator is being browsed, since another creator only ever exposes
        // published songs, so the toggle would have nothing to switch
        publishedCtrlBtn = makeIconButton("\u2713", "Published / All", function () {

            if (creatorSource) {
                return;
            }

            switchFeed();
        });

        // Cycles the same vocals filter the view menu offers, so the two stay
        // in step whichever one is used
        vocalsCtrlBtn = makeIconButton(iconAll(), "Vocals / Instrumental / All", function () {

            const order = ["all", "vocal", "instrumental"];
            const at = order.indexOf(settings.vocalFilter);

            setVocalFilter(order[(at + 1) % order.length]);
        });

        // Opens the large star popup for the playing song, a bigger target
        // than the stars on the cover, which matters in a car
        rateIconSvg = makeStarSvg(22);
        rateCtrlBtn = makeIconButton(rateIconSvg, "Rate the playing song", function (ev) {

            // The tap that opens the popup must not also close it again
            if (ev) {
                ev.stopPropagation();
            }

            if (!currentSong) {

                setStatus("Nothing playing to rate");
                return;
            }

            showRatingPopup(rateCtrlBtn, currentSong);
        });

        controlButtons = {
            prev: makeIconButton(iconPrev(), "Previous", playPrev),
            play: playPauseBtn,
            stop: makeIconButton(iconStopTransport(), "Stop", stopPlay),
            next: makeIconButton(iconNext(), "Next", playNext),
            shuffle: shuffleBtn,
            repeat: repeatBtn,
            published: publishedCtrlBtn,
            vocals: vocalsCtrlBtn,
            rate: rateCtrlBtn
        };

        updateFeedButton();

        applyControlOrder();
        enableControlRowDragging();
        updateVocalsCtrlButton();
        updateRateButton();

        playerEl.appendChild(artBox);
        playerEl.appendChild(seekRow);
        playerEl.appendChild(controlRow);

        const searchInput = document.createElement("input");
        searchInput.type = "search";
        searchInput.id = "mureka-search-input";
        searchInput.placeholder = "Search songs";
        searchInput.style.cssText = [
            "width:100%",
            "box-sizing:border-box",
            "margin-top:4px",
            "padding:6px 8px",
            "border:1px solid #3a3a42",
            "border-radius:6px",
            "background:#26262c",
            "color:#fff",
            "font:" + INPUT_FONT
        ].join(";");

        // Inline styles cannot target the placeholder, so inject a rule for it
        // important is needed to beat the site own placeholder styling
        const placeholderStyle = document.createElement("style");
        placeholderStyle.textContent =

            // Everything around a fullscreen element is painted by the browser
            // with the backdrop pseudo element, which defaults to black. That
            // is the bar above and below in fullscreen, and styling it is the
            // only thing that reaches it. The fullscreen element itself gets
            // the same colour, for the same reason
            "::backdrop{background:" + PANEL_BACKGROUND + "}"
            + ":fullscreen{background:" + PANEL_BACKGROUND + "}"
            + ":-webkit-full-screen{background:" + PANEL_BACKGROUND + "}"
            + "#mureka-search-input::placeholder{color:#aaa !important;opacity:1 !important}"
            + "#mureka-search-input::-moz-placeholder{color:#aaa !important;opacity:1 !important}"
            + "#mureka-seek-bar{-webkit-appearance:none;appearance:none;background:transparent;height:28px;margin:0}"
            + "#mureka-seek-bar::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:#555}"
            + "#mureka-seek-bar::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:#48e1eb;margin-top:-5px}"
            + "#mureka-seek-bar::-moz-range-track{height:6px;border-radius:3px;background:#555}"
            + "#mureka-seek-bar::-moz-range-progress{height:6px;border-radius:3px;background:#48e1eb}"
            + "#mureka-seek-bar::-moz-range-thumb{width:16px;height:16px;border:none;border-radius:50%;background:#48e1eb}"
            // Room for the strip the system owns at the top of an iPhone in
            // fullscreen. A class rather than an inline property, because
            // clearing an inline longhand also breaks apart the padding
            // shorthand the panel is built with and drops its top padding
            // everywhere else
            + "#mureka-player-panel.mureka-top-inset{padding-top:calc(env(safe-area-inset-top, 0px) + 12px) !important}"

            // See updateFullscreenScrollLock for why the list refuses the
            // browser own gestures while fullscreen is on
            + "#mureka-player-list.mureka-hand-scroll{touch-action:none !important;-webkit-overflow-scrolling:auto !important}"
            + ".mureka-resize-handle{background:transparent;transition:background 0.12s ease}"
            + ".mureka-resize-handle:hover{background:rgba(72,225,235,0.45)}"
            + "@keyframes mureka-pulse{0%,100%{opacity:1}50%{opacity:0.15}}"
            + "@keyframes mureka-spin{to{transform:rotate(360deg)}}"
            // On a phone, fill the screen, shrink the art a touch and let the
            // list grow into the remaining height instead of a fixed box
            + "@media (max-width:640px){"
            // overscroll-behavior keeps a drag that runs past the end of the
            // list from handing the rest of the movement to the page, which is
            // what starts the bounce that drags the panel off its own edges
            + "#mureka-player-panel{top:0 !important;left:0 !important;right:0 !important;width:100vw !important;height:100vh !important;height:100dvh !important;max-width:none !important;border-radius:0 !important;padding:" + PANEL_PAD_MOBILE + " !important;box-sizing:border-box !important;font-size:12px !important;gap:7px !important;overflow:hidden !important;overscroll-behavior:none !important}"
            + "#mureka-player-art-wrap{max-width:none !important}"
            + ".mureka-resize-handle{display:none !important}"
            + "#mureka-player-body{display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important}"
            + "#mureka-player-list-wrap{flex:1 1 auto !important;min-height:0 !important;display:flex !important;flex-direction:column !important}"
            + "#mureka-player-list{flex:1 1 auto !important;height:auto !important;min-height:120px !important;overscroll-behavior:contain !important}"
            + "#mureka-player-list > div{font-size:15px !important;padding:9px 2px !important}"
            + "}";
        document.head.appendChild(placeholderStyle);

        // Filter the list as the user types
        searchInput.addEventListener("input", function () {
            searchQuery = searchInput.value.trim().toLowerCase();
            renderList();
        });

        // Keep typing from triggering any of the site own keyboard shortcuts
        searchInput.addEventListener("keydown", function (ev) {
            ev.stopPropagation();
        });

        // On a phone the keyboard covers the lower half of the panel, so while
        // it is up the tall player block steps aside and lifts the field and
        // the list into what is left. Whether the keyboard is up is read from
        // the viewport rather than from focus, because dismissing it with its
        // own button leaves the field focused and fires no blur, which used to
        // leave the art gone until the browser was hidden and reopened
        //
        // The comparison is against the tallest viewport seen in this
        // orientation and is a share of it, never a pixel count, so it holds on
        // any screen. A keyboard takes a large part of the screen, the browser
        // toolbar sliding away takes a small one, and only the former counts
        const KEYBOARD_SHARE = 0.8;

        let tallestViewport = 0;
        let lastLayoutWidth = window.innerWidth;
        let keyboardWasUp = false;

        function viewportHeight() {

            return window.visualViewport
                ? window.visualViewport.height
                : window.innerHeight;
        }

        function updateKeyboardLayout() {

            // Rotating gives a different tallest height, so start that over
            if (window.innerWidth !== lastLayoutWidth) {

                lastLayoutWidth = window.innerWidth;
                tallestViewport = 0;
            }

            const height = viewportHeight();

            if (height > tallestViewport) {
                tallestViewport = height;
            }

            // Only phones are tight enough for this to be worth doing
            if (window.innerWidth > 640) {

                keyboardUp = false;
                showPlayerBlock();
                return;
            }

            keyboardUp = height < tallestViewport * KEYBOARD_SHARE
                && document.activeElement === searchInput;

            // Mirrored for the debug line, which lives outside this builder
            debugTallest = tallestViewport;
            debugSearchFocused = document.activeElement === searchInput;

            if (keyboardUp) {
                hidePlayerBlock();
            } else {
                showPlayerBlock();
            }

            // The height the viewport reports while the keyboard is on its way
            // out is not the height it settles at, and the panel is sized from
            // that number. Measure once more on the next frame, but only on the
            // change itself, so this cannot turn into a running second pass
            if (keyboardUp !== keyboardWasUp) {

                keyboardWasUp = keyboardUp;

                // Named so the debug line can tell these passes apart
                const tag = keyboardUp ? "kbUp" : "kbDown";

                fitMobile(tag);

                requestAnimationFrame(function () {
                    fitMobile(tag + "+raf");
                });
            }
        }

        searchInput.addEventListener("focus", updateKeyboardLayout);
        searchInput.addEventListener("blur", updateKeyboardLayout);

        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", updateKeyboardLayout);
        } else {
            window.addEventListener("resize", updateKeyboardLayout);
        }

        // Coming back from another app is the other moment it has to be right
        document.addEventListener("visibilitychange", function () {

            if (!document.hidden) {
                updateKeyboardLayout();
            }
        });

        // Search box on its own row
        const searchRow = document.createElement("div");
        searchRow.style.cssText = "margin-top:4px";
        searchRow.appendChild(searchInput);

        // View selector, three segments sharing one row
        const viewRow = document.createElement("div");
        viewRow.style.cssText = "display:flex;gap:6px";

        viewButtons.mureka = makeActionButton(iconMureka(), "Mureka", "#333", "#fff", function () {
            setView("mureka");
        });
        viewButtons.mureka.title = "Published order";

        viewButtons.queue = makeActionButton(iconQueue(), "Queue", "#333", "#fff", function () {
            setView("queue");
        });
        viewButtons.queue.title = "Current song and what plays next";

        viewButtons.alpha = makeActionButton(iconAlpha(), "A-Z", "#333", "#fff", function () {
            setView("alpha");
        });
        viewButtons.alpha.title = "Alphabetical by title";

        viewRow.appendChild(viewButtons.mureka);
        viewRow.appendChild(viewButtons.queue);
        viewRow.appendChild(viewButtons.alpha);

        // Vocals filter row
        const filterRow = document.createElement("div");
        filterRow.style.cssText = "display:flex;gap:6px";

        filterButtons.all = makeActionButton(iconAll(), "All", "#333", "#fff", function () {
            setVocalFilter("all");
        });
        filterButtons.all.title = "Show every song";

        filterButtons.vocal = makeActionButton(iconVocals(), "Vocals", "#333", "#fff", function () {
            setVocalFilter("vocal");
        });
        filterButtons.vocal.title = "Hide instrumental songs";

        filterButtons.instrumental = makeActionButton(iconInstrumental(), "Instrumental", "#333", "#fff", function () {
            setVocalFilter("instrumental");
        });
        filterButtons.instrumental.title = "Show only instrumental songs";

        filterRow.appendChild(filterButtons.all);
        filterRow.appendChild(filterButtons.vocal);
        filterRow.appendChild(filterButtons.instrumental);

        // Floating dropdown that holds the view and filter rows, opens over the
        // list without moving the content, just like the action dropdown
        // Opens the smart filter sheet, tags and tempo
        const smartRow = document.createElement("div");
        smartRow.style.cssText = "display:flex;gap:6px";

        smartFilterBtn = makeActionButton(iconFilter(), "Edit filters", "#333", "#fff", openTagSheet);
        smartFilterBtn.title = "Filter by genre, mood and tempo";

        // One tap to park or restore the whole filter, without opening the
        // sheet and without losing what is ticked
        smartToggleBtn = makeActionButton(iconFilter(), "Filters off", "#333", "#fff", function () {

            settings.smartEnabled = !settings.smartEnabled;
            applySmartFilters();
        });

        smartRow.appendChild(smartFilterBtn);
        smartRow.appendChild(smartToggleBtn);

        viewMenuEl = document.createElement("div");
        viewMenuEl.style.cssText = POPUP_CSS;
        viewMenuEl.appendChild(viewRow);
        viewMenuEl.appendChild(filterRow);
        viewMenuEl.appendChild(smartRow);

        viewMenuEl.addEventListener("mousedown", function (ev) {
            ev.stopPropagation();
        });

        viewMenuEl.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });

        document.body.appendChild(viewMenuEl);

        // Compact bar that stays visible, shows the current view and filter and
        // toggles the dropdown above
        viewMenuBar = makeButton("", "#333", "#fff", toggleViewMenu);
        viewMenuBar.style.flex = "none";
        viewMenuBar.style.width = "100%";
        viewMenuBar.style.marginTop = "6px";

        // The funnel sits beside the text rather than in it, so the bar lays
        // its contents out in a row
        viewMenuBar.style.display = "flex";
        viewMenuBar.style.alignItems = "center";
        viewMenuBar.style.justifyContent = "center";
        viewMenuBar.style.gap = "6px";
        viewMenuBar.style.textAlign = "center";
        viewMenuBar.title = "Choose the list view and filter";

        // The toggle runs on click, this only keeps it from also closing itself
        viewMenuBar.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });

        // Counts line, shown songs against the total plus the queue length
        countsEl = document.createElement("div");
        countsEl.style.cssText = "margin-top:6px;color:#888;font-size:12px";

        // The list lives inside a relative wrapper so the pull to refresh
        // indicator can sit behind it and the scroll to top button can float
        // over it. The cosmetic top border and spacing move to the wrapper
        listWrapEl = document.createElement("div");
        listWrapEl.id = "mureka-player-list-wrap";
        listWrapEl.style.cssText = "position:relative;overflow:hidden;border-top:1px solid #333;margin-top:6px";

        // The reload indicator revealed when the list is pulled down past the top
        pullEl = document.createElement("div");
        pullEl.style.cssText = "position:absolute;top:0;left:0;right:0;height:56px;display:flex;align-items:center;justify-content:center;color:#48e1eb;opacity:0;pointer-events:none";

        const pullIcon = iconLoad();
        pullIcon.style.width = "22px";
        pullIcon.style.height = "22px";
        pullIcon.style.transformOrigin = "center";
        pullEl.appendChild(pullIcon);

        listEl = document.createElement("div");
        listEl.id = "mureka-player-list";

        // An opaque background hides the pull indicator until the list is pulled
        listEl.style.cssText = "position:relative;z-index:1;height:240px;box-sizing:border-box;overflow:auto;padding-top:6px;background:#1d1d22";

        // A round button that jumps to an end of the list, direction aware, it
        // points down to the end while scrolling down and up to the top while
        // scrolling up. It fades in on scroll and out again after a short idle
        toTopBtn = document.createElement("button");
        toTopBtn.type = "button";
        toTopBtn.setAttribute("aria-label", "Scroll to top");
        toTopBtn.title = "Scroll to top";
        toTopBtn.style.cssText = "position:absolute;right:10px;bottom:10px;z-index:3;width:36px;height:36px;border-radius:50%;border:none;background:rgba(72,225,235,0.92);color:#0c0c0f;font-size:20px;line-height:36px;text-align:center;cursor:pointer;opacity:0;pointer-events:none;transition:opacity 0.25s ease;box-shadow:0 2px 6px rgba(0,0,0,0.4)";
        toTopBtn.textContent = "\u2191";
        toTopBtn.addEventListener("click", scrollListEdge);

        listWrapEl.appendChild(pullEl);
        listWrapEl.appendChild(listEl);
        listWrapEl.appendChild(toTopBtn);

        // React to scrolling, show a direction aware jump button that idles away
        listEl.addEventListener("scroll", function () {

            const top = listEl.scrollTop;
            const delta = top - lastListScroll;
            lastListScroll = top;

            // Build more rows once the scroll gets near what has been built
            if (top + listEl.clientHeight > listEl.scrollHeight - 800) {
                renderMoreRows(RENDER_CHUNK);
            }

            // Ignore programmatic scrolls, view switches and song changes
            if (Date.now() - programmaticScrollAt < 400 || Date.now() < edgeJumpUntil) {
                return;
            }

            // Ignore jitter and lists too short to be worth jumping around
            if (Math.abs(delta) < 3 || listEl.scrollHeight - listEl.clientHeight < 40) {
                return;
            }

            // Nothing to jump to once the list is already at the edge the arrow
            // would point at, so the button goes rather than lingers
            const atTop = top <= 4;
            const atBottom = top + listEl.clientHeight >= listEl.scrollHeight - 4
                && lazyRendered >= lazyRows.length;

            if ((delta > 0 && atBottom) || (delta < 0 && atTop)) {

                fadeToTopBtn();
                return;
            }

            setToTopArrow(delta > 0 ? "down" : "up");
            showToTopBtn();
        });

        // Pull to refresh, touch only so the desktop is unaffected
        listEl.addEventListener("touchstart", onListTouchStart, { passive: true });
        listEl.addEventListener("touchmove", onListTouchMove, { passive: false });
        listEl.addEventListener("touchend", onListTouchEnd);
        listEl.addEventListener("touchcancel", onListTouchEnd);

        bodyEl.appendChild(authWarnEl);
        bodyEl.appendChild(playerEl);
        bodyEl.appendChild(searchRow);
        bodyEl.appendChild(viewMenuBar);
        bodyEl.appendChild(countsEl);
        bodyEl.appendChild(listWrapEl);

        // The debug readout sits between the header and the body, outside the
        // player block, so it stays in view while the keyboard hides that
        // block. Tapping it copies everything it holds
        debugLineEl = document.createElement("div");
        debugLineEl.style.cssText = [
            "display:none",
            "flex:0 0 auto",
            "margin:2px 0 4px",
            "padding:4px 6px",
            "border-radius:6px",
            "background:#101014",
            "border:1px solid #2e2e36",
            "color:#9fe8ee",
            "font:10px/1.35 ui-monospace,Menlo,monospace",
            "white-space:pre-wrap",
            "word-break:break-all",
            "cursor:copy"
        ].join(";");
        debugLineEl.title = "Tap to copy the debug line";
        debugLineEl.addEventListener("click", function (ev) {

            ev.stopPropagation();
            copyDebugLine();
        });

        panel.appendChild(header);
        panel.appendChild(debugLineEl);
        panel.appendChild(bodyEl);
        buildResizeHandles(panel);

        // A sheet in the panel colour directly behind the panel, for phones
        // On iOS the whole page rubber bands when a drag runs past its end,
        // and fixed elements travel with it, so for a moment the panel slides
        // and whatever the site paints shows through at the edge it leaves.
        // Reaching a full viewport past both edges means the bounce can never
        // run far enough to expose anything, whatever the screen size
        backdropEl = document.createElement("div");
        backdropEl.id = "mureka-player-backdrop";
        backdropEl.style.cssText = [
            "position:fixed",
            "left:0",
            "right:0",
            "top:-100%",
            "bottom:-100%",
            "z-index:999998",
            "background:" + PANEL_BACKGROUND,
            "display:none"
        ].join(";");

        document.body.appendChild(backdropEl);
        document.body.appendChild(panel);

        restoreSize();

        renderList();
        setStatus("Cached songs: " + cache.songs.length);

        buildContextMenu();
        buildSettings();
        buildInfo();
        buildPlaylists();
        buildCreators();
        requestPersistentStorage();
        refreshCachedIds();
        updateShuffleButton();
        updateViewButtons();
        updateFilterButtons();
        updateSmartFilterButton();
        updateViewMenuBar();

        // A click outside a dropdown closes it, the dropdowns stop their own
        // clicks from bubbling so this does not fire for clicks inside them
        document.addEventListener("click", closeDropdowns);

        // Scrolling or resizing would leave a dropdown floating in the wrong
        // spot, so close it instead of trying to follow
        window.addEventListener("scroll", closeDropdowns, true);
        window.addEventListener("resize", closeDropdowns);

        // Shuffle and repeat start from the remembered state of the last session
        updateRepeatButton();

        // Place the panel where it was left, or default to the bottom right
        restorePosition();

        // Start the countdown now, so the cover can appear without anything
        // having been played yet
        resetIdleTimer();

        // Stand the gate in front of the player until fullscreen is entered
        offerGate();

        // Entering or leaving fullscreen changes the visible viewport, since
        // the address and status bars come and go. The panel is sized from
        // those dimensions, so it has to be measured again, and not only once,
        // because the new size is not final on the first frame
        const onFullscreenChange = function (ev) {

            // Recorded first, so the fitMobile calls below see the state as
            // handled and do not come back in here
            appliedFullscreen = isFullscreen();

            // Named for the debug line, whether the browser sent the change
            // or the resync caught one it missed, and which way it went
            const tag = (ev ? "fsEv" : "fsSync") + (appliedFullscreen ? "On" : "Off");

            // Back in fullscreen, so a later incidental exit offers the gate again
            if (isFullscreen()) {
                leftFullscreenOnPurpose = false;
            }

            // A glide belongs to the mode it started in
            stopGlide();

            updateFullscreenScrollLock();

            refreshGate();
            updateFullscreenButton();
            fitMobile(tag);

            requestAnimationFrame(function () {

                fitMobile(tag + "+raf");

                if (!swipeActive) {
                    positionArt(0);
                }
            });

            // A late pass, for the browser chrome animating out of the way
            setTimeout(function () {

                fitMobile(tag + "+400");

                if (!swipeActive) {
                    positionArt(0);
                }
            }, 400);
        };

        document.addEventListener("fullscreenchange", onFullscreenChange);
        document.addEventListener("webkitfullscreenchange", onFullscreenChange);

        // Also reachable from the resize and foreground paths, which is what
        // catches a fullscreen exit Safari made without a usable event
        fullscreenRefresh = onFullscreenChange;
        appliedFullscreen = isFullscreen();

        // Restore whether the panel was left minimized last time
        let startMinimized = false;

        try {
            startMinimized = localStorage.getItem(MINIMIZED_KEY) === "1";
        } catch (e) {
        }

        setMinimized(startMinimized);

        // The add on injects into every mureka.ai page, including sign in. A
        // panel that opens over the login form leaves no way to log in, so
        // probe the API and collapse out of the way when it is not usable
        if (!startMinimized) {

            fetchPage(null).catch(function () {

                setMinimized(true);
                setStatus("Sign in to Mureka, then tap the header to open");
            });
        }

        // Bring the debug line up first when it is switched on, so the very
        // first sizing passes are in its history
        updateDebugLine();

        // Size the panel to the real visible area and keep it in sync as iOS
        // Safari shows or hides its toolbar
        fitMobile("init");

        window.addEventListener("resize", fitMobile);

        if (window.visualViewport) {

            // Fit as the viewport reports itself. A delayed second pass was
            // tried here and made things worse, it re-applied values that had
            // gone stale rather than correcting them
            window.visualViewport.addEventListener("resize", fitMobile);
            window.visualViewport.addEventListener("scroll", fitMobile);
        }

        // On Safari a freshly injected fixed panel can render at the unzoomed
        // size until a later zoom or resize event re-applies the page zoom
        // Reading a layout value forces that to happen, so re-fit once the
        // layout has settled, after the first frames and after full load
        const settleLayout = function () {

            if (!panelEl) {
                return;
            }

            // Touching a layout property forces the current zoom to apply
            void panelEl.offsetHeight;
            fitMobile();

            if (!swipeActive) {
                positionArt(0);
            }
        };

        requestAnimationFrame(function () {
            requestAnimationFrame(settleLayout);
        });

        window.addEventListener("load", settleLayout);

        // Persist the queue position when the tab is hidden or about to unload
        window.addEventListener("pagehide", saveQueue);

        document.addEventListener("visibilitychange", function () {

            if (document.hidden) {

                // A stall check armed a moment ago must not fire once hidden
                if (resyncTimer) {

                    clearTimeout(resyncTimer);
                    resyncTimer = null;
                }

                saveQueue();
                return;
            }

            // Back in the foreground, so make sure playback really is running
            resyncPlayback();
            resetIdleTimer();

            // Safari may have dropped fullscreen while the page was away, and
            // anything measured while hidden is not to be trusted either way.
            // Run the whole fullscreen pass again now the page can be seen,
            // which is what entering and leaving fullscreen by hand did
            if (fullscreenRefresh) {
                fullscreenRefresh();
            }

            // Returning from another app is one of the two moments the gate
            // is offered, fullscreen having been lost in between
            offerGate();

            // The system drops the wake lock whenever the page is hidden, so
            // claim it again if the cover is still meant to be holding it
            if (isBlackedOut()) {
                requestWakeLock();
            }
        });

        window.addEventListener("focus", resyncPlayback);

        // Any touch or key postpones the blackout, so it only arrives after a
        // real stretch of not being used
        document.addEventListener("pointerdown", function () {

            if (!isBlackedOut()) {
                resetIdleTimer();
            }
        }, true);

        document.addEventListener("keydown", function () {

            if (!isBlackedOut()) {
                resetIdleTimer();
            }
        }, true);

        // Returning from the back forward cache can leave a dead element
        window.addEventListener("pageshow", function () {

            resyncPlayback();
            syncFullscreenState();
        });

        // Reopen on the remembered source from cache, never a full reload here
        applyStartupSource();

        // Show the feed / source indicator on startup, not only after a press
        updateFeedButton();

        // Check login state on launch so a logout shows without pressing Load
        if (!creatorSource) {
            refreshAuthBanner();
        }

        // Refresh on launch only when asked, and only for your own feed
        if (!creatorSource) {
            maybeAutoRefresh();
        }

        // Bring back the queue from last time, ready to resume
        restoreQueue();

        // Start playing on launch when the user asked for it
        maybeAutoPlay();
    }

    // Keep a position inside the visible viewport, with a small margin
    function clampPosition(left, top) {

        // A panel that has not been laid out yet measures zero, which would
        // allow a position right at the far edge, leaving nothing on screen
        const w = panelEl.offsetWidth || 300;
        const h = panelEl.offsetHeight || 300;

        // No margin, so the panel can be docked flush against any edge
        const maxLeft = Math.max(0, window.innerWidth - w);
        const maxTop = Math.max(0, window.innerHeight - h);

        return {
            left: Math.max(0, Math.min(left, maxLeft)),
            top: Math.max(0, Math.min(top, maxTop))
        };
    }

    // Position the panel and choose which edge to anchor in CSS, so the browser
    // keeps that edge fixed whenever the content grows or shrinks on its own.
    // Nearer the top anchors the top edge and grows downward, nearer the bottom
    // anchors the bottom edge and grows upward
    function applyPosition(left, top, keepSide) {

        const pos = clampPosition(left, top);
        const bottomEdge = pos.top + panelEl.offsetHeight;
        const distanceTop = pos.top;
        const distanceBottom = window.innerHeight - bottomEdge;

        panelEl.style.left = pos.left + "px";
        anchorLeft = pos.left;

        // Growing a panel tall makes its top edge the nearer one, which would
        // flip a bottom dock to the top and send minimize the wrong way, so a
        // resize keeps the side it already had instead of picking again
        const useTop = keepSide
            ? anchorSide === "top"
            : distanceTop < distanceBottom;

        if (useTop) {
            panelEl.style.top = pos.top + "px";
            panelEl.style.bottom = "auto";
            anchorSide = "top";
            anchorOffset = pos.top;
        } else {
            panelEl.style.top = "auto";
            panelEl.style.bottom = (window.innerHeight - bottomEdge) + "px";
            anchorSide = "bottom";
            anchorOffset = window.innerHeight - bottomEdge;
        }
    }

    // Save the current anchor, the side and edge offset rather than a raw top,
    // so the dock survives the panel changing height
    function savePosition() {

        try {
            localStorage.setItem(POS_KEY, JSON.stringify({
                left: anchorLeft,
                side: anchorSide,
                offset: anchorOffset
            }));
        } catch (e) {
        }
    }

    // Restore the saved anchor, or default to the bottom right
    // Clamp a requested panel width and list height to sane bounds
    function clampSize(w, listH) {

        // Only the viewport limits the size, so the panel can fill the window
        return {
            w: Math.max(280, Math.min(w, window.innerWidth)),
            listH: Math.max(120, Math.min(listH, Math.max(120, window.innerHeight)))
        };
    }

    // Apply a panel width and list height, then relayout the parts that
    // measure their container, the coverflow and the waveform canvas
    function applySize(w, listH) {

        const size = clampSize(w, listH);

        panelEl.style.width = size.w + "px";

        if (listEl) {
            listEl.style.height = size.listH + "px";
        }

        positionArt(0);
        drawWave();

        return size;
    }

    // Persist the panel size
    function saveSize(size) {

        try {
            localStorage.setItem(SIZE_KEY, JSON.stringify(size));
        } catch (e) {
        }
    }

    // Restore the saved panel size, leaving the defaults when none is stored
    function restoreSize() {

        let saved = null;

        try {
            saved = JSON.parse(localStorage.getItem(SIZE_KEY));
        } catch (e) {
        }

        if (saved && typeof saved.w === "number" && typeof saved.listH === "number") {
            applySize(saved.w, saved.listH);
        }
    }

    // Edge and corner resize handles. Each declares which axes it changes and
    // which pointer direction grows the panel, so dragging a side edge only
    // changes the width and dragging a top or bottom edge only changes the
    // list height. The phone layout is full screen, so the media rules hide them
    const RESIZE_HANDLES = [
        { x: 0, y: -1, css: "top:0;left:12px;right:12px;height:6px;cursor:ns-resize" },
        { x: 0, y: 1, css: "bottom:0;left:12px;right:12px;height:6px;cursor:ns-resize" },
        { x: -1, y: 0, css: "left:0;top:12px;bottom:12px;width:6px;cursor:ew-resize" },
        { x: 1, y: 0, css: "right:0;top:12px;bottom:12px;width:6px;cursor:ew-resize" },
        { x: -1, y: -1, css: "top:0;left:0;width:12px;height:12px;cursor:nwse-resize;z-index:6" },
        { x: 1, y: -1, css: "top:0;right:0;width:12px;height:12px;cursor:nesw-resize;z-index:6" },
        { x: -1, y: 1, css: "bottom:0;left:0;width:12px;height:12px;cursor:nesw-resize;z-index:6" },
        { x: 1, y: 1, css: "bottom:0;right:0;width:12px;height:12px;cursor:nwse-resize;z-index:6" }
    ];

    // Drag one handle. The edge under the pointer is the one that moves, the
    // opposite edge is pinned, so the panel never runs away from the cursor
    function startResize(ev, spec, el) {

        const rect = panelEl.getBoundingClientRect();
        const startX = ev.clientX;
        const startY = ev.clientY;
        const startW = panelEl.offsetWidth;
        const startList = listEl ? listEl.offsetHeight : 240;

        try {
            el.setPointerCapture(ev.pointerId);
        } catch (e) {
        }

        let size = { w: startW, listH: startList };

        // Which edges this panel is docked to. Vertically that is the anchor
        // the dock logic already keeps, horizontally it is the nearer side
        const pinBottom = anchorSide === "bottom";
        const pinRight = (window.innerWidth - rect.right) < rect.left;

        const onMove = function (e) {

            // Only the axes this handle owns change, the other keeps its value
            const w = spec.x === 0 ? startW : startW + spec.x * (e.clientX - startX);
            const listH = spec.y === 0 ? startList : startList + spec.y * (e.clientY - startY);

            size = applySize(w, listH);

            // Everything in the panel except the list, so the room left for the
            // list can be worked out from the room left on screen
            const chromeH = panelEl.offsetHeight - (listEl ? listEl.offsetHeight : 0);

            // The panel may fill the viewport, minus the margin the dock logic
            // keeps, so growth is only ever limited by the screen as a whole
            const maxW = window.innerWidth;
            const maxList = window.innerHeight - chromeH;

            if (size.w > maxW || size.listH > maxList) {
                size = applySize(Math.min(size.w, maxW), Math.min(size.listH, maxList));
            }

            // Hold the edges the panel is docked to, so it grows away from them
            // and shrinks back toward them instead of drifting off the dock
            const wantLeft = pinRight ? rect.right - panelEl.offsetWidth : rect.left;
            const wantTop = pinBottom ? rect.bottom - panelEl.offsetHeight : rect.top;
            const pos = clampPosition(wantLeft, wantTop);

            panelEl.style.bottom = "auto";
            panelEl.style.left = Math.round(pos.left) + "px";
            panelEl.style.top = Math.round(pos.top) + "px";
        };

        const onUp = function () {

            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
            document.removeEventListener("pointercancel", onUp);

            saveSize(size);

            // Re-anchor without flipping the dock, a resize is not a move
            const now = panelEl.getBoundingClientRect();

            applyPosition(now.left, now.top, true);
            savePosition();
        };

        // Bound to the document, so a pointerup outside the handle still ends
        // the drag instead of leaving a stale listener behind
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
    }

    // Build one resize handle from its spec
    function makeResizeHandle(spec) {

        const el = document.createElement("div");

        el.className = "mureka-resize-handle";
        el.title = "Drag to resize";
        el.style.cssText = "position:absolute;z-index:5;touch-action:none;" + spec.css;

        el.addEventListener("pointerdown", function (ev) {

            ev.preventDefault();
            ev.stopPropagation();
            startResize(ev, spec, el);
        });

        return el;
    }

    // Add every edge and corner handle to the panel
    function buildResizeHandles(panel) {

        for (const spec of RESIZE_HANDLES) {
            panel.appendChild(makeResizeHandle(spec));
        }
    }

    function restorePosition() {

        let saved = null;

        try {
            saved = JSON.parse(localStorage.getItem(POS_KEY));
        } catch (e) {
        }

        const valid = saved
            && typeof saved.left === "number"
            && (saved.side === "top" || saved.side === "bottom")
            && typeof saved.offset === "number";

        if (valid) {

            const maxLeft = Math.max(8, window.innerWidth - panelEl.offsetWidth - 8);

            anchorLeft = Math.max(8, Math.min(saved.left, maxLeft));
            anchorSide = saved.side;
            anchorOffset = Math.max(8, saved.offset);

            panelEl.style.left = anchorLeft + "px";

            if (anchorSide === "top") {
                panelEl.style.top = anchorOffset + "px";
                panelEl.style.bottom = "auto";
            } else {
                panelEl.style.bottom = anchorOffset + "px";
                panelEl.style.top = "auto";
            }

            return;
        }

        // Default to the bottom right corner
        const left = window.innerWidth - (panelEl.offsetWidth || 300);
        const top = window.innerHeight - (panelEl.offsetHeight || 300);

        applyPosition(left, top);
    }

    // Debug line, a diagnostic readout under the header that is only there
    // while the Debug line setting is on. It exists to see what the browser
    // reports at the moments the panel is sized, which cannot be seen any
    // other way on a phone
    let debugLineEl = null;
    let debugTimer = null;

    // The most recent sizing passes, newest last. A few are shown, all of
    // them go out with a copy
    const DEBUG_FIT_KEEP = 12;
    const DEBUG_FIT_SHOW = 4;
    const debugFits = [];

    // Mirrors of state that lives inside the panel builder, kept here so the
    // readout can reach them
    let debugTallest = 0;
    let debugSearchFocused = false;

    // Round to one decimal, and show a dash for a missing value
    function dbgNum(v) {

        if (typeof v !== "number" || !isFinite(v)) {
            return "-";
        }

        return String(Math.round(v * 10) / 10);
    }

    function dbgFlag(v) {

        return v ? "y" : "n";
    }

    // Seconds since the page loaded, enough to put the passes in order
    function dbgTime() {

        return (nowMs() / 1000).toFixed(2);
    }

    // What the browser reports right now, independent of any sizing pass
    function debugNowLines() {

        const vv = window.visualViewport;
        const root = document.documentElement;
        const scroller = document.scrollingElement || root;

        const lines = [];

        lines.push("now vv " + (vv ? dbgNum(vv.height) + " w" + dbgNum(vv.width)
            + " top" + dbgNum(vv.offsetTop) + " x" + dbgNum(vv.scale) : "none")
            + " | in " + window.innerHeight + "x" + window.innerWidth
            + " | doc " + (root ? root.clientHeight : "-")
            + " | scr " + (window.screen ? screen.width + "x" + screen.height : "-")
            + " | sY " + dbgNum(scroller ? scroller.scrollTop : 0));

        let box = null;

        if (panelEl) {
            box = panelEl.getBoundingClientRect();
        }

        lines.push("panel css " + (panelEl ? (panelEl.style.height || "-") : "-")
            + " | box top" + (box ? dbgNum(box.top) : "-")
            + " h" + (box ? dbgNum(box.height) : "-")
            + " bot" + (box ? dbgNum(box.bottom) : "-")
            + " | kb " + dbgFlag(keyboardUp)
            + " foc " + dbgFlag(debugSearchFocused)
            + " tall " + dbgNum(debugTallest)
            + " | fs " + dbgFlag(isFullscreen())
            + " min " + dbgFlag(minimized)
            + " vis " + dbgFlag(!document.hidden));

        return lines;
    }

    // One sizing pass as a line
    function debugFitLine(f) {

        return f.t + " " + f.why
            + " kb" + f.kb
            + " vv" + f.vvH + "/" + f.vvTop
            + " in" + f.inH
            + " doc" + f.docH
            + " corr" + f.corr
            + " -> " + f.set;
    }

    // Put the readout on screen, or take it away when the setting is off
    function renderDebugLine() {

        if (!debugLineEl) {
            return;
        }

        const show = settings.debugLine === true && !minimized;

        debugLineEl.style.display = show ? "block" : "none";

        if (!show) {
            return;
        }

        const lines = debugNowLines();
        const recent = debugFits.slice(-DEBUG_FIT_SHOW);

        for (const f of recent) {
            lines.push(debugFitLine(f));
        }

        debugLineEl.textContent = lines.join("\n");
    }

    // Log one sizing pass, only kept while the setting is on
    function recordFit(entry) {

        if (settings.debugLine !== true) {
            return;
        }

        entry.t = dbgTime();
        debugFits.push(entry);

        while (debugFits.length > DEBUG_FIT_KEEP) {
            debugFits.shift();
        }

        renderDebugLine();
    }

    // Start or stop the live refresh to match the setting
    function updateDebugLine() {

        if (debugTimer) {

            clearInterval(debugTimer);
            debugTimer = null;
        }

        if (settings.debugLine === true) {

            // The now lines keep moving after the last sizing pass, which is
            // exactly the part worth watching once the keyboard has gone
            debugTimer = setInterval(renderDebugLine, 500);
        } else {
            debugFits.length = 0;
        }

        renderDebugLine();
    }

    // Copy everything the readout holds, the full pass history included, so
    // it can be pasted rather than read off the screen
    function copyDebugLine() {

        const lines = debugNowLines();

        for (const f of debugFits) {
            lines.push(debugFitLine(f));
        }

        lines.push("v" + VERSION + " " + (navigator.userAgent || ""));

        const text = lines.join("\n");

        if (navigator.clipboard && navigator.clipboard.writeText) {

            navigator.clipboard.writeText(text).then(function () {
                setStatus("Debug line copied");
            }, function () {
                setStatus("Could not copy the debug line");
            });

            return;
        }

        setStatus("Clipboard not available");
    }

    // On phones the panel fills the screen, but iOS Safari changes the visible
    // height when it shows or hides its toolbar, and CSS viewport units lag
    // behind that. Size the panel to the actual visible rectangle instead, so
    // the top controls and the list never spill off screen
    function fitMobile(cause) {

        if (!panelEl) {
            return;
        }

        // What asked for this pass, for the debug line only. Listeners hand
        // in their event, the passes that matter hand in a name, anything
        // else is a plain call
        let why = "call";

        if (typeof cause === "string") {
            why = cause;
        } else if (cause && typeof cause === "object" && cause.type) {

            const fromVv = window.visualViewport && cause.target === window.visualViewport;

            why = (fromVv ? "vv-" : "win-") + cause.type;
        }

        // Safari showing its bars again after dropping fullscreen arrives
        // here as a resize, so a fullscreen exit nothing else noticed is
        // caught on the way through. The pass it runs calls back in here with
        // the state already recorded, so this does not loop
        syncFullscreenState();

        const mobile = window.innerWidth <= 640;

        // The sheet behind the panel belongs to the phone layout, and only
        // while the panel is open, since a folded panel must leave the site
        // reachable
        if (backdropEl) {
            backdropEl.style.display = (mobile && !minimized) ? "block" : "none";
        }

        if (!mobile) {

            // A window that grew past the phone layout gets its page back
            paintPageBehind(false);

            // Hand sizing back to the draggable desktop dock. The fixed width
            // is only the fallback, restoreSize puts back what the user set
            panelEl.style.removeProperty("top");
            panelEl.style.removeProperty("height");
            panelEl.style.removeProperty("right");
            panelEl.style.removeProperty("left");
            panelEl.style.setProperty("width", "300px");
            restoreSize();
            restorePosition();
            return;
        }

        // Pin the panel to the real visible viewport rather than relying on
        // 100vw, which on iOS can be wider than what is actually on screen and
        // pushes the panel and its content off both edges. These four values
        // are all the panel needs, and nothing here touches the page itself
        const vv = window.visualViewport;

        let top = vv ? vv.offsetTop : 0;
        let height = vv ? vv.height : window.innerHeight;

        const left = vv ? vv.offsetLeft : 0;
        const width = vv ? vv.width : window.innerWidth;

        // The raw inputs, before the correction below picks between them
        const rawHeight = height;
        const rawTop = top;
        let corrected = false;

        // iOS 26 leaves the visible viewport a little short, and its offset a
        // little off zero, once the keyboard has gone, and never corrects
        // either. A panel sized from those numbers stops short of the bottom
        // and can be dragged around, which is exactly what was seen after a
        // search. With the keyboard down and no pinch zoom in play the panel
        // owns the whole screen, so the larger of the two heights is the
        // honest one and the offset is zero. Nothing is assumed about how big
        // the discrepancy is, only which of the two numbers to believe
        //
        // Do not second guess innerHeight against the screen size. On iOS 26
        // the page runs edge to edge under the translucent Safari bars, so
        // out of fullscreen it is legitimately as tall as the screen, and
        // rejecting it left the panel short after the keyboard went away
        //
        // innerHeight is not always the honest one either. Measured on an
        // iPhone after the keyboard closed, the visible viewport and
        // innerHeight both settled 13 pixels short, and the page was left
        // scrolled by those same 13 pixels, so the panel came out short and
        // sat too high by as much again. The document client height is the
        // one that held its value through the whole keyboard round trip, so
        // it is a third candidate for the larger of the heights
        if (vv && isIosLike() && !keyboardUp && vv.scale === 1) {

            const root = document.documentElement;
            const docHeight = root ? root.clientHeight : 0;

            height = Math.max(height, window.innerHeight, docHeight);
            top = 0;
            corrected = true;

            // The panel is placed at the top of the page, which only lines up
            // with the top of the screen while the page is not scrolled. The
            // keyboard leaves it scrolled and nothing scrolls it back. Only
            // while the panel is open, a folded panel leaves the page alone
            const scroller = document.scrollingElement || root;
            const pageOff = scroller ? scroller.scrollTop : 0;

            if (!minimized && (pageOff > 0 || vv.offsetTop > 0)) {

                try {
                    window.scrollTo(0, 0);
                } catch (e) {
                }

                if (scroller) {
                    scroller.scrollTop = 0;
                }
            }
        }

        // Extra room at the top only in fullscreen on an iPhone, where the
        // system owns that strip. Carried by a class so that switching it off
        // leaves the panel own padding exactly as its style declared it
        panelEl.classList.toggle("mureka-top-inset",
            isFullscreen() && isIosLike());

        // Inline important beats the media query so the exact pixels win
        panelEl.style.setProperty("top", top + "px", "important");
        panelEl.style.setProperty("left", left + "px", "important");
        panelEl.style.setProperty("right", "auto", "important");
        panelEl.style.setProperty("width", width + "px", "important");

        // The dock logic sets bottom when it anchors to the lower edge, and a
        // box with both top and bottom set stretches between them whatever its
        // height says. That would undo the collapse, so clear it here
        panelEl.style.setProperty("bottom", "auto", "important");

        // Collapsed it must shrink to its header, otherwise it keeps covering
        // the whole page and there is no way to reach the site underneath
        if (minimized) {
            panelEl.style.setProperty("height", "auto", "important");
        } else {
            panelEl.style.setProperty("height", height + "px", "important");
        }

        recordFit({
            why: why,
            kb: dbgFlag(keyboardUp),
            vvH: dbgNum(rawHeight),
            vvTop: dbgNum(rawTop),
            inH: String(window.innerHeight),
            docH: String(document.documentElement ? document.documentElement.clientHeight : "-"),
            corr: dbgFlag(corrected),
            set: minimized ? "auto" : dbgNum(height) + "@" + dbgNum(top)
        });

        // Everything the browser paints outside the panel comes from the page,
        // never from anything drawn inside it, so that is where it has to be
        // asked for
        paintPageBehind(!minimized);

        // The art height may have changed, re-seat the coverflow strip
        if (!swipeActive) {
            positionArt(0);
        }
    }

    // Drag the panel by its header, a click without movement toggles minimize
    function startDrag(ev) {

        if (ev.button !== 0) {
            return;
        }

        ev.preventDefault();

        // A floating dropdown would be left behind by a move, so close it
        closeDropdowns();

        const rect = panelEl.getBoundingClientRect();
        const offsetX = ev.clientX - rect.left;
        const offsetY = ev.clientY - rect.top;
        const startX = ev.clientX;
        const startY = ev.clientY;

        let moved = false;

        const onMove = function (e) {

            if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) {
                moved = true;
            }

            // Drag with a fixed top edge, the final edge anchor is set on release
            const pos = clampPosition(e.clientX - offsetX, e.clientY - offsetY);
            panelEl.style.bottom = "auto";
            panelEl.style.top = pos.top + "px";
            panelEl.style.left = pos.left + "px";
        };

        const onUp = function () {

            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);

            if (moved) {

                // Re-anchor to the nearer edge so later growth goes the right way
                const rect = panelEl.getBoundingClientRect();
                applyPosition(rect.left, rect.top);
                savePosition();
            } else {

                // Collapsing by accident is annoying, expanding by accident is
                // not, so opening takes one tap while closing takes two
                if (minimized) {

                    lastHeaderClickT = 0;
                    toggleMinimize();
                    return;
                }

                const now = Date.now();

                if (now - lastHeaderClickT < 400) {

                    lastHeaderClickT = 0;
                    toggleMinimize();

                } else {
                    lastHeaderClickT = now;
                }
            }
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    // Collapse or expand the panel body and remember the choice
    function toggleMinimize() {

        setMinimized(!minimized);
        savePosition();

        try {
            localStorage.setItem(MINIMIZED_KEY, minimized ? "1" : "0");
        } catch (e) {
        }
    }

    // Apply the minimized state. The panel is anchored to its nearer edge in CSS
    // (see applyPosition), so collapsing and expanding, like any size change,
    // automatically keeps that edge fixed and grows in the right direction
    function setMinimized(value) {

        minimized = value;

        if (bodyEl) {

            // The phone layout sets display flex with important on this element,
            // so a plain inline display would lose to it and the body would
            // never hide. Removing the inline value on expand hands the element
            // back to that rule, and to the plain block default on desktop
            if (minimized) {
                bodyEl.style.setProperty("display", "none", "important");
            } else {
                bodyEl.style.removeProperty("display");
            }
        }

        if (minimizeBtn) {

            // Up triangle to expand, down triangle to collapse
            minimizeBtn.textContent = minimized ? "\u25B4" : "\u25BE";
        }

        // The gate belongs to an open panel only
        refreshGate();

        // The hamburger menu stays reachable while folded, so the same entry
        // offers the way back rather than only ever offering to hide
        if (foldButton) {

            foldButton.labelEl.textContent = minimized ? "Show player" : "Hide player";
            foldButton.iconEl.textContent = "";
            foldButton.iconEl.appendChild(minimized ? iconUnfold() : iconFold());
        }

        fitMobile();

        // The height just changed, so re-clamp into the viewport. Collapsing
        // leaves a small panel, so it re-picks the nearer edge and snaps to it.
        // Expanding keeps the docked side, since a tall panel would otherwise
        // flip to the top edge and grow off the bottom of the screen
        if (panelEl) {

            const rect = panelEl.getBoundingClientRect();

            applyPosition(rect.left, rect.top, !minimized);
        }
    }

    // Helper that builds a styled button wired to a handler
    function makeButton(label, bg, fg, handler) {

        const b = document.createElement("button");

        b.textContent = label;
        b.style.cssText = [
            "flex:1",
            "padding:7px 4px",
            "border:none",
            "border-radius:6px",
            "background:" + bg,
            "color:" + fg,
            "font-weight:600",
            "cursor:pointer"
        ].join(";");

        b.addEventListener("click", handler);

        return b;
    }

    // Helper that builds an icon transport button wired to a handler
    // The content may be a text glyph or an SVG node
    function makeIconButton(content, title, handler) {

        const b = document.createElement("button");

        // The icon stays a direct child of the button, which is how these were
        // built before labels existed. Wrapping it in a span left the buttons
        // blank on Chromium for Android, so the label is the thing that gets
        // added alongside instead
        setTransportIcon(b, content);

        b.title = title;
        // A fixed height rather than padding, so turning the names on lets the
        // icon and the label share the room the button already has instead of
        // making every button taller
        b.style.cssText = [
            "flex:1",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "gap:3px",
            "height:48px",
            "box-sizing:border-box",
            "padding:0",
            "border:none",
            "border-radius:8px",
            "background:#333",
            "color:#fff",
            "font-size:22px",
            "line-height:1",
            "cursor:pointer"
        ].join(";");

        b.addEventListener("click", handler);

        return b;
    }

    // Put an icon, or a character, into a button built by makeIconButton.
    // Deliberately not called setButtonIcon, that name belongs to the action
    // tile version further down, and two declarations would collide
    function setTransportIcon(b, content) {

        // The label, when there is one, has to survive the swap, so it is taken
        // out first and put back after the new icon
        const label = b.labelSpan || null;

        b.textContent = "";

        if (content instanceof Node) {
            b.appendChild(content);
        } else {
            b.textContent = content;
        }

        if (label) {
            b.appendChild(label);
        }
    }

    // What the name under a button should say right now. The three buttons
    // that change their icon with state change their word with it, so the two
    // never disagree. Instrumental is shortened, the full word does not fit
    function controlLabelText(name) {

        if (name === "play") {
            return (audio && !audio.paused && audio.src) ? "pause" : "play";
        }

        if (name === "published") {
            return publishFilter === "published" ? "public" : "all";
        }

        // The playing song's rating, or the action while it has none
        if (name === "rate") {

            const r = currentSong ? getRating(currentSong) : null;

            return r === null ? "rate" : r + "\u2605";
        }

        if (name === "vocals") {

            const mode = settings.vocalFilter;

            return mode === "vocal"
                ? "vocals"
                : (mode === "instrumental" ? "instr" : "all");
        }

        return name;
    }

    // Show or hide the name under each transport button
    function updateControlLabels() {

        const show = settings.controlLabels === true;

        for (const name of Object.keys(controlButtons)) {

            const btn = controlButtons[name];

            if (!btn) {
                continue;
            }

            if (!show) {

                if (btn.labelSpan) {

                    btn.labelSpan.remove();
                    btn.labelSpan = null;
                }

                // Back to a single centred icon
                btn.style.flexDirection = "row";

                continue;
            }

            if (!btn.labelSpan) {

                btn.labelSpan = document.createElement("span");
                btn.labelSpan.style.cssText = "font:600 10px/1 sans-serif";
                btn.appendChild(btn.labelSpan);
            }

            // Icon above, name beneath
            btn.style.flexDirection = "column";
            btn.labelSpan.textContent = controlLabelText(name);
        }
    }

    // Build the shuffle icon as real SVG nodes, matching the text glyph color
    // Built with the DOM instead of innerHTML, so nothing parses markup
    function makeShuffleIcon() {

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");

        svg.setAttribute("width", "22");
        svg.setAttribute("height", "22");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        const shapes = [
            ["polyline", { points: "16 3 21 3 21 8" }],
            ["line", { x1: "4", y1: "20", x2: "21", y2: "3" }],
            ["polyline", { points: "21 16 21 21 16 21" }],
            ["line", { x1: "15", y1: "15", x2: "21", y2: "21" }],
            ["line", { x1: "4", y1: "4", x2: "9", y2: "9" }]
        ];

        shapes.forEach(function (shape) {

            const el = document.createElementNS(ns, shape[0]);
            const attrs = shape[1];

            Object.keys(attrs).forEach(function (key) {
                el.setAttribute(key, attrs[key]);
            });

            svg.appendChild(el);
        });

        return svg;
    }

    // Build the repeat icon as SVG nodes, withOne adds a 1 for repeat one
    function makeRepeatIcon(withOne) {

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");

        svg.setAttribute("width", "22");
        svg.setAttribute("height", "22");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        const shapes = [
            ["polyline", { points: "17 1 21 5 17 9" }],
            ["path", { d: "M3 11V9a4 4 0 0 1 4-4h14" }],
            ["polyline", { points: "7 23 3 19 7 15" }],
            ["path", { d: "M21 13v2a4 4 0 0 1-4 4H3" }]
        ];

        shapes.forEach(function (shape) {

            const el = document.createElementNS(ns, shape[0]);
            const attrs = shape[1];

            Object.keys(attrs).forEach(function (key) {
                el.setAttribute(key, attrs[key]);
            });

            svg.appendChild(el);
        });

        if (withOne) {

            const t = document.createElementNS(ns, "text");
            t.setAttribute("x", "12");
            t.setAttribute("y", "15.5");
            t.setAttribute("text-anchor", "middle");
            t.setAttribute("font-size", "10");
            t.setAttribute("font-family", "sans-serif");
            t.setAttribute("fill", "currentColor");
            t.setAttribute("stroke", "none");
            t.textContent = "1";
            svg.appendChild(t);
        }

        return svg;
    }

    // Update the status line text
    function setStatus(text) {

        statusText = text || "";

        // Before the panel is built there is nowhere to put it, and the
        // marquee picks the text up from statusText once it exists
        if (statusMarquee) {

            statusMarquee.setText(statusText);
            return;
        }

        if (statusEl) {
            statusEl.textContent = statusText;
        }
    }

    // Build an SVG icon from a list of shapes, stroked in the current text color
    // Built with the DOM instead of innerHTML, so nothing parses markup
    function makeSvgIcon(shapes, size) {

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        const s = size || 18;

        svg.setAttribute("width", String(s));
        svg.setAttribute("height", String(s));
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        shapes.forEach(function (shape) {

            const el = document.createElementNS(ns, shape[0]);
            const attrs = shape[1];

            Object.keys(attrs).forEach(function (key) {
                el.setAttribute(key, attrs[key]);
            });

            svg.appendChild(el);
        });

        return svg;
    }

    // Transport icons, drawn as solid shapes rather than taken from the font.
    // The Unicode media characters are emoji on most phones, so they arrive in
    // the vendor colours and at the vendor weight, which is why the row looked
    // different on every device. These are filled with currentColor instead, so
    // they follow the button like every other icon here
    function makeFilledIcon(shapes, size) {

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        const s = size || 20;

        svg.setAttribute("width", String(s));
        svg.setAttribute("height", String(s));
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "currentColor");
        svg.setAttribute("stroke", "none");

        shapes.forEach(function (shape) {

            const el = document.createElementNS(ns, shape[0]);
            const attrs = shape[1];

            Object.keys(attrs).forEach(function (key) {
                el.setAttribute(key, attrs[key]);
            });

            svg.appendChild(el);
        });

        return svg;
    }

    function iconPlay() {

        return makeFilledIcon([
            ["path", { d: "M8 5.2v13.6a1 1 0 0 0 1.53.85l10.7-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2z" }]
        ]);
    }

    function iconPause() {

        return makeFilledIcon([
            ["rect", { x: "7", y: "5", width: "3.6", height: "14", rx: "1.1" }],
            ["rect", { x: "13.4", y: "5", width: "3.6", height: "14", rx: "1.1" }]
        ]);
    }

    // The transport stop, drawn solid to match the rest of the play controls
    // The action tiles have a stop of their own further down, and a second
    // declaration under the same name would quietly win over this one
    function iconStopTransport() {

        return makeFilledIcon([
            ["rect", { x: "6.5", y: "6.5", width: "11", height: "11", rx: "1.6" }]
        ]);
    }

    function iconPrev() {

        return makeFilledIcon([
            ["rect", { x: "5", y: "5.5", width: "2.6", height: "13", rx: "1.1" }],
            ["path", { d: "M19 6.6v10.8a1 1 0 0 1-1.54.84l-8.2-5.4a1 1 0 0 1 0-1.68l8.2-5.4A1 1 0 0 1 19 6.6z" }]
        ]);
    }

    function iconNext() {

        return makeFilledIcon([
            ["path", { d: "M5 6.6v10.8a1 1 0 0 0 1.54.84l8.2-5.4a1 1 0 0 0 0-1.68l-8.2-5.4A1 1 0 0 0 5 6.6z" }],
            ["rect", { x: "16.4", y: "5.5", width: "2.6", height: "13", rx: "1.1" }]
        ]);
    }

    // Named action icons, one builder each so a fresh node is returned per call
    function iconLoad() {

        return makeSvgIcon([
            ["polyline", { points: "23 4 23 10 17 10" }],
            ["polyline", { points: "1 20 1 14 7 14" }],
            ["path", { d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" }]
        ]);
    }

    function iconStop() {

        return makeSvgIcon([
            ["rect", { x: "5", y: "5", width: "14", height: "14", rx: "2", fill: "currentColor", stroke: "none" }]
        ]);
    }

    function iconClear() {

        return makeSvgIcon([
            ["polyline", { points: "3 6 5 6 21 6" }],
            ["path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }],
            ["line", { x1: "10", y1: "11", x2: "10", y2: "17" }],
            ["line", { x1: "14", y1: "11", x2: "14", y2: "17" }]
        ]);
    }

    function iconFeed() {

        return makeSvgIcon([
            ["polygon", { points: "12 2 2 7 12 12 22 7 12 2" }],
            ["polyline", { points: "2 17 12 22 22 17" }],
            ["polyline", { points: "2 12 12 17 22 12" }]
        ]);
    }

    // Crescent moon, for putting the screen to sleep
    // Four corners pointing out, for entering fullscreen
    function iconFullscreen() {

        return makeSvgIcon([
            ["polyline", { points: "15 3 21 3 21 9" }],
            ["polyline", { points: "9 21 3 21 3 15" }],
            ["line", { x1: "21", y1: "3", x2: "14", y2: "10" }],
            ["line", { x1: "3", y1: "21", x2: "10", y2: "14" }]
        ]);
    }

    // Four corners pointing in, for leaving fullscreen
    function iconExitFullscreen() {

        return makeSvgIcon([
            ["polyline", { points: "4 14 10 14 10 20" }],
            ["polyline", { points: "20 10 14 10 14 4" }],
            ["line", { x1: "14", y1: "10", x2: "21", y2: "3" }],
            ["line", { x1: "3", y1: "21", x2: "10", y2: "14" }]
        ]);
    }

    // Funnel, for the smart filter sheet
    function iconFilter() {

        return makeSvgIcon([
            ["polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" }]
        ]);
    }

    // Chevron up, for folding the player away to its header
    function iconFold() {

        return makeSvgIcon([
            ["polyline", { points: "18 15 12 9 6 15" }]
        ]);
    }

    // Chevron down, for bringing a folded player back
    function iconUnfold() {

        return makeSvgIcon([
            ["polyline", { points: "6 9 12 15 18 9" }]
        ]);
    }

    function iconBlackout() {

        return makeSvgIcon([
            ["path", { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }]
        ]);
    }

    function iconCache() {

        return makeSvgIcon([
            ["polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }]
        ]);
    }

    function iconDownload() {

        return makeSvgIcon([
            ["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
            ["polyline", { points: "7 10 12 15 17 10" }],
            ["line", { x1: "12", y1: "15", x2: "12", y2: "3" }]
        ]);
    }

    function iconPlaylists() {

        return makeSvgIcon([
            ["line", { x1: "8", y1: "6", x2: "21", y2: "6" }],
            ["line", { x1: "8", y1: "12", x2: "21", y2: "12" }],
            ["line", { x1: "8", y1: "18", x2: "21", y2: "18" }],
            ["line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }],
            ["line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }],
            ["line", { x1: "3", y1: "18", x2: "3.01", y2: "18" }]
        ]);
    }

    // Creators picker, a single person to suggest browsing another user
    function iconCreators() {

        return makeSvgIcon([
            ["path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }],
            ["circle", { cx: "12", cy: "7", r: "4" }]
        ]);
    }

    // Mureka view, a hash to suggest the numbered published order
    function iconMureka() {

        return makeSvgIcon([
            ["line", { x1: "4", y1: "9", x2: "20", y2: "9" }],
            ["line", { x1: "4", y1: "15", x2: "20", y2: "15" }],
            ["line", { x1: "10", y1: "3", x2: "8", y2: "21" }],
            ["line", { x1: "16", y1: "3", x2: "14", y2: "21" }]
        ]);
    }

    // Queue view, a small play marker ahead of a short list
    function iconQueue() {

        return makeSvgIcon([
            ["polygon", { points: "2 6 2 14 8 10", fill: "currentColor", stroke: "none" }],
            ["line", { x1: "12", y1: "7", x2: "21", y2: "7" }],
            ["line", { x1: "12", y1: "12", x2: "21", y2: "12" }],
            ["line", { x1: "12", y1: "17", x2: "21", y2: "17" }]
        ]);
    }

    // A to Z view, lines of decreasing length to suggest a sort
    function iconAlpha() {

        return makeSvgIcon([
            ["line", { x1: "3", y1: "6", x2: "17", y2: "6" }],
            ["line", { x1: "3", y1: "12", x2: "13", y2: "12" }],
            ["line", { x1: "3", y1: "18", x2: "9", y2: "18" }]
        ]);
    }

    // All filter, a grid to suggest the whole set
    function iconAll() {

        return makeSvgIcon([
            ["rect", { x: "3", y: "3", width: "7", height: "7" }],
            ["rect", { x: "14", y: "3", width: "7", height: "7" }],
            ["rect", { x: "14", y: "14", width: "7", height: "7" }],
            ["rect", { x: "3", y: "14", width: "7", height: "7" }]
        ]);
    }

    // Vocals filter, a microphone
    function iconVocals() {

        return makeSvgIcon([
            ["path", { d: "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" }],
            ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }],
            ["line", { x1: "12", y1: "19", x2: "12", y2: "23" }],
            ["line", { x1: "8", y1: "23", x2: "16", y2: "23" }]
        ]);
    }

    // Instrumental filter, a music note
    function iconInstrumental() {

        return makeSvgIcon([
            ["path", { d: "M9 18V5l12-2v13" }],
            ["circle", { cx: "6", cy: "18", r: "3" }],
            ["circle", { cx: "18", cy: "16", r: "3" }]
        ]);
    }

    // Build a compact action tile, an icon stacked over a small label
    // The label never wraps, so a long name does not push the tile to two lines
    function makeActionButton(iconNode, label, bg, fg, handler) {

        const b = document.createElement("button");

        b.style.cssText = [
            "flex:1",
            "display:flex",
            "flex-direction:column",
            "align-items:center",
            "justify-content:center",
            "gap:5px",
            "min-width:0",
            "padding:9px 4px",
            "border:none",
            "border-radius:8px",
            "background:" + bg,
            "color:" + fg,
            "font:600 11px/1 sans-serif",
            "cursor:pointer"
        ].join(";");

        const iconEl = document.createElement("span");
        iconEl.style.cssText = "display:flex;align-items:center;justify-content:center;height:18px";

        if (iconNode) {
            iconEl.appendChild(iconNode);
        }

        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        labelEl.style.cssText = "white-space:nowrap";

        b.appendChild(iconEl);
        b.appendChild(labelEl);
        b.addEventListener("click", handler);

        // Expose the parts so callers can update the label or swap the icon
        b.iconEl = iconEl;
        b.labelEl = labelEl;

        return b;
    }

    // Replace the icon inside an action tile built by makeActionButton
    function setButtonIcon(btn, iconNode) {

        if (!btn || !btn.iconEl) {
            return;
        }

        btn.iconEl.textContent = "";

        if (iconNode) {
            btn.iconEl.appendChild(iconNode);
        }
    }

    // Reflect the running state on whichever of the two library buttons
    // started the run. The other one keeps its own label, so it is always
    // clear which action is in progress
    function updateButton() {

        const paint = function (btn, owner, restLabel) {

            if (!btn) {
                return;
            }

            const active = running && runOwner === owner;

            btn.labelEl.textContent = active ? "Stop" : restLabel;
            setButtonIcon(btn, active ? iconStop() : iconLoad());

            // The other button cannot start anything while a run is going on,
            // so it is greyed rather than left looking available
            const idle = running && !active;

            btn.style.opacity = idle ? "0.4" : "1";
            btn.disabled = idle;
        };

        paint(loadButton, "load", "Load");
        paint(rescanButton, "rescan", "Rescan");
    }

    // Render the cached song list
    function renderList() {

        renderSongs(displaySongs(), listView === "queue");
    }

    // Build one list row for a song
    // number may be null to leave the number column blank, as for a pinned song
    // dimmed greys the row, used for already played songs in the queue view
    // Set a heart element to the liked or outline state
    function paintHeart(heartEl, liked) {

        if (!heartEl) {
            return;
        }

        heartEl.textContent = liked ? "\u2665" : "\u2661";
        heartEl.title = liked ? "Liked, click to unlike" : "Click to like";
        heartEl.style.color = liked ? "#ff6b8a" : "#777";
    }

    // Like or unlike a song through the Mureka favorite endpoint
    // The heart flips immediately and reverts if the request fails
    // state 1 likes the song, state 2 removes the like
    async function toggleLike(song, heartEl) {

        const makeLiked = !song.is_liked;

        // Optimistic update so the heart responds without waiting on the network
        song.is_liked = makeLiked;
        paintHeart(heartEl, makeLiked);

        try {
            const res = await fetch("/api/pgc/user/song/favorite", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    time: Date.now(),
                    song_id: song.song_id,
                    state: makeLiked ? 1 : 2,
                    playlist_id: 0,
                    home_module_id: 0
                })
            });

            const json = await res.json();

            if (!res.ok || !json || json.code !== 0) {
                throw new Error("favorite failed");
            }

            // The server echoes the new state, 1 liked and 2 not liked
            const liked = json.data && json.data.state === 1;

            song.is_liked = liked;
            paintHeart(heartEl, liked);
            saveCache();
            setStatus((liked ? "Liked: " : "Unliked: ") + (song.title || "Untitled"));

        } catch (e) {

            // Revert the optimistic change on any failure
            song.is_liked = !makeLiked;
            paintHeart(heartEl, song.is_liked);
            setStatus("Could not update like, try again");
        }
    }

    function buildSongRow(song, number, isPlaying, dimmed) {

        const title = (song.title || "").trim() || "Untitled";

        const item = document.createElement("div");
        item.style.cssText = "display:flex;align-items:center;padding:3px 2px;cursor:pointer;user-select:none;-moz-user-select:none;-webkit-user-select:none;-webkit-touch-callout:none";
        item.title = "Play; long press or right-click for options";

        if (dimmed) {
            item.style.opacity = "0.45";
        }

        // The dot marks cache state, hidden keeps the text aligned
        // Pulsing while caching, solid once cached
        const caching = cachingIds.has(song.song_id);
        const audioCached = cachedIds.has(song.song_id);
        const artCached = artCachedIds.has(String(song.song_id));
        const anyCached = audioCached || artCached;

        // Cyan when both the song and its cover are stored, otherwise a distinct
        // color for whichever one is present so far
        let dotColor = "#48e1eb";

        if (audioCached && !artCached) {
            dotColor = "#b388ff";
        } else if (artCached && !audioCached) {
            dotColor = "#f0a94a";
        }

        const dot = document.createElement("span");
        dot.textContent = "\u25CF";
        dot.style.cssText = "color:" + dotColor + ";margin-right:6px;flex:0 0 auto;visibility:"
            + ((caching || anyCached) ? "visible" : "hidden");

        if (caching) {

            dot.style.animation = "mureka-pulse 1s ease-in-out infinite";
            dot.title = "Caching";

        } else if (audioCached && artCached) {
            dot.title = "Song and cover cached";
        } else if (audioCached) {
            dot.title = "Song cached, cover not yet";
        } else if (artCached) {
            dot.title = "Cover cached, song not yet";
        }

        // Number column, right aligned and fixed width so titles line up
        const numEl = document.createElement("span");
        numEl.textContent = (number === undefined || number === null) ? "" : number;
        numEl.style.cssText = "flex:0 0 auto;width:42px;text-align:right;margin-right:8px;color:#888;font-variant-numeric:tabular-nums";

        // Title column, left aligned and filling the rest of the row
        const titleEl = document.createElement("span");
        titleEl.textContent = title;
        titleEl.style.cssText = "flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";

        if (isPlaying) {
            titleEl.style.color = "#48e1eb";
            titleEl.style.fontWeight = "600";
            numEl.style.color = "#48e1eb";
        }

        item.appendChild(dot);
        item.appendChild(numEl);
        item.appendChild(titleEl);

        // The rating, but only once any song has one, so a library nobody has
        // rated keeps the full width for titles. A fixed column keeps the
        // durations lined up, zero stars shows grey, not rated shows nothing
        if (ratings.size > 0) {

            const r = getRating(song);
            const rateEl = document.createElement("span");

            rateEl.textContent = r === null ? "" : "\u2605" + r;
            rateEl.style.cssText = "flex:0 0 auto;width:28px;margin-left:6px;text-align:right;font-size:12px;font-variant-numeric:tabular-nums;color:"
                + (r ? STAR_GOLD : "#777");

            item.appendChild(rateEl);
        }

        // Song length, right aligned next to the title
        if (song.duration_milliseconds) {

            const dur = document.createElement("span");
            dur.textContent = formatTime(song.duration_milliseconds / 1000);
            dur.style.cssText = "flex:0 0 auto;margin-left:8px;color:#888;font-variant-numeric:tabular-nums";
            item.appendChild(dur);
        }

        // Mark each song as published or still a draft, but only when the list
        // is showing both. Under the published filter every row would carry the
        // same badge, which tells the reader nothing
        if (!creatorSource && publishFilter === "all") {

            const published = song.publish_state === 1;

            // Fixed width, so the badge column lines up and the title beside it
            // keeps the same room whichever word the badge happens to carry
            const badge = document.createElement("span");
            badge.textContent = published ? "public" : "draft";
            badge.style.cssText = "flex:0 0 auto;width:46px;margin-left:6px;padding:0;border-radius:4px;font-size:11px;line-height:16px;text-align:center;"
                + (published
                    ? "background:#1f3a2a;color:#7fd6a0"
                    : "background:#3a3a42;color:#bbb");
            item.appendChild(badge);
        }

        // Show on the playing row when it is set to repeat just this song
        if (isPlaying && repeatMode === "one") {

            const rep = document.createElement("span");
            rep.textContent = "\u21BB 1";
            rep.title = "Repeat one";
            rep.style.cssText = "flex:0 0 auto;margin-left:6px;padding:0 5px;border-radius:4px;background:#48e1eb;color:#000;font-size:11px;line-height:16px;font-weight:600";
            item.appendChild(rep);
        }

        // Like control, filled heart when liked, outline heart to like it
        // Always present so the duration column stays aligned across rows
        const heart = document.createElement("span");
        heart.style.cssText = "flex:0 0 auto;width:20px;margin-left:6px;text-align:center;cursor:pointer";
        paintHeart(heart, song.is_liked === true);

        heart.addEventListener("click", function (ev) {

            // Do not also play the song when the heart is clicked
            ev.stopPropagation();
            toggleLike(song, heart);
        });

        item.appendChild(heart);

        // Long press on touch opens the same menu as right-click on desktop
        let pressTimer = null;
        let longPressed = false;

        const cancelPress = function () {

            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }
        };

        item.addEventListener("click", function (ev) {

            // A long press already opened the menu, so do not also play
            if (longPressed) {
                longPressed = false;
                ev.preventDefault();
                ev.stopPropagation();
                return;
            }

            playFrom(song.song_id);
        });

        item.addEventListener("contextmenu", function (ev) {
            ev.preventDefault();
            showContextMenu(ev.clientX, ev.clientY, song);
        });

        item.addEventListener("touchstart", function (ev) {

            if (ev.touches.length !== 1) {
                return;
            }

            longPressed = false;

            const x = ev.touches[0].clientX;
            const y = ev.touches[0].clientY;

            cancelPress();

            pressTimer = setTimeout(function () {
                longPressed = true;
                showContextMenu(x, y, song);
            }, 500);
        }, { passive: true });

        item.addEventListener("touchmove", cancelPress, { passive: true });
        item.addEventListener("touchend", cancelPress);
        item.addEventListener("touchcancel", cancelPress);

        return item;
    }

    // Render any list of songs, the number shown is always the Mureka position
    // Build the next rows of the list as elements. Called for the first chunk
    // on every redraw and again whenever the scroll gets near the bottom
    function renderMoreRows(count) {

        if (!listEl || !lazyState) {
            return;
        }

        const end = Math.min(lazyRows.length, lazyRendered + count);

        if (end <= lazyRendered) {
            return;
        }

        const frag = document.createDocumentFragment();

        for (let k = lazyRendered; k < end; k += 1) {

            const entry = lazyRows[k];
            const song = entry.song;

            let isPlaying;
            let dimmed;

            if (lazyState.byQueueIndex) {

                isPlaying = entry.index === queuePos;

                // Grey out already played songs, and in repeat one the upcoming
                // ones too, since playback stays on the current track
                dimmed = entry.index < queuePos || (entry.index > queuePos && repeatMode === "one");

            } else {

                isPlaying = song.song_id === lazyState.playingId;
                dimmed = false;
            }

            const item = buildSongRow(song, lazyState.numberById.get(song.song_id), isPlaying, dimmed);

            if (isPlaying) {
                playingItemEl = item;
            }

            frag.appendChild(item);
        }

        listEl.appendChild(frag);
        lazyRendered = end;
        lazyKeep = Math.max(lazyKeep, end);
    }

    function renderSongs(songs, fromQueue) {

        if (!listEl) {
            return;
        }

        // Identify the playing song by its id so the highlight is feed independent
        const playingId = currentSong ? currentSong.song_id : null;

        // The displayed number is the song rank in the canonical order for the
        // current source, so the column runs in step with the list. Oldest is 1
        // and the newest is the highest, and a song keeps that number across the
        // Queue and A-Z views. For the Published feed the order is by publish
        // date, so the number tracks the publish sorted list shown here
        const numberById = new Map();

        if (settings.absoluteNumbers) {

            // Rank by when the song was actually made, so number one is the
            // first song ever created and a song keeps that number whatever is
            // filtered or sorted. Position in the cache cannot be used for
            // this, it only reflects the order pages happened to be fetched in
            const byAge = cache.songs.slice().sort(function (a, b) {
                return (a.generate_at || 0) - (b.generate_at || 0);
            });

            byAge.forEach(function (s, i) {
                numberById.set(s.song_id, i + 1);
            });

        } else {

            // Rank over the library, or over the published part of it when
            // that is what is being shown. Deliberately not over the filtered
            // list: a song must keep its number while tags, tempo, vocals, a
            // playlist or a search narrow what is visible, otherwise the same
            // song is numbered differently depending on what else is ticked
            const scope = orderedSongs().filter(passesPublishFilter);
            const total = scope.length;

            scope.forEach(function (s, i) {
                numberById.set(s.song_id, total - i);
            });
        }

        listEl.textContent = "";
        playingItemEl = null;

        const query = searchQuery;

        // The queue can hold the same song more than once, played earlier and
        // queued again, so the queue view decides played, current and upcoming
        // by the row position in the queue rather than by song id, which would
        // otherwise grey out a replayed song that is actually still upcoming
        const byQueueIndex = fromQueue === true;

        // Decide what the list shows without touching the DOM. Rows are built
        // afterwards, only as far down as is needed
        const visible = [];

        songs.forEach(function (song, i) {

            const title = (song.title || "").trim() || "Untitled";

            // Skip rows hidden by the vocals or playlist filter
            // The queue view always shows the real queue, so it is never filtered
            if (listView !== "queue" && !passesFilters(song)) {
                return;
            }

            // Skip rows that do not match the current search text
            if (query && title.toLowerCase().indexOf(query) === -1) {
                return;
            }

            visible.push({ song: song, index: i });
        });

        const shown = visible.length;

        // A different view, filter or search starts from the top again. The
        // same one keeps as many rows as had been built, so a redraw does not
        // pull the list up from under someone who had scrolled down
        const key = [listView, query, publishFilter, settings.vocalFilter,
            activePlaylist ? activePlaylist.name : "", creatorSource ? creatorSource.user_id : ""].join("|");

        if (key !== lazyKey) {

            lazyKey = key;
            lazyKeep = 0;
        }

        lazyRows = visible;
        lazyRendered = 0;
        lazyState = { byQueueIndex: byQueueIndex, playingId: playingId, numberById: numberById };

        // Always build far enough to include the playing song, so it can be
        // scrolled into view, and at least one chunk
        let target = Math.max(RENDER_CHUNK, lazyKeep);

        const playingAt = visible.findIndex(function (entry) {

            return byQueueIndex
                ? entry.index === queuePos
                : entry.song.song_id === playingId;
        });

        if (playingAt >= 0) {
            target = Math.max(target, playingAt + Math.floor(RENDER_CHUNK / 2));
        }

        renderMoreRows(target);

        // Update the counts line, shown rows against the library total and queue
        // An active creator and playlist lead the line so the scope stays clear
        if (countsEl) {

            // How many songs there are in total and how many of them are
            // public, since the two answer different questions and the total
            // alone says nothing about how much of the library is published
            const publicTotal = cache.songs.filter(function (s) {
                return s.publish_state === 1;
            }).length;

            let text = "Shown " + shown
                + "  \u00B7  Total " + cache.songs.length
                + "  \u00B7  Public " + publicTotal
                + "  \u00B7  Queue " + queue.length;

            const scope = [];

            if (creatorSource) {
                scope.push(creatorSource.stage_name);
            }

            if (activePlaylist) {
                scope.push(activePlaylist.name);
            }

            if (scope.length > 0) {
                text = scope.join("  \u00B7  ") + "  \u00B7  " + text;
            }

            countsEl.textContent = text;
        }

        // Amnesty, pin the playing song on top when this view does not contain it
        // This keeps a song from another feed visible until the next song starts
        if (currentSong && !playingItemEl && !query) {

            const item = buildSongRow(currentSong, numberById.get(currentSong.song_id), true);
            playingItemEl = item;
            listEl.insertBefore(item, listEl.firstChild);
        }

        // Tell the user when the search, vocals or playlist filter hides everything
        const filtering = listView !== "queue"
            && (settings.vocalFilter !== "all" || activePlaylist);

        if ((query || filtering) && shown === 0 && !playingItemEl) {

            const empty = document.createElement("div");
            empty.textContent = "No matches";
            empty.style.cssText = "padding:6px 2px;color:#888";
            listEl.appendChild(empty);
            return;
        }

        // Tell the user the queue view is empty until playback starts
        if (!query && shown === 0 && !playingItemEl && listView === "queue") {

            const empty = document.createElement("div");
            empty.textContent = "Queue is empty, press play";
            empty.style.cssText = "padding:6px 2px;color:#888";
            listEl.appendChild(empty);
        }
    }

    // Highlight the start feed buttons to match the saved choice
    function updateStartButtons() {

        if (!startPublishedBtn || !startAllBtn) {
            return;
        }

        const pub = settings.startFeed === "published";

        startPublishedBtn.style.background = pub ? "#48e1eb" : "#333";
        startPublishedBtn.style.color = pub ? "#000" : "#fff";
        startAllBtn.style.background = pub ? "#333" : "#48e1eb";
        startAllBtn.style.color = pub ? "#fff" : "#000";
    }

    // Set an On or Off look on a toggle button
    function updateToggleButton(btn, on) {

        btn.textContent = on ? "On" : "Off";
        btn.style.background = on ? "#48e1eb" : "#333";
        btn.style.color = on ? "#000" : "#fff";
    }

    // Build a labeled On / Off row backed by a getter and a setter
    // Build a settings row with a label above a full width text input, used for
    // the now playing templates. Saves and re-asserts metadata on every edit
    // A labelled colour picker, for settings that pick a colour rather than text
    function makeColorRow(label, get, set) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const name = document.createElement("span");
        name.textContent = label;

        const input = document.createElement("input");

        input.type = "color";
        input.value = get();
        input.style.cssText = "flex:0 0 auto;width:44px;height:28px;padding:0;border:1px solid #3a3a42;border-radius:6px;background:#26262c";

        input.addEventListener("input", function () {

            set(input.value);
            saveSettings();
        });

        settingsRefreshers.push(function () {
            input.value = get();
        });

        row.appendChild(name);
        row.appendChild(input);

        return row;
    }

    function makeTextRow(label, get, set, previewFn) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;flex-direction:column;gap:4px";

        const name = document.createElement("div");
        name.textContent = label;
        name.style.cssText = "font-size:12px;color:#ccc";

        const input = document.createElement("input");
        input.type = "text";
        input.style.font = INPUT_FONT;
        input.value = get();
        input.style.cssText = [
            "width:100%",
            "box-sizing:border-box",
            "padding:6px 8px",
            "border:1px solid #3a3a42",
            "border-radius:6px",
            "background:#26262c",
            "color:#fff",
            "font:13px/1.4 monospace"
        ].join(";");

        row.appendChild(name);
        row.appendChild(input);

        // Live preview of the expanded template for the current song
        let refresh = null;

        if (previewFn) {

            const preview = document.createElement("div");
            preview.style.cssText = "font-size:12px;color:#48e1eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:16px";
            row.appendChild(preview);

            refresh = function () {

                preview.textContent = previewFn(input.value);
            };

            refresh();
            metaPreviewUpdaters.push(refresh);
        }

        input.addEventListener("input", function () {

            set(input.value);
            saveSettings();
            reassertNowPlaying();

            if (refresh) {

                refresh();
            }
        });

        // Stop the site keyboard shortcuts from firing while typing
        input.addEventListener("keydown", function (ev) {

            ev.stopPropagation();
        });

        settingsRefreshers.push(function () {

            // Never fight the user while the field has the caret
            if (document.activeElement !== input) {
                input.value = get();
            }
        });

        return row;
    }

    function makeBoolRow(label, get, set) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const name = document.createElement("span");
        name.textContent = label;

        // Claim the space between, so a long label cannot leave the toggle
        // sitting next to the text instead of at the edge
        name.style.cssText = "flex:1;min-width:0";

        const btn = makeButton("Off", "#333", "#fff", function () {
            const next = !get();

            set(next);
            saveSettings();
            updateToggleButton(btn, next);
        });

        btn.style.flex = "0 0 auto";
        btn.style.minWidth = "56px";
        btn.style.padding = "6px 12px";

        updateToggleButton(btn, get());

        settingsRefreshers.push(function () {
            updateToggleButton(btn, get());
        });

        row.appendChild(name);
        row.appendChild(btn);

        return row;
    }

    // Build a row of mutually exclusive choice buttons backed by getter / setter
    function makeChoiceRow(choices, get, set) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:6px";

        const buttons = [];

        const highlight = function () {

            const current = get();

            buttons.forEach(function (entry) {

                const on = entry.value === current;

                entry.btn.style.background = on ? "#48e1eb" : "#333";
                entry.btn.style.color = on ? "#000" : "#fff";
            });
        };

        choices.forEach(function (choice) {

            const btn = makeButton(choice.label, "#333", "#fff", function () {
                set(choice.value);
                saveSettings();
                highlight();
            });

            buttons.push({ btn: btn, value: choice.value });
            row.appendChild(btn);
        });

        highlight();

        return row;
    }

    // Build a labeled minus / value / plus stepper backed by getter / setter
    function makeStepperRow(label, get, set, min, max, step) {

        const st = step || 1;

        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const name = document.createElement("span");
        name.textContent = label;

        const controls = document.createElement("div");
        controls.style.cssText = "display:flex;align-items:center;gap:8px;flex:0 0 auto";

        // A real input, so a value can be typed instead of stepped to. The
        // number type also brings up the numeric keypad on a phone
        const value = document.createElement("input");

        value.type = "number";
        value.style.font = INPUT_FONT;
        value.min = String(min);
        value.max = String(max);
        value.step = String(st);
        value.style.cssText = [
            "width:56px",
            "flex:0 0 auto",
            "text-align:center",
            "font-variant-numeric:tabular-nums",
            "padding:6px 4px",
            "border:1px solid #3a3a42",
            "border-radius:6px",
            "background:#26262c",
            "color:#fff",
            "font-size:13px"
        ].join(";");

        const render = function () {
            value.value = String(get());
        };

        // Apply what was typed, clamped to the allowed range. An empty or
        // unreadable field falls back to the value that was there before
        const commit = function () {

            const typed = parseFloat(value.value);

            if (!isFinite(typed)) {

                render();
                return;
            }

            set(Math.max(min, Math.min(max, typed)));
            saveSettings();
            render();
        };

        value.addEventListener("change", commit);
        value.addEventListener("blur", commit);

        // Enter applies straight away, and the site must not see the typing
        value.addEventListener("keydown", function (ev) {

            ev.stopPropagation();

            if (ev.key === "Enter") {

                ev.preventDefault();
                commit();
                value.blur();
            }
        });

        const minus = makeButton("-", "#333", "#fff", function () {
            set(Math.max(min, get() - st));
            saveSettings();
            render();
        });

        const plus = makeButton("+", "#333", "#fff", function () {
            set(Math.min(max, get() + st));
            saveSettings();
            render();
        });

        [minus, plus].forEach(function (b) {
            b.style.flex = "0 0 auto";
            b.style.minWidth = "40px";
            b.style.padding = "6px 0";
        });

        render();
        settingsRefreshers.push(render);

        controls.appendChild(minus);
        controls.appendChild(value);
        controls.appendChild(plus);

        row.appendChild(name);
        row.appendChild(controls);

        return row;
    }

    // Build the settings overlay once, it covers the panel until closed
    function buildSettings() {

        settingsEl = document.createElement("div");
        settingsEl.style.cssText = [
            "position:absolute",
            "inset:0",
            "background:#1d1d22",
            "border-radius:10px",
            "padding:12px",
            "box-sizing:border-box",
            "overflow:auto",
            "display:none",
            "flex-direction:column",
            "gap:12px"
        ].join(";");

        // Heading row with a Done button that closes the overlay
        const head = document.createElement("div");
        head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const heading = document.createElement("div");
        heading.textContent = "Settings";
        heading.style.cssText = "font-weight:600";

        const doneBtn = makeButton("Done", "#48e1eb", "#000", closeSettings);
        doneBtn.style.flex = "0 0 auto";
        doneBtn.style.padding = "6px 14px";

        head.appendChild(heading);
        head.appendChild(doneBtn);

        // Start feed section, which list the player opens on
        const startLabel = document.createElement("div");
        startLabel.textContent = "Start with";
        startLabel.style.cssText = "color:#bbb";

        const startRow = document.createElement("div");
        startRow.style.cssText = "display:flex;gap:6px";

        startPublishedBtn = makeButton("Published", "#333", "#fff", function () {
            settings.startFeed = "published";
            saveSettings();
            updateStartButtons();
        });

        startAllBtn = makeButton("All", "#333", "#fff", function () {
            settings.startFeed = "all";
            saveSettings();
            updateStartButtons();
        });

        startRow.appendChild(startPublishedBtn);
        startRow.appendChild(startAllBtn);

        // Refresh on open, one library so one flag
        const refreshLabel = document.createElement("div");
        refreshLabel.textContent = "Library";
        refreshLabel.style.cssText = "color:#bbb";

        const pubRow = makeBoolRow("Refresh on open",
            function () { return settings.refreshOnStart; },
            function (v) { settings.refreshOnStart = v; });

        const allRow = makeBoolRow("Number across the whole library",
            function () { return settings.absoluteNumbers; },
            function (v) { settings.absoluteNumbers = v; renderList(); });

        // Playback section, autoplay on open
        const playbackLabel = document.createElement("div");
        playbackLabel.textContent = "Playback";
        playbackLabel.style.cssText = "color:#bbb";

        const autoplayRow = makeBoolRow("Autoplay on start",
            function () { return settings.autoPlay; },
            function (v) { settings.autoPlay = v; });

        const reportRow = makeBoolRow("Report plays to Mureka",
            function () { return settings.reportPlays; },
            function (v) { settings.reportPlays = v; });

        const cacheRow = makeStepperRow("Cache ahead",
            function () { return settings.prefetchCount; },
            function (v) { settings.prefetchCount = v; },
            0, 50);

        // Now playing text shown on the lock screen and over Bluetooth
        const nowPlayingLabel = document.createElement("div");
        nowPlayingLabel.textContent = "Now Playing text";
        nowPlayingLabel.style.cssText = "color:#bbb";

        const titleTplRow = makeTextRow("Title line",
            function () { return settings.metaTitle; },
            function (v) { settings.metaTitle = v; },
            function (v) { return metaPreviewText(v); });

        const subtitleTplRow = makeTextRow("Second line",
            function () { return settings.metaSubtitle; },
            function (v) { settings.metaSubtitle = v; },
            function (v) { return metaPreviewText(v); });

        // Short reference for the available tags and the bracket rule
        const tplHint = document.createElement("div");
        tplHint.textContent = "Tags: ${title} ${genre} ${mood} ${bpm} ${model}"
            + " ${artist} ${duration} ${plays} ${likes} ${ctime} ${ptime} ${mode}"
            + " ${instrumental} ${stars}."
            + " Text in [ ] is dropped when a tag inside it is empty.";
        tplHint.style.cssText = "font-size:11px;color:#888;line-height:1.4";

        // Developer section, turn on debug tools and share raw API data
        const devLabel = document.createElement("div");
        devLabel.textContent = "Developer";
        devLabel.style.cssText = "color:#bbb";

        const debugRow = makeBoolRow("Debug mode",
            function () { return isDebug(); },
            function (v) { setDebug(v); });

        // A readout of what the browser reports while the panel is sized, for
        // chasing layout problems on a phone
        const debugLineRow = makeBoolRow("Debug line",
            function () { return settings.debugLine === true; },
            function (v) { settings.debugLine = v; updateDebugLine(); });

        const artTestRow = makeBoolRow("Artwork test button (blocks swipe)",
            function () { return settings.artTest; },
            function (v) { settings.artTest = v; updateTestButton(); });

        const copyFeedBtn = makeButton("Copy last feed JSON", "#333", "#fff", copyFeedJson);

        settingsEl.appendChild(head);
        settingsEl.appendChild(startLabel);
        settingsEl.appendChild(startRow);
        settingsEl.appendChild(refreshLabel);
        settingsEl.appendChild(pubRow);
        settingsEl.appendChild(allRow);
        settingsEl.appendChild(playbackLabel);
        settingsEl.appendChild(autoplayRow);
        settingsEl.appendChild(reportRow);
        settingsEl.appendChild(cacheRow);
        settingsEl.appendChild(nowPlayingLabel);
        settingsEl.appendChild(titleTplRow);
        settingsEl.appendChild(subtitleTplRow);
        settingsEl.appendChild(tplHint);

        // Three way art overlay mode, also cycled by double tapping the art
        const overlayLabels = { none: "None", info: "Info", all: "Info + lyrics" };

        const overlayRow = document.createElement("div");
        overlayRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const overlayName = document.createElement("span");
        overlayName.textContent = "Art overlays";

        const overlayBtnWrap = document.createElement("div");
        overlayBtnWrap.style.cssText = "flex:0 0 auto;min-width:110px;display:flex";

        const overlayBtn = makeButton(overlayLabels[settings.artOverlayMode], "#333", "#fff", function () {
            cycleOverlayMode();
            overlayBtn.textContent = overlayLabels[settings.artOverlayMode];
        });

        overlayBtnWrap.appendChild(overlayBtn);
        overlayRow.appendChild(overlayName);
        overlayRow.appendChild(overlayBtnWrap);

        const lyricSizeRow = makeStepperRow("Lyric size",
            function () { return settings.lyricSize; },
            function (v) { settings.lyricSize = v; applyLyricLayout(); }, 12, 30);

        const lyricSideRow = makeStepperRow("Side line percent",
            function () { return Math.round(settings.lyricSideMul * 100); },
            function (v) { settings.lyricSideMul = v / 100; applyLyricLayout(); }, 50, 100, 5);

        const lyricSpaceRow = makeStepperRow("Line spacing percent",
            function () { return Math.round(settings.lyricLineMul * 100); },
            function (v) { settings.lyricLineMul = v / 100; applyLyricLayout(); }, 100, 200, 5);

        const lyricShiftRow = makeStepperRow("Lyric position",
            function () { return settings.lyricShift; },
            function (v) { settings.lyricShift = v; applyLyricLayout(); }, -30, 30, 2);

        const lyricSideShiftRow = makeStepperRow("Side line offset",
            function () { return settings.lyricSideShift; },
            function (v) { settings.lyricSideShift = v; applyLyricLayout(); }, -20, 20, 1);

        const directRow = makeBoolRow("Stream direct URL",
            function () { return settings.directAudio; },
            function (v) { settings.directAudio = v; });

        const carBlackoutRow = makeBoolRow("Screen off overlay",
            function () { return settings.carBlackout; },
            function (v) { settings.carBlackout = v; resetIdleTimer(); refreshGate(); });

        const blackTextRow = makeTextRow("Screen off mark, blank for none",
            function () { return settings.blackoutText; },
            function (v) { settings.blackoutText = v; });

        const blackColorRow = makeColorRow("Screen off mark color",
            function () { return settings.blackoutColor; },
            function (v) { settings.blackoutColor = v; });

        const blackSizeRow = makeStepperRow("Screen off mark size",
            function () { return settings.blackoutSize; },
            function (v) { settings.blackoutSize = v; }, 12, 240, 4);

        const blackDriftRow = makeStepperRow("Mark moves every seconds",
            function () { return settings.blackoutDrift; },
            function (v) { settings.blackoutDrift = v; }, 5, 120, 5);

        const carGateRow = makeBoolRow("Start in fullscreen",
            function () { return settings.carGate; },
            function (v) {

                settings.carGate = v;
                refreshGate();

                // Turning it on where fullscreen is switched off in the browser
                // would do nothing at all, so say why
                if (v && !fullscreenSupported()) {
                    showFullscreenHelp();
                }
            });

        // Hidden only where there is no way to switch fullscreen on at all
        if (!fullscreenOffered()) {
            carGateRow.style.display = "none";
        }

        const blackResetRow = document.createElement("div");
        blackResetRow.style.cssText = "display:flex";

        blackResetRow.appendChild(makeButton("Reset mark to default", "#444", "#fff", function () {

            settings.blackoutText = "\u266B";
            settings.blackoutColor = "#333333";
            settings.blackoutSize = 64;
            saveSettings();

            // Put the fields back in step with what was just restored
            const textInput = blackTextRow.querySelector("input");
            const colorInput = blackColorRow.querySelector("input");
            const sizeInput = blackSizeRow.querySelector("input");

            if (textInput) {
                textInput.value = settings.blackoutText;
            }

            if (colorInput) {
                colorInput.value = settings.blackoutColor;
            }

            if (sizeInput) {
                sizeInput.value = String(settings.blackoutSize);
            }

            setStatus("Screen off mark reset");
        }));

        const carBlackRow = makeStepperRow("Screen off after seconds",
            function () { return settings.carAutoBlack; },
            function (v) { settings.carAutoBlack = v; resetIdleTimer(); }, 0, 300, 5);

        const artworkRow = makeBoolRow("Remote artwork URL",
            function () { return settings.remoteArtwork; },
            function (v) { settings.remoteArtwork = v; reassertNowPlaying(); });

        const controlLabelRow = makeBoolRow("Names under the buttons",
            function () { return settings.controlLabels; },
            function (v) { settings.controlLabels = v; updateControlLabels(); });

        const controlOrderRow = buildControlEditor();

        const artResumeRow = makeBoolRow("Resend art on resume",
            function () { return settings.artOnResume; },
            function (v) { settings.artOnResume = v; });

        const countsAgeRow = makeStepperRow("Counts max age in hours",
            function () { return settings.countsMaxAge; },
            function (v) { settings.countsMaxAge = v; }, 1, 72);

        const artStarsRow = makeBoolRow("Rating stars on the cover",
            function () { return settings.artStars; },
            function (v) {

                settings.artStars = v;
                refreshNowStars();
                updateLyricLine(true);
            });

        const waveRow = makeBoolRow("Waveform seek bar",
            function () { return settings.waveSeek; },
            function (v) { settings.waveSeek = v; updateSeekMode(); });

        settingsEl.appendChild(overlayRow);
        settingsEl.appendChild(lyricSizeRow);
        settingsEl.appendChild(lyricSideRow);
        settingsEl.appendChild(lyricSpaceRow);
        settingsEl.appendChild(lyricShiftRow);
        settingsEl.appendChild(lyricSideShiftRow);
        settingsEl.appendChild(directRow);
        settingsEl.appendChild(carBlackoutRow);
        settingsEl.appendChild(carGateRow);
        settingsEl.appendChild(carBlackRow);
        settingsEl.appendChild(blackTextRow);
        settingsEl.appendChild(blackColorRow);
        settingsEl.appendChild(blackSizeRow);
        settingsEl.appendChild(blackDriftRow);
        settingsEl.appendChild(blackResetRow);
        settingsEl.appendChild(artworkRow);
        settingsEl.appendChild(controlLabelRow);
        settingsEl.appendChild(controlOrderRow);
        settingsEl.appendChild(artResumeRow);
        settingsEl.appendChild(countsAgeRow);
        settingsEl.appendChild(waveRow);
        settingsEl.appendChild(artStarsRow);
        settingsEl.appendChild(devLabel);
        settingsEl.appendChild(debugRow);
        settingsEl.appendChild(debugLineRow);
        settingsEl.appendChild(artTestRow);
        settingsEl.appendChild(copyFeedBtn);

        panelEl.appendChild(settingsEl);

        updateStartButtons();
    }

    // Show the settings overlay, expanding the panel first if it is minimized
    function openSettings() {

        closeDropdowns();
        closePlaylists();
        closeCreators();
        closeInfo();

        if (minimized) {
            setMinimized(false);
        }

        if (settingsEl) {
            settingsOpen = true;

            // Re-read from storage first. Another copy of the player in the
            // same browser writes the same keys, and the rows were drawn when
            // the panel was built, which may be long out of date by now
            settings = loadSettings();

            settingsRefreshers.forEach(function (fn) {
                fn();
            });

            settingsEl.style.display = "flex";
        }

        // Refresh the template previews for the currently loaded song
        metaPreviewUpdaters.forEach(function (fn) {

            fn();
        });
    }

    // Hide the settings overlay
    function closeSettings() {

        if (settingsEl) {
            settingsOpen = false;
            endControlDrag();
            settingsEl.style.display = "none";
        }
    }

    // Build a copy glyph as SVG nodes, two overlapping rounded squares
    function makeCopyIcon() {

        return makeSvgIcon([
            ["rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }],
            ["path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }]
        ], 16);
    }

    // Build a check glyph as SVG nodes, shown briefly after a copy
    function makeCheckIcon() {

        return makeSvgIcon([
            ["polyline", { points: "20 6 9 17 4 12" }]
        ], 16);
    }

    // A small copy button that reads its text live at click time, so a block
    // filled in after the detail fetch still copies the right content
    function makeCopyButton(getText) {

        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = "Copy";
        btn.style.cssText = "flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:none;border-radius:6px;background:#333;color:#fff;cursor:pointer";
        btn.appendChild(makeCopyIcon());

        let timer = 0;

        btn.addEventListener("click", async function (ev) {

            ev.stopPropagation();

            const ok = await copyText(getText() || "");

            btn.textContent = "";
            btn.appendChild(ok ? makeCheckIcon() : makeCopyIcon());

            if (timer) {
                window.clearTimeout(timer);
            }

            // Revert the glyph after a moment so it is ready for the next copy
            timer = window.setTimeout(function () {
                btn.textContent = "";
                btn.appendChild(makeCopyIcon());
            }, 1200);
        });

        return btn;
    }

    // Format a unix timestamp in seconds as a compact local date and time
    function fmtDate(sec) {

        if (!sec) {
            return "-";
        }

        const d = new Date(sec * 1000);

        if (isNaN(d.getTime())) {
            return "-";
        }

        const p = function (n) {
            return (n < 10 ? "0" : "") + n;
        };

        return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
            + " " + p(d.getHours()) + ":" + p(d.getMinutes());
    }

    // Show a number when present, otherwise zero, used for the social counts
    function numOr(n) {

        return (typeof n === "number") ? String(n) : "0";
    }

    // Rebuild the timed lyrics array into plain readable text. Each segment
    // becomes its tag on a line, then one line per row, with a blank line
    // between segments. Segments with no rows, like Intro or Break, keep the tag
    function buildLyricsText(lyrics) {

        if (!Array.isArray(lyrics) || lyrics.length === 0) {
            return "";
        }

        const parts = [];

        lyrics.forEach(function (seg) {

            const lines = [];

            if (seg && seg.user_input_tag) {
                lines.push(seg.user_input_tag);
            }

            if (seg && Array.isArray(seg.rows)) {

                seg.rows.forEach(function (r) {

                    if (r && typeof r.text === "string") {
                        lines.push(r.text);
                    }
                });
            }

            if (lines.length > 0) {
                parts.push(lines.join("\n"));
            }
        });

        return parts.join("\n\n");
    }

    // Fetch the full detail object for a song, the song plus its social counts
    function fetchSongDetail(songId) {

        const url = "/api/pgc/song/detail?time=" + Date.now() + "&song_id=" + songId;

        return fetch(url, { credentials: "include" }).then(function (res) {

            if (!res.ok) {
                return null;
            }

            return res.json();

        }).then(function (json) {

            if (json && json.code === 0 && json.data) {
                return json.data;
            }

            return null;

        }).catch(function () {
            return null;
        });
    }

    // Build the information overlay once, it covers the panel until closed
    function buildInfo() {

        infoEl = document.createElement("div");
        infoEl.style.cssText = [
            "position:absolute",
            "inset:0",
            "background:#1d1d22",
            "border-radius:10px",
            "padding:12px",
            "box-sizing:border-box",
            "overflow:auto",
            "display:none",
            "flex-direction:column",
            "gap:10px"
        ].join(";");

        // Heading row with a Done button that closes the overlay
        const head = document.createElement("div");
        head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto";

        const heading = document.createElement("div");
        heading.textContent = "Information";
        heading.style.cssText = "font-weight:600";

        const doneBtn = makeButton("Done", "#48e1eb", "#000", closeInfo);
        doneBtn.style.flex = "0 0 auto";
        doneBtn.style.padding = "6px 14px";

        head.appendChild(heading);
        head.appendChild(doneBtn);

        // The whole overlay scrolls as one, so the body is a plain stack
        infoBodyEl = document.createElement("div");
        infoBodyEl.style.cssText = "display:flex;flex-direction:column;gap:10px";

        infoEl.appendChild(head);
        infoEl.appendChild(infoBodyEl);
        panelEl.appendChild(infoEl);
    }

    // One label and value line in the metadata block, returns the value node
    // so a count filled in after the detail fetch can update in place
    function addInfoRow(label, value) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:8px;align-items:baseline";

        const labelEl = document.createElement("span");
        labelEl.textContent = label;
        labelEl.style.cssText = "flex:0 0 88px;color:#888";

        const valueEl = document.createElement("span");
        valueEl.textContent = value;
        valueEl.style.cssText = "flex:1;min-width:0;color:#eee;word-break:break-word";

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        infoBodyEl.appendChild(row);

        return valueEl;
    }

    // A titled block with a copy button and a text body, used for the style
    // prompt and the lyrics. Returns the wrapper and a setter for the text
    function addCopyBlock(label, boxed) {

        const wrap = document.createElement("div");
        wrap.style.cssText = "display:flex;flex-direction:column;gap:6px;border-top:1px solid #333;padding-top:8px";

        const headRow = document.createElement("div");
        headRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const title = document.createElement("span");
        title.textContent = label;
        title.style.cssText = "color:#bbb;font-weight:600";

        const body = document.createElement("div");
        body.style.cssText = "white-space:pre-wrap;color:#eee;font:13px/1.5 sans-serif"
            + (boxed ? ";background:#26262c;border-radius:6px;padding:8px" : "");

        const copyBtn = makeCopyButton(function () {
            return body.textContent;
        });

        headRow.appendChild(title);
        headRow.appendChild(copyBtn);
        wrap.appendChild(headRow);
        wrap.appendChild(body);
        infoBodyEl.appendChild(wrap);

        return {
            wrap: wrap,
            set: function (text) {
                body.textContent = text;
            }
        };
    }

    // Open the information overlay for a song. The cached song gives genre,
    // mood, BPM, model, duration and dates at once, then the detail fetch fills
    // in the style prompt, the lyrics and the social counts
    async function openInfo(song) {

        closeDropdowns();
        closePlaylists();
        closeCreators();
        closeSettings();
        hideContextMenu();

        if (minimized) {
            setMinimized(false);
        }

        if (!infoEl || !infoBodyEl) {
            return;
        }

        const myToken = ++infoToken;

        infoBodyEl.textContent = "";
        infoBodyEl.scrollTop = 0;

        // Header, cover thumbnail beside the title
        const header = document.createElement("div");
        header.style.cssText = "display:flex;gap:10px;align-items:center";

        const cover = coverUrl(song);

        if (cover) {

            const img = document.createElement("img");
            img.src = cover;
            img.style.cssText = "width:56px;height:56px;flex:0 0 auto;border-radius:6px;object-fit:cover;background:#000";
            header.appendChild(img);
        }

        const titleEl = document.createElement("div");
        titleEl.textContent = song.title || "Untitled";
        titleEl.style.cssText = "font-weight:600;font-size:15px;word-break:break-word";
        header.appendChild(titleEl);
        infoBodyEl.appendChild(header);

        // Metadata available straight from the cached song
        addInfoRow("Genre", (song.genres || []).join(", ") || "-");
        addInfoRow("Mood", (song.moods || []).join(", ") || "-");
        const shownBpm = effectiveBpm(song);

        addInfoRow("BPM", shownBpm > 0
            ? String(shownBpm) + (hasManualBpm(song) ? " (by hand)" : "")
            : "-");
        addInfoRow("Model", song.model || "-");
        addInfoRow("Rating", ratingText(getRating(song)));
        addInfoRow("Duration", formatTime((song.duration_milliseconds || 0) / 1000));

        // Counts arrive with the detail fetch, start as a placeholder
        const playsEl = addInfoRow("Plays", "...");
        const likesEl = addInfoRow("Likes", "...");
        const sharesEl = addInfoRow("Shares", "...");
        const commentsEl = addInfoRow("Comments", "...");

        addInfoRow("Created", fmtDate(song.generate_at));
        addInfoRow("Published", song.publish_at ? fmtDate(song.publish_at) : "-");
        addInfoRow("Song ID", String(song.song_id));

        // Style prompt and lyrics come from the detail fetch
        const promptBlock = addCopyBlock("Style prompt", false);
        promptBlock.set("...");

        const lyricsBlock = addCopyBlock("Lyrics", true);
        lyricsBlock.wrap.style.display = "none";

        infoEl.style.display = "flex";

        const data = await fetchSongDetail(song.song_id);

        // The overlay was closed or another song opened while fetching
        if (myToken !== infoToken) {
            return;
        }

        if (!data) {
            promptBlock.set("Could not load details");
            playsEl.textContent = "-";
            likesEl.textContent = "-";
            sharesEl.textContent = "-";
            commentsEl.textContent = "-";
            return;
        }

        const detail = data.song || {};

        playsEl.textContent = numOr(data.play_count);
        likesEl.textContent = numOr(data.fav_count);
        sharesEl.textContent = numOr(data.share_count);
        commentsEl.textContent = numOr(data.comment_count);

        const prompt = detail.description || "";

        if (prompt) {
            promptBlock.set(prompt);
        } else {
            promptBlock.wrap.style.display = "none";
        }

        const lyricsText = buildLyricsText(detail.lyrics);

        if (lyricsText) {
            lyricsBlock.set(lyricsText);
            lyricsBlock.wrap.style.display = "";
        }
    }

    // Hide the information overlay and void any in flight detail fetch
    function closeInfo() {

        infoToken += 1;

        if (infoEl) {
            infoEl.style.display = "none";
        }
    }

    // Build the playlists overlay once, it covers the panel until closed
    function buildPlaylists() {

        playlistsEl = document.createElement("div");
        playlistsEl.style.cssText = [
            "position:absolute",
            "inset:0",
            "background:#1d1d22",
            "border-radius:10px",
            "padding:12px",
            "box-sizing:border-box",
            "overflow:auto",
            "display:none",
            "flex-direction:column",
            "gap:10px"
        ].join(";");

        // Heading row with a Done button that closes the overlay
        const head = document.createElement("div");
        head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const heading = document.createElement("div");
        heading.textContent = "Playlists";
        heading.style.cssText = "font-weight:600";

        const doneBtn = makeButton("Done", "#48e1eb", "#000", closePlaylists);
        doneBtn.style.flex = "0 0 auto";
        doneBtn.style.padding = "6px 14px";

        head.appendChild(heading);
        head.appendChild(doneBtn);

        // All songs entry clears the active playlist and shows the whole library
        const allBtn = makeButton("All songs", "#333", "#fff", clearPlaylist);
        allBtn.style.textAlign = "left";

        // Container that the playlist rows are rendered into
        playlistsListEl = document.createElement("div");
        playlistsListEl.style.cssText = "display:flex;flex-direction:column;gap:6px";

        playlistsEl.appendChild(head);
        playlistsEl.appendChild(allBtn);
        playlistsEl.appendChild(playlistsListEl);

        panelEl.appendChild(playlistsEl);
    }

    // Show the playlists overlay, loading the list the first time it opens
    function openPlaylists() {

        closeDropdowns();
        closeSettings();
        closeCreators();
        closeInfo();

        if (minimized) {
            setMinimized(false);
        }

        if (playlistsEl) {
            playlistsEl.style.display = "flex";
        }

        if (playlists.length === 0 && !playlistsLoading) {
            loadPlaylists();
        }
    }

    // Hide the playlists overlay
    function closePlaylists() {

        if (playlistsEl) {
            playlistsEl.style.display = "none";
        }
    }

    // Fetch the user playlists, following pagination, keeping only own lists
    // Each playlist carries its song_ids inline, so no detail call is needed
    async function loadPlaylists() {

        playlistsLoading = true;
        renderPlaylists();

        const collected = [];
        let lastId = null;
        let guard = 0;

        try {

            while (guard < 50) {

                guard += 1;

                let url = "/api/pgc/playlists?time=" + Date.now() + "&size=24&sort_type=2";

                if (lastId) {
                    url += "&last_id=" + lastId;
                }

                const res = await timedFetch(url, { credentials: "include" });
                const json = await res.json();

                if (!json || json.code !== 0 || !json.data) {
                    break;
                }

                const list = json.data.list || [];

                list.forEach(function (p) {

                    // Followed lists from other users carry a parent_id, skip them
                    if (p.parent_id) {
                        return;
                    }

                    collected.push({
                        playlist_id: p.playlist_id,
                        name: p.name || "Untitled",
                        song_count: p.song_count || (p.song_ids ? p.song_ids.length : 0),
                        ids: new Set(p.song_ids || [])
                    });
                });

                lastId = json.data.last_id;

                // Stop when the page was not full or there is no cursor to follow
                if (!lastId || list.length < 24) {
                    break;
                }
            }

            playlists = collected;
        } catch (e) {
            playlists = collected;
        }

        playlistsLoading = false;
        renderPlaylists();
    }

    // Render the playlist rows, or a loading or empty message
    function renderPlaylists() {

        if (!playlistsListEl) {
            return;
        }

        playlistsListEl.textContent = "";

        if (playlistsLoading) {

            const msg = document.createElement("div");
            msg.textContent = "Loading playlists...";
            msg.style.cssText = "color:#888;padding:4px 2px";
            playlistsListEl.appendChild(msg);
            return;
        }

        if (playlists.length === 0) {

            const msg = document.createElement("div");
            msg.textContent = "No playlists found";
            msg.style.cssText = "color:#888;padding:4px 2px";
            playlistsListEl.appendChild(msg);
            return;
        }

        playlists.forEach(function (pl) {

            const active = activePlaylist && activePlaylist.playlist_id === pl.playlist_id;
            const bg = active ? "#48e1eb" : "#333";
            const fg = active ? "#000" : "#fff";

            const btn = makeButton(pl.name + "  (" + pl.song_count + ")", bg, fg, function () {
                selectPlaylist(pl);
            });

            btn.style.textAlign = "left";
            playlistsListEl.appendChild(btn);
        });
    }

    // Select a playlist as the active filter, then refresh the list and queue
    function selectPlaylist(pl) {

        activePlaylist = { playlist_id: pl.playlist_id, name: pl.name, ids: pl.ids };

        updatePlaylistButton();
        rebuildUpcoming();
        renderList();
        renderPlaylists();
        closePlaylists();
    }

    // Clear the active playlist so the whole library shows again
    function clearPlaylist() {

        activePlaylist = null;

        updatePlaylistButton();
        rebuildUpcoming();
        renderList();
        renderPlaylists();
        closePlaylists();
    }

    // Tint the Playlists button while a playlist filter is active
    function updatePlaylistButton() {

        if (!playlistButton) {
            return;
        }

        const active = activePlaylist !== null;

        playlistButton.style.background = active ? "#48e1eb" : "#444";
        playlistButton.style.color = active ? "#000" : "#fff";
    }

    // Tint the Creators button while another creator library is being browsed
    function updateCreatorButton() {

        if (!creatorButton) {
            return;
        }

        const active = creatorSource !== null;

        creatorButton.style.background = active ? "#48e1eb" : "#444";
        creatorButton.style.color = active ? "#000" : "#fff";

        // The published toggle greys out while a creator is being browsed
        updateFeedButton();
    }

    // Browse another creator published songs, each creator keeps its own cache
    // This mirrors switchFeed, swapping the cache and reloading from scratch
    // Selecting your own profile shows your existing library, not a new cache
    async function selectCreator(userId, name) {

        // Resolve who you are so picking yourself maps to your own library
        if (selfUserId === null) {
            await ensureSelfUserId();
        }

        if (selfUserId !== null && String(userId) === String(selfUserId)) {
            selectOwnLibrary();
            return;
        }

        // Cancel any load in progress so it cannot write into the new cache
        if (running) {
            running = false;
            updateButton();
        }

        loadToken += 1;

        creatorSource = { user_id: String(userId), stage_name: name || ("User " + userId) };

        // The wave scan cursor belongs to the previous feed, start over
        waveScanCursor = null;
        waveScanDone = false;

        // Your own playlists do not apply to a creator, so drop the filter
        activePlaylist = null;
        updatePlaylistButton();

        cache = loadCache();
        cachedIds = new Set();

        updateCreatorButton();
        updateFeedButton();
        renderList();
        refreshCachedIds();
        closeCreators();
        closeDropdowns();

        const n = cache.songs.length;

        setStatus("Browsing " + creatorSource.stage_name + ", " + n + " cached song"
            + (n === 1 ? "" : "s")
            + (n === 0 ? ", loading..." : ""));

        saveSource();

        // The logged out banner is about your own feed, not a creator
        setAuthWarn(false);

        // Pull the catalogue the first time this creator is opened
        if (cache.songs.length === 0 || cache.complete !== true) {
            run();
        }
    }

    // Leave creator mode and show your own published library as usual
    // Your creator profile and your published feed are the same songs
    function selectOwnLibrary() {

        if (running) {
            running = false;
            updateButton();
        }

        loadToken += 1;

        creatorSource = null;
        publishFilter = "published";

        cache = loadCache();
        cachedIds = new Set();

        updateCreatorButton();
        updateFeedButton();
        renderList();
        refreshCachedIds();
        closeCreators();
        closeDropdowns();

        const n = cache.songs.length;

        setStatus(feed().label + " feed, " + n + " cached song"
            + (n === 1 ? "" : "s")
            + (n === 0 ? ", loading..." : ""));

        saveSource();

        // Back on your own feed, re-check login state for the banner
        refreshAuthBanner();

        // Populate your library if it has not been loaded yet
        if (cache.songs.length === 0 || cache.complete !== true) {
            run();
        }
    }

    // Leave creator mode and return to your own current feed
    function clearCreator() {

        if (!creatorSource) {
            closeCreators();
            return;
        }

        if (running) {
            running = false;
            updateButton();
        }

        loadToken += 1;

        creatorSource = null;

        cache = loadCache();
        cachedIds = new Set();

        updateCreatorButton();
        updateFeedButton();
        renderList();
        refreshCachedIds();
        closeCreators();

        const n = cache.songs.length;

        setStatus(feed().label + " feed, " + n + " cached song" + (n === 1 ? "" : "s"));

        saveSource();

        // Back on your own feed, re-check login state for the banner
        refreshAuthBanner();
    }

    // Build the creators overlay once, it covers the panel until closed
    function buildCreators() {

        creatorsEl = document.createElement("div");
        creatorsEl.style.cssText = [
            "position:absolute",
            "inset:0",
            "background:#1d1d22",
            "border-radius:10px",
            "padding:12px",
            "box-sizing:border-box",
            "overflow:auto",
            "display:none",
            "flex-direction:column",
            "gap:10px"
        ].join(";");

        // Heading row with a Done button that closes the overlay
        const head = document.createElement("div");
        head.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const heading = document.createElement("div");
        heading.textContent = "Creators";
        heading.style.cssText = "font-weight:600";

        const doneBtn = makeButton("Done", "#48e1eb", "#000", closeCreators);
        doneBtn.style.flex = "0 0 auto";
        doneBtn.style.padding = "6px 14px";

        head.appendChild(heading);
        head.appendChild(doneBtn);

        // My library entry leaves creator mode and shows your own songs again
        const mineBtn = makeButton("My library", "#333", "#fff", clearCreator);
        mineBtn.style.textAlign = "left";

        // Search and add row, typing filters the list, an id or link can be added
        const addRow = document.createElement("div");
        addRow.style.cssText = "display:flex;gap:6px";

        creatorsInputEl = document.createElement("input");
        creatorsInputEl.type = "text";
        creatorsInputEl.style.font = INPUT_FONT;
        creatorsInputEl.placeholder = "Search creators, or paste an id / link";
        creatorsInputEl.style.cssText = [
            "flex:1",
            "min-width:0",
            "padding:7px 8px",
            "border:1px solid #3a3a42",
            "border-radius:6px",
            "background:#26262c",
            "color:#fff",
            "box-sizing:border-box"
        ].join(";");

        // Typing filters the rows by name, no request is made
        creatorsInputEl.addEventListener("input", function () {
            creatorQuery = creatorsInputEl.value.trim().toLowerCase();
            renderCreators();
        });

        // Enter only fetches by id when the text looks like an id or a link
        creatorsInputEl.addEventListener("keydown", function (ev) {

            if (ev.key === "Enter" && looksLikeCreatorId(creatorsInputEl.value)) {
                ev.preventDefault();
                addCreatorFromInput(creatorsInputEl.value);
            }
        });

        const addBtn = makeButton("Add", "#444", "#fff", function () {
            addCreatorFromInput(creatorsInputEl.value);
        });

        addBtn.style.flex = "0 0 auto";
        addBtn.style.padding = "7px 14px";
        addBtn.title = "Fetch a creator by numeric id or profile link";

        addRow.appendChild(creatorsInputEl);
        addRow.appendChild(addBtn);

        // Container that the creator rows are rendered into
        creatorsListEl = document.createElement("div");
        creatorsListEl.style.cssText = "display:flex;flex-direction:column;gap:6px";

        creatorsEl.appendChild(head);
        creatorsEl.appendChild(mineBtn);
        creatorsEl.appendChild(addRow);
        creatorsEl.appendChild(creatorsListEl);

        panelEl.appendChild(creatorsEl);
    }

    // Show the creators overlay, loading who you follow the first time it opens
    function openCreators() {

        closeDropdowns();
        closeSettings();
        closePlaylists();
        closeInfo();

        if (minimized) {
            setMinimized(false);
        }

        if (creatorsEl) {
            creatorsEl.style.display = "flex";
        }

        renderCreators();

        // Load the discoverable pool once, featured creators need no self id
        if (followedCreators.length === 0 && !creatorsLoading) {
            loadCreators();
        }
    }

    // Hide the creators overlay
    function closeCreators() {

        if (creatorsEl) {
            creatorsEl.style.display = "none";
        }
    }

    // Whether typed text looks like a creator id or a link carrying one
    function looksLikeCreatorId(value) {

        const v = (value || "").trim();

        return /^\d+$/.test(v) || /\d{6,}/.test(v);
    }

    // Page through a users endpoint, handing each user to a collector
    // Handles both the time based follow lists and the featured creators module
    async function collectCreatorUsers(baseUrl, addUser) {

        let lastId = null;
        let guard = 0;

        while (guard < 10) {

            guard += 1;

            let url = baseUrl + (baseUrl.indexOf("?") === -1 ? "?" : "&") + "time=" + Date.now();

            if (lastId) {
                url += "&last_id=" + lastId;
            }

            const res = await timedFetch(url, { credentials: "include" });
            const json = await res.json();

            if (!json || json.code !== 0 || !json.data) {
                break;
            }

            const users = json.data.users || [];

            users.forEach(addUser);

            const next = json.data.last_id;
            const more = json.data.has_more;

            // Stop at the end, when the cursor stalls, on an empty page, or
            // when the endpoint says there are no more results
            if (users.length === 0 || !next || next === lastId || more === false) {
                break;
            }

            lastId = next;
        }
    }

    // Build the discoverable creator pool for the picker search
    // Featured creators need no self id, the follow lists need it
    async function loadCreators() {

        creatorsLoading = true;
        renderCreators();

        // Resolve who you are so the follow lists below can be requested
        if (selfUserId === null) {
            await ensureSelfUserId();
        }

        const byId = new Map();

        const addUser = function (u) {

            if (!u || u.user_id === undefined || u.user_id === null) {
                return;
            }

            const id = String(u.user_id);

            if (!byId.has(id)) {
                byId.set(id, { user_id: id, stage_name: u.stage_name || ("User " + id) });
            }
        };

        try {

            // Featured creators are available without knowing who you are
            await collectCreatorUsers("/api/pgc/home/modules/featured-users?module_id=6&page_size=50", addUser);

            // The follow lists round out the pool once the self id is known
            if (selfUserId !== null) {
                await collectCreatorUsers("/api/user/followings?user_id=" + selfUserId, addUser);
                await collectCreatorUsers("/api/user/followers?user_id=" + selfUserId, addUser);
            }

        } catch (e) {
        }

        // Sort by name so the filtered list reads alphabetically
        followedCreators = Array.from(byId.values()).sort(function (a, b) {
            return a.stage_name.toLowerCase().localeCompare(b.stage_name.toLowerCase());
        });

        creatorsLoading = false;
        renderCreators();
    }

    // Render the saved and followed creator rows, or a loading or empty message
    function renderCreators() {

        if (!creatorsListEl) {
            return;
        }

        creatorsListEl.textContent = "";

        const q = creatorQuery;

        // A row matches when its name contains the query, empty query shows all
        const match = function (c) {
            return !q || (c.stage_name || "").toLowerCase().indexOf(q) !== -1;
        };

        // Saved creators come first, each with its own remove control
        const savedShown = savedCreators.filter(match);

        savedShown.forEach(function (c) {

            creatorsListEl.appendChild(buildCreatorRow(c, true));
        });

        // Pooled creators next, skipping any already in the saved list
        const savedIds = new Set(savedCreators.map(function (c) {
            return String(c.user_id);
        }));

        const followed = followedCreators.filter(function (c) {
            return !savedIds.has(String(c.user_id)) && match(c);
        });

        if (creatorsLoading) {

            const msg = document.createElement("div");
            msg.textContent = "Loading creators...";
            msg.style.cssText = "color:#888;padding:4px 2px";
            creatorsListEl.appendChild(msg);
        }

        followed.forEach(function (c) {

            creatorsListEl.appendChild(buildCreatorRow(c, false));
        });

        // Guidance when nothing matches or nothing has loaded yet
        if (!creatorsLoading && savedShown.length === 0 && followed.length === 0) {

            const msg = document.createElement("div");
            msg.style.cssText = "color:#888;padding:4px 2px;line-height:1.5";

            if (q) {
                msg.textContent = "No matching creators in your follows, followers"
                    + " or featured. Paste the creator id or a profile link, then Add.";
            } else if (selfUserId === null) {
                msg.textContent = "Press Load on your own library once so people you"
                    + " follow appear here, or add a creator by id above.";
            } else {
                msg.textContent = "No creators found. Add one by id or profile link above.";
            }

            creatorsListEl.appendChild(msg);
        }
    }

    // Build one creator row, a select button plus an optional remove control
    function buildCreatorRow(creator, removable) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:6px;align-items:stretch";

        const active = creatorSource && String(creatorSource.user_id) === String(creator.user_id);
        const bg = active ? "#48e1eb" : "#333";
        const fg = active ? "#000" : "#fff";

        const selectBtn = makeButton(creator.stage_name, bg, fg, function () {
            selectCreator(creator.user_id, creator.stage_name);
        });

        selectBtn.style.textAlign = "left";
        row.appendChild(selectBtn);

        if (removable) {

            const removeBtn = makeButton("\u2715", "#444", "#fff", function () {
                removeSavedCreator(creator.user_id);
                renderCreators();
            });

            removeBtn.style.flex = "0 0 auto";
            removeBtn.style.padding = "7px 12px";
            removeBtn.title = "Remove from saved creators";
            row.appendChild(removeBtn);
        }

        return row;
    }

    // Resolve a typed creator id or profile link, then save and open it
    async function addCreatorFromInput(value) {

        const raw = (value || "").trim();

        if (!raw) {
            return;
        }

        let id = null;

        if (/^\d+$/.test(raw)) {
            id = raw;
        } else {

            // Pull a long run of digits out of a pasted profile link
            const m = raw.match(/(\d{6,})/);

            if (m) {
                id = m[1];
            }
        }

        if (!id) {
            setStatus("Enter a numeric creator id or a profile link with an id");
            return;
        }

        // Pasting your own id should open your library, not save you as a creator
        if (selfUserId === null) {
            await ensureSelfUserId();
        }

        if (selfUserId !== null && String(id) === String(selfUserId)) {

            if (creatorsInputEl) {
                creatorsInputEl.value = "";
            }

            creatorQuery = "";
            selectOwnLibrary();
            return;
        }

        // Resolve the stage name from the public profile, falling back to the id
        let name = "User " + id;

        try {

            const url = "/api/pgc/personal/profile?time=" + Date.now() + "&user_id=" + id;
            const res = await timedFetch(url, { credentials: "include" });
            const json = await res.json();

            if (json && json.code === 0 && json.data && json.data.user) {
                name = json.data.user.stage_name || name;
            }
        } catch (e) {
        }

        if (creatorsInputEl) {
            creatorsInputEl.value = "";
        }

        addSavedCreator(id, name);
        renderCreators();
        selectCreator(id, name);
    }

    // Whether developer only features are enabled
    // Toggle with localStorage.setItem("mureka_player_debug", "1")
    function isDebug() {

        try {
            return localStorage.getItem(DEBUG_KEY) === "1";
        } catch (e) {
            return false;
        }
    }

    // Whether this is a desktop style device with a precise pointer
    function isDesktop() {

        try {
            return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        } catch (e) {
            return false;
        }
    }

    // Copy a string to the clipboard, with a fallback for older browsers
    async function copyText(text) {

        try {

            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) {
        }

        // Fallback, an off screen textarea and execCommand
        try {
            const area = document.createElement("textarea");

            area.value = text;
            area.style.position = "fixed";
            area.style.top = "-1000px";
            area.style.left = "-1000px";
            document.body.appendChild(area);
            area.focus();
            area.select();

            const ok = document.execCommand("copy");

            area.remove();

            return ok;
        } catch (e) {
            return false;
        }
    }

    // Enable or disable developer only features from the settings toggle
    function setDebug(on) {

        try {

            if (on) {
                localStorage.setItem(DEBUG_KEY, "1");
            } else {
                localStorage.removeItem(DEBUG_KEY);
            }
        } catch (e) {
        }
    }

    // JSON.stringify replacer that drops the huge wave_list field at any depth
    // The waveform data is large and not useful when sharing a response
    function dropWaveList(key, value) {

        if (key === "wave_list") {
            return undefined;
        }

        return value;
    }

    // Copy the last raw feed response to the clipboard, without the wave lists
    // Developer only helper, the feed list is the JSON most useful to share
    async function copyFeedJson() {

        if (!lastFeedResponse) {
            setStatus("No feed response yet, press Load first");
            return;
        }

        const ok = await copyText(JSON.stringify(lastFeedResponse, dropWaveList, 2));

        setStatus(ok
            ? "Copied the last feed response to the clipboard"
            : "Could not copy to clipboard");
    }

    // Fetch the full untrimmed song object and copy it to the clipboard
    // Developer only helper for inspecting the raw API fields, including lyrics
    async function copyJson(song) {

        setStatus("Fetching JSON: " + (song.title || "Untitled"));

        let payload = song;

        try {
            const url = "/api/pgc/song/detail?time=" + Date.now() + "&song_id=" + song.song_id;
            const res = await timedFetch(url, { credentials: "include" });

            if (res.ok) {

                const json = await res.json();
                const data = json && json.data;
                const fresh = data && data.song;

                // Prefer the whole data object, it carries the song plus the
                // play, favorite and share counts and the user block beside it
                if (fresh && fresh.song_id === song.song_id) {
                    payload = data;
                }
            }
        } catch (e) {
        }

        const ok = await copyText(JSON.stringify(payload, dropWaveList, 2));

        setStatus(ok
            ? "Copied JSON to clipboard: " + (song.title || "Untitled")
            : "Could not copy to clipboard");
    }

    // Build the share link for a song and copy it to the clipboard
    // The link is the public song detail page keyed by the song share key
    async function copyLink(song) {

        let key = song.share_key;

        // Older cached songs may predate the share key being stored, fetch it
        if (!key) {

            try {
                const url = "/api/pgc/song/detail?time=" + Date.now() + "&song_id=" + song.song_id;
                const res = await timedFetch(url, { credentials: "include" });

                if (res.ok) {

                    const json = await res.json();
                    const fresh = json && json.data && json.data.song;

                    if (fresh && fresh.share_key) {
                        key = fresh.share_key;

                        // Persist it so the next copy needs no fetch
                        const idx = cache.songs.findIndex(function (s) {
                            return s.song_id === song.song_id;
                        });

                        if (idx !== -1) {
                            cache.songs[idx].share_key = key;
                            saveCache();
                        }
                    }
                }
            } catch (e) {
            }
        }

        if (!key) {
            setStatus("No link for this song");
            return;
        }

        const link = "https://www.mureka.ai/song-detail/" + key;
        const ok = await copyText(link);

        setStatus(ok
            ? "Copied link: " + (song.title || "Untitled")
            : "Could not copy to clipboard");
    }

    // Build the reusable right-click options popup once
    function buildContextMenu() {

        contextMenuEl = document.createElement("div");
        contextMenuEl.style.cssText = [
            "position:fixed",
            "z-index:1000000",
            "background:#26262c",
            "color:#fff",
            "font:13px/1.4 sans-serif",
            "border:1px solid #3a3a42",
            "border-radius:8px",
            "box-shadow:0 6px 20px rgba(0,0,0,0.5)",
            "padding:4px",
            "min-width:150px",
            "display:none"
        ].join(";");

        document.body.appendChild(contextMenuEl);

        // A click anywhere else closes the menu
        document.addEventListener("click", hideContextMenu);

        // Scrolling closes it so it does not float detached from its row
        window.addEventListener("scroll", hideContextMenu, true);
    }

    // Hide the right-click options popup
    function hideContextMenu() {

        if (contextMenuEl) {
            contextMenuEl.style.display = "none";
        }
    }

    // Add one clickable row to the options popup
    // A row that states something rather than offering an action. Greyed and
    // inert, so it reads as information and cannot be tapped by mistake
    function addDisabledMenuRow(label) {

        const row = document.createElement("div");

        row.textContent = label;
        row.style.cssText = "padding:7px 10px;border-radius:6px;color:#777;cursor:default";

        row.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });

        contextMenuEl.appendChild(row);
    }

    function addMenuRow(label, color, handler) {

        const row = document.createElement("div");

        row.textContent = label;
        row.style.cssText = "padding:7px 10px;border-radius:6px;cursor:pointer;color:" + color;

        row.addEventListener("mouseenter", function () {
            row.style.background = "#36363e";
        });

        row.addEventListener("mouseleave", function () {
            row.style.background = "transparent";
        });

        row.addEventListener("click", function (ev) {
            ev.stopPropagation();
            hideContextMenu();
            handler();
        });

        contextMenuEl.appendChild(row);
    }

    // Show the options popup for a song at the given screen position
    function showContextMenu(x, y, song) {

        if (!contextMenuEl) {
            return;
        }

        contextMenuEl.textContent = "";

        const cached = cachedIds.has(song.song_id);

        addMenuRow("Play", "#fff", function () {
            playFrom(song.song_id);
        });

        addMenuRow("Play next", "#fff", function () {
            addNext(song);
        });

        addMenuRow("Refresh", "#fff", function () {
            refreshOne(song);
        });

        addMenuRow("Download", "#fff", function () {
            downloadOne(song);
        });

        addMenuRow("Copy link", "#fff", function () {
            copyLink(song);
        });

        addMenuRow("Information", "#fff", function () {
            openInfo(song);
        });

        // A song the server already reports as instrumental cannot be marked
        // by hand, the mark exists only for songs whose lyrics field holds
        // prompt instructions rather than words that are sung
        if (song.generation_method === 7) {

            addDisabledMenuRow("Instrumental");

        } else {

            addMenuRow(isManualInstrumental(song) ? "Not instrumental" : "Mark instrumental",
                "#fff", function () {
                    toggleManualInstrumental(song);
                });
        }

        if (hasManualBpm(song) || !(Number(song.bpm) > 0)) {

            addMenuRow("Set BPM", "#fff", function () {
                promptManualBpm(song);
            });
        }

        if (cached) {

            addMenuRow("Remove from cache", "#ff8a8a", function () {
                removeOne(song);
            });

        } else {

            addMenuRow("Cache", "#48e1eb", function () {
                cacheOne(song);
            });
        }

        // Supplying a tempo by hand, for songs the server left without one, and
        // taking it away again. Only offered where it would do something, a
        // song that already has a real bpm is left alone
        addMenuRow("Delete from list", "#ff8a8a", function () {
            deleteOne(song);
        });

        // Developer only, copy the full song JSON to the clipboard
        // Available on the bookmarklet too, where there is no console
        if (isDebug()) {

            addMenuRow("Copy JSON", "#ffd479", function () {
                copyJson(song);
            });
        }

        // Star rating along the foot of the menu, wider than the rows above so
        // every star is a comfortable target
        const rateBar = makeStarBar(function () {
            return song;
        }, { size: 30, pad: 6, caption: true });

        rateBar.el.style.borderTop = "1px solid #3a3a42";
        rateBar.el.style.marginTop = "4px";
        rateBar.el.style.padding = "8px 4px 6px";
        rateBar.el.style.minWidth = Math.min(260, window.innerWidth - 24) + "px";

        contextMenuEl.appendChild(rateBar.el);

        // Show first so the size is measurable, then clamp inside the viewport
        contextMenuEl.style.display = "block";

        const w = contextMenuEl.offsetWidth;
        const h = contextMenuEl.offsetHeight;
        const left = Math.min(x, window.innerWidth - w - 8);
        const top = Math.min(y, window.innerHeight - h - 8);

        contextMenuEl.style.left = Math.max(8, left) + "px";
        contextMenuEl.style.top = Math.max(8, top) + "px";
    }

    // Expose a toggle so a second bookmarklet tap minimizes or restores the panel
    window.__murekaPlayerToggle = toggleMinimize;

    // The bookmarklet runs after load, so build now, otherwise wait for the body
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildPanel);
    } else {
        buildPanel();
    }
})();
