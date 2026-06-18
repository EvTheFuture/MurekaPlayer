/*
 * Mureka Player - load and play all your Mureka songs
 * Bookmarklet loader, injects the shared player into the mureka.ai page
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

// Readable source of the bookmarklet loader. The minified, paste-ready form is
// in web/bookmarklet.min.js, and the README shows it too. To use it, save a
// bookmark on mureka.ai, set the bookmark URL to that one-liner, then run it
// from the Bookmarks menu while logged in.

(function () {
    "use strict";

    // If the player is already on the page, toggle it instead of loading again
    if (window.__murekaPlayerToggle) {
        window.__murekaPlayerToggle();
        return;
    }

    // Inject the shared player, served from this repo through jsDelivr
    const script = document.createElement("script");

    script.src = "https://cdn.jsdelivr.net/gh/EvTheFuture/MurekaPlayer@main/src/player.js";

    document.body.appendChild(script);
})();
