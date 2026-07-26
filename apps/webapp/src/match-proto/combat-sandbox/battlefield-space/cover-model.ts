/**
 * THROWAWAY PROTOTYPE (#100, on the #96 sandbox): the tactical board model.
 *
 * This is variant **B**'s half of "is the battlefield an open plaza or a tile
 * grid with cover". It ports the *model* from lane 5's environment register
 * (`prototype/environment-register`, PR #92) onto the combat sandbox — the
 * 20x20 walkable grid, the `CoverClass` vocabulary, per-prop footprint cells a
 * body may never stand on, and roofs that shade but stay walkable. It does not
 * port lane 5's prop *manifest*, because that manifest was authored against
 * lane 5's own 640x360 board; this one is authored against the board the
 * sandbox already has (`board.ts`) so the two variants differ in the model and
 * not in the set dressing.
 *
 * Nothing here is an art-direction commitment, and nothing here rules on the
 * question. See the ticket.
 *
 * ## The one number the whole port hangs on
 *
 * Lane 5's board is measured in board pixels: a 28x14 tile against a 22 px
 * fodder figure. The sandbox is measured in world units: a 1.48-unit fodder
 * figure under a 2:1 dimetric camera at 40 px/unit. The port preserves the
 * ratio a designer actually feels — **tile width divided by figure height** —
 * rather than either raw number, which lands the tile at ~1.153 world units.
 * See `TILE`.
 *
 * That is a finding in itself: lane 5's tile is almost exactly the sandbox's
 * `SEPARATION_RADIUS` (1.05), so "one body per tile" and "boid personal space"
 * are the same distance to within 10 %. The two models were built by different
 * people for different reasons and agree.
 *
 * ## Two contracts per prop, not one
 *
 * A lamp post claims a whole floor tile a body may never stand on, and
 * occludes a 3 px slice of a figure. Lane 5 measured both facts and stored
 * only the first. So every prop here carries:
 *
 *   - `sx`/`sy` — the **footprint**, in cells. Movement. Hard.
 *   - `height` + `girth` + `cover` — the **silhouette**. Sight. Soft.
 *
 * `girth` is the fraction of the footprint the visible mass actually fills.
 * A lamp post is 0.14 of its tile; a shipping container is 0.95 of its six.
 * Conflating the two is what makes a tile grid feel like it is lying.
 *
 * ## Retrofit props
 *
 * Half the manifest below is not new art at all — it is `board.ts`'s existing,
 * free-placed set dressing (the market stack, the foundry block, the vent
 * drums, the pallets) given a footprint after the fact. That is deliberate: it
 * is the cheapest honest measurement of what variant B would cost the art
 * lanes, because the snap error is computable (`snapReport`) rather than
 * argued about.
 *
 * ## Round 2: density is a parameter, not a constant
 *
 * Round 1 shipped one board — lane 5's density, 32 authored props on a 20x20
 * grid — and its two uncomfortable numbers (only 21 of 40 units reach a target,
 * and "harder to parse") could equally well be properties of *that density* as
 * of cover as such. So the board is now built by `boardFor(density)` and the
 * manifest below is the **densest** point on the axis, not the only one.
 *
 * The thinner is deliberately a rule and not a second hand-authored layout:
 * `thin()` keeps a fixed count of authored props, chosen farthest-point from
 * each other and from `board.ts`'s free-placed masses. One knob, monotone, and
 * `dense` keeps all 32 — byte-for-byte round 1's board — so a difference
 * between two densities is attributable to density and to nothing else. A
 * second authored layout would have confounded spacing with taste.
 */

import { FODDER_HEIGHT, heightOf, type Tier } from "../units.ts";

/** Cells a side. Lane 5's number, kept so the two boards stay comparable. */
export const GRID = 20;

/** Lane 5's yardstick: a fodder figure is 22 board px tall. */
export const FODDER_FIGURE_PX = 22;
/** Lane 5's tile: 28 board px wide, 14 tall (the 2:1 dimetric). */
export const TILE_PX = 28;

/** Y component of the sandbox camera's up vector (scene.ts `UP`). */
const DIMETRIC_UP_Y = 0.86603;

/**
 * Tile side, in world units.
 *
 * Derived, never typed in: a world square of side `s` aligned to the x/z axes
 * projects to `s * sqrt(2)` screen units wide under this camera, and a world
 * height of `h` projects to `h * 0.86603`. Setting
 * `tileScreenWidth / figureScreenHeight` equal to lane 5's `28 / 22` gives
 * the expression below — 1.1534 world units.
 */
export const TILE = (TILE_PX / FODDER_FIGURE_PX) * FODDER_HEIGHT * DIMETRIC_UP_Y / Math.SQRT2;

/** Board pixels to world units, for porting lane 5's authored prop heights. */
export const WORLD_PER_BOARD_PX = FODDER_HEIGHT / FODDER_FIGURE_PX;

/** Grid extent in world units, centred on the origin. */
export const BOARD_EXTENT = GRID * TILE;

/**
 * How a prop reads as cover against a fodder figure. Lane 5's vocabulary,
 * unchanged — the point of this prototype is to test *that* vocabulary, so
 * renaming it would be cheating.
 */
