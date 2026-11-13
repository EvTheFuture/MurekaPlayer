    // The trimmer's working parts: decoding, peaks, edges, fades and gain.
    // Shared by the player and the web view's page, src/shared/trim.js,
    // inlined into both by embed-webview.sh

    function trimAnimate() {

        const step = function () {

            if (!tr || !tr.src) {
                return;
            }

            trimPaint();
            requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
    }

    // Decode with the callback form as well, older Safari has no promise
    function trimDecode(ctx, bytes) {

        return new Promise(function (resolve, reject) {

            const p = ctx.decodeAudioData(bytes, resolve, reject);

            if (p && typeof p.then === "function") {
                p.then(resolve, reject);
            }
        });
    }

    // The end repeating is heard again soon after it moved
    function trimEndMoved(which) {

        if (!tr || !tr.loop || which !== "end") {
            return;
        }

        clearTimeout(tr.loopTimer);
        tr.loopTimer = setTimeout(function () {

            if (tr && tr.loop) {
                trimPlayEnd();
            }
        }, 350);
    }

    // The last two seconds with the fade worked into the samples, as a short
    // buffer of its own. Played right after the rest, it fades whatever
    // the browser does with volume changes over time. Kept while the end
    // stays put, so repeating the end does not work it out again
    function trimFadeTail(from, to) {

        const key = from.toFixed(4) + ":" + to.toFixed(4);

        if (tr.tail && tr.tail.key === key) {
            return tr.tail.buffer;
        }

        const rate = tr.buffer.sampleRate;
        const a = Math.max(0, Math.round(from * rate));
        const b = Math.min(tr.buffer.length, Math.round(to * rate));
        const n = Math.max(1, b - a);
        const tail = trimCtx.createBuffer(tr.buffer.numberOfChannels, n, rate);

        for (let c = 0; c < tr.buffer.numberOfChannels; c++) {

            const src = tr.buffer.getChannelData(c);
            const dst = tail.getChannelData(c);

            for (let i = 0; i < n; i++) {

                const t = (a + i) / rate;

                dst[i] = src[a + i] * Math.max(0, Math.min(1, (tr.end - t) / TRIM_FADE));
            }
        }

        tr.tail = { key: key, buffer: tail };

        return tail;
    }

    // Size a canvas to its box, returns the drawing context and the size in
    // canvas pixels
    function trimFit(canvas) {

        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));

        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }

        return { g: canvas.getContext("2d"), w: w, h: h, dpr: dpr };
    }

    function trimGainText() {

        const g = tr ? tr.waveGain : 1;

        return "Gain " + (g < 10 ? g.toFixed(1) : String(Math.round(g))) + "\u00d7";
    }

    function trimLine(g, x, h, color, width) {

        g.fillStyle = color;
        g.fillRect(Math.round(x - width / 2), 0, width, h);
    }

    // The ring and its text in place of the waveforms, or the waveforms
    // back when the text is empty
    function trimLoading(text) {

        if (!trimUi) {
            return;
        }

        trimUi.loadingText.textContent = text;
        trimUi.loading.style.display = text ? "flex" : "none";
        trimUi.overview.style.display = text ? "none" : "block";
        trimUi.detail.style.display = text ? "none" : "block";

        if (!text) {
            trimPaint();
        }
    }

    // A new sound engine in place of one that does not move. The song read
    // into the old one plays on the new one as well
    function trimNewCtx() {

        const Ctx = window.AudioContext || window.webkitAudioContext;
        const old = trimCtx;

        trimCtx = Ctx ? new Ctx() : null;
        trimCtxStuck = false;

        if (tr) {
            tr.tail = null;
        }

        if (old) {

            try {
                old.close();
            } catch (e) {
                // Gone already
            }
        }

        trimWake();
    }

    function trimNudge(step) {

        if (!tr || !tr.buffer) {
            return;
        }

        trimSetEdge(tr.edge, tr[tr.edge] + step);
        tr.viewC = tr[tr.edge];
        trimPaint();
    }

    // Read a typed time: 1:05.25, 65.25 or 65. Null when it is not a time
    function trimParseTime(text) {

        const t = String(text || "").trim();

        // Minutes, seconds and parts typed with dots or commas only, as the
        // number pad on a phone has no colon: 1.23.456 is 1:23.456
        const dots = t.match(/^(\d+)[.,](\d{1,2})[.,](\d+)$/);

        if (dots) {
            return Number(dots[1]) * 60 + Number(dots[2] + "." + dots[3]);
        }

        const m = t.match(/^(?:(\d+):)?(\d+(?:[.,]\d+)?)$/);

        if (!m) {
            return null;
        }

        return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2].replace(",", "."));
    }

    // The lowest and highest sample in each column across a stretch of time
    function trimPeaks(from, to, cols) {

        const mono = tr.mono;
        const rate = tr.rate;
        const lo = new Float32Array(cols);
        const hi = new Float32Array(cols);
        const per = (to - from) * rate / cols;

        for (let c = 0; c < cols; c++) {

            let a = Math.floor((from * rate) + c * per);
            let b = Math.floor((from * rate) + (c + 1) * per);

            if (b <= a) {
                b = a + 1;
            }

            let mn = 0;
            let mx = 0;

            a = Math.max(0, a);
            b = Math.min(mono.length, b);

            for (let i = a; i < b; i++) {

                const v = mono[i];

                if (v < mn) {
                    mn = v;
                }

                if (v > mx) {
                    mx = v;
                }
            }

            lo[c] = mn;
            hi[c] = mx;
        }

        return { lo: lo, hi: hi };
    }

    function trimPlayEnd() {

        if (tr) {
            trimPlay(Math.max(tr.start, tr.end - trimPreviewLen()), tr.end, "end");
        }
    }

    // How much Play start, Play end and Repeat the end play: what the close
    // up shows on one side of the end, so zooming in plays a shorter piece
    function trimPreviewLen() {
        return Math.max(TRIM_PREVIEW_MIN, TRIM_ZOOMS[tr.zoom] / 2);
    }

    // Move one end, kept inside the song and at least a second apart
    function trimSetEdge(which, t) {

        if (!tr) {
            return;
        }

        // The reminder to move an end is answered
        if (trimUi && trimUi.status.textContent === "Move the start or the end first") {
            trimStatus("");
        }

        if (which === "start") {
            tr.start = Math.max(0, Math.min(t, tr.end - TRIM_MIN_LEN));
        } else {
            tr.end = Math.min(tr.duration, Math.max(t, tr.start + TRIM_MIN_LEN));
        }

        trimEndMoved(which);
    }

    // Magnify the close up's height, kept between none and the most
    function trimSetGain(g) {

        if (!tr) {
            return;
        }

        tr.waveGain = Math.max(1, Math.min(TRIM_GAIN_MAX, g));
        trimPaint();
    }

    function trimStatus(text) {

        if (trimUi) {
            trimUi.status.textContent = text;
            trimUi.status.style.display = text ? "block" : "none";
        }
    }

    // Minutes, seconds and milliseconds, 1:05.250
    function trimTimeText(t) {

        const ms = Math.max(0, Math.round(t * 1000));
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        const rest = ms % 1000;

        return m + ":" + (s < 10 ? "0" : "") + s + "." + String(rest).padStart(3, "0");
    }

    // Wake the sound engine. Safari also has an interrupted state, after
    // another sound took over the phone's audio, which a resume ends too
    function trimWake() {

        if (!trimCtx || trimCtx.state === "running" || trimCtx.state === "closed") {
            return;
        }

        try {

            const woke = trimCtx.resume();

            if (woke && woke.catch) {
                woke.catch(function () {
                    // Still asleep, the check after starting finds that
                });
            }
        } catch (e) {
            // Still asleep, the check after starting finds that
        }
    }

    // The color of the wave at a time: lit inside the kept part, darker in
    // the second that fades out, grey outside
    function trimWaveColor(t) {

        if (t < tr.start || t > tr.end) {
            return "#4a4a52";
        }

        if (trimFades() && t > tr.end - TRIM_FADE) {
            return "#2b8f96";
        }

        return ACCENT;
    }

    // The dimmed page with the turning ring, or away when the text is empty
    function trimWorking(text) {

        if (!trimUi) {
            return;
        }

        trimUi.workingText.textContent = text;
        trimUi.working.style.display = text ? "flex" : "none";
    }

    // Pause the preview where it is, or go on from there
    function trimPauseResume() {

        if (!tr) {
            return;
        }

        if (tr.src) {

            const at = trimPlayhead();
            const to = tr.playTo;
            const mode = tr.playMode;

            trimStop();
            tr.paused = { at: at, to: to, mode: mode };
            trimPaint();
            return;
        }

        if (tr.paused) {

            const p = tr.paused;

            // The end moved before the paused place, the end is played then
            if (p.at >= tr.end - 0.02) {
                trimPlayEnd();
            } else {
                trimPlay(p.at, Math.min(p.to, tr.end), p.mode);
            }
        }
    }

    // Draw columns of peaks, or a line through the samples once they are
    // further apart than a column
    function trimDrawWave(g, w, h, from, to, peaks, gain) {

        const mid = h / 2;
        const spanPerCol = (to - from) / w;
        const k = mid * 0.95 * (gain || 1);

        // A sample magnified past the edge is drawn at the edge
        const y = function (v) {
            return Math.max(0, Math.min(h, mid - v * k));
        };

        if (spanPerCol * tr.rate < 1) {

            // Few enough samples to show each one, joined by a line
            const a = Math.max(0, Math.floor(from * tr.rate));
            const b = Math.min(tr.mono.length - 1, Math.ceil(to * tr.rate));

            g.lineWidth = Math.max(1, Math.round(w / 400));

            for (let i = a; i < b; i++) {

                const t0 = i / tr.rate;
                const t1 = (i + 1) / tr.rate;

                g.strokeStyle = trimWaveColor(t0);
                g.beginPath();
                g.moveTo((t0 - from) / (to - from) * w, y(tr.mono[i]));
                g.lineTo((t1 - from) / (to - from) * w, y(tr.mono[i + 1]));
                g.stroke();
            }

            return;
        }

        for (let c = 0; c < w; c++) {

            const t = from + (c + 0.5) * spanPerCol;
            const top = y(peaks.hi[c]);
            const bottom = y(peaks.lo[c]);

            g.fillStyle = trimWaveColor(t);
            g.fillRect(c, top, 1, Math.max(1, bottom - top));
        }
    }
