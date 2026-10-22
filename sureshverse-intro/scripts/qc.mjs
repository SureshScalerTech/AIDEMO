// Quality check for the exported MP4.
//   node scripts/qc.mjs [file.mp4]
// Verifies resolution / fps / frame count / duration / audio, measures loudness,
// and writes a contact sheet + key-frame stills to output/qc/.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.resolve(ROOT, process.argv[2] || "output/sureshverse-intro.mp4");
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobe = process.env.FFPROBE_PATH || "ffprobe";
const qcDir = path.join(ROOT, "output", "qc");
fs.mkdirSync(qcDir, { recursive: true });

if (!fs.existsSync(file)) {
  console.error(`Not found: ${file}\nRun "npm run export" first.`);
  process.exit(1);
}

const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20 });
let failed = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(22)} ${detail}`);
  if (!ok) failed++;
};

const probe = JSON.parse(run(ffprobe, ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", file]).stdout);
const v = probe.streams.find((s) => s.codec_type === "video");
const a = probe.streams.find((s) => s.codec_type === "audio");
const [fn, fd] = v.r_frame_rate.split("/").map(Number);
const fps = fn / fd;
const dur = Number(probe.format.duration);
const frames = Number(v.nb_read_frames);

check("resolution", v.width === 1920 && v.height === 1080, `${v.width}×${v.height}`);
check("frame rate", Math.abs(fps - 30) < 0.01, `${fps.toFixed(3)} fps`);
check("frame count", frames >= 358 && frames <= 362, `${frames} frames`);
check("duration", dur >= 11.9 && dur <= 12.1, `${dur.toFixed(3)} s`);
check("video codec", v.codec_name === "h264" && v.pix_fmt === "yuv420p", `${v.codec_name} ${v.profile} ${v.pix_fmt} ${v.color_space || ""}`);
check("audio stream", !!a, a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels}ch ${Math.round(a.bit_rate / 1000)} kbps` : "none");

if (a) {
  const ld = run(ffmpeg, ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
  const I = Number((ld.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop()?.match(/-?[\d.]+/)[0]);
  const TP = Number((ld.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).pop()?.match(/-?[\d.]+/)[0]);
  check("loudness", I > -20 && I < -10, `${I} LUFS integrated (YouTube normalises to ≈ -14)`);
  check("true peak", TP <= -0.5, `${TP} dBTP`);
}

// black first/last frames are intended; check the middle isn't black anywhere
const bd = run(ffmpeg, ["-hide_banner", "-i", file, "-vf", "blackdetect=d=0.15:pic_th=0.97", "-an", "-f", "null", "-"]).stderr;
const blacks = [...bd.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const midBlack = blacks.filter(([s, e]) => s > 0.4 && e < 11.6);
check("no blank gaps", midBlack.length === 0, blacks.length ? blacks.map(([s, e]) => `${s.toFixed(2)}–${e.toFixed(2)}s`).join(", ") + " (start/end fades expected)" : "none");

// contact sheet: one frame every half second
run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-vf", "select='not(mod(n\\,15))',scale=384:-1,tile=6x4:padding=4:color=black", "-frames:v", "1", "-update", "1", path.join(qcDir, "contact-sheet.jpg")]);
for (const s of [1.5, 2.6, 4.2, 5.5, 6.0, 7.0, 8.0, 9.0, 10.0, 11.2]) {
  run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(s), "-i", file, "-frames:v", "1", "-update", "1", path.join(qcDir, `still_${s.toFixed(1)}s.jpg`)]);
}
console.log(`\nContact sheet and stills → ${path.relative(ROOT, qcDir)}/`);
console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