export type CoverClass = "canopy" | "full" | "low" | "pole" | "screen" | "waist";

/**
 * Fraction of an occluded band that actually stops a sightline.
 *
 * `girth` already answers "how often is the line intercepted at all", so this
 * answers only "how much does it stop when it is". A chain fence is tall and
 * wide and you still read a unit through it; a lamp post is nearly opaque but
 * almost never in the way.
 */
export const POROSITY: Record<CoverClass, number> = {
  canopy: 0.6,
  full: 1,
  low: 1,
  pole: 0.85,
  screen: 0.5,
  waist: 1,
};

/** Fraction of the footprint the visible mass fills. See the header. */
export const GIRTH: Record<CoverClass, number> = {
  canopy: 0.3,
  full: 0.95,
  low: 0.85,
  pole: 0.14,
  screen: 0.98,
  waist: 0.88,
};

export interface Roof {
  /** Roof origin relative to the prop anchor, in cells. */
  ox: number;
  oy: number;
  sx: number;
  sy: number;
  /** Underside height above the floor, in world units. */
  lift: number;
}

export interface PropSpec {
  /** Footprint cells. A body may never stand here. */
  sx: number;
  sy: number;
  /** Silhouette height, world units, floor to top. */
  height: number;
  cover: CoverClass;
  /** Overhead roof. Cells under it stay walkable and are shaded. */
  roof?: Roof;
  note: string;
}

export type PropKind
  = | "awningStall"
    | "barrelPair"
    | "boardCrate"
    | "bollard"
    | "cableSpool"
    | "canopySpan"
    | "chainFence"
    | "container"
    | "crateStack"
    | "dumpster"
    | "foundryBlock"
    | "hulk"
    | "jerseyBarrier"
    | "lampPost"
    | "marketStack"
    | "pallet"
    | "pillar"
    | "pipeRack"
    | "railing"
    | "rubble"
    | "sandbagLine"
    | "signPylon"
    | "ventDrum";

/** Lane 5's authored height, in board pixels, converted once. */
function px(boardPixels: number): number {
  return boardPixels * WORLD_PER_BOARD_PX;
}

/**
 * The occupancy specs. The first block is lane 5's manifest verbatim in shape
 * and height (its board-pixel numbers converted through `px`); the second is
 * the retrofit block — `board.ts`'s existing set dressing, measured off its
 * own world coordinates rather than authored here.
 */
export const propSpecs: Record<PropKind, PropSpec> = {
  awningStall: {
    cover: "canopy",
    height: px(42),
    note: "market stall — counter blocks, awning shades the row in front",
    roof: { lift: px(38), ox: 0, oy: 0, sx: 2, sy: 2 },
    sx: 2,
    sy: 1,
  },
  barrelPair: { cover: "waist", height: px(16), note: "barrel pair — chest-high, rounded", sx: 1, sy: 1 },
  boardCrate: { cover: "waist", height: px(17), note: "board.ts crate pair (retrofit)", sx: 2, sy: 1 },
  bollard: { cover: "waist", height: px(10), note: "board.ts capped bollard (retrofit)", sx: 1, sy: 1 },
  cableSpool: { cover: "waist", height: px(13), note: "cable spool — hip-high clutter", sx: 1, sy: 1 },
  canopySpan: {
    cover: "canopy",
    height: px(40),
    note: "canopy span — bare shelter, walkable and shaded underneath",
    roof: { lift: px(38), ox: 0, oy: 0, sx: 2, sy: 2 },
    sx: 2,
    sy: 1,
  },
  chainFence: { cover: "screen", height: px(26), note: "chain fence — tall but porous, unit reads through it", sx: 3, sy: 1 },
  container: { cover: "full", height: px(30), note: "shipping container — total occlusion, hard edge", sx: 3, sy: 2 },
  crateStack: { cover: "waist", height: px(18), note: "crate stack — chest-high hard block", sx: 1, sy: 1 },
  dumpster: { cover: "waist", height: px(16), note: "dumpster — chest-high, wide", sx: 2, sy: 1 },
  foundryBlock: { cover: "full", height: px(68), note: "board.ts foundry/clinic block (retrofit)", sx: 5, sy: 5 },
  hulk: { cover: "full", height: px(20), note: "wrecked vehicle hulk — full cover, broken top line", sx: 3, sy: 2 },
  jerseyBarrier: { cover: "waist", height: px(13), note: "jersey barrier — hard waist cover", sx: 2, sy: 1 },
  lampPost: { cover: "pole", height: px(46), note: "lamp post — thin vertical, occludes a 3 px slice", sx: 1, sy: 1 },
  marketStack: { cover: "full", height: px(68), note: "board.ts market stack (retrofit)", sx: 5, sy: 5 },
  pallet: { cover: "low", height: px(4), note: "board.ts pallet (retrofit) — blocks the tile, hides nothing", sx: 2, sy: 2 },
  pillar: { cover: "pole", height: px(44), note: "concrete pillar — narrow full-height occluder", sx: 1, sy: 1 },
  pipeRack: { cover: "waist", height: px(20), note: "pipe rack — shoulder-high, deep", sx: 1, sy: 2 },
  railing: { cover: "screen", height: px(12), note: "pipe railing — see-through, occludes in stripes", sx: 3, sy: 1 },
  rubble: { cover: "low", height: px(6), note: "rubble — blocks the tile, hides nothing", sx: 1, sy: 1 },
  sandbagLine: { cover: "waist", height: px(10), note: "sandbag line — stand behind, cut at the thigh", sx: 2, sy: 1 },
  signPylon: { cover: "pole", height: px(52), note: "sign pylon — thin mast under a lit panel", sx: 1, sy: 1 },
  ventDrum: { cover: "waist", height: px(9), note: "board.ts vent drum (retrofit)", sx: 1, sy: 1 },
};

