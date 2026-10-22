/* Timeline + compositor. renderAt(t) is a pure function of time, used both by the
 * live player and by the deterministic frame exporter.
 *
 *   0.0 – 3.0  Scene 1  cinematic opening (space, Earth, beam, S emerges)
 *   3.0 – 6.0  Scene 2  logo reveal (ring, particles → wordmark, tagline)
 *   5.8 – 6.2           light-sweep transition
 *   6.0 – 8.0  Scene 3  technology showcase
 *   7.7 – 8.25          upward light wipe into the landscape
 *   8.0 – 10.0 Scene 4  travel & adventure
 *   9.8 – 10.3          golden bloom out of the sun
 *  10.0 – 12.0 Scene 5  final lockup, hold, fade to black
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const E = U.ease;
  const I = (SV.intro = {});

  let main, mctx, bufB, bctx, work, wctx, vignette, grain = [];

  I.DURATION = U.DURATION;
  I.FPS = U.FPS;

  I.init = async function (canvas) {
    main = canvas;
    main.width = U.W;
    main.height = U.H;
    mctx = main.getContext("2d");
    bufB = U.canvas(U.W, U.H);
    bctx = bufB.getContext("2d");
    work = U.canvas(U.W, U.H);
    wctx = work.getContext("2d");

    if (document.fonts) {
      await Promise.all([
        document.fonts.load(`800 120px ${U.FONT}`),
        document.fonts.load(`700 30px ${U.FONT}`),
        document.fonts.load(`600 30px ${U.FONT}`),
      ]).catch(() => {});
      await document.fonts.ready;
    }

    vignette = U.canvas(U.W, U.H);
    const v = vignette.getContext("2d");
    const vg = v.createRadialGradient(960, 540, 420, 960, 540, 1180);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.62)");
    v.fillStyle = vg;
    v.fillRect(0, 0, U.W, U.H);

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

    SV.earth.init();
    SV.cosmos.init();
    SV.tech.init();
    SV.travel.init();
    SV.lockup.init();
  };

  function reset(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.filter = "none";
    ctx.letterSpacing = "0px";
    ctx.setLineDash([]);
  }

  function scene(ctx, which, t) {
    reset(ctx);
    ctx.save();
    if (which === "cosmos") {
      // bass-impact camera shake at 3.0 s
      const k = U.range(t, 3.0, 3.45);
      if (k > 0 && k < 1) {
        const amp = 7 * (1 - k) * (1 - k);
        ctx.translate(960, 540);
        ctx.scale(1.012, 1.012);
        ctx.translate(-960 + Math.sin(t * 90) * amp, -540 + Math.cos(t * 77) * amp);
      }
      SV.cosmos.draw(ctx, t);
    } else if (which === "tech") SV.tech.draw(ctx, t);
    else if (which === "travel") SV.travel.draw(ctx, t);
    else SV.lockup.draw(ctx, t);
    ctx.restore();
    reset(ctx);
  }

  function renderTo(ctx, t) {
    t = U.clamp(t, 0, I.DURATION);
    if (t < 5.8) {
      scene(ctx, "cosmos", t);
    } else if (t < 6.2) {
      // fast cinematic light sweep, left → right, revealing the tech scene
      const p = E.inOutCubic(U.range(t, 5.8, 6.2));
      scene(ctx, "cosmos", t);
      scene(bctx, "tech", t);
      const X = U.lerp(-450, 2370, p);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(X + 220, -10);
      ctx.lineTo(X - 220, 1090);
      ctx.lineTo(-10, 1090);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(bufB, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(X, 540);
      ctx.transform(1, 0, -0.4, 1, 0, 0); // match the slant of the clip edge
      const s = Math.sin(p * Math.PI);
      for (const [w, a] of [[420, 0.18], [120, 0.45], [18, 0.95]]) {
        const g = ctx.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, "rgba(0,150,255,0)");
        g.addColorStop(0.5, `rgba(200,240,255,${a * s})`);
        g.addColorStop(1, "rgba(0,150,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-w, -900, w * 2, 1800);
      }
      ctx.restore();
    } else if (t < 7.7) {
      scene(ctx, "tech", t);
    } else if (t < 8.25) {
      // upward light wipe: the sunset sky pours in from the top
      const p = E.inOutCubic(U.range(t, 7.7, 8.25));
      scene(ctx, "tech", t);
      scene(bctx, "travel", t);
      const edge = U.lerp(-250, 1330, p);
      bctx.save();
      bctx.globalCompositeOperation = "destination-in";
      const m = bctx.createLinearGradient(0, edge - 160, 0, edge + 160);
      m.addColorStop(0, "rgba(0,0,0,1)");
      m.addColorStop(1, "rgba(0,0,0,0)");
      bctx.fillStyle = m;
      bctx.fillRect(0, 0, U.W, U.H);
      bctx.restore();
      ctx.drawImage(bufB, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const s = Math.sin(p * Math.PI);
      const g = ctx.createLinearGradient(0, edge - 90, 0, edge + 90);
      g.addColorStop(0, "rgba(255,190,110,0)");
      g.addColorStop(0.5, `rgba(255,220,170,${0.55 * s})`);
      g.addColorStop(1, "rgba(0,200,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, edge - 90, U.W, 180);
      ctx.fillStyle = `rgba(255,245,225,${0.8 * s})`;
      ctx.fillRect(0, edge - 1, U.W, 2);
      ctx.restore();
    } else if (t < 9.8) {
      scene(ctx, "travel", t);
    } else if (t < 10.3) {
      // push into the sun: a soft golden bloom carries us to the lockup
      scene(ctx, "travel", t);
      scene(bctx, "lockup", t);
      ctx.globalAlpha = U.smoothstep(9.96, 10.24, t);
      ctx.drawImage(bufB, 0, 0);
      ctx.globalAlpha = 1;
      const k = Math.exp(-Math.pow((t - 10.0) / 0.12, 2)) * 0.62;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const sun = SV.travel.SUN;
      const g = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 1700);
      g.addColorStop(0, `rgba(255,250,235,${k})`);
      g.addColorStop(0.3, `rgba(255,200,130,${k * 0.7})`);
      g.addColorStop(1, `rgba(255,140,80,${k * 0.08})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, U.W, U.H);
      ctx.restore();
    } else {
      scene(ctx, "lockup", t);
    }

    // finishing: vignette, fine film grain, final fade to black
    reset(ctx);
    ctx.drawImage(vignette, 0, 0);
    const gi = grain[Math.floor(t * U.FPS) % grain.length];
    ctx.globalAlpha = 0.045;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = ctx.createPattern(gi, "repeat");
    ctx.fillRect(0, 0, U.W, U.H);
    reset(ctx);
    const fadeIn = 1 - U.range(t, 0, 0.35);
    const fadeOut = E.inOutSine(U.range(t, 11.45, 11.97));
    const black = Math.max(fadeIn, fadeOut);
    if (black > 0) {
      ctx.fillStyle = `rgba(0,0,0,${black})`;
      ctx.fillRect(0, 0, U.W, U.H);
    }
  }

  /** Render one frame at time t (seconds) into the main canvas. */
  I.renderAt = function (t) {
    renderTo(mctx, t);
  };

  /**
   * Render with true temporal motion blur: average `samples` sub-frames
   * spread over a 180° shutter (half a frame). Used by the MP4 exporter.
   */
  I.renderBlurred = function (t, samples = 1, shutter = 0.5) {
    if (samples <= 1) return I.renderAt(t);
    const dt = shutter / U.FPS;
    for (let k = 0; k < samples; k++) {
      const tk = t + (k / (samples - 1) - 0.5) * dt;
      renderTo(wctx, Math.max(0, tk));
      mctx.globalAlpha = 1 / (k + 1);
      mctx.drawImage(work, 0, 0);
    }
    mctx.globalAlpha = 1;
  };

  I.canvas = () => main;
})();
