/**
 * THROWAWAY PROTOTYPE (#82): everything between "Blender wrote a pile of
 * little PNGs" and "PixiJS has a spritesheet".
 *
 * Quantize onto the Direction B palette, ink the contour and the low-contrast
 * internal seams, trim to the alpha bbox, shelf-pack, emit Pixi spritesheet
 * JSON, then prove the atlas round-trips with pixelmatch. The verification
 * step is the point of doing it here rather than in a packer binary: an atlas
 * whose frames do not reconstruct their source cells exactly is a silent
 * one-pixel-drift bug in a 31-px sprite, and it will not be caught by eye.
 *
 * Round 4 made this multi-unit. One atlas now carries a whole army — two
 * fodder archetypes and a hero, each with its own cell size and anchor — plus
 * their faction recolours, which are produced by remapping palette entries on
 * the finished cells rather than by rendering anything a second time.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { consolidate, islandStats } from "../consolidate.ts";
import { DIRECTION_B_PALETTE, paletteCoverage, quantizeToPalette, remapPalette } from "../palette.ts";
import { toIndexed, writeIndexedPng } from "./indexed-png.ts";
import { alphaBounds, DEFAULT_INK, type InkOptions, inkSprite, markOutline } from "./ink.ts";
import { packBest, type PackItem } from "./pack.ts";
import type { BakeManifest } from "./seam.ts";

export interface CompiledFrame {
  name: string;
  /** Atlas-level unit id — the rig plus its faction, e.g. `brute_b`. */
  unit: string;
  clip: string;
  frame: number;
  facing: number;
  cell: { width: number; height: number };
  /** Straight from Blender, before any palette work. */
  raw: Uint8Array;
  /** Quantized onto the palette, before ink. */
  quantized: Uint8Array;
  /** Quantized + inked (+ recoloured) — what actually reaches the atlas. */
  finished: Uint8Array;
  trim: { x: number; y: number; width: number; height: number };
}

export interface AtlasFrameJson {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

export interface SheetUnitMeta {
  rig: string;
  tier: string;
  prefix: string;
  cell: { w: number; h: number };
  anchor: { x: number; y: number };
  clips: { name: string; frames: number; fps: number }[];
  facings: number;
  /**
   * Measured, not assumed. `standingArtPx` is the idle silhouette across the
   * facings — the number the tier ratio is actually about; `maxArtPx` is the
   * tallest cell any clip produces, which is what the cell has to hold.
   */
  standingArtPx: number;
  maxArtPx: number;
  droppedDetails: number;
  partCount: number;
}

export interface SpritesheetJson {
  frames: Record<string, AtlasFrameJson>;
  animations: Record<string, string[]>;
  meta: {
    app: string;
    image: string;
    format: "RGBA8888";
    size: { w: number; h: number };
    scale: string;
    anchor: { x: number; y: number };
    clips: { name: string; frames: number; fps: number }[];
    facings: number;
    units: Record<string, SheetUnitMeta>;
  };
}

export interface AtlasCost {
  facings: number;
  animations: number;
  framesPerFacing: number;
  cells: number;
  cellWidth: number;
  cellHeight: number;
  /** A naive sheet: every authored cell, untrimmed, on a square grid. */
  uniformCellGrid: { width: number; height: number; pixels: number };
  /** A uniform grid sized to the largest TRIMMED frame — trimming, no packing. */
  uniformTrimGrid: { width: number; height: number; pixels: number };
  trimmed: { width: number; height: number; pixels: number; occupancy: number };
  /** What the same atlas costs as a plain truecolour PNG. */
  rgbaPngBytes: number;
  /** What it costs as an 8-bit indexed PNG — the palette's practical payoff. */
  indexedPngBytes: number;
  paletteEntriesUsed: number;
  /**
   * Flat-colour islands per body pixel. `quantized` is the palette-locked
   * render before any drawing passes; `shipped` is the pixels that are
   * actually in the atlas, contour and seams included. Reporting the
   * mid-pipeline number as if it described the artifact is how a pipeline
   * lies to its own gallery, so both are published and the shipped one is
   * the headline.
   */
  clusterDensity: {
    quantized: number;
    shipped: number;
    singletonShareQuantized: number;
    singletonShareShipped: number;
  };
  /** Per-unit breakdown — where a two-tier roster actually spends its bytes. */
  units: Record<string, { cells: number; cellPixels: number; trimmedPixels: number }>;
}

export interface CompileResult {
  frames: CompiledFrame[];
  atlas: Uint8Array;
  sheet: SpritesheetJson;
  png: Buffer;
  cost: AtlasCost;
  /** Non-zero means the atlas does not reconstruct its source cells. */
  mismatchedPixels: number;
}

/** One rig's renders, plus the atlas identity they should be filed under. */
export interface CompileInput {
  /** Atlas-level unit id: the rig id, optionally suffixed with a faction. */
  id: string;
  manifest: BakeManifest;
  workDir: string;
  tier: string;
  /** Frame-name prefix. Empty keeps the round-1..3 hero atlas naming intact. */
  prefix?: string;
  /** Hero marking ring — grown outside the silhouette, or recoloured into it. */
  mark?: { hex: string; thickness: number; mode?: "inset" | "outward" };
  /**
   * Palette-entry remap applied to the finished cells. A faction recolour in
   * an indexed-palette lane is an index swap, not a render — which is worth
   * knowing when the roster is twenty units wide and two factions deep.
   */
  remap?: Readonly<Record<string, string>>;
}

function readRgba(path: string, width: number, height: number): Uint8Array {
  const png = PNG.sync.read(readFileSync(path));
  if (png.width !== width || png.height !== height) {
    throw new Error(`${path}: expected ${String(width)}x${String(height)}, got ${String(png.width)}x${String(png.height)}`);
  }
  return Uint8Array.from(png.data);
}

function blit(
  dst: Uint8Array, dstWidth: number, dstX: number, dstY: number,
  src: Uint8Array, srcWidth: number,
  region: { x: number; y: number; width: number; height: number },
): void {
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      const from = ((region.y + y) * srcWidth + region.x + x) * 4;
      const to = ((dstY + y) * dstWidth + dstX + x) * 4;
      dst[to] = src[from] ?? 0;
      dst[to + 1] = src[from + 1] ?? 0;
      dst[to + 2] = src[from + 2] ?? 0;
      dst[to + 3] = src[from + 3] ?? 0;
    }
  }
}

