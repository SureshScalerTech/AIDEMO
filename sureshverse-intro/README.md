# SureshVerse — Cinematic YouTube Channel Intro

A 12-second, 1920 × 1080, 30 fps animated channel intro for **SureshVerse** (*Explore. Learn. Create.*), built with plain HTML, Canvas 2D and the Web Audio API. It plays live in a browser and exports to a production MP4 frame by frame.

- **No runtime dependencies.** Just open the page. Playwright is used only by the exporter.
- **Original assets only.** The procedural Earth, the custom "S" emblem and the generic tech icons are all original. The soundtrack is synthesised, not sampled. The font is Montserrat (SIL Open Font License, included).
- **Deterministic.** Every frame is a pure function of time, so the MP4 export never drops frames and gives the same result on every run.

---

## 1. Folder structure

```
sureshverse-intro/
├── index.html                 Player page (autoplay, replay, controls)
├── css/style.css              16:9 responsive stage + controls
├── js/
│   ├── util.js                Seeded RNG, noise, easing, palette
│   ├── brand.js               Metallic 3D "S" emblem, wordmark, corner bug
│   ├── earth.js               Procedural Earth (sphere-mapped, city lights, atmosphere)
│   ├── scenes/
│   │   ├── cosmos.js          Scenes 1–2: space, Earth, beam, S, ring, particles → wordmark
│   │   ├── tech.js            Scene 3: neural globe, holographic panels, grid, light trails
│   │   ├── travel.js          Scene 4: sunset mountains, winding road, push-in
│   │   └── lockup.js          Scene 5: final lockup + fade to black
│   ├── intro.js               Timeline, transitions, motion blur, vignette, grain
│   ├── audio.js               Procedural soundtrack + WAV encoder (cue sheet inside)
│   └── player.js              Live playback, audio sync, scrubbing, shortcuts
├── assets/fonts/              Montserrat variable font + OFL licence
├── scripts/
│   ├── serve.mjs              Zero-dependency local web server
│   ├── export.mjs             Deterministic frame renderer → FFmpeg → MP4
│   └── qc.mjs                 Automated quality check + contact sheet
├── audio/                     Generated soundtrack WAV (created by export)
├── output/                    MP4s and QC images (created by export / qc)
└── package.json
```

## 2. Requirements (desktop)

| Tool | Version | Install |
|---|---|---|
| Node.js | 18 or newer | https://nodejs.org (LTS) |
| FFmpeg | 4.x or newer (with libx264 + aac) | **Windows:** `winget install Gyan.FFmpeg` · **macOS:** `brew install ffmpeg` · **Ubuntu/Debian:** `sudo apt install ffmpeg` |
| Chromium | installed by Playwright | `npx playwright install chromium` |

Check them with `node -v` and `ffmpeg -version`.

## 3. Install & preview

```bash
cd sureshverse-intro
npm install                       # installs Playwright (exporter only)
npx playwright install chromium   # one-time browser download for export
npm start                         # → http://localhost:8080
```

The intro **autoplays muted** on load, because browsers block sound until you interact with the page. Click **⟲ Replay** or the "Click to replay with sound" badge to watch it with audio.

| Control | Shortcut |
|---|---|
| Replay from start, with sound | `R` |
| Play / pause | `Space` |
| Sound on / off | `M` |
| Fullscreen | `F` |
| Scrub | timeline slider |

> You can also open `index.html` directly. Some browsers block the local font over `file://`, though, so `npm start` is the reliable way.

## 4. Export the MP4 (1920 × 1080, 30 fps)

```bash
npm run export            # → output/sureshverse-intro.mp4   (~1–3 min)
npm run qc                # verify + contact sheet in output/qc/
```

**How it works:** headless Chromium loads the page in export mode. For each frame *n*, it renders the exact time `n / 30` (never real time) and sends a lossless PNG to FFmpeg through a pipe. The soundtrack is rendered offline at 48 kHz and muxed in. The encode settings are H.264 High, CRF 14, `preset slow`, yuv420p, BT.709 colour tags, AAC 320 kbps and `+faststart`, which is what YouTube recommends for uploads.

By default each frame averages 3 sub-frames over a 180° shutter, which gives true motion blur. Options:

```bash
node scripts/export.mjs --preview            # fast 960×540 draft, no motion blur
node scripts/export.mjs --mb 5 --crf 12      # heavier blur, higher bitrate master
node scripts/export.mjs --frames             # also keep PNG sequence in output/frames/
node scripts/export.mjs --no-audio           # silent video
node scripts/export.mjs --audio my-track.wav # use your own music
node scripts/export.mjs --start 3 --end 6    # render a section
node scripts/export.mjs --chromium "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### Manual encode from a PNG sequence (alternative workflow)

```bash
node scripts/export.mjs --frames --no-audio
ffmpeg -framerate 30 -i output/frames/frame_%05d.png -i audio/sureshverse-soundtrack.wav \
  -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p \
  -vf "scale=out_color_matrix=bt709:out_range=tv" -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 320k -shortest -movflags +faststart output/sureshverse-intro.mp4
