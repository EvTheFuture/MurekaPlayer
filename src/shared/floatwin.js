    // A window of its own floating over the page, not shutting the page
    // away: a little see-through with the page blurred behind it, moved by
    // its top bar and sized from any edge or corner, with a mouse or a
    // finger. Its collapse button tucks it into the nearest edge of the
    // screen as a small tab, which a tap opens again. Where it was, how big
    // and whether tucked away are remembered in this browser.
    // Shared by the player and the web view's page, src/shared/floatwin.js,
    // inlined into both by embed-webview.sh
    //
    // opts: key, where to remember it; z, its z-index; width and height,
    // its first size; minW and minH; tabIcon, an element for the tab;
    // onFold(folded), told as it tucks away and comes back. Answers the
    // element, head (the bar it is moved by, for a title and buttons),
    // body, foldBtn (the collapse button, for the head), close(),
    // fold(), unfold(), folded() and badge(n), a count on the tab
    function makeFloatWindow(opts) {

        const el = document.createElement("div");
        const head = document.createElement("div");
        const body = document.createElement("div");
        const minW = opts.minW || 260;
        const minH = opts.minH || 220;
        const key = "murekaFloat:" + (opts.key || "window");
        const EDGE = 10;
        const CORNER = 22;
        let rect = null;
        const tab = document.createElement("div");
        const tabCount = document.createElement("span");
        const foldBtn = document.createElement("button");

        el.style.cssText = "position:fixed;z-index:" + (opts.z || 70) + ";display:flex;flex-direction:column;gap:8px;padding:10px 12px 12px;"
            + "box-sizing:border-box;border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:rgba(30,30,36,0.82);"
            + "-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 10px 34px rgba(0,0,0,0.55);color:#fff";
        head.style.cssText = "flex:0 0 auto;display:flex;align-items:center;gap:8px;cursor:move;touch-action:none;user-select:none;-webkit-user-select:none";
        body.style.cssText = "flex:1 1 auto;min-height:0;display:flex;flex-direction:column";
        el.appendChild(head);
        el.appendChild(body);

        try {
            rect = JSON.parse(localStorage.getItem(key) || "null");
        } catch (e) {
            rect = null;
        }

        // Where it goes first: as asked, or at the right, a third of the
        // width, or the whole width on a narrow screen
        if (!rect || typeof rect.x !== "number") {

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w = Math.min(vw - 16, opts.width || Math.max(minW, vw < 600 ? vw - 32 : Math.round(vw / 3)));
            const h = Math.min(vh - 16, opts.height || Math.max(minH, Math.round(vh * 0.6)));

            rect = { x: vw - w - 8, y: Math.max(8, Math.round((vh - h) / 2)), w: w, h: h };
        }

        // The tab it tucks into: a small rounded handle on the edge, with
        // the icon given and a count
        tab.style.cssText = "position:fixed;z-index:" + (opts.z || 70) + ";display:none;align-items:center;justify-content:center;gap:4px;"
            + "box-sizing:border-box;background:rgba(30,30,36,0.9);border:1px solid rgba(255,255,255,0.18);color:#48e1eb;cursor:pointer;"
            + "-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 4px 16px rgba(0,0,0,0.5);touch-action:none";
        tab.title = "Open it again";
        tab.setAttribute("role", "button");
        tabCount.style.cssText = "display:none;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:#ffb454;"
            + "color:#000;font-size:10px;font-weight:700;line-height:16px;text-align:center";

        if (opts.tabIcon) {
            tab.appendChild(opts.tabIcon);
        }

        tab.appendChild(tabCount);
        tab.addEventListener("click", function (ev) {

            ev.stopPropagation();
            unfold();
        });

        foldBtn.type = "button";
        foldBtn.title = "Tuck it into the nearest edge";
        foldBtn.setAttribute("aria-label", "Collapse to the edge");
        foldBtn.textContent = "\u2013";
        foldBtn.style.cssText = "flex:0 0 auto;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);"
            + "color:#ddd;font:inherit;font-size:20px;line-height:1;cursor:pointer;padding:0";
        foldBtn.addEventListener("click", function (ev) {

            ev.stopPropagation();
            fold();
        });

        // The nearest edge to the window's middle, and the tab on it there
        function placeTab() {

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const cx = rect.x + rect.w / 2;
            const cy = rect.y + rect.h / 2;
            const near = [["l", cx], ["r", vw - cx], ["t", cy], ["b", vh - cy]].sort(function (a, b) {
                return a[1] - b[1];
            })[0][0];
            const side = near === "l" || near === "r";
            const long = 72;
            const thin = 30;

            tab.style.flexDirection = side ? "column" : "row";
            tab.style.width = (side ? thin : long) + "px";
            tab.style.height = (side ? long : thin) + "px";
            tab.style.left = (near === "l" ? 0 : near === "r" ? vw - thin : Math.max(0, Math.min(vw - long, cx - long / 2))) + "px";
            tab.style.top = (near === "t" ? 0 : near === "b" ? vh - thin : Math.max(0, Math.min(vh - long, cy - long / 2))) + "px";
            tab.style.borderRadius = near === "l" ? "0 10px 10px 0" : near === "r" ? "10px 0 0 10px" : near === "t" ? "0 0 10px 10px" : "10px 10px 0 0";
        }

        function fold() {

            rect.folded = true;
            keep();
            el.style.display = "none";
            placeTab();
            tab.style.display = "flex";

            if (opts.onFold) {
                opts.onFold(true);
            }
        }

        function unfold() {

            rect.folded = false;
            keep();
            tab.style.display = "none";
            el.style.display = "flex";
            place();

            if (opts.onFold) {
                opts.onFold(false);
            }
        }

        // Kept inside the screen, with at least its bar in reach
        function place() {

            const vw = window.innerWidth;
            const vh = window.innerHeight;

            rect.w = Math.max(minW, Math.min(rect.w, vw));
            rect.h = Math.max(minH, Math.min(rect.h, vh));
            rect.x = Math.max(0, Math.min(rect.x, vw - rect.w));
            rect.y = Math.max(0, Math.min(rect.y, vh - rect.h));
            el.style.left = Math.round(rect.x) + "px";
            el.style.top = Math.round(rect.y) + "px";
            el.style.width = Math.round(rect.w) + "px";
            el.style.height = Math.round(rect.h) + "px";
        }

        function keep() {

            try {
                localStorage.setItem(key, JSON.stringify(rect));
            } catch (e) {
            }
        }

        // A press that moves it or sizes it: dx and dy as they apply to the
        // left, top, right and bottom edges
        function grab(handle, sides) {

            handle.addEventListener("pointerdown", function (ev) {

                if (sides.move && ev.target.closest && ev.target.closest("button,input,textarea,select,a")) {
                    return;
                }

                ev.preventDefault();
                ev.stopPropagation();

                const start = { x: ev.clientX, y: ev.clientY, r: { x: rect.x, y: rect.y, w: rect.w, h: rect.h } };

                try {
                    handle.setPointerCapture(ev.pointerId);
                } catch (e) {
                }

                const move = function (e) {

                    const dx = e.clientX - start.x;
                    const dy = e.clientY - start.y;
                    const r = start.r;

                    if (sides.move) {

                        rect.x = r.x + dx;
                        rect.y = r.y + dy;
                    } else {

                        if (sides.l) {

                            const w = Math.max(minW, r.w - dx);

                            rect.x = r.x + r.w - w;
                            rect.w = w;
                        }

                        if (sides.r) {
                            rect.w = Math.max(minW, r.w + dx);
                        }

                        if (sides.t) {

                            const h = Math.max(minH, r.h - dy);

                            rect.y = r.y + r.h - h;
                            rect.h = h;
                        }

                        if (sides.b) {
                            rect.h = Math.max(minH, r.h + dy);
                        }
                    }

                    place();
                };
                const up = function () {

                    handle.removeEventListener("pointermove", move);
                    handle.removeEventListener("pointerup", up);
                    handle.removeEventListener("pointercancel", up);
                    keep();
                };

                handle.addEventListener("pointermove", move);
                handle.addEventListener("pointerup", up);
                handle.addEventListener("pointercancel", up);
            });
        }

        grab(head, { move: true });

        // The edges and the corners, a little outside the window so they
        // are easy to catch, the corners larger
        const handles = [
            { css: "left:-" + EDGE / 2 + "px;top:" + CORNER / 2 + "px;bottom:" + CORNER / 2 + "px;width:" + EDGE + "px;cursor:ew-resize", s: { l: true } },
            { css: "right:-" + EDGE / 2 + "px;top:" + CORNER / 2 + "px;bottom:" + CORNER / 2 + "px;width:" + EDGE + "px;cursor:ew-resize", s: { r: true } },
            { css: "top:-" + EDGE / 2 + "px;left:" + CORNER / 2 + "px;right:" + CORNER / 2 + "px;height:" + EDGE + "px;cursor:ns-resize", s: { t: true } },
            { css: "bottom:-" + EDGE / 2 + "px;left:" + CORNER / 2 + "px;right:" + CORNER / 2 + "px;height:" + EDGE + "px;cursor:ns-resize", s: { b: true } },
            { css: "left:-" + CORNER / 2 + "px;top:-" + CORNER / 2 + "px;width:" + CORNER + "px;height:" + CORNER + "px;cursor:nwse-resize", s: { l: true, t: true } },
            { css: "right:-" + CORNER / 2 + "px;top:-" + CORNER / 2 + "px;width:" + CORNER + "px;height:" + CORNER + "px;cursor:nesw-resize", s: { r: true, t: true } },
            { css: "left:-" + CORNER / 2 + "px;bottom:-" + CORNER / 2 + "px;width:" + CORNER + "px;height:" + CORNER + "px;cursor:nesw-resize", s: { l: true, b: true } },
            { css: "right:-" + CORNER / 2 + "px;bottom:-" + CORNER / 2 + "px;width:" + CORNER + "px;height:" + CORNER + "px;cursor:nwse-resize", s: { r: true, b: true } }
        ];

        for (const h of handles) {

            const d = document.createElement("div");

            d.style.cssText = "position:absolute;z-index:2;touch-action:none;" + h.css;
            grab(d, h.s);
            el.appendChild(d);
        }

        // A mark in the lower right corner that it can be sized
        const grip = document.createElement("div");

        grip.style.cssText = "position:absolute;right:3px;bottom:3px;width:10px;height:10px;pointer-events:none;opacity:0.5;"
            + "border-right:2px solid #aaa;border-bottom:2px solid #aaa;border-bottom-right-radius:3px";
        el.appendChild(grip);

        const onResize = function () {

            place();

            if (rect.folded) {
                placeTab();
            }
        };

        window.addEventListener("resize", onResize);
        place();

        return {
            el: el,
            tab: tab,
            head: head,
            body: body,
            foldBtn: foldBtn,
            fold: fold,
            unfold: unfold,
            folded: function () {
                return rect.folded === true;
            },
            badge: function (n) {

                tabCount.textContent = n > 99 ? "99+" : n > 0 ? String(n) : "";
                tabCount.style.display = n > 0 ? "" : "none";
            },

            // Shown where it was left, tucked away or not
            show: function (parent) {

                parent.appendChild(el);
                parent.appendChild(tab);

                if (rect.folded) {
                    fold();
                }
            },
            close: function () {

                window.removeEventListener("resize", onResize);
                el.remove();
                tab.remove();
            }
        };
    }
