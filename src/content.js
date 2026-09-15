/*
 * Mureka Player - load and play all your Mureka songs
 * Content script, marks the host, injects the shared player and relays downloads
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
// It tags the document so the shared player uses the folder download relay,
// injects the player into the page context for full page privileges, and relays
// the player download requests to the background script

(function () {
    "use strict";

    // Firefox exposes the promise based browser namespace, Chromium only has
    // chrome. One alias keeps the rest of this file identical for both
    const api = globalThis.browser || globalThis.chrome;

    // Tag the document so the shared player knows it runs inside the extension
    // and should use the folder download relay instead of a browser download
    document.documentElement.setAttribute("data-mureka-host", "extension");

    // Inject the shared player so it runs in the page context with full privileges
    const script = document.createElement("script");

    script.src = api.runtime.getURL("src/player.js");

    script.addEventListener("load", function () {
        script.remove();
    });

    (document.head || document.documentElement).appendChild(script);

    // Ask the background script to save the files, and hand back the outcome.
    // Chromium resolves sendMessage with undefined when the worker goes away
    // mid batch, so a missing reply is reported rather than throwing
    async function relayDownload(items) {

        try {

            const result = await api.runtime.sendMessage({
                type: "downloadMany",
                items: items
            });

            if (result && typeof result.ok === "number") {
                return result;
            }

            return { ok: 0, fail: items.length };
        } catch (e) {

            return { ok: 0, fail: items.length };
        }
    }

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

            const result = await relayDownload(data.items);

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
