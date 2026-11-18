    // Small helpers: the debug log's values, a percent as shown, toast times, the cover editor, the kinds of notifications.
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

    function dbgFlag(v) {

        return v ? "y" : "n";
    }

    // The kinds of Mureka's notifications, by biz_code: a name, the colour
    // of the disc in the list and its glyph, 24 units square with round
    // strokes as the other icons. A like, a comment, a playlist add, a
    // shared song looked at and a follow; anything else gets the bell
    const MSG_KINDS = {
        "1001": {
            name: "Like",
            color: "#ff6b9a",
            shapes: [
                ["path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" }]
            ]
        },
        "1002": {
            name: "Comment",
            color: "#ffb454",
            shapes: [
                ["path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }]
            ]
        },
        "1003": {
            name: "Playlist",
            color: "#b388ff",
            shapes: [
                ["line", { x1: "8", y1: "6", x2: "21", y2: "6" }],
                ["line", { x1: "8", y1: "12", x2: "21", y2: "12" }],
                ["line", { x1: "8", y1: "18", x2: "14", y2: "18" }],
                ["line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }],
                ["line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }],
                ["line", { x1: "3", y1: "18", x2: "3.01", y2: "18" }],
                ["line", { x1: "19", y1: "15", x2: "19", y2: "21" }],
                ["line", { x1: "16", y1: "18", x2: "22", y2: "18" }]
            ]
        },
        "1004": {
            name: "Shared song",
            color: "#64b5f6",
            shapes: [
                ["path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }],
                ["circle", { cx: "12", cy: "12", r: "3" }]
            ]
        },
        "2004": {
            name: "Mention",
            color: "#4dd0e1",
            shapes: [
                ["circle", { cx: "12", cy: "12", r: "4" }],
                ["path", { d: "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" }]
            ]
        },
        "2001": {
            name: "Follow",
            color: "#5fd38d",
            shapes: [
                ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }],
                ["circle", { cx: "8.5", cy: "7", r: "4" }],
                ["line", { x1: "20", y1: "8", x2: "20", y2: "14" }],
                ["line", { x1: "23", y1: "11", x2: "17", y2: "11" }]
            ]
        }
    };

    function msgKind(code) {

        return MSG_KINDS[String(code)] || {
            name: "Notification",
            color: "#9aa0a6",
            shapes: [
                ["path", { d: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" }],
                ["path", { d: "M13.73 21a2 2 0 0 1-3.46 0" }]
            ]
        };
    }
