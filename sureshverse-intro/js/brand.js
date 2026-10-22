/* SureshVerse brand elements: the metallic "S" emblem and the wordmark.
 * The S is an original mark: two tangent arcs drawn as a thick ribbon with a
 * thin gold "road line" running through it — technology meets travel.
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const B = (SV.brand = {});

  const R = 52; // arc radius of the S in local units
  const LW = 34; // ribbon thickness

  function sPath(ctx) {
    ctx.beginPath();
    // upper bowl: from upper-right, over the top, round to the centre
    ctx.arc(0, -R, R, -Math.PI * 0.18, Math.PI / 2, true);
    // lower bowl: from the centre, round the right side to lower-left
    ctx.arc(0, R, R, -Math.PI / 2, Math.PI * 0.82, false);
  }
  B.sPath = sPath;

  /**
   * Draw the 3D-ish metallic S.
   * theta: rotation around the vertical axis (0 = facing camera)
   * opts: { alpha, glow (0..1), shine (0..1 sweep position, <0 = off), line (0..1 gold line reveal) }
   */
  B.drawS = function (ctx, x, y, scale, theta, opts = {}) {
    const alpha = opts.alpha == null ? 1 : opts.alpha;
    if (alpha <= 0.001) return;
    const glow = opts.glow == null ? 1 : opts.glow;
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    let sx = Math.abs(c) < 0.03 ? 0.03 * Math.sign(c || 1) : c;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // extrusion (depth) — darker steel layers offset along the rotation
    const depth = 16;
    const layers = 9;
    for (let i = layers; i >= 1; i--) {
      const off = (s * depth * i) / layers;
      ctx.setTransform(sx * scale, 0, 0, scale, x + off * scale, y);
      const k = i / layers;
      ctx.strokeStyle = `rgb(${10 + 20 * (1 - k)},${30 + 50 * (1 - k)},${60 + 70 * (1 - k)})`;
      ctx.lineWidth = LW;
      sPath(ctx);
      ctx.stroke();
    }

    ctx.setTransform(sx * scale, 0, 0, scale, x, y);

    // outer glow
    if (glow > 0) {
      ctx.save();
      ctx.shadowColor = `rgba(0,190,255,${0.85 * glow})`;
      ctx.shadowBlur = 40 * scale * glow;
      ctx.strokeStyle = "rgba(40,140,255,0.9)";
      ctx.lineWidth = LW;
      sPath(ctx);
      ctx.stroke();
      ctx.restore();
    }

    // metallic face — reflections slide as the S turns
    const shift = s * 60;
    const g = ctx.createLinearGradient(-60 + shift, -130, 60 + shift, 130);
    g.addColorStop(0.0, "#ffffff");
    g.addColorStop(0.18, "#a9e4ff");
    g.addColorStop(0.36, "#2a6fd0");
    g.addColorStop(0.5, "#e9f8ff");
    g.addColorStop(0.64, "#1c58b8");
    g.addColorStop(0.82, "#7fd6ff");
    g.addColorStop(1.0, "#ffffff");
    ctx.strokeStyle = g;
    ctx.lineWidth = LW;
    sPath(ctx);
    ctx.stroke();

    // bevel highlight
    ctx.save();
    ctx.translate(-2.5, -2.5);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = LW * 0.22;
    sPath(ctx);
    ctx.stroke();
    ctx.restore();

    // inner groove + gold road line
    ctx.strokeStyle = "rgba(4,14,34,0.85)";
    ctx.lineWidth = LW * 0.2;
    sPath(ctx);
    ctx.stroke();
    const line = opts.line == null ? 1 : opts.line;
    if (line > 0) {
      ctx.save();
      ctx.setLineDash([10, 9]);
      ctx.lineDashOffset = -(opts.dashOffset || 0);
      ctx.strokeStyle = `rgba(245,197,107,${0.95 * line})`;
      ctx.shadowColor = "rgba(255,190,90,0.9)";
      ctx.shadowBlur = 8 * scale;
      ctx.lineWidth = LW * 0.08;
      sPath(ctx);
      ctx.stroke();
      ctx.restore();
    }

    // specular shine sweep
    if (opts.shine != null && opts.shine >= 0 && opts.shine <= 1) {
      const p = U.lerp(-200, 200, opts.shine);
      const sg = ctx.createLinearGradient(p - 40, -150, p + 40, 150);
      sg.addColorStop(0, "rgba(255,255,255,0)");
      sg.addColorStop(0.5, "rgba(255,255,255,0.95)");
      sg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = sg;
      ctx.lineWidth = LW;
      sPath(ctx);
      ctx.stroke();
    }
    ctx.restore();
  };

  /** S with motion blur: ghost copies along the angular velocity. */
  B.drawSBlurred = function (ctx, x, y, scale, theta, omega, opts = {}) {
    const ghosts = Math.min(6, Math.floor(Math.abs(omega) * 1.2));
    const base = opts.alpha == null ? 1 : opts.alpha;
    for (let i = ghosts; i >= 1; i--) {
      B.drawS(ctx, x, y, scale, theta - (omega * i) / 90, Object.assign({}, opts, {
        alpha: base * 0.22 * (1 - i / (ghosts + 1)),
        glow: 0,
        line: 0,
      }));
    }
    B.drawS(ctx, x, y, scale, theta, opts);
  };

  // ---------- wordmark ----------
  // Pre-rendered once per size: "Suresh" white + "Verse" electric cyan, with glow.
  const wordCache = {};
  B.WORD_A = "Suresh";
  B.WORD_B = "Verse";

  function font(size) {
    return `800 ${size}px ${U.FONT}`;
  }

  B.measureWord = function (size) {
    const c = U.canvas(10, 10).getContext("2d");
    c.font = font(size);
    c.letterSpacing = `${Math.round(size * 0.02)}px`;
    const wa = c.measureText(B.WORD_A).width;
    const wb = c.measureText(B.WORD_B).width;
    return { wa, wb, w: wa + wb };
  };

  B.wordmark = function (size) {
    if (wordCache[size]) return wordCache[size];
    const m = B.measureWord(size);
    const pad = Math.round(size * 0.6);
    const w = Math.ceil(m.w + pad * 2);
    const h = Math.ceil(size * 1.6 + pad);
    const c = U.canvas(w, h);
    const x = c.getContext("2d");
    const base = Math.round(h * 0.66);
    x.font = font(size);
    x.letterSpacing = `${Math.round(size * 0.02)}px`;
    x.textBaseline = "alphabetic";

    // glow pass
    x.save();
    x.shadowColor = "rgba(30,140,255,0.75)";
    x.shadowBlur = size * 0.35;
    x.fillStyle = "rgba(160,220,255,0.55)";
    x.fillText(B.WORD_A, pad, base);
    x.shadowColor = "rgba(0,229,255,0.85)";
    x.fillStyle = "rgba(0,229,255,0.6)";
    x.fillText(B.WORD_B, pad + m.wa, base);
    x.restore();

    // "Suresh" — polished white with a soft cool reflection
    const ga = x.createLinearGradient(0, base - size * 0.8, 0, base + size * 0.1);
    ga.addColorStop(0, "#ffffff");
    ga.addColorStop(0.55, "#ffffff");
    ga.addColorStop(0.62, "#d6e9ff");
    ga.addColorStop(1, "#f4f9ff");
    x.fillStyle = ga;
    x.fillText(B.WORD_A, pad, base);

    // "Verse" — electric cyan
    const gb = x.createLinearGradient(0, base - size * 0.8, 0, base + size * 0.1);
    gb.addColorStop(0, "#7ff4ff");
    gb.addColorStop(0.55, "#00e5ff");
    gb.addColorStop(0.62, "#00bfff");
    gb.addColorStop(1, "#33ecff");
    x.fillStyle = gb;
    x.fillText(B.WORD_B, pad + m.wa, base);

    // a solid alpha mask (no glow) for particle sampling and shine clipping
    const mask = U.canvas(w, h);
    const mx = mask.getContext("2d");
    mx.font = font(size);
    mx.letterSpacing = `${Math.round(size * 0.02)}px`;
    mx.fillStyle = "#fff";
    mx.fillText(B.WORD_A, pad, base);
    mx.fillStyle = "#0ff";
    mx.fillText(B.WORD_B, pad + m.wa, base);

    const res = { canvas: c, mask, w, h, base, pad, wa: m.wa, wb: m.wb, tmp: U.canvas(w, h) };
    wordCache[size] = res;
    return res;
  };

  /** Draw the wordmark centred at cx with its baseline at y. shine: 0..1 sweep or <0 for none. */
  B.drawWordmark = function (ctx, cx, y, size, alpha, shine) {
    if (alpha <= 0.001) return;
    const wm = B.wordmark(size);
    const dx = Math.round(cx - wm.w / 2);
    const dy = Math.round(y - wm.base);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(wm.canvas, dx, dy);
    if (shine != null && shine >= 0 && shine <= 1) {
      const t = wm.tmp.getContext("2d");
      t.globalCompositeOperation = "source-over";
      t.clearRect(0, 0, wm.w, wm.h);
      t.drawImage(wm.mask, 0, 0);
      t.globalCompositeOperation = "source-in";
      const p = U.lerp(-0.25, 1.25, shine) * wm.w;
      const g = t.createLinearGradient(p - 120, 0, p + 120, wm.h);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      t.fillStyle = g;
      t.fillRect(0, 0, wm.w, wm.h);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(wm.tmp, dx, dy);
    }
    ctx.restore();
  };

  /** Spaced uppercase line (tagline etc.). */
  B.drawSpaced = function (ctx, text, cx, y, size, spacing, color, alpha, weight = 600) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${weight} ${size}px ${U.FONT}`;
    ctx.letterSpacing = `${spacing}px`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,160,255,0.45)";
    ctx.shadowBlur = size * 0.5;
    // letterSpacing adds trailing space after the last glyph; compensate so it stays centred
    ctx.fillText(text, cx + spacing / 2, y);
    ctx.restore();
  };

  /** Small corner bug: mini S + "SureshVerse", shown during the showcase scenes. */
  B.drawBug = function (ctx, alpha) {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    B.drawS(ctx, 1662, 1006, 0.16, 0, { glow: 0.4, line: 1 });
    ctx.font = `700 26px ${U.FONT}`;
    ctx.letterSpacing = "1px";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(B.WORD_A, 1690, 1008);
    const wa = ctx.measureText(B.WORD_A).width;
    ctx.fillStyle = "#00e5ff";
    ctx.fillText(B.WORD_B, 1690 + wa, 1008);
    ctx.restore();
  };
})();
