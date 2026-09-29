import { createRequire } from "node:module";
import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { paintMoonwake } from "../../../apps/webapp/src/moonwake/painter.ts";
const require = createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`);
const { createCanvas, Path2D } = require("@napi-rs/canvas");
globalThis.Path2D = Path2D;
globalThis.OffscreenCanvas = require("@napi-rs/canvas").Canvas;
const out = new URL("./", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const times = [2, 9, 12, 20, 29, 42];
const sheet = createCanvas(1600, 1350);
for (let i = 0; i < times.length; i++) {
  const canvas = createCanvas(1600, 900);
  const context = canvas.getContext("2d");
  paintMoonwake(context, times[i]);
  writeFileSync(`${out}frame-${times[i]}.png`, canvas.toBuffer("image/png"));
  sheet.getContext("2d").drawImage(canvas, i % 2 * 800, Math.floor(i / 2) * 450, 800, 450);
}
writeFileSync(`${out}contact-sheet.png`, sheet.toBuffer("image/png"));
const finishing = createCanvas(1800, 900);
const finisherTimes = [33.55, 34.12, 34.42, 35.1];
for (let i = 0; i < finisherTimes.length; i++) {
  const frame = createCanvas(1600, 900);
  paintMoonwake(frame.getContext("2d"), finisherTimes[i]);
  finishing.getContext("2d").drawImage(frame, 550, 300, 600, 300, i % 2 * 900, Math.floor(i / 2) * 450, 900, 450);
}
writeFileSync(`${out}finisher-poses.png`, finishing.toBuffer("image/png"));
// Isolate native canvas lifetimes: six sequential chunks keep a full capture bounded.
if (process.argv.includes("--video")) {
  const parts = [];
  for (let start = 0; start < 42; start += 7) {
    const child = spawn(process.execPath, ["--expose-gc", fileURLToPath(import.meta.url), "--segment", String(start), String(start + 7)], { stdio: "inherit" });
    const [code] = await once(child, "close");
    if (code !== 0) throw new Error(`Capture failed at ${start}s with status ${code}`);
    parts.push(`${out}moonwake-part-${start}.mp4`);
  }
  writeFileSync(`${out}film-parts.txt`, parts.map((part) => `file '${part}'`).join("\n"));
  const concat = spawn("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", `${out}film-parts.txt`, "-c", "copy", "-movflags", "+faststart", `${out}moonwake-full-encounter.mp4`], { stdio: "inherit" });
  const [code] = await once(concat, "close");
  if (code !== 0) throw new Error(`Film assembly failed with status ${code}`);
  for (const part of parts) unlinkSync(part);
  unlinkSync(`${out}film-parts.txt`);
}
if (process.argv.includes("--segment")) {
  const arg = process.argv.indexOf("--segment");
  const start = Number(process.argv[arg + 1]);
  const end = Number(process.argv[arg + 2]);
  const videoCanvas = createCanvas(1280, 720);
  const vc = videoCanvas.getContext("2d");
  const ff = spawn("ffmpeg", ["-y", "-f", "rawvideo", "-pixel_format", "rgba", "-video_size", "1280x720", "-r", "24", "-i", "-", "-c:v", "libx264", "-preset", "fast", "-threads", "2", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${out}moonwake-part-${start}.mp4`], { stdio: ["pipe", "ignore", "inherit"] });
  for (let i = start * 24; i < end * 24; i++) {
    vc.reset();
    paintMoonwake(vc, i / 24, 1280, 720);
    if (!ff.stdin.write(vc.getImageData(0, 0, 1280, 720).data)) await once(ff.stdin, "drain");
    if (i % 12 === 0) globalThis.gc?.();
  }
  ff.stdin.end();
  const [code] = await once(ff, "close");
  if (code !== 0) throw new Error(`Encoder failed with status ${code}`);
}