/** Kinds that are `board.ts` set dressing given a footprint after the fact. */
export const RETROFIT_KINDS: ReadonlySet<PropKind> = new Set<PropKind>([
  "boardCrate",
  "bollard",
  "foundryBlock",
  "marketStack",
  "pallet",
  "ventDrum",
]);

interface AuthoredEntry {
  id: string;
  kind: PropKind;
  /** North-west cell of the footprint. Integers: occupancy is per tile. */
  cx: number;
  cy: number;
}

/**
 * The authored cover manifest.
 *
 * Placed into the engagement band the sandbox's own layout produces — the two
 * lines close along the world diagonal, so the fight lives around cell
 * (9.5, 9.5) and spreads on the anti-diagonal. Every entry is on integer cells
 * and none overlaps `board.ts`'s existing masses; `cover-model.test.ts`
 * asserts both mechanically rather than trusting this comment.
 *
 * Roughly lane 5's four quadrants: a barricade line for the near side, a
 * hard-cover yard for the far side, aisle furniture down the middle, and two
 * canopies on the flanks.
 */
const AUTHORED: readonly AuthoredEntry[] = [
  // --- side 1's barricade line (low cx + cy) ------------------------------
  { cx: 2, cy: 2, id: "hulk-sw", kind: "hulk" },
  { cx: 2, cy: 9, id: "dumpster-w", kind: "dumpster" },
  { cx: 2, cy: 7, id: "canopy-w", kind: "canopySpan" },
  { cx: 4, cy: 10, id: "jersey-w", kind: "jerseyBarrier" },
  { cx: 5, cy: 8, id: "sandbag-w-a", kind: "sandbagLine" },
  { cx: 6, cy: 10, id: "barrel-w", kind: "barrelPair" },
  { cx: 6, cy: 7, id: "spool-w", kind: "cableSpool" },
  { cx: 7, cy: 6, id: "sandbag-w-b", kind: "sandbagLine" },
  { cx: 7, cy: 11, id: "pillar-w", kind: "pillar" },
  { cx: 8, cy: 9, id: "crate-w", kind: "crateStack" },
  { cx: 8, cy: 4, id: "rail-s", kind: "railing" },
  { cx: 8, cy: 2, id: "fence-s", kind: "chainFence" },
  { cx: 9, cy: 7, id: "rubble-s", kind: "rubble" },

  // --- side 0's hard-cover yard (high cx + cy) ----------------------------
  { cx: 14, cy: 16, id: "container-ne", kind: "container" },
  { cx: 16, cy: 11, id: "hulk-ne", kind: "hulk" },
  { cx: 13, cy: 14, id: "crate-ne-a", kind: "crateStack" },
  { cx: 14, cy: 13, id: "crate-ne-b", kind: "crateStack" },
  { cx: 15, cy: 14, id: "barrel-ne", kind: "barrelPair" },
  { cx: 11, cy: 16, id: "jersey-ne", kind: "jerseyBarrier" },
  { cx: 14, cy: 10, id: "sandbag-e", kind: "sandbagLine" },
  { cx: 12, cy: 11, id: "pillar-ne", kind: "pillar" },
  { cx: 16, cy: 7, id: "fence-e", kind: "chainFence" },
  { cx: 17, cy: 13, id: "pipe-ne", kind: "pipeRack" },
  { cx: 17, cy: 17, id: "stall-ne", kind: "awningStall" },

  // --- aisle furniture: the only things standing in the contact lane ------
  { cx: 9, cy: 10, id: "lamp-w", kind: "lampPost" },
  { cx: 11, cy: 9, id: "lamp-e", kind: "lampPost" },
  { cx: 7, cy: 16, id: "sign-w", kind: "signPylon" },
  { cx: 16, cy: 4, id: "sign-e", kind: "signPylon" },
  { cx: 10, cy: 11, id: "crate-aisle-a", kind: "crateStack" },
  { cx: 11, cy: 12, id: "crate-aisle-b", kind: "crateStack" },
  { cx: 8, cy: 11, id: "spool-aisle", kind: "cableSpool" },
  { cx: 15, cy: 9, id: "rubble-e", kind: "rubble" },
];

