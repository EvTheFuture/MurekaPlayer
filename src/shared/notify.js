    // Mureka's notifications, newest first, as the player and the web view
    // both show them: a disc in the kind's colour, who, what and when, the
    // comment of a comment and the song's cover. A tap marks one read and
    // opens what it is about, the song's title and cover play the song.
    // Older ones load on their own near the end. Shared by the player and
    // the web view's page, src/shared/notify.js, inlined into both by
    // embed-webview.sh
    //
    // card: the dialog's card to fill. host: list(after), a promise of
    // { ok, list, last, why }, the first page with after empty; readAll(),
    // a promise of { ok, why }; open(m) and play(m), what a tap does;
    // counted(), whether Mureka counts unread ones this list may not hold;
    // cover(url), the address to show a cover by; toast(text, ok); close().
    // Answers { show(list, last) }, for a first page read elsewhere
    const NF_CSS = ""
        + ".mp-nf-list{flex:1 1 auto;min-height:80px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;"
        + "-webkit-overflow-scrolling:touch;overscroll-behavior:contain}"
        + ".mp-nf-item{flex:0 0 auto;display:flex;gap:10px;align-items:flex-start;padding:9px 10px 9px 8px;border-radius:8px;"
        + "cursor:pointer;border-left:3px solid transparent;background:#1c1c21}"
        + ".mp-nf-item.unread{border-left-color:" + ACCENT + ";background:#2c3238}"
        + ".mp-nf-disc{flex:0 0 auto;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:0.75}"
        + ".mp-nf-item.unread .mp-nf-disc{opacity:1}"
        + ".mp-nf-mid{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}"
        + ".mp-nf-top{display:flex;gap:8px;align-items:baseline;font-size:13px}"
        + ".mp-nf-who{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ccc}"
        + ".mp-nf-item.unread .mp-nf-who{color:#fff}"
        + ".mp-nf-new{flex:0 0 auto;padding:0 6px;border-radius:7px;background:" + ACCENT + ";color:#000;font-size:10px;font-weight:700;line-height:15px}"
        + ".mp-nf-when{flex:0 0 auto;margin-left:auto;font-size:11px;color:#888}"
        + ".mp-nf-what{font-size:13px;line-height:1.4;overflow-wrap:anywhere;color:#999}"
        + ".mp-nf-item.unread .mp-nf-what{color:#ccc}"
        + ".mp-nf-song{color:" + ACCENT + ";font-weight:600;cursor:pointer}"
        + ".mp-nf-said{font-size:13px;line-height:1.4;padding:2px 0 2px 8px;border-left:2px solid;white-space:pre-wrap;"
        + "overflow-wrap:anywhere;color:#aaa}"
        + ".mp-nf-item.unread .mp-nf-said{color:#eee}"
        + ".mp-nf-pic{flex:0 0 auto;width:44px;height:44px;border-radius:6px;object-fit:cover;background:#333}";

    // When something was written, as a short time ago
    function commentAge(at) {

        const s = Math.max(0, (Date.now() - at) / 1000);

        if (s < 60) {
            return "now";
        }

        if (s < 3600) {
            return Math.floor(s / 60) + " min";
        }

        if (s < 86400) {
            return Math.floor(s / 3600) + " h";
        }

        if (s < 86400 * 30) {
            return Math.floor(s / 86400) + " d";
        }

        return new Date(at).toLocaleDateString();
    }

    function nfView(card, host) {

        let firstItems = [];
        let extra = [];
        let items = [];
        let last = "";
        let busy = false;
        let first = true;

        if (!document.getElementById("mp-nf-style")) {

            const style = document.createElement("style");

            style.id = "mp-nf-style";
            style.textContent = NF_CSS;
            (document.head || document.documentElement).appendChild(style);
        }

        const all = uiBtn("Mark all read", function () {

            all.disabled = true;
            host.readAll().then(function (r) {

                all.disabled = false;

                for (const m of items) {

                    m.read = true;
                    m.unreadThere = false;
                }

                paint();

                if (!r || !r.ok) {
                    host.toast("Marked read here, Mureka did not take it" + (r && r.why ? ": " + r.why : ""), false);
                }
            });
        });
        const head = uiHead("Notifications", [all, uiBtn("Close", host.close, true)]);
        const listBox = document.createElement("div");

        card.classList.add("mp-ui-card");
        listBox.className = "mp-nf-list";
        listBox.addEventListener("scroll", nearEnd, { passive: true });
        card.appendChild(head.el);
        card.appendChild(listBox);

        function row(m) {

            const kind = msgKind(m.code);
            const box = document.createElement("div");
            const disc = document.createElement("span");
            const mid = document.createElement("div");
            const top = document.createElement("div");
            const who = document.createElement("span");
            const when = document.createElement("span");
            const what = document.createElement("div");

            box.className = "mp-nf-item" + (m.read ? "" : " unread");
            box.setAttribute("role", "button");
            box.tabIndex = 0;
            box.title = m.song ? (/^(1002|2003|2004)$/.test(m.code) ? "Open the comments" : "Play the song")
                : m.video ? "Watch the video" : m.on ? "Open the comments" : m.link ? "Open it on Mureka" : "Mark read";
            disc.className = "mp-nf-disc";
            disc.title = kind.name;
            disc.style.color = kind.color;
            disc.style.background = kind.color + "2e";
            disc.appendChild(uiSvg(kind.shapes, 16));
            mid.className = "mp-nf-mid";
            top.className = "mp-nf-top";
            who.className = "mp-nf-who";
            who.textContent = m.who;
            when.className = "mp-nf-when";
            when.textContent = m.at ? commentAge(m.at) : "";
            what.className = "mp-nf-what";
            top.appendChild(who);

            // A new one says so beside the name, not by its colours alone
            if (!m.read) {

                const tag = document.createElement("span");

                tag.className = "mp-nf-new";
                tag.textContent = "New";
                top.appendChild(tag);
            }

            top.appendChild(when);
            mid.appendChild(top);

            // What happened, the song's title a link that plays it
            const at = m.title && m.song ? String(m.what).indexOf("\"" + m.title + "\"") : -1;

            if (at >= 0) {

                const link = document.createElement("span");

                link.className = "mp-nf-song";
                link.textContent = m.title;
                link.title = "Play the song";
                link.addEventListener("click", function (ev) {

                    ev.stopPropagation();
                    play(m);
                });
                what.appendChild(document.createTextNode(m.what.slice(0, at)));
                what.appendChild(link);
                what.appendChild(document.createTextNode(m.what.slice(at + m.title.length + 2)));
            } else {
                what.textContent = m.what;
            }

            mid.appendChild(what);

            if (m.text) {

                const said = document.createElement("div");

                said.className = "mp-nf-said";
                said.style.borderLeftColor = kind.color;
                said.textContent = m.text;
                mid.appendChild(said);
            }

            box.appendChild(disc);
            box.appendChild(mid);

            if (m.cover) {

                const pic = document.createElement("img");

                pic.className = "mp-nf-pic";
                pic.src = host.cover(m.cover);
                pic.alt = "";
                pic.loading = "lazy";
                pic.addEventListener("error", function () {
                    pic.remove();
                });

                if (m.song) {

                    pic.title = "Play the song";
                    pic.addEventListener("click", function (ev) {

                        ev.stopPropagation();
                        play(m);
                    });
                }

                box.appendChild(pic);
            }

            box.addEventListener("click", function () {
                open(m);
            });
            box.addEventListener("keydown", function (ev) {

                if (ev.key === "Enter" || ev.key === " ") {

                    ev.preventDefault();
                    open(m);
                }
            });

            return box;
        }

        function open(m) {

            m.read = true;
            paint();
            host.open(m);
        }

        function play(m) {

            m.read = true;
            paint();
            host.play(m);
        }

        function paint() {

            const keep = listBox.scrollTop;

            listBox.textContent = "";

            for (const m of items) {
                listBox.appendChild(row(m));
            }

            if (!items.length && busy) {
                listBox.appendChild(uiLoading("Reading Mureka's notifications"));
            } else if (!items.length) {

                const note = document.createElement("div");

                note.className = "mp-ui-note";
                note.textContent = "No notifications";
                listBox.appendChild(note);
            } else if (busy && !first) {
                listBox.appendChild(uiLoading("Loading older notifications"));
            }

            listBox.scrollTop = keep;
            head.spin.style.display = busy && first && items.length ? "" : "none";

            // Also for the unread ones Mureka counts, which this list may
            // give as read
            all.style.display = host.counted() || items.some(function (m) {
                return !m.read || m.unreadThere;
            }) ? "" : "none";
        }

        // Older ones loaded once the list is scrolled near its end, or
        // when it does not fill the box
        function nearEnd() {

            if (!busy && last && listBox.scrollTop + listBox.clientHeight >= listBox.scrollHeight - 240) {
                load(false);
            }
        }

        function load(firstPage) {

            if (busy) {
                return;
            }

            busy = true;
            paint();
            host.list(firstPage ? "" : last).then(function (r) {

                busy = false;

                if (!r || !r.ok) {

                    last = "";

                    if (!firstPage) {
                        host.toast("Could not read more notifications" + (r && r.why ? ": " + r.why : ""), false);
                    }

                    paint();

                    if (firstPage) {

                        const note = document.createElement("div");

                        note.className = "mp-ui-note";
                        note.textContent = "Could not read the notifications" + (r && r.why ? ": " + r.why : "");
                        listBox.appendChild(note);
                    }

                    first = false;
                    return;
                }

                const list = Array.isArray(r.list) ? r.list : [];

                if (firstPage) {
                    firstItems = list;
                } else {
                    extra = extra.concat(list);
                }

                items = firstItems.concat(extra);
                last = String(r.last || "");
                first = false;
                paint();
                nearEnd();
            });
        }

        load(true);

        return {

            // The first page read again elsewhere, the older ones kept
            show: function (list, lastAfter) {

                firstItems = list;
                items = firstItems.concat(extra);

                if (!extra.length) {
                    last = lastAfter || "";
                }

                paint();
            }
        };
    }
