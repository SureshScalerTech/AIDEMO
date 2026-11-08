#!/usr/bin/env python3
"""Lakshmi Pooja reel: video-inside-text title animation.

Timeline (output seconds, T = total length):
  0.0 - 1.6   LAKSHMI / POOJA letters pop in, the pooja footage plays INSIDE the letters
  1.4 - 2.6   gold shimmer sweeps across the letter outline, subtitle fades in
  2.8 - 3.8   camera zooms through the text until the footage fills the screen
  3.8 - T-2.4 full footage (clean shots, slow motion, gold flash cuts), gold title
  T-2.4 - T   zoom back out into LAKSHMI POOJA text, fade out

Prints the total duration; feed it to make_audio.py.
Usage: python3 make_lakshmi_pooja.py <input.mov> <output.mp4>
"""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 1080, 1920, 30
# Clean shots in the source (it has torn-paper intro + black glitch transitions we skip).
# (start, end, speed, pre-crop) -- speed < 1 = gentle slow motion;
# pre-crop removes the black bars baked into the last two source shots.
BARS = "crop=1600:2860:280:490,"
SEGMENTS = [
    (5.4, 8.3, 0.65, ""),     # altar with the idol + lamp: plays inside the title, then revealed
    (2.4, 4.1, 0.8, ""),      # priest seated before the offerings
    (11.0, 12.2, 0.7, BARS),  # prasadam boxes
    (13.0, 14.7, 0.65, BARS), # wide altar -> outro title
]
FONT_BLACK = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"
FONT_SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"
FONT_SMALL = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"

GOLD = np.array([245, 196, 92], np.float32)
GOLD_HI = np.array([255, 240, 190], np.float32)


def ease_out_back(x):
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2


def ease_in_cubic(x):
    return x ** 3


def ease_in_out(x):
    return 0.5 - 0.5 * math.cos(math.pi * x)


def clamp01(x):
    return max(0.0, min(1.0, x))


# ---------------------------------------------------------------- text layout
def fit_font(text, target_w, path=FONT_BLACK):
    size = 100
    while True:
        f = ImageFont.truetype(path, size + 4)
        if f.getlength(text) > target_w:
            return ImageFont.truetype(path, size)
        size += 4


def build_letters():
    """Return list of (mask_img, x, y, delay) for each letter, laid out stacked."""
    lines = [("LAKSHMI", 0.0), ("POOJA", 0.55)]
    target_w = 980
    letters = []
    fonts = [fit_font(t, target_w) for t, _ in lines]
    heights = []
    for (text, _), f in zip(lines, fonts):
        bb = f.getbbox(text)
        heights.append(bb[3] - bb[1])
    VS = 2.1  # vertical stretch -> tall condensed poster letters
    heights = [h * VS for h in heights]
    gap = 40
    total_h = sum(heights) + gap
    y = (H - total_h) // 2 - 80
    for (text, base_delay), f, lh in zip(lines, fonts, heights):
        top_off = f.getbbox(text)[1]
        x = (W - f.getlength(text)) / 2
        for i, ch in enumerate(text):
            adv = f.getlength(text[: i + 1]) - f.getlength(text[:i])
            bb = f.getbbox(ch)
            pad = 40
            m = Image.new("L", (int(bb[2] - bb[0]) + 2 * pad, int(bb[3] - bb[1]) + 2 * pad), 0)
            ImageDraw.Draw(m).text((pad - bb[0], pad - bb[1]), ch, font=f, fill=255)
            m = m.resize((m.width, int(m.height * VS)), Image.BICUBIC)
            lx = x + f.getlength(text[:i]) + bb[0] - pad
            ly = y + (bb[1] - top_off) * VS - pad * VS
            letters.append((m, lx, ly, base_delay + i * 0.08))
            del adv
        y += lh + gap
    return letters, y


LETTERS, TEXT_BOTTOM = build_letters()


def letter_mask(t):
    """Composite all letters at time t (intro pop-in animation)."""
    canvas = Image.new("L", (W, H), 0)
    for m, lx, ly, delay in LETTERS:
        p = clamp01((t - delay) / 0.5)
        if p <= 0:
            continue
        s = 1.6 - 0.6 * ease_out_back(p) if p < 1 else 1.0
        a = clamp01(p * 2.5)
        mw, mh = m.size
        nw, nh = max(1, int(mw * s)), max(1, int(mh * s))
        mm = m.resize((nw, nh), Image.BICUBIC)
        if a < 1:
            mm = mm.point(lambda v, a=a: int(v * a))
        cx, cy = lx + mw / 2, ly + mh / 2 - 60 * (1 - ease_out_back(p))
        canvas.paste(mm, (int(cx - nw / 2), int(cy - nh / 2)), mm)
    return canvas


FULL_TEXT = letter_mask(10.0)  # fully settled title


