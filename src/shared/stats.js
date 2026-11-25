    // Stats for nerds as the player and the web view both show them: a
    // see-through card with its title and Close, and the lines under it, a
    // part's heading in the accent colour, each other line a name and a
    // value, a detail of the line above indented. Shared by the player and
    // the web view's page, src/shared/stats.js, inlined into both by
    // embed-webview.sh
    //
    // card: the card to fill. close(): Close pressed. Answers
    // { paint(rows, value) }, rows as [name, value, detail], a heading's
    // value null; value(name, text), when given, the text a value shows
    const ST_CSS = ""
        + ".mp-st-card{background:rgba(22,22,27,0.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);"
        + "box-shadow:0 6px 24px rgba(0,0,0,0.45);border-radius:12px;padding:12px;width:100%;max-width:540px;max-height:100%;"
        + "box-sizing:border-box;display:flex;flex-direction:column;gap:8px;color:#fff;font-size:13px;text-align:left}"
        + ".mp-st-body{overflow-y:auto;font:11px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#ddd}"
        + ".mp-st-part{color:" + ACCENT + ";font-weight:700;margin-top:6px}"
        + ".mp-st-line{display:flex;gap:8px}"
        + ".mp-st-key{flex:0 0 150px;color:#8a8a94;box-sizing:border-box}"
        + ".mp-st-line.sub .mp-st-key{padding-left:14px;font-size:0.92em}"
        + ".mp-st-value{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}";

    function stView(card, close) {

        if (!document.getElementById("mp-st-style")) {

            const style = document.createElement("style");

            style.id = "mp-st-style";
            style.textContent = ST_CSS;
            (document.head || document.documentElement).appendChild(style);
        }

        const head = uiHead("Stats for nerds", [uiBtn("Close", close)]);
        const body = document.createElement("div");

        card.classList.add("mp-st-card");
        body.className = "mp-st-body";
        card.appendChild(head.el);
        card.appendChild(body);

        return {
            body: body,
            paint: function (rows, value) {

                body.textContent = "";

                for (const r of rows) {

                    if (!Array.isArray(r)) {
                        continue;
                    }

                    const line = document.createElement("div");

                    if (r[1] === null) {

                        line.className = "mp-st-part";
                        line.textContent = String(r[0]);
                    } else {

                        const k = document.createElement("span");
                        const v = document.createElement("span");

                        line.className = "mp-st-line" + (r[2] ? " sub" : "");
                        k.className = "mp-st-key";
                        k.textContent = String(r[0]);
                        v.className = "mp-st-value";
                        v.textContent = value ? value(String(r[0]), String(r[1])) : String(r[1]);
                        line.appendChild(k);
                        line.appendChild(v);
                    }

                    body.appendChild(line);
                }
            }
        };
    }
