/**
 * THROWAWAY PROTOTYPE (#82): the bake driver. `pnpm --filter
 * @hazard-pay/webapp bake`.
 *
 * Shells out to Blender, validates what comes back, compiles the atlases, and
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
 *
 * Round 4 added the crowd bakes. Where a hand-authored lane owes a second set
 * of drawings for every on-screen size, this drives the same rigs through the
 * same seam at a different world scale, twice, and reports what that cost.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { execa } from "execa";
import { PNG } from "pngjs";

import { islandStats } from "../consolidate.ts";
import { buildRoster, crowdMotionStats, FACING_NOTE, lockFacings, TREATMENTS } from "../crowd.ts";
import {
  ANCHOR,
  ATLAS_BASENAME,
  ATLAS_PUBLIC_DIR,
  CELL,
  CROWD_CONFIGS,
  type CrowdConfig,
} from "../framing.ts";
import { consolidate } from "../consolidate.ts";
import { DIRECTION_B_PALETTE, FACTION_B_LIVERY, quantizeToPalette } from "../palette.ts";
import { compile, compileAtlas, type CompileInput } from "./compile.ts";
import { DEFAULT_INK, inkSprite } from "./ink.ts";
import {
  assertManifestMatchesSpec,
  type BakeManifest,
  bakeManifestSchema,
  type BakeSpec,
  buildSpec,
  buildUnitSpec,
} from "./seam.ts";

const here = dirname(fileURLToPath(import.meta.url));
const laneDir = dirname(here);
const webappDir = join(laneDir, "..", "..", "..");
const workDir = join(webappDir, ".bake");
const publicDir = join(webappDir, "public", ATLAS_PUBLIC_DIR);
const shotsDir = join(webappDir, "screenshots", "blender-baked-lane");
const scriptPath = join(here, "unit_bake.py");

/** The comparison crop, relative to the cell anchor. */
const CROP = { x: ANCHOR.x - 18, y: ANCHOR.y - 36, width: 36, height: 42 };
const COMPARE_FACINGS = [0, 2, 6];

async function runBlender(spec: BakeSpec, specPath: string): Promise<BakeManifest> {
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
  const started = Date.now();
  await execa("blender", ["-b", "-P", scriptPath, "--", specPath], {
    // Blender is loud and its stdout is not a contract; keep it out of the way
    // but hold on to stderr so a Python traceback survives into the rejection.
    stderr: "pipe",
    stdout: "ignore",
    timeout: 15 * 60 * 1000,
  });
  const wallClockMs = Date.now() - started;

  const manifest = bakeManifestSchema.parse(JSON.parse(readFileSync(spec.manifestPath, "utf8")));
  assertManifestMatchesSpec(manifest, spec);
  process.stdout.write(
    `  ${manifest.unit} @${manifest.unitScale.toFixed(3)}x · ${String(manifest.partCount)} parts `
    + `(${String(manifest.droppedDetails)} details below the readable floor) · `
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
    height: CROP.height,
    width: cells.length * CROP.width + (cells.length - 1) * gap,
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
 *  - `quantized` — native forced onto the 35-entry Direction B palette.
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
    // This row is captioned "what ships in the atlas", so it has to BE that:
    // same ink pass, same post-ink consolidation. i3 caught the audit sheet
    // understating the artifact by 2x because this step was missing here.
    const inked = inkSprite(quantized, read(loDir, loFrame.id), CELL.width, CELL.height, DEFAULT_INK);
    consolidate(inked, CELL.width, CELL.height, 2);
    variants.inked?.push(inked);
  }

  for (const [name, cells] of Object.entries(variants)) {
    writeFileSync(join(publicDir, `compare-${name}.png`), PNG.sync.write(strip(cells)));
  }
  process.stdout.write(`  wrote ${String(Object.keys(variants).length)} comparison strips to public/${ATLAS_PUBLIC_DIR}\n`);
}

/**
 * Measure cluster density on the PNG FILE that ships, decoded from disk.
 *
 * The pipeline already reports a `shipped` figure computed on its in-memory
 * finished cells. That is the same data, but it is the pipeline marking its
 * own homework, and this lane has published a mid-stage number as if it were
 * the artifact once already. So: read back the encoded atlas, label islands
 * over the whole decoded image (packed frames are separated by a transparent
 * gutter, so no island can span two frames), and report what the file says.
 */
function measureShippedAtlas(pngPath: string): {
  islands: number;
  pixels: number;
  ratio: number;
  singletonShare: number;
} {
  const png = PNG.sync.read(readFileSync(pngPath));
  const stats = islandStats(Uint8Array.from(png.data), png.width, png.height);
  return {
    islands: stats.islands,
    pixels: stats.pixels,
    ratio: Number(stats.ratio.toFixed(4)),
    singletonShare: Number(stats.singletonShare.toFixed(4)),
  };
}

