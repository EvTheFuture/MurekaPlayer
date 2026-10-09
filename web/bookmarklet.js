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
//   web/bookmarklet.min.js       one tagged release, checked by its hash
//   web/bookmarklet-dev.min.js   newest in-development code, re-fetched each run
// The dev form loads, without a hash:
//   https://evthefuture.github.io/MurekaPlayer/src/player.js?v=<timestamp>
// The release form is written by release-bookmarklet.sh after a release is
// tagged, which fills in the tag and the hash below. To use one, bookmark
// mureka.ai, set the bookmark URL to the one-liner, then run it from the
// Bookmarks menu while logged in.

(function () {
    "use strict";

    // If the player is already on the page, toggle it instead of loading again
    if (window.__murekaPlayerToggle) {
        window.__murekaPlayerToggle();
        return;
    }

    // Inject the shared player from one tagged release, served by jsDelivr.
    // The browser runs it only when it matches the hash, so a later change
    // to the repository or to jsDelivr cannot change what runs here
    const script = document.createElement("script");

    script.src = "https://cdn.jsdelivr.net/gh/EvTheFuture/MurekaPlayer@TAG/src/player.js";
    script.integrity = "HASH";
    script.crossOrigin = "anonymous";

    document.body.appendChild(script);
})();
