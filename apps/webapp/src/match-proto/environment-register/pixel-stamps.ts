/**
 * THROWAWAY PROTOTYPE (#91) — hand-authored pixel stamps for treatment B.
 *
 * THIS FILE IS THE EXPERIMENT'S EXPENSIVE HALF. Everything else in the lane is
 * generated: floor plan, prop geometry, shading clusters, wear. These grids are
 * typed out pixel by pixel the way an artist would draw them, and they are the
 * only marks on the board that carry *motif* — jars on a counter, a strapped
 * bundle, a junction box, a stencilled container number, swept debris.
 *
 * The cost report compares this file's authored-cell count against the
 * generated pixel count, and the `stamp` capture puts an authored prop next to
 * its generated-only twin.
 *
 * ROUND 2 re-authored all of them, for two reasons.
 *
 * The first is scale: the board's tile went from 64×32 to 28×14, so round 1's
 * grids were more than twice the size their props could hold. Round 1 shipped
 * them anyway by *tiling* a half-size grid across the stall front, which is
 * visible in that capture as repeated identical wares — the honest reading of
 * that repetition was always "these were never drawn at the right size".
 *
 * The second is the cofounder's note about the dots. Round 1's `stallGoods`
 * grid is **retired**, not rescaled. It was a 34-wide rack of single-pixel
 * hanging goods on a uniform pitch: one mark, one value, one size, evenly
 * spaced. That is a texture, and texture hung in the air over a figure is
 * exactly the "no perspective / depth under the ceiling" read. Hanging goods
 * are now shared *geometry* (`hangingWares` in `prop-geometry.ts`) with varied
 * sizes, a per-bundle value ramp, mutual occlusion and cast shadows, so both
 * treatments get objects instead of one treatment getting dots.
 */

import { INK, INK_SOFT, emissions, ramps } from "./palette.ts";

/**
 * Shared stamp palette. Deliberately the same ramps the generated passes use —
 * the stamps must not be able to win the comparison on colour.
 */
export const stampPalette: Record<string, string> = {
  k: INK,
  d: INK_SOFT,
  w: ramps.wood.light,
  W: ramps.wood.base,
  x: ramps.wood.shadow,
  r: ramps.rust.light,
  R: ramps.rust.base,
  e: ramps.rust.shadow,
  s: ramps.steel.light,
  S: ramps.steel.base,
  z: ramps.steel.shadow,
  h: ramps.steel.spec ?? ramps.steel.light,
  c: ramps.canvasWarm.light,
  C: ramps.canvasWarm.base,
  v: ramps.canvasWarm.shadow,
  n: ramps.canvasCool.light,
  N: ramps.canvasCool.base,
  m: ramps.canvasCool.shadow,
  g: ramps.concrete.light,
  G: ramps.concrete.base,
  b: ramps.concrete.shadow,
  y: ramps.hazard.base,
  t: emissions.teal.active,
  u: emissions.teal.hot,
  a: emissions.amber.active,
  o: emissions.amber.hot,
};

export interface Stamp {
  name: string;
  width: number;
  rows: readonly string[];
}

function stamp(name: string, width: number, rows: string[]): Stamp {
  return { name, width, rows: rows.map((row) => row.padEnd(width, ".")) };
}

/** Jars, a tin and a scale on the stall counter. */
export const counterCrock = stamp("counterCrock", 16, [
  "..k....kk....k..",
  ".knk..kcck..kSk.",
  ".kNk..kCvk..kzk.",
  ".kmk..kvvk.kkzkk",
  "kkkkkkkkkkkkkkkk",
  "kxWWxkxWWWxkxWxk",
  "kkkkkkkkkkkkkkkk",
]);

/** A strapped bundle roped to the top of a crate stack. */
export const bundleTop = stamp("bundleTop", 13, [
  "...kkkkkk....",
  "..kCcccCvk...",
  ".kCcCCCCvvk..",
  ".kCkkCCkkvk..",
  ".kCkRkCkRkvk.",
  ".kCCCCCCCvvk.",
  "..kvvvvvvvk..",
  "...kkkkkkk...",
]);

/** Junction box and conduit run — the wall face's one piece of story. */
export const junctionBox = stamp("junctionBox", 11, [
  "..kkkkkkk..",
  ".kzSSSSSzk.",
  ".kSskkksSk.",
  ".kSskaakSk.",
  ".kSskaokSk.",
  ".kSskkksSk.",
  ".kzSSSSSzk.",
  "..kkzSzkk..",
  "....kzSk...",
  "....kzSk...",
  "...kkzSkk..",
  "...kzSkSzk.",
  "...kkk.kkk.",
]);

/** Stencilled serial and a hazard placard on a container door. */
export const containerTag = stamp("containerTag", 15, [
  "kkkkkkkkk..kkkk",
  "kzhzhzhzk.kyyyk",
  "kzhkkkhzk.kykyk",
  "kzhzhzhzk.kyyyk",
  "kkkkkkkkk..kkkk",
]);

/** Swept debris: cans, a broken slat, a rag. Ground-level clutter. */
export const groundJunk = stamp("groundJunk", 14, [
  "..kk.....kk...",
  ".kRek...kvCk..",
  ".kkek...kkvk..",
  "kkkkkk...kk...",
  "kxWWxk........",
  "kkkkkk........",
]);

export const stamps: readonly Stamp[] = [
  counterCrock,
  bundleTop,
  junctionBox,
  containerTag,
  groundJunk,
];

/** Non-transparent authored cells — the cost-report numerator. */
export function authoredCells(): number {
  return stamps.reduce(
    (total, entry) => total + entry.rows.reduce(
      (rowTotal, row) => rowTotal + [...row].filter((char) => char !== ".").length,
      0,
    ),
    0,
  );
}
