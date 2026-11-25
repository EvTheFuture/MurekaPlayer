    // A song's comments on Mureka, as the player and the web view both show
    // them: each comment with its replies under it, a like and Reply, a
    // place in the song to play from, Delete on your own, more comments on
    // asking, and a field to comment or reply at the foot. Shared by the
    // player and the web view's page, src/shared/comments.js, inlined into
    // both by embed-webview.sh
    //
    // card: the dialog's card to fill. song: id, title and cover. host,
    // each answer a promise of { ok, why } with more: list(after) with
    // list, last and more; like(c) with liked and likes; del(c);
    // add(text, parent) with comment; then seek(at), play the song from a
    // place; play(); cover(url); confirm(title, text, yes, go); toast(text,
    // ok); close()
    const CM_CSS = ""
        + ".mp-cm-pic{flex:0 0 auto;width:44px;height:44px;border-radius:6px;object-fit:cover;background:#333;cursor:pointer}"
        + ".mp-cm-title{font-weight:600;overflow-wrap:anywhere;flex:1 1 auto;min-width:0}"
        + ".mp-cm-list{flex:1 1 auto;min-height:80px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;"
        + "-webkit-overflow-scrolling:touch;overscroll-behavior:contain}"
        + ".mp-cm-item{display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:8px;background:#1d1d22}"
        + ".mp-cm-item.reply{background:#202026;margin-left:18px}"
        + ".mp-cm-top{display:flex;gap:8px;align-items:baseline;font-size:12px}"
        + ".mp-cm-who{font-weight:600;color:#ddd}"
        + ".mp-cm-who.mine{color:" + ACCENT + "}"
        + ".mp-cm-when{color:#888}"
        + ".mp-cm-text{font-size:14px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}"
        + ".mp-cm-acts{display:flex;gap:14px;font-size:12px}"
        + ".mp-cm-link{border:none;background:none;padding:0;cursor:pointer;font:inherit;color:#999}"
        + ".mp-ui-card .mp-cm-link{min-height:0}"
        + ".mp-cm-link.liked{color:#ff6b8a}"
        + ".mp-cm-link.at{color:" + ACCENT + "}"
        + ".mp-cm-link.del{color:#e57373}"
        + ".mp-cm-more{font-size:11px;color:#888;margin-left:26px}"
        + ".mp-cm-replying{display:none;align-items:center;gap:8px;font-size:12px;color:#bbb}"
        + ".mp-cm-replying span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
        + ".mp-cm-x{border:none;background:none;color:#bbb;font-size:18px;line-height:1;cursor:pointer;padding:0 4px}"
        + ".mp-cm-foot{display:flex;gap:8px}"
        + ".mp-cm-field{flex:1 1 auto;min-width:0;box-sizing:border-box;padding:8px 10px;border:1px solid #4a4a52;border-radius:6px;"
        + "background:#1b1b20;color:#fff;font:inherit;font-size:16px;resize:none;outline:none}";

    // A place in a song as Mureka's page shows it, 01:15
    function cmTime(sec) {

        const s = Math.max(0, Math.round(sec));

        return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }

    function cmView(card, song, host) {

        let last = "";
        let replyTo = null;
        let busy = false;

        if (!document.getElementById("mp-cm-style")) {

            const style = document.createElement("style");

            style.id = "mp-cm-style";
            style.textContent = CM_CSS;
            (document.head || document.documentElement).appendChild(style);
        }

        const head = uiHead("Comments on \"" + ((song.title || "").trim() || "Untitled") + "\"", [uiBtn("Close", host.close, true)]);
        const listBox = document.createElement("div");
        const note = document.createElement("div");
        const moreBtn = uiBtn("More comments", function () {
            load(false);
        });
        const replying = document.createElement("div");
        const replyText = document.createElement("span");
        const replyCancel = document.createElement("button");
        const foot = document.createElement("div");
        const field = document.createElement("textarea");
        const send = uiBtn("Send", function () {
            post();
        });

        card.classList.add("mp-ui-card");
        head.title.className = "mp-cm-title";

        // The song's cover beside the title, a tap plays the song
        if (song.cover) {

            const pic = document.createElement("img");

            pic.className = "mp-cm-pic";
            pic.src = host.cover(song.cover);
            pic.alt = "";
            pic.title = "Play the song";
            pic.addEventListener("error", function () {
                pic.remove();
            });
            pic.addEventListener("click", host.play);
            head.el.style.gap = "10px";
            head.el.insertBefore(pic, head.el.firstChild);
        }

        listBox.className = "mp-cm-list";
        note.className = "mp-ui-note";
        moreBtn.style.display = "none";
        moreBtn.style.alignSelf = "stretch";
        replying.className = "mp-cm-replying";
        replyCancel.type = "button";
        replyCancel.className = "mp-cm-x";
        replyCancel.textContent = "\u00D7";
        replyCancel.setAttribute("aria-label", "Do not reply");
        replyCancel.addEventListener("click", function () {
            setReply(null);
        });
        replying.appendChild(replyText);
        replying.appendChild(replyCancel);
        foot.className = "mp-cm-foot";
        field.className = "mp-cm-field";
        field.rows = 2;
        field.placeholder = "Write a comment";
        send.classList.add("on");
        foot.appendChild(field);
        foot.appendChild(send);
        listBox.appendChild(note);
        card.appendChild(head.el);
        card.appendChild(listBox);
        card.appendChild(moreBtn);
        card.appendChild(replying);
        card.appendChild(foot);

        function setReply(c) {

            replyTo = c;
            replying.style.display = c ? "flex" : "none";
            replyText.textContent = c ? "Replying to " + c.name + ": " + c.text : "";
            field.placeholder = c ? "Write a reply" : "Write a comment";

            if (c) {
                field.focus();
            }
        }

        function link(text, kind) {

            const b = document.createElement("button");

            b.type = "button";
            b.className = "mp-cm-link" + (kind ? " " + kind : "");
            b.textContent = text;

            return b;
        }

        // A comment's row: who, when, the text, the like and Reply
        function row(c, depth) {

            const box = document.createElement("div");
            const top = document.createElement("div");
            const who = document.createElement("span");
            const when = document.createElement("span");
            const text = document.createElement("div");
            const acts = document.createElement("div");
            const like = link("");
            const reply = link("Reply");
            const paintLike = function () {

                like.textContent = (c.liked ? "\u2665" : "\u2661") + (c.likes > 0 ? " " + c.likes : "");
                like.classList.toggle("liked", c.liked === true);
            };

            box.className = "mp-cm-item" + (depth > 0 ? " reply" : "");
            box.__commentId = c.id;
            box.__replyOf = depth > 0 ? c.parent : "";
            top.className = "mp-cm-top";
            who.className = "mp-cm-who" + (c.mine ? " mine" : "");
            who.textContent = c.name + (c.mine ? " (you)" : "");
            when.className = "mp-cm-when";
            when.textContent = c.at ? commentAge(c.at) : "";
            text.className = "mp-cm-text";
            text.textContent = c.text;
            acts.className = "mp-cm-acts";
            paintLike();

            like.addEventListener("click", function () {

                host.like(c).then(function (r) {

                    if (r && r.ok) {

                        c.liked = r.liked;
                        c.likes = r.likes;
                        paintLike();
                    } else {
                        host.toast("Could not like it" + (r && r.why ? ", " + r.why : ""), false);
                    }
                });
            });

            // A reply to a reply goes to the comment it is under
            reply.addEventListener("click", function () {
                setReply(depth > 0 && c.parent ? Object.assign({}, c, { id: c.parent, replyName: c.name }) : c);
            });

            top.appendChild(who);
            top.appendChild(when);

            // A comment tagged with a place in the song, played from there
            if (c.moment >= 0) {

                const at = link("\u25B6 " + cmTime(c.moment), "at");

                at.title = "Play from " + cmTime(c.moment);
                at.addEventListener("click", function () {
                    host.seek(c.moment);
                });
                top.appendChild(at);
            }

            acts.appendChild(like);
            acts.appendChild(reply);

            // Your own comment can be taken away, a comment with its replies
            if (c.mine) {

                const del = link("Delete", "del");

                del.addEventListener("click", function () {

                    host.confirm("Delete " + (depth > 0 ? "this reply" : "this comment" + (c.replies && c.replies.length ? " and its replies" : "")) + "?",
                        c.text, "Delete", function () {

                        host.del(c).then(function (r) {

                            if (!r || !r.ok) {

                                host.toast("Could not delete it" + (r && r.why ? ", " + r.why : ""), false);
                                return;
                            }

                            let next = box.nextSibling;

                            // A comment's replies, set in under it, go too
                            while (depth === 0 && next && next !== note && next.__replyOf === c.id) {

                                const after = next.nextSibling;

                                next.remove();
                                next = after;
                            }

                            box.remove();
                            host.toast("Deleted", true);
                        });
                    });
                });
                acts.appendChild(del);
            }

            box.appendChild(top);
            box.appendChild(text);
            box.appendChild(acts);

            return box;
        }

        function show(c) {

            const replies = c.replies || [];
            const left = (c.replyCount || 0) - replies.length;

            listBox.insertBefore(row(c, 0), note);

            for (const r of replies) {
                listBox.insertBefore(row(r, 1), note);
            }

            if (left > 0) {

                const n = document.createElement("div");

                n.className = "mp-cm-more";
                n.textContent = left + " more " + (left === 1 ? "reply" : "replies") + " on Mureka";
                listBox.insertBefore(n, note);
            }
        }

        function load(first) {

            if (busy) {
                return;
            }

            busy = true;
            note.textContent = first ? "Reading the comments" : "Reading more";
            note.style.display = "";
            moreBtn.style.display = "none";

            host.list(first ? "" : last).then(function (r) {

                busy = false;

                if (!r || !r.ok) {

                    note.textContent = "The comments could not be read" + (r && r.why ? ", " + r.why : "");
                    return;
                }

                const list = Array.isArray(r.list) ? r.list : [];

                for (const c of list) {
                    show(c);
                }

                last = r.last || last;
                note.style.display = "none";

                if (first && list.length === 0) {

                    note.textContent = "No comments yet. Be the first.";
                    note.style.display = "";
                }

                moreBtn.style.display = r.more && list.length > 0 ? "" : "none";
            });
        }

        function post() {

            const text = field.value.trim();

            if (!text || busy) {
                return;
            }

            send.disabled = true;

            host.add(text, replyTo ? replyTo.id : "").then(function (r) {

                send.disabled = false;

                if (!r || !r.ok || !r.comment) {

                    host.toast("Could not send it" + (r && r.why ? ", " + r.why : ""), false);
                    return;
                }

                field.value = "";

                // Shown at once, a reply under its comment, a comment on top
                if (replyTo) {

                    const at = Array.from(listBox.children).find(function (el) {
                        return el.__commentId === replyTo.id;
                    });

                    listBox.insertBefore(row(r.comment, 1), at ? at.nextSibling : note);
                } else {

                    listBox.insertBefore(row(r.comment, 0), listBox.firstChild);
                    note.style.display = "none";
                }

                host.toast(replyTo ? "Replied" : "Commented", true);
                setReply(null);
            });
        }

        field.addEventListener("keydown", function (ev) {

            if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {

                ev.preventDefault();
                post();
            }
        });

        load(true);
    }