def find_anchor(mask):
    """Point inside the thickest stroke nearest to screen centre (zoom target)."""
    a = np.asarray(mask) > 128
    er = mask
    for _ in range(12):
        nxt = er.filter(ImageFilter.MinFilter(9))
        if np.asarray(nxt).max() < 128:
            break
        er = nxt
    pts = np.argwhere(np.asarray(er) > 128)
    if len(pts) == 0:
        pts = np.argwhere(a)
    d = (pts[:, 0] - H / 2) ** 2 + (pts[:, 1] - W / 2) ** 2
    py, px = pts[np.argmin(d)]
    return float(px), float(py)


ANCHOR = find_anchor(FULL_TEXT)


def zoom_mask(mask, s):
    """Scale mask by s around ANCHOR, keeping ANCHOR fixed then drifting to centre."""
    ax, ay = ANCHOR
    k = clamp01((s - 1) / 6)  # drift anchor toward screen centre while zooming
    tx = ax + (W / 2 - ax) * k
    ty = ay + (H / 2 - ay) * k
    # inverse affine: output (x,y) -> input ((x - tx)/s + ax, (y - ty)/s + ay)
    return mask.transform(
        (W, H), Image.AFFINE, (1 / s, 0, ax - tx / s, 0, 1 / s, ay - ty / s), resample=Image.BILINEAR
    )


# ---------------------------------------------------------------- decorations
def radial_bg():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / W) ** 2 + ((yy - H * 0.45) / H) ** 2)
    c0 = np.array([110, 22, 30], np.float32)  # deep kumkum red
    c1 = np.array([18, 4, 8], np.float32)
    k = np.clip(r / 0.75, 0, 1)[..., None]
    return c0 * (1 - k) + c1 * k


