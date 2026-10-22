/* End screen / outro (15 s): "Thanks for watching", two video slots for
 * YouTube end-screen elements, and an animated Like → Subscribe → Bell call
 * to action next to the channel-icon slot.
 *
 *   0.0 – 1.4   background, brand row and headline assemble
 *   0.6 – 1.6   video slots slide in (WATCH NEXT / RECOMMENDED)
 *   1.4 – 2.2   subscribe row rises in
 *   2.5 – 5.6   cursor: like (2.9) → subscribe (3.8) → bell (4.7) → exits
 *   5.6 – 14.4  ambient hold (gentle pulses, bell reminders at 9 s and 12 s)
 *  14.45 – 15   fade to black
 *
 * Layout of the YouTube end-screen element slots, in 1920×1080 pixels
 * (also drawn as an overlay with ?guide=1):
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const E = U.ease;
  const B = SV.brand;

  const SLOTS = {
    videoA: { x: 200, y: 330, w: 680, h: 382 },
    videoB: { x: 1040, y: 330, w: 680, h: 382 },
    subscribe: { cx: 646, cy: 872, r: 92 },
  };
  const LIKE = { x: 778, y: 830, w: 136, h: 84 };
  const SUB = { x: 936, y: 830, w: 330, h: 84 };
  const BELL = { cx: 1330, cy: 872, r: 42 };

  const guide = new URLSearchParams(location.search).get("guide") === "1";
  let stars, motes, spark, sparkGold;

  function init() {
    const r = U.rng(2025);
    stars = [];
    for (let i = 0; i < 520; i++) stars.push({ x: r() * 1920, y: r() * 760, s: 0.5 + r() * 1.6, ph: r() * U.TAU, z: r() });
    motes = [];
    for (let i = 0; i < 70; i++) motes.push({ x: r() * 1920, y: r() * 1080, s: 3 + r() * 10, v: 8 + r() * 18, ph: r() * U.TAU, gold: r() < 0.3 });
    spark = U.glowSprite(64, 40, 170, 255);
    sparkGold = U.glowSprite(64, 255, 190, 100);
  }

  // ---------- background ----------
  function background(ctx, t) {
    const bg = ctx.createLinearGradient(0, 0, 0, 1080);
    bg.addColorStop(0, "#020713");
    bg.addColorStop(0.55, "#061738");
    bg.addColorStop(0.78, "#0b2550");
    bg.addColorStop(1, "#030914");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1920, 1080);

    // warm gold + cyan horizon glow behind the subscribe row
    const hg = ctx.createRadialGradient(960, 800, 0, 960, 800, 1000);
    hg.addColorStop(0, "rgba(255,180,100,0.16)");
    hg.addColorStop(0.35, "rgba(0,150,255,0.10)");
    hg.addColorStop(1, "rgba(0,60,160,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, 1920, 1080);

    for (const s of stars) {
      const a = (0.25 + 0.5 * s.z) * (0.6 + 0.4 * Math.sin(t * (1 + s.z * 2) + s.ph)) * (1 - s.y / 900);
      ctx.fillStyle = `rgba(220,235,255,${a})`;
      ctx.fillRect((s.x - t * 6 * s.z + 1920) % 1920, s.y, s.s, s.s);
    }

    // perspective grid floor
    const hy = 760;
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = -22; i <= 22; i++) {
      const g = ctx.createLinearGradient(0, hy, 0, 1080);
      g.addColorStop(0, "rgba(0,229,255,0)");
      g.addColorStop(1, "rgba(0,229,255,0.16)");
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(960 + i * 8, hy);
      ctx.lineTo(960 + i * 140, 1080);
      ctx.stroke();
    }
    for (let k = 0; k < 12; k++) {
      const z = 12 - ((k + t * 0.8) % 12);
      const y = hy + 320 / (z + 0.4);
      if (y > 1080) continue;
      ctx.strokeStyle = `rgba(0,229,255,${U.clamp((y - hy) / 320) * 0.22})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1920, y);
      ctx.stroke();
    }
    ctx.restore();

    // drifting light motes and slow sweeping trails
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of motes) {
      const y = ((m.y - m.v * t) % 1080 + 1080) % 1080;
      ctx.globalAlpha = 0.16 + 0.12 * Math.sin(t * 1.5 + m.ph);
      ctx.drawImage(m.gold ? sparkGold : spark, m.x - m.s, y - m.s, m.s * 2, m.s * 2);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const q = U.fract(t / 5 + i / 3);
      const x0 = U.lerp(-500, 2400, q);
      const yy = 760 + i * 26;
      const g = ctx.createLinearGradient(x0 - 600, 0, x0, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, i === 1 ? "rgba(255,200,120,0.5)" : "rgba(0,229,255,0.5)");
      ctx.fillStyle = g;
      ctx.fillRect(x0 - 600, yy, 600, 2);
    }
    ctx.restore();
  }

  // ---------- header ----------
  function header(ctx, t) {
    const a = E.outCubic(U.range(t, 0.25, 0.95));
    if (a > 0) {
      ctx.save();
      ctx.globalAlpha = a;
      B.drawS(ctx, 830, 92 + (1 - a) * 14, 0.2, Math.sin(t * 0.8) * 0.15, { glow: 0.6, line: 1, dashOffset: t * 30 });
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `800 40px ${U.FONT}`;
      ctx.letterSpacing = "1px";
      ctx.textBaseline = "middle";
      const wa = ctx.measureText(B.WORD_A).width;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,170,255,0.6)";
      ctx.shadowBlur = 16;
      ctx.fillText(B.WORD_A, 868, 96 + (1 - a) * 14);
      ctx.fillStyle = "#00e5ff";
      ctx.fillText(B.WORD_B, 868 + wa, 96 + (1 - a) * 14);
      ctx.restore();
    }
    const h = E.outCubic(U.range(t, 0.45, 1.25));
    const sp = U.lerp(26, 10, E.outCubic(U.range(t, 0.45, 1.8)));
    B.drawSpaced(ctx, "THANKS FOR WATCHING", 960, 205 + (1 - h) * 20, 58, sp, "#ffffff", h, 800);
    const sub = E.outCubic(U.range(t, 0.9, 1.6));
    B.drawSpaced(ctx, "KEEP EXPLORING  •  WATCH NEXT  •  SUBSCRIBE", 960, 258 + (1 - sub) * 12, 20, 6, "#f5c56b", sub, 600);
  }

  // ---------- video slots ----------
  function videoSlot(ctx, t, s, k, label, icon, seed) {
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = k;
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    const sc = U.lerp(0.9, 1, k);
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);

    // glass panel
    const g = ctx.createLinearGradient(s.x, s.y, s.x + s.w, s.y + s.h);
    g.addColorStop(0, "rgba(10,40,90,0.75)");
    g.addColorStop(1, "rgba(4,16,40,0.85)");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(0,150,255,0.35)";
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 16);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(0,229,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // shimmer sweep
    ctx.save();
    ctx.clip();
    const q = U.fract(t / 3.2 + seed);
    const x0 = U.lerp(s.x - 300, s.x + s.w + 300, q);
    const sg = ctx.createLinearGradient(x0 - 140, 0, x0 + 140, 0);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, "rgba(140,220,255,0.10)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.restore();

    // animated corner brackets
    const c = 30 + 6 * Math.sin(t * 2 + seed * 9);
    ctx.strokeStyle = "rgba(140,235,255,0.95)";
    ctx.lineWidth = 3;
    for (const [sx, sy] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const x = s.x + sx * s.w + (sx ? 10 : -10), y = s.y + sy * s.h + (sy ? 10 : -10);
      const dx = sx ? -1 : 1, dy = sy ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x + dx * c, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * c);
      ctx.stroke();
    }

    // play button
    const pulse = 1 + 0.06 * Math.sin(t * 3 + seed * 5);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "rgba(0,229,255,0.12)";
    ctx.strokeStyle = "rgba(160,240,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, U.TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,229,255,0.9)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(-16, -24);
    ctx.lineTo(28, 0);
    ctx.lineTo(-16, 24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // progress line + caption inside the slot
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(s.x + 30, s.y + s.h - 40, s.w - 60, 4);
    ctx.fillStyle = "rgba(0,229,255,0.9)";
    ctx.fillRect(s.x + 30, s.y + s.h - 40, (s.w - 60) * (0.25 + 0.5 * U.fract(t / 9 + seed)), 4);

    // label above the slot
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `700 24px ${U.FONT}`;
    ctx.letterSpacing = "6px";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,170,255,0.6)";
    ctx.shadowBlur = 12;
    ctx.fillText(label, s.x + 44, s.y - 22);
    ctx.shadowBlur = 0;
    icon(ctx, s.x + 18, s.y - 31);
    ctx.restore();
  }

  const playIcon = (ctx, x, y) => {
    ctx.fillStyle = "#00e5ff";
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 9);
    ctx.lineTo(x + 9, y);
    ctx.lineTo(x - 6, y + 9);
    ctx.closePath();
    ctx.fill();
  };
  const starIcon = (ctx, x, y) => {
    ctx.fillStyle = "#f5c56b";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 4.5 : 11;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  };

  // ---------- subscribe row ----------
  function thumb(ctx, x, y, s, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.roundRect(-20, -2, 9, 22, 2);
    ctx.moveTo(-8, 0);
    ctx.lineTo(-1, -9);
    ctx.lineTo(1, -20);
    ctx.quadraticCurveTo(9, -21, 8, -10);
    ctx.lineTo(6, -3);
    ctx.lineTo(18, -3);
    ctx.quadraticCurveTo(24, -2, 22, 4);
    ctx.lineTo(18, 16);
    ctx.quadraticCurveTo(16, 20, 11, 20);
    ctx.lineTo(-8, 20);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.restore();
  }

  function bellIcon(ctx, x, y, s, rot, fill) {
    ctx.save();
    ctx.translate(x, y - 14 * s);
    ctx.rotate(rot);
    ctx.translate(0, 14 * s);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(-14, 8);
    ctx.lineTo(-11, 4);
    ctx.lineTo(-11, -6);
    ctx.quadraticCurveTo(-11, -18, 0, -19);
    ctx.quadraticCurveTo(11, -18, 11, -6);
    ctx.lineTo(11, 4);
    ctx.lineTo(14, 8);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.6;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 12, 4, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -21, 2.5, 0, U.TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
  }

  function press(t, at) {
    // 0 → 1 → 0 dip over 0.2 s around a click
    const p = U.range(t, at - 0.05, at + 0.18);
    return p > 0 && p < 1 ? Math.sin(p * Math.PI) : 0;
  }

  function ripple(ctx, x, y, t, at, col) {
    const p = U.range(t, at, at + 0.7);
    if (p <= 0 || p >= 1) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(${col},${(1 - p) * 0.9})`;
    ctx.lineWidth = 3 * (1 - p) + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 20 + 110 * E.outCubic(p), 0, U.TAU);
    ctx.stroke();
    ctx.restore();
  }

  const CLICK = { like: 2.9, sub: 3.8, bell: 4.7 };

  function subscribeRow(ctx, t) {
    const k = E.outCubic(U.range(t, 1.4, 2.2));
    if (k <= 0) return;
    ctx.save();
    ctx.translate(0, (1 - k) * 40);
    ctx.globalAlpha = k;

    // channel-icon slot: logo inside a rotating energy ring
    const S0 = SLOTS.subscribe;
    const breathe = 1 + 0.03 * Math.sin(t * 2.2);
    ctx.save();
    ctx.fillStyle = "rgba(4,16,40,0.9)";
    ctx.beginPath();
    ctx.arc(S0.cx, S0.cy, S0.r, 0, U.TAU);
    ctx.fill();
    ctx.shadowColor = "rgba(0,200,255,0.9)";
    ctx.shadowBlur = 22;
    ctx.strokeStyle = "rgba(90,200,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(S0.cx, S0.cy, S0.r * breathe, 0, U.TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(245,197,107,0.7)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a0 = t * 0.8 + (i * U.TAU) / 3;
      ctx.beginPath();
      ctx.arc(S0.cx, S0.cy, S0.r + 14, a0, a0 + 0.9);
      ctx.stroke();
    }
    ctx.restore();
    B.drawS(ctx, S0.cx, S0.cy, 0.48, Math.sin(t * 0.9) * 0.2, { glow: 0.7, line: 1, dashOffset: t * 30, alpha: k });

    // LIKE
    const liked = t >= CLICK.like;
    const lp = press(t, CLICK.like);
    const pop = liked ? E.outBack(U.range(t, CLICK.like, CLICK.like + 0.35)) : 0;
    ctx.save();
    const lcx = LIKE.x + LIKE.w / 2, lcy = LIKE.y + LIKE.h / 2;
    ctx.translate(lcx, lcy);
    ctx.scale(1 - lp * 0.08, 1 - lp * 0.08);
    ctx.translate(-lcx, -lcy);
    ctx.fillStyle = liked ? "rgba(0,170,255,0.35)" : "rgba(255,255,255,0.08)";
    ctx.strokeStyle = liked ? "rgba(0,229,255,0.9)" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(LIKE.x, LIKE.y, LIKE.w, LIKE.h, 42);
    ctx.fill();
    ctx.stroke();
    const ts = 1.15 + 0.35 * Math.sin(pop * Math.PI) * (pop < 1 ? 1 : 0);
    thumb(ctx, lcx, lcy - 2, ts, liked ? "#00e5ff" : null);
    ctx.restore();
    ripple(ctx, lcx, lcy, t, CLICK.like, "0,229,255");

    // SUBSCRIBE → SUBSCRIBED
    const subbed = t >= CLICK.sub;
    const sp = press(t, CLICK.sub);
    const scx = SUB.x + SUB.w / 2, scy = SUB.y + SUB.h / 2;
    ctx.save();
    ctx.translate(scx, scy);
    ctx.scale(1 - sp * 0.06, 1 - sp * 0.06);
    ctx.translate(-scx, -scy);
    const glowPulse = subbed ? 0 : 0.5 + 0.5 * Math.sin(t * 5);
    ctx.shadowColor = subbed ? "rgba(0,0,0,0)" : `rgba(255,60,60,${0.4 + 0.4 * glowPulse})`;
    ctx.shadowBlur = subbed ? 0 : 30;
    if (subbed) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
    } else {
      const rg = ctx.createLinearGradient(0, SUB.y, 0, SUB.y + SUB.h);
      rg.addColorStop(0, "#ff3b3b");
      rg.addColorStop(1, "#d6141b");
      ctx.fillStyle = rg;
    }
    ctx.beginPath();
    ctx.roundRect(SUB.x, SUB.y, SUB.w, SUB.h, 42);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (subbed) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.font = `800 30px ${U.FONT}`;
    ctx.letterSpacing = "3px";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    if (subbed) {
      const ca = U.range(t, CLICK.sub, CLICK.sub + 0.25);
      ctx.globalAlpha *= ca;
      ctx.font = `800 27px ${U.FONT}`;
      ctx.fillText("SUBSCRIBED", scx + 24, scy + 1);
      // check mark
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(SUB.x + 30, scy);
      ctx.lineTo(SUB.x + 40, scy + 10);
      ctx.lineTo(SUB.x + 58, scy - 10);
      ctx.stroke();
    } else {
      ctx.fillText("SUBSCRIBE", scx + 1.5, scy + 1);
    }
    ctx.restore();
    ripple(ctx, scx, scy, t, CLICK.sub, "255,120,120");

    // confetti burst of brand-coloured sparks on subscribe
    const bp = U.range(t, CLICK.sub, CLICK.sub + 1.1);
    if (bp > 0 && bp < 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const r = U.rng(77);
      for (let i = 0; i < 26; i++) {
        const a = r() * U.TAU, v = 140 + r() * 220;
        const x = scx + Math.cos(a) * v * E.outCubic(bp);
        const y = scy + Math.sin(a) * v * E.outCubic(bp) * 0.6 + 120 * bp * bp;
        ctx.globalAlpha = (1 - bp) * 0.9;
        ctx.drawImage(i % 3 ? spark : sparkGold, x - 9, y - 9, 18, 18);
      }
      ctx.restore();
    }

    // BELL
    const belled = t >= CLICK.bell;
    const bpress = press(t, CLICK.bell);
    const ringAt = [CLICK.bell, 9.0, 12.0].filter((s) => t >= s).pop();
    const rp = ringAt != null ? U.range(t, ringAt, ringAt + 0.9) : 1;
    const rot = rp < 1 ? Math.sin(rp * Math.PI * 7) * 0.45 * (1 - rp) : 0;
    ctx.save();
    ctx.translate(BELL.cx, BELL.cy);
    ctx.scale(1 - bpress * 0.08, 1 - bpress * 0.08);
    ctx.translate(-BELL.cx, -BELL.cy);
    ctx.fillStyle = belled ? "rgba(245,197,107,0.25)" : "rgba(255,255,255,0.08)";
    ctx.strokeStyle = belled ? "rgba(245,197,107,0.9)" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(BELL.cx, BELL.cy, BELL.r, 0, U.TAU);
    ctx.fill();
    ctx.stroke();
    bellIcon(ctx, BELL.cx, BELL.cy + 2, 1.05, rot, belled ? "#f5c56b" : null);
    // sound waves while ringing
    if (rp < 1 && belled) {
      ctx.strokeStyle = `rgba(245,197,107,${1 - rp})`;
      ctx.lineWidth = 2.5;
      for (const side of [-1, 1]) {
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          ctx.arc(BELL.cx, BELL.cy - 2, BELL.r + 10 + j * 10, side < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, side < 0 ? Math.PI * 1.2 : Math.PI * 0.2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    ripple(ctx, BELL.cx, BELL.cy, t, CLICK.bell, "245,197,107");

    // caption under the row
    const ca = E.outCubic(U.range(t, 2.0, 2.6));
    B.drawSpaced(ctx, "LIKE  •  SUBSCRIBE  •  TURN ON NOTIFICATIONS", 960, 1000, 17, 6, "#cfe6ff", ca * 0.85, 600);
    ctx.restore();
  }

  // ---------- cursor ----------
  function cursorPos(t) {
    // keyframes: [time, x, y]
    const K = [
      [2.45, 1500, 1120],
      [2.85, LIKE.x + 74, LIKE.y + 50],
      [3.15, LIKE.x + 74, LIKE.y + 50],
      [3.75, SUB.x + 190, SUB.y + 52],
      [4.1, SUB.x + 190, SUB.y + 52],
      [4.65, BELL.cx + 6, BELL.cy + 8],
      [5.0, BELL.cx + 6, BELL.cy + 8],
      [5.6, 1620, 1130],
    ];
    if (t <= K[0][0]) return { x: K[0][1], y: K[0][2] };
    for (let i = 0; i < K.length - 1; i++) {
      const [t0, x0, y0] = K[i], [t1, x1, y1] = K[i + 1];
      if (t <= t1) {
        const p = E.inOutCubic(U.range(t, t0, t1));
        return { x: U.lerp(x0, x1, p), y: U.lerp(y0, y1, p) - Math.sin(p * Math.PI) * 30 };
      }
    }
    return null;
  }

  function cursor(ctx, t) {
    if (t < 2.45 || t > 5.6) return;
    const p = cursorPos(t);
    if (!p) return;
    const clk = Math.max(press(t, CLICK.like), press(t, CLICK.sub), press(t, CLICK.bell));
    const s = 1.6 * (1 - clk * 0.15);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(s, s);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 26);
    ctx.lineTo(6.5, 20);
    ctx.lineTo(11, 30);
    ctx.lineTo(15, 28);
    ctx.lineTo(10.5, 18.5);
    ctx.lineTo(19, 18.5);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.strokeStyle = "#0a1a33";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();
  }

  // ---------- placement guide (?guide=1) ----------
  function drawGuide(ctx) {
    ctx.save();
    ctx.setLineDash([12, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ff00aa";
    ctx.fillStyle = "rgba(255,0,170,0.12)";
    ctx.font = `700 22px ${U.FONT}`;
    for (const [name, s] of Object.entries(SLOTS)) {
      ctx.beginPath();
      if (s.r) ctx.arc(s.cx, s.cy, s.r, 0, U.TAU);
      else ctx.rect(s.x, s.y, s.w, s.h);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff66cc";
      ctx.fillText(name, s.r ? s.cx - s.r : s.x + 10, s.r ? s.cy - s.r - 12 : s.y + s.h + 30);
      ctx.fillStyle = "rgba(255,0,170,0.12)";
    }
    ctx.restore();
  }

  function draw(ctx, t) {
    background(ctx, t);
    header(ctx, t);
    videoSlot(ctx, t, SLOTS.videoA, E.outCubic(U.range(t, 0.6, 1.4)), "WATCH NEXT", playIcon, 0.1);
    videoSlot(ctx, t, SLOTS.videoB, E.outCubic(U.range(t, 0.8, 1.6)), "RECOMMENDED", starIcon, 0.55);
    subscribeRow(ctx, t);
    cursor(ctx, t);
    if (guide) drawGuide(ctx);
  }

  SV.outro = SV.createComp({
    name: "outro",
    duration: 15,
    fadeIn: 0.5,
    fadeOut: [14.45, 14.97],
    init,
    draw,
  });
  SV.outro.SLOTS = SLOTS;
})();
