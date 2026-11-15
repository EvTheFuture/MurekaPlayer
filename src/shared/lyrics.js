    // Lyrics on a turning cylinder: the lines of a song, the breaks between
    // them and the roll that shows them. Shared by the player and the web
    // view's page, src/shared/lyrics.js, inlined into both by embed-webview.sh

    // From one line's start to the next at least this long is a break
    const CYL_BREAK_MS = 10000;

    // A line's sung length, per sound, when the song gives nothing to go by
    const CYL_UNIT_MS = 350;

    // How long a roll and a line coming into sight take
    const CYL_ROLL_MS = 340;
    const CYL_SHOW_MS = 600;

    // The sounds in a line, near enough: the vowel groups, or for a script
    // with no Latin vowels, Thai or Chinese, one for every two letters
    function cylUnits(text) {

        const s = String(text || "").toLowerCase();
        const groups = s.match(/[aeiouy\u00e0-\u00f6\u00f8-\u00ff]+/g);

        if (groups && groups.length > 0) {
            return groups.length;
        }

        return Math.max(1, Math.round(s.replace(/\s+/g, "").length / 2));
    }

    // The middle value, 0 for none
    function cylMedian(list) {

        if (list.length === 0) {
            return 0;
        }

        const s = list.slice().sort(function (a, b) {
            return a - b;
        });

        return s[Math.floor(s.length / 2)];
    }

    // One bar in milliseconds at the tempo, 0 without a tempo to trust
    function cylBar(bpm) {

        return bpm >= 50 && bpm <= 220 ? 240000 / bpm : 0;
    }

    // An end the song gave for a row that makes sense, else 0
    function cylRealEnd(rows, i) {

        const r = rows[i];
        const next = rows[i + 1];
        const e = r.e;

        if (typeof e !== "number" || !isFinite(e) || e <= r.t || e - r.t > 15000) {
            return 0;
        }

        if (next && e > next.t + 1000) {
            return 0;
        }

        return e;
    }

    // When each line ends, the song's own end where it gives one, else
    // worked out: the time per sound, from the lines the song ends or from
    // lines with the next one close after, in the line's own section when
    // it has at least three such lines, times the line's sounds, rounded up
    // to whole bars at the tempo, as sung lines fill whole bars
    function cylEnds(rows, bpm) {

        const n = rows.length;
        const ends = [];
        const songRates = [];
        const secRates = {};
        const bar = cylBar(bpm);

        for (let i = 0; i < n; i++) {

            const r = rows[i];
            const next = rows[i + 1];
            const real = cylRealEnd(rows, i);
            let span = 0;

            if (real) {
                span = real - r.t;
            } else if (next && next.t - r.t > 300 && next.t - r.t < CYL_BREAK_MS) {
                span = next.t - r.t;
            }

            if (span > 0) {

                const rate = span / cylUnits(r.text);
                const sec = String(r.s);

                songRates.push(rate);
                secRates[sec] = secRates[sec] || [];
                secRates[sec].push(rate);
            }
        }

        const songRate = cylMedian(songRates) || CYL_UNIT_MS;

        for (let i = 0; i < n; i++) {

            const r = rows[i];
            const next = rows[i + 1];
            const real = cylRealEnd(rows, i);

            if (real) {

                ends.push(real);
                continue;
            }

            const sec = secRates[String(r.s)] || [];
            const rate = sec.length >= 3 ? cylMedian(sec) : songRate;
            let len = cylUnits(r.text) * rate;

            // A little over a whole bar still counts as that bar
            if (bar) {
                len = Math.max(1, Math.ceil(len / bar - 0.25)) * bar;
            }

            len = Math.max(1500, Math.min(8000, len));

            if (next) {
                len = Math.min(len, Math.max(300, next.t - r.t));
            }

            ends.push(Math.round(r.t + len));
        }

        return ends;
    }

    // What the roll steps through: the lines, a break where one line's
    // start is far from the next one's, from the first line's end until the
    // next starts, and an empty step after the last line. A long wait before
    // the first line is a break too. The line after a break comes in sight
    // two bars ahead, 2 to 4 seconds, 3 without a tempo
    function cylSteps(rows, ends, bpm) {

        const steps = [];
        const bar = cylBar(bpm);
        const lead = bar ? Math.max(2000, Math.min(4000, 2 * bar)) : 3000;

        if (rows.length === 0) {
            return steps;
        }

        if (rows[0].t >= CYL_BREAK_MS) {
            steps.push({ kind: "pause", t: 0, until: rows[0].t, show: rows[0].t - lead });
        } else {
            steps.push({ kind: "blank", t: 0 });
        }

        for (let i = 0; i < rows.length; i++) {

            const r = rows[i];
            const next = rows[i + 1];

            steps.push({
                kind: "line",
                t: r.t,
                text: r.text,
                first: i > 0 && r.s !== undefined && r.s !== rows[i - 1].s
            });

            if (!next) {

                steps.push({ kind: "blank", t: Math.max(r.t + 300, ends[i]) });
                continue;
            }

            if (next.t - r.t >= CYL_BREAK_MS) {

                const at = Math.max(r.t + 500, Math.min(ends[i], next.t - 1500));

                steps.push({ kind: "pause", t: at, until: next.t, show: Math.max(at, next.t - lead) });
            }
        }

        return steps;
    }

    // Where the song is on the steps: the step reached, whether the line
    // after a break is in sight yet, and how far through a break it is
    function cylViewAt(steps, ms) {

        let idx = 0;

        for (let i = 0; i < steps.length; i++) {

            if (steps[i].t <= ms) {
                idx = i;
            } else {
                break;
            }
        }

        const s = steps[idx];

        if (!s || s.kind !== "pause") {
            return { idx: idx, reveal: true, progress: 0 };
        }

        return {
            idx: idx,
            reveal: ms >= s.show,
            progress: Math.max(0, Math.min(1, (ms - s.t) / Math.max(1, s.until - s.t)))
        };
    }

    // Five rows on a cylinder seen from the side: the one leaving over the
    // top, the line before, the line being sung facing straight out, the
    // next line and the one coming up from below. box is a positioned
    // element of its own for them
    function makeCylRoll(box) {

        const slots = [];

        for (let i = 0; i < 5; i++) {

            const el = document.createElement("div");

            el.style.position = "absolute";
            el.style.left = "0";
            el.style.right = "0";
            el.style.opacity = "0";
            el.style.whiteSpace = "nowrap";
            el.style.overflow = "hidden";
            el.style.textOverflow = "ellipsis";
            el.style.transformOrigin = "0 50%";
            el.style.backfaceVisibility = "hidden";
            el.style.willChange = "transform, opacity";
            box.appendChild(el);
            slots.push(el);
        }

        return { box: box, slots: slots, steps: [], geo: null, idx: -2, reveal: true };
    }

    // Size the cylinder: size is the sung line's text, line the spacing as
    // a share of it, side how big the lines before and after are against
    // it, sideShift how far right of the sung line they sit. Every row has
    // the same text size and weight, the turn makes the others smaller, so
    // the sung line is never bigger than the rows are wide
    function cylLayout(roll, layout) {

        const size = Math.max(10, layout.size);
        const lineH = Math.round(size * layout.line);
        const radius = lineH * 2;

        roll.geo = {
            size: size,
            lineH: lineH,
            radius: radius,
            step: 2 * Math.asin(lineH / (2 * radius)),
            side: layout.side,
            sx: layout.sideShift || 0
        };

        // Seen from far off, with no perspective: a near view slants the
        // letters of the turned rows more the further right they are, like
        // italics. The turn still squeezes them and side makes them smaller
        roll.box.style.height = (lineH * 4) + "px";

        for (const el of roll.slots) {

            el.style.top = Math.round(lineH * 1.5) + "px";
            el.style.height = lineH + "px";
            el.style.lineHeight = lineH + "px";
            el.style.fontSize = size + "px";
            el.style.fontWeight = "400";
        }

        roll.idx = -2;
    }

    // The turn between one step and the next, a little more where a new
    // section of the song starts straight after a line
    function cylGap(roll, j) {

        const a = roll.steps[j];
        const b = roll.steps[j + 1];
        const wide = a && b && a.kind === "line" && b.kind === "line" && b.first;

        return roll.geo.step * (wide ? 1.4 : 1);
    }

    // How far round step r is from step c, upwards negative
    function cylAngle(roll, c, r) {

        if (c < 0 || c >= roll.steps.length) {
            return (r - c) * roll.geo.step;
        }

        let a = 0;

        for (let j = c; j < r; j++) {
            a += cylGap(roll, j);
        }

        for (let j = r; j < c; j++) {
            a -= cylGap(roll, j);
        }

        return a;
    }

    // Whether step r shows when the song is at the view: a break only while
    // it is the step reached, the line after it once in sight, an empty
    // step never
    function cylShown(roll, r, view) {

        const s = roll.steps[r];

        if (!s || view.idx < 0) {
            return false;
        }

        if (s.kind === "pause") {
            return r === view.idx;
        }

        if (s.kind !== "line") {
            return false;
        }

        const at = roll.steps[view.idx];

        return !(r === view.idx + 1 && at && at.kind === "pause" && !view.reveal);
    }

    // A row's look: turned on the cylinder by its angle, and by how many
    // rows it is from the sung one smaller towards the sides as side asks,
    // dimmer and two rows away gone. The extra turn before a new section
    // only moves a row, so the line after it looks like any other. The
    // sung line is drawn thicker with an outline of its own color, which
    // grows and fades smoothly and keeps the row as wide as before, where a
    // heavier font would jump to it and widen the line
    function cylPose(roll, angle, off, shown) {

        const g = roll.geo;
        const k = Math.min(1, Math.abs(off));
        const far = Math.max(0, Math.min(1, Math.abs(off) - 1));
        const scale = (1 - (1 - g.side) * k) * (1 - 0.25 * far);
        const opacity = shown ? (1 - 0.25 * k) * (1 - far) : 0;
        const c = Math.round(255 - 34 * k);
        const w = Math.round(g.size * 0.03 * (1 - k) * 100) / 100;
        const ink = "rgba(" + c + ", " + c + ", " + c + ", " + (1 - k) + ")";

        return {
            transform: "translateX(" + Math.round(g.sx * k) + "px) translateZ(" + (-g.radius) + "px) rotateX("
                + (-angle) + "rad) translateZ(" + g.radius + "px) scale(" + scale + ")",
            opacity: opacity,
            color: "rgb(" + c + ", " + c + ", " + c + ")",
            textShadow: w + "px 0 0 " + ink + ", " + (-w) + "px 0 0 " + ink + ", 0 " + w + "px 0 " + ink
                + ", 0 " + (-w) + "px 0 " + ink + ", 0 1px 3px rgba(0, 0, 0, 0.8)"
        };
    }

    // A row's words, or for a break three dots that light up as it goes
    function cylFill(el, step) {

        if (step && step.kind === "pause") {

            if (el.dataset.dots !== "1") {

                el.textContent = "";
                el.dataset.dots = "1";

                for (let i = 0; i < 3; i++) {

                    const dot = document.createElement("span");

                    dot.textContent = "\u25CF";
                    dot.style.display = "inline-block";
                    dot.style.marginRight = "0.5em";
                    dot.style.fontSize = "0.7em";
                    dot.style.opacity = "0.3";
                    dot.style.transition = "opacity 0.4s ease";
                    el.appendChild(dot);
                }
            }

            return;
        }

        el.dataset.dots = "";
        el.textContent = step && step.kind === "line" ? step.text : "";
    }

    // Light the break's dots as far as it has come, one a quarter through
    function cylDots(roll, view) {

        const el = roll.slots[2];

        if (el.dataset.dots !== "1") {
            return;
        }

        const dots = el.children;

        for (let i = 0; i < dots.length; i++) {
            dots[i].style.opacity = view.progress >= (i + 1) / 4 ? "1" : "0.3";
        }
    }

    function cylStop(el) {

        if (!el.getAnimations) {
            return;
        }

        try {

            for (const a of el.getAnimations()) {
                a.cancel();
            }
        } catch (e) {
            // Nothing running
        }
    }

    // Show the steps at the song's place in milliseconds. One step on rolls
    // the cylinder a step, the line after a break fades in where it waits,
    // anything else, a seek, a new song or force, puts the rows in place
    function cylShow(roll, ms, force) {

        if (!roll.geo) {
            return;
        }

        const view = cylViewAt(roll.steps, ms);
        const old = { idx: roll.idx, reveal: roll.reveal };

        if (!force && view.idx === old.idx && view.reveal === old.reveal) {

            cylDots(roll, view);
            return;
        }

        const rolled = !force && view.idx === old.idx + 1;
        const revealed = !force && view.idx === old.idx;

        for (let i = 0; i < 5; i++) {

            const r = view.idx + i - 2;
            const el = roll.slots[i];
            const to = cylPose(roll, cylAngle(roll, view.idx, r), r - view.idx, cylShown(roll, r, view));

            cylStop(el);
            cylFill(el, roll.steps[r]);
            el.style.transform = to.transform;
            el.style.opacity = String(to.opacity);
            el.style.color = to.color;
            el.style.textShadow = to.textShadow;
            el.style.zIndex = i === 2 ? "3" : "2";

            if (!el.animate || (!rolled && !revealed)) {
                continue;
            }

            const from = cylPose(roll, cylAngle(roll, old.idx, r), r - old.idx, cylShown(roll, r, old));

            if (revealed && from.opacity === to.opacity) {
                continue;
            }

            el.animate([from, to], {
                duration: rolled ? CYL_ROLL_MS : CYL_SHOW_MS,
                easing: "ease-out"
            });
        }

        roll.idx = view.idx;
        roll.reveal = view.reveal;
        cylDots(roll, view);
    }