```

You can also import the PNG sequence into Premiere, DaVinci Resolve or After Effects at 30 fps.

## 5. Audio

The soundtrack (`js/audio.js`) is synthesised from oscillators, filtered noise and a generated reverb. It contains no samples, so it is 100% original and royalty-free. Each export also writes it to `audio/sureshverse-soundtrack.wav` (48 kHz, 16-bit stereo, about −14 LUFS).

### Cue sheet: replace or layer your own sound design

| Time (s) | Picture | Sound |
|---|---|---|
| 0.00 | Fade up on stars | Soft atmospheric pad (D minor 9) + space wind |
| 0.40 – 3.00 | Earth rises, sunrise flare | Rising futuristic synth + noise riser |
| 1.45 – 2.35 | Blue energy beam sweeps L → R | Whoosh panned left → right |
| 1.90 | S emerges from the light | Crystalline shimmer |
| **3.00** | Ring + shockwave, camera shake | **Deep cinematic impact** (sub drop, braam, burst) |
| 3.10 → 9.90 | | Pulsing arpeggio, 120 BPM |
| 3.45 – 4.70 | Particles converge into "SureshVerse" | Digital ticks |
| 5.20 | Shine sweep across the wordmark | Bell "ting" |
| 5.80 – 6.20 | Light-sweep transition | Fast digital whoosh |
| 6.00 – 8.00 | Tech showcase, panels at 6.12 / 6.26 / 6.40 / 6.54 | Tech accent, kick pulse, UI blips |
| 7.70 – 8.25 | Upward wipe into the sunset | Airy whoosh |
| 8.00 – 10.00 | Mountain road push-in | Warm C major swell, timpani |
| 9.35 – 10.00 | Push into the sun | Reverse swell / riser |
| **10.00** | Golden bloom → final lockup | **Orchestral-electronic hit** in D major, brass + bells |
| 11.25 – 12.00 | Logo hold → fade to black | Fade to silence |

**To use licensed music instead:** render a 12.0 s, 48 kHz WAV with its big hits at **3.00 s** and **10.00 s**, then run `node scripts/export.mjs --audio your-track.wav`. You can also drop the silent MP4 (`--no-audio`) into any NLE with the cue sheet above. Royalty-free sources include the YouTube Audio Library and Pixabay Music. Check each track's licence.

## 6. Quality-check procedure

1. **Automated:** `npm run qc` checks 1920×1080, 30.000 fps, 360 frames, 12.0 s, H.264/yuv420p/BT.709, the AAC audio stream, loudness (≈ −14 LUFS), true peak (≤ −0.5 dBTP), and the absence of blank frames between scenes. It also writes `output/qc/contact-sheet.jpg` and key stills.
2. **Visual pass:** watch the MP4 full-screen in VLC or a browser, once at normal speed and once frame by frame (`E` in VLC) through the transitions at 5.8–6.2, 7.7–8.25 and 9.8–10.3 s.
3. **Spelling:** confirm **SureshVerse** (capital S and V) appears correctly in Scene 2, in the corner bug during Scenes 3–4, and in the final lockup.
4. **Audio sync:** the impacts should land at 3.00 s (ring burst) and 10.00 s (golden bloom).
5. **Device check:** play on a phone. The text should stay readable at small sizes.
6. **YouTube:** upload as unlisted first and check it at 1080p to confirm colours and sharpness after YouTube's re-encode.

## 7. Customising

- **Timing:** each scene reads absolute time `t`. The transition windows are in `js/intro.js` and the score is in `A.build()` in `js/audio.js`. Change both together.
- **Colours:** `U.C` in `js/util.js`, plus the gradients in each scene.
- **Text:** the tagline and category line are in `js/scenes/cosmos.js` and `js/scenes/lockup.js`. Panel labels are in the `PANELS` array in `js/scenes/tech.js`.
- **Why Canvas 2D rather than Three.js:** all of the 3D effects (sphere-mapped Earth, rotating extruded S, projected neural globe, perspective road) are computed directly. That keeps the project free of dependencies, fast enough for real-time playback, and exactly reproducible for frame export.

## Credits & licences

- Montserrat font © The Montserrat Project Authors, SIL Open Font License 1.1 (`assets/fonts/OFL-Montserrat.txt`).
- All visuals and audio are generated procedurally by this project's code.
- "Azure" and "Copilot Studio" appear only as plain text topic labels. No Microsoft logos or trademarks are reproduced.
