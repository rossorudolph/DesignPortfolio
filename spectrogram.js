/**
 * Live microphone spectrogram + frequency / piano overlay + optional Web Speech transcription.
 * Words and formant traces are drawn on #spec-overlay (no DOM pins).
 */
(function () {
    const RULER_W = 76;
    const UI_H = 52;

    const canvas = document.getElementById('spec-canvas');
    const overlay = document.getElementById('spec-overlay');
    const freqRuler = document.getElementById('freq-ruler');
    const pianoGrid = document.getElementById('piano-grid');
    const statusEl = document.getElementById('spec-status');
    const startBtn = document.getElementById('spec-start');
    const stopBtn = document.getElementById('spec-stop');
    const transcribeChk = document.getElementById('spec-transcribe');

    const ctx = canvas.getContext('2d', { alpha: false });
    const octx = overlay.getContext('2d');

    let audioCtx = null;
    let analyser = null;
    let sourceNode = null;
    let mediaStream = null;
    let rafId = null;
    let freqBuffer = null;
    let sampleRate = 48000;
    let binCount = 1024;

    let columnCount = 0;
    let recognition = null;

    /** One peak sample per scrolled column (bin null ≈ no clear peak in speech band). */
    /** @type {{ col: number, bin: number | null }[]} */
    const peaksHistory = [];

    /** @type {{ text: string, colStart: number, colEnd: number, colCenter: number, labelBin: number }[]} */
    const pins = [];

    /** ~15 columns ≈ 250 ms at 60 fps — rough spacing between estimated word times */
    const COLS_PER_WORD = 15;
    /** Nudge transcript + curve left so they line up with the waterfall. */
    const TIME_SHIFT_PX = 14;
    const LABEL_ABOVE_PX = 12;

    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    function setStatus(msg, isError) {
        statusEl.textContent = msg;
        statusEl.classList.toggle('error', !!isError);
    }

    function hzToMidi(hz) {
        return 69 + 12 * Math.log2(hz / 440);
    }

    function midiToHz(m) {
        return 440 * Math.pow(2, (m - 69) / 12);
    }

    function midiToNoteName(m) {
        const mi = Math.round(m);
        const n = ((mi % 12) + 12) % 12;
        const oct = Math.floor(mi / 12) - 1;
        return NOTE_NAMES[n] + oct;
    }

    /** Inverse of yToBin: bin index → y (0 top, H bottom), low bins at bottom */
    function binIndexToY(binIdx, h, n) {
        const logMin = Math.log(1);
        const logMax = Math.log(Math.max(2, n));
        const logBin = Math.log(Math.min(n, binIdx + 1));
        let t = (logBin - logMin) / (logMax - logMin);
        t = Math.max(0, Math.min(1, t));
        return h * (1 - t);
    }

    function hzToBinIndex(hz, n, sr) {
        const nyq = sr / 2;
        const idx = Math.round((hz / nyq) * n);
        return Math.max(0, Math.min(n - 1, idx));
    }

    function formatHz(hz) {
        if (hz >= 1000) return (hz / 1000).toFixed(hz >= 10000 ? 0 : 1) + 'k';
        return String(Math.round(hz));
    }

    /** Strongest FFT bin in a speech-ish band (per-column “dominant formant” proxy). */
    function dominantBinInSpeechBand(arr, n, sr) {
        const lo = hzToBinIndex(80, n, sr);
        const hi = hzToBinIndex(5000, n, sr);
        let max = -1;
        let bi = lo;
        for (let i = lo; i <= hi; i++) {
            if (arr[i] > max) {
                max = arr[i];
                bi = i;
            }
        }
        if (max < 10) return null;
        return bi;
    }

    function colToX(col, W) {
        return W - 1 - (columnCount - col);
    }

    function prunePeaksHistory(W) {
        const maxAge = W + 400;
        while (peaksHistory.length && columnCount - peaksHistory[0].col > maxAge) {
            peaksHistory.shift();
        }
    }

    function strokeSmoothCurve(ctx2, pts) {
        if (pts.length < 2) return;
        ctx2.beginPath();
        ctx2.moveTo(pts[0].x, pts[0].y);
        if (pts.length === 2) {
            ctx2.lineTo(pts[1].x, pts[1].y);
            ctx2.stroke();
            return;
        }
        for (let i = 1; i < pts.length - 2; i++) {
            const xc = (pts[i].x + pts[i + 1].x) / 2;
            const yc = (pts[i].y + pts[i + 1].y) / 2;
            ctx2.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
        }
        const n = pts.length;
        ctx2.quadraticCurveTo(pts[n - 2].x, pts[n - 2].y, pts[n - 1].x, pts[n - 1].y);
        ctx2.stroke();
    }

    function drawOverlay() {
        const W = overlay.width;
        const H = overlay.height;
        octx.clearRect(0, 0, W, H);

        for (let i = pins.length - 1; i >= 0; i--) {
            const p = pins[i];
            const cx = colToX(p.colCenter, W) - TIME_SHIFT_PX;
            if (cx < -220) {
                pins.splice(i, 1);
                continue;
            }

            const samples = peaksHistory.filter(
                (pp) => pp.col >= p.colStart && pp.col <= p.colEnd && pp.bin != null
            );
            samples.sort((a, b) => a.col - b.col);

            if (samples.length >= 2) {
                const pts = samples.map((s) => ({
                    x: colToX(s.col, W) - TIME_SHIFT_PX,
                    y: binIndexToY(s.bin, H, binCount),
                }));
                octx.strokeStyle = 'rgba(255, 210, 160, 0.92)';
                octx.lineWidth = 2;
                octx.lineJoin = 'round';
                octx.lineCap = 'round';
                strokeSmoothCurve(octx, pts);
            } else if (samples.length === 1) {
                const s = samples[0];
                const x = colToX(s.col, W) - TIME_SHIFT_PX;
                const y = binIndexToY(s.bin, H, binCount);
                octx.fillStyle = 'rgba(255, 210, 160, 0.9)';
                octx.beginPath();
                octx.arc(x, y, 3, 0, Math.PI * 2);
                octx.fill();
            }

            const labelY = binIndexToY(p.labelBin, H, binCount) - LABEL_ABOVE_PX;
            octx.font = '11px ui-monospace, monospace';
            octx.textAlign = 'center';
            octx.textBaseline = 'bottom';
            octx.fillStyle = '#f5e6dc';
            octx.shadowColor = 'rgba(0,0,0,0.9)';
            octx.shadowBlur = 6;
            octx.fillText(p.text, cx, labelY);
            octx.shadowBlur = 0;
        }
    }

    function buildRuler() {
        freqRuler.innerHTML = '';
        const h = window.innerHeight - UI_H;
        if (h < 40 || !analyser) return;

        const ticks = [60, 125, 250, 500, 1000, 2000, 4000, 8000, 14000];
        for (const hz of ticks) {
            const bi = hzToBinIndex(hz, binCount, sampleRate);
            if (bi <= 0 || bi >= binCount - 1) continue;
            const y = binIndexToY(bi, h, binCount);
            const m = hzToMidi(hz);
            const note = midiToNoteName(m);
            const div = document.createElement('div');
            div.className = 'freq-tick';
            div.style.top = UI_H + y + 'px';
            div.innerHTML = `<span class="hz">${formatHz(hz)} Hz</span><br><span class="note">${note}</span>`;
            freqRuler.appendChild(div);
        }
    }

    function buildPianoGrid() {
        pianoGrid.innerHTML = '';
        const h = window.innerHeight - UI_H;
        if (h < 40 || !analyser) return;

        const markMidi = (m, opts) => {
            const hz = midiToHz(m);
            const bi = hzToBinIndex(hz, binCount, sampleRate);
            if (bi < 1 || bi >= binCount - 1) return;
            const y = binIndexToY(bi, h, binCount);
            const line = document.createElement('div');
            line.className = 'piano-line' + (opts.c ? ' c' : '');
            line.style.top = y + 'px';
            if (opts.color) line.style.borderTopColor = opts.color;
            if (opts.opacity != null) line.style.opacity = String(opts.opacity);
            pianoGrid.appendChild(line);
        };

        for (let m = 36; m <= 96; m += 12) {
            markMidi(m, { c: true, opacity: 0.95 });
        }
        [57, 69, 81].forEach((m) => markMidi(m, { color: 'rgba(255,200,160,0.28)', opacity: 0.85 }));
        for (let m = 38; m <= 94; m += 12) {
            markMidi(m, { color: 'rgba(255,200,120,0.12)', opacity: 0.5 });
        }
        for (let m = 42; m <= 90; m += 12) {
            markMidi(m, { color: 'rgba(255,200,120,0.1)', opacity: 0.45 });
        }
    }

    function refreshOverlays() {
        buildRuler();
        buildPianoGrid();
    }

    function resize() {
        const dpr = 1;
        const w = Math.max(64, window.innerWidth - RULER_W);
        const h = Math.max(64, window.innerHeight - UI_H);
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        overlay.style.width = canvas.style.width;
        overlay.style.height = canvas.style.height;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (analyser) refreshOverlays();
        drawOverlay();
    }

    function lerpRgb(a, b, t) {
        return [
            Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t),
        ];
    }

    function heat(byte) {
        const v = byte / 255;
        if (v < 0.03) return [0, 0, 0];
        const a = Math.min(1, (v - 0.03) / 0.97);
        if (a < 0.22) {
            const t = a / 0.22;
            return lerpRgb([0, 0, 0], [55, 0, 85], t);
        }
        if (a < 0.45) {
            const t = (a - 0.22) / 0.23;
            return lerpRgb([55, 0, 85], [150, 0, 130], t);
        }
        if (a < 0.72) {
            const t = (a - 0.45) / 0.27;
            return lerpRgb([150, 0, 130], [255, 85, 35], t);
        }
        const t = (a - 0.72) / 0.28;
        return lerpRgb([255, 85, 35], [255, 238, 220], t);
    }

    function yToBin(y, h, n) {
        const t = 1 - y / h;
        const logMin = Math.log(1);
        const logMax = Math.log(Math.max(2, n));
        const logBin = logMin + t * (logMax - logMin);
        let idx = Math.floor(Math.exp(logBin)) - 1;
        if (idx < 0) idx = 0;
        if (idx >= n) idx = n - 1;
        return idx;
    }

    function drawColumn(W, H, data) {
        const n = data.length;
        const shifted = ctx.getImageData(1, 0, W - 1, H);
        ctx.putImageData(shifted, 0, 0);
        for (let py = 0; py < H; py++) {
            const bin = yToBin(py + 0.5, H, n);
            const [r, g, b] = heat(data[bin]);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(W - 1, py, 1, 1);
        }
    }

    function addTranscriptPins(words, endColumn) {
        words.forEach((text, i) => {
            const colEnd = endColumn - (words.length - 1 - i) * COLS_PER_WORD;
            const colStart = colEnd - COLS_PER_WORD;
            const colCenter = Math.floor((colStart + colEnd) / 2);
            const samples = peaksHistory.filter(
                (p) => p.col >= colStart && p.col <= colEnd && p.bin != null
            );
            let labelBin;
            if (samples.length) {
                labelBin = Math.max(...samples.map((s) => s.bin));
            } else {
                labelBin = hzToBinIndex(1200, binCount, sampleRate);
            }
            pins.push({ text, colStart, colEnd, colCenter, labelBin });
        });
    }

    function loop() {
        if (!analyser || !freqBuffer) return;
        const W = canvas.width;
        const H = canvas.height;
        analyser.getByteFrequencyData(freqBuffer);
        const bin = dominantBinInSpeechBand(freqBuffer, binCount, sampleRate);
        peaksHistory.push({ col: columnCount, bin });
        prunePeaksHistory(W);
        drawColumn(W, H, freqBuffer);
        columnCount++;
        drawOverlay();
        rafId = requestAnimationFrame(loop);
    }

    function startSpeech() {
        if (!transcribeChk.checked) return;
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            console.warn('Web Speech API not available');
            return;
        }
        try {
            recognition = new SR();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.onresult = (ev) => {
                for (let i = ev.resultIndex; i < ev.results.length; i++) {
                    if (!ev.results[i].isFinal) continue;
                    const text = ev.results[i][0].transcript.trim();
                    if (!text) continue;
                    const words = text.split(/\s+/).filter(Boolean);
                    if (words.length) addTranscriptPins(words, columnCount);
                }
            };
            recognition.onerror = (e) => {
                if (e.error === 'not-allowed') {
                    setStatus('Speech recognition blocked — check mic permissions.', true);
                }
            };
            recognition.start();
        } catch (e) {
            console.warn(e);
        }
    }

    function stopSpeech() {
        if (recognition) {
            try {
                recognition.stop();
            } catch (_) {}
            recognition = null;
        }
    }

    function clearPins() {
        pins.length = 0;
        octx.clearRect(0, 0, overlay.width, overlay.height);
    }

    async function start() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                },
            });
            sourceNode = audioCtx.createMediaStreamSource(mediaStream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.65;
            sourceNode.connect(analyser);
            freqBuffer = new Uint8Array(analyser.frequencyBinCount);
            sampleRate = audioCtx.sampleRate;
            binCount = analyser.frequencyBinCount;

            columnCount = 0;
            peaksHistory.length = 0;
            clearPins();

            startBtn.disabled = true;
            stopBtn.disabled = false;
            setStatus(
                'Listening — low freq bottom · time scrolls right · transcription times are estimated (not true word timestamps).'
            );
            resize();
            refreshOverlays();
            startSpeech();
            rafId = requestAnimationFrame(loop);
        } catch (e) {
            console.error(e);
            setStatus(e.message || 'Microphone access failed', true);
            startBtn.disabled = false;
        }
    }

    function stop() {
        stopSpeech();
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (sourceNode) {
            try {
                sourceNode.disconnect();
            } catch (_) {}
            sourceNode = null;
        }
        if (analyser) {
            try {
                analyser.disconnect();
            } catch (_) {}
            analyser = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach((t) => t.stop());
            mediaStream = null;
        }
        freqBuffer = null;
        peaksHistory.length = 0;
        clearPins();
        startBtn.disabled = false;
        stopBtn.disabled = true;
        setStatus('Stopped');
    }

    startBtn.addEventListener('click', start);
    stopBtn.addEventListener('click', stop);
    window.addEventListener('resize', () => {
        resize();
        refreshOverlays();
    });

    resize();
    setStatus('Start mic — optional “Transcribe” uses Chrome Web Speech (estimated word spacing).');
})();