async function bakeCrowdConfig(config: CrowdConfig): Promise<{
  wallClockSeconds: number;
  renderSeconds: number;
  renders: number;
  result: ReturnType<typeof compileAtlas>;
  manifests: BakeManifest[];
}> {
  process.stdout.write(`baking the ${config.key} crowd (${config.note})…\n`);
  const started = Date.now();
  const inputs: CompileInput[] = [];
  const manifests: BakeManifest[] = [];
  let renderSeconds = 0;
  let renders = 0;

  for (const unit of config.units) {
    const dir = join(workDir, `${config.key}-${unit.id}`);
    rmSync(dir, { force: true, recursive: true });
    mkdirSync(dir, { recursive: true });
    const spec = buildUnitSpec(dir, join(dir, "manifest.json"), unit);
    const manifest = await runBlender(spec, join(dir, "spec.json"));
    manifests.push(manifest);
    renderSeconds += manifest.timing.renderSeconds;
    renders += manifest.timing.renderCount;
    // Faction A is the render. Faction B is the SAME render with eight palette
    // entries swapped — no Blender pass, no extra Python, and the atlas stays
    // exactly indexable because a remap can only produce palette colours.
    inputs.push({ id: `${unit.id}_a`, manifest, tier: unit.tier, workDir: dir });
    inputs.push({ id: `${unit.id}_b`, manifest, remap: FACTION_B_LIVERY, tier: unit.tier, workDir: dir });
  }

  const image = `${config.atlas}.png`;
  const result = compileAtlas(inputs, image);
  writeFileSync(join(publicDir, image), result.png);
  writeFileSync(join(publicDir, `${config.atlas}.json`), `${JSON.stringify(result.sheet, null, 2)}\n`);
  if (result.mismatchedPixels !== 0) {
    throw new Error(`${config.key} atlas round-trip failed: ${String(result.mismatchedPixels)} pixels differ`);
  }

  const wallClockSeconds = (Date.now() - started) / 1000;
  const { cost } = result;
  process.stdout.write(
    `  ${String(cost.cells)} cells · packed ${String(cost.trimmed.width)}x${String(cost.trimmed.height)} `
    + `(${(cost.trimmed.occupancy * 100).toFixed(1)}% occupied) · `
    + `${(cost.indexedPngBytes / 1024).toFixed(1)} KiB indexed `
    + `(${(cost.rgbaPngBytes / 1024).toFixed(1)} KiB truecolour) · round-trip exact\n`
    + `  bake wall clock ${wallClockSeconds.toFixed(2)}s\n`,
  );
  return { manifests, renderSeconds, renders, result, wallClockSeconds };
}

