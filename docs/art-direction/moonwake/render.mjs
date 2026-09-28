import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { paintMoonwake } from "../../../apps/webapp/src/moonwake/painter.ts";
const require = createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`);
const { createCanvas, Path2D } = require("@napi-rs/canvas");
globalThis.Path2D = Path2D;
const out = new URL("./", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const times = [3, 9.5, 16.7, 22.8, 28.95, 33];
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
const finisherTimes = [27.8, 28.65, 29.2, 30.8];
for (let i = 0; i < finisherTimes.length; i++) {
  const frame = createCanvas(900, 450);
  paintMoonwake(frame.getContext("2d"), finisherTimes[i], 900, 450);
  finishing.getContext("2d").drawImage(frame, i % 2 * 900, Math.floor(i / 2) * 450);
}
writeFileSync(`${out}finisher-poses.png`, finishing.toBuffer("image/png"));
if (process.argv.includes("--video")) {
  const videoCanvas = createCanvas(1280, 720);
  const vc = videoCanvas.getContext("2d");
  const ff = spawn("ffmpeg", ["-y", "-f", "rawvideo", "-pixel_format", "rgba", "-video_size", "1280x720", "-r", "24", "-i", "-", "-c:v", "libx264", "-preset", "fast", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${out}moonwake-full-encounter.mp4`], { stdio: ["pipe", "ignore", "inherit"] });
  for (let i = 0; i < 36 * 24; i++) {
    paintMoonwake(vc, i / 24, 1280, 720);
    if (!ff.stdin.write(vc.getImageData(0, 0, 1280, 720).data)) await once(ff.stdin, "drain");
  }
  ff.stdin.end();
  await once(ff, "close");
}
