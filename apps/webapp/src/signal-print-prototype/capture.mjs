/**
 * Offline native-Canvas review, NOT a browser screenshot or UI verification.
 * Run from the repository root:
 *   node --import tsx apps/webapp/src/signal-print-prototype/capture.mjs
 * Canvas is an external review tool only; no repository dependency is added.
 * Set CANVAS_MODULE to a separately installed @napi-rs/canvas directory, or use
 * the Codex runtime's CODEX_PRIMARY_RUNTIME_NODE_MODULES.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { makeBackdrop, render } from "./renderer.ts";

const require = createRequire(import.meta.url);
const modulePath = process.env.CANVAS_MODULE
  ?? (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, "@napi-rs/canvas")
    : "@napi-rs/canvas");
const { createCanvas, GlobalFonts } = require(modulePath);
const fonts = [
  ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "ui-monospace"],
  ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "sans-serif"],
];
for (const [path, family] of fonts) {
  if (existsSync(path)) GlobalFonts.registerFromPath(path, family);
}
const output = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), "gallery"));
mkdirSync(output, { recursive: true });

// The production painter only uses document to allocate its cached background.
// This factory maps that single allocation to native Canvas; it is not a DOM.
globalThis.document = { createElement: () => createCanvas(1400, 800) };

const backgrounds = { hero: makeBackdrop("hero"), crowd: makeBackdrop("crowd") };
const canvas = createCanvas(1400, 800);
const ctx = canvas.getContext("2d");

function frame(view, ms, filename) {
  render(ctx, backgrounds[view], view, ms);
  writeFileSync(join(output, filename), canvas.toBuffer("image/png"));
}

frame("hero", 1750, "personnel-gather.png");
frame("hero", 2250, "personnel-strike.png");
frame("hero", 2667, "personnel-follow-through.png");
frame("crowd", 4500, "forty-bodies.png");

const frameDirectory = join(output, "motion-frames");
mkdirSync(frameDirectory, { recursive: true });
for (let i = 0; i < 48; i++) {
  frame("hero", 1250 + i * 1000 / 12, `motion-frames/frame-${String(i).padStart(3, "0")}.png`);
}
mkdirSync(join(output, "crowd-motion-frames"), { recursive: true });
for (let i = 0; i < 24; i++) {
  frame("crowd", 3800 + i * 1000 / 12, `crowd-motion-frames/frame-${String(i).padStart(3, "0")}.png`);
}

const python = process.env.CODEX_PRIMARY_RUNTIME_PYTHON ?? "python3";
const encoder = spawnSync(python, ["-c", `
from pathlib import Path
from PIL import Image, ImageChops
import sys, hashlib, json
root = Path(sys.argv[1])
frames = [Image.open(path).convert("RGB") for path in sorted((root / "motion-frames").glob("*.png"))]
crop = (150, 180, 600, 630)
art = [f.crop(crop) for f in frames]
hashes = [hashlib.sha256(f.tobytes()).hexdigest() for f in art]
changes = [sum(p != (0, 0, 0) for p in ImageChops.difference(a,b).getdata()) for a,b in zip(art,art[1:])]
strip = Image.new("RGB", (1350, 225))
for col, index in enumerate([0, 8, 12, 17, 28, 40]):
    strip.paste(art[index].resize((225,225), Image.Resampling.LANCZOS), (col*225,0))
strip.save(root / "actor-motion-strip.png")
contact = Image.new("RGB", (2240, 960))
for i, f in enumerate(frames):
    contact.paste(f.resize((280,160), Image.Resampling.LANCZOS), ((i%8)*280,(i//8)*160))
palette = contact.quantize(colors=128)
small_frames = [f.resize((840,480), Image.Resampling.LANCZOS).quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
small_frames[0].save(root / "personnel-motion.gif", save_all=True, append_images=small_frames[1:],
                     duration=[80, 80, 90] * 16, loop=0, optimize=True, disposal=1)
crowd_frames = [Image.open(path).convert("RGB") for path in sorted((root / "crowd-motion-frames").glob("*.png"))]
crowd_crop = (170,220,1140,720)
crowd_art = [f.crop(crowd_crop) for f in crowd_frames]
crowd_hashes = [hashlib.sha256(f.tobytes()).hexdigest() for f in crowd_art]
crowd_changes = [sum(p != (0,0,0) for p in ImageChops.difference(a,b).getdata()) for a,b in zip(crowd_art,crowd_art[1:])]
crowd_frames = [f.resize((840,480), Image.Resampling.LANCZOS).quantize(palette=palette, dither=Image.Dither.NONE) for f in crowd_frames]
crowd_frames[0].save(root / "crowd-motion.gif", save_all=True, append_images=crowd_frames[1:],
                     duration=[80,80,90]*8, loop=0, optimize=True, disposal=1)
for path in (root / "motion-frames").glob("*.png"):
    path.unlink()
(root / "motion-frames").rmdir()
for path in (root / "crowd-motion-frames").glob("*.png"):
    path.unlink()
(root / "crowd-motion-frames").rmdir()
print(json.dumps({"hero": {"actorCrop": list(crop), "excludes": "All captions and time labels", "uniqueArtFrames": len(set(hashes)), "adjacentPairs": len(changes), "minimumChangedPixels": min(changes), "maximumChangedPixels": max(changes), "sha256": hashes}, "crowd": {"actorCrop": list(crowd_crop), "excludes": "All captions and time labels", "uniqueArtFrames": len(set(crowd_hashes)), "adjacentPairs": len(crowd_changes), "minimumChangedPixels": min(crowd_changes), "maximumChangedPixels": max(crowd_changes), "sha256": crowd_hashes}}))
`, output], { encoding: "utf8" });
if (encoder.status !== 0) {
  throw new Error(`Pillow GIF encoding failed: ${encoder.stderr}`);
}
writeFileSync(join(output, "capture-metadata.json"), `${JSON.stringify({
  source: "renderer.ts render() + makeBackdrop(), unmodified production Canvas painter",
  runtime: "@napi-rs/canvas native offline rasterization; not browser screenshots",
  runtimeVersion: require(join(modulePath, "package.json")).version,
  size: [1400, 800],
  stills: { gather: 1750, strike: 2250, followThrough: 2667, crowd: 4500 },
  animation: { view: "hero", frames: 48, fps: 12, startMs: 1250, endMs: 1250 + 47 * 1000 / 12, gifSize: [840, 480], pixelProof: JSON.parse(encoder.stdout).hero },
  crowdAnimation: { view: "crowd", frames: 24, fps: 12, startMs: 3800, endMs: 3800 + 23 * 1000 / 12, gifSize: [840, 480], pixelProof: JSON.parse(encoder.stdout).crowd },
  caveat: "Canvas artwork reviewed offline. DOM layout, input handling and browser lifecycle remain unverified in this environment.",
}, null, 2)}\n`);
console.log(`Saved offline native-Canvas review to ${output}`);
