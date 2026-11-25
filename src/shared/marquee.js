    // A one line box turned into a marquee, as the player and the web view
    // both walk a line too long for its box. The text waits at the start,
    // eases into a steady walk to the left until it and a gap have passed,
    // a second copy following on, eases to a stop exactly where it began
    // and waits again, so the beginning is always readable. A line that
    // fits just sits still, a line cut off fades out at the right edge.
    // Shared by the player and the web view's page, src/shared/marquee.js,
    // inlined into both by embed-webview.sh
    //
    // opts: speed in pixels a second, gap the least clear space after the
    // text (at least half the line's width too), delay the rest at the
    // start in ms, fade the fading edge's width as CSS, note(text) told
    // what it decides, list an array the marquee is added to. Answers
    // { setText(text), check() }, check after the box may have changed
    // width. The box keeps its own styling, only its contents are taken
    // over, the text it holds kept
    function makeMarquee(box, opts) {

        const o = opts || {};
        const speed = o.speed || 40;
        const least = o.gap || 72;
        const delay = o.delay || 3000;
        const fade = o.fade || "28px";
        const note = typeof o.note === "function" ? o.note : function () {};

        // One track holds both copies and is the thing that moves, so the
        // two can never drift apart. Kept on a layer of its own all the
        // time, so whatever is drawn near the line is never put on one and
        // taken off again as the line changes, which flickered on a phone
        const track = document.createElement("span");
        const first = document.createElement("span");
        const second = document.createElement("span");
        const align = getComputedStyle(box).textAlign;

        // Both inline-block, a plain inline span reports no width at all
        track.style.cssText = "display:inline-block;white-space:nowrap;will-change:transform";
        first.style.cssText = "display:inline-block;white-space:nowrap";
        second.style.cssText = "display:none;white-space:nowrap";
        first.textContent = box.textContent;
        box.classList.toggle("blank", !first.textContent);
        track.appendChild(first);
        track.appendChild(second);
        box.textContent = "";
        box.appendChild(track);

        let anim = null;
        let timer = null;
        let width = 0;

        const edgeFade = function () {

            const over = first.textContent
                && Math.ceil(first.getBoundingClientRect().width) - box.clientWidth > 2;
            const mask = over ? "linear-gradient(to right, #000 calc(100% - " + fade + "), transparent)" : "";

            box.style.webkitMaskImage = mask;
            box.style.maskImage = mask;
        };

        const stop = function () {

            if (timer) {

                clearTimeout(timer);
                timer = null;
            }

            if (anim) {

                anim.cancel();
                anim = null;
            }

            track.style.transform = "none";
            first.style.marginRight = "0px";
            second.style.display = "none";
            box.style.textAlign = align;
        };

        const start = function () {

            edgeFade();

            if (!track.animate || !first.textContent) {
                return;
            }

            const textWidth = Math.ceil(first.getBoundingClientRect().width);

            width = box.clientWidth;

            if (width < 40) {

                note("waits for its width, " + width + " px now");
                return;
            }

            if (textWidth - width <= 2) {

                note("fits, " + textWidth + " of " + width + " px");
                stop();
                return;
            }

            note("walks, " + textWidth + " px in " + width + " px");

            // A walking line starts at the left, whatever its alignment
            box.style.textAlign = "left";

            const gap = Math.max(least, Math.round(width * 0.5));
            const distance = textWidth + gap;

            first.style.marginRight = gap + "px";
            second.style.display = "inline-block";
            anim = track.animate([
                { transform: "translateX(0)", offset: 0, easing: "ease-in" },
                { transform: "translateX(" + (-distance * 0.05) + "px)", offset: 0.09, easing: "linear" },
                { transform: "translateX(" + (-distance * 0.95) + "px)", offset: 0.91, easing: "ease-out" },
                { transform: "translateX(" + (-distance) + "px)", offset: 1 }
            ], { duration: distance / speed * 1000 });

            anim.onfinish = function () {

                anim = null;
                track.style.transform = "none";
                timer = setTimeout(function () {

                    timer = null;
                    start();
                }, delay);
            };
        };

        const restart = function (wait) {

            stop();
            requestAnimationFrame(edgeFade);
            timer = setTimeout(function () {

                timer = null;
                start();
            }, wait);
        };

        const m = {
            setText: function (text) {

                const value = text || "";

                if (first.textContent === value) {
                    return;
                }

                first.textContent = value;
                second.textContent = value;
                note("new text, " + value.length + " characters");

                // Marked when empty, so a line that has a row of its own on
                // a phone can give its room back
                box.classList.toggle("blank", !value);
                restart(delay);
            },

            // After a resize, a line that now fits stops and one that no
            // longer fits starts walking
            check: function () {

                if (box.clientWidth !== width && box.offsetParent && first.textContent) {

                    width = box.clientWidth;
                    restart(600);
                }
            }
        };

        // The box's own changes of width followed where the browser tells
        if (typeof ResizeObserver === "function") {

            new ResizeObserver(function () {

                if (Math.abs(box.clientWidth - width) >= 2 && box.clientWidth >= 40) {
                    m.check();
                }
            }).observe(box);
        }

        if (Array.isArray(o.list)) {
            o.list.push(m);
        }

        return m;
    }