interface RetrofitEntry {
  id: string;
  kind: PropKind;
  /** The world AABB `board.ts` actually draws, read off its own literals. */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/**
 * `board.ts`'s existing free-placed set dressing, with the world AABB each
 * mass actually occupies. Cells are **derived** from these by snapping
 * outward, never authored — the whole point is to measure what that snap
 * costs, not to hide it.
 */
const RETROFIT: readonly RetrofitEntry[] = [
  // Left market stack: base centre (-6.53, 3.60), size 4.03 x 4.35.
  { id: "board-market", kind: "marketStack", x0: -8.545, x1: -4.515, z0: 1.425, z1: 5.775 },
  // Right foundry / clinic block: centre (3.80, -6.46), size 4.03 x 3.71.
  { id: "board-foundry", kind: "foundryBlock", x0: 1.785, x1: 5.815, z0: -8.315, z1: -4.605 },
  // The four vent drums on the rear platform, radius 0.46.
  { id: "board-drum-a", kind: "ventDrum", x0: -8.46, x1: -7.54, z0: -5.06, z1: -4.14 },
  { id: "board-drum-b", kind: "ventDrum", x0: -7.06, x1: -6.14, z0: -6.06, z1: -5.14 },
  { id: "board-drum-c", kind: "ventDrum", x0: -5.66, x1: -4.74, z0: -6.86, z1: -5.94 },
  { id: "board-drum-d", kind: "ventDrum", x0: -4.86, x1: -3.94, z0: -5.46, z1: -4.54 },
  // Two pallets.
  { id: "board-pallet-a", kind: "pallet", x0: -2.32, x1: -1.19, z0: 2.6, z1: 3.66 },
  { id: "board-pallet-b", kind: "pallet", x0: 2.44, x1: 3.54, z0: -2.085, z1: -0.955 },
  // The stacked crate pair.
  { id: "board-crate", kind: "boardCrate", x0: 1.92, x1: 2.75, z0: -4.59, z1: -3.75 },
  // The capped bollard in the open lane.
  { id: "board-bollard", kind: "bollard", x0: -3.0, x1: -2.4, z0: 3.9, z1: 4.5 },
];

/** Half-open cell rect: `[cx0, cx1) x [cy0, cy1)`. */
export interface CellRect {
  cx0: number;
  cy0: number;
  cx1: number;
  cy1: number;
}

export interface WorldRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface BoardProp {
  id: string;
  kind: PropKind;
  cover: CoverClass;
  /** Footprint cells. Hard: a body may never stand here. */
  cells: CellRect;
  /** Silhouette height, world units. */
  height: number;
  /** Fraction of the footprint the visible mass fills. Soft: sight only. */
  girth: number;
  roof?: Roof;
  /** `board.ts` set dressing given a footprint after the fact. */
  retrofit: boolean;
  /** The world AABB the art really occupies. Only differs for retrofits. */
  trueRect: WorldRect;
  note: string;
}

/** World x of a cell's near edge. Cell `cx` spans `[edge(cx), edge(cx + 1))`. */
export function cellEdge(index: number): number {
  return (index - GRID / 2) * TILE;
}

/** Cell index containing a world coordinate. May fall outside `[0, GRID)`. */
export function cellIndexAt(world: number): number {
  return Math.floor(world / TILE + GRID / 2);
}

/** World centre of a cell. */
export function cellCentre(cx: number, cy: number): { x: number; z: number } {
  return { x: (cx + 0.5 - GRID / 2) * TILE, z: (cy + 0.5 - GRID / 2) * TILE };
}

/** The world AABB a cell rect claims. */
export function worldRectOf(cells: CellRect): WorldRect {
  return {
    x0: cellEdge(cells.cx0),
    x1: cellEdge(cells.cx1),
    z0: cellEdge(cells.cy0),
    z1: cellEdge(cells.cy1),
  };
}

function snapOutward(rect: WorldRect): CellRect {
  return {
    cx0: Math.floor(rect.x0 / TILE + GRID / 2),
    cx1: Math.ceil(rect.x1 / TILE + GRID / 2),
    cy0: Math.floor(rect.z0 / TILE + GRID / 2),
    cy1: Math.ceil(rect.z1 / TILE + GRID / 2),
  };
}

function snapNearest(rect: WorldRect): CellRect {
  const cx0 = Math.round(rect.x0 / TILE + GRID / 2);
  const cy0 = Math.round(rect.z0 / TILE + GRID / 2);
  return {
    cx0,
    cx1: Math.max(cx0 + 1, Math.round(rect.x1 / TILE + GRID / 2)),
    cy0,
    cy1: Math.max(cy0 + 1, Math.round(rect.z1 / TILE + GRID / 2)),
  };
}

function propOf(entry: AuthoredEntry): BoardProp {
  const spec = propSpecs[entry.kind];
  const cells: CellRect = {
    cx0: entry.cx,
    cx1: entry.cx + spec.sx,
    cy0: entry.cy,
    cy1: entry.cy + spec.sy,
  };
  return {
    cells,
    cover: spec.cover,
    girth: GIRTH[spec.cover],
    height: spec.height,
    id: entry.id,
    kind: entry.kind,
    note: spec.note,
    retrofit: false,
    trueRect: worldRectOf(cells),
    ...(spec.roof === undefined ? {} : { roof: spec.roof }),
  };
}

function retrofitPropOf(entry: RetrofitEntry): BoardProp {
  const spec = propSpecs[entry.kind];
  const trueRect: WorldRect = { x0: entry.x0, x1: entry.x1, z0: entry.z0, z1: entry.z1 };
  return {
    cells: snapOutward(trueRect),
    cover: spec.cover,
    girth: GIRTH[spec.cover],
    height: spec.height,
    id: entry.id,
    kind: entry.kind,
    note: spec.note,
    retrofit: true,
    trueRect,
  };
}

/**
 * The full manifest: authored cover plus retrofitted set dressing, in a fixed
 * order. Behaviours iterate a board's prop array by index and break ties on
 * index, so this order is part of the determinism contract — and the thinner
 * below preserves it, so a prop's index is stable across densities too.
 */
const ALL_PROPS: readonly BoardProp[] = [
  ...RETROFIT.map(retrofitPropOf),
  ...AUTHORED.map(propOf),
];

/**
 * The props that exist in the open-plaza variant too — `board.ts`'s set
 * dressing, which is already on screen in both, at every density. Used to
 * measure how much cover the *existing* free-placed art incidentally provides,
 * which is the honest baseline variant B has to beat.
 */
export const RETROFIT_PROPS: readonly BoardProp[] = ALL_PROPS.filter((prop) => prop.retrofit);

/* ------------------------------------------------------------------ */
/* Density                                                             */
/* ------------------------------------------------------------------ */

/**
 * Three points on the spacing axis. **The axis, not three boards** — see the
 * header. `dense` is round 1's board unchanged.
 */
export type CoverDensity = "dense" | "sparse" | "spread";

export const COVER_DENSITIES: readonly CoverDensity[] = ["dense", "spread", "sparse"];

export function isCoverDensity(value: string | null): value is CoverDensity {
  return value === "dense" || value === "sparse" || value === "spread";
}

/**
 * Authored cover props kept at each density — a halving each step, so a trend
 * across three points is visible rather than inferred from two.
 *
 * A **count** rather than a spacing threshold, after the first build tried the
 * threshold and it was useless: the manifest is clustered into four quadrants,
 * so a minimum gap of 1.9 tiles took 32 props to 3 and 3.6 tiles took it to 1.
 * There is no threshold that lands near 16 — the axis is a cliff, not a ramp.
 * A count plus farthest-point selection gives the same "spread the cover out"
 * meaning with a knob that can actually be set. The spacing that results is the
 * *outcome*, and `densityReport` prints it.
 */
export const DENSITY_PROPS: Record<CoverDensity, number> = {
  dense: 32,
  sparse: 8,
  spread: 16,
};

/**
 * The tightest pair of **authored** props — what the density knob actually
 * bought. Retrofits are excluded because several of them overlap each other on
 * the grid (round 1's outward-snap finding), which pins any board's minimum at
 * zero and says nothing about the cover we chose to place.
 */
function minGapOf(all: readonly BoardProp[]): number {
  const props = all.filter((prop) => !prop.retrofit);
  let smallest = Infinity;
  for (let a = 0; a < props.length; a += 1) {
    for (let b = a + 1; b < props.length; b += 1) {
      const one = props[a];
      const two = props[b];
      if (one === undefined || two === undefined) { continue; }
      smallest = Math.min(smallest, gapBetween(one.cells, two.cells));
    }
  }
  return Number.isFinite(smallest) ? smallest : 0;
}

/** Clear floor between two cell rects, in tiles. 0 if they touch or overlap. */
function gapBetween(a: CellRect, b: CellRect): number {
  const dx = Math.max(0, a.cx0 - b.cx1, b.cx0 - a.cx1);
  const dy = Math.max(0, a.cy0 - b.cy1, b.cy0 - a.cy1);
  return Math.hypot(dx, dy);
}

/**
 * Keep `count` authored props, chosen farthest-point: repeatedly take whichever
 * remaining prop has the largest clear floor to everything already kept, ties
 * to the lower manifest index.
 *
 * `board.ts`'s free-placed masses seed the kept set and are never dropped —
 * they are real art, on screen whatever this prototype decides, so thinning
 * them would be measuring a board nobody proposed. Seeding with them also makes
 * the first authored pick the one farthest from the market stack and the
 * foundry block, which is what "spread the cover out" has to mean on a board
 * that already has two large masses on it.
 */
function thin(count: number): BoardProp[] {
  const authored = ALL_PROPS.filter((prop) => !prop.retrofit);
  if (count >= authored.length) { return [...ALL_PROPS]; }
  const kept: BoardProp[] = ALL_PROPS.filter((prop) => prop.retrofit);
  const pool = [...authored];
  while (kept.length - RETROFIT_PROPS.length < count && pool.length > 0) {
    let bestAt = 0;
    let bestGap = -1;
    for (let i = 0; i < pool.length; i += 1) {
      const prop = pool[i];
      if (prop === undefined) { continue; }
      let nearest = Infinity;
      for (const other of kept) { nearest = Math.min(nearest, gapBetween(prop.cells, other.cells)); }
      if (nearest > bestGap) {
        bestGap = nearest;
        bestAt = i;
      }
    }
    const taken = pool.splice(bestAt, 1)[0];
    if (taken !== undefined) { kept.push(taken); }
  }
  // Back into manifest order, so a prop's index means the same thing at every
  // density and a tie broken on index is broken the same way.
  const rank = new Map(ALL_PROPS.map((prop, index) => [prop.id, index]));
  return kept.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/**
 * One board at one density: the props, and everything derived from them that
 * is worth computing once.
 *
 * A board is passed explicitly to every query rather than read from a module
 * global, because two densities are simulated in the same process by
 * `measure.ts` and a global would silently leak one run's board into the next.
 */
export interface CoverBoard {
  density: CoverDensity;
  /**
   * Smallest clear floor between two authored props, in tiles. An outcome of
   * the density knob, not the knob itself.
   */
  minGap: number;
  /** Every prop on this board, retrofits first, in manifest order. */
  props: readonly BoardProp[];
  /** Authored cover only — what this variant asks the art lanes to build. */
  authored: readonly BoardProp[];
  /** Girth-shrunk silhouettes, parallel to `props`. Sight, soft. */
  silhouettes: readonly WorldRect[];
  /** The same, but `undefined` for anything that is not `board.ts` art. */
  retrofitSilhouettes: readonly (WorldRect | undefined)[];
  blocked: ReadonlySet<number>;
  shaded: ReadonlySet<number>;
}

function buildBoard(density: CoverDensity): CoverBoard {
  const props = thin(DENSITY_PROPS[density]);
  const blocked = new Set<number>();
  for (const prop of props) {
    for (let cy = Math.max(0, prop.cells.cy0); cy < Math.min(GRID, prop.cells.cy1); cy += 1) {
      for (let cx = Math.max(0, prop.cells.cx0); cx < Math.min(GRID, prop.cells.cx1); cx += 1) {
        blocked.add(cy * GRID + cx);
      }
    }
  }
  const shaded = new Set<number>();
  for (const prop of props) {
    const roof = prop.roof;
    if (roof === undefined) { continue; }
    for (let cy = prop.cells.cy0 + roof.oy; cy < prop.cells.cy0 + roof.oy + roof.sy; cy += 1) {
      for (let cx = prop.cells.cx0 + roof.ox; cx < prop.cells.cx0 + roof.ox + roof.sx; cx += 1) {
        if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) { continue; }
        shaded.add(cy * GRID + cx);
      }
    }
  }
  const silhouettes = props.map(silhouetteRect);
  return {
    authored: props.filter((prop) => !prop.retrofit),
    blocked,
    density,
    minGap: minGapOf(props),
    props,
    retrofitSilhouettes: props.map((prop, index) => (prop.retrofit ? silhouettes[index] : undefined)),
    shaded,
    silhouettes,
  };
}

const BOARDS = new Map<CoverDensity, CoverBoard>();

/** The board at one density. Built once, then shared — boards are immutable. */
export function boardFor(density: CoverDensity): CoverBoard {
  const cached = BOARDS.get(density);
  if (cached !== undefined) { return cached; }
  const built = buildBoard(density);
  BOARDS.set(density, built);
  return built;
}

/** `SimState.coverDensity` is an index into `COVER_DENSITIES`; this decodes it. */
export function densityAt(index: number): CoverDensity {
  return COVER_DENSITIES[index] ?? "dense";
}

/** The inverse — what a `SimState` stores. */
export function densityIndex(density: CoverDensity): number {
  const at = COVER_DENSITIES.indexOf(density);
  return at < 0 ? 0 : at;
}

/** May a body stand on this tile? Off-board is not walkable. */
export function walkable(board: CoverBoard, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) { return false; }
  return !board.blocked.has(cy * GRID + cx);
}

