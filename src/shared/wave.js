    // Drawing a song's waveform, its progress and the play head.
    // Shared by the player and the web view's page, src/shared/wave.js,
    // inlined into both by embed-webview.sh

    // Our own waveform: the peaks dim, and in front of them how loud the
    // song sounds, bright, a column per screen pixel. Played in the accent
    // color, the rest grey. start and span the part of the song in view,
    // each column keeping its place in the song as the view moves
    function drawLayeredWave(ctx, w, h, peaks, loud, frac, start, span, color) {

        const room = h - 1;
        const from0 = start || 0;
        const step = (span || 1) / w;

        for (let k = Math.floor(from0 / step + 1e-9); ; k++) {

            const from = k * step;
            const x = Math.round((from - from0) / step);

            if (from >= 1 || x >= w) {
                break;
            }

            const to = Math.min(1, from + step);
            const played = from + step / 2 <= frac;
            const p = waveSlice(peaks, from, to);
            const l = Math.min(p, waveSlice(loud, from, to) * 0.95);
            const ph = Math.max(1, p * room);
            const lh = Math.max(1, l * room);

            ctx.fillStyle = color(played, x, "dim");
            ctx.fillRect(x, (h - ph) / 2, 1, ph);
            ctx.fillStyle = color(played, x, "loud");
            ctx.fillRect(x, (h - lh) / 2, 1, lh);
        }
    }

    // A thin play head across the waveform at x in its color, down to the
    // thin progress line when zoomed in and the full height when not
    function drawPlayHead(ctx, w, h, x, dpr, foot, fill, width) {

        // As thick as asked, in screen pixels, centered on its place
        const px = Math.max(1, Math.round((Number(width) > 0 ? Number(width) : 1) * dpr));

        if (x >= 0 && x < w) {

            ctx.fillStyle = fill;
            ctx.fillRect(Math.max(0, Math.min(x - Math.floor(px / 2), w - px)), 0, px, h - foot);
        }
    }

    // Mureka's waveform as bars, each the highest point of its slice. Each
    // bar keeps its place in the song, so zoomed in they slide along rather
    // than change height as the view moves
    function drawWaveBars(ctx, w, h, data, frac, start, span, barW, gap, dpr, color) {

        const pitch = barW + gap;
        const count = Math.max(1, Math.floor(w / pitch));
        const step = span / count;

        for (let k = Math.floor(start / step + 1e-9); ; k++) {

            const from = k * step;
            const x = Math.round((from - start) / step * pitch);

            if (from >= 1 || x >= w) {
                break;
            }

            const peak = waveSlice(data, from, Math.min(1, from + step));
            const bh = Math.max(2 * dpr, peak * (h - 2 * dpr));

            ctx.fillStyle = color(from + step / 2 <= frac, x, "bar");
            ctx.fillRect(x, (h - bh) / 2, barW, bh);
        }
    }

    // Zoomed in, the whole song as a thin progress line along the foot of
    // the waveform, the part played in played, a little lighter than the
    // played waveform or as the waveform colored by the progress is, and
    // the rest dim. from and span, the part in view, lit faintly over it
    function drawWaveOverview(ctx, w, h, frac, dpr, played, from, span) {

        const lh = waveFootHeight(dpr);
        const done = Math.round(Math.max(0, Math.min(1, frac)) * w);
        const shown = typeof from === "number" && span > 0 && span < 1;
        const x0 = shown ? Math.round(Math.max(0, Math.min(1, from)) * w) : 0;
        const x1 = shown ? Math.max(x0 + 1, Math.round(Math.max(0, Math.min(1, from + span)) * w)) : 0;

        ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
        ctx.fillRect(done, h - lh, w - done, lh);
        ctx.fillStyle = played;
        ctx.fillRect(0, h - lh, done, lh);

        if (!shown) {
            return;
        }

        // The part of the song in view, over the line whether played or
        // not: lit above it, brighter on it and marked at both ends, so
        // where the zoom is shows at a glance
        const bh = lh * 5;
        const glow = ctx.createLinearGradient(0, h - lh - bh, 0, h - lh);
        const tick = Math.max(2, Math.round(2 * dpr));
        const playedTo = Math.max(x0, Math.min(done, x1));

        glow.addColorStop(0, "rgba(255, 255, 255, 0)");
        glow.addColorStop(1, "rgba(255, 255, 255, 0.2)");
        ctx.fillStyle = glow;
        ctx.fillRect(x0, h - lh - bh, x1 - x0, bh);
        // The played part of it almost white, the rest a little lit
        ctx.fillStyle = "rgba(235, 252, 255, 0.95)";
        ctx.fillRect(x0, h - lh, playedTo - x0, lh);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(playedTo, h - lh, x1 - playedTo, lh);
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.fillRect(x0, h - lh - bh, tick, bh + lh);
        ctx.fillRect(x1 - tick, h - lh - bh, tick, bh + lh);
    }

    // Zoomed in, how far into the whole song it is, from the left edge and
    // the full height, as if the waveform were the song's progress bar. One
    // color over the played part, left of the play head at headX, and
    // another where it reaches past the play head
    function drawWaveProgress(ctx, w, h, frac, fill, ahead, headX) {

        const end = Math.round(Math.max(0, Math.min(1, frac)) * w);
        const split = Math.max(0, Math.min(end, headX));

        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, split, h);

        if (end > split) {

            ctx.fillStyle = ahead;
            ctx.fillRect(split, 0, end - split, h);
        }
    }

    // Draw the waveform bars, played part cyan, optionally previewing a seek
    // Zooming into a waveform. Pinch, the mouse wheel over it, or a press
    // held still a moment and then slid up or down zooms in and out, and a
    // double tap goes back to the whole song. Zoomed in, the
    // play head stays in the middle and the waveform moves under it, off
    // the middle only near the start and the end. Dragging moves the play
    // head as before. Past two thirds of the way to an edge with more song
    // beyond it, the play head stays there and the waveform scrolls
    // instead, faster the nearer the finger is to the edge. With the play
    // head moving along the song, it goes with the finger right out to the
    // edge, and the waveform scrolls on much faster out there. Let go, the
    // waveform glides back so the play head is in the middle again. A tap
    // zoomed in seeks a moment later, so a second tap can zoom out instead.
    // hooks: ready() a song to seek in, zoomable() a waveform shown,
    // playFrac() where it plays, rect() the box the waveform fills,
    // preview(frac) while dragging and preview(null) when that stops,
    // commit(frac) to seek, redraw() after a change of the view, and when
    // given zoomed(zoom) after the zoom changed
    function makeWaveZoom(el, hooks) {

        const ZOOM_MAX = 32;
        const EDGE = 2 / 3;
        const EDGE_SPEED = 1.5;

        // With the play head moving along, the finger takes it right out to
        // the edge, and the waveform scrolls on the faster the further out
        // it is: from a crawl past two thirds to the whole song in about
        // this many seconds at the very edge, however far zoomed in
        const EDGE_SONG_SEC = 3;
        const GLIDE_MS = 350;

        // A page turn slower than a glide back after a move, eased in and
        // out, so the waveform sets off and arrives gently. How long it
        // takes is a setting
        const PAGE_GLIDE_MS = 2000;
        const DOUBLE_TAP_MS = 300;
        const TAP_MOVE = 6;
        const HOLD_MS = 350;
        const HOLD_ZOOM_PX = 90;
        const GRAB_PX = 24;
        const EASE_PART = 0.3;
        const z = { zoom: 1, drag: null, held: null, glide: null, pinch: null, tap: null, tapTimer: 0, eatUp: false,
            holdTimer: 0, holdZoom: null, page: null, pageSpan: 0, turnFrac: null };
        const pointers = new Map();

        function span() {
            return hooks.zoomable() ? 1 / z.zoom : 1;
        }

        function clampStart(s) {
            return Math.max(0, Math.min(1 - span(), s));
        }

        // Whether the play head moves along the view instead of staying in
        // the middle, drifting with the song or turning pages
        function travels() {
            return !!(hooks.travel && hooks.travel());
        }

        // Turning pages: the view stands still while the play head runs
        // across it, and turns to the next part when the play head nears
        // its right edge, or to wherever the song is when it is out of
        // view. By default it turns as far from the right edge as the play
        // head lands from the left. Both are settings, in percent of the
        // view, as is how long the turn takes
        const PAGE_TURN = 0.82;
        const PAGE_LEAD = 0.18;

        function pageSetting(name, fallback, lo, hi) {

            const v = hooks[name] ? Number(hooks[name]()) : NaN;

            return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
        }

        function pageTurn() {
            return pageSetting("pageTurn", PAGE_TURN * 100, 50, 98) / 100;
        }

        // The landing kept well before the turn, or the page would turn
        // again at once
        function pageLead() {
            return Math.min(pageSetting("pageLand", PAGE_LEAD * 100, 0, 45) / 100, pageTurn() - 0.1);
        }

        function pageGlide() {
            return pageSetting("pageGlide", PAGE_GLIDE_MS, 200, 6000);
        }

        // How long the play head's pace is measured over
        const PACE_SAMPLE_MS = 250;

        function pages() {
            return !!(hooks.pages && hooks.pages());
        }

        // Out of view, through the page turn's ease in and out, at a
        // place of its own and at its own pace, the play head
        function easeInOut(k) {
            return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        }

        // Where the play head is across the view, 0 the left edge and 1 the
        // right, as a page turns: from where it was, at its pace, eased over
        // to where it lands, at the same pace again as it arrives. So the
        // waveform sets off and arrives at rest, eased in and out, and the
        // play head lands just where asked, however fast it goes
        function turnHead(g, k) {
            return g.x0 + g.u * k + (g.lead - g.x0 - g.u) * easeInOut(k);
        }

        // How far right of where a turn begins the play head still goes
        // while the waveform sets off, for a play head crossing u views in
        // a turn's time. The turn begins that much sooner, so the play head
        // stays inside its mark
        function turnRise(x0, u, lead) {

            let top = x0;

            for (let i = 1; i <= 24; i++) {
                top = Math.max(top, turnHead({ x0: x0, u: u, lead: lead }, i / 24));
            }

            return top - x0;
        }

        // Where a turn aims the play head so that the nearest it comes to the
        // left edge is the place set: arriving at its pace, it was a little
        // further left a moment before, more so the faster it goes. So it
        // is aimed that little bit further right
        function turnAim(x0, u, lead) {

            let aim = lead;

            for (let n = 0; n < 3; n++) {

                let low = aim;

                for (let i = 1; i <= 24; i++) {
                    low = Math.min(low, turnHead({ x0: x0, u: u, lead: aim }, i / 24));
                }

                aim = lead + (aim - low);
            }

            return aim;
        }

        // The play head's pace across the view, in views a turn takes
        function turnPace(s) {
            return isFinite(z.pace) && z.pace > 0 ? Math.min(1, z.pace * pageGlide() / s) : 0;
        }

        // Where across the view a page turns: the mark set, sooner by as far
        // as the play head would still go right while the waveform sets off
        function turnAt(f, p, s) {

            const mark = pageTurn();

            // Only worked out as the play head nears the mark
            if (f < p + s * (mark - 0.3)) {
                return mark;
            }

            const u = turnPace(s);

            return mark - turnRise(mark, u, turnAim(mark, u, pageLead()));
        }

        // The view with the play head in the centre, eased near the ends
        // of the song: the play head glides in from the edge to the centre
        // and out again while the waveform speeds up and slows down to
        // match, instead of both changing pace at once
        function follow(frac) {

            const s = span();
            const room = 1 - s;

            if (pages()) {

                const f = Math.max(0, Math.min(1, frac));
                const p = z.page;
                const now = performance.now();

                // How fast the play head goes across the song, to count how
                // far it gets while the page turns. Measured over a quarter
                // of a second at least: the view is asked for several times
                // a frame, and Safari's clock steps a whole millisecond, so
                // two looks a moment apart gave a pace without end, and the
                // page turned half a page too far, fast, and back again
                if (!z.paceAt || now < z.paceAt || now - z.paceAt > 1000 || f < z.paceFrac || f - z.paceFrac > 0.05) {

                    z.paceFrac = f;
                    z.paceAt = now;
                } else if (now - z.paceAt >= PACE_SAMPLE_MS) {

                    const pace = (f - z.paceFrac) / (now - z.paceAt);

                    if (isFinite(pace)) {
                        z.pace = z.pace ? z.pace * 0.7 + pace * 0.3 : pace;
                    }

                    z.paceFrac = f;
                    z.paceAt = now;
                }

                if (p === null || z.pageSpan !== s) {

                    z.page = clampStart(f - s * pageLead());
                    z.turnFrac = null;
                    z.pageSpan = s;
                } else if (((f < p && !(z.turnFrac !== null && f >= z.turnFrac)) || f > p + s * turnAt(f, p, s))
                    && !(z.glide && z.glide.turn && f >= p - s && f <= p + 2 * s)) {

                    // In the middle of a turn, aimed at the play head as it
                    // goes, only a jump far off turns again

                    // Where the play head will be once the page has turned,
                    // so it lands close to the left edge rather than where
                    // it was as the turn began. Not ahead of where the song
                    // is when it is out of view, say after a seek
                    const u = f > p && f < p + s ? turnPace(s) : 0;
                    const aim = turnAim((f - p) / s, u, pageLead());
                    const raw = f + u * s - s * aim;
                    const next = clampStart(raw);

                    // Glides there, as after a seek. Landing ahead of the
                    // play head, the page waits for it to come into view
                    // rather than turning back for it, unless it goes back
                    // further than where the turn began
                    // A jump of more than a page, a new song starting or a
                    // seek far off, goes there at once rather than sliding
                    // the whole way
                    const far = f < p - s || f > p + 2 * s;

                    if (far) {

                        z.glide = null;
                        z.page = next;
                        z.turnFrac = null;
                    } else if (Math.abs(next - p) > 1e-6) {

                        z.glide = { from: p, at: performance.now(), ms: pageGlide(), inOut: true, turn: true,
                            x0: (f - p) / s, u: u, lead: aim, span: s, to: next, end: Math.abs(raw - next) > 1e-9 };
                        z.page = next;
                        z.turnFrac = next > f ? f : null;
                    }
                } else if (f >= p) {
                    z.turnFrac = null;
                }

                return z.page;
            }

            // Moving along the song, the play head is as far across the view
            // as the song has come, so the view moves with it at an even pace
            if (travels()) {
                return clampStart(Math.max(0, Math.min(1, frac)) * room);
            }

            const w = Math.min(s * EASE_PART, room / 2);
            const u = frac - s / 2;

            if (w <= 0) {
                return clampStart(u);
            }

            if (u <= -w) {
                return 0;
            }

            if (u < w) {
                return (u + w) * (u + w) / (4 * w);
            }

            if (u <= room - w) {
                return u;
            }

            if (u < room + w) {
                return room - (room + w - u) * (room + w - u) / (4 * w);
            }

            return room;
        }

        // Where the pointer is across the waveform, 0 at the left edge and
        // 1 at the right, beyond those when the pointer is outside it
        function across(ev) {

            const r = hooks.rect();

            return r.width > 0 ? (ev.clientX - r.left) / r.width : 0;
        }

        function spread() {

            const xs = Array.from(pointers.values());

            return Math.max(1, Math.abs(xs[0] - xs[1]));
        }

        function setZoom(v) {

            const was = z.zoom;

            z.zoom = Math.max(1, Math.min(ZOOM_MAX, v));

            if (z.zoom < 1.03) {
                z.zoom = 1;
            }

            if (z.zoom !== was) {

                hooks.redraw();

                if (hooks.zoomed) {
                    hooks.zoomed(z.zoom);
                }
            }
        }

        function dropTap() {

            clearTimeout(z.tapTimer);
            z.tapTimer = 0;
            z.tap = null;
        }

        // A tap still waiting seeks now, a press elsewhere came before the
        // moment it waits for was over
        function flushTap() {

            const t = z.tap;
            const waiting = !!z.tapTimer;

            dropTap();

            if (waiting && t) {

                z.glide = { from: z.held ? z.held.start : 0, at: performance.now() };
                z.held = null;
                hooks.commit(t.frac);
            }
        }

        z.span = span;
        z.setZoom = setZoom;

        // The start of the part of the song in view, as a fraction, with the
        // play head at frac
        z.start = function (frac) {

            if (span() >= 1) {
                return 0;
            }

            // Dragging along the progress line, the view follows the play head
            if (z.drag && z.drag.overview) {
                return follow(frac);
            }

            if (z.drag || z.held) {

                const v = clampStart((z.drag || z.held).start);

                // Turning pages, the view stays where it was left
                if (pages()) {

                    z.page = v;
                    z.turnFrac = null;
                    z.pageSpan = span();
                }

                return v;
            }

            let target = follow(frac);

            if (z.glide) {

                const g = z.glide;
                const now = performance.now();
                const k = Math.min(1, (now - g.at) / (g.ms || GLIDE_MS));

                // A page turn aims, all the way, at where the play head will
                // be as it ends, counted again each time from where it is
                // now and the time left. What its pace was guessed wrong by
                // shrinks to nothing as the turn ends, so the play head
                // lands just where asked, at 0 right on the left edge,
                // however its pace was measured or the position came
                if (g.turn && pages()) {

                    const f = Math.max(0, Math.min(1, frac));
                    const s = span();

                    // The waveform placed under the play head where its
                    // path has it now, by where the song really is, so a
                    // pace measured wrong never moves where it lands
                    // Near the end of the song there is not a whole view
                    // left to turn to: the waveform eases in and out to
                    // the end of the song on its own, the play head going
                    // on across it
                    if (g.end && g.span === s) {

                        target = clampStart(g.from + (g.to - g.from) * easeInOut(k));
                        z.page = g.to;

                        if (k >= 1) {

                            z.glide = null;
                            z.turnFrac = null;
                        }

                        return target;
                    }

                    if (g.span === s && isFinite(g.x0)) {

                        target = clampStart(f - s * turnHead(g, k));

                        // Never back the other way, as a play head moving
                        // in steps would have it between two steps
                        if (g.last !== undefined) {
                            target = g.x0 >= g.lead ? Math.max(target, g.last) : Math.min(target, g.last);
                        }

                        g.last = target;
                        z.page = k >= 1 ? target : clampStart(f + g.u * s * (1 - k) - s * g.lead);

                        // Landed ahead of a play head that moves in steps,
                        // the page waits for it rather than turning back
                        if (k >= 1) {

                            z.glide = null;
                            z.turnFrac = target > f ? f : null;
                        }

                        return target;
                    }

                    target = clampStart(f - s * pageLead());
                    z.page = target;
                }

                if (k >= 1) {

                    z.glide = null;

                    // Landed ahead of a play head that moves in steps, the
                    // page waits for it rather than turning back
                    if (g.turn) {
                        z.turnFrac = target > frac ? Math.max(0, Math.min(1, frac)) : null;
                    }
                } else {

                    // Out of a move: quick, slowing at the end. A page turn:
                    // slow off, quicker in the middle, slow in
                    const e = g.inOut ? (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) : 1 - Math.pow(1 - k, 3);

                    return clampStart(g.from + (target - g.from) * e);
                }
            }

            return target;
        };

        z.dragging = function () {
            return !!z.drag;
        };

        // Whether the view moves by itself, so it is drawn every frame
        z.moving = function () {
            return span() < 1 && (!!z.drag || !!z.glide);
        };

        // The play head while dragging, the view scrolled on by the time
        // since the last call when the finger is past two thirds of the way
        // to an edge with song beyond it
        z.dragFrac = function () {

            const d = z.drag;

            if (!d) {
                return 0;
            }

            // Along the progress line it is the whole song across
            if (d.overview) {
                return Math.max(0, Math.min(1, d.px));
            }

            const now = performance.now();
            const dt = Math.min(0.1, (now - d.at) / 1000);
            const sp = span();
            let px = Math.max(0, Math.min(1, d.px));

            d.at = now;

            if (sp < 1 && travels()) {

                const right = Math.min(1, (d.px - EDGE) / (1 - EDGE));
                const left = Math.min(1, (1 - EDGE - d.px) / (1 - EDGE));
                const slow = EDGE_SPEED * sp;
                const fast = Math.max(slow, 1 / EDGE_SONG_SEC);

                // Rising from nothing, by the same factor for every bit
                // further out, so the slow end stays fine to aim with
                const speed = function (k) {
                    return k * slow * Math.pow(fast / slow, k);
                };

                if (right > 0 && d.start < 1 - sp) {
                    d.start = clampStart(d.start + speed(right) * dt);
                } else if (left > 0 && d.start > 0) {
                    d.start = clampStart(d.start - speed(left) * dt);
                }
            } else if (sp < 1) {

                const right = (d.px - EDGE) / (1 - EDGE);
                const left = (1 - EDGE - d.px) / (1 - EDGE);

                if (right > 0 && d.start < 1 - sp) {

                    d.start = clampStart(d.start + Math.pow(Math.min(1.5, right), 2) * EDGE_SPEED * sp * dt);
                    px = d.start < 1 - sp ? EDGE : px;
                } else if (left > 0 && d.start > 0) {

                    d.start = clampStart(d.start - Math.pow(Math.min(1.5, left), 2) * EDGE_SPEED * sp * dt);
                    px = d.start > 0 ? 1 - EDGE : px;
                }
            }

            return Math.max(0, Math.min(1, d.start + px * sp));
        };

        el.addEventListener("pointerdown", function (ev) {

            if (!hooks.ready()) {
                return;
            }

            ev.preventDefault();

            // The first finger of a new touch, or the mouse: anything left
            // over from before is forgotten. A finger whose lifting was never
            // heard, Safari dropping it to a system gesture or the page going
            // out of sight, would otherwise turn every later drag into a pinch
            // or a held zoom, and the waveform only zooms
            if (ev.isPrimary) {
                forget();
            }

            pointers.set(ev.pointerId, ev.clientX);

            try {
                el.setPointerCapture(ev.pointerId);
            } catch (e) {
                // Moves outside are then not seen, which only ends the drag
            }

            // A second finger makes it a pinch, the drag is let go
            if (pointers.size === 2) {

                clearTimeout(z.holdTimer);
                z.holdZoom = null;
                flushTap();

                if (z.drag) {

                    z.drag = null;
                    hooks.preview(null);
                }

                z.pinch = hooks.zoomable() ? { dist: spread(), zoom: z.zoom } : null;
                return;
            }

            if (pointers.size > 2 || z.pinch) {
                return;
            }

            const now = performance.now();

            // A second tap soon after one close to it: the whole song again,
            // and the first tap's seek, still waiting, is dropped
            if (z.tap && now - z.tap.at < DOUBLE_TAP_MS && Math.abs(ev.clientX - z.tap.x) < 30) {

                const waiting = !!z.tapTimer;

                dropTap();
                z.eatUp = true;

                if (waiting) {

                    z.held = null;
                    hooks.preview(null);
                }

                setZoom(1);
                return;
            }

            flushTap();
            z.glide = null;

            // Zoomed in, a press on the lowest third, where the progress line
            // runs, moves through the whole song as the waveform does zoomed
            // out, turning pages too. Elsewhere it moves the play head in the
            // part in view
            const box = el.getBoundingClientRect();
            const sp = span();
            const travel = travels();
            let overview = (!travel || pages()) && sp < 1 && box.height > 0 && ev.clientY >= box.bottom - box.height / 3;

            // Zoomed in with the song's progress over the waveform, its edge
            // is grabbed at any height to move through the whole song. The
            // play head comes first when the two are close together. With
            // the play head moving along, the two are one and the same
            if (!overview && !travel && sp < 1 && hooks.edge && hooks.edge()) {

                const r = hooks.rect();
                const pf = hooks.playFrac();
                const headX = r.left + (pf - z.start(pf)) / sp * r.width;
                const edgeX = r.left + pf * r.width;

                if (r.width > 0 && Math.abs(ev.clientX - headX) > GRAB_PX && Math.abs(ev.clientX - edgeX) <= GRAB_PX) {
                    overview = true;
                }
            }

            z.drag = { start: z.start(hooks.playFrac()), px: across(ev), at: now, t0: now, x: ev.clientX, moved: false,
                overview: overview, y: ev.clientY, lastY: ev.clientY, movedY: false };
            hooks.preview(z.dragFrac());

            // Held still a moment, it zooms instead: sliding up zooms in and
            // sliding down zooms out, and letting go seeks nothing. Slid up
            // or down before then it zooms at once, and a finger settling a
            // little up or down still counts as held. Moved sideways before
            // then, it stays a drag
            const pressed = z.drag;

            clearTimeout(z.holdTimer);

            if (hooks.zoomable()) {

                z.holdTimer = setTimeout(function () {

                    if (z.drag !== pressed || pressed.moved || pointers.size !== 1) {
                        return;
                    }

                    z.drag = null;
                    hooks.preview(null);
                    z.holdZoom = { y: pressed.lastY, zoom: z.zoom };

                    try {

                        if (navigator.vibrate) {
                            navigator.vibrate(12);
                        }
                    } catch (e) {
                        // No buzz, the zoom shows it
                    }
                }, HOLD_MS);
            }
        });

        el.addEventListener("pointermove", function (ev) {

            if (!pointers.has(ev.pointerId)) {
                return;
            }

            pointers.set(ev.pointerId, ev.clientX);

            if (z.pinch && pointers.size >= 2) {

                setZoom(z.pinch.zoom * spread() / z.pinch.dist);
                return;
            }

            // Held and sliding: up zooms in, down zooms out
            if (z.holdZoom) {

                setZoom(z.holdZoom.zoom * Math.exp((z.holdZoom.y - ev.clientY) / HOLD_ZOOM_PX));
                return;
            }

            if (z.drag) {

                const dx = Math.abs(ev.clientX - z.drag.x);
                const dy = Math.abs(ev.clientY - z.drag.y);

                // Sliding up or down before any move sideways is a zoom
                // too, at once, not waiting to be held still: the finger
                // that slides to zoom moves a little while it settles, and
                // that little made it a drag that seeked on letting go
                if (!z.drag.moved && hooks.zoomable() && pointers.size === 1 && dy > 2 * TAP_MOVE && dy > 2 * dx) {

                    clearTimeout(z.holdTimer);
                    z.holdZoom = { y: z.drag.y, zoom: z.zoom };
                    z.drag = null;
                    hooks.preview(null);
                    setZoom(z.holdZoom.zoom * Math.exp((z.holdZoom.y - ev.clientY) / HOLD_ZOOM_PX));
                    return;
                }

                z.drag.px = across(ev);
                z.drag.lastY = ev.clientY;

                if (Math.abs(ev.clientX - z.drag.x) > TAP_MOVE) {

                    z.drag.moved = true;
                    clearTimeout(z.holdTimer);
                }

                if (Math.abs(ev.clientY - z.drag.y) > TAP_MOVE) {
                    z.drag.movedY = true;
                }

                hooks.preview(z.dragFrac());
            }
        });

        // Every press, pinch and held zoom let go, the play head back where
        // it was if a drag had moved it
        const forget = function () {

            pointers.clear();
            clearTimeout(z.holdTimer);
            z.pinch = null;
            z.holdZoom = null;
            z.eatUp = false;

            if (z.drag) {

                z.drag = null;
                hooks.preview(null);
            }
        };

        const up = function (ev, cancelled) {

            if (!pointers.has(ev.pointerId)) {
                return;
            }

            pointers.delete(ev.pointerId);
            clearTimeout(z.holdTimer);

            // Zoomed by holding and sliding: letting go only ends it
            if (z.holdZoom) {

                z.holdZoom = null;
                return;
            }

            // The pinch ends with its fingers, a finger left on does nothing
            if (z.pinch) {

                if (pointers.size === 0) {
                    z.pinch = null;
                }

                return;
            }

            if (z.eatUp) {

                z.eatUp = false;
                return;
            }

            const d = z.drag;

            if (!d) {
                return;
            }

            const frac = z.dragFrac();
            const now = performance.now();

            z.drag = null;

            if (cancelled) {

                hooks.preview(null);
                return;
            }

            const tap = !d.moved && now - d.t0 < DOUBLE_TAP_MS;

            z.tap = tap ? { at: now, x: d.x, frac: frac } : null;

            // Zoomed in, a tap waits a moment in case a second one follows
            if (tap && span() < 1) {

                z.held = { start: d.overview ? follow(frac) : d.start };
                z.tapTimer = setTimeout(function () {

                    z.tapTimer = 0;
                    z.glide = { from: z.held ? z.held.start : 0, at: performance.now() };
                    z.held = null;
                    hooks.commit(frac);
                }, DOUBLE_TAP_MS);
                return;
            }

            // Along the progress line the view already follows, elsewhere it
            // glides back to the play head
            z.glide = d.overview ? null : { from: d.start, at: now };
            hooks.commit(frac);
        };

        el.addEventListener("pointerup", function (ev) {
            up(ev, false);
        });

        el.addEventListener("pointercancel", function (ev) {
            up(ev, true);
        });

        // A finger taken away from the waveform without a lift ends like a
        // cancel, and a page out of sight ends whatever was going on
        el.addEventListener("lostpointercapture", function (ev) {
            up(ev, true);
        });

        document.addEventListener("visibilitychange", function () {

            if (document.hidden) {
                forget();
            }
        });

        // The mouse wheel or a touchpad pinch over the waveform
        el.addEventListener("wheel", function (ev) {

            if (!hooks.ready() || !hooks.zoomable()) {
                return;
            }

            ev.preventDefault();
            setZoom(z.zoom * Math.exp(-ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.0025)));
        }, { passive: false });

        return z;
    }

    function playHeadMode(v) {
        return PLAY_HEAD_MODES.indexOf(v) !== -1 ? v : "center";
    }

    function progressLook(v) {
        return PROGRESS_LOOKS.indexOf(v) !== -1 ? v : "wave";
    }

    // The height of the thin progress line along the waveform's foot
    function waveFootHeight(dpr) {
        return Math.max(1, Math.round(2 * dpr));
    }

    // The colors of the waveform for one drawing: played and still to play
    // as set, and, colored by the song's progress, up to the play head in
    // fill and on to where the progress reaches in ahead, as the bar would
    // lie, each with its share. The painter takes whether a column is
    // played, where it is and which layer: loud, dim or bar. Each color is
    // worked out once a drawing
    function wavePainter(w, frac, headX, played, rest, fill, ahead) {

        const end = fill ? Math.round(Math.max(0, Math.min(1, frac)) * w) : 0;
        const split = Math.max(0, Math.min(end, headX));
        const parts = [rgbaParts(rest), rgbaParts(played), rgbaParts(fill), rgbaParts(ahead)];
        const made = new Map();

        return function (isPlayed, x, layer) {

            const base = isPlayed ? 1 : 0;
            let zone = base;

            if (x < split) {
                zone = 2;
            } else if (x < end) {
                zone = 3;
            }

            const key = zone + (isPlayed ? "p" : "r") + layer;
            let out = made.get(key);

            if (out === undefined) {

                let t = parts[zone];
                let k = 1;

                // The progress laid over the waveform's own color as much
                // as it shows, so a progress color see-through, or partly
                // so, lets the played and rest colors through rather than
                // leaving the waveform black
                if (zone >= 2 && t.a < 1) {

                    const b = parts[base];
                    const a = t.a + b.a * (1 - t.a);
                    const mix = function (i) {
                        return a > 0 ? (t.c[i] * t.a + b.c[i] * b.a * (1 - t.a)) / a : 0;
                    };

                    t = { c: [mix(0), mix(1), mix(2)], a: a };
                }

                if (layer === "dim") {
                    k = WAVE_DIM_SHADE;
                } else if (layer === "bar" && (zone === 0 || (zone >= 2 && base === 0 && parts[zone].a < 1))) {
                    k = WAVE_BAR_REST_SHADE;
                }

                const shade = function (i) {
                    return Math.round(t.c[i] * k);
                };

                out = "rgba(" + shade(0) + ", " + shade(1) + ", " + shade(2) + ", " + Math.round(t.a * 1000) / 1000 + ")";
                made.set(key, out);
            }

            return out;
        };
    }

    // A value of a waveform over a slice of it, from and to as fractions of
    // the song: the highest point when the slice holds several, and a blend
    // of the two nearest when it is narrower than a point, so a wave with
    // fewer points than the screen has columns has no steps
    function waveSlice(list, from, to) {

        const a = Math.floor(from * list.length);
        const b = Math.floor(to * list.length);

        if (b - a >= 2) {

            let peak = 0;

            for (let j = a; j < b; j++) {

                if (list[j] > peak) {
                    peak = list[j];
                }
            }

            return peak;
        }

        const at = (from + to) / 2 * list.length - 0.5;
        const i = Math.max(0, Math.min(list.length - 1, Math.floor(at)));
        const k = Math.max(0, Math.min(1, at - i));
        const next = list[Math.min(list.length - 1, i + 1)];

        return list[i] * (1 - k) + next * k;
    }

    // The way an eased scroll goes. A long way would race past at the end
    // and seem to stop dead, so only a few screens of it are travelled: the
    // first half of them from where it starts, the second half up to where
    // it ends, the part between skipped while it moves fastest. length is
    // how far it seems to go, at(eased) where it is for 0 to 1 of the way
    function easePath(from, to, view) {

        const way = Math.abs(to - from);
        const dir = to < from ? -1 : 1;
        const seen = Math.min(way, Math.max(400, view * 4));

        return {
            length: seen,
            at: function (eased) {

                const v = seen * eased;
                const done = v <= seen / 2 ? v : way - (seen - v);

                return from + dir * done;
            }
        };
    }
