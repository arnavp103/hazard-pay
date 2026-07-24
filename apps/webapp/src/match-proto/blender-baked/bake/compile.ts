/**
 * THROWAWAY PROTOTYPE (#82): everything between "Blender wrote 208 little
 * PNGs" and "PixiJS has a spritesheet".
 *
 * Quantize onto the Direction B palette, ink the contour and the low-contrast
 * internal seams, trim to the alpha bbox, shelf-pack, emit Pixi spritesheet
 * JSON, then prove the atlas round-trips with pixelmatch. The verification
 * step is the point of doing it here rather than in a packer binary: an atlas
 * whose frames do not reconstruct their source cells exactly is a silent
 * one-pixel-drift bug in a 31-px sprite, and it will not be caught by eye.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

import { DIRECTION_B_PALETTE, paletteCoverage, quantizeToPalette } from "../palette.ts";
import { toIndexed, writeIndexedPng } from "./indexed-png.ts";
import { alphaBounds, DEFAULT_INK, type InkOptions, inkSprite } from "./ink.ts";
import { packBest, type PackItem } from "./pack.ts";
import type { BakeManifest } from "./seam.ts";

export interface CompiledFrame {
  name: string;
  clip: string;
  frame: number;
  facing: number;
  /** Straight from Blender, before any palette work. */
  raw: Uint8Array;
  /** Quantized onto the palette, before ink. */
  quantized: Uint8Array;
  /** Quantized + inked — what actually reaches the atlas. */
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
  };
}

export interface AtlasCost {
  facings: number;
  animations: number;
  framesPerFacing: number;
  cells: number;
  cellWidth: number;
  cellHeight: number;
  /** What a naive uniform-grid sheet of the same cells would measure. */
  uniformGrid: { width: number; height: number; pixels: number };
  trimmed: { width: number; height: number; pixels: number; occupancy: number };
  /** What the same atlas costs as a plain truecolour PNG. */
  rgbaPngBytes: number;
  /** What it costs as an 8-bit indexed PNG — the palette's practical payoff. */
  indexedPngBytes: number;
  paletteEntriesUsed: number;
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
): CompiledFrame[] {
  const { width, height } = manifest.cell;
  return manifest.frames.map((entry) => {
    const raw = readRgba(join(workDir, entry.color), width, height);
    const ids = readRgba(join(workDir, entry.id), width, height);

    const quantized = new Uint8Array(raw);
    quantizeToPalette(quantized, width, height);
    const finished = inkSprite(quantized, ids, width, height, ink);

    const trim = alphaBounds(finished, width, height);
    if (trim === null) {
      throw new Error(`${entry.color}: rendered nothing — check the camera framing`);
    }
    if (trim.x === 0 || trim.y === 0 || trim.x + trim.width === width || trim.y + trim.height === height) {
      throw new Error(`${entry.color}: sprite touches the cell edge — the pose is clipping, widen CELL`);
    }

    return {
      name: `${entry.clip}_${String(entry.frame).padStart(2, "0")}_${String(entry.facing)}`,
      clip: entry.clip,
      frame: entry.frame,
      facing: entry.facing,
      raw,
      quantized,
      finished,
      trim,
    };
  });
}