export function compileFrames(
  manifest: BakeManifest,
  workDir: string,
  ink: InkOptions = DEFAULT_INK,
  minIsland = 2,
  unit = manifest.unit,
  prefix = "",
  remap?: Readonly<Record<string, string>>,
  mark?: { hex: string; thickness: number; mode?: "inset" | "outward" },
): CompiledFrame[] {
  const { width, height } = manifest.cell;
  return manifest.frames.map((entry) => {
    const raw = readRgba(join(workDir, entry.color), width, height);
    const ids = readRgba(join(workDir, entry.id), width, height);

    const quantized = new Uint8Array(raw);
    quantizeToPalette(quantized, width, height);
    // Consolidate BEFORE inking: the contour is a deliberate 1-px structure
    // and must not be eaten by the same rule that removes 1-px confetti.
    consolidate(quantized, width, height, minIsland);
    const finished = inkSprite(quantized, ids, width, height, ink);
    // …and again after inking. The seam pass can strand a lone darkened pixel
    // where two parts touch across three cells; measured, the drawing passes
    // were re-introducing more confetti than they were worth. Ink is protected,
    // so the contour survives while orphan seams are folded back.
    consolidate(finished, width, height, minIsland);
    // The faction swap goes LAST, on finished pixels, so it can never change
    // which colours the quantizer chose or which seams the ink drew: the two
    // liveries are the same drawing carrying different indices.
    if (remap !== undefined) { remapPalette(finished, remap); }
    // Hero marking last of all, outside everything else, so the with/without
    // pair differs by exactly one pass and nothing else.
    const marked = mark === undefined
      ? finished
      : markOutline(finished, width, height, mark.hex, mark.thickness, mark.mode ?? "outward");

    const trim = alphaBounds(marked, width, height);
    if (trim === null) {
      throw new Error(`${entry.color}: rendered nothing — check the camera framing`);
    }
    if (trim.x === 0 || trim.y === 0 || trim.x + trim.width === width || trim.y + trim.height === height) {
      throw new Error(`${unit}/${entry.color}: sprite touches the cell edge — the pose is clipping, widen the cell`);
    }

    return {
      cell: { height, width },
      clip: entry.clip,
      facing: entry.facing,
      finished: marked,
      frame: entry.frame,
      name: `${prefix}${entry.clip}_${String(entry.frame).padStart(2, "0")}_${String(entry.facing)}`,
      quantized,
      raw,
      trim,
      unit,
    };
  });
}

/**
 * Pack a whole army into one atlas. `compile` below is this function with a
 * single unprefixed input, so the hero portrait bake from rounds 1-3 still
 * produces a byte-identical PNG.
 */
