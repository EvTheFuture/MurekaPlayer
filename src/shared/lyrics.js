    // Lyrics on a turning cylinder: the lines of a song, the breaks between
    // them and the roll that shows them. Shared by the player and the web
    // view's page, src/shared/lyrics.js, inlined into both by embed-webview.sh

    // From one line's start to the next at least this long is a break
    const CYL_BREAK_MS = 10000;

    // How long into a break the lines before it stay, before they roll
    // away up the drum and only the dots are left
    const CYL_CLEAR_MS = 3000;

    // A line's sung length, per sound, when the song gives nothing to go by
    const CYL_UNIT_MS = 350;

    // How far apart the lines are along the drum's face, in lines: the turn
    // from one to the next comes from it and the drum's size, a small drum
    // turning them far round and bending the sung line, a big one showing
    // more of them flatter. How far off the drum is seen from, in widths of
    // the lyrics, the strips each row is cut into to wrap it round the
    // drum, and the rows: the sung one, two each side, and one more each
    // side rolling in and out of sight
    const CYL_ARC = 1.05;
    const CYL_EYE = 1.2;
    const CYL_STRIPS = 8;
    const CYL_ROWS = 7;
    const CYL_MID = 3;

    // How strong a row shows by how many rows it is from the sung one
    const CYL_FADE = [1, 0.8, 0.4, 0];

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

    // Mureka now and then times a line far off: one starting right after
    // the line before it, which is then gone before it is sung, or one
    // starting just before the next, gone before it is heard. A line that
    // lasts less than a third of what its sounds take, and under 1.5 s, has
    // its time shared with the neighbour that has more to spare: the two
    // split the span of both by their sounds, the first of them no longer
    // than its sounds take and a bit, so a break after them stays a break
    function cylSpread(rows) {

        const n = rows.length;
        const t = rows.map(function (r) {
            return r.t;
        });
        const units = rows.map(function (r) {
            return cylUnits(r.text);
        });
        const rates = [];

        for (let i = 0; i < n - 1; i++) {

            const gap = t[i + 1] - t[i];

            if (gap > 300 && gap < CYL_BREAK_MS) {
                rates.push(gap / units[i]);
            }
        }

        const rate = cylMedian(rates) || CYL_UNIT_MS;
        let moved = false;

        for (let i = 0; i < n - 1; i++) {

            const gap = t[i + 1] - t[i];
            const want = units[i] * rate;

            if (gap >= 1500 || gap >= want / 3) {
                continue;
            }

            // The time the neighbours have beyond what their sounds take
            const before = i > 0 ? (t[i] - t[i - 1]) - units[i - 1] * rate : 0;
            const after = i + 2 < n ? (t[i + 2] - t[i + 1]) - units[i + 1] * rate : 0;

            if (after > 0 && after >= before) {

                // This line and the next share up to the one after them:
                // the next starts later
                const total = t[i + 2] - t[i];
                const share = Math.min(total * units[i] / (units[i] + units[i + 1]), want * 1.3);

                t[i + 1] = Math.round(t[i] + Math.max(gap, Math.min(share, total - 300)));
                moved = true;
            } else if (before > 0) {

                // The line before and this one share up to the next line:
                // this one starts earlier
                const total = t[i + 1] - t[i - 1];
                const share = Math.min(total * units[i] / (units[i - 1] + units[i]), want * 1.3);

                t[i] = Math.round(t[i + 1] - Math.max(gap, Math.min(share, total - 300)));
                moved = true;
            }
        }

        if (!moved) {
            return rows;
        }

        return rows.map(function (r, i) {
            return Object.assign({}, r, { t: t[i] });
        });
    }

    // What the roll steps through: the lines, a break where one line's
    // start is far from the next one's, from the first line's end until the
    // next starts, and an empty step after the last line. A long wait before
    // the first line is a break too. The line after a break comes in sight
    // two bars ahead, 2 to 4 seconds, 3 without a tempo
    function cylSteps(rows, ends, bpm) {

        rows = cylSpread(rows);

        const steps = [];
        const bar = cylBar(bpm);
        const lead = bar ? Math.max(2000, Math.min(4000, 2 * bar)) : 3000;

        // A beat, for the dots of a break to pulse to, half a second
        // without a tempo
        steps.beat = bar ? bar / 4 : 500;

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
                const show = Math.max(at, next.t - lead);

                // The lines before a break roll away a while into it, when
                // it is long enough for that to be worth it
                steps.push({ kind: "pause", t: at, until: next.t, show: show,
                    clear: show - at >= CYL_CLEAR_MS + 1500 ? at + CYL_CLEAR_MS : null });
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
            return { idx: idx, reveal: true, clear: false, progress: 0 };
        }

        return {
            idx: idx,
            ms: ms,
            reveal: ms >= s.show,
            clear: typeof s.clear === "number" && ms >= s.clear,
            progress: Math.max(0, Math.min(1, (ms - s.t) / Math.max(1, s.until - s.t)))
        };
    }

    // Seven rows on a drum seen from the front: the line being sung facing
    // straight out in the middle, two lines before and two after turned
    // away and fading, and one more each side rolling in and out of sight. box is a positioned
    // element of its own for them. Each row is a layer over the whole box,
    // seen in perspective from in front of its middle, holding the row's
    // words cut into strips across, each strip turned to its own place on
    // the drum, so the words wrap round it rather than sit on a flat panel
    function makeCylRoll(box) {

        const slots = [];
        const strips = [];

        for (let i = 0; i < CYL_ROWS; i++) {

            const wrap = document.createElement("div");
            const list = [];

            wrap.style.position = "absolute";
            wrap.style.left = "0";
            wrap.style.right = "0";
            wrap.style.top = "0";
            wrap.style.bottom = "0";
            wrap.style.opacity = "0";
            wrap.style.perspectiveOrigin = "50% 50%";
            wrap.style.pointerEvents = "none";

            for (let k = 0; k < CYL_STRIPS; k++) {

                const el = document.createElement("div");
                const top = Math.max(0, k * 100 / CYL_STRIPS - 1);
                const bottom = Math.max(0, 100 - (k + 1) * 100 / CYL_STRIPS - 1);

                // A little room each side so the outline is not cut off
                el.style.position = "absolute";
                el.style.left = "-4px";
                el.style.right = "-4px";
                el.style.padding = "0 4px";
                el.style.whiteSpace = "nowrap";
                el.style.overflow = "hidden";
                el.style.textOverflow = "ellipsis";
                el.style.transformOrigin = "4px 50%";
                el.style.backfaceVisibility = "hidden";
                el.style.clipPath = "inset(" + top + "% 0 " + bottom + "% 0)";
                el.style.willChange = "transform";
                wrap.appendChild(el);
                list.push(el);
            }

            box.appendChild(wrap);
            slots.push(wrap);
            strips.push(list);
        }

        return { box: box, slots: slots, strips: strips, steps: [], geo: null, idx: -2, reveal: true, seen: 0 };
    }

    // Size the drum: size is the text, every row the same, drum the drum's
    // radius in rows, smaller turning tighter with the lines closer
    // together. The box is as tall as the five lines in sight. The words
    // are painted on the drum, so only its turn moves them: none grows,
    // shrinks or moves aside as it rolls, which looked like the words
    // sliding over the drum rather than the drum turning
    function cylLayout(roll, layout) {

        const size = Math.max(10, layout.size);
        const lineH = Math.round(size * 1.5);
        const radius = lineH * Math.max(0.6, Math.min(3.5, layout.drum || 2));
        const step = CYL_ARC * lineH / radius;
        const boxH = Math.round(2 * radius * Math.sin(Math.min(Math.PI / 2, 2 * step)) + lineH * 0.6);
        const top = Math.round((boxH - lineH) / 2);

        roll.geo = {
            size: size,
            lineH: lineH,
            radius: radius,
            step: step
        };

        roll.box.style.height = boxH + "px";
        roll.seen = 0;

        for (const list of roll.strips) {

            for (const el of list) {

                el.style.top = top + "px";
                el.style.height = lineH + "px";
                el.style.lineHeight = lineH + "px";
                el.style.fontSize = size + "px";
                el.style.fontWeight = "400";
            }
        }

        roll.idx = -2;
    }

    // The turn between one step and the next, a little more where a new
    // section of the song starts straight after a line
    function cylGap(roll, j) {

        const a = roll.steps[j];
        const b = roll.steps[j + 1];
        const wide = a && b && a.kind === "line" && b.kind === "line" && b.first;

        return roll.geo.step * (wide ? 1.25 : 1);
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
    // it is the step reached, the lines after it once in sight, an empty
    // step never. A line beyond a break still to come, or one reached that
    // has not shown its lines yet, stays out of sight, so it never shows
    // early, goes and comes back. After the last line, nothing
    function cylShown(roll, r, view) {

        const s = roll.steps[r];

        if (!s || view.idx < 0) {
            return false;
        }

        // Past the end of the last line the lyrics are done: they roll away
        // and nothing stays up while the song plays out
        if (view.idx === roll.steps.length - 1 && roll.steps[view.idx].kind === "blank" && view.idx > 0) {
            return false;
        }

        if (s.kind === "pause") {
            return r === view.idx;
        }

        if (s.kind !== "line") {
            return false;
        }

        // A line before a break the lines rolled away in, once they did
        for (let j = r + 1; j <= view.idx; j++) {

            const b = roll.steps[j];

            if (b && b.kind === "pause" && typeof b.clear === "number" && (j < view.idx || view.clear)) {
                return false;
            }
        }

        for (let j = view.idx; j < r; j++) {

            const b = roll.steps[j];

            if (b && b.kind === "pause" && !(j === view.idx && view.reveal)) {
                return false;
            }
        }

        return true;
    }

    // A row's look: each strip turned to its place on the drum and darker
    // the further round it is, as light falls on a drum, so even the sung
    // line shows the curve, and by how many rows it is from the sung one
    // dimmer, three rows away gone. The extra turn before
    // a new section only moves a row, so the line after it looks like any
    // other. The sung line is drawn thicker with an outline of its own
    // color, which grows and fades smoothly and keeps the row as wide as
    // before, where a heavier font would jump to it and widen the line.
    // Every row has a thin dark outline round that, so the words read on a
    // light cover with nothing dark behind them
    function cylPose(roll, angle, off, shown) {

        const g = roll.geo;
        const a = Math.min(CYL_FADE.length - 1, Math.abs(off));
        const at = Math.floor(a);
        const k = Math.min(1, a);
        const fade = at >= CYL_FADE.length - 1 ? 0 : CYL_FADE[at] + (CYL_FADE[at + 1] - CYL_FADE[at]) * (a - at);
        const opacity = shown ? fade : 0;
        const c = Math.round(255 - 34 * k);
        const w = Math.round(g.size * 0.03 * (1 - k) * 100) / 100;
        const o = Math.round(Math.max(0.8, g.size * 0.04) * 100) / 100 + w;
        const d = Math.round(o * 70) / 100;
        const ink = "rgba(" + c + ", " + c + ", " + c + ", " + (1 - k) + ")";
        const dark = "rgba(0, 0, 0, 0.5)";
        const strips = [];

        for (let n = 0; n < CYL_STRIPS; n++) {

            const yc = ((n + 0.5) / CYL_STRIPS - 0.5) * g.lineH;
            const turn = angle + yc / g.radius;

            strips.push({
                transform: "translateZ(" + (-g.radius) + "px) rotateX(" + (-turn) + "rad) translateZ(" + g.radius + "px) translateY("
                    + (-yc) + "px)",
                opacity: Math.round(Math.sqrt(Math.max(0, Math.cos(turn))) * 1000) / 1000
            });
        }

        const whole = {
            transform: "translateZ(" + (-g.radius) + "px) rotateX(" + (-angle) + "rad) translateZ(" + g.radius + "px) translateY(0px)",
            opacity: Math.round(Math.sqrt(Math.max(0, Math.cos(angle))) * 1000) / 1000
        };

        return {
            strips: strips,
            whole: whole,
            opacity: opacity,
            color: "rgb(" + c + ", " + c + ", " + c + ")",
            textShadow: [
                w + "px 0 0 " + ink, (-w) + "px 0 0 " + ink, "0 " + w + "px 0 " + ink, "0 " + (-w) + "px 0 " + ink,
                o + "px 0 0 " + dark, (-o) + "px 0 0 " + dark, "0 " + o + "px 0 " + dark, "0 " + (-o) + "px 0 " + dark,
                d + "px " + d + "px 0 " + dark, (-d) + "px " + d + "px 0 " + dark, d + "px " + (-d) + "px 0 " + dark,
                (-d) + "px " + (-d) + "px 0 " + dark, "0 1px " + Math.round(o * 3) + "px rgba(0, 0, 0, 0.5)"
            ].join(", ")
        };
    }

    // A row's words in every strip of the row, or for a break three dots
    // that light up as it goes, drawn whole in the first strip with the
    // others empty: solid dots cut into strips show the joins as lines
    function cylFill(list, step) {

        const dots = !!step && step.kind === "pause";

        for (let n = 0; n < list.length; n++) {

            const el = list[n];

            if (!el.dataset.clip) {
                el.dataset.clip = el.style.clipPath;
            }

            el.style.clipPath = dots && n === 0 ? "none" : el.dataset.clip;

            if (dots && n > 0) {

                el.dataset.dots = "";
                el.textContent = "";
                continue;
            }

            if (dots) {

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

                continue;
            }

            el.dataset.dots = "";
            el.textContent = step && step.kind === "line" ? step.text : "";
        }
    }

    // Light the break's dots as far as it has come, one a quarter through
    function cylDots(roll, view) {

        for (const el of roll.strips[CYL_MID].slice(0, 1)) {

            if (el.dataset.dots !== "1") {
                return;
            }

            const dots = el.children;
            const beat = roll.steps.beat || 500;

            // How many are lit: only the next one to light pulses, the
            // first while none is
            let litCount = 0;

            for (let i = 0; i < dots.length; i++) {

                if (view.progress >= (i + 1) / 4) {
                    litCount = i + 1;
                }
            }

            // A dot on its way up to full holds the next one back until it
            // is there
            let ending = false;

            for (let i = 0; i < dots.length; i++) {

                if (dots[i].dataset.pulse === "ending") {
                    ending = true;
                }
            }

            roll.dotsView = view;

            for (let i = 0; i < dots.length; i++) {

                const lit = i < litCount;
                const d = dots[i];
                const pulse = i === litCount && !ending;

                // Lit as it pulsed: the pulse runs on up to its brightest,
                // which is full, ends exactly there and stays on, and the
                // next dot starts then
                if (lit && d.dataset.pulse === "1" && d.getAnimations) {

                    const run = d.getAnimations()[0];
                    const t = run && run.effect ? run.effect.getComputedTiming() : null;

                    if (!t || typeof t.progress !== "number" || typeof t.currentIteration !== "number") {

                        delete d.dataset.pulse;
                        cylStop(d);
                        d.style.opacity = "1";
                        continue;
                    }

                    d.dataset.pulse = "ending";
                    ending = true;
                    run.effect.updateTiming({ iterations: t.currentIteration + (t.progress <= 0.5 ? 0.5 : 1.5), fill: "forwards" });
                    run.onfinish = function () {

                        if (d.dataset.pulse !== "ending") {
                            return;
                        }

                        delete d.dataset.pulse;
                        cylStop(d);
                        d.style.opacity = "1";

                        if (roll.dotsView) {
                            cylDots(roll, roll.dotsView);
                        }
                    };
                    continue;
                }

                // On its way up to its brightest still
                if (lit && d.dataset.pulse === "ending") {
                    continue;
                }

                // Not lit after all, moved back in the song: no longer
                // ending, it starts its pulse again below
                if (!lit && d.dataset.pulse === "ending") {

                    delete d.dataset.pulse;
                    cylStop(d);
                }

                if (!pulse || !d.animate) {

                    if (d.dataset.pulse) {

                        delete d.dataset.pulse;
                        cylStop(d);
                    }

                    d.style.opacity = lit ? "1" : "0.3";
                    continue;
                }

                d.style.opacity = "0.3";

                // Next to light: it fades in and out, up to full on one beat
                // and down on the next, so a break is seen to be waiting.
                // The first from the break's start, in step with it, the
                // others from the moment the one before is full, rising
                if (!d.dataset.pulse) {

                    const s = roll.steps[view.idx];
                    const period = 2 * beat;
                    const into = s && typeof view.ms === "number" ? Math.max(0, view.ms - s.t) : 0;

                    d.dataset.pulse = "1";
                    d.animate([{ opacity: 0.15 }, { opacity: 1 }, { opacity: 0.15 }],
                        { duration: period, iterations: Infinity, easing: "ease-in-out", delay: litCount === 0 ? -(into % period) : 0 });
                }
            }
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
    // the drum a step, the lines after a break roll up into sight from
    // below when it is time, anything else, a seek, a new song or force,
    // puts the rows in place
    // roll.ahead: how many ms early each line comes, its roll starting
    // before it is sung so it stands in the middle as it is heard
    function cylShow(roll, ms, force) {

        if (!roll.geo) {
            return;
        }

        ms += roll.ahead || 0;

        const view = cylViewAt(roll.steps, ms);
        const old = { idx: roll.idx, reveal: roll.reveal, clear: roll.clear };
        const wide = roll.box.offsetWidth;

        // The eye's distance goes with the width, so a wide web view and a
        // narrow phone show the same drum. Hidden, the width is 0
        if (wide > 0 && wide !== roll.seen) {

            roll.seen = wide;

            for (const wrap of roll.slots) {
                wrap.style.perspective = Math.round(wide * CYL_EYE) + "px";
            }
        }

        if (!force && view.idx === old.idx && view.reveal === old.reveal && view.clear === old.clear) {

            cylDots(roll, view);
            return;
        }

        const rolled = !force && view.idx === old.idx + 1;
        const revealed = !force && view.idx === old.idx;

        for (let i = 0; i < CYL_ROWS; i++) {

            const r = view.idx + i - CYL_MID;
            const wrap = roll.slots[i];
            const list = roll.strips[i];
            const to = cylPose(roll, cylAngle(roll, view.idx, r), r - view.idx, cylShown(roll, r, view));

            cylStop(wrap);
            cylFill(list, roll.steps[r]);
            wrap.style.opacity = String(to.opacity);
            wrap.style.color = to.color;
            wrap.style.textShadow = to.textShadow;
            wrap.style.zIndex = String(10 - Math.abs(i - CYL_MID));

            const isDots = !!roll.steps[r] && roll.steps[r].kind === "pause";
            const part = function (pose, n) {
                return isDots && n === 0 ? pose.whole : pose.strips[n];
            };

            for (let n = 0; n < list.length; n++) {

                cylStop(list[n]);
                list[n].style.transform = part(to, n).transform;
                list[n].style.opacity = String(part(to, n).opacity);
            }

            if (!wrap.animate || (!rolled && !revealed)) {
                continue;
            }

            let from = cylPose(roll, cylAngle(roll, old.idx, r), r - old.idx, cylShown(roll, r, old));
            let goal = to;

            // Coming into sight after a break, a row rolls up from a step
            // further down, out of sight, rather than just fading in. A line
            // before the break going out of sight rolls on up a step and
            // out of sight the same way
            if (revealed) {

                if (from.opacity === to.opacity) {
                    continue;
                }

                if (to.opacity < from.opacity && r < view.idx) {
                    goal = cylPose(roll, cylAngle(roll, view.idx, r) - roll.geo.step, r - view.idx - 1, false);
                } else {
                    from = cylPose(roll, cylAngle(roll, view.idx, r) + roll.geo.step, r - view.idx + 1, false);
                }
            }

            const time = revealed ? CYL_SHOW_MS : CYL_ROLL_MS;

            wrap.animate([
                { opacity: from.opacity, color: from.color, textShadow: from.textShadow },
                { opacity: goal.opacity, color: goal.color, textShadow: goal.textShadow }
            ], { duration: time, easing: "ease-out" });

            for (let n = 0; n < list.length; n++) {

                list[n].animate([
                    { transform: part(from, n).transform, opacity: part(from, n).opacity },
                    { transform: part(goal, n).transform, opacity: part(goal, n).opacity }
                ], { duration: time, easing: "ease-out" });
            }
        }

        roll.idx = view.idx;
        roll.reveal = view.reveal;
        roll.clear = view.clear;
        cylDots(roll, view);
    }
