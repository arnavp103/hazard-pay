/** Offline capture of the same painter used by /prototype-emberwatch. */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { DURATION, renderBattle } from "../../../apps/webapp/src/emberwatch/scene.ts";
const require = createRequire(import.meta.url);
const canvasModule = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "@napi-rs/canvas")
  : "@napi-rs/canvas";
const { createCanvas, loadImage } = require(canvasModule);
const out = resolve(process.env.EMBERWATCH_CAPTURE_DIR || "docs/art-direction/emberwatch/captures");
await mkdir(out, { recursive: true });
const assetsRoot = resolve("apps/webapp/public/emberwatch");
const [field, units, brood, props] = await Promise.all(["aqueduct.png", "units.png", "brood.png", "props.png"].map((p) => loadImage(join(assetsRoot, p))));
const assets = { field, units, brood, props };
const canvas = createCanvas(640, 360);
const ctx = canvas.getContext("2d");
const stamps = [3, 10, 16.5, 22.8, 23.8, 30.5, 35.5, 43];
const sheet = createCanvas(1280, 1440);
const sheetCtx = sheet.getContext("2d");
for (const [i, time] of stamps.entries()) {
  const still = createCanvas(640, 360);
  renderBattle(still.getContext("2d"), assets, time);
  await writeFile(join(out, `frame-${String(i + 1).padStart(2, "0")}.png`), still.toBuffer("image/png"));
  sheetCtx.drawImage(still, i % 2 * 640, Math.floor(i / 2) * 360);
}
await writeFile(join(out, "contact-sheet.png"), sheet.toBuffer("image/png"));
renderBattle(ctx, assets, 10);
await writeFile(join(out, "poster.png"), canvas.toBuffer("image/png"));
if (process.argv.includes("--film")) {
  const encoder = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "640x360", "-r", "30", "-i", "pipe:0", "-an", "-vf", "scale=1280:720:flags=neighbor", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(out, "emberwatch-full.mp4")], { stdio: ["pipe", "inherit", "inherit"] });
  const finished = once(encoder, "close");
  encoder.stdin.on("error", (error) => {
    throw error;
  });
  for (let frame = 0; frame < DURATION * 30; frame++) {
    renderBattle(ctx, assets, frame / 30);
    if (!encoder.stdin.write(Buffer.from(ctx.getImageData(0, 0, 640, 360).data))) await once(encoder.stdin, "drain");
  }
  encoder.stdin.end();
  const [code] = await finished;
  if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
}
console.log(`Capture complete: ${out}`);
