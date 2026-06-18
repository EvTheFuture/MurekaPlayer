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

    // Player version, shown in the panel header so an update is easy to confirm
    // Keep this in sync with the version field in manifest.json
    const VERSION = "1.2.4";

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
    function feed() {
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
    const ART_CENTER_FRACTION = 0.5;

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

    // User settings, loaded once on startup, published is the default start feed
    let settings = loadSettings();

    // Honor the chosen start feed before the cache for that feed is loaded
    feedMode = settings.startFeed;

    // Cached data, loaded once on startup
    let cache = loadCache();

    // True while a load run is in progress
    let running = false;

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

    // UI element references
    let statusEl = null;
    let listEl = null;
    let loadButton = null;
    let feedButton = null;
    let cacheButton = null;
    let downloadButton = null;

    // The panel, its header, its collapsible body and the minimize indicator
    let panelEl = null;
    let headerEl = null;
    let bodyEl = null;
    let minimizeBtn = null;
    let minimized = false;

    // Current anchor, the side and edge offset are kept so growth keeps the dock
    let anchorLeft = 8;
    let anchorSide = "bottom";
    let anchorOffset = 16;

    // The view buttons, keyed by view name
    let viewButtons = {};

    // Set of song_ids whose mp3 is present in the audio cache
    let cachedIds = new Set();

    // Set of song_ids that are being cached right now, shown by a pulsing dot
    let cachingIds = new Set();

    // Current search box text, lowercased, empty means show all
    let searchQuery = "";

    // The list row of the currently playing song, used to scroll it into view
    let playingItemEl = null;

    // Which list view is active, one of mureka, queue or alpha
    let listView = "mureka";

    // The right-click options popup, built once and reused
    let contextMenuEl = null;

    // The settings overlay and its controls, built once and reused
    let settingsEl = null;
    let startPublishedBtn = null;
    let startAllBtn = null;

    // Player UI element references
    let artWrapEl = null;
    let playerArt = null;
    let playerTitle = null;
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

    // Persist the cache to localStorage
    function saveCache() {

        try {
            localStorage.setItem(feed().cacheKey, JSON.stringify(cache));
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
            prefetchCount: PREFETCH_DEFAULT
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

                return {
                    startFeed: parsed.startFeed === "all" ? "all" : "published",
                    refreshOnStart: {
                        published: ros.published === true,
                        all: ros.all === true
                    },
                    autoPlay: parsed.autoPlay === true,
                    shuffle: parsed.shuffle === true,
                    repeat: repeat,
                    prefetchCount: prefetchCount
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

    // Refresh the active feed on open when the user has asked for it
    function maybeAutoRefresh() {

        if (settings.refreshOnStart[feedMode]) {
            run();
        }
    }

    // Start playback on open when the user has asked for it and songs exist
    function maybeAutoPlay() {

        if (settings.autoPlay && cache.songs.length > 0) {
            startPlay();
        }
    }

    // Keep only the fields we actually need, to save space
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
            publish_at: s.publish_at
        };
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
        params.set("t", feed().t);
        params.set("size", String(PAGE_SIZE));
        params.set("query_type", feed().queryType);
        params.set("listRenderType", feed().queryType);

        if (cursor !== null && cursor !== undefined) {
            params.set("last_id", String(cursor));
        }

        const url = feed().endpoint + "?" + params.toString();

        // credentials include sends the login cookies so the API authorises us
        const res = await fetch(url, { credentials: "include" });

        // A rejected request must not be mistaken for an empty final page
        if (!res.ok) {
            throw new Error("HTTP " + res.status);
        }

        return res.json();
    }

    // Entry point for the Load / refresh button
    // While the library is not fully cached it resumes loading older songs
    // Once everything is cached it only checks the top for new songs
    async function run() {

        if (running) {
            running = false;
            return;
        }

        running = true;
        updateButton();

        try {

            if (cache.complete === true) {
                await refreshNew();
            } else {
                await continueLoad();
            }

        } catch (e) {

            // The API is unreachable, the cached songs still work offline
            setStatus("Could not reach Mureka, showing " + cache.songs.length + " cached songs");

        } finally {

            running = false;
            renderList();
            refreshCachedIds();
            updateButton();
        }
    }

    // Keep fetching older pages from where we left off until the end is reached
    // Progress and the cursor are saved each page, so it can resume after a stop
    async function continueLoad() {

        const known = new Set(cache.songs.map(function (s) {
            return s.song_id;
        }));

        let cursor = cache.lastCursor || null;

        while (running) {

            let page;

            try {
                page = await fetchPage(cursor);
            } catch (e) {
                setStatus("Network error, paused");
                break;
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

                if (!known.has(s.song_id)) {
                    known.add(s.song_id);
                    cache.songs.push(trim(s));
                }
            }

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
    async function refreshNew() {

        const known = new Set(cache.songs.map(function (s) {
            return s.song_id;
        }));

        const fresh = [];
        let cursor = null;
        let knownStreak = 0;
        let newCount = 0;
        let stop = false;

        while (running && !stop) {

            let page;

            try {
                page = await fetchPage(cursor);
            } catch (e) {
                setStatus("Network error, stopped");
                break;
            }

            const songs = extractSongs(page);

            if (songs.length === 0) {
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

                // A long enough run of cached songs means we reached old data
                if (knownStreak >= KNOWN_STREAK_STOP) {
                    stop = true;
                    break;
                }
            }

            setStatus("Checking for new songs, found: " + newCount);
            renderSongs(fresh.concat(cache.songs));

            if (stop) {
                break;
            }

            const more = hasMore(page);

            if (more === false) {
                break;
            }

            const newCursor = getCursor(page, songs);

            if (newCursor === null || newCursor === cursor) {
                break;
            }

            cursor = newCursor;

            await sleep(PAGE_DELAY);
        }

        // New and republished songs move to the front, duplicates are dropped
        cache.songs = dedupe(fresh.concat(cache.songs));
        cache.updated = Date.now();
        saveCache();
        setStatus("Up to date, total: " + cache.songs.length + ", new: " + newCount);
    }

    // Wipe the cache and reset the view
    function clearCache() {

        cache = { songs: [], updated: 0, complete: false, lastCursor: null };
        saveCache();
        cachedIds = new Set();
        renderList();
        setStatus("Cache cleared");
    }

    // Switch between the published feed and the all songs feed
    // Each feed keeps its own cache, so this just swaps which one is shown
    function switchFeed() {

        feedMode = feedMode === "published" ? "all" : "published";
        updateFeedButton();

        cache = loadCache();
        cachedIds = new Set();
        renderList();
        refreshCachedIds();

        const n = cache.songs.length;

        setStatus(feed().label + " feed, " + n + " cached song"
            + (n === 1 ? "" : "s")
            + (n === 0 ? ", press Load" : ""));

        // Refresh the newly opened feed when the user asked for it
        maybeAutoRefresh();
    }

    // Show the active feed name on the feed button
    function updateFeedButton() {

        if (feedButton) {
            feedButton.textContent = feed().label;
        }
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

        audio.addEventListener("ended", function () {
            handleSongEnded();
        });

        // A song that starts playing proves the audio base URL is correct
        audio.addEventListener("playing", function () {
            playbackWorks = true;
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
        });

        audio.addEventListener("play", function () {
            updatePlayPause();
        });

        audio.addEventListener("pause", function () {
            updatePlayPause();
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

        const songs = cache.songs.slice();

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

        // Resume from where Stop left off, restoring the queue and position
        if (resumeState && resumeState.queue.length) {

            queue = resumeState.queue;
            queuePos = resumeState.queuePos;
            pendingSeek = resumeState.time || 0;
            resumeState = null;
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

        // At the end, loop back to the start when repeating all
        if (repeatMode === "all" && queue.length > 0) {
            queuePos = 0;
            playCurrent();
            return;
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

    // Toggle shuffle as a mode
    // While playing, this rebuilds only the upcoming songs, the current one stays
    function toggleShuffle() {

        shuffleMode = !shuffleMode;
        updateShuffleButton();

        if (queuePos >= 0 && queuePos < queue.length) {

            const played = queue.slice(0, queuePos + 1);

            const playedIds = new Set(played.map(function (s) {
                return s.song_id;
            }));

            // Songs not yet reached, kept in Mureka order then optionally shuffled
            let upcoming = cache.songs.filter(function (s) {
                return !playedIds.has(s.song_id);
            });

            if (shuffleMode) {
                upcoming = shuffleCopy(upcoming);
            }

            queue = played.concat(upcoming);
            renderList();

            // The upcoming order changed, so refresh the coverflow neighbors
            setArtTransition("none");
            setArtSources();
            positionArt(0);

            // Start caching the newly ordered upcoming songs
            prefetchNext();
        }

        setStatus(modeStatusText());
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

    // Cycle repeat through all, one and none for this session
    // The startup value comes from the default repeat in settings
    function cycleRepeat() {

        if (repeatMode === "all") {
            repeatMode = "one";
        } else if (repeatMode === "one") {
            repeatMode = "none";
        } else {
            repeatMode = "all";
        }

        updateRepeatButton();
        setStatus(modeStatusText());
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
        updateViewButtons();
        renderList();
        scrollToPlaying();
    }

    // Scroll the list so the currently playing song is centered, if present
    function scrollToPlaying() {

        if (!listEl || !playingItemEl) {
            return;
        }

        const target = playingItemEl.offsetTop
            - (listEl.clientHeight / 2)
            + (playingItemEl.offsetHeight / 2);

        listEl.scrollTop = Math.max(0, target);
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

    // The songs to show for the current view
    // The number shown per song is always its Mureka position, set in renderSongs
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

        // Default Mureka view, the published order
        return cache.songs;
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

        // The current song is cached now, get upcoming songs ready in the background
        prefetchNext();
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

    // Save every cached song mp3 into the Mureka download folder
    async function downloadAll() {

        if (cache.songs.length === 0) {
            setStatus("Cache is empty, load first");
            return;
        }

        const items = cache.songs.map(function (s) {
            return { url: songUrl(s), filename: "Mureka/" + fileName(s) };
        }).filter(function (it) {
            return it.url;
        });

        setStatus("Saving " + items.length + " songs to the Mureka folder...");
        requestDownload(items);
    }

    // Reflect the running state on the cache button
    function updateCacheButton() {

        if (cacheButton) {
            cacheButton.textContent = cacheRunning ? "Stop" : "Cache all";
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

        for (let i = 0; i < artTiles.length; i += 1) {

            const rel = i - ART_SIDE_TILES;
            const x = base + rel * cover + drag;

            artTiles[i].style.transform = "translateX(" + x + "px)";

            // Blur grows with how far the tile center sits from the wrapper center
            const tileCenter = x + cover / 2;
            const dist = Math.abs(tileCenter - w / 2);
            const factor = Math.min(1, dist / cover);
            const blur = factor * ART_SIDE_BLUR;

            artTiles[i].style.filter = blur > 0.05 ? "blur(" + blur.toFixed(2) + "px)" : "none";
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
    function updatePlayerInfo(song) {

        updateMediaMetadata(song);

        if (!playerTitle) {
            return;
        }

        if (!song) {

            playerTitle.textContent = "Nothing playing";

            if (artWrapEl) {
                artWrapEl.style.display = "none";
            }

            updateSeekDisplay();
            updatePlayPause();
            return;
        }

        playerTitle.textContent = song.title || "Untitled";

        if (artWrapEl) {
            artWrapEl.style.display = coverUrl(song) ? "block" : "none";
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

    // Tell the OS what is playing, so playerctl metadata and art are correct
    function updateMediaMetadata(song) {

        if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") {
            return;
        }

        if (!song) {

            try {
                navigator.mediaSession.playbackState = "none";
            } catch (e) {
            }

            return;
        }

        try {
            const art = coverUrl(song);
            const artwork = art ? [{ src: art, sizes: "512x512" }] : [];

            navigator.mediaSession.metadata = new MediaMetadata({
                title: song.title || "Untitled",
                artist: (song.genres || []).join(", ") || "Mureka",
                album: "Mureka",
                artwork: artwork
            });
        } catch (e) {
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

        minimizeBtn = document.createElement("span");
        minimizeBtn.style.cssText = "flex:0 0 auto;color:#aaa;font-size:12px";

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

        // Right side of the header holds the gear and the minimize indicator
        const headerRight = document.createElement("div");
        headerRight.style.cssText = "display:flex;align-items:center;gap:10px;flex:0 0 auto";
        headerRight.appendChild(settingsBtn);
        headerRight.appendChild(minimizeBtn);

        header.appendChild(headerTitle);
        header.appendChild(headerRight);
        header.addEventListener("mousedown", startDrag);

        // Everything below the header lives in the body, which can collapse
        bodyEl = document.createElement("div");
        bodyEl.id = "mureka-player-body";

        statusEl = document.createElement("div");
        statusEl.style.marginBottom = "8px";

        const rowOne = document.createElement("div");
        rowOne.style.cssText = "display:flex;gap:6px;margin-bottom:6px";

        loadButton = makeButton("Load", "#48e1eb", "#000", run);
        const clearButton = makeButton("Clear", "#444", "#fff", clearCache);
        feedButton = makeButton(feed().label, "#444", "#fff", switchFeed);
        feedButton.title = "Switch between published and all songs";

        rowOne.appendChild(loadButton);
        rowOne.appendChild(clearButton);
        rowOne.appendChild(feedButton);

        const rowThree = document.createElement("div");
        rowThree.style.cssText = "display:flex;gap:6px;margin-bottom:8px";

        cacheButton = makeButton("Cache all", "#444", "#fff", cacheAll);
        downloadButton = makeButton("Download all", "#444", "#fff", downloadAll);

        rowThree.appendChild(cacheButton);
        rowThree.appendChild(downloadButton);

        // Player block, album art on top, then title, seek bar and play control
        const playerEl = document.createElement("div");
        playerEl.style.marginBottom = "8px";

        // A box that holds the masked strip, plus optional side nav buttons that
        // must sit outside the mask so they are not faded at the edges
        const artBox = document.createElement("div");
        artBox.style.cssText = "position:relative";

        // The album art is a coverflow strip, the center cover with side covers
        // that peek in and fade and blur toward the edges
        artWrapEl = document.createElement("div");
        artWrapEl.id = "mureka-player-art-wrap";
        artWrapEl.style.cssText = "position:relative;width:100%;border-radius:8px;overflow:hidden;margin-bottom:8px;background:#000;display:none;touch-action:pan-y";

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

        playerTitle = document.createElement("div");
        playerTitle.textContent = "Nothing playing";
        playerTitle.style.cssText = "font-weight:600;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";

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
        playerEl.appendChild(playerTitle);
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
            // On a phone, fill the screen, shrink the art a touch and let the
            // list grow into the remaining height instead of a fixed box
            + "@media (max-width:640px){"
            + "#mureka-player-panel{top:0 !important;left:0 !important;right:0 !important;width:100vw !important;height:100vh !important;height:100dvh !important;max-width:none !important;border-radius:0 !important;padding:10px !important;box-sizing:border-box !important;font-size:12px !important}"
            + "#mureka-player-body{display:flex !important;flex-direction:column !important;flex:1 1 auto !important;min-height:0 !important}"
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
        viewRow.style.cssText = "display:flex;gap:6px;margin-top:6px";

        viewButtons.mureka = makeButton("Mureka", "#333", "#fff", function () {
            setView("mureka");
        });
        viewButtons.mureka.title = "Published order";

        viewButtons.queue = makeButton("Queue", "#333", "#fff", function () {
            setView("queue");
        });
        viewButtons.queue.title = "Current song and what plays next";

        viewButtons.alpha = makeButton("A-Z", "#333", "#fff", function () {
            setView("alpha");
        });
        viewButtons.alpha.title = "Alphabetical by title";

        viewRow.appendChild(viewButtons.mureka);
        viewRow.appendChild(viewButtons.queue);
        viewRow.appendChild(viewButtons.alpha);

        listEl = document.createElement("div");
        listEl.id = "mureka-player-list";
        listEl.style.cssText = "position:relative;height:240px;box-sizing:border-box;overflow:auto;border-top:1px solid #333;padding-top:6px;margin-top:6px";

        bodyEl.appendChild(statusEl);
        bodyEl.appendChild(rowOne);
        bodyEl.appendChild(rowThree);
        bodyEl.appendChild(playerEl);
        bodyEl.appendChild(searchRow);
        bodyEl.appendChild(viewRow);
        bodyEl.appendChild(listEl);

        panel.appendChild(header);
        panel.appendChild(bodyEl);
        document.body.appendChild(panel);

        renderList();
        setStatus("Cached songs: " + cache.songs.length);

        buildContextMenu();
        buildSettings();
        requestPersistentStorage();
        refreshCachedIds();
        updateShuffleButton();
        updateViewButtons();

        // Shuffle and repeat already start from the settings defaults
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

        // Refresh the start feed on launch when the user asked for it
        maybeAutoRefresh();

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

            // Hand sizing back to the draggable desktop dock
            panelEl.style.removeProperty("top");
            panelEl.style.removeProperty("height");
            restorePosition();
            return;
        }

        const vv = window.visualViewport;
        const top = vv ? vv.offsetTop : 0;
        const height = vv ? vv.height : window.innerHeight;

        // Inline important beats the media query so the exact pixels win
        panelEl.style.setProperty("top", top + "px", "important");
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

    // Reflect the running state on the load button
    function updateButton() {

        if (loadButton) {
            loadButton.textContent = running ? "Stop" : "Load";
        }
    }

    // Render the cached song list
    function renderList() {

        renderSongs(displaySongs());
    }

    // Build one list row for a song
    // number may be null to leave the number column blank, as for a pinned song
    // dimmed greys the row, used for already played songs in the queue view
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

        // Mark a song that is not published, in any view
        if (song.publish_state != null && song.publish_state !== 1) {

            const badge = document.createElement("span");
            badge.textContent = "draft";
            badge.style.cssText = "flex:0 0 auto;margin-left:6px;padding:0 5px;border-radius:4px;background:#3a3a42;color:#bbb;font-size:11px;line-height:16px";
            item.appendChild(badge);
        }

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
    function renderSongs(songs) {

        if (!listEl) {
            return;
        }

        // Identify the playing song by its id so the highlight is feed independent
        const playingId = currentSong ? currentSong.song_id : null;

        // The displayed number is the song position in the Mureka order, fixed
        // across every view so a song keeps the same number everywhere
        const numberById = new Map();

        cache.songs.forEach(function (s, i) {
            numberById.set(s.song_id, i + 1);
        });

        listEl.textContent = "";
        playingItemEl = null;

        const query = searchQuery;
        let shown = 0;

        // In the queue view, songs before the current position are already played
        const playedIds = (listView === "queue" && queuePos > 0)
            ? new Set(queue.slice(0, queuePos).map(function (s) {
                return s.song_id;
            }))
            : null;

        songs.forEach(function (song) {

            const title = (song.title || "").trim() || "Untitled";

            // Skip rows that do not match the current search text
            if (query && title.toLowerCase().indexOf(query) === -1) {
                return;
            }

            shown += 1;

            const isPlaying = song.song_id === playingId;
            const dimmed = playedIds ? playedIds.has(song.song_id) : false;
            const item = buildSongRow(song, numberById.get(song.song_id), isPlaying, dimmed);

            if (isPlaying) {
                playingItemEl = item;
            }

            listEl.appendChild(item);
        });

        // Amnesty, pin the playing song on top when this view does not contain it
        // This keeps a song from another feed visible until the next song starts
        if (currentSong && !playingItemEl && !query) {

            const item = buildSongRow(currentSong, numberById.get(currentSong.song_id), true);
            playingItemEl = item;
            listEl.insertBefore(item, listEl.firstChild);
        }

        // Tell the user when a search hides everything
        if (query && shown === 0) {

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

        // Playback section, autoplay plus the default play mode and repeat
        const playbackLabel = document.createElement("div");
        playbackLabel.textContent = "Playback";
        playbackLabel.style.cssText = "color:#bbb";

        const autoplayRow = makeBoolRow("Autoplay on start",
            function () { return settings.autoPlay; },
            function (v) { settings.autoPlay = v; });

        const shuffleRow = makeBoolRow("Shuffle",
            function () { return settings.shuffle; },
            function (v) { settings.shuffle = v; });

        const repeatLabel = document.createElement("div");
        repeatLabel.textContent = "Repeat";
        repeatLabel.style.cssText = "color:#bbb";

        const repeatRow = makeChoiceRow(
            [
                { label: "All", value: "all" },
                { label: "One", value: "one" },
                { label: "Off", value: "none" }
            ],
            function () { return settings.repeat; },
            function (v) { settings.repeat = v; });

        const cacheRow = makeStepperRow("Cache ahead",
            function () { return settings.prefetchCount; },
            function (v) { settings.prefetchCount = v; },
            0, 50);

        settingsEl.appendChild(head);
        settingsEl.appendChild(startLabel);
        settingsEl.appendChild(startRow);
        settingsEl.appendChild(refreshLabel);
        settingsEl.appendChild(pubRow);
        settingsEl.appendChild(allRow);
        settingsEl.appendChild(playbackLabel);
        settingsEl.appendChild(autoplayRow);
        settingsEl.appendChild(shuffleRow);
        settingsEl.appendChild(repeatLabel);
        settingsEl.appendChild(repeatRow);
        settingsEl.appendChild(cacheRow);

        panelEl.appendChild(settingsEl);

        updateStartButtons();
    }

    // Show the settings overlay, expanding the panel first if it is minimized
    function openSettings() {

        if (minimized) {
            setMinimized(false);
        }

        if (settingsEl) {
            settingsEl.style.display = "flex";
        }
    }

    // Hide the settings overlay
    function closeSettings() {

        if (settingsEl) {
            settingsEl.style.display = "none";
        }
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

        if (cached) {

            addMenuRow("Remove from cache", "#ff8a8a", function () {
                removeOne(song);
            });

        } else {

            addMenuRow("Cache", "#48e1eb", function () {
                cacheOne(song);
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
