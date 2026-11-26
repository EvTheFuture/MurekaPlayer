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
        + ".mp-ui-loading{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;font-size:12px;color:#888}"
        + ".mp-ui-ask{background:#26262c;border:1px solid #3a3a42;border-radius:10px;padding:14px;width:100%;max-width:340px;"
        + "box-sizing:border-box;display:flex;flex-direction:column;gap:10px;color:#fff;font-size:13px;text-align:left}"
        + ".mp-ui-ask-title{font-weight:600;overflow-wrap:anywhere}"
        + ".mp-ui-field{display:block;flex:0 0 auto;width:100%;box-sizing:border-box;margin:0;padding:8px 10px;"
        + "border:1px solid #4a4a52;border-radius:6px;background:#1b1b20;color:#fff;font:inherit;font-size:16px;outline:none}"
        + ".mp-ui-ask-text{color:#ccc;font-size:13px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;max-height:60vh;overflow-y:auto}"
        + ".mp-ui-ask-row{display:flex;gap:8px}"
        + ".mp-ui-ask-row .mp-ui-btn{flex:1}"
        + ".mp-ui-btn.yes{background:" + ACCENT + ";color:#000}"
        + ".mp-ui-btn.yes.danger{background:" + DANGER + ";color:#000}"
        + ".mp-ui-btn.ring{background:transparent;color:var(--ring," + ACCENT + ");box-shadow:inset 0 0 0 2px var(--ring," + ACCENT + ")}"
        + ".mp-ui-btn.cancel{background:transparent;color:" + DANGER + ";box-shadow:inset 0 0 0 2px " + DANGER + "}"
        + ".mp-ui-btn.full{background:" + DANGER + ";color:#000;box-shadow:none}"
        + ".mp-ui-band{display:flex;flex-direction:column;gap:2px;border-top:1px solid #3a3a42;border-bottom:1px solid #3a3a42;padding:6px 0}"
        + ".mp-ui-tick{display:flex;align-items:center;gap:10px;width:100%;min-height:0;cursor:pointer;background:transparent;border:none;"
        + "box-shadow:none;color:#fff;font:inherit;font-size:14px;padding:8px 4px;margin:0;text-align:left}"
        + ".mp-ui-tick-box{flex:0 0 auto;width:20px;height:20px;box-sizing:border-box;border-radius:5px;display:flex;align-items:center;"
        + "justify-content:center;font-weight:700;font-size:15px;line-height:1;color:#000;border:2px solid #8a8a94}"
        + ".mp-ui-tick.on .mp-ui-tick-box{background:" + ACCENT + ";border-color:" + ACCENT + "}"
        + ".mp-ui-tick-name{flex:1 1 auto;min-width:0}"
        + ".mp-ui-tick-count{flex:0 0 auto;color:#888;font-size:12px}"
        + "@media (pointer:coarse){.mp-ui-tick{min-height:44px}}"
        + ".mp-ui-pair{display:flex;gap:8px}"
        + ".mp-ui-pair .mp-ui-btn{flex:1 1 0;min-width:0}"
        + ".mp-ui-ch{background:#26262c;border:1px solid #3a3a42;border-radius:10px;padding:14px;width:100%;max-width:360px;"
        + "max-height:100%;overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:10px;color:#fff;"
        + "font-size:13px;text-align:left}"
        + ".mp-ui-ch-title{font-weight:600}"
        + ".mp-ui-ch-text{color:#ccc;font-size:13px;line-height:1.5;white-space:pre-line}"
        + ".mp-ui-ch-col{display:flex;flex-direction:column;gap:6px}"
        + ".mp-ui-ch-col .mp-ui-btn{width:100%}"
        + ".mp-ui-ch-col.tall{gap:8px}"
        + ".mp-ui-ch-col.tall .mp-ui-btn{min-height:56px;font-size:15px;border-radius:8px}"
        + ".mp-ui-ch-sub{display:block;font-size:11px;font-weight:400;opacity:0.75;margin-top:2px}"
        + ".mp-ui-ch-check{display:flex;align-items:center;gap:10px;padding:6px 2px;font-size:14px;color:#ddd;cursor:pointer}"
        + ".mp-ui-ch-check input{width:20px;height:20px;accent-color:" + ACCENT + ";margin:0}";

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

    // A plain button, dim for one that closes. Cancel is always ringed in
    // red, everywhere, so the way out looks the same in every dialog
    function uiBtn(label, fn, dim) {

        const b = document.createElement("button");

        uiStyle();
        b.type = "button";
        b.className = "mp-ui-btn" + (dim ? " dim" : "") + (uiIsCancel(label) ? " cancel" : "");
        b.textContent = label;
        b.addEventListener("click", fn);

        return b;
    }

    // Whether a button's name is Cancel, which is ringed in red
    function uiIsCancel(label) {
        return String(label || "").trim() === "Cancel";
    }

    // Cancel's red ring on a button styled by hand, see uiBtn
    function uiCancelLook(b) {

        b.style.background = "transparent";
        b.style.color = DANGER;
        b.style.boxShadow = "inset 0 0 0 2px " + DANGER;

        return b;
    }

    // Which kinds to take along or bring in, as the player and the web view
    // both ask: All and None side by side when asked for, a box to tick for
    // each kind with a count at the end when it has one, then Cancel and
    // the button that goes on. col: where they go. o: kinds as [{ label,
    // on, count }], on kept up to date; quick, All and None; action, the
    // name of the button that goes on; need, at least one kind ticked for
    // it; change(), told after each tap that ticks or unticks; go(),
    // onCancel()
    function uiKinds(col, o) {

        uiStyle();
        col.classList.add("mp-ui-ch-col");
        col.classList.remove("tall");

        const ticks = [];
        const band = document.createElement("div");
        const foot = document.createElement("div");
        const cancel = uiBtn("Cancel", function () {
            o.onCancel();
        });
        const go = uiBtn(o.action, function () {
            o.go();
        });

        const paint = function () {

            for (const t of ticks) {

                t.el.classList.toggle("on", t.kind.on === true);
                t.el.setAttribute("aria-checked", t.kind.on === true ? "true" : "false");
                t.box.textContent = t.kind.on === true ? "\u2713" : "";
            }

            go.disabled = o.need === true && !o.kinds.some(function (k) {
                return k.on === true;
            });
        };

        const changed = function () {

            paint();

            if (typeof o.change === "function") {
                o.change();
            }
        };

        const setAll = function (value) {

            for (const k of o.kinds) {
                k.on = value;
            }

            changed();
        };

        if (o.quick) {

            const quick = document.createElement("div");

            quick.className = "mp-ui-pair";
            quick.appendChild(uiBtn("All", function () {
                setAll(true);
            }));
            quick.appendChild(uiBtn("None", function () {
                setAll(false);
            }));
            col.appendChild(quick);
        }

        band.className = "mp-ui-band";

        for (const kind of o.kinds) {

            const el = document.createElement("button");
            const box = document.createElement("span");
            const name = document.createElement("span");

            el.type = "button";
            el.className = "mp-ui-tick";
            el.setAttribute("role", "checkbox");
            box.className = "mp-ui-tick-box";
            name.className = "mp-ui-tick-name";
            name.textContent = kind.label;
            el.appendChild(box);
            el.appendChild(name);

            if (kind.count !== undefined && kind.count !== null && kind.count !== "") {

                const count = document.createElement("span");

                count.className = "mp-ui-tick-count";
                count.textContent = String(kind.count);
                el.appendChild(count);
            }

            el.addEventListener("click", function () {

                kind.on = kind.on !== true;
                changed();
            });
            band.appendChild(el);
            ticks.push({ el: el, box: box, kind: kind });
        }

        col.appendChild(band);
        foot.className = "mp-ui-pair";
        go.classList.add("yes");
        foot.appendChild(cancel);
        foot.appendChild(go);
        col.appendChild(foot);
        paint();
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

    // A question in a card: its title, what it is about, anything else
    // to show, and Cancel and the answer side by side, the answer red for
    // something that cannot be undone. card: the card to fill. o: title,
    // text, extra (an element), no and yes (the buttons' names), danger,
    // onNo and onYes. Answers the buttons and the text
    function uiAsk(card, o) {

        const head = document.createElement("div");
        const text = document.createElement("div");
        const row = document.createElement("div");
        const no = uiBtn(o.no || "Cancel", o.onNo || function () {}, true);
        const yes = uiBtn(o.yes || "Yes", o.onYes || function () {});

        card.classList.add("mp-ui-ask");
        head.className = "mp-ui-ask-title";
        head.textContent = o.title || "";
        text.className = "mp-ui-ask-text";
        text.textContent = o.text || "";
        row.className = "mp-ui-ask-row";
        yes.classList.add("yes");
        yes.classList.toggle("danger", o.danger === true);
        row.appendChild(no);
        row.appendChild(yes);

        if (o.title) {
            card.appendChild(head);
        }

        card.appendChild(text);

        if (o.extra) {
            card.appendChild(o.extra);
        }

        card.appendChild(row);

        return { yes: yes, no: no, text: text };
    }

    // The answers of a question one under the other, as the player and the
    // web view on a phone both ask: a button for each answer, filled in the
    // accent, or with a look of its own to stand apart, a second smaller
    // line under it when given, a box to tick under them and Cancel at the
    // foot. The card around them is .mp-ui-ch, its title .mp-ui-ch-title
    // and the words about it .mp-ui-ch-text, each side builds those.
    // col: where the answers go. o: options as [{ label, sub, look, color,
    // disabled, fn }], look "" filled, "plain" grey, "ring" ringed in color
    // or the accent, "danger" filled in red for one that takes something
    // away; tall, larger
    // answers where a wrong tap does something else at once; check as
    // { label, on, change() }, on kept up to date; cancel, Cancel's name
    // or false for none; pick(fn) runs an answer, onCancel runs on Cancel
    function uiChoiceButtons(col, o) {

        uiStyle();
        col.classList.add("mp-ui-ch-col");
        col.classList.toggle("tall", o.tall === true);

        for (const opt of o.options) {

            const b = uiBtn(opt.label, function () {
                o.pick(opt.fn);
            });
            const look = opt.look || "";

            // An answer named Cancel ringed in red like the Cancel at the foot
            const out = uiIsCancel(opt.label);

            b.classList.toggle("yes", look === "" && !out);
            b.classList.toggle("ring", look === "ring" && !out);
            b.classList.toggle("full", look === "danger" && !out);
            b.classList.toggle("cancel", out);
            b.disabled = opt.disabled === true;

            if (look === "ring" && opt.color) {
                b.style.setProperty("--ring", opt.color);
            }

            if (opt.sub) {

                const sub = document.createElement("span");

                sub.className = "mp-ui-ch-sub";
                sub.textContent = opt.sub;
                b.appendChild(sub);
            }

            col.appendChild(b);
        }

        if (o.check && typeof o.check === "object") {

            const row = document.createElement("label");
            const box = document.createElement("input");
            const name = document.createElement("span");

            row.className = "mp-ui-ch-check";
            box.type = "checkbox";
            box.checked = o.check.on === true;
            box.addEventListener("change", function () {

                o.check.on = box.checked;

                if (typeof o.check.change === "function") {
                    o.check.change();
                }
            });
            name.textContent = o.check.label;
            row.appendChild(box);
            row.appendChild(name);
            col.appendChild(row);
        }

        // Cancel ringed in red, apart from the answers, whatever its name
        if (o.cancel !== false) {

            const cancel = uiBtn(o.cancel || "Cancel", o.onCancel || function () {}, true);

            cancel.classList.add("cancel");
            col.appendChild(cancel);
        }
    }