/**
 * Is a prop's mass on this tile? Off-board is **not** blocked — there is
 * nothing there, it is simply past the edge of the authored board.
 *
 * Occupancy is the union of every prop's claim, not a per-prop test, and that
 * distinction earns its keep: outward-snapping `board.ts`'s free-placed props
 * makes four of them overlap footprints they do not overlap in world space
 * (see `overlappingRetrofits`). Per-prop clamping puts a body in a pocket it
 * cannot leave; the union does not have pockets.
 */
export function blockedAt(board: CoverBoard, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) { return false; }
  return board.blocked.has(cy * GRID + cx);
}

/**
 * Pairs of props whose *cell* footprints overlap although their world AABBs do
 * not. Every one of these is a free-placed prop that the outward snap grew
 * into its neighbour — the foundry block and the crate pair beside it are
 * 15 mm apart in world space and share a tile on the grid.
 */
export function overlappingRetrofits(board: CoverBoard): string[] {
  const out: string[] = [];
  for (let a = 0; a < board.props.length; a += 1) {
    for (let b = a + 1; b < board.props.length; b += 1) {
      const one = board.props[a];
      const two = board.props[b];
      if (one === undefined || two === undefined) { continue; }
      const cellsApart = one.cells.cx1 <= two.cells.cx0
        || two.cells.cx1 <= one.cells.cx0
        || one.cells.cy1 <= two.cells.cy0
        || two.cells.cy1 <= one.cells.cy0;
      if (cellsApart) { continue; }
      out.push(`${one.id} + ${two.id}`);
    }
  }
  return out;
}