BG = radial_bg()

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIGNETTE = (1 - 0.55 * np.clip(np.sqrt(((xx - W / 2) / (W * 0.7)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2) - 0.35, 0, 1))[..., None]

rng = np.random.default_rng(7)
N_SPARK = 70
SPARKS = np.stack(
    [
        rng.uniform(0, W, N_SPARK),  # x
        rng.uniform(0, H, N_SPARK),  # y
        rng.uniform(20, 70, N_SPARK),  # rise speed px/s
        rng.uniform(2, 6, N_SPARK),  # radius
        rng.uniform(0, 2 * math.pi, N_SPARK),  # twinkle phase
        rng.uniform(0.5, 1.6, N_SPARK),  # sway freq
    ],
    1,
)


def sparkle_layer(t, strength):
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    for x, y, sp, r, ph, sw in SPARKS:
        py = (y - sp * t) % (H + 40) - 20
        px = x + 18 * math.sin(t * sw + ph)
        a = (0.5 + 0.5 * math.sin(t * 4 + ph)) * strength
        if a < 0.05:
            continue
        d.ellipse([px - r, py - r, px + r, py + r], fill=int(255 * a))
    core = np.asarray(img, np.float32) / 255
    glow = np.asarray(img.filter(ImageFilter.GaussianBlur(8)), np.float32) / 255
    return np.clip(core + glow * 1.8, 0, 1)


def text_img(text, font, spacing=0):
    f = ImageFont.truetype(font[0], font[1])
    widths = [f.getlength(c) for c in text]
    tw = sum(widths) + spacing * (len(text) - 1)
    bb = f.getbbox(text)
    m = Image.new("L", (int(tw) + 80, bb[3] + 80), 0)
    d = ImageDraw.Draw(m)
    x = 40
    for c, w in zip(text, widths):
        d.text((x, 40), c, font=f, fill=255)
        x += w + spacing
    return m


SUBTITLE = text_img("Blessings of Goddess Lakshmi", (FONT_SERIF, 62), 2)
LOWER_TITLE = text_img("LAKSHMI POOJA", (FONT_BLACK, 96), 10)
LOWER_SUB = text_img("Shubh Deepavali", (FONT_SERIF, 60), 3)


def place(canvas_rgb, mask_img, cx, cy, color, alpha, glow=True):
    """Alpha-blend a solid color text mask (with soft glow) centered at cx, cy."""
    if alpha <= 0:
        return canvas_rgb
    full = Image.new("L", (W, H), 0)
    full.paste(mask_img, (int(cx - mask_img.width / 2), int(cy - mask_img.height / 2)))
    m = np.asarray(full, np.float32)[..., None] / 255 * alpha
    out = canvas_rgb
    if glow:
        g = np.asarray(full.filter(ImageFilter.GaussianBlur(14)), np.float32)[..., None] / 255 * alpha
        out = out * (1 - 0.55 * g)  # dark halo for legibility
    return out * (1 - m) + color * m


# ---------------------------------------------------------------- main render
def title_frame(t, video, mask_img, sub_alpha, shimmer_t, bg_alpha=1.0, extra_glow=0.0):
    """Video inside text over red background with gold outline."""
    m = np.asarray(mask_img, np.float32)[..., None] / 255
    dil = mask_img.filter(ImageFilter.MaxFilter(11))
    outline = np.clip(np.asarray(dil, np.float32)[..., None] / 255 - m, 0, 1)
    glow = np.asarray(dil.filter(ImageFilter.GaussianBlur(28)), np.float32)[..., None] / 255

    # background: deep red + very dim blurred footage
    bg = BG.copy()
    bg = bg * (1 - glow * 0.0) + GOLD * glow * (0.35 + extra_glow)
    bg = np.clip(bg, 0, 255)

    # footage inside the letters, slightly brightened
    vid = np.clip(video * 1.08 + 6, 0, 255)

    out = bg * (1 - m) + vid * m

    # shimmering gold outline
    col = np.broadcast_to(GOLD, out.shape).copy()
    if shimmer_t is not None:
        band_pos = -400 + shimmer_t * (W + H + 800)
        band = np.exp(-(((xx + yy * 0.5) - band_pos) / 120) ** 2)[..., None]
        col = col * (1 - band) + GOLD_HI * band
        out = out + band * m * 70  # light sweep over the footage too
    out = out * (1 - outline) + col * outline

    if sub_alpha > 0:
        out = place(out, SUBTITLE, W / 2, TEXT_BOTTOM + 70, GOLD, sub_alpha, glow=False)

    if bg_alpha < 1:
        out = out * bg_alpha + video * (1 - bg_alpha)
    return out


def main(src, dst):
    seg_out = [(b - a) / sp for a, b, sp, _ in SEGMENTS]
    T = sum(seg_out)
    n = int(T * FPS)
    T = n / FPS
    cuts = list(np.cumsum(seg_out)[:-1])
    print(f"rendering {n} frames ({T:.2f}s), cuts at {[round(c, 2) for c in cuts]}", flush=True)

    grade = (
        f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
        "eq=saturation=1.18:contrast=1.06:brightness=0.01,"
        "colorbalance=rs=0.06:gs=0.01:bs=-0.07:rm=0.05:bm=-0.05:rh=0.03:bh=-0.04"
    )
    parts, labels = [], []
    for k, (a, b, sp, pre) in enumerate(SEGMENTS):
        parts.append(f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{sp},framerate={FPS},{pre}{grade},setsar=1[s{k}]")
        labels.append(f"[s{k}]")
    fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(SEGMENTS)}:v=1:a=0[v]"
    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src, "-filter_complex", fc, "-map", "[v]",
         "-pix_fmt", "rgb24", "-f", "rawvideo", "-"],
        stdout=subprocess.PIPE,
    )
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", dst],
        stdin=subprocess.PIPE,
    )

    frame_bytes = W * H * 3
    last = None
    outro_start = T - 2.4
    for i in range(n):
        t = i / FPS
        buf = dec.stdout.read(frame_bytes)
        if len(buf) < frame_bytes:
            buf = last
        last = buf
        video = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)

        if t < 2.8:  # ---- intro: letters pop in with footage inside
            mask = letter_mask(t)
            sh = clamp01((t - 1.3) / 1.2) if t > 1.3 else None
            out = title_frame(t, video, mask, clamp01((t - 1.6) / 0.6), sh)
            out = out * clamp01(t / 0.3 + 0.2)  # quick fade from black
        elif t < 3.8:  # ---- zoom through the text
            p = (t - 2.8) / 1.0
            s = 1 + 15 * ease_in_cubic(p)
            mask = zoom_mask(FULL_TEXT, s)
            out = title_frame(t, video, mask, 1 - clamp01(p * 3), None, bg_alpha=1 - ease_in_cubic(p))
        elif t < outro_start:  # ---- full footage section
            out = video * VIGNETTE
            flash = clamp01(1 - (t - 3.8) / 0.35)
            for c in cuts:  # gold light flash on every cut
                if c - 0.12 <= t < c + 0.4:
                    flash = max(flash, clamp01((t - c + 0.12) / 0.12) if t < c else clamp01(1 - (t - c) / 0.4))
            out = out + (GOLD_HI - out) * flash * 0.6
            a = clamp01((t - 4.2) / 0.6) * clamp01((outro_start - 0.2 - t) / 0.5)
            out = place(out, LOWER_TITLE, W / 2, H - 400, GOLD, a)
            out = place(out, LOWER_SUB, W / 2, H - 300, GOLD_HI, a * 0.95)
        else:  # ---- outro: zoom back out into the text
            p = clamp01((t - outro_start) / 0.9)
            s = 1 + 15 * (1 - ease_in_out(p)) ** 3
            mask = zoom_mask(FULL_TEXT, s)
            sh = clamp01((t - outro_start - 0.9) / 1.0) if t > outro_start + 0.9 else None
            out = title_frame(t, video, mask, clamp01((t - outro_start - 0.9) / 0.5), sh,
                              bg_alpha=ease_in_out(p))
            out = out * clamp01((T - t) / 0.5)

        sp = sparkle_layer(t, 0.9 if (t < 3.8 or t >= outro_start) else 0.55)[..., None]
        out = out * (1 - sp) + GOLD_HI * sp
        enc.stdin.write(np.clip(out, 0, 255).astype(np.uint8).tobytes())
        if i % 30 == 0:
            print(f"  {t:5.1f}s", flush=True)

    enc.stdin.close()
    enc.wait()
    dec.kill()
    print("video done", flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