async function main(): Promise<void> {
  mkdirSync(workDir, { recursive: true });
  writeFileSync(join(workDir, ".gitignore"), "*\n");
  mkdirSync(publicDir, { recursive: true });
  mkdirSync(shotsDir, { recursive: true });

  const sheetWork = join(workDir, "frames");
  rmSync(sheetWork, { force: true, recursive: true });
  mkdirSync(sheetWork, { recursive: true });

  process.stdout.write("baking the field medic (hero portrait)…\n");
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
  const shippedAudit = measureShippedAtlas(join(publicDir, image));
  writeFileSync(
    join(shotsDir, "atlas-cost.json"),
    `${JSON.stringify({
      ...cost,
      paletteSize: DIRECTION_B_PALETTE.length,
      blenderRenderSeconds: manifest.timing.renderSeconds,
      blenderTotalSeconds: manifest.timing.totalSeconds,
      bakeWallClockSeconds: Number(wallClockSeconds.toFixed(2)),
      atlasRoundTripMismatchedPixels: result.mismatchedPixels,
      // Independent re-measurement of the number an earlier round published
      // from a mid-pipeline stage: this one is read back off the encoded PNG.
      clusterDensityAudit: {
        measuredOn: `public/${ATLAS_PUBLIC_DIR}/${image}`,
        method: "island labelling over the decoded indexed atlas",
        ...shippedAudit,
      },
    }, null, 2)}\n`,
  );

  process.stdout.write(
    `  ${String(cost.facings)} facings x ${String(cost.animations)} animations `
    + `x ${String(cost.framesPerFacing)} frames = ${String(cost.cells)} cells of `
    + `${String(cost.cellWidth)}x${String(cost.cellHeight)}\n`
    + `  untrimmed grid ${String(cost.uniformCellGrid.width)}x${String(cost.uniformCellGrid.height)}; `
    + `trimmed grid ${String(cost.uniformTrimGrid.width)}x${String(cost.uniformTrimGrid.height)}; `
    + `packed atlas ${String(cost.trimmed.width)}x${String(cost.trimmed.height)} `
    + `(${(cost.trimmed.occupancy * 100).toFixed(1)}% occupied)\n`
    + `  atlas PNG ${(cost.indexedPngBytes / 1024).toFixed(1)} KiB indexed `
    + `(${(cost.rgbaPngBytes / 1024).toFixed(1)} KiB as truecolour)\n`
    + `  palette ${String(cost.paletteEntriesUsed)}/${String(DIRECTION_B_PALETTE.length)} entries used · `
    + `atlas round-trip exact\n`
    + `  cluster density ${cost.clusterDensity.quantized.toFixed(3)} quantized -> `
    + `${cost.clusterDensity.shipped.toFixed(3)} SHIPPED islands/px `
    + `(singletons ${(cost.clusterDensity.singletonShareQuantized * 100).toFixed(0)}% -> `
    + `${(cost.clusterDensity.singletonShareShipped * 100).toFixed(0)}%)\n`
    + `  AUDIT, measured on the written PNG: ${shippedAudit.ratio.toFixed(3)} islands/px, `
    + `${(shippedAudit.singletonShare * 100).toFixed(1)}% singletons `
    + `over ${String(shippedAudit.pixels)} opaque px\n`
    + `  bake wall clock ${wallClockSeconds.toFixed(2)}s\n`,
  );

  const configs: Record<string, unknown> = {};
  let crowdWallClock = 0;
  for (const config of CROWD_CONFIGS) {
    const baked = await bakeCrowdConfig(config);
    crowdWallClock += baked.wallClockSeconds;
    const audit = measureShippedAtlas(join(publicDir, `${config.atlas}.png`));
    const roster = buildRoster(config);
    const clipsFor = (unit: { rig: string }): typeof config.units[number]["clips"] => {
      const found = config.units.find((entry) => entry.id === unit.rig);
      if (found === undefined) { throw new Error(`no bake spec for ${unit.rig}`); }
      return found.clips;
    };
    configs[config.key] = {
      label: config.label,
      note: config.note,
      units: config.units.map((unit) => ({
        id: unit.id,
        tier: unit.tier,
        scale: Number(unit.scale.toFixed(4)),
        screenPx: unit.screenPx,
        bodyArtPx: Number(unit.bodyArtPx.toFixed(2)),
        cell: unit.cell,
        anchor: unit.anchor,
        clips: unit.clips,
        facings: unit.facings,
        partCount: baked.manifests.find((m) => m.unit === unit.id)?.partCount ?? 0,
        droppedDetails: baked.manifests.find((m) => m.unit === unit.id)?.droppedDetails ?? 0,
        measuredStandingArtPx: baked.result.sheet.meta.units[`${unit.id}_a`]?.standingArtPx ?? 0,
        measuredMaxArtPx: baked.result.sheet.meta.units[`${unit.id}_a`]?.maxArtPx ?? 0,
      })),
      cost: baked.result.cost,
      blenderRenders: baked.renders,
      blenderRenderSeconds: Number(baked.renderSeconds.toFixed(2)),
      bakeWallClockSeconds: Number(baked.wallClockSeconds.toFixed(2)),
      atlasRoundTripMismatchedPixels: baked.result.mismatchedPixels,
      clusterDensityAudit: {
        measuredOn: `public/${ATLAS_PUBLIC_DIR}/${config.atlas}.png`,
        ...audit,
      },
      crowd: {
        units: roster.length,
        fodderPerSide: roster.filter((unit) => unit.side === 0 && unit.tier === "fodder").length,
        heroesPerSide: roster.filter((unit) => unit.side === 0 && unit.tier === "hero").length,
        facingNote: FACING_NOTE,
        motion: Object.fromEntries(
          TREATMENTS.map((treatment) => [
            treatment,
            crowdMotionStats(roster, clipsFor, treatment),
          ]),
        ),
        // Same measurement with facing spread removed: how much of the crowd's
        // variety is the animation, and how much is just the formation not
        // pointing the same way.
        motionLockedFacing: Object.fromEntries(
          TREATMENTS.map((treatment) => [
            treatment,
            crowdMotionStats(lockFacings(roster), clipsFor, treatment),
          ]),
        ),
      },
    };
  }

  writeFileSync(
    join(shotsDir, "crowd-cost.json"),
    `${JSON.stringify({
      generatedBy: "pnpm --filter @hazard-pay/webapp bake",
      heroPortraitAtlas: {
        cells: cost.cells,
        indexedPngBytes: cost.indexedPngBytes,
        bakeWallClockSeconds: Number(wallClockSeconds.toFixed(2)),
      },
      crowdWallClockSeconds: Number(crowdWallClock.toFixed(2)),
      configs,
    }, null, 2)}\n`,
  );
  process.stdout.write(`  wrote crowd-cost.json (${CROWD_CONFIGS.length} configs)\n`);

  await buildQuantizationComparison();
}

await main();
