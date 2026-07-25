/**
 * THROWAWAY PROTOTYPE (#82): the bake driver. `pnpm --filter
 * @hazard-pay/webapp bake`.
 *
 * Shells out to Blender, validates what comes back, compiles the atlas, and
 * writes both the runtime assets and the evidence the gallery needs.
 *
 * Why execa and not zx: this needs exactly one subprocess call with an argv
 * ARRAY (paths go straight through, no shell quoting, no injection surface)
 * and a rejection that carries stderr — Blender's failure modes here are a
 * Python traceback and a segfault, and both only show up on stderr. zx would
 * bring a whole shell DSL plus implicit globals into an ESLint config that
 * bans them, to buy nothing. `node:child_process` would also do, at the cost
 * of hand-rolling the promise and the stderr-bearing error; execa is the
 * smaller amount of code to be responsible for.
 *
 * Blender's stdout is NOT parsed. It is chatty and its format is not a
 * contract; the only thing this reads back is the manifest file.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { PNG } from "pngjs";

import { ANCHOR, ATLAS_BASENAME, ATLAS_PUBLIC_DIR, CELL } from "../framing.ts";
import { consolidate } from "../consolidate.ts";
import { DIRECTION_B_PALETTE, quantizeToPalette } from "../palette.ts";
import { compile } from "./compile.ts";
import { DEFAULT_INK, inkSprite } from "./ink.ts";
import {
  assertManifestMatchesSpec,
  type BakeManifest,
  bakeManifestSchema,
  type BakeSpec,
  buildSpec,
} from "./seam.ts";

const here = dirname(fileURLToPath(import.meta.url));
const laneDir = dirname(here);
const webappDir = join(laneDir, "..", "..", "..");
const workDir = join(webappDir, ".bake");
const publicDir = join(webappDir, "public", ATLAS_PUBLIC_DIR);
const shotsDir = join(webappDir, "screenshots", "blender-baked-lane");
const scriptPath = join(here, "medic_bake.py");

/** The comparison crop, relative to the cell anchor. */
const CROP = { x: ANCHOR.x - 18, y: ANCHOR.y - 36, width: 36, height: 42 };
const COMPARE_FACINGS = [0, 2, 6];

async function runBlender(spec: BakeSpec, specPath: string): Promise<BakeManifest> {
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  const started = Date.now();
  await execa("blender", ["-b", "-P", scriptPath, "--", specPath], {
    // Blender is loud and its stdout is not a contract; keep it out of the way
    // but hold on to stderr so a Python traceback survives into the rejection.
    stdout: "ignore",
    stderr: "pipe",
    timeout: 15 * 60 * 1000,
  });
  const wallClockMs = Date.now() - started;

  const manifest = bakeManifestSchema.parse(JSON.parse(readFileSync(spec.manifestPath, "utf8")));
  assertManifestMatchesSpec(manifest, spec);
  process.stdout.write(
    `  blender ${manifest.generator} · ${manifest.engine} · ${String(manifest.partCount)} parts · `
    + `${String(manifest.timing.renderCount)} renders in ${manifest.timing.renderSeconds.toFixed(2)}s `
    + `(${(wallClockMs / 1000).toFixed(2)}s wall clock incl. startup)\n`,
  );
  return manifest;
}

/** Box-downsample an RGBA buffer by an integer factor, alpha-weighted. */
function boxDownsample(src: Uint8Array, width: number, height: number, factor: number): Uint8Array {
  const outW = width / factor;
  const outH = height / factor;
  const out = new Uint8Array(outW * outH * 4);
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < factor; sy += 1) {
        for (let sx = 0; sx < factor; sx += 1) {
          const i = ((y * factor + sy) * width + x * factor + sx) * 4;
          const alpha = (src[i + 3] ?? 0) / 255;
          r += (src[i] ?? 0) * alpha;
          g += (src[i + 1] ?? 0) * alpha;
          b += (src[i + 2] ?? 0) * alpha;
          a += alpha;
        }
      }
      const o = (y * outW + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / (factor * factor)) * 255);
    }
  }
  return out;
}

/** Lay cropped cells out in one horizontal strip with a transparent gutter. */
function strip(cells: Uint8Array[]): PNG {
  const gap = 2;
  const png = new PNG({
    width: cells.length * CROP.width + (cells.length - 1) * gap,
    height: CROP.height,
  });
  png.data.fill(0);
  cells.forEach((cell, index) => {
    const ox = index * (CROP.width + gap);
    for (let y = 0; y < CROP.height; y += 1) {
      for (let x = 0; x < CROP.width; x += 1) {
        const from = ((CROP.y + y) * CELL.width + CROP.x + x) * 4;
        const to = (y * png.width + ox + x) * 4;
        png.data[to] = cell[from] ?? 0;
        png.data[to + 1] = cell[from + 1] ?? 0;
        png.data[to + 2] = cell[from + 2] ?? 0;
        png.data[to + 3] = cell[from + 3] ?? 0;
      }
    }
  });
  return png;
}

/**
 * The lane's own risk, answered with pixels: is a quantized bake deliberate
 * pixel art, or a shrunken 3D render?
 *
 *  - `shrunk`    — the naive thing: render at 8x, box-downsample to cell size.
 *  - `native`    — the same pose rendered at 1x with a ~0 reconstruction
 *                  filter, straight out of Blender, full colour.
 *  - `quantized` — native forced onto the 33-entry Direction B palette.
 *  - `inked`     — quantized plus the 1-px contour and internal seams.
 *
 * Same rig, same camera, same frame. The route renders the four with labels.
 */
