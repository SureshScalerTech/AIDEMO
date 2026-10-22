/* Live player: autoplay, replay, play/pause, sound, scrubbing.
 * With ?mode=export the page only exposes the render API for scripts/export.mjs.
 */
(function () {
  const SV = window.SV;
  const C = SV.comp; // the composition this page loaded (intro or outro)
  const params = new URLSearchParams(location.search);
  const exportMode = params.get("mode") === "export";

  const canvas = document.getElementById("stage-canvas");
  const $ = (id) => document.getElementById(id);

  SV.ready = C.init(canvas).then(() => {
    C.renderAt(0);
    document.body.classList.add("ready");
  });

  if (exportMode) {
    document.body.classList.add("export");
    return;
  }

  let actx = null, abuf = null, src = null;
  let soundOn = false;
  let playing = false;
  let startPerf = 0; // performance.now() at t = 0
  let startAudio = 0; // actx.currentTime at t = 0
  let pausedAt = 0;

  // Pre-render the soundtrack in the background (no user gesture needed for offline rendering)
  const audioReady = SV.audio.render(C.audio).then((b) => (abuf = b)).catch((e) => console.warn("audio render failed", e));

  function now() {
    if (!playing) return pausedAt;
    if (soundOn && actx) return actx.currentTime - startAudio;
    return (performance.now() - startPerf) / 1000;
  }

  function stopAudio() {
    if (src) {
      try { src.stop(); } catch (e) {}
      src.disconnect();
      src = null;
    }
  }

  function startAudioAt(t) {
    stopAudio();
    if (!soundOn || !actx || !abuf || t >= C.DURATION) return;
    src = actx.createBufferSource();
    src.buffer = abuf;
    src.connect(actx.destination);
    const when = actx.currentTime + 0.03;
    src.start(when, t);
    startAudio = when - t;
  }

  function play(from) {
    const t = from == null ? pausedAt : from;
    playing = true;
    startPerf = performance.now() - t * 1000;
    startAudioAt(t);
    updateUI();
  }

  function pause() {
    pausedAt = Math.min(now(), C.DURATION);
    playing = false;
    stopAudio();
    updateUI();
  }

  async function enableSound() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SV.audio.SR });
    if (actx.state === "suspended") await actx.resume();
    await audioReady;
    soundOn = true;
    $("hint").classList.add("hidden");
  }

  async function replay() {
    await enableSound();
    pausedAt = 0;
    play(0);
  }

  function updateUI() {
    $("btn-play").textContent = playing ? "❚❚" : "▶";
    $("btn-play").setAttribute("aria-label", playing ? "Pause" : "Play");
    $("btn-sound").textContent = soundOn ? "🔊" : "🔇";
  }

  const scrub = $("scrub");
  let scrubbing = false;
  scrub.addEventListener("input", () => {
    scrubbing = true;
    pausedAt = (scrub.value / 1000) * C.DURATION;
    if (playing) { playing = false; stopAudio(); }
    C.renderAt(pausedAt);
    updateUI();
  });
  scrub.addEventListener("change", () => { scrubbing = false; });

  $("btn-replay").addEventListener("click", replay);
  $("btn-play").addEventListener("click", async () => {
    if (playing) pause();
    else {
      if (pausedAt >= C.DURATION - 0.01) pausedAt = 0;
      await enableSound();
      play();
    }
  });
  $("btn-sound").addEventListener("click", async () => {
    if (soundOn) {
      soundOn = false;
      const t = now();
      stopAudio();
      startPerf = performance.now() - t * 1000;
    } else {
      const t = now();
      await enableSound();
      if (playing) { startPerf = performance.now() - t * 1000; startAudioAt(t); }
    }
    updateUI();
  });
  $("btn-fs").addEventListener("click", () => {
    const el = $("stage");
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen && el.requestFullscreen();
  });
  $("hint").addEventListener("click", replay);

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); $("btn-play").click(); }
    else if (e.key === "r" || e.key === "R") replay();
    else if (e.key === "m" || e.key === "M") $("btn-sound").click();
    else if (e.key === "f" || e.key === "F") $("btn-fs").click();
  });

  function loop() {
    let t = now();
    if (playing && t >= C.DURATION) {
      t = C.DURATION;
      pausedAt = t;
      playing = false;
      stopAudio();
      updateUI();
    }
    if (playing || !scrubbing) C.renderAt(t);
    if (!scrubbing) scrub.value = Math.round((t / C.DURATION) * 1000);
    $("time").textContent = `${t.toFixed(2)}s / ${C.DURATION.toFixed(2)}s`;
    requestAnimationFrame(loop);
  }

  // Autoplay on load. Browsers block sound until the viewer interacts, so the
  // intro starts muted and a hint offers a replay with sound.
  SV.ready.then(() => {
    play(0);
    requestAnimationFrame(loop);
  });
})();
