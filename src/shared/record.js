    // A song recorded with the microphone to remix: sung, hummed or played
    // in, heard back, then handed on as a WAV file to upload like a song
    // chosen from the files. The mobile player and the web view show the
    // same card. Shared by the player and the web view's page,
    // src/shared/record.js, inlined into both by embed-webview.sh
    const REC_CSS = ""
        + ".mp-rec-note{font-size:12px;color:#aaa;line-height:1.45}"
        + ".mp-rec-mid{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0}"
        + ".mp-rec-big{width:76px;height:76px;border-radius:50%;border:3px solid #fff;background:" + DANGER + ";cursor:pointer;"
        + "display:flex;align-items:center;justify-content:center;padding:0;box-sizing:border-box}"
        + ".mp-rec-big span{display:block;width:26px;height:26px;border-radius:50%;background:#fff}"
        + ".mp-rec-big.on span{border-radius:4px;width:24px;height:24px}"
        + ".mp-rec-big.on{animation:mp-rec-beat 1.2s ease-in-out infinite}"
        + "@keyframes mp-rec-beat{50%{box-shadow:0 0 0 8px rgba(255,107,107,0.25)}}"
        + ".mp-rec-time{font-size:28px;font-weight:600;font-variant-numeric:tabular-nums}"
        + ".mp-rec-meter{width:100%;height:6px;border-radius:3px;background:#333;overflow:hidden}"
        + ".mp-rec-level{height:100%;width:0;background:" + ACCENT + ";transition:width 0.08s linear}"
        + ".mp-rec-hear{width:100%}"
        + ".mp-rec-row{display:flex;gap:8px}"
        + ".mp-rec-row .mp-ui-btn{flex:1}";

    // The least and the most a remix takes, as Mureka's remix settings say
    const REC_MIN_MS = 10000;
    const REC_MAX_MS = 480000;

    // Whether this browser can record here at all: a microphone needs a
    // page on https, or the phone's own address
    function recCan() {

        return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia
            && typeof window.MediaRecorder === "function");
    }

    // The recording as a mono WAV file at the rate given, 16 bits
    async function recWav(blob, rate) {

        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        let buffer = null;

        try {
            buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
        } finally {

            if (ctx.close) {
                ctx.close().catch(function () {});
            }
        }

        // Taken down to one channel at the rate asked, as the browser mixes
        const frames = Math.max(1, Math.ceil(buffer.duration * rate));
        const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const off = new Off(1, frames, rate);
        const src = off.createBufferSource();

        src.buffer = buffer;
        src.connect(off.destination);
        src.start(0);

        const out = (await off.startRendering()).getChannelData(0);
        const data = new DataView(new ArrayBuffer(44 + out.length * 2));
        const text = function (at, s) {

            for (let i = 0; i < s.length; i += 1) {
                data.setUint8(at + i, s.charCodeAt(i));
            }
        };

        text(0, "RIFF");
        data.setUint32(4, 36 + out.length * 2, true);
        text(8, "WAVE");
        text(12, "fmt ");
        data.setUint32(16, 16, true);
        data.setUint16(20, 1, true);
        data.setUint16(22, 1, true);
        data.setUint32(24, rate, true);
        data.setUint32(28, rate * 2, true);
        data.setUint16(32, 2, true);
        data.setUint16(34, 16, true);
        text(36, "data");
        data.setUint32(40, out.length * 2, true);

        for (let i = 0; i < out.length; i += 1) {

            const v = Math.max(-1, Math.min(1, out[i]));

            data.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        }

        return { blob: new Blob([data], { type: "audio/wav" }), ms: Math.round(buffer.duration * 1000) };
    }

    // A time as 1:05
    function recTime(ms) {

        const s = Math.floor(Math.max(0, ms) / 1000);

        return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }

    // The card: card to fill. o: rate(seconds) the WAV's sample rate for a
    // recording that long, started() told as the recording starts, use(file)
    // the WAV to upload, close(), say(text) a failure told. Answers stop(),
    // which ends whatever is going on, for a card closed from outside
    function recView(card, o) {

        if (!document.getElementById("mp-rec-style")) {

            const style = document.createElement("style");

            style.id = "mp-rec-style";
            style.textContent = REC_CSS;
            (document.head || document.documentElement).appendChild(style);
        }

        let stream = null;
        let rec = null;
        let chunks = [];
        let began = 0;
        let tick = 0;
        let meterCtx = null;
        let meterRaf = 0;
        let took = null;
        let hearUrl = "";

        const head = uiHead("Record a song to remix", [uiBtn("Close", function () {

            stop();
            o.close();
        }, true)]);
        const note = document.createElement("div");
        const mid = document.createElement("div");
        const big = document.createElement("button");
        const time = document.createElement("div");
        const meter = document.createElement("div");
        const level = document.createElement("div");
        const hear = document.createElement("audio");
        const row = document.createElement("div");
        const again = uiBtn("Record again", function () {
            start();
        }, true);
        const use = uiBtn("Use it", function () {
            useIt();
        });

        card.classList.add("mp-ui-card");
        note.className = "mp-rec-note";
        mid.className = "mp-rec-mid";
        big.type = "button";
        big.className = "mp-rec-big";
        big.setAttribute("aria-label", "Record");
        big.appendChild(document.createElement("span"));
        time.className = "mp-rec-time";
        time.textContent = "0:00";
        meter.className = "mp-rec-meter";
        level.className = "mp-rec-level";
        meter.appendChild(level);
        hear.className = "mp-rec-hear";
        hear.controls = true;
        hear.style.display = "none";
        row.className = "mp-rec-row";
        row.style.display = "none";
        use.classList.add("yes");
        row.appendChild(again);
        row.appendChild(use);
        mid.appendChild(big);
        mid.appendChild(time);
        mid.appendChild(meter);
        card.appendChild(head.el);
        card.appendChild(note);
        card.appendChild(mid);
        card.appendChild(hear);
        card.appendChild(row);

        const idleNote = "Sing, hum or play it in. Tap the red button to start and again to stop. At least "
            + Math.round(REC_MIN_MS / 1000) + " seconds, at most " + Math.round(REC_MAX_MS / 60000) + " minutes.";

        note.textContent = idleNote;

        big.addEventListener("click", function () {

            if (rec && rec.state === "recording") {
                finish();
            } else {
                start();
            }
        });

        function meterOff() {

            cancelAnimationFrame(meterRaf);
            level.style.width = "0";

            if (meterCtx) {

                meterCtx.close().catch(function () {});
                meterCtx = null;
            }
        }

        // How loud it comes in, so a microphone too far or too near shows
        function meterOn() {

            try {

                const Ctx = window.AudioContext || window.webkitAudioContext;

                meterCtx = new Ctx();

                const an = meterCtx.createAnalyser();
                const buf = new Float32Array(an.fftSize);

                meterCtx.createMediaStreamSource(stream).connect(an);

                const draw = function () {

                    an.getFloatTimeDomainData(buf);

                    let peak = 0;

                    for (let i = 0; i < buf.length; i += 1) {
                        peak = Math.max(peak, Math.abs(buf[i]));
                    }

                    level.style.width = Math.round(Math.min(1, peak) * 100) + "%";
                    meterRaf = requestAnimationFrame(draw);
                };

                draw();
            } catch (e) {
                meterCtx = null;
            }
        }

        function micOff() {

            if (stream) {

                for (const t of stream.getTracks()) {
                    t.stop();
                }

                stream = null;
            }
        }

        function stop() {

            clearInterval(tick);
            meterOff();

            if (rec && rec.state !== "inactive") {

                rec.onstop = null;
                rec.stop();
            }

            rec = null;
            micOff();
            big.classList.remove("on");

            if (hearUrl) {

                URL.revokeObjectURL(hearUrl);
                hearUrl = "";
            }
        }

        async function start() {

            stop();
            took = null;
            chunks = [];
            hear.style.display = "none";
            row.style.display = "none";
            time.textContent = "0:00";
            note.textContent = "Asking for the microphone";

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
                });
            } catch (e) {

                note.textContent = idleNote;
                o.say("The microphone could not be used" + (e && e.name === "NotAllowedError" ? ", it was not allowed" : ""));
                return;
            }

            // The browser's own format, made into a WAV once stopped
            const types = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg"];
            const type = types.find(function (t) {
                return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t);
            });

            rec = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
            rec.addEventListener("dataavailable", function (ev) {

                if (ev.data && ev.data.size) {
                    chunks.push(ev.data);
                }
            });
            rec.onstop = done;
            rec.start(1000);
            began = Date.now();
            big.classList.add("on");
            big.setAttribute("aria-label", "Stop");
            note.textContent = "Recording. Tap the red button to stop.";
            meterOn();

            if (typeof o.started === "function") {
                o.started();
            }

            tick = setInterval(function () {

                const ms = Date.now() - began;

                time.textContent = recTime(ms);

                // Stopped at the most a remix takes
                if (ms >= REC_MAX_MS) {
                    finish();
                }
            }, 250);
        }

        function finish() {

            clearInterval(tick);
            meterOff();
            big.classList.remove("on");
            big.setAttribute("aria-label", "Record");
            note.textContent = "Making the file";

            if (rec && rec.state !== "inactive") {
                rec.stop();
            }
        }

        async function done() {

            const type = rec && rec.mimeType ? rec.mimeType : "audio/webm";
            const seconds = (Date.now() - began) / 1000;

            rec = null;
            micOff();

            try {
                took = await recWav(new Blob(chunks, { type: type }), o.rate(seconds));
            } catch (e) {

                note.textContent = idleNote;
                o.say("The recording could not be made into a file, " + (e && e.message ? e.message : "the browser cannot read it"));
                return;
            }

            time.textContent = recTime(took.ms);
            hearUrl = URL.createObjectURL(took.blob);
            hear.src = hearUrl;
            hear.style.display = "";
            row.style.display = "flex";
            use.disabled = took.ms < REC_MIN_MS;
            note.textContent = took.ms < REC_MIN_MS ? "Too short, a remix needs at least " + Math.round(REC_MIN_MS / 1000)
                + " seconds. Record again." : "Listen to it, then Use it uploads it to Mureka to remix.";
        }

        function useIt() {

            if (!took) {
                return;
            }

            const now = new Date();
            const two = function (n) {
                return String(n).padStart(2, "0");
            };
            const name = "Recording " + now.getFullYear() + "-" + two(now.getMonth() + 1) + "-" + two(now.getDate())
                + " " + two(now.getHours()) + "." + two(now.getMinutes()) + ".wav";
            const file = new File([took.blob], name, { type: "audio/wav" });

            stop();
            o.close();
            o.use(file);
        }

        return { stop: stop };
    }
