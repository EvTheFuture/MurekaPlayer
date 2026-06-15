/*
 * Mureka Player - load and play all your Mureka songs
 * Content script, injects the player and relays downloads
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

// Mureka Player content script
// Runs in the isolated extension world on mureka.ai pages
// It injects the player into the page context so the player has full page
// privileges, and relays the player download requests to the background
// script, which performs folder downloads through the downloads API

(function () {
    "use strict";

    // Inject the player so it runs in the page context with full page privileges
    const script = document.createElement("script");

    script.src = browser.runtime.getURL("src/page.js");

    script.addEventListener("load", function () {
        script.remove();
    });

    (document.head || document.documentElement).appendChild(script);

    // Relay download requests coming from the injected player
    window.addEventListener("message", async function (ev) {

        if (ev.source !== window) {
            return;
        }

        const data = ev.data;

        if (!data || data.source !== "mureka-player-page") {
            return;
        }

        if (data.type === "downloadMany") {

            let result = { ok: 0, fail: 0 };

            try {
                result = await browser.runtime.sendMessage({
                    type: "downloadMany",
                    items: data.items
                });
            } catch (e) {
            }

            // Report the outcome back to the player so it can update the status
            window.postMessage({
                source: "mureka-player-content",
                type: "downloadResult",
                ok: result.ok,
                fail: result.fail
            }, "*");
        }
    });
})();
