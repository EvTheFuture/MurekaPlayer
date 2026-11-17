    // The chat of a room, as both the player and the web view show it: how
    // long messages are kept, the messages with who and when, this
    // player's own on the right, and a field to write in. Typing @ opens a
    // list of the people to mention, which the arrows move through and Tab
    // or Enter picks. Enter sends, Shift+Enter starts a new line. A
    // mention of a name is lit, and a message mentioning this player gets
    // an orange edge. Shared by the player and the web view's page,
    // src/shared/chat.js, inlined into both by embed-webview.sh
    //
    // opts: accent and accentRgb, the colours; send(text), a promise of
    // why it could not go or ""; onEscape(), Escape with no list open;
    // toast(text), a word for the one writing. Answers the element, paint
    // with { me, msgs, keepText, names, emptyText } and focus
    // The chat's title: Chat in and the room's name in the accent colour
    function chatTitleSet(el, room, accent) {

        const name = document.createElement("span");

        el.textContent = "Chat in ";
        name.textContent = room || "the room";
        name.style.color = accent || "#48e1eb";
        el.appendChild(name);
    }

    function makeChatView(opts) {

        const accent = opts.accent || "#48e1eb";
        const accentRgb = opts.accentRgb || "72,225,235";
        const el = document.createElement("div");
        const note = document.createElement("div");
        const listBox = document.createElement("div");
        const footWrap = document.createElement("div");
        const pop = document.createElement("div");
        const foot = document.createElement("div");
        const field = document.createElement("textarea");
        const sendBtn = document.createElement("button");
        let last = { me: "", msgs: [], names: [] };
        let shownKey = "";
        let picks = [];
        let pickAt = 0;
        let mentionFrom = -1;
        let sending = false;

        el.style.cssText = "flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:8px";
        note.style.cssText = "font-size:11px;color:#888;line-height:1.4";
        listBox.style.cssText = "flex:1 1 auto;min-height:60px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"
            + "-webkit-overflow-scrolling:touch;overscroll-behavior:contain";
        listBox.setAttribute("data-noswipe", "1");
        footWrap.style.cssText = "position:relative;flex:0 0 auto";
        pop.style.cssText = "display:none;position:absolute;left:0;bottom:calc(100% + 6px);min-width:180px;max-width:100%;max-height:220px;overflow-y:auto;"
            + "flex-direction:column;padding:4px;box-sizing:border-box;border-radius:10px;background:#2c2c33;border:1px solid #44444c;"
            + "box-shadow:0 6px 20px rgba(0,0,0,0.5);z-index:5";
        foot.style.cssText = "display:flex;gap:8px;align-items:stretch";
        field.rows = 2;
        field.maxLength = 1000;
        field.placeholder = "Write to everyone in the room, @ to mention";
        field.style.cssText = "flex:1 1 auto;min-width:0;box-sizing:border-box;padding:8px 10px;border:1px solid #4a4a52;border-radius:8px;"
            + "background:#1b1b20;color:#fff;font:inherit;font-size:16px;resize:none;outline:none";
        sendBtn.type = "button";
        sendBtn.textContent = "Send";
        sendBtn.style.cssText = "flex:0 0 auto;padding:0 16px;border:none;border-radius:8px;background:" + accent + ";color:#000;font:inherit;"
            + "font-weight:600;cursor:pointer";
        sendBtn.addEventListener("click", post);
        foot.appendChild(field);
        foot.appendChild(sendBtn);
        footWrap.appendChild(pop);
        footWrap.appendChild(foot);
        el.appendChild(note);
        el.appendChild(listBox);
        el.appendChild(footWrap);

        // The page's own keys never hear what is typed here
        field.addEventListener("keydown", function (ev) {

            ev.stopPropagation();

            if (pop.style.display !== "none" && picks.length) {

                if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {

                    ev.preventDefault();
                    pickAt = (pickAt + (ev.key === "ArrowDown" ? 1 : picks.length - 1)) % picks.length;
                    paintPop();
                    return;
                }

                if (ev.key === "Tab" || (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing)) {

                    ev.preventDefault();
                    choose(picks[pickAt]);
                    return;
                }

                if (ev.key === "Escape") {

                    ev.preventDefault();
                    closePop();
                    return;
                }
            }

            if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) {

                ev.preventDefault();
                post();
            } else if (ev.key === "Escape" && opts.onEscape) {

                ev.preventDefault();
                opts.onEscape();
            }
        });
        field.addEventListener("keyup", function (ev) {
            ev.stopPropagation();
        });
        field.addEventListener("input", findMention);
        field.addEventListener("click", findMention);
        field.addEventListener("blur", function () {

            // A press on the list comes before the blur takes it away
            setTimeout(closePop, 150);
        });

        // The @ being typed before the caret, and the names that fit it
        function findMention() {

            const upTo = field.value.slice(0, field.selectionStart || 0);
            const m = /(^|\s)@([^\s@]{0,30})$/.exec(upTo);

            if (!m) {

                closePop();
                return;
            }

            const q = m[2].toLowerCase();

            mentionFrom = upTo.length - m[2].length - 1;
            picks = (last.names || []).filter(function (n) {
                return n && n !== last.me && n.toLowerCase().indexOf(q) >= 0;
            }).sort(function (a, b) {
                return (a.toLowerCase().indexOf(q) === 0 ? 0 : 1) - (b.toLowerCase().indexOf(q) === 0 ? 0 : 1) || a.localeCompare(b);
            }).slice(0, 8);
            pickAt = 0;

            if (!picks.length) {

                closePop();
                return;
            }

            paintPop();
        }

        function paintPop() {

            pop.textContent = "";

            picks.forEach(function (name, i) {

                const row = document.createElement("div");

                row.textContent = "@" + name;
                row.style.cssText = "padding:6px 10px;border-radius:7px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
                    + (i === pickAt ? "background:rgba(" + accentRgb + ",0.22);color:#fff" : "color:#ddd");
                row.addEventListener("mousedown", function (ev) {

                    ev.preventDefault();
                    choose(name);
                });
                row.addEventListener("touchstart", function (ev) {

                    ev.preventDefault();
                    choose(name);
                }, { passive: false });
                pop.appendChild(row);
            });

            pop.style.display = "flex";

            const on = pop.children[pickAt];

            if (on && on.scrollIntoView) {
                on.scrollIntoView({ block: "nearest" });
            }
        }

        function closePop() {

            pop.style.display = "none";
            picks = [];
        }

        // The @ and what was typed after it become the whole name and a space
        function choose(name) {

            const caret = field.selectionStart || 0;
            const before = field.value.slice(0, mentionFrom);
            const after = field.value.slice(caret);
            const put = "@" + name + " ";

            field.value = before + put + after;
            field.focus();
            field.selectionStart = field.selectionEnd = before.length + put.length;
            closePop();
        }

        function post() {

            const text = field.value.trim();

            if (!text || sending) {
                return;
            }

            sending = true;
            sendBtn.disabled = true;
            Promise.resolve(opts.send(text)).then(function (why) {

                sending = false;
                sendBtn.disabled = false;

                if (why) {

                    if (opts.toast) {
                        opts.toast(why);
                    }

                    return;
                }

                field.value = "";
                closePop();
                field.focus();
            });
        }

        // A message's text with the mentions of known names lit, the
        // longest name first where one begins another
        function textNode(text, names, me) {

            const box = document.createElement("div");
            const known = names.concat(me ? [me] : []).filter(function (n) {
                return n;
            }).sort(function (a, b) {
                return b.length - a.length;
            });
            let rest = String(text);

            box.style.cssText = "font-size:14px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;color:#eee";

            while (rest) {

                let at = -1;
                let who = "";

                for (const n of known) {

                    const i = rest.indexOf("@" + n);

                    if (i >= 0 && (at < 0 || i < at)) {
                        at = i;
                        who = n;
                    }
                }

                if (at < 0) {

                    box.appendChild(document.createTextNode(rest));
                    break;
                }

                const tag = document.createElement("span");

                tag.textContent = "@" + who;
                tag.style.cssText = "font-weight:600;color:" + (who === me ? "#ffb454" : accent);
                box.appendChild(document.createTextNode(rest.slice(0, at)));
                box.appendChild(tag);
                rest = rest.slice(at + who.length + 1);
            }

            return box;
        }

        // The clock time of a message on the 24 hour clock, with the day when
        // not today
        function whenText(at) {

            if (!at) {
                return "";
            }

            const d = new Date(at);
            const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

            return d.toDateString() === new Date().toDateString() ? time : d.toLocaleDateString([], { weekday: "short" }) + " " + time;
        }

        function paint(data) {

            const msgs = Array.isArray(data.msgs) ? data.msgs : [];
            const key = String(data.me) + "|" + msgs.length + "|" + (msgs.length ? msgs[msgs.length - 1].id + ":" + msgs[msgs.length - 1].at : "")
                + "|" + (data.keepText || "") + "|" + (data.emptyText || "");

            last = { me: String(data.me || ""), msgs: msgs, names: Array.isArray(data.names) ? data.names : [] };

            if (key === shownKey) {
                return;
            }

            const first = shownKey === "";
            const atEnd = listBox.scrollTop + listBox.clientHeight >= listBox.scrollHeight - 40;

            shownKey = key;
            note.textContent = String(data.keepText || "");
            note.style.display = note.textContent ? "" : "none";
            listBox.textContent = "";

            for (const m of msgs) {

                const mine = String(m.from) === last.me;
                const toMe = !mine && last.me && String(m.text).indexOf("@" + last.me) >= 0;
                const box = document.createElement("div");
                const top = document.createElement("div");
                const who = document.createElement("span");
                const when = document.createElement("span");

                box.style.cssText = "flex:0 0 auto;max-width:85%;padding:6px 10px;border-radius:10px;display:flex;flex-direction:column;gap:2px;box-sizing:border-box;"
                    + (mine ? "align-self:flex-end;background:rgba(" + accentRgb + ",0.16)" : "align-self:flex-start;background:#1c1c21")
                    + (toMe ? ";border-left:3px solid #ffb454" : "");
                top.style.cssText = "display:flex;gap:8px;align-items:baseline;font-size:11px";
                who.textContent = mine ? "You" : String(m.from || "Someone");
                who.style.cssText = "font-weight:600;color:" + (mine ? accent : "#ffb454");
                when.textContent = whenText(Number(m.at) || 0);
                when.style.cssText = "color:#888";
                top.appendChild(who);
                top.appendChild(when);
                box.appendChild(top);
                box.appendChild(textNode(String(m.text || ""), last.names, last.me));
                listBox.appendChild(box);
            }

            if (!msgs.length) {

                const empty = document.createElement("div");

                empty.textContent = data.emptyText || "No messages yet. What you write goes to everyone in the room.";
                empty.style.cssText = "font-size:12px;color:#888;line-height:1.5;padding:4px 2px";
                listBox.appendChild(empty);
            }

            if (atEnd || first) {
                listBox.scrollTop = listBox.scrollHeight;
            }
        }

        return {
            el: el,
            paint: paint,
            focus: function () {
                field.focus();
            },
            atEnd: function () {
                listBox.scrollTop = listBox.scrollHeight;
            }
        };
    }
