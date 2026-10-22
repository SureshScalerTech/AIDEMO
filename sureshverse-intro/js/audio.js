/* Original procedural soundtrack, synthesised with the Web Audio API.
 * No samples or third-party music are used, so the audio is fully original and
 * royalty-free. The whole 12 s score is rendered offline (OfflineAudioContext),
 * which makes it sample-accurate and identical for the player and the MP4 export.
 *
 * Cue sheet (seconds):
 *   0.00  atmospheric pad (D minor 9) + space wind
 *   0.40  rising futuristic synth riser → 3.0
 *   1.45  energy-beam whoosh, panned L → R
 *   1.90  shimmer as the S is born
 *   3.00  deep cinematic impact (sub drop + "braam" + noise burst), Bb chord
 *   3.10  pulsing arpeggio begins (120 BPM, 16ths)
 *   3.45  particle "data" ticks while the wordmark converges
 *   5.20  bell ting on the wordmark shine
 *   5.80  digital whoosh (light-sweep transition)
 *   6.00  tech accent + kick pulse; UI blips 6.12 / 6.26 / 6.40 / 6.54
 *   7.70  airy whoosh (wipe into the landscape)
 *   8.00  warm string swell, C major (travel)
 *   9.55  reverse swell into
 *  10.00  final orchestral-electronic hit: D major, brass, timpani, bells
 *  11.30  fade out → silence at 12.0
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const A = (SV.audio = {});

  A.SR = 48000;
  A.DURATION = 12;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // note names → midi
  const N = { D1: 26, A1: 33, D2: 38, F2: 41, A2: 45, Bb1: 34, Bb2: 46, C2: 36, C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, Bb3: 58, C4: 60, D4: 62, E4: 64, F4: 65, Fs3: 54, Fs4: 66, G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74, E5: 76, Fs5: 78, A5: 81 };

  function noiseBuffer(ctx, sec, seed) {
    const r = U.rng(seed);
    const b = ctx.createBuffer(2, Math.ceil(sec * ctx.sampleRate), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    }
    return b;
  }

  function impulse(ctx, sec, decay, seed) {
    const r = U.rng(seed);
    const len = Math.ceil(sec * ctx.sampleRate);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (r() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1);
      }
    }
    return b;
  }

  /** Build the full score into `ctx`, routed to `out`, starting at ctx time t0. */
  A.build = function (ctx, out, t0 = 0) {
    const T = (s) => t0 + s;
    const noise = noiseBuffer(ctx, 4, 2024);

    // --- buses ---
    const master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    master.connect(comp).connect(limiter).connect(out);
    master.gain.setValueAtTime(0.0001, T(0));
    master.gain.linearRampToValueAtTime(0.9, T(0.6));
    master.gain.setValueAtTime(0.9, T(11.25));
    master.gain.linearRampToValueAtTime(0.0, T(11.98));

    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 3.6, 2.6, 77);
    const verbIn = ctx.createGain();
    verbIn.gain.value = 0.55;
    verbIn.connect(verb).connect(master);

    function bus(gain, send = 0.3) {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(master);
      if (send > 0) {
        const s = ctx.createGain();
        s.gain.value = send;
        g.connect(s).connect(verbIn);
      }
      return g;
    }

    function env(g, start, attack, hold, release, peak) {
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(peak, start + attack);
      g.gain.setValueAtTime(peak, start + attack + hold);
      g.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + release);
    }

    function noiseSrc(start, stop) {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.start(start, (start * 0.37) % 3);
      s.stop(stop);
      return s;
    }

    // --- instruments ---
    function pad(notes, start, end, o = {}) {
      const dest = bus(o.gain || 0.05, o.send == null ? 0.6 : o.send);
      for (const m of notes) {
        for (const det of [-9, 0, 9]) {
          const osc = ctx.createOscillator();
          osc.type = o.type || "sawtooth";
          osc.frequency.value = mtof(m);
          osc.detune.value = det;
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.Q.value = 0.7;
          f.frequency.setValueAtTime(o.cut0 || 600, start);
          f.frequency.linearRampToValueAtTime(o.cut1 || 1200, end);
          const g = ctx.createGain();
          const att = o.attack || 0.8, rel = o.release || 0.8;
          g.gain.setValueAtTime(0.0001, start);
          g.gain.linearRampToValueAtTime(1 / notes.length, start + att);
          g.gain.setValueAtTime(1 / notes.length, end - rel);
          g.gain.linearRampToValueAtTime(0.0001, end);
          const p = ctx.createStereoPanner();
          p.pan.value = det / 18;
          osc.connect(f).connect(g).connect(p).connect(dest);
          osc.start(start);
          osc.stop(end + 0.05);
        }
      }
    }

    function riser(start, end) {
      const dest = bus(0.09, 0.5);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(mtof(N.D2), start);
      osc.frequency.exponentialRampToValueAtTime(mtof(N.D5), end);
      const osc2 = ctx.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(mtof(N.A2), start);
      osc2.frequency.exponentialRampToValueAtTime(mtof(N.A4) * 2, end);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = 6;
      f.frequency.setValueAtTime(300, start);
      f.frequency.exponentialRampToValueAtTime(7000, end);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(1, end - 0.05);
      g.gain.linearRampToValueAtTime(0.0001, end);
      osc.connect(f);
      osc2.connect(f);
      f.connect(g).connect(dest);
      osc.start(start); osc2.start(start);
      osc.stop(end + 0.05); osc2.stop(end + 0.05);
      // noise riser
      const n = noiseSrc(start, end + 0.05);
      const hp = ctx.createBiquadFilter();
      hp.type = "bandpass";
      hp.Q.value = 1.5;
      hp.frequency.setValueAtTime(400, start);
      hp.frequency.exponentialRampToValueAtTime(9000, end);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, start);
      ng.gain.exponentialRampToValueAtTime(0.7, end - 0.03);
      ng.gain.linearRampToValueAtTime(0.0001, end);
      n.connect(hp).connect(ng).connect(dest);
    }

    function whoosh(start, dur, pan0, pan1, gain = 0.35, f0 = 300, f1 = 5000) {
      const dest = bus(gain, 0.5);
      const n = noiseSrc(start, start + dur + 0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(f0, start);
      bp.frequency.exponentialRampToValueAtTime(f1, start + dur * 0.6);
      bp.frequency.exponentialRampToValueAtTime(f0 * 2, start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(1, start + dur * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(pan0, start);
      p.pan.linearRampToValueAtTime(pan1, start + dur);
      n.connect(bp).connect(g).connect(p).connect(dest);
    }

    function impact(at, size = 1) {
      const dest = bus(0.9 * size, 0.45);
      // sub drop
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(95, at);
      sub.frequency.exponentialRampToValueAtTime(30, at + 1.4);
      const sg = ctx.createGain();
      env(sg, at, 0.005, 0.1, 2.0, 0.9);
      sub.connect(sg).connect(dest);
      sub.start(at); sub.stop(at + 2.4);
      // noise burst
      const n = noiseSrc(at, at + 1.2);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(5000, at);
      lp.frequency.exponentialRampToValueAtTime(200, at + 0.8);
      const ng = ctx.createGain();
      env(ng, at, 0.002, 0.02, 0.9, 0.55);
      n.connect(lp).connect(ng).connect(dest);
      // braam
      const bl = ctx.createBiquadFilter();
      bl.type = "lowpass";
      bl.Q.value = 2;
      bl.frequency.setValueAtTime(1800, at);
      bl.frequency.exponentialRampToValueAtTime(160, at + 2.2);
      const bg = ctx.createGain();
      env(bg, at, 0.02, 0.15, 2.4, 0.22);
      bl.connect(bg).connect(dest);
      for (const [m, d] of [[N.D1, 0], [N.D2, 7], [N.A2, -7], [N.D2, -12]]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(m);
        o.detune.value = d;
        o.connect(bl);
        o.start(at); o.stop(at + 2.8);
      }
    }

    function pluck(at, m, gain, cut, pan) {
      const dest = arpBus;
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = mtof(m);
      const o2 = ctx.createOscillator();
      o2.type = "square";
      o2.frequency.value = mtof(m) * 1.003;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = 4;
      f.frequency.setValueAtTime(cut * 4, at);
      f.frequency.exponentialRampToValueAtTime(cut, at + 0.12);
      const g = ctx.createGain();
      env(g, at, 0.003, 0.02, 0.22, gain);
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      o.connect(f); o2.connect(f);
      f.connect(g).connect(p).connect(dest);
      o.start(at); o2.start(at);
      o.stop(at + 0.3); o2.stop(at + 0.3);
    }

    function bell(at, freq, gain, pan = 0) {
      const dest = bus(gain, 0.8);
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(dest);
      [[1, 1, 2.2], [2.76, 0.5, 1.4], [5.4, 0.25, 0.8], [8.93, 0.12, 0.5]].forEach(([r, a, d]) => {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq * r;
        const g = ctx.createGain();
        env(g, at, 0.002, 0, d, a);
        o.connect(g).connect(p);
        o.start(at); o.stop(at + d + 0.05);
      });
    }

    function blip(at, freq, gain = 0.06, dur = 0.06, type = "sine", pan = 0) {
      const dest = bus(gain, 0.25);
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, at);
      o.frequency.exponentialRampToValueAtTime(freq * 1.5, at + dur);
      const g = ctx.createGain();
      env(g, at, 0.002, dur * 0.3, dur, 1);
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      o.connect(g).connect(p).connect(dest);
      o.start(at); o.stop(at + dur * 1.5 + 0.05);
    }

    function kick(at, gain = 0.5) {
      const dest = bus(gain, 0.08);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(140, at);
      o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
      const g = ctx.createGain();
      env(g, at, 0.002, 0.03, 0.35, 1);
      o.connect(g).connect(dest);
      o.start(at); o.stop(at + 0.45);
    }

    function hat(at, gain = 0.05, pan = 0) {
      const dest = bus(gain, 0.15);
      const n = noiseSrc(at, at + 0.08);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 8000;
      const g = ctx.createGain();
      env(g, at, 0.001, 0.005, 0.05, 1);
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      n.connect(hp).connect(g).connect(p).connect(dest);
    }

    function timpani(at, m, gain = 0.6) {
      const dest = bus(gain, 0.6);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(mtof(m) * 1.3, at);
      o.frequency.exponentialRampToValueAtTime(mtof(m), at + 0.08);
      const g = ctx.createGain();
      env(g, at, 0.003, 0.05, 1.6, 1);
      o.connect(g).connect(dest);
      o.start(at); o.stop(at + 1.8);
      const n = noiseSrc(at, at + 0.3);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 900;
      const ng = ctx.createGain();
      env(ng, at, 0.002, 0.01, 0.2, 0.4);
      n.connect(lp).connect(ng).connect(dest);
    }

    function brass(notes, start, end, gain) {
      // filtered saws with a swelling filter: an orchestral-electronic brass stab
      const dest = bus(gain, 0.55);
      for (const m of notes) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = mtof(m);
          o.detune.value = det;
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.Q.value = 1.2;
          f.frequency.setValueAtTime(500, start);
          f.frequency.linearRampToValueAtTime(2600, start + 0.25);
          f.frequency.exponentialRampToValueAtTime(900, end);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, start);
          g.gain.linearRampToValueAtTime(1 / notes.length, start + 0.06);
          g.gain.setValueAtTime(0.8 / notes.length, end - 0.6);
          g.gain.linearRampToValueAtTime(0.0001, end);
          const p = ctx.createStereoPanner();
          p.pan.value = det / 12;
          o.connect(f).connect(g).connect(p).connect(dest);
          o.start(start); o.stop(end + 0.05);
        }
      }
    }

    const r = U.rng(5150);

    // ---------- the score ----------
    // 0–3: atmosphere
    pad([N.D2, N.A2, N.D3, N.F3, N.A3, N.E4], T(0), T(3.15), { gain: 0.07, attack: 1.4, release: 0.3, cut0: 300, cut1: 1600 });
    whoosh(T(0), 3.0, -0.3, 0.3, 0.08, 200, 900); // space wind
    riser(T(0.4), T(3.0));
    whoosh(T(1.45), 0.9, -0.9, 0.9, 0.32, 400, 6000); // energy beam
    for (let i = 0; i < 9; i++) bell(T(1.9 + i * 0.07), mtof([N.D5, N.A5, N.E5, N.Fs5, N.A5][i % 5]) , 0.025, (r() - 0.5) * 1.4);

    // 3.0: impact + logo reveal
    impact(T(3.0), 1);
    pad([N.Bb1, N.Bb2, N.F3, N.Bb3, N.D4, N.F4], T(3.0), T(6.1), { gain: 0.06, attack: 0.25, release: 0.3, cut0: 900, cut1: 2200 });

    const arpBus = bus(1, 0.35);
    const chordAt = (s) =>
      s < 6 ? [N.Bb3, N.D4, N.F4, N.Bb4] : s < 8 ? [N.F3, N.A3, N.C4, N.F4] : s < 10 ? [N.C4, N.E4, N.G4, N.C5] : [N.D4, N.Fs4, N.A4, N.D5];
    const pattern = [0, 2, 1, 3, 2, 1, 3, 2];
    for (let i = 0; ; i++) {
      const s = 3.1 + i * 0.125;
      if (s > 9.9) break;
      const ch = chordAt(s);
      const k = U.range(s, 3.1, 9.6);
      pluck(T(s), ch[pattern[i % 8]] + (i % 16 >= 8 ? 12 : 0) * (s > 6 ? 1 : 0), 0.045 + 0.04 * k, 700 + 2600 * k, i % 2 ? 0.35 : -0.35);
    }

    for (let i = 0; i < 46; i++) {
      const s = 3.45 + r() * 1.25;
      blip(T(s), 2400 + r() * 4200, 0.018, 0.025, "sine", (r() - 0.5) * 1.6);
    }
    bell(T(5.2), mtof(N.A5), 0.06, 0.2);
    bell(T(5.2), mtof(N.D5), 0.04, -0.2);

    // 5.8–8: technology
    whoosh(T(5.72), 0.55, -1, 1, 0.42, 500, 8000);
    impact(T(6.0), 0.35);
    pad([N.F2, N.C3, N.F3, N.A3, N.C4], T(6.0), T(8.1), { gain: 0.045, attack: 0.1, release: 0.3, cut0: 1200, cut1: 2400 });
    [6.12, 6.26, 6.4, 6.54].forEach((s, i) => {
      blip(T(s), 1320 * Math.pow(1.122, i * 2), 0.05, 0.05, "square", i % 2 ? 0.5 : -0.5);
      blip(T(s + 0.05), 2640 * Math.pow(1.122, i * 2), 0.03, 0.04, "sine", i % 2 ? 0.5 : -0.5);
    });
    for (let b = 0; b < 8; b++) kick(T(6.0 + b * 0.5), b === 0 ? 0.0 : 0.38);
    for (let b = 0; b < 16; b++) hat(T(6.25 + b * 0.25), b % 2 ? 0.035 : 0.05, b % 2 ? 0.3 : -0.3);

    // 7.7–10: travel
    whoosh(T(7.6), 0.75, 0.8, -0.8, 0.3, 300, 4000);
    pad([N.C2, N.C3, N.G3, N.C4, N.E4, N.G4], T(7.85), T(10.1), { gain: 0.075, attack: 0.6, release: 0.25, cut0: 700, cut1: 2600 });
    for (let b = 0; b < 4; b++) kick(T(8.0 + b * 0.5), 0.34);
    timpani(T(8.0), N.C2, 0.4);
    // reverse swell into the final hit
    whoosh(T(9.4), 0.6, 0, 0, 0.22, 200, 7000);
    riser(T(9.35), T(10.0));

    // 10: final orchestral-electronic hit — resolve to D major
    impact(T(10.0), 0.7);
    timpani(T(10.0), N.D2, 0.7);
    timpani(T(10.5), N.A1, 0.35);
    brass([N.D3, N.A3, N.D4, N.Fs4, N.A4], T(10.0), T(11.95), 0.22);
    pad([N.D2, N.A2, N.D3, N.Fs3, N.A3, N.D4, N.Fs4, N.A4], T(10.0), T(11.98), { gain: 0.08, attack: 0.08, release: 0.6, cut0: 2600, cut1: 1100 });
    [N.D5, N.Fs5, N.A5].forEach((m, i) => bell(T(10.05 + i * 0.14), mtof(m), 0.05, (i - 1) * 0.5));
    bell(T(11.0), mtof(N.A5) * 2, 0.025, 0.3);

    return master;
  };

  /** Render the full soundtrack offline → AudioBuffer (cached). */
  let cached = null;
  A.render = function () {
    if (cached) return cached;
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new Ctx(2, Math.ceil(A.SR * A.DURATION), A.SR);
    A.build(ctx, ctx.destination, 0);
    cached = ctx.startRendering();
    return cached;
  };

  /** 16-bit PCM WAV encoder. */
  A.toWav = function (buf) {
    const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
    const out = new ArrayBuffer(44 + len * ch * 2);
    const v = new DataView(out);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + len * ch * 2, true); w(8, "WAVE");
    w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, len * ch * 2, true);
    const data = [];
    for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    // TPDF dither from a seeded RNG keeps the output deterministic
    const r = U.rng(99);
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const d = (r() - r()) / 32768;
        const s = U.clamp(data[c][i] + d, -1, 1);
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        o += 2;
      }
    }
    return out;
  };

  A.wavBase64 = async function () {
    const wav = new Uint8Array(A.toWav(await A.render()));
    let s = "";
    for (let i = 0; i < wav.length; i += 0x8000) s += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
    return btoa(s);
  };
})();