async function buildQuantizationComparison(): Promise<void> {
  const hiDir = join(workDir, "compare-8x");
  const loDir = join(workDir, "compare-1x");
  const variants: Record<string, Uint8Array[]> = {
    consolidated: [], inked: [], native: [], quantized: [], shrunk: [],
  };

  const bakeOne = async (dir: string, supersample: number): Promise<BakeManifest> => {
    rmSync(dir, { force: true, recursive: true });
    mkdirSync(dir, { recursive: true });
    const spec = buildSpec(dir, join(dir, "manifest.json"), supersample);
    spec.clips = [{ name: "idle", frames: 1, fps: 8 }];
    return runBlender(spec, join(dir, "spec.json"));
  };

  const hi = await bakeOne(hiDir, 8);
  const lo = await bakeOne(loDir, 1);
  const read = (dir: string, file: string): Uint8Array =>
    Uint8Array.from(PNG.sync.read(readFileSync(join(dir, file))).data);

  for (const facing of COMPARE_FACINGS) {
    const hiFrame = hi.frames.find((f) => f.facing === facing);
    const loFrame = lo.frames.find((f) => f.facing === facing);
    if (hiFrame === undefined || loFrame === undefined) {
      throw new Error("comparison bake is missing a facing");
    }
    variants.shrunk?.push(
      boxDownsample(read(hiDir, hiFrame.color), CELL.width * 8, CELL.height * 8, 8),
    );
    const native = read(loDir, loFrame.color);
    variants.native?.push(native);
    const quantized = new Uint8Array(native);
    quantizeToPalette(quantized, CELL.width, CELL.height);
    variants.quantized?.push(Uint8Array.from(quantized));
    consolidate(quantized, CELL.width, CELL.height, 2);
    variants.consolidated?.push(Uint8Array.from(quantized));
    variants.inked?.push(
      inkSprite(quantized, read(loDir, loFrame.id), CELL.width, CELL.height, DEFAULT_INK),
    );
  }

  for (const [name, cells] of Object.entries(variants)) {
    writeFileSync(join(publicDir, `compare-${name}.png`), PNG.sync.write(strip(cells)));
  }
  process.stdout.write(`  wrote ${String(Object.keys(variants).length)} comparison strips to public/${ATLAS_PUBLIC_DIR}\n`);
}

async function main(): Promise<void> {
  mkdirSync(workDir, { recursive: true });
  writeFileSync(join(workDir, ".gitignore"), "*\n");
  mkdirSync(publicDir, { recursive: true });
  mkdirSync(shotsDir, { recursive: true });

  const sheetWork = join(workDir, "frames");
  rmSync(sheetWork, { force: true, recursive: true });
  mkdirSync(sheetWork, { recursive: true });

  process.stdout.write("baking the field medic…\n");
  const spec = buildSpec(sheetWork, join(sheetWork, "manifest.json"));
  const wallStart = Date.now();
  const manifest = await runBlender(spec, join(sheetWork, "spec.json"));

  const image = `${ATLAS_BASENAME}.png`;
  const result = compile(manifest, sheetWork, image);
  writeFileSync(join(publicDir, image), result.png);
  writeFileSync(join(publicDir, `${ATLAS_BASENAME}.json`), `${JSON.stringify(result.sheet, null, 2)}\n`);
  const wallClockSeconds = (Date.now() - wallStart) / 1000;

  if (result.mismatchedPixels !== 0) {
    throw new Error(`atlas round-trip failed: ${String(result.mismatchedPixels)} pixels differ`);
  }

  const { cost } = result;
  writeFileSync(
    join(shotsDir, "atlas-cost.json"),
    `${JSON.stringify({
      ...cost,
      paletteSize: DIRECTION_B_PALETTE.length,
      blenderRenderSeconds: manifest.timing.renderSeconds,
      blenderTotalSeconds: manifest.timing.totalSeconds,
      bakeWallClockSeconds: Number(wallClockSeconds.toFixed(2)),
      atlasRoundTripMismatchedPixels: result.mismatchedPixels,
    }, null, 2)}\n`,
  );

  process.stdout.write(
    `  ${String(cost.facings)} facings x ${String(cost.animations)} animations `
    + `x ${String(cost.framesPerFacing)} frames = ${String(cost.cells)} cells of `
    + `${String(cost.cellWidth)}x${String(cost.cellHeight)}\n`
    + `  uniform grid would be ${String(cost.uniformGrid.width)}x${String(cost.uniformGrid.height)}; `
    + `trimmed atlas is ${String(cost.trimmed.width)}x${String(cost.trimmed.height)} `
    + `(${(cost.trimmed.occupancy * 100).toFixed(1)}% occupied)\n`
    + `  atlas PNG ${(cost.indexedPngBytes / 1024).toFixed(1)} KiB indexed `
    + `(${(cost.rgbaPngBytes / 1024).toFixed(1)} KiB as truecolour)\n`
    + `  palette ${String(cost.paletteEntriesUsed)}/${String(DIRECTION_B_PALETTE.length)} entries used · `
    + `atlas round-trip exact\n`
    + `  bake wall clock ${wallClockSeconds.toFixed(2)}s\n`,
  );

  await buildQuantizationComparison();
}

await main();
