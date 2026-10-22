/* Shared composition engine used by every video (intro, end screen).
 * A composition supplies draw(ctx, t, bufs); this wraps it with canvas setup,
 * font loading, the finishing pass (vignette, film grain, fades) and
 * temporal motion blur. renderAt(t) stays a pure function of time.
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const E = U.ease;

  let vignette = null, grain = null;

  function finishingAssets() {
    if (vignette) return;
    vignette = U.canvas(U.W, U.H);
    const v = vignette.getContext("2d");
    const vg = v.createRadialGradient(960, 540, 420, 960, 540, 1180);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.62)");
    v.fillStyle = vg;
    v.fillRect(0, 0, U.W, U.H);

    grain = [];
    const r = U.rng(31337);
    for (let k = 0; k < 6; k++) {
      const g = U.canvas(256, 256);
      const gx = g.getContext("2d");
      const id = gx.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) {
        const n = 128 + (r() - 0.5) * 120;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = n;
        id.data[i + 3] = 255;
      }
      gx.putImageData(id, 0, 0);
      grain.push(g);
    }
  }

  SV.resetCtx = function (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.filter = "none";
    ctx.letterSpacing = "0px";
    ctx.setLineDash([]);
  };

  /**
   * opts: { name, duration, audio (score name), fadeIn: seconds, fadeOut: [start, end],
   *         init: async () => void, draw: (ctx, t, bufs) => void }
   */
  SV.createComp = function (opts) {
    const C = { name: opts.name, DURATION: opts.duration, FPS: U.FPS, audio: opts.audio || opts.name };
    let main, mctx, work, wctx;
    const bufs = {};

    C.init = async function (canvas) {
      main = canvas;
      main.width = U.W;
      main.height = U.H;
      mctx = main.getContext("2d");
      work = U.canvas(U.W, U.H);
      wctx = work.getContext("2d");
      bufs.b = U.canvas(U.W, U.H);
      bufs.bctx = bufs.b.getContext("2d");

      if (document.fonts) {
        await Promise.all([
          document.fonts.load(`800 120px ${U.FONT}`),
          document.fonts.load(`700 30px ${U.FONT}`),
          document.fonts.load(`600 30px ${U.FONT}`),
        ]).catch(() => {});
        await document.fonts.ready;
      }
      finishingAssets();
      if (opts.init) await opts.init();
    };

    function renderTo(ctx, t) {
      t = U.clamp(t, 0, C.DURATION);
      SV.resetCtx(ctx);
      opts.draw(ctx, t, bufs);

      // finishing: vignette, fine film grain, fade from / to black
      SV.resetCtx(ctx);
      ctx.drawImage(vignette, 0, 0);
      ctx.globalAlpha = 0.045;
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = ctx.createPattern(grain[Math.floor(t * U.FPS) % grain.length], "repeat");
      ctx.fillRect(0, 0, U.W, U.H);
      SV.resetCtx(ctx);
      const fadeIn = 1 - U.range(t, 0, opts.fadeIn || 0.35);
      const fo = opts.fadeOut || [C.DURATION - 0.55, C.DURATION - 0.03];
      const fadeOut = E.inOutSine(U.range(t, fo[0], fo[1]));
      const black = Math.max(fadeIn, fadeOut);
      if (black > 0) {
        ctx.fillStyle = `rgba(0,0,0,${black})`;
        ctx.fillRect(0, 0, U.W, U.H);
      }
    }

    /** Render one frame at time t (seconds) into the main canvas. */
    C.renderAt = (t) => renderTo(mctx, t);

    /**
     * Render with true temporal motion blur: average `samples` sub-frames
     * spread over a 180° shutter (half a frame). Used by the MP4 exporter.
     */
    C.renderBlurred = function (t, samples = 1, shutter = 0.5) {
      if (samples <= 1) return C.renderAt(t);
      const dt = shutter / U.FPS;
      for (let k = 0; k < samples; k++) {
        const tk = t + (k / (samples - 1) - 0.5) * dt;
        renderTo(wctx, Math.max(0, tk));
        mctx.globalAlpha = 1 / (k + 1);
        mctx.drawImage(work, 0, 0);
      }
      mctx.globalAlpha = 1;
    };

    C.canvas = () => main;
    // the page's active composition (each HTML page loads exactly one)
    SV.comp = C;
    return C;
  };
})();
