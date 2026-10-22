/* Scene 4 (8–10 s): golden-hour mountain road with a drone-style push-in.
 * Technology blue in the upper sky blends into warm sunset gold at the horizon.
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const E = U.ease;
  const T = (SV.travel = {});

  const HY = 640; // horizon
  const SUN = { x: 1010, y: 610 };
  T.SUN = SUN;
  let ridges, clouds, trees, stars, cloudSprite, spark, sparkGold, ready = false;

  T.init = function () {
    if (ready) return;
    const r = U.rng(9001);
    // mountain layers, far → near
    const defs = [
      { base: HY + 2, amp: 230, freq: 0.0021, seed: 3, col: [92, 70, 120], rim: 0.9, haze: 0.55, par: 0.02 },
      { base: HY + 8, amp: 200, freq: 0.0032, seed: 7, col: [58, 44, 92], rim: 0.7, haze: 0.35, par: 0.05 },
      { base: HY + 26, amp: 150, freq: 0.0045, seed: 13, col: [32, 28, 64], rim: 0.5, haze: 0.18, par: 0.1 },
    ];
    ridges = defs.map((d) => {
      const pts = [];
      for (let x = -200; x <= 2120; x += 6) {
        let h = U.fbm1(x * d.freq + d.seed * 10, 6, d.seed);
        h = Math.pow(h, 1.6) * 2.2;
        // keep a valley where the road heads into the mountains
        const valley = 1 - 0.55 * Math.exp(-Math.pow((x - SUN.x) / 420, 2));
        pts.push([x, d.base - d.amp * h * valley]);
      }
      return Object.assign({ pts }, d);
    });
    clouds = [];
    for (let i = 0; i < 26; i++) {
      clouds.push({ x: r() * 2400 - 240, y: 160 + r() * 360, w: 260 + r() * 520, h: 30 + r() * 50, a: 0.25 + r() * 0.4, v: 8 + r() * 18 });
    }
    // pines along the near framing hills
    trees = [];
    for (let i = 0; i < 90; i++) {
      const left = i < 45;
      const u = r();
      const x = left ? u * 640 - 40 : 1300 + u * 680;
      trees.push({ x, h: 40 + r() * 70, left, u });
    }
    stars = [];
    for (let i = 0; i < 220; i++) stars.push({ x: r() * 1920, y: r() * 330, s: 0.6 + r() * 1.5, ph: r() * 6 });
    cloudSprite = (() => {
      const c = U.canvas(256, 128);
      const x = c.getContext("2d");
      const g = x.createRadialGradient(128, 64, 0, 128, 64, 128);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.5, "rgba(255,255,255,0.45)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.save();
      x.scale(1, 0.5);
      x.fillRect(0, 0, 256, 256);
      x.restore();
      return c;
    })();
    spark = U.glowSprite(64, 0, 210, 255);
    sparkGold = U.glowSprite(64, 255, 190, 100);
    ready = true;
  };

  function sky(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, HY);
    g.addColorStop(0, "#040b26");
    g.addColorStop(0.28, "#0f2a6a");
    g.addColorStop(0.55, "#4a3b86");
    g.addColorStop(0.75, "#c0587a");
    g.addColorStop(0.9, "#ff9a4d");
    g.addColorStop(1, "#ffd27a");
    ctx.fillStyle = g;
    ctx.fillRect(-200, -200, 2320, HY + 200);
    // faint stars still visible high up
    for (const s of stars) {
      const a = (1 - s.y / 330) * 0.5 * (0.6 + 0.4 * Math.sin(t * 2 + s.ph));
      ctx.fillStyle = `rgba(220,235,255,${a})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    // sun
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const sg = ctx.createRadialGradient(SUN.x, SUN.y, 0, SUN.x, SUN.y, 700);
    sg.addColorStop(0, "rgba(255,250,225,1)");
    sg.addColorStop(0.05, "rgba(255,225,150,0.95)");
    sg.addColorStop(0.18, "rgba(255,160,80,0.45)");
    sg.addColorStop(0.5, "rgba(220,90,90,0.12)");
    sg.addColorStop(1, "rgba(120,40,120,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(SUN.x - 700, SUN.y - 700, 1400, 1400);
    // light rays
    ctx.translate(SUN.x, SUN.y);
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI + ((i + 0.5) / 11) * Math.PI + Math.sin(t * 0.3 + i) * 0.02;
      const len = 800 + (i % 3) * 220;
      const rg = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
      rg.addColorStop(0, `rgba(255,210,140,${0.05 + 0.03 * (i % 2)})`);
      rg.addColorStop(1, "rgba(255,210,140,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.025) * len, Math.sin(a - 0.025) * len);
      ctx.lineTo(Math.cos(a + 0.025) * len, Math.sin(a + 0.025) * len);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawClouds(ctx, t) {
    ctx.save();
    for (const c of clouds) {
      const x = ((c.x + c.v * t) % 2400) - 240;
      const warm = U.clamp(c.y / 520);
      // underside lit gold, tops cool lilac
      ctx.globalAlpha = c.a * 0.55;
      ctx.drawImage(tint(warm), x, c.y, c.w, c.h);
    }
    ctx.restore();
  }
  const tintCache = {};
  function tint(w) {
    const k = Math.round(w * 8);
    if (tintCache[k]) return tintCache[k];
    const c = U.canvas(256, 128);
    const x = c.getContext("2d");
    x.drawImage(cloudSprite, 0, 0);
    x.globalCompositeOperation = "source-in";
    const r = U.lerp(150, 255, k / 8), g = U.lerp(130, 170, k / 8), b = U.lerp(200, 110, k / 8);
    const gr = x.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, `rgb(${r * 0.7},${g * 0.7},${b})`);
    gr.addColorStop(1, `rgb(${r},${g},${b * 0.8})`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 256, 128);
    tintCache[k] = c;
    return c;
  }

  function drawRidges(ctx, push) {
    for (const d of ridges) {
      const s = 1 + (push - 1) * (0.4 + d.par * 6);
      ctx.save();
      ctx.translate(SUN.x, HY);
      ctx.scale(s, s);
      ctx.translate(-SUN.x, -HY);
      ctx.beginPath();
      ctx.moveTo(-200, HY + 200);
      for (const [x, y] of d.pts) ctx.lineTo(x, y);
      ctx.lineTo(2120, HY + 200);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, d.base - d.amp, 0, d.base);
      const [r, gg, b] = d.col;
      g.addColorStop(0, `rgb(${r},${gg},${b})`);
      g.addColorStop(1, `rgb(${r * 0.6 + 120 * d.haze},${gg * 0.6 + 70 * d.haze},${b * 0.7 + 60 * d.haze})`);
      ctx.fillStyle = g;
      ctx.fill();
      // golden rim light, strongest near the sun
      const rg = ctx.createRadialGradient(SUN.x, SUN.y, 0, SUN.x, SUN.y, 1100);
      rg.addColorStop(0, `rgba(255,215,140,${d.rim})`);
      rg.addColorStop(0.5, `rgba(255,160,90,${d.rim * 0.35})`);
      rg.addColorStop(1, "rgba(255,140,90,0)");
      ctx.strokeStyle = rg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [x, y] of d.pts) ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    }
    // valley mist
    const mg = ctx.createLinearGradient(0, HY - 90, 0, HY + 40);
    mg.addColorStop(0, "rgba(255,170,120,0)");
    mg.addColorStop(0.7, "rgba(255,170,130,0.28)");
    mg.addColorStop(1, "rgba(120,90,140,0.0)");
    ctx.fillStyle = mg;
    ctx.fillRect(-200, HY - 90, 2320, 130);
  }

  // ---------- road ----------
  const F = 900, CAM_H = 1.5;
  const roadX = (zw) => 2.8 * Math.sin(zw * 0.045 + 0.8) + 1.6 * Math.sin(zw * 0.11 + 2.0);

  function drawGround(ctx) {
    const g = ctx.createLinearGradient(0, HY, 0, 1080);
    g.addColorStop(0, "#2a2140");
    g.addColorStop(0.15, "#141530");
    g.addColorStop(1, "#05070f");
    ctx.fillStyle = g;
    ctx.fillRect(-200, HY, 2320, 1080 - HY + 200);
  }

  function drawRoad(ctx, t) {
    const camZ = t * 9;
    const camX = roadX(camZ + 4);
    const proj = (zw, off) => {
      const z = zw - camZ;
      return { x: 960 + ((roadX(zw) + off - camX) / z) * F, y: HY + (CAM_H / z) * F, z };
    };
    const zs = [];
    for (let z = 2.2; z < 140; z *= 1.045) zs.push(z);
    const HW = 1.25;
    // asphalt, far → near
    for (let i = zs.length - 1; i > 0; i--) {
      const z1 = camZ + zs[i], z0 = camZ + zs[i - 1];
      const a = proj(z1, -HW), b = proj(z1, HW), c = proj(z0, HW), d = proj(z0, -HW);
      const fog = U.clamp(zs[i] / 140);
      // sheen toward the sun
      const r = U.lerp(22, 150, fog * fog), g = U.lerp(22, 90, fog * fog), bb = U.lerp(38, 100, fog * fog);
      ctx.fillStyle = `rgb(${r},${g},${bb})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
      // edge lines
      ctx.strokeStyle = `rgba(255,220,170,${0.55 * (1 - fog)})`;
      ctx.lineWidth = Math.max(0.6, 8 / zs[i]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(d.x, d.y);
      ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y);
      ctx.stroke();
      // centre dashes (world-anchored so they stream past)
      if (U.fract(z1 / 3.2) < 0.45) {
        const m1 = proj(z1, 0), m0 = proj(z0, 0);
        ctx.strokeStyle = `rgba(255,214,140,${0.9 * (1 - fog)})`;
        ctx.lineWidth = Math.max(0.6, 14 / zs[i]);
        ctx.beginPath();
        ctx.moveTo(m1.x, m1.y);
        ctx.lineTo(m0.x, m0.y);
        ctx.stroke();
      }
    }
    // long-exposure light trails along both lanes
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const trails = [
      { off: -0.6, sp: -22, ph: 0, col: [0, 229, 255] },
      { off: 0.6, sp: 30, ph: 25, col: [255, 196, 110] },
      { off: -0.75, sp: -18, ph: 60, col: [80, 170, 255] },
      { off: 0.75, sp: 26, ph: 85, col: [255, 160, 80] },
    ];
    for (const tr of trails) {
      const head = camZ + 2.4 + U.fract((tr.ph + t * tr.sp) / 60) * 60;
      const len = 16;
      ctx.lineCap = "round";
      for (let k = 0; k < 24; k++) {
        const za = head - (k / 24) * len * Math.sign(tr.sp);
        const zb = head - ((k + 1) / 24) * len * Math.sign(tr.sp);
        if (za - camZ < 2.3 || zb - camZ < 2.3) continue;
        const p = proj(za, tr.off), q = proj(zb, tr.off);
        const fade = (1 - k / 24) * (1 - U.clamp((za - camZ) / 70));
        ctx.strokeStyle = U.rgba(tr.col[0], tr.col[1], tr.col[2], 0.9 * fade);
        ctx.lineWidth = Math.max(1.2, 30 / (za - camZ));
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawNearHills(ctx, t) {
    ctx.save();
    for (const left of [true, false]) {
      ctx.beginPath();
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        const x = left ? U.lerp(-60, 720, u) : U.lerp(2000, 1240, u);
        const y = U.lerp(left ? 690 : 680, 1000, Math.pow(u, 1.8)) - 30 * U.fbm1(u * 4 + (left ? 0 : 9), 3, 5);
        pts.push([x, y]);
      }
      ctx.moveTo(left ? -60 : 2000, 1200);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(left ? 720 : 1240, 1200);
      ctx.closePath();
      ctx.fillStyle = "#070a1a";
      ctx.fill();
      // warm rim
      ctx.strokeStyle = "rgba(255,170,100,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.stroke();
      // pines on the ridge
      for (const tr of trees) {
        if (tr.left !== left) continue;
        const u = tr.u;
        const i = Math.min(59, Math.floor(u * 60));
        const [x, y] = pts[i];
        const sway = Math.sin(t * 1.2 + tr.x) * 1.5;
        const h = tr.h * (0.6 + u * 0.8);
        ctx.fillStyle = "#060816";
        ctx.beginPath();
        ctx.moveTo(x - h * 0.22, y + 4);
        ctx.lineTo(x + sway, y - h);
        ctx.lineTo(x + h * 0.22, y + 4);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  T.draw = function (ctx, t) {
    T.init();
    const lt = U.range(t, 7.7, 10.3);
    const push = 1 + 0.16 * E.inOutSine(lt);
    ctx.save();
    // drone push-in toward the sun / road vanishing point
    ctx.translate(SUN.x, HY - 20);
    ctx.scale(push, push);
    ctx.translate(-SUN.x, -(HY - 20) + U.lerp(30, -10, lt));
    sky(ctx, t);
    drawClouds(ctx, t);
    drawRidges(ctx, push);
    drawGround(ctx);
    drawRoad(ctx, t);
    drawNearHills(ctx, t);
    ctx.restore();

    // tech-palette sweeping light trails across the sky
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const q = U.range(t, 8.0 + i * 0.35, 9.4 + i * 0.35);
      if (q <= 0 || q >= 1) continue;
      const x0 = U.lerp(-300, 2300, E.inOutCubic(q));
      const yy = 120 + i * 70;
      const g = ctx.createLinearGradient(x0 - 700, 0, x0, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, i === 1 ? "rgba(255,210,140,0.7)" : "rgba(0,229,255,0.65)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x0 - 700, yy + 60);
      ctx.quadraticCurveTo(x0 - 350, yy - 30, x0, yy);
      ctx.stroke();
      ctx.drawImage(i === 1 ? sparkGold : spark, x0 - 20, yy - 20, 40, 40);
    }
    ctx.restore();

    // caption
    const ca = E.outCubic(U.range(t, 8.35, 8.9)) * (1 - U.range(t, 9.7, 9.95));
    SV.brand.drawSpaced(ctx, "EXPLORE THE WORLD", 960, 300, 38, 16, "#fff3dc", ca, 700);
    SV.brand.drawSpaced(ctx, "ROAD TRIPS  •  ADVENTURE  •  LIFESTYLE", 960, 345, 17, 7, "#ffd27a", ca * 0.95, 600);

    SV.brand.drawBug(ctx, 1);
  };
})();
