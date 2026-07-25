/**
 * THROWAWAY PROTOTYPE (#91) — placeholder units, held constant.
 *
 * Characters are explicitly NOT this lane's variable, so the same sprites
 * are composited over both treatments by the same code path. Two tiers,
 * per the #69 tier-separation ruling:
 *
 * - HERO — the borrowed 48×64 medic from the pixel control lane (#74).
 *   Not re-authored here.
 * - FODDER — two archetypes (melee, ranged) generated at 38×50, which is
 *   the "slight size boost" ratio the ruling settled on (48/38 ≈ 1.26)
 *   rather than the retracted half-footprint default. Detail density does
 *   the rest of the separation; marking (rim light, banner, decal) is
 *   deferred by that same ruling and is deliberately not used.
 *
 * Fodder sprites are generated from a rect DSL on purpose: they are
 * placeholders, and generating them keeps the lane's authoring budget
 * where the experiment is — the board.
 */

import { type Archetype, type Side, type Tier, type UnitPlacement } from "./board-model.ts";
import { INK, INK_SOFT, emissions, ramps } from "./palette.ts";
import { type Surface, setPixel } from "./pixel-canvas.ts";
import { MEDIC_HEIGHT, MEDIC_WIDTH, medicPalette, medicSide } from "./borrowed-medic-48.ts";

export const FODDER_WIDTH = 38;
export const FODDER_HEIGHT = 50;

export type ColorGrid = (string | undefined)[][];

export interface Sprite {
  width: number;
  height: number;
  grid: ColorGrid;
}

/**
 * Unit-local palette. Body/armour colours are pulled from the shared
 * environment ramps so the tiers sit in the same world; only skin has no
 * environment equivalent and is declared locally.
 */
const fodderPalette = {
  armor: ramps.steel,
  cloth: { crew: ramps.rust, rival: ramps.canvasCool },
  pants: ramps.plum,
  boot: { shadow: INK, base: INK_SOFT, light: ramps.plum.shadow },
  skin: { shadow: "#70483a", base: "#a96e51", light: "#d9a078" },
  signal: { crew: emissions.amber, rival: emissions.teal },
} as const;

function emptyGrid(width: number, height: number): ColorGrid {
  return Array.from({ length: height }, () => Array.from<string | undefined>({ length: width }).fill(undefined));
}

function paint(grid: ColorGrid, color: string, x: number, y: number, width: number, height: number): void {
  for (let py = y; py < y + height; py += 1) {
    const row = grid[py];
    if (row === undefined) { continue; }
    for (let px = x; px < x + width; px += 1) {
      if (px < 0 || px >= row.length) { continue; }
      row[px] = color;
    }
  }
}

/** Plum-black silhouette ink, matching the board's contour law. */
function inkOutline(grid: ColorGrid): void {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const edges: [number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grid[y]?.[x] === undefined) { continue; }
      const open = grid[y]?.[x - 1] === undefined
        || grid[y]?.[x + 1] === undefined
        || grid[y - 1]?.[x] === undefined
        || grid[y + 1]?.[x] === undefined;
      if (open) { edges.push([x, y]); }
    }
  }
  for (const [x, y] of edges) {
    const row = grid[y];
    if (row !== undefined) { row[x] = INK; }
  }
}

/** Light from upper-left: the right third of every mass drops a band. */
function shadeRight(grid: ColorGrid, ramp: { base: string; light: string; shadow: string }): void {
  for (const row of grid) {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== ramp.base) { continue; }
      const runEnd = row.findIndex((value, index) => index > x && value !== ramp.base);
      const end = runEnd === -1 ? row.length : runEnd;
      const width = end - x;
      for (let index = x; index < end; index += 1) {
        row[index] = index >= end - Math.max(1, Math.round(width / 3)) ? ramp.shadow : ramp.base;
      }
      const first = row[x];
      if (first !== undefined && width > 3) { row[x] = ramp.light; }
      x = end;
    }
  }
}

