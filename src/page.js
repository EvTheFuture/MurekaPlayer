/*
 * Mureka Player - load and play all your Mureka songs
 * The player, injected into the mureka.ai page
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

    // localStorage key that remembers whether the panel is minimized
    const MINIMIZED_KEY = "mureka_player_minimized";

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
    let shuffleMode = false;

    // UI element references
    let statusEl = null;
    let listEl = null;
    let loadButton = null;
    let feedButton = null;
    let cacheButton = null;
    let downloadButton = null;

    // The collapsible body and the minimize indicator
    let bodyEl = null;
    let minimizeBtn = null;
    let minimized = false;

    // The view buttons, keyed by view name
    let viewButtons = {};

    // Set of song_ids whose mp3 is present in the audio cache
    let cachedIds = new Set();

    // Current search box text, lowercased, empty means show all
    let searchQuery = "";

    // The list row of the currently playing song, used to scroll it into view
    let playingItemEl = null;

    // Which list view is active, one of mureka, queue or alpha
    let listView = "mureka";

    // The right-click options popup, built once and reused
    let contextMenuEl = null;

    // Player UI element references
    let playerArt = null;
    let playerTitle = null;
    let seekBar = null;
    let curTimeEl = null;
    let remTimeEl = null;
    let playPauseBtn = null;
    let shuffleBtn = null;

    // True while the user is dragging the seek bar, so timeupdate does not fight it
    let isSeeking = false;

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

                const net = await fetch(direct);

                if (net && net.ok) {
                    await store.put(direct, net.clone());
                    resp = net;

                    // The full file is now stored, so light its cached marker
                    cachedIds.add(song.song_id);
                    renderList();
                }
            }

            if (resp) {
                const blob = await resp.blob();

                return URL.createObjectURL(blob);
            }
        } catch (e) {
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

            const net = await fetch(url);

            if (!net || !net.ok) {
                return false;
            }

            await store.put(url, net.clone());

            return true;
        } catch (e) {
            return false;
        }
    }

    // Get the mp3 blob for a song, using the cache and storing it if missing
    // Ask the extension to save these files into the Mureka download folder
    // The content script relays this to the background downloads API, which
    // writes to a subfolder with no Save As dialog
    function requestDownload(items) {

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
            playNext();
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

    // Advance to the next song in the queue
    function playNext() {

        if (queuePos < queue.length - 1) {
            queuePos += 1;
            playCurrent();
            return;
        }

        // Past the end, report finished
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
        }

        setStatus(shuffleMode ? "Shuffle on" : "Shuffle off");
    }

    // Highlight the shuffle button when shuffle mode is active
    function updateShuffleButton() {

        if (!shuffleBtn) {
            return;
        }

        shuffleBtn.style.background = shuffleMode ? "#48e1eb" : "#333";
        shuffleBtn.style.color = shuffleMode ? "#000" : "#fff";
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

        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
            currentObjectUrl = null;
        }

        currentSong = null;
        queue = [];
        queuePos = -1;
        renderList();
        updatePlayerInfo(null);
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

    // Update the album art and title shown in the player
    function updatePlayerInfo(song) {

        updateMediaMetadata(song);

        if (!playerTitle) {
            return;
        }

        if (!song) {

            playerTitle.textContent = "Nothing playing";

            if (playerArt) {
                playerArt.style.display = "none";
                playerArt.removeAttribute("src");
            }

            updateSeekDisplay();
            updatePlayPause();
            return;
        }

        playerTitle.textContent = song.title || "Untitled";

        const cover = coverUrl(song);

        if (playerArt) {

            if (cover) {
                playerArt.src = cover;
                playerArt.style.display = "block";
            } else {
                playerArt.style.display = "none";
                playerArt.removeAttribute("src");
            }
        }

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

        panel.style.cssText = [
            "position:fixed",
            "bottom:16px",
            "right:16px",
            "z-index:999999",
            "background:#1d1d22",
            "color:#fff",
            "font:13px/1.4 sans-serif",
            "padding:12px",
            "border-radius:10px",
            "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
            "width:300px"
        ].join(";");

        // Header bar, clicking it minimizes or expands the panel
        const header = document.createElement("div");
        header.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;user-select:none;-moz-user-select:none";
        header.title = "Click to minimize or expand";

        const headerTitle = document.createElement("div");
        headerTitle.textContent = "Mureka Player";
        headerTitle.style.cssText = "font-weight:600";

        minimizeBtn = document.createElement("span");
        minimizeBtn.style.cssText = "flex:0 0 auto;color:#aaa;font-size:12px";

        header.appendChild(headerTitle);
        header.appendChild(minimizeBtn);
        header.addEventListener("click", toggleMinimize);

        // Everything below the header lives in the body, which can collapse
        bodyEl = document.createElement("div");
        bodyEl.style.marginTop = "10px";

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

        playerArt = document.createElement("img");
        playerArt.style.cssText = "width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;margin-bottom:8px;display:none;background:#000";

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

        // Transport row, icon buttons for previous, play/pause, next, shuffle, stop
        const controlRow = document.createElement("div");
        controlRow.style.cssText = "display:flex;gap:6px";

        const prevBtn = makeIconButton("\u23EE", "Previous", playPrev);
        playPauseBtn = makeIconButton("\u25B6", "Play / Pause", togglePlayPause);
        const nextBtn = makeIconButton("\u23ED", "Next", playNext);

        shuffleBtn = makeIconButton(makeShuffleIcon(), "Shuffle (toggle)", toggleShuffle);
        const stopBtn = makeIconButton("\u23F9", "Stop", stopPlay);

        controlRow.appendChild(prevBtn);
        controlRow.appendChild(playPauseBtn);
        controlRow.appendChild(nextBtn);
        controlRow.appendChild(shuffleBtn);
        controlRow.appendChild(stopBtn);

        playerEl.appendChild(playerArt);
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
            + "#mureka-search-input::-moz-placeholder{color:#aaa !important;opacity:1 !important}";
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
        requestPersistentStorage();
        refreshCachedIds();
        updateShuffleButton();
        updateViewButtons();

        // Restore whether the panel was left minimized last time
        let startMinimized = false;

        try {
            startMinimized = localStorage.getItem(MINIMIZED_KEY) === "1";
        } catch (e) {
        }

        setMinimized(startMinimized);
    }

    // Collapse or expand the panel body and remember the choice
    function toggleMinimize() {

        setMinimized(!minimized);

        try {
            localStorage.setItem(MINIMIZED_KEY, minimized ? "1" : "0");
        } catch (e) {
        }
    }

    // Apply the minimized state to the body and the indicator
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
        item.style.cssText = "display:flex;align-items:center;padding:3px 2px;cursor:pointer;user-select:none;-moz-user-select:none";
        item.title = "Click to play, right-click for options";

        if (dimmed) {
            item.style.opacity = "0.45";
        }

        // A dot marks a cached song, hidden state keeps the text aligned
        const dot = document.createElement("span");
        dot.textContent = "\u25CF";
        dot.style.cssText = "color:#48e1eb;margin-right:6px;flex:0 0 auto;visibility:"
            + (cachedIds.has(song.song_id) ? "visible" : "hidden");

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

        item.addEventListener("click", function () {
            playFrom(song.song_id);
        });

        item.addEventListener("contextmenu", function (ev) {
            ev.preventDefault();
            showContextMenu(ev.clientX, ev.clientY, song);
        });

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

    // Wait for the document body before injecting the panel
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", buildPanel);
    } else {
        buildPanel();
    }
})();