export function compileAtlas(
  inputs: readonly CompileInput[],
  imageName: string,
  ink: InkOptions = DEFAULT_INK,
  minIsland = 2,
): CompileResult {
  const frames: CompiledFrame[] = [];
  const unitMeta: Record<string, SheetUnitMeta> = {};
  for (const input of inputs) {
    const prefix = input.prefix ?? `${input.id}_`;
    const compiled = compileFrames(
      input.manifest, input.workDir, ink, minIsland, input.id, prefix, input.remap, input.mark,
    );
    frames.push(...compiled);
    unitMeta[input.id] = {
      anchor: input.manifest.anchor,
      maxArtPx: compiled.reduce((max, frame) => Math.max(max, frame.trim.height), 0),
      cell: { h: input.manifest.cell.height, w: input.manifest.cell.width },
      clips: input.manifest.clips.map((c) => ({ frames: c.frames, fps: c.fps, name: c.name })),
      droppedDetails: input.manifest.droppedDetails,
      facings: input.manifest.facings,
      partCount: input.manifest.partCount,
      prefix,
      standingArtPx: compiled
        .filter((frame) => frame.clip === "idle" && frame.frame === 0)
        .reduce((max, frame) => Math.max(max, frame.trim.height), 0),
      rig: input.manifest.unit,
      tier: input.tier,
    };
  }

  const items: PackItem[] = frames.map((f) => ({ height: f.trim.height, name: f.name, width: f.trim.width }));
  const packed = packBest(items, [128, 192, 256, 320, 384, 512, 640, 768, 1024]);

  const atlas = new Uint8Array(packed.width * packed.height * 4);
  const byName = new Map(frames.map((f) => [f.name, f]));
  const sheetFrames: Record<string, AtlasFrameJson> = {};

  for (const placement of packed.placements) {
    const frame = byName.get(placement.name);
    if (frame === undefined) { throw new Error(`packed an unknown frame: ${placement.name}`); }
    blit(atlas, packed.width, placement.x, placement.y, frame.finished, frame.cell.width, frame.trim);
    sheetFrames[placement.name] = {
      frame: { h: frame.trim.height, w: frame.trim.width, x: placement.x, y: placement.y },
      rotated: false,
      sourceSize: { h: frame.cell.height, w: frame.cell.width },
      spriteSourceSize: { h: frame.trim.height, w: frame.trim.width, x: frame.trim.x, y: frame.trim.y },
      trimmed: true,
    };
  }

  // One animation track per clip PER FACING PER UNIT: a baked lane cannot
  // rotate a sprite, so the facing is part of the track identity.
  const animations: Record<string, string[]> = {};
  for (const input of inputs) {
    const prefix = input.prefix ?? `${input.id}_`;
    for (const clip of input.manifest.clips) {
      for (let facing = 0; facing < input.manifest.facings; facing += 1) {
        animations[`${prefix}${clip.name}_${String(facing)}`] = frames
          .filter((f) => f.unit === input.id && f.clip === clip.name && f.facing === facing)
          .sort((a, b) => a.frame - b.frame)
          .map((f) => f.name);
      }
    }
  }

  const lead = inputs[0];
  if (lead === undefined) { throw new Error("compileAtlas needs at least one unit"); }
  const sheet: SpritesheetJson = {
    animations,
    frames: sheetFrames,
    meta: {
      anchor: lead.manifest.anchor,
      app: "hazard-pay blender-baked lane (#82)",
      clips: lead.manifest.clips.map((c) => ({ frames: c.frames, fps: c.fps, name: c.name })),
      facings: lead.manifest.facings,
      format: "RGBA8888",
      image: imageName,
      scale: "1",
      size: { h: packed.height, w: packed.width },
      units: unitMeta,
    },
  };

  const truecolour = new PNG({ height: packed.height, width: packed.width });
  truecolour.data.set(atlas);
  const rgbaBytes = PNG.sync.write(truecolour, { colorType: 6 }).byteLength;
  const encoded = writeIndexedPng(
    toIndexed(atlas, packed.width, packed.height, DIRECTION_B_PALETTE.map((entry) => entry.hex)),
  );

  // Round-trip proof: pull every frame back out of the encoded atlas, undo the
  // trim, and demand a pixel-exact match against the compiled cell.
  const decoded = Uint8Array.from(PNG.sync.read(encoded).data);
  let mismatchedPixels = 0;
  for (const frame of frames) {
    const scratch = new Uint8Array(frame.cell.width * frame.cell.height * 4);
    const region = sheetFrames[frame.name];
    if (region === undefined) { throw new Error(`missing sheet entry for ${frame.name}`); }
    blit(
      scratch, frame.cell.width, frame.trim.x, frame.trim.y,
      decoded, packed.width,
      { height: region.frame.h, width: region.frame.w, x: region.frame.x, y: region.frame.y },
    );
    mismatchedPixels += pixelmatch(
      scratch, frame.finished, undefined, frame.cell.width, frame.cell.height, { threshold: 0 },
    );
  }

  const used = new Set<string>();
  for (const frame of frames) {
    for (const name of paletteCoverage(frame.finished)) { used.add(name); }
  }

  // Cluster density: the palette-locked render, and the pixels that ship.
  let quantizedTotals = { islands: 0, pixels: 0, singletons: 0 };
  let shippedTotals = { islands: 0, pixels: 0, singletons: 0 };
  const accumulate = (
    into: { islands: number; pixels: number; singletons: number },
    stats: { islands: number; pixels: number; singletonShare: number },
  ): { islands: number; pixels: number; singletons: number } => ({
    islands: into.islands + stats.islands,
    pixels: into.pixels + stats.pixels,
    singletons: into.singletons + stats.singletonShare * stats.islands,
  });
  for (const frame of frames) {
    const straight = new Uint8Array(frame.raw);
    quantizeToPalette(straight, frame.cell.width, frame.cell.height);
    quantizedTotals = accumulate(quantizedTotals, islandStats(straight, frame.cell.width, frame.cell.height));
    shippedTotals = accumulate(shippedTotals, islandStats(frame.finished, frame.cell.width, frame.cell.height));
  }

  const perUnit: AtlasCost["units"] = {};
  for (const frame of frames) {
    const entry = perUnit[frame.unit] ?? { cellPixels: 0, cells: 0, trimmedPixels: 0 };
    entry.cells += 1;
    entry.cellPixels += frame.cell.width * frame.cell.height;
    entry.trimmedPixels += frame.trim.width * frame.trim.height;
    perUnit[frame.unit] = entry;
  }

  // The uniform-grid comparison uses the widest/tallest TRIMMED frame, not the
  // authored cell: a naive sheet would still size its grid to the biggest pose,
  // and charging this lane for the cell's slack would flatter the trimmed
  // number. `uniformCellGrid` takes the biggest authored cell for the same
  // reason — one uniform grid has to hold every unit in the atlas.
  const cellW = frames.reduce((max, f) => Math.max(max, f.cell.width), 0);
  const cellH = frames.reduce((max, f) => Math.max(max, f.cell.height), 0);
  const gridW = frames.reduce((max, f) => Math.max(max, f.trim.width), 0);
  const gridH = frames.reduce((max, f) => Math.max(max, f.trim.height), 0);
  const columns = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / columns);
  const perFacing = inputs.reduce(
    (sum, input) => sum + input.manifest.clips.reduce((total, clip) => total + clip.frames, 0),
    0,
  );

  return {
    atlas,
    cost: {
      animations: inputs.reduce((sum, input) => sum + input.manifest.clips.length, 0),
      cellHeight: cellH,
      cellWidth: cellW,
      cells: frames.length,
      clusterDensity: {
        quantized: Number((quantizedTotals.islands / Math.max(1, quantizedTotals.pixels)).toFixed(4)),
        shipped: Number((shippedTotals.islands / Math.max(1, shippedTotals.pixels)).toFixed(4)),
        singletonShareQuantized: Number(
          (quantizedTotals.singletons / Math.max(1, quantizedTotals.islands)).toFixed(4),
        ),
        singletonShareShipped: Number(
          (shippedTotals.singletons / Math.max(1, shippedTotals.islands)).toFixed(4),
        ),
      },
      facings: lead.manifest.facings,
      framesPerFacing: perFacing,
      indexedPngBytes: encoded.byteLength,
      paletteEntriesUsed: used.size,
      rgbaPngBytes: rgbaBytes,
      trimmed: {
        height: packed.height,
        occupancy: packed.occupancy,
        pixels: packed.width * packed.height,
        width: packed.width,
      },
      uniformCellGrid: {
        height: rows * cellH,
        pixels: columns * cellW * rows * cellH,
        width: columns * cellW,
      },
      uniformTrimGrid: {
        height: rows * gridH,
        pixels: columns * gridW * rows * gridH,
        width: columns * gridW,
      },
      units: perUnit,
    },
    frames,
    mismatchedPixels,
    png: encoded,
    sheet,
  };
}

/** The hero portrait atlas from rounds 1-3, unchanged down to the byte. */
export function compile(
  manifest: BakeManifest,
  workDir: string,
  imageName: string,
  ink: InkOptions = DEFAULT_INK,
  minIsland = 2,
): CompileResult {
  return compileAtlas(
    [{ id: manifest.unit, manifest, prefix: "", tier: "hero", workDir }],
    imageName,
    ink,
    minIsland,
  );
}
