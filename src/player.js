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
    const VERSION = "1.3.5y";

    // The two feeds this player can load
    // published returns only your published songs
    // all returns every song you made, including drafts and unpublished ones
    const FEEDS = {
        published: {
            label: "Published",
            queryType: "publishedmysong",
            endpoint: "/api/pgc/feed/list/search",
            t: "3",
            cacheKey: "mureka_autoload_publishedmysong"
        },
        all: {
            label: "All",
            queryType: "mysong",
            endpoint: "/api/pgc/feed/list",
            t: "1",
            cacheKey: "mureka_autoload_mysong"
        }
    };

    // Which feed is active, published by default
    let feedMode = "published";

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

        return FEEDS[feedMode];
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

    // Default number of upcoming songs to cache ahead, now also a user setting
    const PREFETCH_DEFAULT = 3;

    // Album art coverflow, the center cover takes this fraction of the width and
    // the previous and next covers peek in on the sides. Lower shows more of the
    // neighbors, 0.5 shows exactly half of each
    const ART_CENTER_FRACTION = 0.6;

    // Strongest blur on a side cover at its furthest from center, in pixels
    const ART_SIDE_BLUR = 3;

    // How many covers to keep ready on each side, two lets a swipe pull the next
    // one in from beyond the edge
    const ART_SIDE_TILES = 2;

    // localStorage key that remembers whether the panel is minimized
    const MINIMIZED_KEY = "mureka_player_minimized";

    // localStorage key that remembers the panel position
    const POS_KEY = "mureka_player_pos";

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
    feedMode = (startupSource && startupSource.kind === "feed")
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

    // Direction aware scroll button state
    let toTopDir = "up";
    let toTopTimer = 0;
    let lastListScroll = 0;
    let programmaticScrollAt = 0;
    let loadButton = null;
    let feedButton = null;
    let cacheButton = null;
    let downloadButton = null;

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
    let playerCountsEl = null;
    let seekBar = null;
    let curTimeEl = null;
    let remTimeEl = null;
    let playPauseBtn = null;
    let shuffleBtn = null;
    let repeatBtn = null;

    // True while the user is dragging the seek bar, so timeupdate does not fight it
    let isSeeking = false;

    // Album art coverflow and swipe state
    // artTiles is the row of cover images, the middle one is the current song
    let artTiles = [];
    let swipeActive = false;
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeDir = 0;
    let currentSwipeOffset = 0;

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

                return parsed;
            }
        } catch (e) {
        }

        return { songs: [], updated: 0, complete: false, lastCursor: null };
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
            refreshOnStart: { published: false, all: false },
            autoPlay: false,
            shuffle: false,
            repeat: "all",
            prefetchCount: PREFETCH_DEFAULT,
            vocalFilter: "all",
            view: "mureka",
            reportPlays: true,
            artTest: false,
            metaTitle: "${title}",
            metaSubtitle: "${genre}"
        };

        try {
            const raw = localStorage.getItem(SETTINGS_KEY);

            if (raw) {

                const parsed = JSON.parse(raw);
                const ros = parsed.refreshOnStart || {};
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
                    refreshOnStart: {
                        published: ros.published === true,
                        all: ros.all === true
                    },
                    autoPlay: parsed.autoPlay === true,
                    shuffle: parsed.shuffle === true,
                    repeat: repeat,
                    prefetchCount: prefetchCount,
                    vocalFilter: vocalFilter,
                    view: view,
                    reportPlays: parsed.reportPlays !== false,
                    artTest: parsed.artTest === true,
                    metaTitle: typeof parsed.metaTitle === "string"
                        ? parsed.metaTitle
                        : "${title}",
                    metaSubtitle: typeof parsed.metaSubtitle === "string"
                        ? parsed.metaSubtitle
                        : "${genre}"
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

    // Resolve the logged in user id on demand by probing your published feed
    // This lets the picker map your own profile to your library before a Load
    async function ensureSelfUserId() {

        if (selfUserId !== null) {
            return selfUserId;
        }

        try {
            const params = new URLSearchParams();

            params.set("time", String(Date.now()));
            params.set("t", FEEDS.published.t);
            params.set("size", "20");
            params.set("query_type", FEEDS.published.queryType);
            params.set("listRenderType", FEEDS.published.queryType);

            const url = FEEDS.published.endpoint + "?" + params.toString();
            const res = await fetch(url, { credentials: "include" });

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

            // Own feed, feedMode and cache were already set at init, nothing to do
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

                data = { kind: "feed", feed: feedMode };
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

        if (settings.refreshOnStart[feedMode]) {
            run(true);
        }
    }

    // Start playback on open when the user has asked for it and songs exist
    function maybeAutoPlay() {

        if (settings.autoPlay && cache.songs.length > 0) {
            startPlay();
        }
    }

    // Keep only the fields we actually need, to save space
    // description and publish_at are not used anywhere, so they are dropped
    function trim(s) {

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

    // True when a song has no vocals
    // Mureka encodes this as generation_method 7, every other value, including
    // the remix and studio methods, counts as having vocals
    function isInstrumental(song) {

        return song.generation_method === 7;
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
    function passesFilters(song) {

        return passesVocalFilter(song) && passesPlaylist(song);
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
        const res = await fetch(url, { credentials: "include" });

        // A rejected request must not be mistaken for an empty final page
        if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }

        const json = await res.json();

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
            const res = await fetch(url, { credentials: "include" });

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
            loadToken += 1;
            updateButton();
            return;
        }

        running = true;
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
            loadToken += 1;
            updateButton();
            return;
        }

        running = true;
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

            if (newCursor === null || newCursor === cursor) {
                reachedEnd = true;
                break;
            }

            cursor = newCursor;

            await sleep(PAGE_DELAY);
        }

        // A feed switch during the last await would make this write the wrong cache
        if (myToken !== loadToken) {
            return;
        }

        // New and republished songs move to the front, duplicates are dropped
        // A deep rescan rebuilds the whole list, so the fresh fields, publish
        // date, like flag and publish state, replace the older cached copies
        cache.songs = dedupe(fresh.concat(baseSongs));
        cache.updated = Date.now();

        // A deep rescan that ran to the end has now seen the entire library
        if (deep && reachedEnd) {
            cache.complete = true;
            cache.lastCursor = null;
        }

        saveCache();

        // Grow the active queue with any songs the refresh brought in
        extendQueueWithNew();

        setStatus((deep ? "Rescan complete, total: " : "Up to date, total: ")
            + cache.songs.length + ", new: " + newCount);
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

            // Leave creator mode without toggling, returning to your own feed
            creatorSource = null;
            updateCreatorButton();

        } else {

            feedMode = feedMode === "published" ? "all" : "published";
        }

        updateFeedButton();

        cache = loadCache();
        cachedIds = new Set();
        renderList();
        refreshCachedIds();

        const n = cache.songs.length;

        setStatus(feed().label + " feed, " + n + " cached song"
            + (n === 1 ? "" : "s")
            + (n === 0 ? ", press Load" : ""));

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
            sourceEl.textContent = FEEDS[feedMode].label + " feed";
        }

        sourceEl.style.display = "inline";
        updateSourceSeparator();
    }

    function updateFeedButton() {

        if (feedButton) {
            feedButton.labelEl.textContent = FEEDS[feedMode].label;
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

                const net = await fetch(direct);

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

            const net = await fetch(url);

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
            const res = await fetch(url, { credentials: "include" });

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

            // Only refresh the scrubber position here. iOS caps artwork updates
            // per song, so we avoid re-sending the metadata, which carries the
            // cover and would burn that budget
            updateMediaPosition();
        });

        audio.addEventListener("error", function () {
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


        // Move the seek bar and time labels as the song plays
        audio.addEventListener("timeupdate", function () {

            if (!isSeeking) {
                updateSeekDisplay();
            }

            // Persist the position now and then so a restart resumes near here
            const now = Date.now();

            if (now - lastQueueSave > 5000) {
                lastQueueSave = now;
                saveQueue();
            }
        });

        audio.addEventListener("play", function () {

            updatePlayPause();

            // Clear a stale Stopped or Paused line once playback is running
            if (currentSong) {
                setStatus("Playing: " + (currentSong.title || "Untitled"));
            }

            // Only refresh the scrubber position on resume. Re-sending the
            // metadata would re-send the cover, and iOS caps covers per song
            updateMediaPosition();
        });

        audio.addEventListener("pause", function () {

            updatePlayPause();

            // Keep the saved position current when the user pauses
            saveQueue();

            // Stop clears currentSong first, so this only fires for a real pause
            if (currentSong) {
                setStatus("Paused: " + (currentSong.title || "Untitled"));
            }
        });
    }

    // Remove a cached song that could not be played and move on
    // Only prunes once something has played, so a wrong base does not wipe all
    function handlePlayError() {

        if (!currentSong) {
            return;
        }

        const failed = currentSong;

        if (!playbackWorks) {
            setStatus("Could not play, check the audio URL: " + (failed.title || "Untitled"));
            return;
        }

        // Treat an unplayable song as deleted on the server
        const idx = cache.songs.findIndex(function (s) {
            return s.song_id === failed.song_id;
        });

        if (idx !== -1) {
            cache.songs.splice(idx, 1);
            saveCache();
        }

        setStatus("Removed deleted song: " + (failed.title || "Untitled"));

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

        // Clicking the song that is already playing just restarts it, the queue
        // is left untouched so shuffle order is not regenerated
        // With no audio loaded yet, as just after a restored queue, fall through
        if (currentSong && currentSong.song_id === songId && audio && audio.src) {

            audio.currentTime = 0;
            audio.play();

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
        repeatBtn.textContent = "";
        repeatBtn.appendChild(makeRepeatIcon(repeatMode === "one"));

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

        const target = toTopDir === "down" ? listEl.scrollHeight : 0;

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

    // Begin a possible pull only when the list is already at the very top
    function onListTouchStart(ev) {

        if (refreshing || ev.touches.length !== 1) {
            pullArmed = false;
            return;
        }

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

    // On release, refresh if pulled far enough, otherwise spring back
    function onListTouchEnd() {

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
        updateViewMenuBar();
        closeViewMenu();

        // Rebuild the upcoming queue so the filter takes effect while playing,
        // then re-render so the list and counts update in every view
        rebuildUpcoming();
        renderList();
    }

    // Highlight the active vocals filter button
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

        viewMenuBar.textContent = v + "  \u00B7  " + f + "  \u25BE";
    }

    // The songs to show for the current view
    // The number shown per song is always its Mureka position, set in renderSongs
    // The songs in their canonical order for the current source
    // Your own Published feed, once fully loaded, is ordered by publish date
    // newest published first, matching the Mureka website, so a freshly
    // published older song appears at the top. Every other case keeps the
    // creation order the API returns
    function orderedSongs() {

        if (!creatorSource && feedMode === "published" && cache.complete) {

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
        audio.play();

        // Remember the queue and position so a restart can resume here
        saveQueue();

        // Tell Mureka the song was played, unless the user opted out
        if (settings.reportPlays) {
            reportPlay(song);
        }

        // Fetch play and like counts to show under the now playing title
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
    async function fetchNowPlayingCounts(song) {

        try {
            const url = "/api/pgc/song/detail?time=" + Date.now()
                + "&song_id=" + song.song_id;

            const res = await fetch(url, { credentials: "include" });
            const json = await res.json();

            if (!json || json.code !== 0 || !json.data) {
                return;
            }

            if (!currentSong || currentSong.song_id !== song.song_id) {
                return;
            }

            nowPlayingCounts = {
                song_id: song.song_id,
                play_count: json.data.play_count,
                fav_count: json.data.fav_count,
                share_count: json.data.share_count
            };

            refreshNowPlayingMeta();
        } catch (e) {
        }
    }

    // Cache the next songs in the queue so playback does not wait on the network
    async function prefetchNext() {

        for (let i = 1; i <= settings.prefetchCount; i += 1) {

            const pos = queuePos + i;

            if (pos >= queue.length) {
                break;
            }

            const song = queue[pos];

            if (!song || cachedIds.has(song.song_id)) {
                continue;
            }

            const ok = await fetchToCache(song);

            if (ok) {
                cachedIds.add(song.song_id);
                renderList();
            }
        }
    }

    // Point the audio element at a URL, cleaning up the previous blob URL
    function setCurrentSrc(url) {

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

    // Toggle between play and pause for the current song
    function togglePlayPause() {

        if (!audio || !audio.src) {

            // Nothing loaded yet, start playback in the current mode
            startPlay();
            return;
        }

        if (audio.paused) {
            audio.play();
        } else {
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
        playPauseBtn.textContent = playing ? "\u23F8" : "\u25B6";

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
    function setArtSources() {

        for (let i = 0; i < artTiles.length; i += 1) {

            const rel = i - ART_SIDE_TILES;
            const song = (rel === 0) ? currentSong : neighborSong(rel);
            const cover = song ? coverUrl(song) : "";

            if (cover) {
                artTiles[i].src = cover;
                artTiles[i].style.visibility = "visible";
            } else {
                artTiles[i].removeAttribute("src");
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

        const base = (w - cover) / 2;

        // In repeat one the sides are not where playback heads next, so grey
        // and fade them as a hint that the current song keeps repeating
        const repeatingOne = repeatMode === "one";

        for (let i = 0; i < artTiles.length; i += 1) {

            const rel = i - ART_SIDE_TILES;
            const x = base + rel * cover + drag;

            artTiles[i].style.transform = "translateX(" + x + "px)";

            // Blur grows with how far the tile center sits from the wrapper center
            const tileCenter = x + cover / 2;
            const dist = Math.abs(tileCenter - w / 2);
            const factor = Math.min(1, dist / cover);
            const blur = factor * ART_SIDE_BLUR;

            const isSide = rel !== 0;
            const filters = [];

            if (blur > 0.05) {
                filters.push("blur(" + blur.toFixed(2) + "px)");
            }

            if (repeatingOne && isSide) {
                filters.push("grayscale(1)");
            }

            artTiles[i].style.filter = filters.length ? filters.join(" ") : "none";
            artTiles[i].style.opacity = (repeatingOne && isSide) ? "0.3" : "1";
        }
    }

    // The distance one swipe travels to change song, equal to a cover width
    function artStep() {

        return artWrapEl ? artWrapEl.clientHeight : 0;
    }

    // After the glide settles, run the song change, which re-seats the strip
    function finishArtSwipe(action) {

        setTimeout(function () {

            setArtTransition("none");
            currentSwipeOffset = 0;

            // The song only changes now, on release, never during the drag
            if (action) {
                action();
            } else {
                positionArt(0);
            }
        }, 220);
    }

    // Begin tracking a swipe on the cover
    function onArtTouchStart(ev) {

        if (!currentSong || ev.touches.length !== 1) {
            return;
        }

        const t = ev.touches[0];

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
    function onArtTouchEnd() {

        if (!swipeActive) {
            return;
        }

        swipeActive = false;

        if (swipeDir !== 1) {
            return;
        }

        const moved = currentSwipeOffset;
        const step = artStep();
        const threshold = Math.max(40, step * 0.3);

        setArtTransition("transform 0.2s ease, filter 0.2s ease");

        if (moved <= -threshold && neighborSong(1)) {

            // Glide fully to the next cover, then play it on landing
            positionArt(-step);
            finishArtSwipe(playNext);

        } else if (moved >= threshold && neighborSong(-1)) {

            positionArt(step);
            finishArtSwipe(playPrev);

        } else {

            // Not far enough, snap back with no change
            positionArt(0);
            currentSwipeOffset = 0;
        }
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

        if (playerMetaEl) {
            playerMetaEl.textContent = formatMeta(settings.metaSubtitle, song);
        }
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

        if (!playerTitle) {
            return;
        }

        if (!song) {

            playerTitle.textContent = "Nothing playing";
            nowPlayingCounts = null;

            if (playerMetaEl) {
                playerMetaEl.textContent = "";
            }

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

        updateMediaPosition();
    }

    // Register media key handlers so playerctl and hardware keys control playback
    function setupMediaSession() {

        if (!("mediaSession" in navigator)) {
            return;
        }

        // setActionHandler throws for actions the browser does not support
        const setHandler = function (action, fn) {

            try {
                navigator.mediaSession.setActionHandler(action, fn);
            } catch (e) {
            }
        };

        setHandler("play", function () {

            if (audio) {
                audio.play();
            } else {
                startPlay();
            }
        });

        setHandler("pause", function () {

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

        const entry = artCache.get(song.song_id);

        if (!entry) {

            return [];
        }

        const list = [];

        if (entry.small) {

            list.push({ src: entry.small, sizes: "128x128", type: "image/jpeg" });
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
            bpm: song.bpm ? String(song.bpm) : "",
            model: song.model || "",
            artist: artist,
            duration: duration,
            plays: plays,
            likes: likes,
            ctime: song.generate_at ? fmtDate(song.generate_at) : "",
            ptime: song.publish_at ? fmtDate(song.publish_at) : "",
            mode: modeStatusText(),
            instrumental: isInstrumental(song) ? "Instrumental" : ""
        };
    }

    // Expand a now playing template. ${tag} inserts a value. Text inside [ ] is
    // kept only when every tag inside it has a value, so labels and separators
    // disappear cleanly when a field is missing
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
    async function loadArtBlob(song, url) {

        if (!url) {
            return;
        }

        const id = song.song_id;

        // Already have this song's art cached
        if (artCache.has(id)) {
            return;
        }

        const token = ++artFetchToken;
        let blob;

        try {
            const res = await fetch(url);

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

        // Re-encode the cover to clean square JPEG data urls, a small one for
        // the compact slot and a larger one for the lock screen
        // iOS grey-boxes artwork larger than 128px on the affected versions, so
        // hand it a single small 128px cover, which shows reliably everywhere
        const small = await makeScaledDataUrl(blob, 128, 0.85);

        // A newer track took over during the async work, drop this cover
        if (token !== artFetchToken || !currentSong || currentSong.song_id !== id) {

            return;
        }

        if (!small) {

            return;
        }

        artCachePut(id, { small: small });

        setMediaMetadata(song, artworkFor(song));
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

        updateMediaMetadata(currentSong);
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

    function updateMediaMetadata(song) {

        if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") {
            return;
        }

        if (!song) {

            clearArtBlob();

            try {
                navigator.mediaSession.playbackState = "none";
            } catch (e) {
            }

            return;
        }

        // Reuse a cached blob when we have one for this song, so going back to a
        // recent track shows its art at once, otherwise show the remote cover
        // now and fetch the blob to swap in
        const cached = artCache.get(song.song_id);

        if (cached) {

            setMediaMetadata(song, artworkFor(song));
            return;
        }

        // Set the text now with no cover, then load and re-encode the real cover
        // and set it once. Skipping the remote placeholder avoids sending a
        // second distinct cover, since iOS caps covers per song
        setMediaMetadata(song, []);

        const art = coverUrl(song);

        if (art) {
            loadArtBlob(song, art);
        }
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
        minimizeBtn.style.cssText = "flex:0 0 auto;color:#aaa;font-size:12px";

        // The bookmarklet panel is fullscreen, so a minimize arrow is not useful
        if (!isExtensionHost()) {
            minimizeBtn.style.display = "none";
        }

        // Hamburger that collapses or expands the top action menu to save space
        actionsToggleBtn = document.createElement("span");
        actionsToggleBtn.textContent = "\u2630";
        actionsToggleBtn.title = "Show or hide the action buttons";
        actionsToggleBtn.style.cssText = "flex:0 0 auto;color:#aaa;font-size:14px;cursor:pointer;line-height:1";

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
        settingsBtn.style.cssText = "flex:0 0 auto;color:#aaa;font-size:15px;cursor:pointer;line-height:1";

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

        const rowOne = document.createElement("div");
        rowOne.style.cssText = "display:flex;gap:6px";

        loadButton = makeActionButton(iconLoad(), "Load", "#48e1eb", "#000", run);
        const clearButton = makeActionButton(iconClear(), "Clear", "#444", "#fff", clearCache);
        feedButton = makeActionButton(iconFeed(), feed().label, "#444", "#fff", switchFeed);
        feedButton.title = "Switch between published and all songs";

        rowOne.appendChild(loadButton);
        rowOne.appendChild(clearButton);
        rowOne.appendChild(feedButton);

        // A full width deep refresh, pages the whole library without clearing
        const rowRescan = document.createElement("div");
        rowRescan.style.cssText = "display:flex;gap:6px";

        const rescanButton = makeActionButton(iconLoad(), "Rescan", "#444", "#fff", rescan);
        rescanButton.title = "Full refresh, page the whole library and update publish"
            + " dates and likes in place, no need to Clear first";

        rowRescan.appendChild(rescanButton);

        const rowThree = document.createElement("div");
        rowThree.style.cssText = "display:flex;gap:6px";

        cacheButton = makeActionButton(iconCache(), "Cache all", "#444", "#fff", cacheAll);
        downloadButton = makeActionButton(iconDownload(), "Download list", "#444", "#fff", downloadAll);
        downloadButton.title = "Download the songs shown under the current filter";

        rowThree.appendChild(cacheButton);
        rowThree.appendChild(downloadButton);

        // A row for the two collection browsers, your playlists and other creators
        const rowFour = document.createElement("div");
        rowFour.style.cssText = "display:flex;gap:6px";

        playlistButton = makeActionButton(iconPlaylists(), "Playlists", "#444", "#fff", openPlaylists);
        creatorButton = makeActionButton(iconCreators(), "Creators", "#444", "#fff", openCreators);
        creatorButton.title = "Browse another creator published songs";

        rowFour.appendChild(playlistButton);
        rowFour.appendChild(creatorButton);

        // Floating dropdown for the action buttons, opens over the player
        // It lives on the body and is fixed positioned, so toggling it does not
        // move the player content around
        actionsWrapEl = document.createElement("div");
        actionsWrapEl.style.cssText = POPUP_CSS;
        actionsWrapEl.appendChild(rowOne);
        actionsWrapEl.appendChild(rowRescan);
        actionsWrapEl.appendChild(rowThree);
        actionsWrapEl.appendChild(rowFour);

        // Keep clicks inside the dropdown from closing it
        actionsWrapEl.addEventListener("mousedown", function (ev) {
            ev.stopPropagation();
        });

        actionsWrapEl.addEventListener("click", function (ev) {
            ev.stopPropagation();
        });

        document.body.appendChild(actionsWrapEl);

        // Player block, album art on top, then title, seek bar and play control
        const playerEl = document.createElement("div");
        playerEl.style.marginBottom = "8px";

        // A box that holds the masked strip, plus optional side nav buttons that
        // must sit outside the mask so they are not faded at the edges
        const artBox = document.createElement("div");
        artBox.style.cssText = "position:relative;margin-bottom:8px";

        // The album art is a coverflow strip, the center cover with side covers
        // that peek in and fade and blur toward the edges
        artWrapEl = document.createElement("div");
        artWrapEl.id = "mureka-player-art-wrap";
        artWrapEl.style.cssText = "position:relative;width:100%;border-radius:8px;overflow:hidden;background:#0a0a0d;touch-action:pan-y";

        // A short, wide window, the center cover is a square of this height
        artWrapEl.style.aspectRatio = String(1 / ART_CENTER_FRACTION);

        // Fade the sides out toward the edges, clear where they meet the center
        const seamLeft = (1 - ART_CENTER_FRACTION) / 2 * 100;
        const seamRight = 100 - seamLeft;
        const artMask = "linear-gradient(to right, transparent 0%, #000 "
            + seamLeft.toFixed(1) + "%, #000 " + seamRight.toFixed(1) + "%, transparent 100%)";

        artWrapEl.style.webkitMaskImage = artMask;
        artWrapEl.style.maskImage = artMask;

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
        playerMetaEl.style.cssText = "color:#dcdce0;font-size:12px;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,0.9)";

        // Plays and likes for the current song on their own line so they show
        // even when the meta line above is long enough to be clipped
        playerCountsEl = document.createElement("div");
        playerCountsEl.style.cssText = "color:#dcdce0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 3px rgba(0,0,0,0.9)";

        // A faint note shown in the art area when the current song has no cover
        artPlaceholderEl = document.createElement("div");
        artPlaceholderEl.textContent = "\u266A";
        artPlaceholderEl.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#2e2e36;font-size:64px;pointer-events:none";

        // Dark gradient behind the top status so its text stays readable
        const topScrim = document.createElement("div");
        topScrim.style.cssText = "position:absolute;left:0;right:0;top:0;height:40%;border-radius:8px 8px 0 0;background:linear-gradient(to bottom,rgba(0,0,0,0.75),transparent);pointer-events:none";

        // Dark gradient behind the bottom title block for the same reason
        const bottomScrim = document.createElement("div");
        bottomScrim.style.cssText = "position:absolute;left:0;right:0;bottom:0;height:62%;border-radius:0 0 8px 8px;background:linear-gradient(to top,rgba(0,0,0,0.9) 0%,rgba(0,0,0,0.55) 45%,transparent 100%);pointer-events:none";

        // Status sits at the top of the art, one clipped line, never blocks swipe
        const topWrap = document.createElement("div");
        topWrap.style.cssText = "position:absolute;left:10px;right:10px;top:7px;pointer-events:none;z-index:4";
        statusEl.style.cssText = "font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#eaeaec;text-shadow:0 1px 3px rgba(0,0,0,0.9)";
        topWrap.appendChild(statusEl);

        // Title, meta and counts sit at the bottom of the art over the scrim
        const bottomWrap = document.createElement("div");
        bottomWrap.style.cssText = "position:absolute;left:10px;right:10px;bottom:8px;pointer-events:none;z-index:4";
        bottomWrap.appendChild(playerTitle);
        bottomWrap.appendChild(playerMetaEl);
        bottomWrap.appendChild(playerCountsEl);

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
        seekRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px";

        curTimeEl = document.createElement("span");
        curTimeEl.textContent = "0:00";
        curTimeEl.style.cssText = "font-variant-numeric:tabular-nums;min-width:34px";

        seekBar = document.createElement("input");
        seekBar.type = "range";
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

        seekRow.appendChild(curTimeEl);
        seekRow.appendChild(seekBar);
        seekRow.appendChild(remTimeEl);

        // Transport row, icon buttons for previous, play/pause, stop, next, shuffle, repeat
        const controlRow = document.createElement("div");
        controlRow.style.cssText = "display:flex;gap:6px";

        const prevBtn = makeIconButton("\u23EE", "Previous", playPrev);
        playPauseBtn = makeIconButton("\u25B6", "Play / Pause", togglePlayPause);
        const nextBtn = makeIconButton("\u23ED", "Next", playNext);

        shuffleBtn = makeIconButton(makeShuffleIcon(), "Shuffle (toggle)", toggleShuffle);
        repeatBtn = makeIconButton(makeRepeatIcon(false), "Repeat", cycleRepeat);
        const stopBtn = makeIconButton("\u23F9", "Stop", stopPlay);

        controlRow.appendChild(prevBtn);
        controlRow.appendChild(playPauseBtn);
        controlRow.appendChild(stopBtn);
        controlRow.appendChild(nextBtn);
        controlRow.appendChild(shuffleBtn);
        controlRow.appendChild(repeatBtn);

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
            "font:13px/1.4 sans-serif"
        ].join(";");

        // Inline styles cannot target the placeholder, so inject a rule for it
        // important is needed to beat the site own placeholder styling
        const placeholderStyle = document.createElement("style");
        placeholderStyle.textContent =
            "#mureka-search-input::placeholder{color:#aaa !important;opacity:1 !important}"
            + "#mureka-search-input::-moz-placeholder{color:#aaa !important;opacity:1 !important}"
            + "@keyframes mureka-pulse{0%,100%{opacity:1}50%{opacity:0.15}}"
            + "@keyframes mureka-spin{to{transform:rotate(360deg)}}"
            // On a phone, fill the screen, shrink the art a touch and let the
            // list grow into the remaining height instead of a fixed box
            + "@media (max-width:640px){"
            + "#mureka-player-panel{top:0 !important;left:0 !important;right:0 !important;width:100vw !important;height:100vh !important;height:100dvh !important;max-width:none !important;border-radius:0 !important;padding:8px !important;box-sizing:border-box !important;font-size:12px !important;gap:7px !important;overflow:hidden !important}"
            + "#mureka-player-art-wrap{max-width:none !important}"
            + "#mureka-player-body{display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important}"
            + "#mureka-player-list-wrap{flex:1 1 auto !important;min-height:0 !important;display:flex !important;flex-direction:column !important}"
            + "#mureka-player-list{flex:1 1 auto !important;height:auto !important;min-height:120px !important}"
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

        // On a phone the keyboard covers the lower panel, so while the search
        // field has focus hide the tall player block to lift the field and the
        // list up where they stay visible
        searchInput.addEventListener("focus", function () {

            if (window.innerWidth <= 640) {
                playerEl.style.display = "none";
            }
        });

        searchInput.addEventListener("blur", function () {

            playerEl.style.display = "block";

            if (!swipeActive) {
                positionArt(0);
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
        viewMenuEl = document.createElement("div");
        viewMenuEl.style.cssText = POPUP_CSS;
        viewMenuEl.appendChild(viewRow);
        viewMenuEl.appendChild(filterRow);

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

            // Ignore programmatic scrolls, view switches and song changes
            if (Date.now() - programmaticScrollAt < 400) {
                return;
            }

            // Ignore jitter and lists too short to be worth jumping around
            if (Math.abs(delta) < 3 || listEl.scrollHeight - listEl.clientHeight < 40) {
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

        panel.appendChild(header);
        panel.appendChild(bodyEl);
        document.body.appendChild(panel);

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

        // Restore whether the panel was left minimized last time
        let startMinimized = false;

        try {
            startMinimized = localStorage.getItem(MINIMIZED_KEY) === "1";
        } catch (e) {
        }

        setMinimized(startMinimized);

        // Size the panel to the real visible area and keep it in sync as iOS
        // Safari shows or hides its toolbar
        fitMobile();
        window.addEventListener("resize", fitMobile);

        if (window.visualViewport) {
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
                saveQueue();
            }
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

        const w = panelEl.offsetWidth;
        const h = panelEl.offsetHeight;
        const maxLeft = Math.max(8, window.innerWidth - w - 8);
        const maxTop = Math.max(8, window.innerHeight - h - 8);

        return {
            left: Math.max(8, Math.min(left, maxLeft)),
            top: Math.max(8, Math.min(top, maxTop))
        };
    }

    // Position the panel and choose which edge to anchor in CSS, so the browser
    // keeps that edge fixed whenever the content grows or shrinks on its own.
    // Nearer the top anchors the top edge and grows downward, nearer the bottom
    // anchors the bottom edge and grows upward
    function applyPosition(left, top) {

        const pos = clampPosition(left, top);
        const bottomEdge = pos.top + panelEl.offsetHeight;
        const distanceTop = pos.top;
        const distanceBottom = window.innerHeight - bottomEdge;

        panelEl.style.left = pos.left + "px";
        anchorLeft = pos.left;

        if (distanceTop < distanceBottom) {
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
        const left = window.innerWidth - panelEl.offsetWidth - 16;
        const top = window.innerHeight - panelEl.offsetHeight - 16;
        applyPosition(left, top);
    }

    // On phones the panel fills the screen, but iOS Safari changes the visible
    // height when it shows or hides its toolbar, and CSS viewport units lag
    // behind that. Size the panel to the actual visible rectangle instead, so
    // the top controls and the list never spill off screen
    function fitMobile() {

        if (!panelEl) {
            return;
        }

        const mobile = window.innerWidth <= 640;

        if (!mobile) {

            // Hand sizing back to the draggable desktop dock at its fixed width
            panelEl.style.removeProperty("top");
            panelEl.style.removeProperty("height");
            panelEl.style.removeProperty("right");
            panelEl.style.removeProperty("left");
            panelEl.style.setProperty("width", "300px");
            restorePosition();
            return;
        }

        // Pin the panel to the real visible viewport rather than relying on
        // 100vw, which on iOS can be wider than what is actually on screen and
        // pushes the panel and its content off both edges
        const vv = window.visualViewport;
        const top = vv ? vv.offsetTop : 0;
        const left = vv ? vv.offsetLeft : 0;
        const width = vv ? vv.width : window.innerWidth;
        const height = vv ? vv.height : window.innerHeight;

        // Inline important beats the media query so the exact pixels win
        panelEl.style.setProperty("top", top + "px", "important");
        panelEl.style.setProperty("left", left + "px", "important");
        panelEl.style.setProperty("right", "auto", "important");
        panelEl.style.setProperty("width", width + "px", "important");
        panelEl.style.setProperty("height", height + "px", "important");

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
                toggleMinimize();
            }
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    // Collapse or expand the panel body and remember the choice
    function toggleMinimize() {

        setMinimized(!minimized);

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
            bodyEl.style.display = minimized ? "none" : "block";
        }

        if (minimizeBtn) {

            // Up triangle to expand, down triangle to collapse
            minimizeBtn.textContent = minimized ? "\u25B4" : "\u25BE";
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

        if (content instanceof Node) {
            b.appendChild(content);
        } else {
            b.textContent = content;
        }

        b.title = title;
        b.style.cssText = [
            "flex:1",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            "padding:8px 0",
            "border:none",
            "border-radius:6px",
            "background:#333",
            "color:#fff",
            "font-size:16px",
            "line-height:1",
            "cursor:pointer"
        ].join(";");

        b.addEventListener("click", handler);

        return b;
    }

    // Build the shuffle icon as real SVG nodes, matching the text glyph color
    // Built with the DOM instead of innerHTML, so nothing parses markup
    function makeShuffleIcon() {

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");

        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
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

        svg.setAttribute("width", "16");
        svg.setAttribute("height", "16");
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

        if (statusEl) {
            statusEl.textContent = text;
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

    // Reflect the running state on the load button
    function updateButton() {

        if (!loadButton) {
            return;
        }

        loadButton.labelEl.textContent = running ? "Stop" : "Load";
        setButtonIcon(loadButton, running ? iconStop() : iconLoad());
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
        const cached = cachedIds.has(song.song_id);

        const dot = document.createElement("span");
        dot.textContent = "\u25CF";
        dot.style.cssText = "color:#48e1eb;margin-right:6px;flex:0 0 auto;visibility:"
            + ((caching || cached) ? "visible" : "hidden");

        if (caching) {
            dot.style.animation = "mureka-pulse 1s ease-in-out infinite";
            dot.title = "Caching";
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

        // Song length, right aligned next to the title
        if (song.duration_milliseconds) {

            const dur = document.createElement("span");
            dur.textContent = formatTime(song.duration_milliseconds / 1000);
            dur.style.cssText = "flex:0 0 auto;margin-left:8px;color:#888;font-variant-numeric:tabular-nums";
            item.appendChild(dur);
        }

        // In your own All feed, mark each song as published or still a draft
        // Drafts have no publish_state at all, so test for the published value
        if (!creatorSource && feedMode === "all") {

            const published = song.publish_state === 1;

            const badge = document.createElement("span");
            badge.textContent = published ? "published" : "draft";
            badge.style.cssText = "flex:0 0 auto;margin-left:6px;padding:0 5px;border-radius:4px;font-size:11px;line-height:16px;"
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
        const ordered = orderedSongs();
        const numberById = new Map();
        const total = ordered.length;

        ordered.forEach(function (s, i) {
            numberById.set(s.song_id, total - i);
        });

        listEl.textContent = "";
        playingItemEl = null;

        const query = searchQuery;
        let shown = 0;

        // The queue can hold the same song more than once, played earlier and
        // queued again, so the queue view decides played, current and upcoming
        // by the row position in the queue rather than by song id, which would
        // otherwise grey out a replayed song that is actually still upcoming
        const byQueueIndex = fromQueue === true;

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

            shown += 1;

            let isPlaying;
            let dimmed;

            if (byQueueIndex) {

                isPlaying = i === queuePos;

                // Grey out already played songs, and in repeat one the upcoming
                // ones too, since playback stays on the current track
                dimmed = i < queuePos || (i > queuePos && repeatMode === "one");

            } else {

                isPlaying = song.song_id === playingId;
                dimmed = false;
            }

            const item = buildSongRow(song, numberById.get(song.song_id), isPlaying, dimmed);

            if (isPlaying) {
                playingItemEl = item;
            }

            listEl.appendChild(item);
        });

        // Update the counts line, shown rows against the library total and queue
        // An active creator and playlist lead the line so the scope stays clear
        if (countsEl) {

            let text = "Shown " + shown + " of " + cache.songs.length
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
    function makeTextRow(label, get, set, previewFn) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;flex-direction:column;gap:4px";

        const name = document.createElement("div");
        name.textContent = label;
        name.style.cssText = "font-size:12px;color:#ccc";

        const input = document.createElement("input");
        input.type = "text";
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

        return row;
    }

    function makeBoolRow(label, get, set) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const name = document.createElement("span");
        name.textContent = label;

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
    function makeStepperRow(label, get, set, min, max) {

        const row = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px";

        const name = document.createElement("span");
        name.textContent = label;

        const controls = document.createElement("div");
        controls.style.cssText = "display:flex;align-items:center;gap:8px;flex:0 0 auto";

        const value = document.createElement("span");
        value.style.cssText = "min-width:24px;text-align:center;font-variant-numeric:tabular-nums";

        const render = function () {
            value.textContent = String(get());
        };

        const minus = makeButton("-", "#333", "#fff", function () {
            set(Math.max(min, get() - 1));
            saveSettings();
            render();
        });

        const plus = makeButton("+", "#333", "#fff", function () {
            set(Math.min(max, get() + 1));
            saveSettings();
            render();
        });

        [minus, plus].forEach(function (b) {
            b.style.flex = "0 0 auto";
            b.style.minWidth = "40px";
            b.style.padding = "6px 0";
        });

        render();

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

        // Refresh on open section, one independent flag per feed
        const refreshLabel = document.createElement("div");
        refreshLabel.textContent = "Refresh on open";
        refreshLabel.style.cssText = "color:#bbb";

        const pubRow = makeBoolRow("Published",
            function () { return settings.refreshOnStart.published; },
            function (v) { settings.refreshOnStart.published = v; });

        const allRow = makeBoolRow("All",
            function () { return settings.refreshOnStart.all; },
            function (v) { settings.refreshOnStart.all = v; });

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
            + " ${instrumental}."
            + " Text in [ ] is dropped when a tag inside it is empty.";
        tplHint.style.cssText = "font-size:11px;color:#888;line-height:1.4";

        // Developer section, turn on debug tools and share raw API data
        const devLabel = document.createElement("div");
        devLabel.textContent = "Developer";
        devLabel.style.cssText = "color:#bbb";

        const debugRow = makeBoolRow("Debug mode",
            function () { return isDebug(); },
            function (v) { setDebug(v); });

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
        settingsEl.appendChild(devLabel);
        settingsEl.appendChild(debugRow);
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
        addInfoRow("BPM", song.bpm ? String(song.bpm) : "-");
        addInfoRow("Model", song.model || "-");
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

                const res = await fetch(url, { credentials: "include" });
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
        feedMode = "published";

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

            const res = await fetch(url, { credentials: "include" });
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
            const res = await fetch(url, { credentials: "include" });
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
            const res = await fetch(url, { credentials: "include" });

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
                const res = await fetch(url, { credentials: "include" });

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

        if (cached) {

            addMenuRow("Remove from cache", "#ff8a8a", function () {
                removeOne(song);
            });

        } else {

            addMenuRow("Cache", "#48e1eb", function () {
                cacheOne(song);
            });
        }

        // Developer only, copy the full song JSON to the clipboard
        // Available on the bookmarklet too, where there is no console
        if (isDebug()) {

            addMenuRow("Copy JSON", "#ffd479", function () {
                copyJson(song);
            });
        }

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