function buildFodder(archetype: Archetype, side: Side): Sprite {
  const grid = emptyGrid(FODDER_WIDTH, FODDER_HEIGHT);
  const cloth = fodderPalette.cloth[side === "crew" ? "crew" : "rival"];
  const signal = fodderPalette.signal[side === "crew" ? "crew" : "rival"];
  const armor = fodderPalette.armor;
  const heavy = archetype === "melee";

  // Head + helmet.
  paint(grid, armor.base, heavy ? 13 : 14, 3, heavy ? 12 : 10, 7);
  paint(grid, fodderPalette.skin.base, heavy ? 15 : 16, 8, heavy ? 8 : 7, 5);
  paint(grid, INK_SOFT, heavy ? 15 : 16, 9, heavy ? 8 : 7, 2);

  // Torso.
  const torsoX = heavy ? 10 : 12;
  const torsoW = heavy ? 18 : 14;
  paint(grid, cloth.base, torsoX, 13, torsoW, 16);
  paint(grid, armor.base, torsoX + 2, 14, torsoW - 4, 7);
  paint(grid, signal.active, torsoX + torsoW - 6, 16, 3, 2);

  // Arms.
  paint(grid, cloth.base, torsoX - 3, 15, 4, 12);
  paint(grid, cloth.base, torsoX + torsoW - 1, 15, 4, 12);

  // Legs + boots.
  paint(grid, fodderPalette.pants.base, torsoX + 2, 29, 5, 13);
  paint(grid, fodderPalette.pants.base, torsoX + torsoW - 8, 29, 5, 13);
  paint(grid, fodderPalette.boot.base, torsoX + 1, 42, 7, 5);
  paint(grid, fodderPalette.boot.base, torsoX + torsoW - 9, 42, 7, 5);

  if (heavy) {
    // Riot slab on the leading arm — the silhouette cue for melee fodder.
    paint(grid, armor.base, 4, 16, 7, 22);
    paint(grid, armor.shadow, 5, 18, 5, 18);
    paint(grid, signal.idle, 6, 21, 3, 3);
  } else {
    // Long arm across the body — the silhouette cue for ranged fodder.
    paint(grid, armor.shadow, 6, 22, 24, 3);
    paint(grid, armor.base, 24, 20, 6, 5);
    paint(grid, signal.active, 28, 21, 2, 2);
    // Pack.
    paint(grid, cloth.shadow, 8, 15, 5, 11);
  }

  shadeRight(grid, armor);
  shadeRight(grid, cloth);
  shadeRight(grid, fodderPalette.pants);
  inkOutline(grid);
  return { width: FODDER_WIDTH, height: FODDER_HEIGHT, grid };
}

function medicSprite(): Sprite {
  const grid = emptyGrid(MEDIC_WIDTH, MEDIC_HEIGHT);
  medicSide.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char === ".") { return; }
      const hex = medicPalette[char];
      const target = grid[y];
      if (hex === undefined || target === undefined) { return; }
      target[x] = hex;
    });
  });
  return { width: MEDIC_WIDTH, height: MEDIC_HEIGHT, grid };
}

const cache = new Map<string, Sprite>();

export function spriteFor(tier: Tier, archetype: Archetype, side: Side): Sprite {
  const id = `${tier}-${archetype}-${side}`;
  const hit = cache.get(id);
  if (hit !== undefined) { return hit; }
  const sprite = tier === "hero" ? medicSprite() : buildFodder(archetype, side);
  cache.set(id, sprite);
  return sprite;
}

/** Composite one placeholder unit, feet on the projected cell centre. */
export function drawUnit(surface: Surface, unit: UnitPlacement, anchorX: number, anchorY: number): void {
  const sprite = spriteFor(unit.tier, unit.archetype, unit.side);
  const originX = Math.round(anchorX - sprite.width / 2);
  const originY = Math.round(anchorY - sprite.height);
  for (let y = 0; y < sprite.height; y += 1) {
    for (let x = 0; x < sprite.width; x += 1) {
      const sourceX = unit.mirrored ? sprite.width - 1 - x : x;
      const color = sprite.grid[y]?.[sourceX];
      if (color === undefined) { continue; }
      setPixel(surface, originX + x, originY + y, color);
    }
  }
}
