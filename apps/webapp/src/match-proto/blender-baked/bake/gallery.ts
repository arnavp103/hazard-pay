/**
 * THROWAWAY PROTOTYPE (#82), round 6: gallery plates built from the atlas.
 *
 * `pnpm --filter @hazard-pay/webapp gallery`. Everything here reads the SHIPPED
 * files out of `public/blender-baked` — the same PNG and JSON the browser loads
 * — so a plate cannot flatter the artifact by rendering from an earlier pipeline
 * stage. That specific mistake has cost this lane a cold critique already.
 *
 * Round 6 writes into `screenshots/blender-baked-lane/round-6/` and leaves
 * round 5's plates where they are. It adds four plates the round-5 gallery did
 * not have:
 *
 *  - the whole register ladder on ONE plate, so 22 -> 56 is a progression rather
 *    than five separate images a reader has to hold in their head;
 *  - the metal-slug-tactics hero at every register, alone and beside the medic;
 *  - the NEGATIVE-SPACE plate, which paints every interior background pixel that
 *    survived to the atlas in a flat marker colour. It is the only plate in this
 *    lane whose subject is the absence of pixels, and it is measured on the
 *    decoded atlas rather than on the render for exactly that reason;
 *  - the thin-and-tall A/B against round 5, which needs the round-5 atlases and
 *    therefore takes them from a directory the caller points it at
 *    (`HP_R5_ATLAS_DIR`) rather than pretending the overwritten ones still exist.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import { ATLAS_PUBLIC_DIR, CROWD_CONFIGS } from "../framing.ts";
import { interiorRuns, measureGaps } from "../negative-space.ts";
import { hexToRgb, INK } from "../palette.ts";

const here = dirname(fileURLToPath(import.meta.url));
const webappDir = join(dirname(here), "..", "..", "..");
const publicDir = join(webappDir, "public", ATLAS_PUBLIC_DIR);
const shotsDir = join(webappDir, "screenshots", "blender-baked-lane", "round-6");
const beforeDir = process.env.HP_R5_ATLAS_DIR ?? "";

/** The marker the negative-space plate paints surviving gaps in. */
const GAP_HEX = "#2f9e96";

interface SheetJson {
  frames: Record<string, {
    frame: { x: number; y: number; w: number; h: number };
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
  }>;
  animations: Record<string, string[]>;
  meta: {
    units: Record<string, {
      cell: { w: number; h: number };
      anchor: { x: number; y: number };
      tier: string;
      standingArtPx: number;
      maxArtPx: number;
    }>;
  };
}

interface Tile { data: Uint8Array; width: number; height: number }
interface Atlas { png: PNG; sheet: SheetJson }

function loadAtlas(name: string, dir = publicDir): Atlas {
  return {
    png: PNG.sync.read(readFileSync(join(dir, `${name}.png`))),
    sheet: JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as SheetJson,
  };
}

/** Rebuild one full cell out of the packed atlas — trim undone, as Pixi does. */
function cellOf(atlas: PNG, sheet: SheetJson, frameName: string): Tile {
  const entry = sheet.frames[frameName];
  if (entry === undefined) { throw new Error(`no frame ${frameName}`); }
  const width = entry.sourceSize.w;
  const height = entry.sourceSize.h;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < entry.frame.h; y += 1) {
    for (let x = 0; x < entry.frame.w; x += 1) {
      const from = ((entry.frame.y + y) * atlas.width + entry.frame.x + x) * 4;
      const to = ((entry.spriteSourceSize.y + y) * width + entry.spriteSourceSize.x + x) * 4;
      data[to] = atlas.data[from] ?? 0;
      data[to + 1] = atlas.data[from + 1] ?? 0;
      data[to + 2] = atlas.data[from + 2] ?? 0;
      data[to + 3] = atlas.data[from + 3] ?? 0;
    }
  }
  return { data, height, width };
}

