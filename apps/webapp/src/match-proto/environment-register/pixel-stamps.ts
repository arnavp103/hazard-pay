/**
 * THROWAWAY PROTOTYPE (#91) — hand-authored pixel stamps for treatment B.
 *
 * THIS FILE IS THE EXPERIMENT'S EXPENSIVE HALF. Everything else in the
 * lane is generated: floor plan, prop geometry, shading clusters, wear.
 * These five grids are typed out pixel by pixel in the `sprites.ts`
 * text-grid format, the way an artist would draw them, and they are the
 * only marks on the board that carry *motif* — a hanging goods rack,
 * jars on a counter, a strapped bundle, a junction box, swept debris.
 *
 * The cost report compares this file's authored-cell count against the
 * generated pixel count, and the `stamp` capture puts an authored prop
 * next to its generated-only twin. That comparison is the lane's required
 * production-risk finding: procedural passes can produce *surface*, but so
 * far only these grids produce *objects*.
 *
 * Rows are padded to the declared width by `stamp()`, so authoring does
 * not require counting dots — but every character must be in the palette,
 * which `pixel-stamps.test.ts` enforces.
 */

import { INK, INK_SOFT, emissions, ramps } from "./palette.ts";

/**
 * Shared stamp palette. Deliberately the same ramps the generated passes
 * use — the stamps must not be able to win the comparison on colour.
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

/** Hanging goods rack — the motif that says "market" rather than "boxes". */
export const stallGoods = stamp("stallGoods", 34, [
  "kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk",
  "khhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhk",
  "kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk",
  "kzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzk",
  "..k....k......k.....k.......k.....",
  "..k....k......k.....k.......k.....",
  ".krk..kwk....kck....ktk.....kRk...",
  ".kRrk.kWwk..kcCk...kdtdk...kRRek..",
  ".kRRrkkWWwk.kCCck..kdttk...kRRRek.",
  ".kRRRkkxWwk.kCCck..kdtuk...kReRek.",
  ".kReRk.kxwk.kvCck..kdtdk...kRRRek.",
  "..kRek..kxk..kvck...kdk.....kRek..",
  "..kek....k....kk.....k.......kk...",
  "...k",
]);

/** Jars, tins and a scale on the stall counter. */
export const counterClutter = stamp("counterClutter", 30, [
  ".....kk.......kkk.......kk....",
  "....knnk.....kcccck....kSSk...",
  "...knuNk....kcCCCck...kzhSzk..",
  "...kNNNk....kCvvCck...kzSSzk..",
  "...kNmNk....kCvvvck...kzzzk...",
  "...kmmNk....kvvvck.....kzk....",
  "....kmk......kvck.....kkzkk...",
  ".kkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
  ".kxWWxkxWWWxkxWWWxkxWWxkxWWxk.",
  ".kkkkkkkkkkkkkkkkkkkkkkkkkkkk.",
]);

/** A strapped bundle roped to the top of a crate stack. */
export const bundleTop = stamp("bundleTop", 22, [
  "......kkkkkkkk........",
  "....kkCCCCCCCCkk......",
  "...kCCcccCCCCCvCk.....",
  "..kCCcccCCCCCCvvCk....",
  "..kCkkkkCCkkkkCvCk....",
  "..kCkRRkCCkRRkCvCk....",
  "..kCkkkkCCkkkkCvCk....",
  "..kCCCCCCCCCCCvvCk....",
  "...kvvvvvvvvvvvCk.....",
  "....kkvvvvvvvkkk......",
  "......kkkkkkkk........",
]);

/** Junction box and conduit run — the wall face's one piece of story. */
export const junctionBox = stamp("junctionBox", 20, [
  "....kkkkkkkkkk......",
  "...kzSSSSSSSSzk.....",
  "...kSssssssssSk.....",
  "...kSskkkkkksSk.....",
  "...kSskaaaakzSk.....",
  "...kSskaookazSk.....",
  "...kSskaaaakzSk.....",
  "...kSskkkkkksSk.....",
  "...kSsssssssSSk.....",
  "...kzSSSSSSSSzk.....",
  "....kkkzSSzkkk......",
  "......kzSSzk........",
  "......kzSSzk........",
  "......kzSSzk........",
  ".....kkzSSzkk.......",
  ".....kzSzzSzk.......",
  ".....kzSk.kSzk......",
  "....kkzSk..kSzkk....",
  "....kzSzk..kzSzk....",
  "....kkkk....kkkk....",
]);

/** Swept debris: cans, a broken slat, a rag. Ground-level clutter. */
export const groundJunk = stamp("groundJunk", 24, [
  ".........kk.............",
  "..kk....kRRk.....kk.....",
  ".kSSk..kReRk....kvvk....",
  ".kzSk..kRRek...kvCvk....",
  ".kzzk..kkek....kkvk.....",
  "..kk...kkkk.....kk......",
  "kkkkkk......kkkkkk......",
  "kxWWxk......kxWWWxk.....",
  "kkkkkk......kkkkkkk.....",
]);

export const stamps: readonly Stamp[] = [
  stallGoods,
  counterClutter,
  bundleTop,
  junctionBox,
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
