/*
 * Mureka Player - load and play all your Mureka songs
 * Background script, saves downloads to a folder
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

// Mureka Player background script
// Saves requested mp3 URLs into the Mureka subfolder of the download directory
// Using saveAs false means no Save As dialog, even when the browser is set to
// always ask, and the relative path puts every file under a Mureka folder
//
// This runs as an event page on Firefox and as a service worker on Chromium.
// A service worker is stopped once it looks idle, which a long download batch
// must survive, so the loop below keeps the worker busy while it works

// Firefox exposes the promise based browser namespace, Chromium only has chrome
const api = globalThis.browser || globalThis.chrome;

// Small promise based delay helper
function sleep(ms) {

    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

// Chromium stops a service worker after roughly thirty seconds of inactivity,
// and a plain timer does not count as activity. Calling an extension API does,
// so this ping holds the worker open while a batch is still running. Firefox
// ignores it beyond the harmless call
let keepAliveTimer = null;

function startKeepAlive() {

    if (keepAliveTimer || !api.runtime.getPlatformInfo) {
        return;
    }

    keepAliveTimer = setInterval(function () {

        try {
            api.runtime.getPlatformInfo(function () {
            });
        } catch (e) {
        }
    }, 20000);
}

function stopKeepAlive() {

    if (!keepAliveTimer) {
        return;
    }

    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
}

// Download a list of files one at a time into their given relative paths
async function downloadMany(items) {

    let ok = 0;
    let fail = 0;

    startKeepAlive();

    try {

        for (const item of items) {

            try {

                await api.downloads.download({
                    url: item.url,
                    filename: item.filename,
                    saveAs: false,
                    conflictAction: "uniquify"
                });

                ok += 1;

            } catch (e) {
                fail += 1;
            }

            // A short gap keeps the download manager from choking on a big batch
            await sleep(200);
        }

    } finally {
        stopKeepAlive();
    }

    return { ok: ok, fail: fail };
}

// Chromium does not accept a promise returned from a message listener, it wants
// sendResponse with a truthy return to keep the channel open. Firefox supports
// that form too, so this one shape works in both
api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {

    if (msg && msg.type === "downloadMany") {

        downloadMany(msg.items).then(sendResponse, function () {
            sendResponse({ ok: 0, fail: msg.items.length });
        });

        return true;
    }
});
