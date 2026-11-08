#!/usr/bin/env python3
"""Lakshmi Pooja reel (30 s): footage-inside-text title animations.

Timeline (output seconds):
   0.0 -  4.0  LAKSHMI / POOJA letters pop in, pooja footage plays INSIDE the letters
   4.0 -  5.0  zoom through the text -> full footage
   5.0 - 11.6  full shots (slow motion, slow push-in, gold flash cuts, gold captions)
  11.6 - 14.4  JAI / LAKSHMI / MATA footage-inside-text card
  14.4 - 15.4  zoom through
  15.4 - 26.8  full shots with captions
  26.8 - 30.0  zoom back out into LAKSHMI POOJA, fade out

The source clip contains a torn-paper intro and black glitch transitions; only the
clean shots are used (some are replayed in reverse to reach 30 s).
Usage: python3 make_lakshmi_pooja.py <input.mov> <output.mp4>
"""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
FONT_BLACK = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"
FONT_SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"

GOLD = np.array([245, 196, 92], np.float32)
GOLD_HI = np.array([255, 240, 190], np.float32)

# (src start, src end, speed, reverse, pre-crop)
BARS = "crop=1600:2860:280:490,"  # black bars baked into the last two source shots
B, A, C, D = (5.4, 8.3, ""), (2.4, 4.1, ""), (11.0, 12.2, BARS), (13.0, 14.7, BARS)
SEGMENTS = [
    (*B[:2], 0.5, False, B[2]),       #  0.0 -  5.8  altar + lamp (inside title, revealed)
    (*A[:2], 0.5, False, A[2]),       #  5.8 -  9.2  priest
    (*C[:2], 0.5, False, C[2]),       #  9.2 - 11.6  prasadam boxes
    (6.4, 8.3, 0.5, True, ""),        # 11.6 - 15.4  altar (reverse) inside JAI LAKSHMI MATA
    (*D[:2], 0.5, False, D[2]),       # 15.4 - 18.8  wide altar
    (*A[:2], 0.5, True, A[2]),        # 18.8 - 22.2  priest (reverse)
    (*C[:2], 0.5, True, C[2]),        # 22.2 - 24.6  prasadam (reverse)
    (5.4, 8.0, 0.48, False, ""),      # 24.6 - 30.0  altar -> outro title
]

INTRO_ZOOM = 4.0
CARD_START, CARD_ZOOM = 11.6, 14.4
OUTRO_START = 26.8
CAPTIONS = [
    (5.3, 9.0, "LAKSHMI POOJA", "Shubh Deepavali"),
    (9.3, 11.4, "OM SHRI MAHALAKSHMYAI NAMAH", "Prayers to Goddess Mahalakshmi"),
    (15.7, 18.6, "SUKH  SHANTI  SAMRIDDHI", "Peace, Prosperity & Happiness"),
    (19.0, 24.4, "JAI MAHALAKSHMI", "Blessings to every home"),
    (24.8, 26.6, "LAKSHMI POOJA", "Shubh Deepavali"),
]


def ease_out_back(x):
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def ease_in_out(x):
    return 0.5 - 0.5 * math.cos(math.pi * x)


def clamp01(x):
    return max(0.0, min(1.0, x))


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def text_img(text, font, size, spacing=0, max_w=None):
    f = ImageFont.truetype(font, size)
    while max_w and sum(f.getlength(c) for c in text) + spacing * (len(text) - 1) > max_w:
        size -= 2
        f = ImageFont.truetype(font, size)
    widths = [f.getlength(c) for c in text]
    tw = sum(widths) + spacing * (len(text) - 1)
    m = Image.new("L", (int(tw) + 80, f.getbbox(text)[3] + 80), 0)
    d = ImageDraw.Draw(m)
    x = 40
    for c, w in zip(text, widths):
        d.text((x, 40), c, font=f, fill=255)
        x += w + spacing
    return m


