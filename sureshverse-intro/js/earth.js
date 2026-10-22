/* Procedural Earth seen from orbit.
 * A seamless equirectangular texture is generated from 3D noise on the sphere,
 * then each screen pixel's sphere coordinates are precomputed once. Per frame
 * we only offset the longitude, so rotation costs one table lookup per pixel.
 */
(function () {
  const SV = window.SV;
  const U = SV.util;
  const E = (SV.earth = {});

  // Planet geometry in screen space (base camera)
  E.CX = 1180;
  E.CY = 1600;
  E.R = 1080;
  // Rendered at half resolution, covering y in [Y0, Y0 + BH*2]
  const SCALE = 2;
  const Y0 = 480;
  const BW = 960;
  const BH = 400;
  E.Y0 = Y0;
  E.BH = BH;

  const TW = 1024;
  const TH = 512;

  // sun direction (x right, y up, z toward viewer), slightly behind the planet
  const L = (() => {
    const v = [-0.5, 0.78, -0.22];
    const n = Math.hypot(v[0], v[1], v[2]);
    return v.map((c) => c / n);
  })();
  E.sunScreen = () => {
    const d = Math.hypot(L[0], L[1]);
    return { x: E.CX + (L[0] / d) * E.R, y: E.CY - (L[1] / d) * E.R };
  };

  let tex = null; // packed day colour RGB + cloud + lights
  let px = null; // per-pixel lookup
  let buf = null, bctx = null, img = null;

  E.init = function () {
    if (tex) return;
    const day = new Uint8ClampedArray(TW * TH * 3);
    const cloud = new Uint8ClampedArray(TW * TH);
    const lights = new Uint8ClampedArray(TW * TH);
    for (let j = 0; j < TH; j++) {
      const lat = (0.5 - (j + 0.5) / TH) * Math.PI;
      const cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < TW; i++) {
        const lon = ((i + 0.5) / TW) * U.TAU;
        const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
        const h = U.fbm3(x * 1.7 + 3.1, y * 1.7 + 1.3, z * 1.7 + 7.7, 6, 11);
        const k = j * TW + i;
        let r, g, b;
        const sea = 0.53;
        const ice = U.smoothstep(1.05, 1.3, Math.abs(lat) + (h - 0.5) * 0.4);
        if (h < sea) {
          const d = U.smoothstep(0.3, sea, h);
          r = U.lerp(3, 10, d); g = U.lerp(16, 50, d); b = U.lerp(44, 104, d);
        } else {
          const e = U.smoothstep(sea, 0.75, h);
          const arid = U.fbm3(x * 3 + 9, y * 3, z * 3, 3, 27);
          const dry = U.smoothstep(0.45, 0.65, arid) * (1 - Math.abs(lat) / 1.4);
          r = U.lerp(U.lerp(34, 112, dry), 70, e);
          g = U.lerp(U.lerp(66, 92, dry), 68, e);
          b = U.lerp(U.lerp(38, 58, dry), 60, e);
          const city = U.hash3(i, j, 5, 99);
          const cityMask = U.fbm3(x * 6, y * 6, z * 6, 3, 41);
          if (city > 0.9 && cityMask > 0.5) lights[k] = 255 * U.smoothstep(0.5, 0.62, cityMask);
        }
        // soften the coastline so it never looks pixelated
        if (h >= sea && h < sea + 0.012) {
          const c = (h - sea) / 0.012;
          r = U.lerp(10, r, c); g = U.lerp(50, g, c); b = U.lerp(104, b, c);
        }
        r = U.lerp(r, 225, ice); g = U.lerp(g, 235, ice); b = U.lerp(b, 245, ice);
        day[k * 3] = r; day[k * 3 + 1] = g; day[k * 3 + 2] = b;
        const c = U.fbm3(x * 2.6 + 20, y * 4.2, z * 2.6, 5, 77);
        cloud[k] = 255 * U.smoothstep(0.52, 0.72, c);
      }
    }
    tex = { day, cloud, lights };

    // per-pixel sphere lookup for the half-res buffer
    const idx = [], u0 = [], v0 = [], dif = [], rim = [], spec = [], edge = [];
    const tilt = 0.32; // axial tilt toward the viewer
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const H = (() => {
      const v = [L[0], L[1], L[2] + 1];
      const n = Math.hypot(v[0], v[1], v[2]);
      return v.map((c) => c / n);
    })();
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const sx = x * SCALE + 1, sy = Y0 + y * SCALE + 1;
        const nx = (sx - E.CX) / E.R;
        const ny = -(sy - E.CY) / E.R;
        const d2 = nx * nx + ny * ny;
        if (d2 >= 1) continue;
        const nz = Math.sqrt(1 - d2);
        // rotate normal by tilt around x-axis to get planet-local coordinates
        const py = ny * ct - nz * st;
        const pz = ny * st + nz * ct;
        const lat = Math.asin(U.clamp(py, -1, 1));
        const lon = Math.atan2(pz, nx);
        idx.push(y * BW + x);
        u0.push(((lon / U.TAU + 1) % 1) * TW);
        v0.push(U.clamp((0.5 - lat / Math.PI) * TH - 0.5, 0, TH - 1.001));
        dif.push(nx * L[0] + ny * L[1] + nz * L[2]);
        // thin atmospheric limb (~30 px) plus a faint broad haze
        rim.push(Math.exp(-(1 - Math.sqrt(d2)) * E.R / 30) + 0.12 * Math.pow(1 - nz, 2));
        spec.push(Math.pow(Math.max(0, nx * H[0] + ny * H[1] + nz * H[2]), 60));
        edge.push(U.clamp((1 - Math.sqrt(d2)) * E.R * 0.5));
      }
    }
    px = {
      n: idx.length,
      idx: Int32Array.from(idx), u0: Float32Array.from(u0), v0: Float32Array.from(v0),
      dif: Float32Array.from(dif), rim: Float32Array.from(rim), spec: Float32Array.from(spec),
      edge: Float32Array.from(edge),
    };
    buf = U.canvas(BW, BH);
    bctx = buf.getContext("2d");
    img = bctx.createImageData(BW, BH);
  };

  /** Render the planet into the half-res buffer for time t (seconds). */
  function shade(t) {
    const d = img.data;
    const rot = t * 9; // texels per second
    const crot = t * 13;
    const { day, cloud, lights } = tex;
    for (let k = 0; k < px.n; k++) {
      // bilinear texture sampling (seamless in longitude)
      const vf = px.v0[k], vi = vf | 0, fy = vf - vi;
      const u = (px.u0[k] + rot) % TW, ui = u | 0, fx = u - ui, ui1 = (ui + 1) % TW;
      const r0 = vi * TW, r1 = r0 + TW;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const a = (r0 + ui) * 3, b1 = (r0 + ui1) * 3, c = (r1 + ui) * 3, d1 = (r1 + ui1) * 3;
      let r = day[a] * w00 + day[b1] * w10 + day[c] * w01 + day[d1] * w11;
      let g = day[a + 1] * w00 + day[b1 + 1] * w10 + day[c + 1] * w01 + day[d1 + 1] * w11;
      let b = day[a + 2] * w00 + day[b1 + 2] * w10 + day[c + 2] * w01 + day[d1 + 2] * w11;
      const lt0 = lights[r0 + ui] * w00 + lights[r0 + ui1] * w10 + lights[r1 + ui] * w01 + lights[r1 + ui1] * w11;
      const uc = (px.u0[k] + crot) % TW, uci = uc | 0, fcx = uc - uci, uci1 = (uci + 1) % TW;
      const cl = ((cloud[r0 + uci] * (1 - fcx) + cloud[r0 + uci1] * fcx) * (1 - fy) + (cloud[r1 + uci] * (1 - fcx) + cloud[r1 + uci1] * fcx) * fy) / 255;
      const isSea = b > r * 2;

      const df = px.dif[k];
      const light = U.smoothstep(-0.12, 0.6, df);
      // clouds
      r = r + (230 - r) * cl * 0.8; g = g + (238 - g) * cl * 0.8; b = b + (255 - b) * cl * 0.8;
      // day/night
      r *= light * 1.05; g *= light * 1.05; b *= light * 1.1;
      // ocean glint (only where there is little cloud)
      if (isSea) {
        const sp = px.spec[k] * (1 - cl) * 255;
        r += sp * 0.9; g += sp * 0.85; b += sp * 0.7;
      }
      // city lights on the night side — the subtle gold highlights
      const night = 1 - U.smoothstep(-0.05, 0.2, df);
      const lt = lt0 * night * (1 - cl * 0.8);
      r += lt * 1.0; g += lt * 0.72; b += lt * 0.3;
      // atmosphere rim (fresnel)
      const rm = px.rim[k] * (0.25 + Math.max(0, df) * 1.2);
      r += 70 * rm; g += 160 * rm; b += 255 * rm;

      const o = px.idx[k] * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b;
      d[o + 3] = 255 * px.edge[k];
    }
    bctx.putImageData(img, 0, 0);
  }

  /**
   * Draw the Earth with atmosphere and sunrise flare.
   * cam: { dy, scale, alpha, sun (0..1 sunrise intensity) }
   */
  E.draw = function (ctx, t, cam) {
    E.init();
    shade(t);
    const a = cam.alpha;
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    // camera: scale about the planet centre-top and vertical drift
    ctx.translate(960, 540 + cam.dy);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-960, -540);

    // outer atmosphere halo
    const halo = ctx.createRadialGradient(E.CX, E.CY, E.R * 0.98, E.CX, E.CY, E.R * 1.09);
    halo.addColorStop(0, "rgba(90,180,255,0.55)");
    halo.addColorStop(0.18, "rgba(40,130,255,0.28)");
    halo.addColorStop(0.5, "rgba(20,80,200,0.08)");
    halo.addColorStop(1, "rgba(10,40,120,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(E.CX, E.CY, E.R * 1.09, 0, U.TAU);
    ctx.fill();

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(buf, 0, Y0, BW * SCALE, BH * SCALE);

    // thin bright limb on the sunlit side
    const sun = E.sunScreen();
    const limb = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, E.R * 1.2);
    limb.addColorStop(0, "rgba(200,240,255,0.95)");
    limb.addColorStop(0.35, "rgba(80,180,255,0.6)");
    limb.addColorStop(1, "rgba(40,120,255,0.05)");
    ctx.strokeStyle = limb;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(E.CX, E.CY, E.R + 1, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // sunrise flare over the limb
    const s = cam.sun;
    if (s > 0) {
      ctx.globalCompositeOperation = "lighter";
      const fx = sun.x, fy = sun.y - 6;
      const r0 = 420 * s;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, r0);
      fg.addColorStop(0, `rgba(255,255,255,${0.95 * s})`);
      fg.addColorStop(0.06, `rgba(255,236,200,${0.8 * s})`);
      fg.addColorStop(0.25, `rgba(120,190,255,${0.3 * s})`);
      fg.addColorStop(1, "rgba(30,90,255,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(fx - r0, fy - r0, r0 * 2, r0 * 2);
      // anamorphic streak
      const sw = 1500 * s;
      const sg = ctx.createLinearGradient(fx - sw, 0, fx + sw, 0);
      sg.addColorStop(0, "rgba(40,140,255,0)");
      sg.addColorStop(0.5, `rgba(170,225,255,${0.75 * s})`);
      sg.addColorStop(1, "rgba(40,140,255,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(fx - sw, fy - 2.5, sw * 2, 5);
      ctx.globalAlpha = a * 0.35;
      ctx.fillRect(fx - sw, fy - 12, sw * 2, 24);
    }
    ctx.restore();
  };
})();