/** Is this tile under a roof? Roofed tiles stay walkable — they are shaded. */
export function underRoof(board: CoverBoard, cx: number, cy: number): boolean {
  return board.shaded.has(cy * GRID + cx);
}

/** Walkable tiles, in a deterministic order. */
export function walkableCells(board: CoverBoard): { cx: number; cy: number }[] {
  const out: { cx: number; cy: number }[] = [];
  for (let cy = 0; cy < GRID; cy += 1) {
    for (let cx = 0; cx < GRID; cx += 1) {
      if (walkable(board, cx, cy)) { out.push({ cx, cy }); }
    }
  }
  return out;
}

export interface DensityRow {
  density: CoverDensity;
  minGap: number;
  authoredProps: number;
  totalProps: number;
  blockedTiles: number;
  walkableTiles: number;
  /** Blocked tiles as a share of the board. The density number, stated plainly. */
  blockedFraction: number;
  /**
   * Mean clear floor from a walkable tile to the nearest prop, in tiles. The
   * number a body actually feels: how far you can walk before something is in
   * the way.
   */
  meanFloorToProp: number;
}

/** What a density actually came out as, rather than what the knob asked for. */
export function densityReport(board: CoverBoard): DensityRow {
  const open = walkableCells(board);
  let sum = 0;
  for (const cell of open) {
    let nearest = Infinity;
    for (const prop of board.props) {
      nearest = Math.min(nearest, gapBetween(
        { cx0: cell.cx, cx1: cell.cx + 1, cy0: cell.cy, cy1: cell.cy + 1 },
        prop.cells,
      ));
    }
    sum += Number.isFinite(nearest) ? nearest : 0;
  }
  return {
    authoredProps: board.authored.length,
    blockedFraction: board.blocked.size / (GRID * GRID),
    blockedTiles: board.blocked.size,
    density: board.density,
    meanFloorToProp: open.length === 0 ? 0 : sum / open.length,
    minGap: board.minGap,
    totalProps: board.props.length,
    walkableTiles: open.length,
  };
}

