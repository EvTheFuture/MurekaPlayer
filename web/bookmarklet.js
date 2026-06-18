/*
 * Mureka Player bookmarklet loader
 * Copyright (C) 2026 EvTheFuture
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// Readable source of the bookmarklet loader. Two paste-ready minified forms
// live next to this file:
//   web/bookmarklet.min.js       latest release, cached and fast
//   web/bookmarklet-dev.min.js   newest in-development code, re-fetched each run
// The dev form only differs by its src, which is:
//   https://evthefuture.github.io/MurekaPlayer/src/player.js?v=<timestamp>
// To use one, bookmark mureka.ai, set the bookmark URL to the one-liner, then
// run it from the Bookmarks menu while logged in.

(function () {
    "use strict";

    // If the player is already on the page, toggle it instead of loading again
    if (window.__murekaPlayerToggle) {
        window.__murekaPlayerToggle();
        return;
    }

    // Inject the shared player, latest release served from this repo via jsDelivr
    const script = document.createElement("script");

    script.src = "https://cdn.jsdelivr.net/gh/EvTheFuture/MurekaPlayer@latest/src/player.js";

    document.body.appendChild(script);
})();
