/**
 * THROWAWAY PROTOTYPE (#91, round 2) — the occupancy model and the painter.
 *
 * Round 1 shipped a capture in which figures stood on top of crates, on stall
 * roofs, and inside awnings. That was not a drawing mistake, it was a missing
 * model plus a missing sort, and this module is both of them:
 *
 * 1. **Occupancy.** A prop claims whole floor tiles (`propRect`). Units may
 *    only stand on tiles no prop claims (`walkable`). Cells under a roof stay
 *    walkable — being under a canopy is a *lighting* fact, not a blocking one
 *    (`underCover`).
 *
 * 2. **Depth sort.** Round 1 composited the entire unit layer over the entire
 *    board as one flat canvas, so every unit was in front of every prop by
 *    construction — no sort could have saved it. Round 2 puts props and units
 *    in one ordered scene and sorts them with the standard axis-aligned
 *    dimetric rule:
 *
 *        A is in front of B  ⟺  A.x0 ≥ B.x1  or  A.y0 ≥ B.y1
 *
 *    which is a *partial* order, so it is resolved by topological sort rather
 *    than by a comparator. A comparator is the bug that produces exactly
 *    round 1's artefact: `cx + cy` is not transitive across props of
 *    different footprint sizes, and `Array.sort` on a non-transitive
 *    comparator silently emits garbage.
 *
 * The order this module produces is what `compose.ts` turns into real
 * occlusion, and `occupancy.test.ts` asserts both halves mechanically: no
 * unit foot anchor on a claimed tile, and at least one unit genuinely cut by
 * a prop in the shipped frame.
 */

import { type Prop, type PropKind, GRID, propSpecs, props } from "./board-model.ts";

/** Half-open cell rect: `[x0, x1) × [y0, y1)`. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The floor tiles a prop's mass claims. */
export function propRect(prop: Prop): Rect {
  const spec = propSpecs[prop.kind];
  return { x0: prop.cx, y0: prop.cy, x1: prop.cx + spec.sx, y1: prop.cy + spec.sy };
}

/** The floor tiles a prop's roof shades, or `undefined` if it has none. */
export function roofRect(prop: Prop): Rect | undefined {
  const roof = propSpecs[prop.kind].roof;
  if (roof === undefined) { return undefined; }
  return {
    x0: prop.cx + roof.ox,
    y0: prop.cy + roof.oy,
    x1: prop.cx + roof.ox + roof.sx,
    y1: prop.cy + roof.oy + roof.sy,
  };
}

function cellKey(cx: number, cy: number): number {
  return cy * GRID + cx;
}

function fillCells(into: Set<number>, rect: Rect): void {
  for (let cy = Math.max(0, rect.y0); cy < Math.min(GRID, rect.y1); cy += 1) {
    for (let cx = Math.max(0, rect.x0); cx < Math.min(GRID, rect.x1); cx += 1) {
      into.add(cellKey(cx, cy));
    }
  }
}

const blocked = new Set<number>();
for (const prop of props) { fillCells(blocked, propRect(prop)); }

const covered = new Set<number>();
for (const prop of props) {
  const roof = roofRect(prop);
  if (roof !== undefined) { fillCells(covered, roof); }
}

/** Is this a tile a unit is allowed to stand on? */
export function walkable(cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) { return false; }
  return !blocked.has(cellKey(cx, cy));
}

/** Does a prop's mass claim this tile? */
export function occupied(cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) { return false; }
  return blocked.has(cellKey(cx, cy));
}

/** Is this tile under a roof? Covered tiles are still walkable. */
export function underCover(cx: number, cy: number): boolean {
  return covered.has(cellKey(cx, cy));
}

/** Every walkable tile, in a deterministic order. */
export function walkableCells(): { cx: number; cy: number }[] {
  const out: { cx: number; cy: number }[] = [];
  for (let cy = 0; cy < GRID; cy += 1) {
    for (let cx = 0; cx < GRID; cx += 1) {
      if (walkable(cx, cy)) { out.push({ cx, cy }); }
    }
  }
  return out;
}

/**
 * The tile directly *behind* a prop from the camera's point of view — the
 * one a unit stands on to be cut off by that prop. "Behind" in a dimetric
 * view is toward smaller `cx + cy`, so it is the tile off the prop's north
 * face or its west face.
 */