/** A body's radius on the floor. Used by the footprint clamp. */
export function bodyRadius(tier: Tier): number {
  return heightOf(tier) * 0.22;
}

/* ------------------------------------------------------------------ */
/* Sight                                                               */
/* ------------------------------------------------------------------ */

/** Height a unit's fire leaves from. */
export function eyeHeightOf(tier: Tier): number {
  return heightOf(tier) * 0.62;
}

/** The silhouette AABB used for sight — the footprint shrunk by `girth`. */
export function silhouetteRect(prop: BoardProp): WorldRect {
  const rect = worldRectOf(prop.cells);
  const midX = (rect.x0 + rect.x1) / 2;
  const midZ = (rect.z0 + rect.z1) / 2;
  const halfX = ((rect.x1 - rect.x0) / 2) * prop.girth;
  const halfZ = ((rect.z1 - rect.z0) / 2) * prop.girth;
  return { x0: midX - halfX, x1: midX + halfX, z0: midZ - halfZ, z1: midZ + halfZ };
}

/**
 * Slab test: the parametric range of `[from, to]` inside an axis-aligned rect,
 * or `undefined` if the segment misses it.
 */
function segmentRange(
  fromX: number,
  fromZ: number,
  dx: number,
  dz: number,
  rect: WorldRect,
): { near: number; far: number } | undefined {
  let near = 0;
  let far = 1;
  for (const axis of [0, 1]) {
    const origin = axis === 0 ? fromX : fromZ;
    const delta = axis === 0 ? dx : dz;
    const low = axis === 0 ? rect.x0 : rect.z0;
    const high = axis === 0 ? rect.x1 : rect.z1;
    if (Math.abs(delta) < 1e-9) {
      if (origin < low || origin > high) { return undefined; }
      continue;
    }
    const t0 = (low - origin) / delta;
    const t1 = (high - origin) / delta;
    near = Math.max(near, Math.min(t0, t1));
    far = Math.min(far, Math.max(t0, t1));
    if (near > far) { return undefined; }
  }
  return { far, near };
}

export interface Sight {
  /** 0..1 of the target's height hidden from the shooter by the strongest prop. */
  occlusion: number;
  /** Index into `COVER_PROPS` of that prop, or -1. */
  by: number;
}

const NO_SIGHT: Sight = { by: -1, occlusion: 0 };

/**
 * How much of a figure at `(toX, toZ)` is hidden from an eye at
 * `(fromX, fromZ, eyeY)` by the board's props.
 *
 * Real 3D geometry, not lane 5's 2D compositing measurement: the sightline
 * grazing a prop of height `h` at distance `d1` from the eye is at height
 * `eyeY + (h - eyeY) * (d1 + d2) / d1` when it reaches the target, and
 * everything below that is hidden. Then scaled by the cover class's porosity.
 *
 * The two ends are excluded (`u` in `(0.03, 0.97)`) so a unit is never
 * occluded by the thing it is standing against.
 */
export function sightBetween(
  board: CoverBoard,
  fromX: number,
  fromZ: number,
  eyeY: number,
  toX: number,
  toZ: number,
  targetHeight: number,
  props: readonly (WorldRect | undefined)[] = board.silhouettes,
): Sight {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const span = Math.hypot(dx, dz);
  if (span < 1e-4) { return NO_SIGHT; }
  let best = 0;
  let by = -1;
  for (let index = 0; index < props.length; index += 1) {
    const rect = props[index];
    if (rect === undefined) { continue; }
    const hit = segmentRange(fromX, fromZ, dx, dz, rect);
    if (hit === undefined) { continue; }
    const u = Math.max(hit.near, 0);
    if (u <= 0.03 || u >= 0.97) { continue; }
    const prop = board.props[index];
    if (prop === undefined) { continue; }
    const d1 = u * span;
    const grazeY = eyeY + ((prop.height - eyeY) * span) / d1;
    const raw = Math.max(0, Math.min(1, grazeY / targetHeight));
    const occlusion = raw * POROSITY[prop.cover];
    if (occlusion > best) {
      best = occlusion;
      by = index;
    }
  }
  return { by, occlusion: best };
}