/** Crop a cell to its opaque bbox so a plate is figures, not empty margin. */
function trimTile(tile: Tile): Tile {
  let minX = tile.width;
  let minY = tile.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < tile.height; y += 1) {
    for (let x = 0; x < tile.width; x += 1) {
      if ((tile.data[(y * tile.width + x) * 4 + 3] ?? 0) === 0) { continue; }
      if (x < minX) { minX = x; }
      if (x > maxX) { maxX = x; }
      if (y < minY) { minY = y; }
      if (y > maxY) { maxY = y; }
    }
  }
  if (maxX < 0) { return tile; }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const from = ((minY + y) * tile.width + minX + x) * 4;
      const to = (y * width + x) * 4;
      data[to] = tile.data[from] ?? 0;
      data[to + 1] = tile.data[from + 1] ?? 0;
      data[to + 2] = tile.data[from + 2] ?? 0;
      data[to + 3] = tile.data[from + 3] ?? 0;
    }
  }
  return { data, height, width };
}

function plate(tiles: readonly (Tile | null)[], columns: number, gap: number, zoom: number): PNG {
  const cellW = tiles.reduce((max, tile) => Math.max(max, tile?.width ?? 0), 0);
  const cellH = tiles.reduce((max, tile) => Math.max(max, tile?.height ?? 0), 0);
  const rows = Math.ceil(tiles.length / columns);
  const png = new PNG({
    height: rows * (cellH * zoom + gap) + gap,
    width: columns * (cellW * zoom + gap) + gap,
  });
  const [br, bg, bb] = hexToRgb(INK);
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = br;
    png.data[i + 1] = bg;
    png.data[i + 2] = bb;
    png.data[i + 3] = 0xff;
  }
  tiles.forEach((tile, index) => {
    if (tile === null) { return; }
    const col = index % columns;
    const row = Math.floor(index / columns);
    // Bottom-align: units of different tiers must be compared standing on the
    // same ground line, or the size boost is impossible to read.
    const ox = gap + col * (cellW * zoom + gap) + Math.floor((cellW - tile.width) * zoom / 2);
    const oy = gap + row * (cellH * zoom + gap) + (cellH - tile.height) * zoom;
    for (let y = 0; y < tile.height * zoom; y += 1) {
      for (let x = 0; x < tile.width * zoom; x += 1) {
        const from = (Math.floor(y / zoom) * tile.width + Math.floor(x / zoom)) * 4;
        if ((tile.data[from + 3] ?? 0) === 0) { continue; }
        const to = ((oy + y) * png.width + ox + x) * 4;
        png.data[to] = tile.data[from] ?? 0;
        png.data[to + 1] = tile.data[from + 1] ?? 0;
        png.data[to + 2] = tile.data[from + 2] ?? 0;
        png.data[to + 3] = 0xff;
      }
    }
  });
  return png;
}

/** Rec.709 luma, so the grayscale plate answers "does this read without hue?" */
export function toGrayscale(png: PNG): PNG {
  const out = new PNG({ height: png.height, width: png.width });
  for (let i = 0; i < png.data.length; i += 4) {
    const y = Math.round(
      0.2126 * (png.data[i] ?? 0) + 0.7152 * (png.data[i + 1] ?? 0) + 0.0722 * (png.data[i + 2] ?? 0),
    );
    out.data[i] = y;
    out.data[i + 1] = y;
    out.data[i + 2] = y;
    out.data[i + 3] = png.data[i + 3] ?? 0xff;
  }
  return out;
}

/**
 * Paint every interior background pixel the figure encloses, in the shipped
 * atlas cell. Teal is daylight that survived quantization, consolidation and the
 * contour dilation; everything else on the plate is the sprite as it ships.
 *
 * The pixels are painted rather than annotated because at these sizes an arrow
 * is bigger than the thing it points at.
 */
