// Deterministic frame-by-frame MP4 export.
//
// Opens the intro in headless Chromium, renders every frame at an exact time
// (frame / fps — never real-time, so no dropped frames), pipes lossless PNGs
// into FFmpeg and muxes the offline-rendered soundtrack.
//
//   node scripts/export.mjs [options]
//     --comp <name>       intro | outro          (default intro)
//     --out <file>        output MP4             (default output/sureshverse-<comp>.mp4)
//     --fps <n>           frame rate             (default 30)
//     --start <s>         first second           (default 0)
//     --end <s>           last second            (default: full length, 12 / 15)
//     --mb <n>            motion-blur sub-frames (default 3, 1 = off)
//     --crf <n>           x264 quality, lower = better (default 14)
//     --preview           fast 960×540 draft (mb 1, crf 22, veryfast)
//     --frames            also keep PNG frames in output/frames/
//     --no-audio          video only
//     --audio <file.wav>  mux your own track instead of the generated one
//     --guide             draw the end-screen element guide (outro only)
//     --chromium <path>   use a specific Chrome/Chromium executable
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const o = { comp: "intro", out: null, fps: 30, start: 0, end: null, guide: false, mb: 3, crf: 14, preview: false, frames: false, audio: true, audioFile: null, chromium: process.env.CHROMIUM_PATH || null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => argv[++i];
    if (a === "--comp") o.comp = v();
    else if (a === "--guide") o.guide = true;
    else if (a === "--out") o.out = v();
    else if (a === "--fps") o.fps = Number(v());
    else if (a === "--start") o.start = Number(v());
    else if (a === "--end") o.end = Number(v());
    else if (a === "--mb") o.mb = Math.max(1, Number(v()));
    else if (a === "--crf") o.crf = Number(v());
    else if (a === "--preview") o.preview = true;
    else if (a === "--frames") o.frames = true;
    else if (a === "--no-audio") o.audio = false;
    else if (a === "--audio") o.audioFile = v();
    else if (a === "--chromium") o.chromium = v();
    else if (a === "-h" || a === "--help") {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(0, 24).join("\n"));
      process.exit(0);
    } else throw new Error(`Unknown option ${a}`);
  }
  if (!["intro", "outro"].includes(o.comp)) throw new Error(`Unknown --comp ${o.comp} (use intro or outro)`);
  if (o.preview) {
    o.mb = 1;
    o.crf = 22;
  }
  if (!o.out) o.out = `output/sureshverse-${o.comp}${o.preview ? "-preview" : o.guide ? "-guide" : ""}.mp4`;
  return o;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    try {
      return await import("playwright-core");
    } catch {
      console.error("Playwright is not installed. Run:  npm install  &&  npx playwright install chromium");
      process.exit(1);
    }
  }
}

function checkFfmpeg() {
  return new Promise((resolve) => {
    const p = spawn(process.env.FFMPEG_PATH || "ffmpeg", ["-version"]);
    p.on("error", () => resolve(false));
    p.on("close", (c) => resolve(c === 0));
  });
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  if (!(await checkFfmpeg())) {
    console.error("FFmpeg not found. Install it (see README) or set FFMPEG_PATH.");
    process.exit(1);
  }
  const outFile = path.resolve(ROOT, o.out);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const framesDir = path.join(ROOT, "output", "frames");
  if (o.frames) {
    fs.rmSync(framesDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
  }

  const server = await startServer(0);
  const port = server.address().port;
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    executablePath: o.chromium || undefined,
    args: ["--autoplay-policy=no-user-gesture-required", "--force-color-profile=srgb", "--disable-lcd-text"],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.error("[page error]", e.message));
  page.on("console", (m) => m.type() === "error" && console.error("[page]", m.text()));
  const pageFile = o.comp === "outro" ? "outro.html" : "index.html";
  await page.goto(`http://127.0.0.1:${port}/${pageFile}?mode=export${o.guide ? "&guide=1" : ""}`);
  await page.waitForFunction(() => window.SV && window.SV.ready);
  await page.evaluate(() => window.SV.ready);
  const duration = await page.evaluate(() => window.SV.comp.DURATION);
  if (o.end == null || o.end > duration) o.end = duration;
  console.log(`Composition: ${o.comp} (${duration}s) → ${o.out}`);

  // ---- audio ----
  let audioPath = null;
  if (o.audio) {
    if (o.audioFile) {
      audioPath = path.resolve(o.audioFile);
    } else {
      process.stdout.write("Rendering soundtrack… ");
      const b64 = await page.evaluate((name) => window.SV.audio.wavBase64(name), o.comp);
      audioPath = path.join(ROOT, "audio", o.comp === "intro" ? "sureshverse-soundtrack.wav" : `sureshverse-${o.comp}-soundtrack.wav`);
      fs.mkdirSync(path.dirname(audioPath), { recursive: true });
      fs.writeFileSync(audioPath, Buffer.from(b64, "base64"));
      console.log(`done → ${path.relative(ROOT, audioPath)}`);
    }
  }

  // ---- ffmpeg ----
  const total = Math.round((o.end - o.start) * o.fps);
  const vf = [o.preview ? "scale=960:540:flags=lanczos" : null, "scale=out_color_matrix=bt709:out_range=tv", "format=yuv420p"].filter(Boolean).join(",");
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(o.fps), "-c:v", "png", "-i", "-"];
  if (audioPath) args.push("-ss", String(o.start), "-i", audioPath);
  args.push(
    "-map", "0:v",
    ...(audioPath ? ["-map", "1:a", "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-shortest"] : []),
    "-c:v", "libx264", "-preset", o.preview ? "veryfast" : "slow", "-crf", String(o.crf),
    "-tune", "film", "-profile:v", "high", "-g", String(o.fps),
    "-vf", vf,
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-r", String(o.fps), "-movflags", "+faststart",
    outFile
  );
  const ff = spawn(ffmpeg, args, { stdio: ["pipe", "inherit", "inherit"] });
  const ffDone = new Promise((res, rej) => {
    ff.on("error", rej);
    ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited with ${c}`))));
  });

  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = o.start + i / o.fps;
    const b64 = await page.evaluate(
      ([t, mb]) => {
        window.SV.comp.renderBlurred(t, mb, 0.5);
        return window.SV.comp.canvas().toDataURL("image/png").slice(22);
      },
      [t, o.mb]
    );
    const png = Buffer.from(b64, "base64");
    if (o.frames) fs.writeFileSync(path.join(framesDir, `frame_${String(i).padStart(5, "0")}.png`), png);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 10 === 0 || i === total - 1) {
      const el = (Date.now() - t0) / 1000;
      const eta = (el / (i + 1)) * (total - i - 1);
      process.stdout.write(`\rFrame ${i + 1}/${total}  t=${t.toFixed(2)}s  elapsed ${fmt(el)}  eta ${fmt(eta)}   `);
    }
  }
  ff.stdin.end();
  await ffDone;
  console.log(`\nDone → ${path.relative(ROOT, outFile)}`);
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
