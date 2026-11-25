    // The cover editor both the player and the web view open for a new
    // cover: the picture in a square to move and zoom, by finger, mouse or
    // slider, then Set cover or Cancel. Shared by the player and the web
    // view's page, src/shared/cover.js, inlined into both by
    // embed-webview.sh

    function buildCoverEditor(img, url, title, host, big, done) {

        const W = img.naturalWidth;
        const H = img.naturalHeight;

        if (W < 1 || H < 1) {

            URL.revokeObjectURL(url);
            done(null, "the picture is empty");
            return;
        }

        const back = document.createElement("div");
        const card = document.createElement("div");
        const head = document.createElement("div");
        const view = document.createElement("div");
        const slider = document.createElement("input");
        const hint = document.createElement("div");
        const row = document.createElement("div");
        const pts = new Map();

        back.style.cssText = "position:" + (host === document.body ? "fixed" : "absolute") + ";inset:0;"
            + "background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;"
            + "z-index:300;font-size:" + (big ? "clamp(16px,1.8vw,24px)" : "14px");
        card.style.cssText = "background:#26262c;border:1px solid #3a3a42;border-radius:12px;padding:14px;"
            + "display:flex;flex-direction:column;gap:10px;align-items:stretch;color:#fff";
        head.textContent = "New cover for \"" + (title || "Untitled") + "\"";
        head.style.cssText = "font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        view.style.cssText = "position:relative;overflow:hidden;touch-action:none;background:#000;"
            + "border-radius:8px;cursor:grab;align-self:center;box-shadow:inset 0 0 0 1px " + ACCENT;
        img.draggable = false;
        img.alt = "";
        img.style.cssText = "position:absolute;left:0;top:0;max-width:none;max-height:none;"
            + "transform-origin:0 0;pointer-events:none;user-select:none;width:" + W + "px;height:" + H + "px";
        slider.type = "range";
        slider.min = "0";
        slider.max = "1000";
        slider.value = "0";
        slider.style.cssText = "width:100%;accent-color:" + ACCENT;
        hint.textContent = "Drag to move it. Pinch, scroll or slide to zoom.";
        hint.style.cssText = "color:#aaa;font-size:0.85em";
        row.style.cssText = "display:flex;gap:8px";

        const button = function (text, bg, fg, fn) {

            const b = document.createElement("button");

            b.type = "button";
            b.textContent = text;
            b.style.cssText = "flex:1;padding:0.6em 1em;border:none;border-radius:10px;font:inherit;"
                + "font-weight:600;cursor:pointer;background:" + bg + ";color:" + fg;
            b.addEventListener("click", fn);

            return b;
        };

        // The square's side on screen, and the picture's scale and place in it
        let side = 0;
        let minScale = 1;
        let maxScale = 8;
        let scale = 1;
        let tx = 0;
        let ty = 0;
        let pinch = null;
        let placed = false;

        const clamp = function () {

            scale = Math.max(minScale, Math.min(maxScale, scale));
            tx = Math.min(0, Math.max(side - W * scale, tx));
            ty = Math.min(0, Math.max(side - H * scale, ty));
        };

        const paint = function () {

            img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
            slider.value = String(Math.round(Math.log(scale / minScale) / Math.log(maxScale / minScale) * 1000));
        };

        // Zoomed around a point in the square, which stays where it is
        const zoomAt = function (wanted, cx, cy) {

            const next = Math.max(minScale, Math.min(maxScale, wanted));

            tx = cx - (cx - tx) * next / scale;
            ty = cy - (cy - ty) * next / scale;
            scale = next;
            clamp();
            paint();
        };

        // The square as large as the room allows. A change of the room keeps
        // the same part of the picture in it
        const layout = function () {

            const room = Math.min(back.clientWidth - 64, back.clientHeight - (big ? 260 : 210));
            const next = Math.max(140, Math.min(big ? 560 : 420, room));

            if (side > 0) {

                const k = next / side;

                tx *= k;
                ty *= k;
                scale *= k;
            }

            side = next;
            view.style.width = side + "px";
            view.style.height = side + "px";
            minScale = side / Math.min(W, H);

            // Down to a sixteenth of the shorter side, never below 64 pixels
            maxScale = Math.max(minScale * 1.01, side / Math.max(64, Math.min(W, H) / 16));

            // At first the whole shorter side fills the square, centred
            if (!placed) {

                placed = true;
                scale = minScale;
                tx = (side - W * scale) / 2;
                ty = (side - H * scale) / 2;
            }

            clamp();
            paint();
        };

        const at = function (ev) {

            const r = view.getBoundingClientRect();

            return { x: ev.clientX - r.left, y: ev.clientY - r.top };
        };

        const twoFingers = function () {

            const a = Array.from(pts.values());
            const dx = a[1].x - a[0].x;
            const dy = a[1].y - a[0].y;

            return { d: Math.max(1, Math.sqrt(dx * dx + dy * dy)), x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
        };

        view.addEventListener("pointerdown", function (ev) {

            ev.preventDefault();
            ev.stopPropagation();

            try {
                view.setPointerCapture(ev.pointerId);
            } catch (e) {
                // Moves are still heard while over the square
            }

            pts.set(ev.pointerId, at(ev));
            pinch = pts.size === 2 ? twoFingers() : null;
            view.style.cursor = "grabbing";
        });

        view.addEventListener("pointermove", function (ev) {

            if (!pts.has(ev.pointerId)) {
                return;
            }

            const was = pts.get(ev.pointerId);
            const now = at(ev);

            pts.set(ev.pointerId, now);

            if (pts.size === 1) {

                tx += now.x - was.x;
                ty += now.y - was.y;
                clamp();
                paint();
            } else if (pts.size === 2 && pinch) {

                const p = twoFingers();

                tx += p.x - pinch.x;
                ty += p.y - pinch.y;
                zoomAt(scale * p.d / pinch.d, p.x, p.y);
                pinch = p;
            }
        });

        const lift = function (ev) {

            pts.delete(ev.pointerId);
            pinch = pts.size === 2 ? twoFingers() : null;

            if (pts.size === 0) {
                view.style.cursor = "grab";
            }
        };

        view.addEventListener("pointerup", lift);
        view.addEventListener("pointercancel", lift);

        view.addEventListener("wheel", function (ev) {

            ev.preventDefault();
            ev.stopPropagation();

            const p = at(ev);

            zoomAt(scale * Math.exp(-ev.deltaY * 0.0015), p.x, p.y);
        }, { passive: false });

        slider.addEventListener("input", function () {
            zoomAt(minScale * Math.pow(maxScale / minScale, Number(slider.value) / 1000), side / 2, side / 2);
        });

        let offBack = null;

        const close = function (result) {

            window.removeEventListener("resize", layout);
            back.remove();
            URL.revokeObjectURL(url);

            if (offBack) {
                offBack();
            }

            done(result);
        };

        // The web view's Back and Escape close it as Cancel does
        if (typeof onBack === "function") {

            offBack = onBack(function () {
                close(null);
            });
        }

        const finish = function () {

            const s = Math.max(1, Math.min(Math.min(W, H), Math.round(side / scale)));
            const x = Math.max(0, Math.min(W - s, Math.round(-tx / scale)));
            const y = Math.max(0, Math.min(H - s, Math.round(-ty / scale)));

            close({ x: x, y: y, s: s, w: W, h: H });
        };

        row.appendChild(button("Cancel", "#444", "#fff", function () {
            close(null);
        }));
        row.appendChild(button("Set cover", ACCENT, "#000", finish));

        // The page's own keys never hear what is pressed here
        back.addEventListener("keydown", function (ev) {

            ev.stopPropagation();

            if (ev.key === "Escape") {
                close(null);
            } else if (ev.key === "Enter" && ev.target !== slider) {
                finish();
            }
        });

        back.addEventListener("click", function (ev) {

            ev.stopPropagation();

            if (ev.target === back) {
                close(null);
            }
        });

        view.appendChild(img);
        card.appendChild(head);
        card.appendChild(view);
        card.appendChild(slider);
        card.appendChild(hint);
        card.appendChild(row);
        back.appendChild(card);
        host.appendChild(back);
        window.addEventListener("resize", layout);
        layout();
        slider.focus();
    }