/**
 * The same test against `board.ts`'s existing set dressing alone — the cover
 * the board already had before this prototype authored anything. Identical at
 * every density, which is what makes it the baseline.
 */
export function retrofitSightBetween(
  board: CoverBoard,
  fromX: number,
  fromZ: number,
  eyeY: number,
  toX: number,
  toZ: number,
  targetHeight: number,
): Sight {
  return sightBetween(
    board,
    fromX,
    fromZ,
    eyeY,
    toX,
    toZ,
    targetHeight,
    board.retrofitSilhouettes,
  );
}

/* ------------------------------------------------------------------ */
/* Cover posts                                                         */
/* ------------------------------------------------------------------ */

/**
 * The walkable tile on a prop's far side from a threat — the tile a unit
 * stands on to put that prop between itself and the shooter.
 *
 * Lane 5 computes this against the *camera*, because its question was "does
 * the sort work". Here it is computed against the *threat*, because the
 * question is "does cover do anything". Same idea, different reference frame,
 * and the difference is exactly why a cover system and a depth sort are not
 * the same feature.
 */
export function coverFaceCells(
  board: CoverBoard,
  prop: BoardProp,
  threatX: number,
  threatZ: number,
): { cx: number; cy: number }[] {
  const rect = worldRectOf(prop.cells);
  const awayX = (rect.x0 + rect.x1) / 2 - threatX;
  const awayZ = (rect.z0 + rect.z1) / 2 - threatZ;
  const cells: { cx: number; cy: number }[] = [];
  if (Math.abs(awayX) >= Math.abs(awayZ)) {
    const cx = awayX >= 0 ? prop.cells.cx1 : prop.cells.cx0 - 1;
    for (let cy = prop.cells.cy0 - 1; cy <= prop.cells.cy1; cy += 1) {
      if (walkable(board, cx, cy)) { cells.push({ cx, cy }); }
    }
    return cells;
  }
  const cy = awayZ >= 0 ? prop.cells.cy1 : prop.cells.cy0 - 1;
  for (let cx = prop.cells.cx0 - 1; cx <= prop.cells.cx1; cx += 1) {
    if (walkable(board, cx, cy)) { cells.push({ cx, cy }); }
  }
  return cells;
}

/** The middle of that face, when a single representative tile is enough. */
export function coverPostCell(
  board: CoverBoard,
  prop: BoardProp,
  threatX: number,
  threatZ: number,
): { cx: number; cy: number } | undefined {
  const face = coverFaceCells(board, prop, threatX, threatZ);
  return face[Math.floor(face.length / 2)];
}

/** Cover classes worth walking to. `low` blocks a tile and hides nothing. */
export function isUsableCover(cover: CoverClass): boolean {
  return cover !== "low";
}

/* ------------------------------------------------------------------ */
/* The art contract, measured                                          */
/* ------------------------------------------------------------------ */

export interface SnapRow {
  id: string;
  kind: PropKind;
  /** Footprint area the art really occupies, in tiles. */
  trueTiles: number;
  /** Tiles the outward snap claims. */
  outwardTiles: number;
  /** Tiles a nearest-cell snap would claim. */
  nearestTiles: number;
  /** World units of art a body could stand inside under a nearest-cell snap. */
  nearestIntrusion: number;
}

/**
 * What it costs to put a free-placed prop on a tile grid, per prop.
 *
 * This is the concrete input #64 is waiting on. Snapping outward is safe and
 * over-claims floor — a body visibly stands off from a wall it is nowhere
 * near. Snapping to the nearest cell keeps the floor honest and lets feet sink
 * into the art by up to `nearestIntrusion` world units. A tile-authored prop
 * pays neither, because its footprint *is* its declaration.
 */
export function snapReport(): SnapRow[] {
  return RETROFIT_PROPS.map((prop) => {
    const rect = prop.trueRect;
    const trueTiles = ((rect.x1 - rect.x0) / TILE) * ((rect.z1 - rect.z0) / TILE);
    const outward = snapOutward(rect);
    const nearest = snapNearest(rect);
    const nearestRect = worldRectOf(nearest);
    return {
      id: prop.id,
      kind: prop.kind,
      nearestIntrusion: Math.max(
        0,
        nearestRect.x0 - rect.x0,
        rect.x1 - nearestRect.x1,
        nearestRect.z0 - rect.z0,
        rect.z1 - nearestRect.z1,
      ),
      nearestTiles: (nearest.cx1 - nearest.cx0) * (nearest.cy1 - nearest.cy0),
      outwardTiles: (outward.cx1 - outward.cx0) * (outward.cy1 - outward.cy0),
      trueTiles,
    };
  });
}