export function compile(
  manifest: BakeManifest,
  workDir: string,
  imageName: string,
  ink: InkOptions = DEFAULT_INK,
): CompileResult {
  const cell = manifest.cell;
  const frames = compileFrames(manifest, workDir, ink);

  const items: PackItem[] = frames.map((f) => ({ name: f.name, width: f.trim.width, height: f.trim.height }));
  const packed = packBest(items, [128, 192, 256, 320, 384, 512, 640]);

  const atlas = new Uint8Array(packed.width * packed.height * 4);
  const byName = new Map(frames.map((f) => [f.name, f]));
  const sheetFrames: Record<string, AtlasFrameJson> = {};

  for (const placement of packed.placements) {
    const frame = byName.get(placement.name);
    if (frame === undefined) { throw new Error(`packed an unknown frame: ${placement.name}`); }
    blit(atlas, packed.width, placement.x, placement.y, frame.finished, cell.width, frame.trim);
    sheetFrames[placement.name] = {
      frame: { x: placement.x, y: placement.y, w: frame.trim.width, h: frame.trim.height },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: frame.trim.x, y: frame.trim.y, w: frame.trim.width, h: frame.trim.height },
      sourceSize: { w: cell.width, h: cell.height },
    };
  }

  // One animation track per clip PER FACING: a baked lane cannot rotate a
  // sprite, so the facing is part of the track identity.
  const animations: Record<string, string[]> = {};
  for (const clip of manifest.clips) {
    for (let facing = 0; facing < manifest.facings; facing += 1) {
      animations[`${clip.name}_${String(facing)}`] = frames
        .filter((f) => f.clip === clip.name && f.facing === facing)
        .sort((a, b) => a.frame - b.frame)
        .map((f) => f.name);
    }
  }

  const sheet: SpritesheetJson = {
    frames: sheetFrames,
    animations,
    meta: {
      app: "hazard-pay blender-baked lane (#82)",
      image: imageName,
      format: "RGBA8888",
      size: { w: packed.width, h: packed.height },
      scale: "1",
      anchor: manifest.anchor,
      clips: manifest.clips.map((c) => ({ name: c.name, frames: c.frames, fps: c.fps })),
      facings: manifest.facings,
    },
  };

  const truecolour = new PNG({ width: packed.width, height: packed.height });
  truecolour.data.set(atlas);
  const rgbaBytes = PNG.sync.write(truecolour, { colorType: 6 }).byteLength;
  const encoded = writeIndexedPng(
    toIndexed(atlas, packed.width, packed.height, DIRECTION_B_PALETTE.map((entry) => entry.hex)),
  );

  // Round-trip proof: pull every frame back out of the encoded atlas, undo the
  // trim, and demand a pixel-exact match against the compiled cell.
  const decoded = Uint8Array.from(PNG.sync.read(encoded).data);
  let mismatchedPixels = 0;
  const scratch = new Uint8Array(cell.width * cell.height * 4);
  for (const frame of frames) {
    scratch.fill(0);
    const region = sheetFrames[frame.name];
    if (region === undefined) { throw new Error(`missing sheet entry for ${frame.name}`); }
    blit(
      scratch, cell.width, frame.trim.x, frame.trim.y,
      decoded, packed.width,
      { x: region.frame.x, y: region.frame.y, width: region.frame.w, height: region.frame.h },
    );
    mismatchedPixels += pixelmatch(scratch, frame.finished, undefined, cell.width, cell.height, { threshold: 0 });
  }

  const used = new Set<string>();
  for (const frame of frames) {
    for (const name of paletteCoverage(frame.finished)) { used.add(name); }
  }

  const perFacing = manifest.clips.reduce((sum, clip) => sum + clip.frames, 0);
  // The uniform-grid comparison uses the widest/tallest TRIMMED frame, not the
  // authored cell: a naive sheet would still size its grid to the biggest pose,
  // and charging this lane for the cell's slack would flatter the trimmed number.
  const gridW = frames.reduce((max, f) => Math.max(max, f.trim.width), 0);
  const gridH = frames.reduce((max, f) => Math.max(max, f.trim.height), 0);
  const columns = Math.ceil(Math.sqrt(frames.length));
  const rows = Math.ceil(frames.length / columns);

  return {
    frames,
    atlas,
    sheet,
    png: encoded,
    mismatchedPixels,
    cost: {
      facings: manifest.facings,
      animations: manifest.clips.length,
      framesPerFacing: perFacing,
      cells: frames.length,
      cellWidth: cell.width,
      cellHeight: cell.height,
      uniformGrid: {
        width: columns * gridW,
        height: rows * gridH,
        pixels: columns * gridW * rows * gridH,
      },
      trimmed: {
        width: packed.width,
        height: packed.height,
        pixels: packed.width * packed.height,
        occupancy: packed.occupancy,
      },
      rgbaPngBytes: rgbaBytes,
      indexedPngBytes: encoded.byteLength,
      paletteEntriesUsed: used.size,
    },
  };
}