function gapOverlay(shipped: Tile): Tile {
  const out: Tile = {
    data: new Uint8Array(shipped.data), height: shipped.height, width: shipped.width,
  };
  const mask = new Uint8Array(shipped.width * shipped.height);
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = (shipped.data[i * 4 + 3] ?? 0) > 0 ? 1 : 0;
  }
  const [gr, gg, gb] = hexToRgb(GAP_HEX);
  for (let y = 0; y < shipped.height; y += 1) {
    for (const run of interiorRuns(mask, shipped.width, y)) {
      for (let x = run.x; x < run.x + run.width; x += 1) {
        const i = y * shipped.width + x;
        out.data[i * 4] = gr;
        out.data[i * 4 + 1] = gg;
        out.data[i * 4 + 2] = gb;
        out.data[i * 4 + 3] = 0xff;
      }
    }
  }
  return out;
}

const FACINGS_SHOWN = [6, 0, 2, 4];
const LADDER = ["brute_a", "marksman_a", "medic_a", "ranger_a"];

function idleTile(atlas: Atlas, unit: string, facing: number): Tile | null {
  const name = atlas.sheet.animations[`${unit}_idle_${String(facing)}`]?.[0];
  return name === undefined ? null : cellOf(atlas.png, atlas.sheet, name);
}

