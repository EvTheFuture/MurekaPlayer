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

        row.appendChild(uiCancelLook(button("Cancel", "#444", "#fff", function () {
            close(null);
        })));
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

    // The largest picture file taken for a cover, what the storage can still
    // work on
    const COVER_FILE_MAX = 20 * 1024 * 1024;

    // The first picture in a paste, as a file, or null
    function pastedPicture(ev) {

        const items = ev && ev.clipboardData ? Array.from(ev.clipboardData.items || []) : [];

        for (const item of items) {

            if (item.kind === "file" && /^image\//.test(item.type)) {
                return item.getAsFile();
            }
        }

        return null;
    }

    // The picture of the clipboard, as a file, or null. Asked of the
    // browser, which may ask whether to allow it
    async function clipboardPicture() {

        if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
            return null;
        }

        const items = await navigator.clipboard.read();

        for (const item of items) {

            const type = item.types.find(function (t) {
                return /^image\//.test(t);
            });

            if (type) {

                const blob = await item.getType(type);

                return new File([blob], "pasted." + (type.split("/")[1] || "png"), { type: type });
            }
        }

        return null;
    }

    // A place to paste a picture into, where the page may not read the
    // clipboard itself: pressed and held, the browser's own Paste puts the
    // picture there, as Ctrl+V does with a keyboard
    function pasteBox(where, touch, onFile, say) {

        const host = where || document.body;
        const back = document.createElement("div");
        const card = document.createElement("div");
        const text = document.createElement("div");
        const field = document.createElement("div");
        const cancel = uiBtn("Cancel", function () {
            close();
        }, true);
        const close = function () {
            back.remove();
        };

        back.setAttribute("data-mureka-notice", "1");
        back.setAttribute("data-mureka-dialog", "panel");
        back.style.cssText = "position:" + (host === document.body ? "fixed" : "absolute") + ";inset:0;background:rgba(0,0,0,0.6);"
            + "display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;z-index:2147483600";
        back.__cancel = close;
        back.addEventListener("click", function (ev) {

            if (ev.target === back) {
                close();
            }
        });
        uiStyle();
        card.className = "mp-ui-ask";
        text.textContent = touch ? "Press and hold in the box, then Paste" : "Click in the box and press Ctrl+V, or use Paste";
        text.style.cssText = "color:#ccc;line-height:1.5";
        field.contentEditable = "true";
        field.setAttribute("aria-label", "Paste the picture here");
        field.style.cssText = "min-height:90px;border:2px dashed " + ACCENT + ";border-radius:8px;outline:none;color:transparent;"
            + "caret-color:" + ACCENT + ";overflow:hidden";
        cancel.style.alignSelf = "flex-end";

        field.addEventListener("paste", function (ev) {

            const file = pastedPicture(ev);

            ev.preventDefault();
            ev.stopPropagation();

            if (!file) {

                say("No picture in what was pasted");
                return;
            }

            close();
            onFile(file);
        });

        // Typed or dropped text is not kept
        field.addEventListener("input", function () {
            field.textContent = "";
        });

        card.appendChild(text);
        card.appendChild(field);
        card.appendChild(cancel);
        back.appendChild(card);
        host.appendChild(back);
        field.focus();
    }

    // A picture taken for a new cover: one too large told, else its square
    // picked in the cover editor. title, host and big as openCoverEditor;
    // done(file, crop) with the square picked; say(text) a failure told
    function coverFromFile(file, title, host, big, done, say) {

        if (!file) {
            return;
        }

        if (file.size > COVER_FILE_MAX) {

            say("The picture is too large, at most " + Math.round(COVER_FILE_MAX / 1048576) + " MB");
            return;
        }

        openCoverEditor(file, title, host, big, function (crop, why) {

            if (crop) {
                done(file, crop);
            } else if (why) {
                say("Could not use the picture, " + why);
            }
        });
    }

    // The browser's file picker for one picture, given to use(file)
    function choosePicture(use) {

        const input = document.createElement("input");

        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";
        document.body.appendChild(input);

        input.addEventListener("change", function () {

            const file = input.files && input.files[0];

            input.remove();
            use(file);
        });

        input.click();
    }

    // Choose a picture or paste one, the two answers of a choice each side
    // shows its own way. A paste is taken while the choice is open, Ctrl+V
    // with a keyboard. where: where a paste box opens, null for the page;
    // use(file) the picture; say(text) a failure told; closed() puts the
    // choice away after a paste. Answers { touch, caption, choose(),
    // paste(), stop() }, stop when the choice is put away without an answer
    function coverChoice(where, use, say, closed) {

        const touch = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
        const canRead = !!(navigator.clipboard && typeof navigator.clipboard.read === "function");
        const onPaste = function (ev) {

            const file = pastedPicture(ev);

            if (!file) {
                return;
            }

            ev.preventDefault();
            stop();
            closed();
            use(file);
        };
        const stop = function () {
            document.removeEventListener("paste", onPaste, true);
        };

        document.addEventListener("paste", onPaste, true);

        return {
            touch: touch,
            caption: "Choose a picture, or paste one" + (touch ? "" : ", Ctrl+V pastes too") + ".",
            stop: stop,
            choose: function () {

                stop();
                choosePicture(use);
            },

            // The clipboard read straight away where the browser lets it,
            // not over a plain address as the Android device's own, else,
            // or when that fails, a place to paste into
            paste: function () {

                stop();

                if (!canRead) {

                    pasteBox(where, touch, use, say);
                    return;
                }

                clipboardPicture().then(function (file) {

                    if (file) {
                        use(file);
                    } else {
                        pasteBox(where, touch, use, say);
                    }
                }).catch(function () {
                    pasteBox(where, touch, use, say);
                });
            }
        };
    }
