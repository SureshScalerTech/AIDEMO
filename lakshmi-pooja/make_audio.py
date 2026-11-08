#!/usr/bin/env python3
"""Synthesised devotional bed for the Lakshmi Pooja reel (source clip is silent).

Tanpura-style drone (Sa / Pa / Sa'), temple-bell strikes on the title beats,
a rising whoosh for the zoom-through, and a soft flute-like melody line.
Usage: python3 make_audio.py <duration_seconds> <out.wav> [cut times, comma separated]
"""
import sys
import wave

import numpy as np

SR = 48000


def env_adsr(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def tanpura(t, f):
    # rich harmonic pluck re-struck every 1.6 s with "jawari" buzz
    out = np.zeros_like(t)
    period = 1.6
    for k, (ff, off) in enumerate([(f * 1.5 / 2, 0.0), (f, 0.4), (f, 0.8), (f / 2, 1.2)]):
        ph = (t - off) % period
        amp = np.exp(-ph * 1.3) * (t >= off)
        for h in range(1, 9):
            out += amp * np.sin(2 * np.pi * ff * h * t + h) / h ** 1.1 * (1 + 0.3 * np.sin(2 * np.pi * 0.7 * t * h))
    return out


def bell(t, t0, f0, gain):
    dt = t - t0
    m = dt >= 0
    out = np.zeros_like(t)
    partials = [(1.0, 1.0, 1.2), (2.76, 0.6, 2.0), (5.4, 0.35, 3.0), (8.93, 0.2, 4.5), (0.5, 0.4, 0.8)]
    for ratio, a, dec in partials:
        out[m] += a * np.sin(2 * np.pi * f0 * ratio * dt[m]) * np.exp(-dt[m] * dec)
    return out * gain


def flute(t, notes):
    out = np.zeros_like(t)
    for start, dur, f in notes:
        m = (t >= start) & (t < start + dur)
        dt = t[m] - start
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * dt) * np.clip(dt / 0.4, 0, 1)
        ph = 2 * np.pi * f * np.cumsum(vib) / SR
        e = np.clip(dt / 0.12, 0, 1) * np.clip((dur - dt) / 0.25, 0, 1)
        out[m] += e * (np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph))
    return out


def main(dur, path, cuts=()):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sa = 138.59  # C#3
    mix = 0.22 * tanpura(t, sa)

    # Flute in a Lakshmi-ish raga feel (Sa Re Ga Pa Dha)
    S, R, G, P, D = sa * 4, sa * 4 * 9 / 8, sa * 4 * 5 / 4, sa * 4 * 3 / 2, sa * 4 * 5 / 3
    notes = [(0.3, 0.9, S), (1.2, 0.5, R), (1.7, 1.0, G), (4.0, 0.6, P), (4.6, 0.6, D), (5.2, 1.2, P),
             (6.6, 0.5, G), (7.1, 0.5, R), (7.6, 1.4, G), (9.2, 0.5, P), (9.7, 0.5, G), (10.2, 1.8, S * 2 / 2)]
    notes = [x for x in notes if x[0] < dur - 0.5]
    mix += 0.16 * flute(t, notes)

    # Bells: title hits, reveal, outro
    for t0, f0, g in [(0.05, 880, 0.35), (0.6, 660, 0.25), (3.8, 520, 0.55), (dur - 1.5, 880, 0.35), (dur - 1.0, 660, 0.3)]:
        if 0 <= t0 < dur:
            mix += bell(t, t0, f0, g)

    for c in cuts:  # light bell on each shot change
        mix += bell(t, c, 1320, 0.12)

    # Whoosh 2.8 -> 3.8 s (filtered noise rising)
    rng = np.random.default_rng(1)
    noise = rng.standard_normal(n)
    for a, b, g in [(2.8, 3.85, 0.35), (dur - 2.4, dur - 1.5, 0.25)]:
        m = (t >= a) & (t < b)
        x = noise[m]
        k = np.linspace(0, 1, m.sum())
        alpha = 0.02 + 0.5 * k  # one-pole low-pass opening up
        y = np.zeros_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc += alpha[i] * (x[i] - acc)
            y[i] = acc
        mix[m] += g * y * (k ** 2) * np.clip((1 - k) / 0.05, 0, 1) * 3

    mix *= env_adsr(n, 0.4, 0.8)
    mix /= np.max(np.abs(mix)) / 0.85
    st = np.stack([mix, np.roll(mix, int(0.012 * SR)) * 0.95], 1)  # simple stereo widening
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    cuts = [float(x) for x in sys.argv[3].split(",")] if len(sys.argv) > 3 else []
    main(float(sys.argv[1]), sys.argv[2], cuts)
