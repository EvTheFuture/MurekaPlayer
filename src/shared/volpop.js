    // The parts of the volume training's popup drawn the same way on the
    // device and in the web view, from the view volTrainView makes. Given a
    // style, the pieces get inline styles, as the device's popup sits in
    // Mureka's page with no stylesheet of its own. Without one they get the
    // classes the web view's page styles.
    // Shared by the player and the web view's page, src/shared/volpop.js,
    // inlined into both by embed-webview.sh

    // The choice above the list, made again only when it changes, so a tap
    // between two drawings is not lost. Says whether there is one
    function volPopChoice(ui, choice, name, onPick, style) {

        const key = JSON.stringify(choice || null);

        if (key !== ui.choiceKey) {

            ui.choiceKey = key;
            ui.choice.textContent = "";

            if (choice) {

                const head = document.createElement("div");

                head.textContent = choice.label;

                if (style) {
                    head.style.cssText = style.choiceHead;
                } else {
                    head.className = "trainChoiceHead";
                }

                ui.choice.appendChild(head);

                for (const o of choice.options || []) {

                    const row = document.createElement("label");
                    const radio = document.createElement("input");

                    radio.type = "radio";
                    radio.name = name;
                    radio.checked = o.value === choice.value;

                    if (style) {

                        row.style.cssText = style.choiceRow;
                        radio.style.cssText = style.radio;
                    }

                    radio.addEventListener("change", function () {
                        onPick(o.value);
                    });
                    row.appendChild(radio);
                    row.appendChild(document.createTextNode(o.label));
                    ui.choice.appendChild(row);
                }
            }
        }

        return !!choice;
    }

    // What Save keeps, a step a row: its name, its gap and where the gap
    // came from. Says whether there are any
    function volPopRows(box, rows, style) {

        box.textContent = "";

        for (const r of rows || []) {

            const cells = [[r.step, ""], [r.db, "db"], [r.from, r.look]];

            for (const c of cells) {

                const el = document.createElement("span");

                el.textContent = c[0];

                if (style) {
                    style.cell(el, c[1]);
                } else {
                    el.className = c[1];
                }

                box.appendChild(el);
            }
        }

        return (rows || []).length > 0;
    }

    // Lines of plain text under the list, the switch delay. Says whether
    // there are any
    function volPopLines(box, lines) {

        box.textContent = "";

        for (const line of lines || []) {

            const el = document.createElement("div");

            el.textContent = line;
            box.appendChild(el);
        }

        return (lines || []).length > 0;
    }
