/* Scene 5 (10–12 s): final brand lockup and fade to black. */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const E = U.ease;
  const B = SV.brand;
  const L = (SV.lockup = {});

  const LX = 960, LY = 365, RING = 150;
  let motes, spark, ready = false;

  L.init = function () {
    if (ready) return;
    const r = U.rng(777);
    motes = [];
    for (let i = 0; i < 90; i++) {
      motes.push({ x: r() * 1920, y: r() * 1080, s: 3 + r() * 12, v: 6 + r() * 16, ph: r() * U.TAU, gold: r() < 0.25 });
    }
    spark = U.glowSprite(64, 40, 170, 255);
    ready = true;
  };

  // fade + slight upward rise
  function rise(t, t0, dur = 0.6) {
    const p = E.outCubic(U.range(t, t0, t0 + dur));
    return { a: p, dy: (1 - p) * 36 };
  }

  L.draw = function (ctx, t) {
    L.init();
    const bg = ctx.createRadialGradient(LX, 470, 0, LX, 540, 1250);
    bg.addColorStop(0, "#0b2350");
    bg.addColorStop(0.4, "#051230");
    bg.addColorStop(1, "#01030a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1920, 1080);

    // warm horizon memory of the sunset, fading out
    const warm = 1 - E.inOutSine(U.range(t, 9.9, 10.9));
    if (warm > 0) {
      const wg = ctx.createRadialGradient(1010, 640, 0, 1010, 640, 900);
      wg.addColorStop(0, `rgba(255,190,110,${0.45 * warm})`);
      wg.addColorStop(1, "rgba(255,120,80,0)");
      ctx.fillStyle = wg;
      ctx.fillRect(0, 0, 1920, 1080);
    }

    // drifting particles
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of motes) {
      const y = ((m.y - m.v * t) % 1080 + 1080) % 1080;
      ctx.globalAlpha = 0.18 + 0.15 * Math.sin(t * 1.7 + m.ph);
      ctx.drawImage(spark, m.x - m.s, y - m.s, m.s * 2, m.s * 2);
    }
    ctx.restore();

    // subtle floor reflection line
    ctx.save();
    const fl = ctx.createLinearGradient(360, 0, 1560, 0);
    fl.addColorStop(0, "rgba(0,229,255,0)");
    fl.addColorStop(0.5, `rgba(0,229,255,${0.25 * U.range(t, 10.3, 10.9)})`);
    fl.addColorStop(1, "rgba(0,229,255,0)");
    ctx.fillStyle = fl;
    ctx.fillRect(360, 930, 1200, 1);
    ctx.restore();

    // logo + ring
    const lg = rise(t, 9.95, 0.7);
    const sc = 0.9 * U.lerp(1.12, 1, E.outCubic(U.range(t, 9.95, 10.8)));
    ctx.save();
    ctx.translate(0, lg.dy);
    ctx.globalAlpha = lg.a;
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(LX, LY);
    const ringP = E.inOutCubic(U.range(t, 10.05, 10.8));
    ctx.shadowColor = "rgba(0,200,255,0.9)";
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "rgba(90,200,255,0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, RING, -Math.PI / 2, -Math.PI / 2 + U.TAU * ringP);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(245,197,107,0.55)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a0 = t * 0.5 + (i * U.TAU) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, RING + 16, a0, a0 + 0.9 * ringP);
      ctx.stroke();
    }
    ctx.restore();

    const sway = Math.sin(t * 1.3) * 0.12 * (1 - U.range(t, 10.8, 11.3));
    const shine = t >= 10.9 && t <= 11.5 ? U.range(t, 10.9, 11.5) : -1;
    B.drawS(ctx, LX, LY + lg.dy, sc, sway, { alpha: lg.a, glow: 0.9, line: 1, dashOffset: t * 30, shine });

    // wordmark
    const w = rise(t, 10.2);
    B.drawWordmark(ctx, LX, 690 + w.dy, 116, w.a, t >= 11.0 && t <= 11.6 ? U.range(t, 11.0, 11.6) : -1);

    const tg = rise(t, 10.42);
    B.drawSpaced(ctx, "EXPLORE. LEARN. CREATE.", LX, 762 + tg.dy, 28, 14, "#d7ebff", tg.a, 600);

    // gold divider
    const dv = E.outCubic(U.range(t, 10.55, 11.1));
    if (dv > 0) {
      ctx.save();
      const half = 220 * dv;
      const dg = ctx.createLinearGradient(LX - half, 0, LX + half, 0);
      dg.addColorStop(0, "rgba(245,197,107,0)");
      dg.addColorStop(0.5, "rgba(245,197,107,0.9)");
      dg.addColorStop(1, "rgba(245,197,107,0)");
      ctx.fillStyle = dg;
      ctx.fillRect(LX - half, 795, half * 2, 1.5);
      ctx.restore();
    }

    const cg = rise(t, 10.62);
    B.drawSpaced(ctx, "TECH • AI • TRAVEL • BEYOND", LX, 842 + cg.dy, 21, 9, "#f5c56b", cg.a, 600);
  };
})();
