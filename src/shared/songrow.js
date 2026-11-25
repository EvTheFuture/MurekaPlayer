    // One song's row in a list, as the player and the web view both draw
    // it: the stored dot, the number or a fold's chip, the title, the
    // rating or the plays, the length, the badge with its corner marks, the
    // repeat mark and the heart. Built from plain data, the player's song
    // turned into it by the player and the web view's list items as the
    // player sends them, so both look the same. The caller adds what the
    // row does when tapped. Shared by the player and the web view's page,
    // src/shared/songrow.js, inlined into both by embed-webview.sh
    //
    // item: title, number, playing, queued (the turn of a song put in the
    // queue by hand), ignored, kept and setColor (a song of a set),
    // rating (null when not rated), plays (null when not known),
    // duration in seconds, badge ("shared", "new", "public", "draft" or
    // none), badgeTitle, trimmed, remixed, note, comments, repeatOne,
    // liked, cached ("both", "audio", "art", "caching" or none) with
    // cachedP while caching, greyed, faded and stub.
    // opts: fold, an element in place of the number; anyRated, the rating
    // column shown; byPlays, the plays shown instead; onLike(ev, heart)
    const SR_GOLD = "#f5c518";

    // In em of the row's own size, so the player's 15 px rows and the
    // web view's larger rows in a car keep the same proportions
    const SR_CSS = ""
        + ".mp-sr{display:flex;align-items:center;padding:0.2em 0.133em;cursor:pointer;user-select:none;-moz-user-select:none;"
        + "-webkit-user-select:none;-webkit-touch-callout:none;box-sizing:border-box}"
        + ".mp-sr.stub{font-style:italic}"
        + ".mp-sr.faded{opacity:0.45}"
        + ".mp-sr.greyed:not(.playing):not(.faded)>:not(.mp-sr-hasfold){opacity:0.45}"
        + ".mp-sr-dot{flex:0 0 auto;margin-right:0.4em;color:" + ACCENT + ";visibility:hidden;position:relative}"
        + ".mp-sr-dot.both{visibility:visible}"
        + ".mp-sr-dot.audio{visibility:visible;color:#b388ff}"
        + ".mp-sr-dot.caching{visibility:visible;color:transparent}"
        + ".mp-sr-pie{position:absolute;left:50%;top:50%;width:0.7em;height:0.7em;transform:translate(-50%,-50%);border-radius:50%;"
        + "background:conic-gradient(" + ACCENT + " calc(var(--mp-sr-p) * 1%),rgba(" + ACCENT_RGB + ",0.25) 0);"
        + "animation:mp-sr-fade 1.2s ease-in-out infinite}"
        + "@keyframes mp-sr-fade{50%{opacity:0.45}}"
        + ".mp-sr-num{flex:0 0 auto;width:2.8em;text-align:right;margin-right:0.533em;color:#888;font-variant-numeric:tabular-nums}"
        + ".mp-sr-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
        + ".mp-sr.playing .mp-sr-title{color:" + ACCENT + ";font-weight:600}"
        + ".mp-sr.playing .mp-sr-num{color:" + ACCENT + "}"
        + ".mp-sr.queued .mp-sr-num{color:" + SR_GOLD + "}"
        + ".mp-sr.queued:not(.playing) .mp-sr-title{color:#f3dc8a}"
        + ".mp-sr.ignored:not(.playing) .mp-sr-title{color:#9a9aa2}"
        + ".mp-sr-ign,.mp-sr-kept{flex:0 0 auto;margin-right:0.417em;font-size:0.8em}"
        + ".mp-sr-ign{color:#888}"
        + ".mp-sr-kept{font-weight:700}"
        + ".mp-sr-plays,.mp-sr-rate,.mp-sr-badge,.mp-sr-rep,.mp-sr-fold,.mp-sr-state{font-size:0.733em}"
        + ".mp-sr-plays{flex:0 0 auto;min-width:4em;margin-left:0.545em;text-align:right;"
        + "font-variant-numeric:tabular-nums;white-space:nowrap;color:#999}"
        + ".mp-sr-plays.unknown{color:#555}"
        + ".mp-sr-rate{flex:0 0 auto;width:3.273em;margin-left:0.545em;text-align:right;"
        + "font-variant-numeric:tabular-nums;white-space:nowrap;color:#777}"
        + ".mp-sr-rate.rated{color:" + SR_GOLD + "}"
        + ".mp-sr-time{flex:0 0 auto;margin-left:0.533em;color:#888;font-variant-numeric:tabular-nums;font-weight:400}"
        + ".mp-sr-badge{flex:0 0 auto;width:4.182em;margin-left:0.545em;padding:0;border-radius:0.364em;line-height:1.4545;"
        + "text-align:center;position:relative;font-weight:400}"
        + ".mp-sr-badge.public{background:#1f3a2a;color:#7fd6a0}"
        + ".mp-sr-badge.draft{background:#3a3a42;color:#bbb}"
        + ".mp-sr-badge.new{background:" + ACCENT + ";color:#000;font-weight:600}"
        + ".mp-sr-badge.shared{background:#2e2640;color:#c9a8ff}"
        + ".mp-sr-rep{flex:0 0 auto;margin-left:0.545em;padding:0 0.4545em;border-radius:0.364em;background:" + ACCENT + ";color:#000;"
        + "line-height:1.4545;font-weight:600}"
        + ".mp-sr-hbox{flex:0 0 auto;position:relative;display:flex;margin-left:0.4em}"
        + ".mp-sr-heart{flex:0 0 auto;width:1.333em;text-align:center;cursor:pointer;color:#777;font-weight:400}"
        + ".mp-sr-heart.liked{color:#ff6b8a}"
        + ".mp-sr-mark{position:absolute;width:1.385em;height:1.385em;border-radius:50%;color:#1d1d22;line-height:1.385em;"
        + "font-weight:700;text-align:center;pointer-events:none;font-style:normal}"
        + ".mp-sr-badge .mp-sr-mark{font-size:0.591em}"
        + ".mp-sr-hbox .mp-sr-mark{font-size:0.433em}"
        + ".mp-sr-mark.t{top:-0.615em;right:-0.4615em;background:#c9a83a;opacity:0.85}"
        + ".mp-sr-mark.r{top:-0.615em;left:-0.4615em;background:#9b7be0;opacity:0.9}"
        + ".mp-sr-mark.n{bottom:-0.615em;right:-0.4615em;background:#6f9cff;opacity:0.9}"
        + ".mp-sr-mark.c{bottom:-0.615em;left:-0.4615em;min-width:1.385em;width:auto;padding:0 0.154em;box-sizing:border-box;"
        + "border-radius:0.615em 0.615em 0.615em 0;background:#ffb454;opacity:0.95}"
        + ".mp-sr-fold{display:inline-block;box-sizing:border-box;width:3.4545em;padding:0;border-radius:0.818em;"
        + "border:1.5px solid " + ACCENT + ";background:rgba(" + ACCENT_RGB + ",0.1);color:" + ACCENT + ";font-weight:600;"
        + "line-height:1.4545;text-align:center;font-variant-numeric:tabular-nums;white-space:nowrap;"
        + "overflow:hidden;cursor:pointer;font-style:normal}"
        + ".mp-sr-arrow{display:inline-block;width:1.05em;height:1.05em;vertical-align:-0.18em;fill:none;stroke:currentColor;"
        + "stroke-width:3;stroke-linecap:round;stroke-linejoin:round}"
        + ".mp-sr-fold.set{background:rgba(255,255,255,0.06)}"
        + ".mp-sr-fold.open{background:" + ACCENT + ";color:#000}"
        + ".mp-sr-grip{flex:0 0 auto;display:flex;align-items:center;justify-content:center;align-self:stretch;width:1.375em;"
        + "margin-right:0.125em;color:#888;font-size:1.067em;cursor:grab;touch-action:none}"
        + ".mp-sr-grip.off{opacity:0.3;cursor:not-allowed}"
        + ".mp-sr.pending .mp-sr-title{opacity:0.45}"
        + ".mp-sr.pending .mp-sr-num{display:flex;justify-content:flex-end}"
        + ".mp-sr-state{flex:0 0 auto;margin-left:0.727em;color:#aaa;white-space:nowrap;opacity:0.7}"
        + ".mp-sr-ring{display:inline-block;box-sizing:border-box;width:0.733em;height:0.733em;border:2px solid rgba(" + ACCENT_RGB + ",0.3);"
        + "border-top-color:" + ACCENT + ";border-radius:50%;animation:mp-sr-spin 0.8s linear infinite}"
        + "@keyframes mp-sr-spin{to{transform:rotate(360deg)}}";

    // The rows' style sheet, once in a page
    function srStyle() {

        if (document.getElementById("mp-sr-style")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "mp-sr-style";
        style.textContent = SR_CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    // The length of a song as m:ss, or h:mm:ss
    function srTime(sec) {

        const s = Math.max(0, Math.round(Number(sec) || 0));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = String(s % 60).padStart(2, "0");

        return h > 0 ? h + ":" + String(m).padStart(2, "0") + ":" + r : m + ":" + r;
    }

    // The stored dot: cyan for the song and its cover, violet for the song
    // only, a pie filling while it is being stored, hidden otherwise so the
    // numbers stay in line
    function srPaintDot(dot, cached, p) {

        const had = cached === "caching" && dot.classList.contains("caching") ? dot.querySelector(".mp-sr-pie") : null;

        // Still being stored: only the pie moves on, so its pulse goes on
        // without starting over
        if (had) {

            had.style.setProperty("--mp-sr-p", String(typeof p === "number" && p >= 0 ? Math.max(4, Math.round(p)) : 100));
            dot.title = typeof p === "number" && p >= 0 ? "Caching, " + Math.round(p) + "%" : "Caching";
            return;
        }

        dot.className = "mp-sr-dot" + (cached === "both" || cached === "audio" || cached === "caching" ? " " + cached : "");
        dot.textContent = "\u25CF";
        dot.title = cached === "both" ? "Song and cover cached" : cached === "audio" ? "Song cached, cover not yet" : "";

        if (cached === "caching") {

            const pie = document.createElement("span");
            const pct = typeof p === "number" && p >= 0 ? Math.max(4, Math.round(p)) : 100;

            pie.className = "mp-sr-pie";
            pie.style.setProperty("--mp-sr-p", String(pct));
            dot.appendChild(pie);
            dot.title = typeof p === "number" && p >= 0 ? "Caching, " + Math.round(p) + "%" : "Caching";
        }
    }

    // The heart, filled when liked
    function srPaintHeart(heart, liked) {

        heart.textContent = liked ? "\u2665" : "\u2661";
        heart.title = liked ? "Liked, tap to unlike" : "Tap to like";
        heart.classList.toggle("liked", liked === true);
    }

    // A song's plays, exact up to 99999, a grey question mark while not known
    function srPaintPlays(el, n) {

        el.classList.toggle("unknown", typeof n !== "number");

        if (typeof n !== "number") {

            el.textContent = "\u25B6 ?";
            return;
        }

        el.textContent = "\u25B6 " + (n >= 1000000 ? (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M"
            : (n >= 100000 ? Math.round(n / 1000) + "k" : String(n)));
    }

    // A small mark on the corner of the badge or the heart: T trimmed, R
    // remix, N a note, a count of comments
    function srMark(kind, text, title) {

        const mark = document.createElement("span");

        mark.className = "mp-sr-mark " + kind;
        mark.textContent = text;
        mark.title = title;

        return mark;
    }

    function srMarks(box, item) {

        if (item.trimmed) {
            box.appendChild(srMark("t", "T", "Trimmed"));
        }

        if (item.remixed) {
            box.appendChild(srMark("r", "R", "Remix"));
        }

        if (item.note) {

            box.appendChild(srMark("n", "N", "Note: " + item.note));
            box.title = (box.title ? box.title + "\n\n" : "") + "Note: " + item.note;
        }

        if (item.comments > 0) {

            box.appendChild(srMark("c", item.comments > 9 ? "9+" : String(item.comments),
                item.comments + (item.comments === 1 ? " comment" : " comments") + " on Mureka"));
        }
    }

    // The count of a fold and its arrow, in place of a number: songs the
    // filters leave out in the accent colour, a set in its own colour.
    // Filled while open. The arrow drawn, as some browsers' fonts have no
    // such arrows. The caller opens and folds it, and paints it again
    function srFoldChip(n, open, setColor) {

        const chip = document.createElement("span");

        chip.setAttribute("role", "button");
        chip.dataset.foldChip = "1";
        chip.dataset.count = String(n);
        chip.dataset.color = setColor || "";
        srPaintFold(chip, open);

        return chip;
    }

    function srPaintFold(chip, open) {

        const n = chip.dataset.count;
        const setColor = chip.dataset.color;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

        chip.className = "mp-sr-fold" + (setColor ? " set" : "") + (open ? " open" : "");
        chip.dataset.open = open ? "1" : "";
        chip.textContent = "";
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("class", "mp-sr-arrow");
        path.setAttribute("d", open ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6");
        svg.appendChild(path);
        chip.appendChild(svg);
        chip.appendChild(document.createTextNode(n));
        chip.title = setColor
            ? (open ? "Fold the set's " + n + " songs" : "A set of " + n + " songs, tap to show them")
            : (open ? "Fold the " + n + " songs the filters leave out" : n + " songs the filters leave out, tap to show them");
        chip.setAttribute("aria-label", chip.title);
        chip.style.borderColor = setColor || "";
        chip.style.color = setColor ? (open ? "#000" : setColor) : "";
        chip.style.background = setColor && open ? setColor : "";
    }

    // The handle to drag a song to another place in the queue or a
    // playlist, first in its row. off, the list is not in an order to move
    // songs in, sorted or searched say
    function srGrip(off) {

        const grip = document.createElement("span");

        srStyle();
        grip.className = "mp-sr-grip" + (off ? " off" : "");
        grip.textContent = "\u2261";
        grip.title = "Drag to move";

        return grip;
    }

    function srRow(item, opts) {

        const o = opts || {};
        const row = document.createElement("div");
        const dot = document.createElement("span");
        const num = document.createElement("span");
        const title = document.createElement("span");
        const heart = document.createElement("span");

        srStyle();
        row.className = "mp-sr" + (item.playing ? " playing" : "") + (item.queued ? " queued" : "")
            + (item.ignored ? " ignored" : "") + (item.greyed ? " greyed" : "") + (item.faded ? " faded" : "")
            + (item.stub ? " stub" : "");
        row.title = item.greyed ? "Left out by the filters. Tap to play; long press or right-click for options"
            : "Play; long press or right-click for options";

        srPaintDot(dot, item.cached, item.cachedP);
        row.appendChild(dot);

        num.className = "mp-sr-num";
        num.textContent = item.number === undefined || item.number === null ? "" : String(item.number);

        // Put in the queue by hand: its turn in place of its number
        if (item.queued) {

            num.textContent = "Q" + item.queued;
            row.title = "Queued, number " + item.queued + " of the songs put in by hand";
        }

        if (o.fold) {

            num.textContent = "";
            num.classList.add("mp-sr-hasfold");
            num.appendChild(o.fold);
        }

        row.appendChild(num);

        if (item.ignored) {

            const mark = document.createElement("span");

            mark.className = "mp-sr-ign";
            mark.textContent = "\u2298";
            mark.title = "Ignored, queues made from the list leave it out";
            row.appendChild(mark);
        }

        // A song of a set has a bar of the set's colour at its start, and a
        // kept one a tick before its title
        if (item.setColor) {

            row.style.boxShadow = "inset 3px 0 0 " + item.setColor;
            row.dataset.setBar = row.style.boxShadow;

            if (item.kept) {

                const tick = document.createElement("span");

                tick.className = "mp-sr-kept";
                tick.textContent = "\u2713";
                tick.title = "Kept";
                tick.style.color = item.setColor;
                row.appendChild(tick);
            }
        }

        title.className = "mp-sr-title";
        title.textContent = item.title || "Untitled";
        row.appendChild(title);

        // Sorted by plays, the plays take the rating's place. The rating
        // only once any song has one, so a library nobody has rated keeps
        // the room for titles
        if (o.byPlays) {

            const plays = document.createElement("span");

            plays.className = "mp-sr-plays";
            srPaintPlays(plays, item.plays);
            row.appendChild(plays);
        } else if (o.anyRated) {

            const rate = document.createElement("span");
            const r = item.rating;

            rate.className = "mp-sr-rate" + (r ? " rated" : "");
            rate.textContent = r === null || r === undefined ? "" : String(r) + "\u2605";
            row.appendChild(rate);
        }

        if (item.duration > 0) {

            const time = document.createElement("span");

            time.className = "mp-sr-time";
            time.textContent = srTime(item.duration);
            row.appendChild(time);
        }

        if (item.badge) {

            const badge = document.createElement("span");

            badge.className = "mp-sr-badge " + item.badge;
            badge.textContent = item.badge;
            badge.title = item.badgeTitle || "";
            srMarks(badge, item);
            row.appendChild(badge);
        }

        if (item.repeatOne) {

            const rep = document.createElement("span");

            rep.className = "mp-sr-rep";
            rep.textContent = "\u21BB 1";
            rep.title = "Repeat one";
            row.appendChild(rep);
        }

        // The heart, always there so the columns stay in line. Without a
        // badge, the corner marks sit on the heart instead
        const hbox = document.createElement("span");

        hbox.className = "mp-sr-hbox";
        heart.className = "mp-sr-heart";
        srPaintHeart(heart, item.liked === true);
        hbox.appendChild(heart);

        if (!item.badge) {
            srMarks(hbox, item);
        }

        row.appendChild(hbox);

        if (typeof o.onLike === "function") {

            heart.addEventListener("click", function (ev) {

                ev.stopPropagation();
                o.onLike(ev, heart);
            });
        }

        return { el: row, dot: dot, num: num, title: title, heart: heart };
    }

    // A song still being generated: a ring turning where the number goes,
    // the title greyed and what happens with it once ready
    function srPendingRow(item) {

        const row = document.createElement("div");
        const dot = document.createElement("span");
        const num = document.createElement("span");
        const ring = document.createElement("span");
        const title = document.createElement("span");
        const state = document.createElement("span");

        srStyle();
        row.className = "mp-sr pending";
        row.title = "Still generating on Mureka";
        dot.className = "mp-sr-dot";
        dot.textContent = "\u25CF";
        num.className = "mp-sr-num";
        ring.className = "mp-sr-ring";
        num.appendChild(ring);
        title.className = "mp-sr-title";
        title.textContent = item.title || "Untitled";
        state.className = "mp-sr-state";
        state.textContent = item.sending ? "Asked of Mureka"
            : item.playWhenReady ? (item.playAfter ? "Plays next when ready" : "Plays when ready") : "Generating";

        row.appendChild(dot);
        row.appendChild(num);
        row.appendChild(title);
        row.appendChild(state);

        // Put in a set already, the set's bar as its songs have
        if (item.setColor) {

            row.style.boxShadow = "inset 3px 0 0 " + item.setColor;
            row.dataset.setBar = row.style.boxShadow;
        }

        return { el: row, title: title };
    }
