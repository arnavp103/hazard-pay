/**
 * THROWAWAY PROTOTYPE (#82), round 4: gallery plates built from the atlas.
 *
 * `pnpm --filter @hazard-pay/webapp gallery`. Everything here reads the
 * SHIPPED files out of `public/blender-baked` — the same PNG and JSON the
 * browser loads — so a plate cannot flatter the artifact by rendering from an
 * earlier pipeline stage. That specific mistake has cost this lane a cold
 * critique already.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PNG } from "pngjs";

import { ATLAS_PUBLIC_DIR, CROWD_CONFIGS } from "../framing.ts";
import { hexToRgb, INK } from "../palette.ts";

const here = dirname(fileURLToPath(import.meta.url));
const webappDir = join(dirname(here), "..", "..", "..");
const publicDir = join(webappDir, "public", ATLAS_PUBLIC_DIR);
const shotsDir = join(webappDir, "screenshots", "blender-baked-lane");

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

function loadAtlas(name: string): { png: PNG; sheet: SheetJson } {
  return {
    png: PNG.sync.read(readFileSync(join(publicDir, `${name}.png`))),
    sheet: JSON.parse(readFileSync(join(publicDir, `${name}.json`), "utf8")) as SheetJson,
  };
}

/** Rebuild one full cell out of the packed atlas — trim undone, as Pixi does. */
function cellOf(atlas: PNG, sheet: SheetJson, frameName: string): {
  data: Uint8Array;
  width: number;
  height: number;
} {
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

interface Tile { data: Uint8Array; width: number; height: number }

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

function main(): void {
  for (const config of CROWD_CONFIGS) {
    const { png: atlas, sheet } = loadAtlas(config.atlas);

    // Archetype sheet: every facing of both fodder archetypes, both factions.
    const rows: (Tile | null)[] = [];
    for (const unit of ["brute_a", "marksman_a", "brute_b", "marksman_b"]) {
      for (let facing = 0; facing < 8; facing += 1) {
        const track = sheet.animations[`${unit}_idle_${String(facing)}`];
        const name = track?.[0];
        rows.push(name === undefined ? null : cellOf(atlas, sheet, name));
      }
    }
    const archetypes = plate(rows, 8, 3, 4);
    writeFileSync(join(shotsDir, `fodder-archetypes-${config.key}.png`), PNG.sync.write(archetypes));

    // Tier ladder: fodder, fodder, hero at 1x and 4x on one ground line. This
    // is the plate the #69 resolution fork is actually about.
    const ladder: Tile[] = [];
    for (const unit of ["brute_a", "marksman_a", "medic_a", "brute_b", "marksman_b", "medic_b"]) {
      const name = sheet.animations[`${unit}_idle_0`]?.[0];
      if (name === undefined) { throw new Error(`no idle for ${unit}`); }
      ladder.push(cellOf(atlas, sheet, name));
    }
    writeFileSync(join(shotsDir, `tier-ladder-${config.key}-1x.png`), PNG.sync.write(plate(ladder, 6, 4, 1)));
    const zoomed = plate(ladder, 6, 4, 4);
    writeFileSync(join(shotsDir, `tier-ladder-${config.key}.png`), PNG.sync.write(zoomed));
    writeFileSync(
      join(shotsDir, `tier-ladder-${config.key}-gray.png`),
      PNG.sync.write(toGrayscale(zoomed)),
    );

    const measured = Object.entries(sheet.meta.units)
      .map(([id, meta]) => `${id}=${String(meta.standingArtPx)}/${String(meta.maxArtPx)}px`)
      .join(" ");
    process.stdout.write(`  ${config.key}: ${measured}\n`);
  }
}

main();
