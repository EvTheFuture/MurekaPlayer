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

// Small promise based delay helper
function sleep(ms) {

    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

// Download a list of files one at a time into their given relative paths
async function downloadMany(items) {

    let ok = 0;
    let fail = 0;

    for (const item of items) {

        try {

            await browser.downloads.download({
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

    return { ok: ok, fail: fail };
}

// Returning the promise sends its resolved value back as the response
browser.runtime.onMessage.addListener(function (msg) {

    if (msg && msg.type === "downloadMany") {
        return downloadMany(msg.items);
    }
});