export function coverPost(prop: Prop, lane: "north" | "west"): { cx: number; cy: number } | undefined {
  const rect = propRect(prop);
  const spec = propSpecs[prop.kind];

  // WHERE "behind" is depends entirely on how tall the thing is, and getting
  // this wrong is how the first round-2 build produced five units that were
  // 100 % hidden and therefore proved nothing.
  //
  // - waist and screen cover is shorter than a 22 px figure, so the tile
  //   diagonally behind it gives the classic hip cut with the torso clear;
  // - full-height mass and poles erase anything dead behind them, so the post
  //   moves to the tile on the prop's EAST corner, where the silhouette runs
  //   out and roughly half the figure survives — visibly behind, still there;
  // - a canopy's interesting tile is not behind its column at all, it is
  //   *under the roof*, so the post goes one tile in from the roof's back
  //   corner, clear of the column.
  // `screen` is excluded from the tall rule even when it is taller than the
  // figure: a chain fence is porous by construction, so the interesting tile is
  // the one squarely behind it, not the one off its corner.
  const tall = spec.cover === "full" || spec.cover === "pole";
  const roof = roofRect(prop);
  const candidates: { cx: number; cy: number }[] = [];
  if (spec.cover === "canopy" && roof !== undefined) {
    // Offset along ONE axis only, so the post is under the roof but not on the
    // column's screen line — a canopy's claim is shade, not occlusion, and a
    // unit erased by the column proves neither.
    candidates.push(
      { cx: roof.x0, cy: roof.y0 + 2 },
      { cx: roof.x0 + 1, cy: roof.y0 + 2 },
      { cx: roof.x0 + 2, cy: roof.y0 },
    );
  }
  if (tall) {
    candidates.push({ cx: rect.x1 - 1, cy: rect.y0 - 1 }, { cx: rect.x1 - 1, cy: rect.y0 - 2 });
  }
  candidates.push(
    ...(lane === "north"
      ? [{ cx: rect.x0 - 1, cy: rect.y0 - 1 }, { cx: rect.x0, cy: rect.y0 - 1 }, { cx: rect.x1 - 1, cy: rect.y0 - 1 }]
      : [{ cx: rect.x0 - 1, cy: rect.y0 }, { cx: rect.x0 - 1, cy: rect.y1 - 1 }]),
  );
  return candidates.find((candidate) => walkable(candidate.cx, candidate.cy));
}

/* ------------------------------------------------------------------ */
/* Painter order                                                       */
/* ------------------------------------------------------------------ */

/**
 * The dimetric occlusion predicate for two non-overlapping axis-aligned
 * footprints. `true` means `a` is nearer the camera and must be painted
 * after `b`.
 *
 * The textbook form of this rule is `a.x0 >= b.x1 || a.y0 >= b.y1`, and that
 * form is **wrong** — it was the first thing round 2 shipped and it made the
 * dependency graph *entirely* cyclic: 0 of 79 items had in-degree zero, so the
 * topological sort fell back to depth-sum for every single item and quietly
 * became the naive comparator it was written to replace.
 *
 * The failure is the mutually-diagonal pair. Take a crate at cell (0, 5) and
 * another at (5, 0). The first is further along `cy`, the second is further
 * along `cx`, so the naive rule reports each as in front of the other and the
 * two form a 2-cycle. Those pairs are everywhere on a plaza-shaped board, and
 * enough of them chain together to swallow the whole graph.
 *
 * The repair is to notice what such a pair actually looks like on screen:
 * separated on both axes in *opposite* directions means the two silhouettes
 * sit on different screen diagonals and cannot overlap at all, so there is no
 * ordering to make and asserting one is what manufactures the cycle. Ordering
 * is only claimed where one footprint is genuinely nearer — either along one
 * axis while sharing the other, or along both at once.
 */
export function inFrontOf(a: Rect, b: Rect): boolean {
  const aPastX = a.x0 >= b.x1;
  const bPastX = b.x0 >= a.x1;
  const aPastY = a.y0 >= b.y1;
  const bPastY = b.y0 >= a.y1;
  if ((aPastX && bPastY) || (bPastX && aPastY)) { return false; }
  return aPastX || aPastY;
}

