/* SureshVerse intro — shared utilities.
 * Everything here is pure and deterministic: the same time value always
 * produces the same frame, which is what makes frame-accurate MP4 export possible.
 */
(function () {
  const SV = (window.SV = window.SV || {});
  const U = (SV.util = {});

  U.W = 1920;
  U.H = 1080;
  U.FPS = 30;
  U.DURATION = 12;

  // ---------- math ----------
  U.clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.range = (t, a, b) => U.clamp((t - a) / (b - a));
  U.smoothstep = (a, b, t) => {
    const x = U.clamp((t - a) / (b - a));
    return x * x * (3 - 2 * x);
  };
  U.fract = (x) => x - Math.floor(x);
  U.TAU = Math.PI * 2;

  // ---------- easing ----------
  U.ease = {
    linear: (x) => x,
    inCubic: (x) => x * x * x,
    outCubic: (x) => 1 - Math.pow(1 - x, 3),
    inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outQuart: (x) => 1 - Math.pow(1 - x, 4),
    outQuint: (x) => 1 - Math.pow(1 - x, 5),
    inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
    outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inOutExpo: (x) =>
      x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
    inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: (x) => {
      const c1 = 1.4, c3 = c1 + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    },
  };

  // ---------- deterministic random ----------
  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function hash3(x, y, z, seed) {
    let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440670441);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  U.hash3 = hash3;

  const fade = (t) => t * t * (3 - 2 * t);

  U.noise3 = function (x, y, z, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const c000 = hash3(xi, yi, zi, seed), c100 = hash3(xi + 1, yi, zi, seed);
    const c010 = hash3(xi, yi + 1, zi, seed), c110 = hash3(xi + 1, yi + 1, zi, seed);
    const c001 = hash3(xi, yi, zi + 1, seed), c101 = hash3(xi + 1, yi, zi + 1, seed);
    const c011 = hash3(xi, yi + 1, zi + 1, seed), c111 = hash3(xi + 1, yi + 1, zi + 1, seed);
    const x00 = c000 + (c100 - c000) * xf, x10 = c010 + (c110 - c010) * xf;
    const x01 = c001 + (c101 - c001) * xf, x11 = c011 + (c111 - c011) * xf;
    const y0 = x00 + (x10 - x00) * yf, y1 = x01 + (x11 - x01) * yf;
    return y0 + (y1 - y0) * zf;
  };

  U.fbm3 = function (x, y, z, octaves, seed) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * U.noise3(x * freq, y * freq, z * freq, seed + i * 101);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };

  U.fbm1 = function (x, octaves, seed) {
    return U.fbm3(x, 0.5, 0.5, octaves, seed);
  };

  // ---------- canvas helpers ----------
  U.canvas = function (w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };

  U.rgba = (r, g, b, a) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

  // Soft round glow sprite, pre-rendered once and reused for particles/flares.
  U.glowSprite = function (size, r, g, b) {
    const c = U.canvas(size, size);
    const x = c.getContext("2d");
    const grd = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(255,255,255,1)`);
    grd.addColorStop(0.12, `rgba(${r},${g},${b},0.9)`);
    grd.addColorStop(0.4, `rgba(${r},${g},${b},0.25)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, size, size);
    return c;
  };

  U.FONT = '"Montserrat", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

  // Brand palette
  U.C = {
    navy: "#030814",
    deep: "#06122b",
    blue: "#1e6bff",
    electric: "#2f8cff",
    cyan: "#00e5ff",
    cyanRGB: [0, 229, 255],
    gold: "#f5c56b",
    goldRGB: [245, 197, 107],
    white: "#ffffff",
  };
})();
