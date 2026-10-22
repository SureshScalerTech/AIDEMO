/* Scenes 1 + 2 (0–6 s): space, Earth, energy beam, S emergence, ring, wordmark.
 * One continuous scene so the logo carries straight through without a cut.
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const B = SV.brand;
  const E = U.ease;

  const S = (SV.cosmos = {});

  const LOGO_X = 960, LOGO_Y = 400, RING_R = 178;
  const WORD_Y = 742, WORD_SIZE = 124, TAG_Y = 818;
  S.LOGO_X = LOGO_X; S.LOGO_Y = LOGO_Y;

  let stars, dust, conv, spark, sparkGold, beamSprite, ready = false;

  S.init = function () {
    if (ready) return;
    const r = U.rng(1337);
    stars = [];
    for (let i = 0; i < 1100; i++) {
      const z = r();
      stars.push({
        x: r() * 2200 - 140, y: r() * 1300 - 110,
        s: 0.4 + z * z * 2.0, z, ph: r() * U.TAU, sp: 0.6 + r() * 2.5,
        hue: r() < 0.12 ? 1 : r() < 0.2 ? 2 : 0,
      });
    }
    dust = [];
    for (let i = 0; i < 70; i++) {
      dust.push({ x: r() * 1920, y: r() * 1080, s: 10 + r() * 34, vx: -6 + r() * 12, vy: -14 - r() * 18, a: 0.05 + r() * 0.16, ph: r() * U.TAU });
    }
    spark = U.glowSprite(64, 60, 170, 255);
    // feathered beam trail: fades in toward the head, gaussian falloff vertically
    beamSprite = (() => {
      const w = 512, h = 128, cv = U.canvas(w, h), bx = cv.getContext("2d");
      const id = bx.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const dy = (y - h / 2) / (h / 2);
        const core = Math.exp(-dy * dy * 900), mid = Math.exp(-dy * dy * 60), wide = Math.exp(-dy * dy * 6);
        for (let x = 0; x < w; x++) {
          // head sits at x = 480 (of 512); a short soft falloff continues past it
          const fx = x <= 480 ? Math.pow(x / 480, 2.2) : Math.exp(-Math.pow((x - 480) / 10, 2));
          const o = (y * w + x) * 4;
          const a = Math.min(1, (core * 1.0 + mid * 0.45 + wide * 0.16) * fx);
          const white = core * fx;
          id.data[o] = 60 + 195 * white;
          id.data[o + 1] = 160 + 95 * white;
          id.data[o + 2] = 255;
          id.data[o + 3] = 255 * a;
        }
      }
      bx.putImageData(id, 0, 0);
      return cv;
    })();
    sparkGold = U.glowSprite(64, 255, 200, 120);

    // particles that converge into the wordmark: sample the text mask
    const wm = B.wordmark(WORD_SIZE);
    const mctx = wm.mask.getContext("2d");
    const data = mctx.getImageData(0, 0, wm.w, wm.h).data;
    const ox = LOGO_X - wm.w / 2, oy = WORD_Y - wm.base;
    conv = [];
    const step = 5;
    for (let y = 0; y < wm.h; y += step) {
      for (let x = 0; x < wm.w; x += step) {
        const o = (y * wm.w + x) * 4;
        if (data[o + 3] > 140 && r() < 0.62) {
          const cyan = data[o] < 128; // "Verse" was drawn in cyan in the mask
          const ang = r() * U.TAU;
          const rad = RING_R + 30 + r() * 380;
          conv.push({
            tx: ox + x, ty: oy + y,
            sx: LOGO_X + Math.cos(ang) * rad * 1.6, sy: LOGO_Y + Math.sin(ang) * rad * 0.9,
            d: (x / wm.w) * 0.55 + r() * 0.25, cyan, sz: 3 + r() * 5,
            curl: (r() - 0.5) * 380,
          });
        }
      }
    }
    ready = true;
  };

  function drawStars(ctx, t, alpha, drift) {
    ctx.save();
    for (const s of stars) {
      const tw = 0.65 + 0.35 * Math.sin(t * s.sp + s.ph);
      const a = alpha * tw * (0.25 + s.z * 0.75);
      if (a < 0.02) continue;
      const x = s.x - drift * (0.3 + s.z * 0.7) * 0.6;
      const y = s.y + drift * (0.3 + s.z * 0.7);
      ctx.fillStyle = s.hue === 1 ? `rgba(160,210,255,${a})` : s.hue === 2 ? `rgba(255,220,170,${a})` : `rgba(235,242,255,${a})`;
      ctx.fillRect(x, y, s.s, s.s);
      if (s.s > 1.9) {
        ctx.globalAlpha = a * 0.5;
        ctx.drawImage(spark, x - 8, y - 8, 18, 18);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawDust(ctx, t, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of dust) {
      const x = ((p.x + p.vx * t) % 1980 + 1980) % 1980 - 30;
      const y = ((p.y + p.vy * t) % 1140 + 1140) % 1140 - 30;
      ctx.globalAlpha = alpha * p.a * (0.6 + 0.4 * Math.sin(t * 1.3 + p.ph));
      ctx.drawImage(spark, x - p.s / 2, y - p.s / 2, p.s, p.s);
    }
    ctx.restore();
  }

  // Bright energy beam sweeping left → right across the logo line
  function drawBeam(ctx, t) {
    const p = U.range(t, 1.45, 2.35);
    if (p <= 0 || p >= 1) return;
    const head = U.lerp(-300, 2300, E.inOutCubic(p));
    const fade = Math.sin(p * Math.PI);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // trail
    ctx.globalAlpha = fade;
    ctx.drawImage(beamSprite, head - 1500, LOGO_Y - 160, 1600, 320);
    ctx.globalAlpha = 1;
    // head flare
    const hg = ctx.createRadialGradient(head, LOGO_Y, 0, head, LOGO_Y, 260);
    hg.addColorStop(0, `rgba(255,255,255,${fade})`);
    hg.addColorStop(0.15, `rgba(120,210,255,${0.7 * fade})`);
    hg.addColorStop(1, "rgba(20,90,255,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(head - 260, LOGO_Y - 260, 520, 520);
    ctx.restore();
  }

  // S rotation: one long decelerating spin from emergence to face-on
  function sAngle(t) {
    const p = U.range(t, 1.85, 3.9);
    return -2.5 * Math.PI * Math.pow(1 - p, 3);
  }

  function drawRing(ctx, t) {
    const p = E.inOutCubic(U.range(t, 3.0, 3.75));
    if (p <= 0) return;
    const rot = t * 0.6;
    ctx.save();
    ctx.translate(LOGO_X, LOGO_Y);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    // main ring, drawn on
    ctx.shadowColor = "rgba(0,200,255,0.9)";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "rgba(90,200,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, RING_R, -Math.PI / 2, -Math.PI / 2 + U.TAU * p);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // leading spark on the ring
    if (p < 1) {
      const a = -Math.PI / 2 + U.TAU * p;
      ctx.drawImage(spark, Math.cos(a) * RING_R - 40, Math.sin(a) * RING_R - 40, 80, 80);
    }
    // secondary rotating segments
    ctx.strokeStyle = `rgba(0,229,255,${0.55 * p})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a0 = rot + (i * U.TAU) / 3;
      ctx.beginPath();
      ctx.arc(0, 0, RING_R + 18, a0, a0 + 1.2 * p);
      ctx.stroke();
    }
    ctx.strokeStyle = `rgba(245,197,107,${0.5 * p})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a0 = -rot * 1.4 + (i * U.TAU) / 4;
      ctx.beginPath();
      ctx.arc(0, 0, RING_R - 16, a0, a0 + 0.5 * p);
      ctx.stroke();
    }
    // tick marks
    ctx.strokeStyle = `rgba(140,210,255,${0.35 * p})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * U.TAU + rot * 0.3;
      const l = i % 6 === 0 ? 10 : 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (RING_R + 30), Math.sin(a) * (RING_R + 30));
      ctx.lineTo(Math.cos(a) * (RING_R + 30 + l), Math.sin(a) * (RING_R + 30 + l));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShockwave(ctx, t) {
    const p = U.range(t, 3.0, 3.9);
    if (p <= 0 || p >= 1) return;
    const r = U.lerp(RING_R, 1300, E.outCubic(p));
    const a = (1 - p) * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(80,190,255,${a})`;
    ctx.lineWidth = U.lerp(14, 2, p);
    ctx.beginPath();
    ctx.ellipse(LOGO_X, LOGO_Y, r, r * 0.92, 0, 0, U.TAU);
    ctx.stroke();
    // impact flash (brief and soft)
    const f = Math.max(0, 1 - p * 4) * 0.55;
    if (f > 0) {
      const g = ctx.createRadialGradient(LOGO_X, LOGO_Y, 0, LOGO_X, LOGO_Y, 700);
      g.addColorStop(0, `rgba(200,235,255,${f})`);
      g.addColorStop(1, "rgba(20,80,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1920, 1080);
    }
    ctx.restore();
  }

  function drawConverge(ctx, t) {
    const t0 = 3.45;
    if (t < t0 || t > 5.2) return;
    const fadeOut = 1 - U.range(t, 4.75, 5.15);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const q of conv) {
      const p = U.range(t, t0 + q.d, t0 + q.d + 0.75);
      if (p <= 0) {
        // waiting particles orbit softly around the ring
        const a0 = U.range(t, t0, t0 + 0.2);
        ctx.globalAlpha = a0 * 0.18;
        ctx.drawImage(spark, q.sx - q.sz, q.sy - q.sz, q.sz * 2, q.sz * 2);
        continue;
      }
      const e = E.inOutCubic(p);
      const bend = Math.sin(e * Math.PI) * q.curl;
      const x = U.lerp(q.sx, q.tx, e) + bend * 0.3;
      const y = U.lerp(q.sy, q.ty, e) + bend * 0.15;
      const sz = U.lerp(q.sz * 2, 3.5, e);
      ctx.globalAlpha = fadeOut * (0.5 + 0.5 * e);
      ctx.drawImage(q.cyan ? spark : sparkGold, x - sz, y - sz, sz * 2, sz * 2);
      if (!q.cyan) {
        ctx.globalAlpha *= 0.5;
        ctx.drawImage(spark, x - sz, y - sz, sz * 2, sz * 2);
      }
    }
    ctx.restore();
  }

  S.draw = function (ctx, t) {
    S.init();
    // background
    const bg = ctx.createRadialGradient(700, 300, 0, 960, 540, 1400);
    bg.addColorStop(0, "#071430");
    bg.addColorStop(0.5, "#040a1c");
    bg.addColorStop(1, "#01030a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1920, 1080);

    const camDrift = t * 14;
    drawStars(ctx, t, E.outCubic(U.range(t, 0.05, 1.0)), camDrift);

    // Earth rises into view, then is dimmed for the logo
    const eIn = E.outCubic(U.range(t, 0.1, 3.3));
    SV.earth.draw(ctx, t, {
      dy: U.lerp(330, 0, eIn) - U.range(t, 3.3, 6) * 30,
      scale: U.lerp(1.0, 1.07, E.inOutSine(U.range(t, 0, 6))),
      alpha: E.outCubic(U.range(t, 0.15, 1.4)),
      sun: E.outCubic(U.range(t, 0.7, 2.6)) * (1 - 0.85 * U.range(t, 3.0, 4.2)),
    });
    const dim = 0.5 * E.inOutCubic(U.range(t, 2.8, 4.0));
    if (dim > 0) {
      const dg = ctx.createRadialGradient(LOGO_X, LOGO_Y + 120, 50, LOGO_X, LOGO_Y + 120, 900);
      dg.addColorStop(0, `rgba(2,6,18,${dim * 1.3})`);
      dg.addColorStop(1, `rgba(2,6,18,${dim * 0.6})`);
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, 1920, 1080);
    }
    drawDust(ctx, t, U.range(t, 0.3, 1.5));

    drawBeam(ctx, t);
    drawShockwave(ctx, t);
    drawRing(ctx, t);

    // the S emerges from the beam light
    const emerge = U.range(t, 1.85, 2.6);
    if (emerge > 0) {
      const th = sAngle(t);
      const omega = (sAngle(t + 1 / 60) - sAngle(t - 1 / 60)) * 30;
      const sc = U.lerp(0.55, 1.0, E.outCubic(U.range(t, 1.85, 3.2))) * (1 + 0.04 * E.outBack(U.range(t, 3.0, 3.5)) - 0.04 * U.range(t, 3.0, 3.5));
      const bob = Math.sin(t * 1.6) * 3 * U.range(t, 3.5, 4.5);
      B.drawSBlurred(ctx, LOGO_X, LOGO_Y + bob, sc, th, omega, {
        alpha: E.outCubic(emerge),
        glow: 0.6 + 0.4 * Math.max(0, 1 - Math.abs(t - 3.0) * 2),
        line: U.range(t, 3.1, 3.8),
        dashOffset: t * 30,
        shine: U.range(t, 5.15, 5.75) > 0 && t < 5.75 ? U.range(t, 5.15, 5.75) : -1,
      });
      // white-hot core flash as it is born from the beam
      const flash = Math.max(0, 1 - Math.abs(t - 1.95) / 0.35);
      if (flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const fg = ctx.createRadialGradient(LOGO_X, LOGO_Y, 0, LOGO_X, LOGO_Y, 380);
        fg.addColorStop(0, `rgba(255,255,255,${0.85 * flash})`);
        fg.addColorStop(0.3, `rgba(90,190,255,${0.35 * flash})`);
        fg.addColorStop(1, "rgba(20,80,255,0)");
        ctx.fillStyle = fg;
        ctx.fillRect(LOGO_X - 380, LOGO_Y - 380, 760, 760);
        ctx.restore();
      }
    }

    drawConverge(ctx, t);

    // wordmark resolves out of the converged particles
    const wA = E.inOutCubic(U.range(t, 4.35, 5.0));
    if (wA > 0) {
      const shine = t >= 5.2 && t <= 5.9 ? U.range(t, 5.2, 5.9) : -1;
      B.drawWordmark(ctx, LOGO_X, WORD_Y + (1 - wA) * 12, WORD_SIZE, wA, shine);
    }

    // tagline
    const tA = E.outCubic(U.range(t, 4.85, 5.45));
    if (tA > 0) {
      const sp = U.lerp(26, 14, E.outCubic(U.range(t, 4.85, 5.9)));
      B.drawSpaced(ctx, "EXPLORE. LEARN. CREATE.", LOGO_X, TAG_Y + (1 - tA) * 18, 30, sp, "#cfe6ff", tA, 600);
      // thin accent lines either side
      ctx.save();
      ctx.globalAlpha = tA * 0.7;
      const lw = 140 * E.outCubic(U.range(t, 5.0, 5.7));
      ctx.fillStyle = "rgba(0,229,255,0.8)";
      ctx.fillRect(LOGO_X - 450 - lw, TAG_Y - 11, lw, 1.5);
      ctx.fillRect(LOGO_X + 450, TAG_Y - 11, lw, 1.5);
      ctx.restore();
    }
  };
})();
