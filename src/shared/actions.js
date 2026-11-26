    // The actions as the player shows them from the menu button under its
    // title, and the web view on a phone: a card of rows of tiles, each an
    // icon over a short name on dark grey, a few to a row. Shared by the
    // player and the web view's page, src/shared/actions.js, inlined into
    // both by embed-webview.sh
    const ACT_CSS = ""
        + ".mp-act-card{background:#26262c;color:#fff;font:13px/1.4 sans-serif;border:1px solid #3a3a42;border-radius:8px;"
        + "box-shadow:0 8px 24px rgba(0,0,0,0.5);padding:8px;box-sizing:border-box;display:flex;flex-direction:column;gap:6px}"
        + ".mp-act-row{display:flex;gap:6px}"
        + ".mp-act{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;"
        + "margin:0;padding:9px 4px;border:none;border-radius:8px;background:#444;color:#fff;font:600 11px/1 sans-serif;cursor:pointer}"
        + ".mp-act-icon{display:flex;align-items:center;justify-content:center;height:18px}"
        + ".mp-act-icon svg{width:18px;height:18px}"
        + ".mp-act-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
        + ".mp-act.on{background:" + ACCENT + ";color:#000}"
        + ".mp-act.danger{color:#ff8a8a;box-shadow:inset 0 0 0 2px " + DANGER + "}";

    // The style sheet, once in a page
    function actStyle() {

        if (document.getElementById("mp-act-style")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "mp-act-style";
        style.textContent = ACT_CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    // One tile, its icon over its name. Answers the button with iconEl and
    // labelEl, to change them later
    function actTile(iconNode, label, fn) {

        const b = document.createElement("button");
        const iconEl = document.createElement("span");
        const labelEl = document.createElement("span");

        actStyle();
        b.type = "button";
        b.className = "mp-act";
        iconEl.className = "mp-act-icon";
        labelEl.className = "mp-act-label";
        labelEl.textContent = label;

        if (iconNode) {
            iconEl.appendChild(iconNode);
        }

        b.appendChild(iconEl);
        b.appendChild(labelEl);
        b.addEventListener("click", fn);
        b.iconEl = iconEl;
        b.labelEl = labelEl;

        return b;
    }

    // A row of tiles side by side, sharing its width
    function actRow(tiles) {

        const row = document.createElement("div");

        row.className = "mp-act-row";

        for (const t of tiles) {

            if (t) {
                row.appendChild(t);
            }
        }

        return row;
    }
