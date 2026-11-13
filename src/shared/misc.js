    // Small helpers: the debug log's values, a percent as shown, toast times, the cover editor.
    // Shared by the player and the web view's page, src/shared/misc.js,
    // inlined into both by embed-webview.sh

    // What came with a media action, the seek step or the position
    function dbgDetails(d) {

        if (!d) {
            return "";
        }

        const parts = [];

        if (typeof d.seekOffset === "number") {
            parts.push("offset " + d.seekOffset);
        }

        if (typeof d.seekTime === "number") {
            parts.push("time " + dbgNum(d.seekTime));
        }

        if (d.fastSeek) {
            parts.push("fast");
        }

        return parts.length ? " (" + parts.join(", ") + ")" : "";
    }

    // Round to one decimal, and show a dash for a missing value
    function dbgNum(v) {

        if (typeof v !== "number" || !isFinite(v)) {
            return "-";
        }

        return String(Math.round(v * 10) / 10);
    }

    // A short description of an element, enough to tell what a tap hit.
    // A tap on an icon inside a button names the button
    function dbgTarget(el) {

        if (!el || !el.tagName) {
            return "-";
        }

        if (el.closest) {
            el = el.closest("button, a, input, select, textarea, label, [role=button], [title], [aria-label], [id]") || el;
        }

        let text = el.tagName.toLowerCase();

        if (el.id) {
            text += "#" + el.id;
        }

        const label = el.getAttribute("aria-label") || el.getAttribute("title");

        if (label) {
            text += " \"" + label.slice(0, 30) + "\"";
        } else if (el.textContent && el.textContent.trim()) {
            text += " \"" + el.textContent.trim().replace(/\s+/g, " ").slice(0, 30) + "\"";
        }

        return text;
    }

    // A level in percent as it is shown: whole, or with one decimal under
    // the first step where the levels lie closer
    function pctText(p) {

        const v = Math.round((Number(p) || 0) * 10) / 10;

        return Number.isInteger(v) ? String(v) : v.toFixed(1);
    }

    // How long a note stays up: long enough to read its words, a little
    // longer for what did not work
    function toastShowMs(text, kind) {

        const ms = Math.max(2800, Math.min(8000, 2200 + String(text).length * 45));

        return kind === "bad" ? ms + 1500 : ms;
    }

    // The cover editor: the picture in a square, moved by dragging and
    // zoomed with two fingers, the mouse wheel or the slider. Nothing is
    // drawn on a canvas, which a browser guarding against fingerprinting
    // hands back scrambled. The picture itself is shown moved and scaled,
    // and the square is answered in the picture's own pixels, x, y and
    // size, for Mureka's storage to cut out. done hears the square, or null
    // when it was cancelled, and a reason when the picture could not be read
    function openCoverEditor(file, title, host, big, done) {

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = function () {
            buildCoverEditor(img, url, title, host, big, done);
        };

        img.onerror = function () {

            URL.revokeObjectURL(url);
            done(null, "this browser cannot read the picture");
        };

        img.src = url;
    }