# ---------------------------------------------------------------- big titles
class Title:
    """Stacked tall letters used as a mask for the footage."""

    def __init__(self, lines, subtitle, max_h=520, vs=2.1, target_w=980, gap=40):
        fonts = []
        for text in lines:
            size = 100
            while True:
                f = ImageFont.truetype(FONT_BLACK, size + 4)
                bb = f.getbbox(text)
                if f.getlength(text) > target_w or (bb[3] - bb[1]) * vs > max_h:
                    break
                size += 4
            fonts.append(ImageFont.truetype(FONT_BLACK, size))
        heights = [(f.getbbox(t)[3] - f.getbbox(t)[1]) * vs for t, f in zip(lines, fonts)]
        y = (H - (sum(heights) + gap * (len(lines) - 1))) / 2 - 80
        self.letters = []
        delay = 0.0
        for text, f, lh in zip(lines, fonts, heights):
            top = f.getbbox(text)[1]
            x = (W - f.getlength(text)) / 2
            for i, ch in enumerate(text):
                bb = f.getbbox(ch)
                pad = 40
                m = Image.new("L", (bb[2] - bb[0] + 2 * pad, bb[3] - bb[1] + 2 * pad), 0)
                ImageDraw.Draw(m).text((pad - bb[0], pad - bb[1]), ch, font=f, fill=255)
                m = m.resize((m.width, int(m.height * vs)), Image.BICUBIC)
                lx = x + f.getlength(text[:i]) + bb[0] - pad
                ly = y + (bb[1] - top) * vs - pad * vs
                self.letters.append((m, lx, ly, delay))
                delay += 0.08
            delay += 0.15
            y += lh + gap
        self.bottom = y - gap
        self.subtitle = text_img(subtitle, FONT_SERIF, 62, 2, max_w=980)
        self.full = self.mask(99.0)
        self.anchor = self._anchor()

    def mask(self, t):
        canvas = Image.new("L", (W, H), 0)
        for m, lx, ly, delay in self.letters:
            p = clamp01((t - delay) / 0.5)
            if p <= 0:
                continue
            s = 1.6 - 0.6 * ease_out_back(p) if p < 1 else 1.0
            a = clamp01(p * 2.5)
            nw, nh = max(1, int(m.width * s)), max(1, int(m.height * s))
            mm = m.resize((nw, nh), Image.BICUBIC)
            if a < 1:
                mm = mm.point(lambda v, a=a: int(v * a))
            cx = lx + m.width / 2
            cy = ly + m.height / 2 - 60 * (1 - ease_out_back(p))
            canvas.paste(mm, (int(cx - nw / 2), int(cy - nh / 2)), mm)
        return canvas

    def _anchor(self):
        er = self.full
        for _ in range(12):
            nxt = er.filter(ImageFilter.MinFilter(9))
            if np.asarray(nxt).max() < 128:
                break
            er = nxt
        pts = np.argwhere(np.asarray(er) > 128)
        d = (pts[:, 0] - H / 2) ** 2 + (pts[:, 1] - W / 2) ** 2
        py, px = pts[np.argmin(d)]
        return float(px), float(py)

    def zoomed(self, s):
        ax, ay = self.anchor
        k = clamp01((s - 1) / 6)
        tx, ty = ax + (W / 2 - ax) * k, ay + (H / 2 - ay) * k
        return self.full.transform((W, H), Image.AFFINE,
                                   (1 / s, 0, ax - tx / s, 0, 1 / s, ay - ty / s), resample=Image.BILINEAR)


# ---------------------------------------------------------------- decorations
def radial_bg():
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.45) / H) ** 2)
    c0 = np.array([110, 22, 30], np.float32)
    c1 = np.array([18, 4, 8], np.float32)
    k = np.clip(r / 0.75, 0, 1)[..., None]
    return c0 * (1 - k) + c1 * k


