/** Offline renderer evidence. Does not launch or impersonate a browser. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const canvasPackage = process.env.PIXEL_NOIR_CANVAS_MODULE
  ?? (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "@napi-rs/canvas") : "@napi-rs/canvas");
const { createCanvas, GlobalFonts } = require(canvasPackage);
const mono = process.env.PIXEL_NOIR_MONO_FONT ?? "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
if (existsSync(mono)) {
  for (const alias of ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"]) {
    GlobalFonts.registerFromPath(mono, alias);
  }
}
// The only DOM facility used by painter.ts is temporary offscreen canvas allocation.
globalThis.document = { createElement: () => createCanvas(1, 1) };
const { paint, WIDTH, HEIGHT } = await import("./painter.ts");
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "gallery");
const frames = mkdtempSync(join(tmpdir(), "pixel-noir-frames-"));
mkdirSync(out, { recursive: true });
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext("2d");
const hash = (data) => createHash("sha256").update(data).digest("hex");
const metadata = { renderer: "Offline @napi-rs/canvas, actual painter.ts + motion.ts; not a browser screenshot", width: WIDTH, height: HEIGHT, fps: 12, rain: false, stills: [], sequences: [] };
for (const view of ["hero", "crowd", "lineup"]) {
  paint(ctx, 8 / 12, view, "attack", false);
  const buffer = canvas.toBuffer("image/png");
  const filename = `${view}.png`;
  writeFileSync(join(out, filename), buffer);
  metadata.stills.push({ filename, view, seconds: 8 / 12, action: "attack", sha256: hash(buffer) });
}
const sequences = [
  { name: "hero-attack", count: 48, view: "hero", frame: (i) => ({ action: "attack", seconds: i / 12 }) },
  { name: "hero-motion", count: 96, view: "hero", frame: (i) => ({ action: ["idle", "walk", "turn", "stagger"][Math.floor(i / 24)], seconds: (i % 24) / 12 * (i >= 48 && i < 72 ? 3 : 1) }) },
  { name: "crowd-motion", count: 24, view: "crowd", frame: (i) => ({ action: "attack", seconds: 2 + i / 12 }) },
];
for (const sequence of sequences) {
  const records = [];
  for (let index = 0; index < sequence.count; index++) {
    const frame = sequence.frame(index);
    paint(ctx, frame.seconds, sequence.view, frame.action, false);
    const filename = `${sequence.name}-${index.toString().padStart(3, "0")}.png`;
    writeFileSync(join(frames, filename), canvas.toBuffer("image/png"));
    // Isolate actual moving art, excluding footer time, labels, static notes and rain.
    const crop = sequence.view === "hero" ? [200, 165, 505, 310] : [135, 130, 665, 320];
    const pixels = ctx.getImageData(...crop).data;
    records.push({ index, ...frame, artCropSha256: hash(pixels) });
  }
  const uniqueArtFrames = new Set(records.map((frame) => frame.artCropSha256)).size;
  if (uniqueArtFrames < 8) {
    throw new Error(`${sequence.name}: fewer than eight distinct art poses`);
  }
  metadata.sequences.push({ name: sequence.name, frames: sequence.count, fps: 12, uniqueArtFrames, records });
}
writeFileSync(join(frames, "metadata.json"), JSON.stringify(metadata, null, 2));
const result = spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON ?? "python3", [join(here, "encode-gallery.py"), frames, out], { stdio: "inherit" });
if (result.status !== 0) {
  throw new Error("GIF encoding failed; intermediate frames retained at " + frames);
}
writeFileSync(join(out, "capture-metadata.json"), JSON.stringify(metadata, null, 2) + "\n");
rmSync(frames, { recursive: true });
console.log(JSON.stringify({ output: out, sequences: metadata.sequences.map(({ name, frames, uniqueArtFrames }) => ({ name, frames, uniqueArtFrames })) }, null, 2));
