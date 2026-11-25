    // The trimmer's page as both the player and the web view build it: the
    // heading with Trim and Close, the whole song, the times, the close up
    // around an end with its zoom, height and steps, the quiet spots, the
    // play buttons, the fade and repeat switches, the title, and the
    // question and the veil while Mureka works. Shared by the player and
    // the web view's page, src/shared/trimui.js, inlined into both by
    // embed-webview.sh
    //
    // Each side has trimSongId(), the song's id; trimWhereText(), where the
    // preview is heard, or nothing; trimFadeGet() and trimFadeSet(v), the
    // fade switch kept; and trimZoomKeep(n), the zoom kept. Its look, the
    // mobile player's, is for a box with the class mp-tr; the web view's
    // trimmer in a car keeps its own large look
    const TRIM_CSS = ""
        + ".mp-tr{background:#1d1d22;padding:12px;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;color:#fff;"
        + "font-size:13px;line-height:1.4}"
        + ".mp-tr .trimRow{display:flex;align-items:center;gap:6px}"
        + ".mp-tr .trimWrap{flex-wrap:wrap;gap:8px}"
        + ".mp-tr .trimGrow{flex:1 1 auto;min-width:0}"
        + ".mp-tr .trimHeading{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
        + ".mp-tr .pBtn{flex:1 1 auto;min-height:30px;box-sizing:border-box;margin:0;padding:7px 4px;border:none;border-radius:6px;"
        + "background:#333;color:#fff;font:inherit;font-weight:600;cursor:pointer;box-shadow:none}"
        + ".mp-tr .trimRow:first-child .pBtn{flex:0 0 auto;padding:6px 14px}"
        + ".mp-tr .pBtn.trimFill{flex:1 1 0;min-width:0}"
        + ".mp-tr .trimRow > .trimGrow + .pBtn{flex:0 0 auto;min-width:56px;padding:6px 12px}"
        + ".mp-tr .pBtn.on{background:" + ACCENT + ";color:#000}"
        + ".mp-tr .pBtn.playing{box-shadow:inset 0 0 0 2px " + ACCENT + "}"
        + ".mp-tr .pBtn:disabled{opacity:0.5;cursor:default}"
        + ".mp-tr .pBtn.pressed{filter:brightness(1.45);transform:scale(0.96)}"
        + ".mp-tr .trimInfo{font-size:12px;color:#aaa;font-variant-numeric:tabular-nums;margin-top:-4px;user-select:text;-webkit-user-select:text}"
        + ".mp-tr .trimStatus{font-size:12px;color:#ffb0b0}"
        + ".mp-tr .trimWhere{font-size:12px;color:" + ACCENT + "}"
        + ".mp-tr .trimWhere:empty{display:none}"
        + ".mp-tr .trimCanvas{width:100%;display:block;border-radius:6px;background:#141418;touch-action:none;cursor:pointer}"
        + ".mp-tr .trimOverview{height:56px}"
        + ".mp-tr .trimDetail{height:130px}"
        + ".mp-tr .trimLoading{height:120px;border-radius:6px;background:#141418;flex-direction:column;align-items:center;"
        + "justify-content:center;gap:10px;color:#aaa;font-size:13px}"
        + ".mp-tr .trimRing,.trimCover .trimRing{width:28px;height:28px;box-sizing:border-box;border:3px solid rgba(" + ACCENT_RGB + ",0.25);"
        + "border-top-color:" + ACCENT + ";border-radius:50%;animation:mp-ui-turn 0.8s linear infinite;flex:0 0 auto}"
        + ".trimCover .trimRing.big{width:56px;height:56px;border-width:5px}"
        + ".mp-tr .trimRing.small{width:14px;height:14px;border-width:2px;border-color:rgba(0,0,0,0.25);border-top-color:#000;"
        + "display:inline-block;margin-right:8px;vertical-align:-2px}"
        + ".mp-tr .trimTime{display:flex;align-items:center;gap:4px}"
        + ".mp-tr .pField{flex:1 1 auto;min-width:0;box-sizing:border-box;margin:0;font:inherit;padding:5px 8px;border:1px solid #3a3a42;"
        + "border-radius:6px;background:#26262c;color:#fff;height:auto}"
        + ".mp-tr .pField.trimTimeField{flex:0 0 auto;width:86px;padding:4px 6px;font-variant-numeric:tabular-nums}"
        + ".mp-tr .trimZoomLabel{text-align:center;font-variant-numeric:tabular-nums}"
        + ".mp-tr .trimNudges,.mp-tr .trimPlays{display:flex;gap:4px}"
        + ".mp-tr .trimPlays{gap:6px}"
        + ".mp-tr .trimNudges .pBtn{font-size:12px;padding:8px 2px;white-space:nowrap}"
        + ".mp-tr .trimPlays .pBtn{padding:7px 2px;white-space:nowrap}"
        + ".mp-tr .trimHint{font-size:12px;color:#9a9aa2;line-height:1.45}"
        + ".mp-tr-cover{position:absolute;inset:0;z-index:3;display:none;align-items:center;justify-content:center;padding:16px;"
        + "box-sizing:border-box;background:rgba(10,10,12,0.6);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}"
        + ".mp-tr-cover.trimWorking{flex-direction:column;gap:14px;color:#fff;font-size:15px;z-index:4}"
        + ".mp-tr-cover .trimAskBox{background:#26262c;border:1px solid #3a3a42;border-radius:10px;padding:14px;display:flex;"
        + "flex-direction:column;gap:12px;max-width:340px;width:100%;box-sizing:border-box;color:#fff;font-size:13px;line-height:1.4}"
        + ".mp-tr-cover .trimRow{display:flex;align-items:center;gap:8px}"
        + ".mp-tr-cover .pBtn{flex:1 1 0;min-height:30px;padding:7px 4px;border:none;border-radius:6px;background:#333;color:#fff;"
        + "font:inherit;font-weight:600;cursor:pointer}"
        + ".mp-tr-cover .pBtn.on{background:" + ACCENT + ";color:#000}"
        + ".mp-tr-cover .trimCheck input{width:18px;height:18px;margin:0;accent-color:" + ACCENT + "}";

    // The style sheet, once in a page
    function trimStyle() {

        if (document.getElementById("mp-tr-style")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "mp-tr-style";
        style.textContent = TRIM_CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    // A button in the look of the settings
    function trimButton(label, fn, cls) {

        const b = document.createElement("button");
        let pressTimer = 0;

        b.type = "button";
        b.className = "pBtn" + (cls ? " " + cls : "");
        b.textContent = label;
        b.addEventListener("click", fn);

        // Lit while pressed and a moment after, so even a quick tap is
        // seen to land
        b.addEventListener("pointerdown", function () {

            if (b.disabled) {
                return;
            }

            clearTimeout(pressTimer);
            b.classList.add("pressed");

            const release = function () {

                pressTimer = setTimeout(function () {
                    b.classList.remove("pressed");
                }, 160);
                window.removeEventListener("pointerup", release, true);
                window.removeEventListener("pointercancel", release, true);
            };

            window.addEventListener("pointerup", release, true);
            window.addEventListener("pointercancel", release, true);
        });

        return b;
    }

    // A small row of buttons where one is chosen
    function trimSegments(choices, get, set) {

        const row = document.createElement("div");
        const buttons = [];

        row.className = "trimRow";

        for (const c of choices) {

            const b = trimButton(c.label, function () {
                set(c.value);
                row.paint();
            }, "trimFill");

            buttons.push({ el: b, value: c.value });
            row.appendChild(b);
        }

        row.paint = function () {

            for (const b of buttons) {
                b.el.classList.toggle("on", b.value === get());
            }
        };
        row.paint();

        return row;
    }

    // A switch that belongs to the trimmer, its name beside it
    function trimSwitch(label, get, set) {

        const row = document.createElement("div");
        const name = document.createElement("div");
        const btn = trimButton("Off", function () {

            set(!get());
            row.paint();
        });

        row.className = "trimRow";
        name.className = "trimGrow";
        name.textContent = label;
        row.appendChild(name);
        row.appendChild(btn);
        row.paint = function () {

            btn.textContent = get() ? "On" : "Off";
            btn.classList.toggle("on", !!get());
        };
        row.paint();

        return row;
    }

    function buildTrimmer(box, over) {

        const ui = {};

        trimStyle();

        // Heading with the song's title, Trim within reach and Close
        const head = document.createElement("div");

        head.className = "trimRow";
        ui.heading = document.createElement("div");
        ui.heading.className = "trimGrow trimHeading";
        ui.trimBtn = trimButton("Trim", askTrim, "on");
        head.appendChild(ui.heading);
        head.appendChild(ui.trimBtn);
        head.appendChild(trimButton("Close", closeTrimmer));

        // The song's id, its length and the length it will have
        ui.info = document.createElement("div");
        ui.info.className = "trimInfo";

        ui.status = document.createElement("div");
        ui.status.className = "trimStatus";

        // While the music plays on the phone, the preview still plays here
        ui.where = document.createElement("div");
        ui.where.className = "trimWhere";
        ui.where.textContent = trimWhereText();

        // The whole song, the kept part lit, the ends to drag
        ui.overview = document.createElement("canvas");
        ui.overview.className = "trimCanvas trimOverview";

        // A turning ring with what is going on while the song is fetched
        // and decoded, in place of the empty waveforms
        ui.loading = document.createElement("div");
        ui.loading.className = "trimLoading";

        const loadingRing = document.createElement("span");

        loadingRing.className = "trimRing";
        ui.loadingText = document.createElement("span");
        ui.loading.appendChild(loadingRing);
        ui.loading.appendChild(ui.loadingText);

        // Where the kept part starts and ends, typed or shown
        const timesRow = document.createElement("div");

        timesRow.className = "trimRow trimWrap";

        const timeField = function (label, which) {

            const wrap = document.createElement("label");
            const input = document.createElement("input");

            wrap.className = "trimTime";
            wrap.appendChild(document.createTextNode(label));
            input.type = "text";
            input.inputMode = "decimal";
            input.className = "pField trimTimeField";

            input.addEventListener("change", function () {

                const t = trimParseTime(input.value);

                if (tr && t !== null) {
                    trimSetEdge(which, t);
                }

                trimPaint();
            });

            wrap.appendChild(input);
            timesRow.appendChild(wrap);

            return input;
        };

        ui.startInput = timeField("Start", "start");
        ui.endInput = timeField("End", "end");

        // Which end the close up shows and the buttons move
        ui.edgeRow = trimSegments([
            { label: "Start", value: "start" },
            { label: "End", value: "end" }
        ], function () {
            return tr ? tr.edge : "end";
        }, function (v) {

            if (tr) {

                tr.edge = v;
                tr.viewC = tr[v];
                trimPaint();
            }
        });

        // The close up around the chosen end
        ui.detail = document.createElement("canvas");
        ui.detail.className = "trimCanvas trimDetail";

        // Zoom, the width of the close up in seconds
        const zoomRow = document.createElement("div");

        zoomRow.className = "trimRow";
        ui.zoomLabel = document.createElement("div");
        ui.zoomLabel.className = "trimGrow trimZoomLabel";

        ui.zoomBy = function (step) {

            if (!tr) {
                return;
            }

            tr.zoom = Math.max(0, Math.min(TRIM_ZOOMS.length - 1, tr.zoom + step));
            tr.viewC = tr[tr.edge];
            trimZoomKeep(tr.zoom);
            trimPaint();

            // Repeating, the new length is heard soon after
            trimEndMoved("end");
        };

        ui.zoomOutBtn = trimButton("Zoom out", function () {
            ui.zoomBy(-1);
        });
        ui.zoomInBtn = trimButton("Zoom in", function () {
            ui.zoomBy(1);
        });
        zoomRow.appendChild(ui.zoomOutBtn);
        zoomRow.appendChild(ui.zoomLabel);
        zoomRow.appendChild(ui.zoomInBtn);

        // Gain, the close up's height magnified in doublings
        const gainRow = document.createElement("div");

        gainRow.className = "trimRow";
        ui.gainLabel = document.createElement("div");
        ui.gainLabel.className = "trimGrow trimZoomLabel";

        const gainBy = function (step) {

            if (!tr) {
                return;
            }

            const at = Math.round(Math.log2(tr.waveGain));

            trimSetGain(Math.pow(2, at + step));
        };

        ui.gainDownBtn = trimButton("Less gain", function () {
            gainBy(-1);
        });
        ui.gainUpBtn = trimButton("More gain", function () {
            gainBy(1);
        });
        gainRow.appendChild(ui.gainDownBtn);
        gainRow.appendChild(ui.gainLabel);
        gainRow.appendChild(ui.gainUpBtn);

        // Fine steps for the chosen end
        const nudgeRow = document.createElement("div");

        nudgeRow.className = "trimRow trimNudges";

        for (const step of [-1, -0.1, -0.01, 0.01, 0.1, 1]) {

            const label = (step > 0 ? "+" : "-") + (Math.abs(step) >= 1 ? "1 s" : Math.round(Math.abs(step) * 1000) + " ms");

            nudgeRow.appendChild(trimButton(label, function () {
                trimNudge(step);
            }, "trimFill"));
        }

        // The chosen end to the quiet spot on either side, before the next
        // rise of the sound
        const quietRow = document.createElement("div");

        quietRow.className = "trimRow trimNudges";

        for (const dir of [-1, 1]) {

            const quiet = trimButton(dir < 0 ? "\u2039 Quiet spot" : "Quiet spot \u203a", function () {
                trimQuiet(dir);
            }, "trimFill");

            quiet.title = "Moves the chosen end " + (dir < 0 ? "left" : "right")
                + " to the quietest spot before the sound rises again, at a crossing of zero";
            quietRow.appendChild(quiet);
        }

        // Listening
        const playRow = document.createElement("div");

        playRow.className = "trimRow trimPlays";
        // Each play button is ringed while what it started plays
        ui.playStartBtn = trimButton("Play start", function () {

            if (tr) {
                trimPlay(tr.start, Math.min(tr.end, tr.start + trimPreviewLen()), "start");
            }
        }, "trimFill");
        ui.playEndBtn = trimButton("Play end", function () {
            trimPlayEnd();
        }, "trimFill");
        ui.playAllBtn = trimButton("Play all", function () {

            if (tr) {
                trimPlay(tr.start, tr.end, "all");
            }
        }, "trimFill");
        playRow.appendChild(ui.playStartBtn);
        playRow.appendChild(ui.playEndBtn);
        playRow.appendChild(ui.playAllBtn);
        ui.pauseBtn = trimButton("Play", function () {

            if (tr && !tr.src && !tr.paused) {
                trimPlay(tr.start, tr.end, "kept");
            } else {
                trimPauseResume();
            }
        }, "trimFill");
        playRow.appendChild(ui.pauseBtn);
        playRow.appendChild(trimButton("Stop", function () {

            if (tr) {

                tr.loop = false;
                tr.paused = null;
                ui.loopRow.paint();
            }

            trimStop();
        }, "trimFill"));

        // Kept by the player, the web view's on the phone
        ui.fadeRow = trimSwitch("Fade out the last two seconds", trimFadeGet, function (v) {

            trimFadeSet(v);
            trimPaint();
        });

        ui.loopRow = trimSwitch("Repeat the end", function () {
            return tr ? tr.loop : false;
        }, function (v) {

            if (!tr) {
                return;
            }

            tr.loop = v;

            if (v) {
                trimPlayEnd();
            } else {
                trimStop();
            }
        });

        // The new song's title, the same as the original to start with
        const titleRow = document.createElement("label");

        titleRow.className = "trimRow";
        titleRow.appendChild(document.createTextNode("Title"));
        ui.titleInput = document.createElement("input");
        ui.titleInput.type = "text";
        ui.titleInput.maxLength = 50;
        ui.titleInput.className = "pField trimGrow";
        titleRow.appendChild(ui.titleInput);
        ui.titleRow = titleRow;

        const hint = document.createElement("div");

        ui.hint = hint;
        hint.className = "trimHint";
        hint.textContent = "Drag the ends on the whole song, or pick an end and drag it in the close up, which zooms down to single samples. Dragging up or down in the close up, Shift with the wheel, or More gain and Less gain magnify its height, so quiet clicks show. A tap plays from there to the end. Play end plays what the close up shows before the end and stops exactly where the song will end, so zooming in plays a shorter piece. Repeat the end plays it again and again, also while the end is moved. Play and Pause play the kept part and stop where it is. Mureka fades out the last two seconds of a trimmed song, the switch does the same when listening here once the end is moved. Trim makes a new song on Mureka, the original stays unless Delete original is ticked. Mureka cuts to within about 26 ms. Times are typed as 1:23.456, or as 1.23.456 on a number pad without a colon.";

        box.appendChild(head);
        box.appendChild(ui.info);
        box.appendChild(ui.where);
        box.appendChild(ui.status);
        box.appendChild(ui.loading);
        box.appendChild(ui.overview);
        box.appendChild(timesRow);
        box.appendChild(ui.edgeRow);
        box.appendChild(ui.detail);
        box.appendChild(zoomRow);
        box.appendChild(gainRow);
        box.appendChild(nudgeRow);
        box.appendChild(quietRow);
        box.appendChild(playRow);
        box.appendChild(ui.fadeRow);
        box.appendChild(ui.loopRow);
        box.appendChild(titleRow);
        box.appendChild(hint);

        // The question before trimming, with the choice to delete the
        // original, over the trimmer
        ui.ask = document.createElement("div");
        ui.ask.className = "trimCover mp-tr-cover";

        const askBox = document.createElement("div");

        askBox.className = "trimAskBox";
        ui.askText = document.createElement("div");

        const deleteLabel = document.createElement("label");

        deleteLabel.className = "trimRow trimCheck";
        ui.askDelete = document.createElement("input");
        ui.askDelete.type = "checkbox";
        deleteLabel.appendChild(ui.askDelete);
        deleteLabel.appendChild(document.createTextNode("Delete original"));

        const askButtons = document.createElement("div");

        askButtons.className = "trimRow";
        askButtons.appendChild(trimButton("Cancel", function () {
            ui.ask.style.display = "none";
        }, "trimFill"));
        askButtons.appendChild(trimButton("Trim", function () {

            ui.ask.style.display = "none";
            submitTrim(ui.askDelete.checked === true);
        }, "trimFill on"));

        askBox.appendChild(ui.askText);
        askBox.appendChild(deleteLabel);
        askBox.appendChild(askButtons);
        ui.ask.appendChild(askBox);

        // While Mureka works: a turning ring and what is going on, over
        // everything, so it cannot be missed nor anything pressed meanwhile
        ui.working = document.createElement("div");
        ui.working.className = "trimCover trimWorking mp-tr-cover";

        const workingRing = document.createElement("span");

        workingRing.className = "trimRing big";
        ui.workingText = document.createElement("span");
        ui.working.appendChild(workingRing);
        ui.working.appendChild(ui.workingText);

        over.appendChild(ui.ask);
        over.appendChild(ui.working);
        trimUi = ui;

        installTrimPointers();

        window.addEventListener("resize", function () {

            if (tr) {
                tr.overviewPeaks = null;
                trimPaint();
            }
        });
    }

    function trimPaint() {

        if (!trimUi || !tr) {
            return;
        }

        trimUi.startInput.value = document.activeElement === trimUi.startInput ? trimUi.startInput.value : trimTimeText(tr.start);
        trimUi.endInput.value = document.activeElement === trimUi.endInput ? trimUi.endInput.value : trimTimeText(tr.end);
        trimUi.info.textContent = tr.pick
            ? (/^upload /.test(String(trimSongId())) ? "Uploaded song " : "Song ") + trimTimeText(tr.duration)
                + " \u00B7 Part " + trimTimeText(tr.end - tr.start)
                + " \u00B7 A remix takes " + trimTimeText(tr.pick.min) + " to " + trimTimeText(tr.pick.max)
            : "ID " + trimSongId() + " \u00B7 Original " + trimTimeText(tr.duration)
                + " \u00B7 New " + trimTimeText(tr.end - tr.start);
        trimUi.pauseBtn.textContent = tr.src ? "Pause" : "Play";

        // The button of what plays is ringed. The zoom buttons dim at the
        // ends of the zoom
        const playing = tr.src ? tr.playMode : "";

        trimUi.playStartBtn.classList.toggle("playing", playing === "start");
        trimUi.playEndBtn.classList.toggle("playing", playing === "end");
        trimUi.playAllBtn.classList.toggle("playing", playing === "all");
        trimUi.pauseBtn.classList.toggle("playing", playing === "kept");
        trimUi.zoomOutBtn.disabled = tr.zoom <= 0;
        trimUi.zoomInBtn.disabled = tr.zoom >= TRIM_ZOOMS.length - 1;
        trimUi.gainDownBtn.disabled = tr.waveGain <= 1;
        trimUi.gainUpBtn.disabled = tr.waveGain >= TRIM_GAIN_MAX;
        trimUi.gainLabel.textContent = trimGainText();
        trimUi.zoomLabel.textContent = TRIM_ZOOMS[tr.zoom] >= 1
            ? TRIM_ZOOMS[tr.zoom] + " s wide"
            : Math.round(TRIM_ZOOMS[tr.zoom] * 1000) + " ms wide";

        const ov = trimFit(trimUi.overview);
        const de = trimFit(trimUi.detail);
        const head = trimPlayhead();

        ov.g.clearRect(0, 0, ov.w, ov.h);
        de.g.clearRect(0, 0, de.w, de.h);

        if (!tr.mono) {
            return;
        }

        // The whole song, its peaks worked out once per width
        if (!tr.overviewPeaks || tr.overviewPeaks.lo.length !== ov.w) {
            tr.overviewPeaks = trimPeaks(0, tr.duration, ov.w);
        }

        trimDrawWave(ov.g, ov.w, ov.h, 0, tr.duration, tr.overviewPeaks);

        const ox = function (t) {
            return t / tr.duration * ov.w;
        };

        trimLine(ov.g, ox(tr.start), ov.h, tr.edge === "start" ? "#fff" : "#ffd479", 2 * ov.dpr);
        trimLine(ov.g, ox(tr.end), ov.h, tr.edge === "end" ? "#fff" : "#ffd479", 2 * ov.dpr);

        // What the close up shows, drawn as a frame on the whole song
        const span = TRIM_ZOOMS[tr.zoom];
        const from = tr.viewC - span / 2;
        const to = tr.viewC + span / 2;

        ov.g.strokeStyle = "rgba(255,255,255,0.5)";
        ov.g.lineWidth = ov.dpr;
        ov.g.strokeRect(ox(from), 0.5, Math.max(2, ox(to) - ox(from)), ov.h - 1);

        if (head !== null) {
            trimLine(ov.g, ox(head), ov.h, "#ff8a8a", 2 * ov.dpr);
        }

        // The close up, time running from left to right around the end
        const dx = function (t) {
            return (t - from) / span * de.w;
        };

        de.g.fillStyle = "#222228";
        de.g.fillRect(0, de.h / 2, de.w, 1);

        // Outside the song, marked as nothing
        if (from < 0) {
            de.g.fillStyle = "#101012";
            de.g.fillRect(0, 0, dx(0), de.h);
        }

        if (to > tr.duration) {
            de.g.fillStyle = "#101012";
            de.g.fillRect(dx(tr.duration), 0, de.w - dx(tr.duration), de.h);
        }

        const cols = de.w;
        const peaks = (span / cols) * tr.rate >= 1 ? trimPeaks(from, to, cols) : null;

        trimDrawWave(de.g, de.w, de.h, from, to, peaks, tr.waveGain);

        trimLine(de.g, dx(tr.start), de.h, tr.edge === "start" ? "#fff" : "#ffd479", 2 * de.dpr);
        trimLine(de.g, dx(tr.end), de.h, tr.edge === "end" ? "#fff" : "#ffd479", 2 * de.dpr);

        if (head !== null && head >= from && head <= to) {
            trimLine(de.g, dx(head), de.h, "#ff8a8a", 2 * de.dpr);
        }

        // The time at each side of the close up
        de.g.fillStyle = "#aaa";
        de.g.font = Math.round(11 * de.dpr) + "px sans-serif";
        de.g.textBaseline = "bottom";
        de.g.textAlign = "left";
        de.g.fillText(trimTimeText(Math.max(0, from)), 4 * de.dpr, de.h - 3 * de.dpr);
        de.g.textAlign = "right";
        de.g.fillText(trimTimeText(Math.min(tr.duration, to)), de.w - 4 * de.dpr, de.h - 3 * de.dpr);

        // The height magnified, shown while it is
        if (tr.waveGain > 1.01) {

            de.g.fillStyle = "#ffd479";
            de.g.textBaseline = "top";
            de.g.fillText(trimGainText(), de.w - 4 * de.dpr, 3 * de.dpr);
        }
    }

    // Ask before trimming, with the choice to delete the original
    function askTrim() {

        if (!tr || !tr.buffer || tr.busy) {
            return;
        }

        // The part to remix: within Mureka's limits, handed on as it is
        if (tr.pick) {

            const len = tr.end - tr.start;

            if (len < tr.pick.min - 0.0005 || len > tr.pick.max + 0.0005) {

                trimStatus("A remix takes a part of " + trimTimeText(tr.pick.min) + " to " + trimTimeText(tr.pick.max)
                    + ", this is " + trimTimeText(len));
                return;
            }

            const pick = tr.pick;
            const range = { start: Math.round(tr.start * 1000), end: Math.round(tr.end * 1000) };

            pick.chosen = true;
            closeTrimmer();
            pick.done(range);
            return;
        }

        // Nothing cut off, nothing for Mureka to do
        if (tr.start < 0.001 && tr.end > tr.duration - 0.001) {

            trimStatus("Move the start or the end first");
            return;
        }

        trimAskPaint();
        trimUi.askDelete.checked = false;
        trimUi.ask.style.display = "flex";
    }

    // The Trim button busy with a turning ring, and not to be pressed again
    // while Mureka works
    function trimBusy(on) {

        if (!trimUi) {
            return;
        }

        if (tr) {
            tr.busy = on;
        }

        trimUi.trimBtn.textContent = "";

        if (on) {

            const ring = document.createElement("span");

            ring.className = "trimRing small";
            trimUi.trimBtn.appendChild(ring);
            trimUi.trimBtn.appendChild(document.createTextNode("Trimming"));
        } else {
            trimUi.trimBtn.textContent = tr && tr.pick ? "Use this part" : "Trim";
        }

        trimUi.trimBtn.disabled = on || !tr || !tr.buffer;
    }