BG = radial_bg()
VIGNETTE = (1 - 0.55 * np.clip(np.sqrt(((xx - W / 2) / (W * 0.7)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2) - 0.35, 0, 1))[..., None]

rng = np.random.default_rng(7)
N_SPARK = 70
SPARKS = np.stack([rng.uniform(0, W, N_SPARK), rng.uniform(0, H, N_SPARK), rng.uniform(20, 70, N_SPARK),
                   rng.uniform(2, 6, N_SPARK), rng.uniform(0, 2 * math.pi, N_SPARK),
                   rng.uniform(0.5, 1.6, N_SPARK)], 1)


def sparkle_layer(t, strength):
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    for x, y, sp, r, ph, sw in SPARKS:
        py = (y - sp * t) % (H + 40) - 20
        px = x + 18 * math.sin(t * sw + ph)
        a = (0.5 + 0.5 * math.sin(t * 4 + ph)) * strength
        if a >= 0.05:
            d.ellipse([px - r, py - r, px + r, py + r], fill=int(255 * a))
    core = np.asarray(img, np.float32) / 255
    glow = np.asarray(img.filter(ImageFilter.GaussianBlur(8)), np.float32) / 255
    return np.clip(core + glow * 1.8, 0, 1)


def place(canvas, mask_img, cx, cy, color, alpha, glow=True):
    if alpha <= 0:
        return canvas
    full = Image.new("L", (W, H), 0)
    full.paste(mask_img, (int(cx - mask_img.width / 2), int(cy - mask_img.height / 2)))
    m = np.asarray(full, np.float32)[..., None] / 255 * alpha
    if glow:
        g = np.asarray(full.filter(ImageFilter.GaussianBlur(14)), np.float32)[..., None] / 255 * alpha
        canvas = canvas * (1 - 0.55 * g)
    return canvas * (1 - m) + color * m


def title_frame(title, video, mask_img, sub_alpha, shimmer, bg_alpha=1.0):
    m = np.asarray(mask_img, np.float32)[..., None] / 255
    dil = mask_img.filter(ImageFilter.MaxFilter(11))
    outline = np.clip(np.asarray(dil, np.float32)[..., None] / 255 - m, 0, 1)
    glow = np.asarray(dil.filter(ImageFilter.GaussianBlur(28)), np.float32)[..., None] / 255
    bg = np.clip(BG + GOLD * glow * 0.35, 0, 255)
    out = bg * (1 - m) + np.clip(video * 1.08 + 6, 0, 255) * m
    col = np.broadcast_to(GOLD, out.shape).copy()
    if shimmer is not None:
        band_pos = -400 + shimmer * (W + H + 800)
        band = np.exp(-(((xx + yy * 0.5) - band_pos) / 120) ** 2)[..., None]
        col = col * (1 - band) + GOLD_HI * band
        out = out + band * m * 70
    out = out * (1 - outline) + col * outline
    if sub_alpha > 0:
        out = place(out, title.subtitle, W / 2, title.bottom + 90, GOLD, sub_alpha, glow=False)
    if bg_alpha < 1:
        out = out * bg_alpha + video * (1 - bg_alpha)
    return out


def title_scene(title, video, t_local, zoom_at):
    """Pop-in -> hold with two shimmer sweeps -> zoom through the letters."""
    if t_local < zoom_at:
        sh = None
        if 1.3 <= t_local < 2.5:
            sh = (t_local - 1.3) / 1.2
        elif 2.7 <= t_local < 3.9:
            sh = (t_local - 2.7) / 1.2
        return title_frame(title, video, title.mask(t_local), clamp01((t_local - 1.6) / 0.6), sh)
    p = clamp01((t_local - zoom_at) / 1.0)
    s = 1 + 15 * p ** 3
    return title_frame(title, video, title.zoomed(s), 1 - clamp01(p * 3), None, bg_alpha=1 - p ** 3)


def push_in(video, t_local, seg_len):
    """Slow Ken-Burns push-in so slow-motion shots keep moving."""
    z = 1 + 0.08 * clamp01(t_local / seg_len)
    cw, ch = W / z, H / z
    img = Image.fromarray(video.astype(np.uint8))
    img = img.resize((W, H), Image.BILINEAR, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))
    return np.asarray(img, np.float32)