/**
 * Topological painter order, back to front.
 *
 * `inFrontOf` is a partial order and it is not transitive in the presence of
 * three mutually diagonal footprints, so cycles are possible. They are broken
 * deterministically by the depth sum, which is the right answer whenever a
 * cycle exists at all: a cycle means the three silhouettes do not actually
 * overlap pairwise, so any consistent order is visually identical.
 */
export function paintOrder<T>(items: readonly T[], rectOf: (item: T) => Rect): T[] {
  const rects = items.map(rectOf);
  const count = items.length;
  const behind: number[][] = Array.from({ length: count }, () => []);
  const indegree = new Int32Array(count);

  for (let a = 0; a < count; a += 1) {
    for (let b = 0; b < count; b += 1) {
      if (a === b) { continue; }
      const rectA = rects[a];
      const rectB = rects[b];
      if (rectA === undefined || rectB === undefined) { continue; }
      if (!inFrontOf(rectA, rectB)) { continue; }
      behind[b]?.push(a);
      indegree[a] = (indegree[a] ?? 0) + 1;
    }
  }

  const key = (index: number): number => {
    const rect = rects[index];
    if (rect === undefined) { return 0; }
    return (rect.x0 + rect.y0) * 1024 + (rect.x1 + rect.y1) * 4 + index / (count + 1);
  };

  const emitted = new Uint8Array(count);
  const out: T[] = [];
  for (let step = 0; step < count; step += 1) {
    let pick = -1;
    for (let index = 0; index < count; index += 1) {
      if (emitted[index] === 1 || indegree[index] !== 0) { continue; }
      if (pick === -1 || key(index) < key(pick)) { pick = index; }
    }
    if (pick === -1) {
      // Cycle: fall back to the depth sum among whatever is left.
      for (let index = 0; index < count; index += 1) {
        if (emitted[index] === 1) { continue; }
        if (pick === -1 || key(index) < key(pick)) { pick = index; }
      }
    }
    if (pick === -1) { break; }
    emitted[pick] = 1;
    const item = items[pick];
    if (item !== undefined) { out.push(item); }
    for (const next of behind[pick] ?? []) {
      if (emitted[next] === 1) { continue; }
      indegree[next] = (indegree[next] ?? 0) - 1;
    }
    indegree[pick] = -1;
  }
  return out;
}

/** Props alone, painter-sorted — used by both treatments' board passes. */
export function sortedProps(): Prop[] {
  return paintOrder(props, propRect);
}

/** Every prop kind that actually appears on the board, for the cover sheet. */
export function usedPropKinds(): PropKind[] {
  const seen = new Set<PropKind>();
  for (const prop of props) { seen.add(prop.kind); }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/* ------------------------------------------------------------------ */
/* Shade                                                               */
/* ------------------------------------------------------------------ */

/**
 * How far a roof throws its shadow, in cells, with the light in its canon
 * position at screen upper-left. A roof sitting ~33 px above the floor on a
 * 28×14 tile displaces its shadow by a little over two tiles down-screen-right,
 * which is `+cx`.
 */
export const SHADOW_OFFSET = { cx: 2, cy: 0 } as const;

const shadowed = new Set<number>();
for (const prop of props) {
  const roof = roofRect(prop);
  if (roof === undefined) { continue; }
  fillCells(shadowed, {
    x0: roof.x0 + SHADOW_OFFSET.cx,
    y0: roof.y0 + SHADOW_OFFSET.cy,
    x1: roof.x1 + SHADOW_OFFSET.cx,
    y1: roof.y1 + SHADOW_OFFSET.cy,
  });
}

/** Is this tile inside a canopy's cast shadow on the ground? */
export function inCanopyShadow(cx: number, cy: number): boolean {
  return shadowed.has(cellKey(cx, cy));
}

/**
 * Is this tile in shade at all — under a roof, or inside one's cast shadow?
 *
 * This is the single cue round 1 was missing. The cofounder's note was that
 * the figures had "no perspective / depth under the ceiling"; the literal
 * reason is that round 1 drew a canopy and then changed nothing at all about
 * the floor beneath it or the units standing there, so there was no evidence
 * in the pixels that a ceiling existed. A unit whose foot tile is in shade
 * renders one step down its own ramp, and so does the floor.
 */
export function inShade(cx: number, cy: number): boolean {
  return underCover(cx, cy) || inCanopyShadow(cx, cy);
}
