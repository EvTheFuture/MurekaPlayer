    // Small parts both the player and the web view draw the same way: an
    // icon from its shapes, a turning ring, a plain button and the card of
    // a dialog. Each kind of part has its look in one style sheet, put in
    // the page once. Shared by the player and the web view's page,
    // src/shared/ui.js, inlined into both by embed-webview.sh
    const UI_CSS = ""
        + ".mp-ui-spin{flex:0 0 auto;display:inline-block;box-sizing:border-box;border:2px solid rgba(" + ACCENT_RGB + ",0.3);"
        + "border-top-color:" + ACCENT + ";border-radius:50%;animation:mp-ui-turn 0.8s linear infinite}"
        + "@keyframes mp-ui-turn{to{transform:rotate(360deg)}}"
        + ".mp-ui-btn{flex:0 0 auto;min-height:30px;box-sizing:border-box;padding:7px 10px;border:none;border-radius:6px;"
        + "background:#333;color:#fff;font:inherit;font-size:13px;font-weight:600;cursor:pointer}"
        + ".mp-ui-btn.dim{background:#444}"
        + ".mp-ui-btn.on{background:" + ACCENT + ";color:#000}"
        + ".mp-ui-btn:disabled{opacity:0.5;cursor:default}"
        + ".mp-ui-btn{transition:filter 0.08s ease,transform 0.08s ease}"
        + ".mp-ui-btn:not(:disabled):active{filter:brightness(1.45);transform:scale(0.96)}"
        + "@media (pointer:coarse){.mp-ui-btn{min-height:44px}}"
        + ".mp-ui-card{background:#26262c;border:1px solid #3a3a42;border-radius:10px;padding:12px;width:100%;max-width:420px;"
        + "max-height:86%;box-sizing:border-box;display:flex;flex-direction:column;gap:8px;color:#fff;font-size:13px;line-height:1.4;"
        + "text-align:left}"
        + ".mp-ui-head{display:flex;gap:8px;align-items:center}"
        + ".mp-ui-title{font-weight:600;min-width:0}"
        + ".mp-ui-gap{flex:1 1 auto}"
        + ".mp-ui-note{font-size:12px;color:#888;line-height:1.5;padding:4px 2px}"
        + ".mp-ui-loading{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;font-size:12px;color:#888}";

    // The style sheet, once in a page
    function uiStyle() {

        if (document.getElementById("mp-ui-style")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "mp-ui-style";
        style.textContent = UI_CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    // An icon from its shapes, 24 units square with round strokes in the
    // colour of the text around it
    function uiSvg(shapes, size) {

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        const s = String(size || 18);

        svg.setAttribute("width", s);
        svg.setAttribute("height", s);
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        for (const shape of shapes) {

            const el = document.createElementNS(ns, shape[0]);

            for (const key of Object.keys(shape[1])) {
                el.setAttribute(key, shape[1][key]);
            }

            svg.appendChild(el);
        }

        return svg;
    }

    // A ring turning while something is read
    function uiSpin(size) {

        const ring = document.createElement("span");

        uiStyle();
        ring.className = "mp-ui-spin";
        ring.style.width = size + "px";
        ring.style.height = size + "px";

        return ring;
    }

    // A plain button, dim for one that closes
    function uiBtn(label, fn, dim) {

        const b = document.createElement("button");

        uiStyle();
        b.type = "button";
        b.className = "mp-ui-btn" + (dim ? " dim" : "");
        b.textContent = label;
        b.addEventListener("click", fn);

        return b;
    }

    // A line saying something is being read, with its ring
    function uiLoading(text) {

        const box = document.createElement("div");
        const word = document.createElement("span");

        box.className = "mp-ui-loading";
        word.textContent = text;
        box.appendChild(uiSpin(14));
        box.appendChild(word);

        return box;
    }

    // A dialog's head: its title, a ring while reading, then the buttons
    // at the right
    function uiHead(title, buttons) {

        const head = document.createElement("div");
        const name = document.createElement("div");
        const spin = uiSpin(12);
        const gap = document.createElement("div");

        uiStyle();
        head.className = "mp-ui-head";
        name.className = "mp-ui-title";
        name.textContent = title;
        spin.style.display = "none";
        gap.className = "mp-ui-gap";
        head.appendChild(name);
        head.appendChild(spin);
        head.appendChild(gap);

        for (const b of buttons) {
            head.appendChild(b);
        }

        return { el: head, title: name, spin: spin };
    }
