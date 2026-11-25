    // A star of a rating as both the player and the web view draw it, an
    // outline with a gold copy over it clipped to how much of the star is
    // lit, in quarters, and its colours. Shared by the player and the web
    // view's page, src/shared/stars.js, inlined into both by
    // embed-webview.sh

    // Star colors, lit and unlit. An unrated song shows grey outlines, a
    // rated one gold outlines, so zero stars and not rated look different
    const STAR_GOLD = "#f5c518";
    const STAR_EMPTY = "#6a6a74";

    // The outline of unlit stars on a rated song and of a partly lit star,
    // a dark gold so the lit ones stand out
    const STAR_DIM = "#7d6516";

    // Each star needs its own clip id for the partial fill
    let starClipCount = 0;

    const STAR_D = "M12 2.6l2.83 5.9 6.47.78-4.77 4.47 1.24 6.43L12 17.02"
        + "l-5.77 3.16 1.24-6.43L2.7 9.28l6.47-.78z";

    // One star as an SVG, painted later by paintStar. Over the outline
    // sits a gold copy, fill and stroke, clipped from the left to how much of
    // the star is lit. It covers the dark outline there, so a partly lit
    // star shows that only on its right
    function makeStarSvg(size) {

        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");

        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.style.display = "block";

        starClipCount += 1;

        const clipId = "mureka-star-half-" + starClipCount;
        const defs = document.createElementNS(ns, "defs");
        const clip = document.createElementNS(ns, "clipPath");
        const rect = document.createElementNS(ns, "rect");

        clip.setAttribute("id", clipId);
        rect.setAttribute("x", "-2");
        rect.setAttribute("y", "-2");
        rect.setAttribute("width", "14");
        rect.setAttribute("height", "28");

        clip.appendChild(rect);
        defs.appendChild(clip);

        const half = document.createElementNS(ns, "path");

        half.setAttribute("d", STAR_D);
        half.setAttribute("fill", STAR_GOLD);
        half.setAttribute("stroke", STAR_GOLD);
        half.setAttribute("stroke-width", "1.6");
        half.setAttribute("stroke-linejoin", "round");
        half.setAttribute("clip-path", "url(#" + clipId + ")");
        half.style.display = "none";

        const path = document.createElementNS(ns, "path");

        path.setAttribute("d", STAR_D);
        path.setAttribute("stroke-width", "1.6");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");

        svg.appendChild(defs);
        svg.appendChild(path);
        svg.appendChild(half);
        svg.starPath = path;
        svg.starHalf = half;
        svg.starClip = rect;

        return svg;
    }

    // Where the star's points are across the 24 wide view, so a quarter,
    // a half and three quarters are cut at that share of its width
    const STAR_LEFT = 2.7;
    const STAR_WIDTH = 18.6;

    // The right edge of the gold copy for a part of a star lit
    function starClipWidth(level) {

        // The clip starts 2 left of the view, past the outline's stroke
        return (2 + STAR_LEFT + level * STAR_WIDTH).toFixed(2);
    }

    // How much of a star is lit, 1 full, 0.25, 0.5 or 0.75 that much of it
    // from the left, 0 none. Full stars are filled and outlined gold. A
    // partly lit star and the unlit stars of a rated song get a dark gold
    // outline, the stars of a song never rated a grey one
    function paintStar(svg, lit, rated) {

        const level = lit === true ? 1 : (lit === false ? 0 : lit);
        const part = level > 0 && level < 1;

        svg.starPath.setAttribute("fill", level >= 1 ? STAR_GOLD : "none");
        svg.starHalf.style.display = part ? "" : "none";

        if (part) {
            svg.starClip.setAttribute("width", starClipWidth(level));
        }

        if (level >= 1) {
            svg.starPath.setAttribute("stroke", STAR_GOLD);
        } else if (rated || part) {
            svg.starPath.setAttribute("stroke", STAR_DIM);
        } else {
            svg.starPath.setAttribute("stroke", STAR_EMPTY);
        }
    }

    // How much of star n, counted from 1, a rating lights, in quarters
    function starLevel(r, n) {

        if (r === null || r <= n - 1) {
            return 0;
        }

        return r >= n ? 1 : r - (n - 1);
    }
