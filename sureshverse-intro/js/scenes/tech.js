/* Scene 3 (6–8 s): holographic technology showcase.
 * Original, generic iconography only — cloud, AI chip, agent, automation.
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const E = U.ease;
  const T = (SV.tech = {});

  const T0 = 6.0; // scene start
  let nodes, edges, motes, spark, ready = false;

  T.init = function () {
    if (ready) return;
    const r = U.rng(4242);
    // neural "globe": nodes on a fibonacci sphere + inner layers
    nodes = [];
    const N = 70;
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      nodes.push({ x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, r: 1 });
    }
    for (let i = 0; i < 22; i++) {
      const a = r() * U.TAU, b = Math.acos(2 * r() - 1), rr = 0.25 + r() * 0.45;
      nodes.push({ x: Math.sin(b) * Math.cos(a) * rr, y: Math.cos(b) * rr, z: Math.sin(b) * Math.sin(a) * rr, r: 0.6 });
    }
    edges = [];
    for (let i = 0; i < nodes.length; i++) {
      const d = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const a = nodes[i], b = nodes[j];
        d.push([Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), j]);
      }
      d.sort((p, q) => p[0] - q[0]);
      for (let k = 0; k < 3; k++) if (i < d[k][1]) edges.push({ a: i, b: d[k][1], ph: r(), sp: 0.6 + r() * 1.2 });
    }
    motes = [];
    for (let i = 0; i < 140; i++) motes.push({ x: r() * 1920, y: r() * 1080, s: 2 + r() * 7, v: 20 + r() * 60, ph: r() * U.TAU });
    spark = U.glowSprite(64, 0, 200, 255);
    ready = true;
  };

  function project(p, rotY, rotX, cx, cy, R) {
    let x = p.x * Math.cos(rotY) - p.z * Math.sin(rotY);
    let z = p.x * Math.sin(rotY) + p.z * Math.cos(rotY);
    let y = p.y * Math.cos(rotX) - z * Math.sin(rotX);
    z = p.y * Math.sin(rotX) + z * Math.cos(rotX);
    const f = 3.2 / (3.2 + z);
    return { x: cx + x * R * f, y: cy + y * R * f, z, f };
  }

  function drawGrid(ctx, t) {
    const hy = 600; // horizon
    ctx.save();
    const fg = ctx.createLinearGradient(0, hy, 0, 1080);
    fg.addColorStop(0, "rgba(0,120,255,0.0)");
    fg.addColorStop(1, "rgba(0,60,160,0.25)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, hy, 1920, 480);
    ctx.lineWidth = 1.2;
    // longitudinal lines converge to the vanishing point
    for (let i = -24; i <= 24; i++) {
      const x = 960 + i * 150;
      const g = ctx.createLinearGradient(0, hy, 0, 1080);
      g.addColorStop(0, "rgba(0,229,255,0)");
      g.addColorStop(1, "rgba(0,229,255,0.35)");
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.moveTo(960 + i * 6, hy);
      ctx.lineTo(x, 1080);
      ctx.stroke();
    }
    // transverse lines scroll toward the camera
    const speed = 1.6;
    for (let k = 0; k < 18; k++) {
      const z = 18 - ((k + t * speed) % 18);
      const y = hy + 480 / (z + 0.6) * 1.0;
      if (y > 1080 || y < hy) continue;
      const a = U.clamp((y - hy) / 480) * 0.5;
      ctx.strokeStyle = `rgba(0,229,255,${a})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1920, y);
      ctx.stroke();
    }
    // horizon glow
    const hg = ctx.createLinearGradient(0, hy - 60, 0, hy + 60);
    hg.addColorStop(0, "rgba(0,160,255,0)");
    hg.addColorStop(0.5, "rgba(60,190,255,0.35)");
    hg.addColorStop(1, "rgba(0,160,255,0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, hy - 60, 1920, 120);
    ctx.restore();
  }

  function drawNeural(ctx, t, lt) {
    const cx = 960, cy = 470, R = 230 * E.outCubic(U.range(lt, 0.0, 0.6));
    if (R < 1) return;
    const rotY = t * 0.55, rotX = 0.35 + Math.sin(t * 0.4) * 0.1;
    const P = nodes.map((n) => project(n, rotY, rotX, cx, cy, R));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    // core glow
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3);
    cg.addColorStop(0, "rgba(40,150,255,0.35)");
    cg.addColorStop(0.5, "rgba(0,90,255,0.1)");
    cg.addColorStop(1, "rgba(0,60,200,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6);
    // edges + travelling pulses
    for (const e of edges) {
      const a = P[e.a], b = P[e.b];
      const depth = U.clamp(0.75 - (a.z + b.z) * 0.3, 0.15, 1);
      ctx.strokeStyle = `rgba(80,190,255,${0.32 * depth})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const q = U.fract(t * e.sp + e.ph);
      if (q < 0.5) {
        const k = q * 2;
        const x = U.lerp(a.x, b.x, k), y = U.lerp(a.y, b.y, k);
        ctx.globalAlpha = depth * 0.9;
        ctx.drawImage(spark, x - 7, y - 7, 14, 14);
        ctx.globalAlpha = 1;
      }
    }
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const depth = U.clamp(0.8 - p.z * 0.4, 0.2, 1);
      const s = (nodes[i].r * 5 + 2) * p.f;
      ctx.fillStyle = `rgba(200,240,255,${depth})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 0.5, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = depth * 0.6;
      ctx.drawImage(spark, p.x - s * 2.2, p.y - s * 2.2, s * 4.4, s * 4.4);
      ctx.globalAlpha = 1;
    }
    // orbit rings
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      ctx.strokeStyle = i ? "rgba(245,197,107,0.35)" : "rgba(0,229,255,0.45)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * (1.25 + i * 0.12), R * (0.32 + i * 0.05), (i ? -0.25 : 0.2) + t * 0.05, 0, U.TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- holographic panels ----------
  function panelFrame(ctx, w, h, a) {
    ctx.fillStyle = `rgba(6,30,70,${0.55 * a})`;
    ctx.strokeStyle = `rgba(0,229,255,${0.5 * a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 14);
    ctx.fill();
    ctx.stroke();
    // corner brackets
    ctx.strokeStyle = `rgba(140,235,255,${a})`;
    ctx.lineWidth = 3;
    const c = 22;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = (sx * w) / 2, y = (sy * h) / 2;
      ctx.beginPath();
      ctx.moveTo(x - sx * c, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y - sy * c);
      ctx.stroke();
    }
    // header dots
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 0 ? `rgba(245,197,107,${a})` : `rgba(0,229,255,${0.6 * a})`;
      ctx.beginPath();
      ctx.arc(-w / 2 + 24 + i * 16, -h / 2 + 22, 4, 0, U.TAU);
      ctx.fill();
    }
  }

  function iconCloud(ctx, t, a) {
    ctx.strokeStyle = `rgba(160,235,255,${a})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-70, 30);
    ctx.lineTo(60, 30);
    ctx.arc(55, 0, 30, Math.PI / 2, -Math.PI / 2, true);
    ctx.arc(15, -22, 40, -0.1, -Math.PI * 0.95, true);
    ctx.arc(-55, -2, 32, -Math.PI * 0.6, Math.PI / 2, true);
    ctx.stroke();
    // data streams rising into the cloud
    for (let i = 0; i < 3; i++) {
      const x = -30 + i * 30;
      const q = U.fract(t * 1.2 + i * 0.33);
      ctx.strokeStyle = `rgba(0,229,255,${a * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, 75);
      ctx.lineTo(x, 42);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${a * (1 - q)})`;
      ctx.beginPath();
      ctx.arc(x, 75 - q * 40, 4, 0, U.TAU);
      ctx.fill();
    }
  }

  function iconChip(ctx, t, a) {
    ctx.strokeStyle = `rgba(160,235,255,${a})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-48, -48, 96, 96, 12);
    ctx.stroke();
    for (let i = -1; i <= 1; i++) {
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const ox = dx ? dx * 48 : i * 28, oy = dy ? dy * 48 : i * 28;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + dx * 20, oy + dy * 20);
        ctx.stroke();
      }
    }
    const pulse = 0.6 + 0.4 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(0,229,255,${a * pulse * 0.25})`;
    ctx.fillRect(-36, -36, 72, 72);
    ctx.font = `800 34px ${U.FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillText("AI", 0, 2);
  }

  function iconAgent(ctx, t, a) {
    ctx.strokeStyle = `rgba(160,235,255,${a})`;
    ctx.lineWidth = 4;
    // bot head
    ctx.beginPath();
    ctx.roundRect(-42, -30, 84, 64, 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, -48);
    ctx.stroke();
    ctx.fillStyle = `rgba(245,197,107,${a})`;
    ctx.beginPath();
    ctx.arc(0, -52, 6, 0, U.TAU);
    ctx.fill();
    const blink = U.fract(t * 0.7) > 0.93 ? 0.2 : 1;
    ctx.fillStyle = `rgba(0,229,255,${a})`;
    ctx.fillRect(-24, -6, 14, 12 * blink);
    ctx.fillRect(10, -6, 14, 12 * blink);
    // chat bubble with typing dots
    ctx.strokeStyle = `rgba(0,229,255,${a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(52, -62, 64, 38, 10);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const on = Math.floor(t * 5) % 3 === i;
      ctx.fillStyle = `rgba(255,255,255,${a * (on ? 1 : 0.35)})`;
      ctx.beginPath();
      ctx.arc(70 + i * 14, -43, 4, 0, U.TAU);
      ctx.fill();
    }
    // linked sub-agents
    for (const [x, y] of [[-90, 50], [0, 72], [90, 50]]) {
      ctx.strokeStyle = `rgba(0,229,255,${a * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 34);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = `rgba(200,245,255,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, U.TAU);
      ctx.fill();
    }
  }

  function gear(ctx, x, y, r, teeth, rot) {
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = rot + (i / (teeth * 2)) * U.TAU;
      const rr = i % 2 ? r : r + r * 0.28;
      const a1 = rot + ((i + 1) / (teeth * 2)) * U.TAU;
      ctx.lineTo(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr);
      ctx.lineTo(x + Math.cos(a1) * rr, y + Math.sin(a1) * rr);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.35, 0, U.TAU);
    ctx.stroke();
  }

  function iconAuto(ctx, t, a) {
    ctx.strokeStyle = `rgba(160,235,255,${a})`;
    ctx.lineWidth = 4;
    gear(ctx, -26, -6, 34, 9, t * 1.5);
    ctx.strokeStyle = `rgba(245,197,107,${a})`;
    gear(ctx, 36, 30, 22, 7, -t * 1.5 * (34 / 22) + 0.2);
    // flow arrow
    ctx.strokeStyle = `rgba(0,229,255,${a})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    ctx.arc(0, 0, 82, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.setLineDash([]);
    const ea = Math.PI * 1.9;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ea) * 82 + 10, Math.sin(ea) * 82 + 4);
    ctx.lineTo(Math.cos(ea) * 82, Math.sin(ea) * 82);
    ctx.lineTo(Math.cos(ea) * 82 - 2, Math.sin(ea) * 82 + 12);
    ctx.stroke();
  }

  const PANELS = [
    { x: 340, y: 340, tilt: 1, title: "AZURE CLOUD", sub: "CLOUD COMPUTING", icon: iconCloud, at: 0.12 },
    { x: 1580, y: 340, tilt: -1, title: "ARTIFICIAL INTELLIGENCE", sub: "NEURAL NETWORKS", icon: iconChip, at: 0.26 },
    { x: 340, y: 735, tilt: 1, title: "COPILOT STUDIO", sub: "AI AGENTS", icon: iconAgent, at: 0.4 },
    { x: 1580, y: 735, tilt: -1, title: "AUTOMATION", sub: "AGENTIC WORKFLOWS", icon: iconAuto, at: 0.54 },
  ];

  function drawPanels(ctx, t, lt) {
    const W = 420, H = 300;
    for (const p of PANELS) {
      const k = E.outCubic(U.range(lt, p.at, p.at + 0.55));
      if (k <= 0) continue;
      const fx = U.lerp(p.tilt * -260, 0, k);
      const floatY = Math.sin(t * 1.4 + p.x) * 6;
      ctx.save();
      ctx.translate(p.x + fx, p.y + floatY);
      // perspective-ish turn toward the centre
      ctx.transform(0.86, p.tilt * 0.07, 0, 1, 0, 0);
      ctx.scale(U.lerp(0.85, 1, k), U.lerp(0.85, 1, k));
      ctx.globalAlpha = 1;
      panelFrame(ctx, W, H, k);
      // scanline
      const sy = -H / 2 + U.fract(t * 0.6 + p.at) * H;
      const sg = ctx.createLinearGradient(0, sy - 30, 0, sy);
      sg.addColorStop(0, "rgba(0,229,255,0)");
      sg.addColorStop(1, `rgba(0,229,255,${0.18 * k})`);
      ctx.fillStyle = sg;
      ctx.fillRect(-W / 2 + 2, sy - 30, W - 4, 30);
      ctx.save();
      ctx.translate(-80, 38);
      ctx.scale(0.85, 0.85);
      ctx.shadowColor = "rgba(0,200,255,0.9)";
      ctx.shadowBlur = 16;
      p.icon(ctx, t, k);
      ctx.restore();
      // mini telemetry bars
      for (let i = 0; i < 6; i++) {
        const h = 16 + 40 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.3 + p.at * 9));
        ctx.fillStyle = i % 3 === 0 ? `rgba(245,197,107,${0.8 * k})` : `rgba(0,229,255,${0.7 * k})`;
        ctx.fillRect(80 + i * 18, 95 - h, 10, h);
      }
      ctx.fillStyle = `rgba(0,229,255,${0.4 * k})`;
      ctx.fillRect(80, 98, 100, 1.5);
      // labels
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.font = `700 21px ${U.FONT}`;
      ctx.letterSpacing = "2px";
      ctx.fillStyle = `rgba(255,255,255,${k})`;
      ctx.fillText(p.title, -W / 2 + 26, -H / 2 + 66);
      ctx.font = `600 14px ${U.FONT}`;
      ctx.letterSpacing = "4px";
      ctx.fillStyle = `rgba(0,229,255,${0.9 * k})`;
      ctx.fillText(p.sub, -W / 2 + 26, -H / 2 + 90);
      ctx.restore();
    }
  }

  // curved light trails from the core to each panel
  function drawLinks(ctx, t, lt) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of PANELS) {
      const k = U.range(lt, p.at + 0.15, p.at + 0.6);
      if (k <= 0) continue;
      const sx = 960, sy = 470;
      const ex = p.x + (p.tilt > 0 ? 190 : -190), ey = p.y;
      const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 80;
      ctx.strokeStyle = `rgba(0,229,255,${0.25 * k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
      for (let j = 0; j < 2; j++) {
        const q = U.fract(t * 0.9 + j * 0.5 + p.at);
        const u = 1 - q;
        const x = u * u * sx + 2 * u * q * mx + q * q * ex;
        const y = u * u * sy + 2 * u * q * my + q * q * ey;
        ctx.globalAlpha = k;
        ctx.drawImage(spark, x - 14, y - 14, 28, 28);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawStreaks(ctx, t) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 7; i++) {
      const y = 770 + i * 40 + i * i * 2;
      const q = U.fract(t * (0.5 + i * 0.13) + i * 0.37);
      const x = U.lerp(-600, 2500, q);
      const len = 260 + i * 50;
      const g = ctx.createLinearGradient(x - len, 0, x, 0);
      const gold = i % 3 === 1;
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, gold ? "rgba(255,200,120,0.75)" : "rgba(0,229,255,0.8)");
      ctx.fillStyle = g;
      ctx.fillRect(x - len, y, len, 2 + i * 0.4);
    }
    ctx.restore();
  }

  T.draw = function (ctx, t) {
    T.init();
    const lt = t - T0; // local time (may be slightly negative during the transition)
    ctx.fillStyle = "#020814";
    ctx.fillRect(0, 0, 1920, 1080);
    const bg = ctx.createRadialGradient(960, 470, 0, 960, 540, 1200);
    bg.addColorStop(0, "#0a2552");
    bg.addColorStop(0.45, "#051230");
    bg.addColorStop(1, "#01040d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1920, 1080);

    // slow camera dolly
    const cam = 1 + 0.07 * E.inOutSine(U.range(t, 5.8, 8.3));
    ctx.save();
    ctx.translate(960, 540);
    ctx.scale(cam, cam);
    ctx.rotate(-0.012 + 0.024 * U.range(t, 5.8, 8.3));
    ctx.translate(-960, -540);

    drawGrid(ctx, t);
    drawStreaks(ctx, t);
    // rising motes
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of motes) {
      const y = ((m.y - m.v * t) % 1080 + 1080) % 1080;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 2 + m.ph);
      ctx.drawImage(spark, m.x - m.s, y - m.s, m.s * 2, m.s * 2);
    }
    ctx.restore();

    drawLinks(ctx, t, lt);
    drawNeural(ctx, t, lt + 0.2);
    drawPanels(ctx, t, lt);

    // caption under the core
    const ca = E.outCubic(U.range(lt, 0.45, 0.9));
    SV.brand.drawSpaced(ctx, "AGENTIC AI", 960, 790, 26, 12, "#ffffff", ca, 700);
    SV.brand.drawSpaced(ctx, "CLOUD  •  CODE  •  COPILOTS", 960, 830, 15, 6, "#7fdcff", ca * 0.9, 600);
    ctx.restore();

    SV.brand.drawBug(ctx, U.range(t, 6.2, 6.6));
  };
})();
