    // The song menu as the player shows it, and the web view on a phone: a
    // small card at the press, the song's number and title over it, rows
    // of an icon and a name in groups with a thin line between, and the
    // stars at the foot. Each side fills it with its own rows, the look is
    // here, every rule under .mp-mn so nothing else is touched. Shared by
    // the player and the web view's page, src/shared/menu.js, inlined into
    // both by embed-webview.sh
    const MN_CSS = ""
        + ".mp-mn{background:#26262c;color:#fff;font:13px/1.4 sans-serif;border:1px solid #3a3a42;border-radius:8px;"
        + "box-shadow:0 6px 20px rgba(0,0,0,0.5);padding:4px;min-width:150px;box-sizing:border-box}"
        + ".mp-mn .mp-mn-head{display:flex;align-items:baseline;gap:8px;max-width:260px;padding:6px 10px 8px;margin:0 0 4px;"
        + "border-bottom:1px solid #3a3a42;cursor:default}"
        + ".mp-mn .mp-mn-num{flex:0 0 auto;color:#888;font-weight:400;font-variant-numeric:tabular-nums}"
        + ".mp-mn .mp-mn-title{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;"
        + "font-weight:600;color:" + ACCENT + "}"
        + ".mp-mn .mp-mn-badge{align-self:center;margin-left:0}"
        + ".mp-mn .mp-mn-body{overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}"
        + ".mp-mn .mp-mn-row{display:flex;align-items:center;gap:10px;width:100%;min-height:0;box-sizing:border-box;"
        + "padding:7px 10px;margin:0;border:none;border-radius:6px;background:transparent;box-shadow:none;"
        + "font:inherit;text-align:left;cursor:pointer}"
        + ".mp-mn .mp-mn-row svg{flex:0 0 auto;width:16px;height:16px;opacity:0.85}"
        + ".mp-mn .mp-mn-row:not(.mp-mn-off):not(:disabled):hover{background:#36363e}"
        + ".mp-mn .mp-mn-row:not(.mp-mn-off):not(:disabled):active{background:#4a4a54}"
        + ".mp-mn .mp-mn-off,.mp-mn .mp-mn-row:disabled{color:#777;opacity:1;cursor:default}"
        + ".mp-mn .mp-mn-line{height:1px;margin:4px 8px;background:#3a3a42}"
        + ".mp-mn .mp-mn-stars{border-top:1px solid #3a3a42;margin-top:4px;padding:8px 4px 6px}"
        + ".mp-mn .mp-mn-stars button{padding:6px}"
        + ".mp-mn .mp-mn-stars svg{width:30px;height:30px}"
        + ".mp-mn-caption{display:flex;align-items:center;justify-content:center;gap:10px}"
        + ".mp-mn .mp-mn-caption{font-size:12px;color:#aaa}"
        + ".mp-mn-clear{color:" + ACCENT + ";cursor:pointer;text-decoration:underline}";

    // The style sheet, once in a page
    function mnStyle() {

        if (document.getElementById("mp-mn-style")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "mp-mn-style";
        style.textContent = MN_CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    // The menu's head: the song's number in the list, when it has one, its
    // title and, for the account's own songs, the badge as in the list,
    // Public, Draft, New or Shared, with its marks: T trimmed, R remix, N a
    // note, a count of comments. badge: the list row's item, or null. A tap
    // on it does nothing and leaves the menu open
    function mnHead(head, number, title, badge) {

        const num = document.createElement("span");
        const name = document.createElement("span");

        head.textContent = "";
        head.classList.add("mp-mn-head");
        num.className = "mp-mn-num";
        num.textContent = number ? String(number) : "";
        name.className = "mp-mn-title";
        name.textContent = (title || "").trim() || "Untitled";

        if (number) {
            head.appendChild(num);
        }

        head.appendChild(name);

        if (badge && badge.badge) {

            const b = document.createElement("span");

            srStyle();
            b.className = "mp-sr-badge mp-mn-badge " + badge.badge;
            b.textContent = badge.badge;
            b.title = badge.badgeTitle || "";
            srMarks(b, badge);
            head.appendChild(b);
        }
    }

    // The rating under the stars, in words, with Remove rating once there
    // is one. Used under any row of stars with a caption, in a menu or not
    function mnCaption(box, text, clear) {

        const line = document.createElement("div");
        const words = document.createElement("span");

        mnStyle();
        box.textContent = "";
        line.className = "mp-mn-caption";
        words.textContent = text;
        line.appendChild(words);
        box.appendChild(line);

        if (clear) {

            const link = document.createElement("span");

            link.className = "mp-mn-clear";
            link.textContent = "Remove rating";
            link.addEventListener("click", function (ev) {

                ev.preventDefault();
                ev.stopPropagation();
                clear();
            });
            line.appendChild(link);
        }
    }

    // The card shown at x, y, moved in to fit what is seen of the page,
    // a phone's bars left out. Taller than that, body scrolls and the head
    // and the stars stay. The card is shown before, so it can be measured
    function mnPlace(card, body, x, y) {

        const vv = window.visualViewport;
        const viewH = vv ? vv.height : window.innerHeight;
        const viewW = vv ? vv.width : window.innerWidth;
        const viewTop = vv ? vv.offsetTop : 0;
        const viewLeft = vv ? vv.offsetLeft : 0;
        const room = Math.max(160, viewH - 16);

        card.style.position = "fixed";
        body.style.maxHeight = "";

        if (card.offsetHeight > room) {
            body.style.maxHeight = Math.max(80, body.offsetHeight - (card.offsetHeight - room)) + "px";
        }

        const w = card.offsetWidth;
        const h = card.offsetHeight;
        const left = Math.min(x, viewLeft + viewW - w - 8);
        const top = Math.min(y, viewTop + viewH - h - 8);

        card.style.left = Math.max(viewLeft + 8, left) + "px";
        card.style.top = Math.max(viewTop + 8, top) + "px";
    }