# ---------------------------------------------------------------- main render
def main(src, dst):
    seg_out = [(b - a) / sp for a, b, sp, _, _ in SEGMENTS]
    starts = np.concatenate([[0], np.cumsum(seg_out)])
    n = int(round(starts[-1] * FPS))
    T = n / FPS
    cuts = [float(c) for c in starts[1:-1]]
    print(f"rendering {n} frames ({T:.2f}s), cuts at {[round(c, 2) for c in cuts]}", flush=True)

    main_title = Title(["LAKSHMI", "POOJA"], "Blessings of Goddess Lakshmi")
    card = Title(["JAI", "LAKSHMI", "MATA"], "Om Shri Mahalakshmyai Namah", max_h=380)
    caps = [(a, b, text_img(t1, FONT_BLACK, 96, 10, max_w=960), text_img(t2, FONT_SERIF, 60, 3, max_w=900))
            for a, b, t1, t2 in CAPTIONS]

    grade = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
             "eq=saturation=1.18:contrast=1.06:brightness=0.01,"
             "colorbalance=rs=0.06:gs=0.01:bs=-0.07:rm=0.05:bm=-0.05:rh=0.03:bh=-0.04")
    parts = []
    for k, (a, b, sp, rev, pre) in enumerate(SEGMENTS):
        r = "reverse," if rev else ""
        parts.append(f"[0:v]trim={a}:{b},setpts=PTS-STARTPTS,{pre}{grade},{r}"
                     f"setpts=(PTS-STARTPTS)/{sp},framerate={FPS},setsar=1[s{k}]")
    fc = ";".join(parts) + ";" + "".join(f"[s{k}]" for k in range(len(SEGMENTS))) + \
        f"concat=n={len(SEGMENTS)}:v=1:a=0[v]"
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-filter_complex", fc, "-map", "[v]",
                            "-pix_fmt", "rgb24", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset",
                            "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst],
                           stdin=subprocess.PIPE)

    fb = W * H * 3
    last = None
    for i in range(n):
        t = i / FPS
        buf = dec.stdout.read(fb)
        if len(buf) < fb:
            buf = last
        last = buf
        video = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
        seg = min(int(np.searchsorted(starts, t, side="right") - 1), len(SEGMENTS) - 1)
        video = push_in(video, t - starts[seg], seg_out[seg])

        titled = True
        if t < INTRO_ZOOM + 1.0:
            out = title_scene(main_title, video, t, INTRO_ZOOM)
            out = out * clamp01(t / 0.3 + 0.2)
        elif CARD_START <= t < CARD_ZOOM + 1.0:
            out = title_scene(card, video, t - CARD_START, CARD_ZOOM - CARD_START)
            out = out + (GOLD_HI - out) * clamp01(1 - (t - CARD_START) / 0.3) * 0.7
        elif t >= OUTRO_START:
            p = clamp01((t - OUTRO_START) / 0.9)
            s = 1 + 15 * (1 - ease_in_out(p)) ** 3
            tl = t - OUTRO_START - 0.9
            sh = clamp01(tl / 1.0) if 0 < tl < 1.0 else None
            out = title_frame(main_title, video, main_title.zoomed(s), clamp01(tl / 0.5), sh,
                              bg_alpha=ease_in_out(p))
            out = out * clamp01((T - t) / 0.6)
        else:
            titled = False
            out = video * VIGNETTE
            flash = 0.0
            for z in (INTRO_ZOOM + 1.0, CARD_ZOOM + 1.0):
                if z <= t < z + 0.35:
                    flash = max(flash, 1 - (t - z) / 0.35)
            for c in cuts:
                if c - 0.12 <= t < c + 0.4:
                    flash = max(flash, clamp01((t - c + 0.12) / 0.12) if t < c else clamp01(1 - (t - c) / 0.4))
            out = out + (GOLD_HI - out) * flash * 0.6
            for a, b, m1, m2 in caps:
                if a <= t < b:
                    al = clamp01((t - a) / 0.5) * clamp01((b - t) / 0.4)
                    rise = 30 * (1 - ease_in_out(clamp01((t - a) / 0.6)))
                    out = place(out, m1, W / 2, H - 400 + rise, GOLD, al)
                    out = place(out, m2, W / 2, H - 300 + rise, GOLD_HI, al * 0.95)

        sp = sparkle_layer(t, 0.9 if titled else 0.55)[..., None]
        out = out * (1 - sp) + GOLD_HI * sp
        enc.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
        if i % 60 == 0:
            print(f"  {t:5.1f}s", flush=True)

    enc.stdin.close()
    enc.wait()
    dec.kill()
    print("video done", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
