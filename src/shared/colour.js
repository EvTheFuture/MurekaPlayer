    // Colours: HSL and RGBA helpers and the colour picker.
    // Shared by the player and the web view's page, src/shared/colour.js,
    // inlined into both by embed-webview.sh

    function hexToHsl(hex) {

        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0;
        let s = 0;

        if (max !== min) {

            const d = max - min;

            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            if (max === r) {
                h = (g - b) / d + (g < b ? 6 : 0);
            } else if (max === g) {
                h = (b - r) / d + 2;
            } else {
                h = (r - g) / d + 4;
            }

            h *= 60;
        }

        return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    function hslToHex(h, s, l) {

        const sat = s / 100;
        const lig = l / 100;
        const k = function (n) {
            return (n + h / 30) % 12;
        };
        const a = sat * Math.min(lig, 1 - lig);
        const f = function (n) {

            const v = lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

            return Math.round(v * 255).toString(16).padStart(2, "0");
        };

        return "#" + f(0) + f(8) + f(4);
    }

    // An rgba() fill with its share scaled by k
    function rgbaFade(text, k) {

        const t = rgbaParts(text);

        return "rgba(" + t.c.join(", ") + ", " + Math.round(t.a * k * 1000) / 1000 + ")";
    }

    // The color and share of an rgba() fill, to darken by hand
    function rgbaParts(text) {

        const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/.exec(text || "");

        if (!m) {
            return { c: [255, 255, 255], a: 0 };
        }

        return { c: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) };
    }

    function openColorPicker(title, color, alpha, maxAlpha, change) {

        const startColor = color;
        const startAlpha = alpha;
        const hsl = hexToHsl(color);
        let nowAlpha = alpha;

        // A color given as it is, the one opened with or a ready one, kept
        // exactly until a color slider moves
        let exact = color;

        const back = document.createElement("div");
        const box = document.createElement("div");
        const head = document.createElement("div");
        const preview = document.createElement("div");
        const fill = document.createElement("div");
        const swatches = document.createElement("div");
        const buttons = document.createElement("div");

        back.style.cssText = "position:fixed;inset:0;z-index:2147483600;background:rgba(0,0,0,0.6);display:flex;"
            + "align-items:center;justify-content:center;padding:12px;box-sizing:border-box";
        box.style.cssText = "background:#26262c;color:#fff;border:1px solid #3a3a42;border-radius:14px;padding:16px;"
            + "width:min(max(420px,42vw),100%);box-sizing:border-box;display:flex;flex-direction:column;gap:12px;"
            + "font:clamp(15px,1.8vw,24px)/1.4 sans-serif;box-shadow:0 8px 28px rgba(0,0,0,0.5)";
        head.style.cssText = "font-weight:600";
        head.textContent = title;
        preview.style.cssText = "height:2.9em;border-radius:8px;border:1px solid #555;position:relative;overflow:hidden;"
            + "background-color:#1d1d22;background-image:linear-gradient(45deg,#444 25%,transparent 25%,transparent 75%,#444 75%),"
            + "linear-gradient(45deg,#444 25%,transparent 25%,transparent 75%,#444 75%);"
            + "background-size:14px 14px;background-position:0 0,7px 7px";
        fill.style.cssText = "position:absolute;inset:0";
        preview.appendChild(fill);
        swatches.style.cssText = "display:flex;flex-wrap:wrap;gap:8px";
        buttons.style.cssText = "display:flex;justify-content:flex-end;gap:10px";

        const sliders = {};

        // One labelled slider, its value beside it
        const slider = function (key, label, max, unit, value) {

            const row = document.createElement("label");
            const name = document.createElement("span");
            const input = document.createElement("input");
            const shown = document.createElement("span");

            row.style.cssText = "display:flex;align-items:center;gap:10px";
            name.style.cssText = "flex:0 0 6.5em";
            name.textContent = label;
            input.type = "range";
            input.className = "mureka-range";
            input.min = "0";
            input.max = String(max);
            input.step = "1";
            input.value = String(value);
            input.style.cssText = "flex:1;min-width:0;height:2.2em;accent-color:#48e1eb";
            shown.style.cssText = "flex:0 0 3.6em;text-align:right;font-variant-numeric:tabular-nums";
            shown.textContent = value + unit;
            input.addEventListener("input", function () {

                if (key !== "a") {
                    exact = null;
                }

                shown.textContent = input.value + unit;
                apply();
            });
            row.appendChild(name);
            row.appendChild(input);
            row.appendChild(shown);
            sliders[key] = { input: input, shown: shown, unit: unit };

            return row;
        };

        const nowColor = function () {
            return exact || hslToHex(Number(sliders.h.input.value), Number(sliders.s.input.value), Number(sliders.l.input.value));
        };

        const paint = function () {

            const c = nowColor();

            fill.style.background = "rgba(" + parseInt(c.slice(1, 3), 16) + ", " + parseInt(c.slice(3, 5), 16) + ", "
                + parseInt(c.slice(5, 7), 16) + ", " + (nowAlpha / 100) + ")";
        };

        const apply = function () {

            nowAlpha = Number(sliders.a.input.value);
            paint();
            change(nowColor(), nowAlpha);
        };

        // A ready color sets the three color sliders, the opacity stays
        const setColor = function (hex) {

            const v = hexToHsl(hex);

            for (const key of ["h", "s", "l"]) {

                sliders[key].input.value = String(v[key]);
                sliders[key].shown.textContent = v[key] + sliders[key].unit;
            }

            exact = hex;
            apply();
        };

        for (const hex of PICK_SWATCHES) {

            const sw = document.createElement("button");

            sw.type = "button";
            sw.setAttribute("aria-label", hex);
            sw.style.cssText = "width:2.4em;height:2.4em;border-radius:8px;border:1px solid #555;cursor:pointer;padding:0;background:" + hex;
            sw.addEventListener("click", function () {
                setColor(hex);
            });
            swatches.appendChild(sw);
        }

        const close = function (keep) {

            if (!keep) {
                change(startColor, startAlpha);
            }

            back.remove();
        };

        const button = function (label, keep, accent) {

            const b = document.createElement("button");

            b.type = "button";
            b.textContent = label;
            b.style.cssText = "min-height:2.9em;padding:0 1.2em;border-radius:10px;border:none;cursor:pointer;font:inherit;"
                + (accent ? "background:#48e1eb;color:#000" : "background:#3a3a42;color:#fff");
            b.addEventListener("click", function () {
                close(keep);
            });

            return b;
        };

        buttons.appendChild(button("Cancel", false, false));
        buttons.appendChild(button("Done", true, true));

        box.appendChild(head);
        box.appendChild(preview);
        box.appendChild(swatches);
        box.appendChild(slider("h", "Hue", 359, "", hsl.h));

        // The hue slider shows the colors it goes through
        sliders.h.input.style.setProperty("--mureka-track",
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)");
        box.appendChild(slider("s", "Saturation", 100, " %", hsl.s));
        box.appendChild(slider("l", "Lightness", 100, " %", hsl.l));

        // A solid color has no opacity to pick, it is always fully shown
        if (maxAlpha > 0) {
            box.appendChild(slider("a", "Opacity", maxAlpha, " %", alpha));
        } else {
            slider("a", "Opacity", 100, " %", 100);
        }

        box.appendChild(buttons);
        back.appendChild(box);

        // A tap beside it is Cancel
        back.addEventListener("click", function (ev) {

            if (ev.target === back) {
                close(false);
            }
        });

        // Nothing in it reaches what lies under it
        for (const name of ["pointerdown", "touchstart", "keydown"]) {

            back.addEventListener(name, function (ev) {
                ev.stopPropagation();
            });
        }

        paint();

        // In fullscreen only what is inside the fullscreen part shows
        (document.fullscreenElement || document.body).appendChild(back);
    }
