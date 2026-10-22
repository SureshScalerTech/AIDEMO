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
  const reset = SV.resetCtx;
  let bctx, bufB;

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

  function draw(ctx, t, bufs) {
    bufB = bufs.b;
    bctx = bufs.bctx;
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
  }

  SV.intro = SV.createComp({
    name: "intro",
    duration: U.DURATION,
    fadeIn: 0.35,
    fadeOut: [11.45, 11.97],
    init: async () => {
      SV.earth.init();
      SV.cosmos.init();
      SV.tech.init();
      SV.travel.init();
      SV.lockup.init();
    },
    draw,
  });
})();