function main(): void {
  mkdirSync(shotsDir, { recursive: true });
  const ladderByRegister: (Tile | null)[] = [];
  const mstByRegister: (Tile | null)[] = [];
  const summary: Record<string, unknown> = {};

  for (const config of CROWD_CONFIGS) {
    const atlas = loadAtlas(config.atlas);

    // 1. Tier ladder at this register: both fodder, both heroes, both factions.
    const ladder: (Tile | null)[] = [];
    for (const unit of [...LADDER, "brute_b", "marksman_b", "medic_b", "ranger_b"]) {
      const tile = idleTile(atlas, unit, 0);
      ladder.push(tile === null ? null : trimTile(tile));
    }
    writeFileSync(join(shotsDir, `tier-ladder-${config.key}-1x.png`), PNG.sync.write(plate(ladder, 8, 4, 1)));
    const zoomed = plate(ladder, 8, 4, 4);
    writeFileSync(join(shotsDir, `tier-ladder-${config.key}.png`), PNG.sync.write(zoomed));
    writeFileSync(join(shotsDir, `tier-ladder-${config.key}-gray.png`), PNG.sync.write(toGrayscale(zoomed)));
    for (const unit of LADDER) {
      const tile = idleTile(atlas, unit, 6);
      ladderByRegister.push(tile === null ? null : trimTile(tile));
    }

    // 2. The metal-slug-tactics hero: every facing, then beside the medic.
    const mst: (Tile | null)[] = [];
    for (let facing = 0; facing < 8; facing += 1) {
      const tile = idleTile(atlas, "ranger_a", facing);
      mst.push(tile === null ? null : trimTile(tile));
    }
    writeFileSync(join(shotsDir, `mst-hero-${config.key}.png`), PNG.sync.write(plate(mst, 8, 3, 5)));
    const ab: (Tile | null)[] = [];
    for (const unit of ["medic_a", "ranger_a", "medic_b", "ranger_b"]) {
      for (const facing of FACINGS_SHOWN) {
        const tile = idleTile(atlas, unit, facing);
        ab.push(tile === null ? null : trimTile(tile));
      }
    }
    const abPlate = plate(ab, FACINGS_SHOWN.length, 4, 5);
    writeFileSync(join(shotsDir, `hero-ab-${config.key}.png`), PNG.sync.write(abPlate));
    writeFileSync(join(shotsDir, `hero-ab-${config.key}-gray.png`), PNG.sync.write(toGrayscale(abPlate)));
    const single = idleTile(atlas, "ranger_a", 6);
    mstByRegister.push(single === null ? null : trimTile(single));

    // 3. The negative-space plate, measured on the decoded atlas.
    const loupe: (Tile | null)[] = [];
    const counts: Record<string, unknown> = {};
    for (const unit of LADDER) {
      for (const facing of FACINGS_SHOWN) {
        const shipped = idleTile(atlas, unit, facing);
        loupe.push(shipped === null ? null : trimTile(gapOverlay(shipped)));
      }
      const stats = Array.from({ length: 8 }, (_unused, facing) => {
        const tile = idleTile(atlas, unit, facing);
        return tile === null ? null : measureGaps(tile.data, tile.width, tile.height);
      }).filter((entry) => entry !== null);
      counts[unit] = {
        armMaxWidth: stats.map((entry) => entry.arm.maxWidth),
        armRowsWithGap: stats.map((entry) => entry.arm.rowsWithGap),
        contactSpan: stats.map((entry) => entry.contactSpan),
        legMaxWidth: stats.map((entry) => entry.leg.maxWidth),
        legRowsWithGap: stats.map((entry) => entry.leg.rowsWithGap),
      };
    }
    writeFileSync(
      join(shotsDir, `negative-space-${config.key}.png`),
      PNG.sync.write(plate(loupe, FACINGS_SHOWN.length, 4, 4)),
    );
    summary[config.key] = counts;

    // 4. Thin-and-tall against round 5, where a round-5 atlas exists to compare.
    if (beforeDir !== "" && existsSync(join(beforeDir, `${config.atlas}.png`))) {
      const before = loadAtlas(config.atlas, beforeDir);
      const pair: (Tile | null)[] = [];
      for (const source of [before, atlas]) {
        for (const unit of ["brute_a", "marksman_a", "medic_a"]) {
          for (const facing of [6, 0]) {
            const tile = idleTile(source, unit, facing);
            pair.push(tile === null ? null : trimTile(tile));
          }
        }
      }
      const thinTall = plate(pair, 6, 4, 5);
      writeFileSync(join(shotsDir, `thin-tall-ab-${config.key}.png`), PNG.sync.write(thinTall));
      writeFileSync(join(shotsDir, `thin-tall-ab-${config.key}-gray.png`), PNG.sync.write(toGrayscale(thinTall)));
    }

    const measured = Object.entries(atlas.sheet.meta.units)
      .filter(([id]) => id.endsWith("_a"))
      .map(([id, meta]) => `${id}=${String(meta.standingArtPx)}/${String(meta.maxArtPx)}px`)
      .join(" ");
    process.stdout.write(`  ${config.key}: ${measured}\n`);
  }

  // The whole ladder on one plate: four archetypes across five registers, all
  // standing on one ground line. This is the plate the round-6 resolution
  // question is actually about.
  writeFileSync(
    join(shotsDir, "registers-sidebyside-1x.png"),
    PNG.sync.write(plate(ladderByRegister, LADDER.length, 4, 1)),
  );
  const ladderPlate = plate(ladderByRegister, LADDER.length, 4, 3);
  writeFileSync(join(shotsDir, "registers-sidebyside.png"), PNG.sync.write(ladderPlate));
  writeFileSync(join(shotsDir, "registers-sidebyside-gray.png"), PNG.sync.write(toGrayscale(ladderPlate)));
  const mstPlate = plate(mstByRegister, CROWD_CONFIGS.length, 4, 4);
  writeFileSync(join(shotsDir, "mst-hero-registers.png"), PNG.sync.write(mstPlate));
  writeFileSync(join(shotsDir, "mst-hero-registers-gray.png"), PNG.sync.write(toGrayscale(mstPlate)));
  writeFileSync(
    join(shotsDir, "gap-plate-index.json"),
    `${JSON.stringify({
      legend: {
        gapMarker: GAP_HEX,
        note: "teal = interior background that survived quantization, consolidation and the contour",
      },
      perFacing: summary,
    }, null, 2)}\n`,
  );
  process.stdout.write("  wrote the round-6 plates\n");
}

main();
