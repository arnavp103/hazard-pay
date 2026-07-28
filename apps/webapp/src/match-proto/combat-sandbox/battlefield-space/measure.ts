/**
 * THROWAWAY PROTOTYPE (#100): the numbers behind the gallery.
 *
 * A still cannot answer "is this more legible" and a GIF barely can, so the
 * two variants are also measured. Run headless, no renderer:
 *
 * ```
 * pnpm exec tsx apps/webapp/src/match-proto/combat-sandbox/battlefield-space/measure.ts \
 *   --out apps/webapp/screenshots/battlefield-space
 * ```
 *
 * It writes `metrics.json` and `metrics.md`. Both variants run the same seed,
 * the same roster and the same 20 seconds, so every row is a controlled
 * comparison.
 *
 * ## What is measured, and how honest each number is
 *
 * - **depth s.d. / rank s.d.** — exactly #97's formation-decay metric, so the
 *   `0.785 -> 2.08` figure it measured is directly comparable. Trustworthy.
 * - **screen bbox, occlusion** — computed from the camera's own projection
 *   (`scene.ts`'s RIGHT/UP vectors at `CROWD_ZOOM`), sampling each unit's
 *   silhouette on a 6x10 grid against nearer silhouettes. Painter order uses
 *   lane 5's repaired dimetric predicate (`occupancy.ts`'s `inFrontOf`), so it
 *   agrees with the thing that draws the picture. Approximate in one way worth
 *   stating: a unit is a rectangle and a prop is the convex hull of its box,
 *   which over-states both a little and under-states neither.
 * - **cover fraction** — the sim's own sightline model, not a re-derivation.
 * - **suppressed shots** — a counter on the unit, so it is the sim's own count.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { profileOf } from "../archetypes.ts";
import { FODDER_HEIGHT, heightOf, HERO_HEIGHT } from "../units.ts";
import { advanceBattle, FIXED_STEP, type SimState, type SimUnit, stepsFor } from "../sim.ts";
import {
  cellEdge,
  COVER_PROPS,
  eyeHeightOf,
  overlappingRetrofits,
  retrofitSightBetween,
  sightBetween,
  silhouetteRect,
  snapReport,
  TILE,
  walkableCells,
  type WorldRect,
  worldRectOf,
} from "./cover-model.ts";
import { createSpaceBattle, type SpaceMode } from "./space.ts";

/* --- the camera, copied from scene.ts so this file needs no renderer ----- */

const PX_PER_UNIT = 40;
const CROWD_ZOOM = 0.55;
const PPU = PX_PER_UNIT * CROWD_ZOOM;
const UP_Y = 0.86603;
const UP_XZ = 0.35355;

interface ScreenRect { x0: number; y0: number; x1: number; y1: number }

function screenXOf(x: number, z: number): number {
  return ((x - z) / Math.SQRT2) * PPU;
}

/** Screen y, down-positive. */
function screenYOf(x: number, y: number, z: number): number {
  return (UP_XZ * (x + z) - UP_Y * y) * PPU;
}

/** A body's screen silhouette, as a rectangle. */
function unitRect(unit: SimUnit): ScreenRect {
  const height = heightOf(unit.tier);
  const half = (height * 0.5 * PPU) / 2;
  const cx = screenXOf(unit.x, unit.z);
  return {
    x0: cx - half,
    x1: cx + half,
    y0: screenYOf(unit.x, height, unit.z),
    y1: screenYOf(unit.x, 0, unit.z),
  };
}

function boundsOf(rect: WorldRect, low: number, high: number): ScreenRect {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const x of [rect.x0, rect.x1]) {
    for (const z of [rect.z0, rect.z1]) {
      for (const y of [low, high]) {
        x0 = Math.min(x0, screenXOf(x, z));
        x1 = Math.max(x1, screenXOf(x, z));
        y0 = Math.min(y0, screenYOf(x, y, z));
        y1 = Math.max(y1, screenYOf(x, y, z));
      }
    }
  }
  return { x0, x1, y0, y1 };
}

/**
 * A prop's screen silhouette, as one or two rectangles.
 *
 * The **girth-shrunk** footprint, not the claimed one: a lamp post claims a
 * whole tile and draws a 0.14-tile mast, and measuring the tile would let the
 * footprint contract inflate the occlusion number the whole comparison turns
 * on. Props with a roof contribute a second rectangle for the canopy, because
 * a roof genuinely does hide what is under it.
 */
function propRects(): ScreenRect[][] {
  return COVER_PROPS.map((prop) => {
    const rects = [boundsOf(silhouetteRect(prop), 0, prop.height)];
    const roof = prop.roof;
    if (roof !== undefined) {
      rects.push(boundsOf(
        {
          x0: cellEdge(prop.cells.cx0 + roof.ox),
          x1: cellEdge(prop.cells.cx0 + roof.ox + roof.sx),
          z0: cellEdge(prop.cells.cy0 + roof.oy),
          z1: cellEdge(prop.cells.cy0 + roof.oy + roof.sy),
        },
        roof.lift,
        roof.lift + 0.12,
      ));
    }
    return rects;
  });
}

const PROP_RECTS = propRects();

/**
 * Lane 5's repaired dimetric painter predicate (`occupancy.ts`). The textbook
 * form makes every mutually-diagonal pair a 2-cycle; this one claims an order
 * only where one footprint is genuinely nearer.
 */
function inFrontOf(
  a: { x0: number; z0: number; x1: number; z1: number },
  b: { x0: number; z0: number; x1: number; z1: number },
): boolean {
  const aPastX = a.x0 >= b.x1;
  const bPastX = b.x0 >= a.x1;
  const aPastZ = a.z0 >= b.z1;
  const bPastZ = b.z0 >= a.z1;
  if ((aPastX && bPastZ) || (bPastX && aPastZ)) { return false; }
  return aPastX || aPastZ;
}

function footprintOf(unit: SimUnit): { x0: number; z0: number; x1: number; z1: number } {
  const r = TILE / 2;
  return { x0: unit.x - r, x1: unit.x + r, z0: unit.z - r, z1: unit.z + r };
}

function contains(rect: ScreenRect, x: number, y: number): boolean {
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

const SAMPLES_X = 6;
const SAMPLES_Y = 10;

interface Occlusion {
  byProps: number;
  byUnits: number;
  total: number;
}

/** Fraction of one body's silhouette hidden by nearer props and bodies. */
function occlusionOf(unit: SimUnit, units: readonly SimUnit[], withProps: boolean): Occlusion {
  const rect = unitRect(unit);
  const mine = footprintOf(unit);
  let props = 0;
  let bodies = 0;
  let any = 0;
  for (let iy = 0; iy < SAMPLES_Y; iy += 1) {
    for (let ix = 0; ix < SAMPLES_X; ix += 1) {
      const px = rect.x0 + ((ix + 0.5) / SAMPLES_X) * (rect.x1 - rect.x0);
      const py = rect.y0 + ((iy + 0.5) / SAMPLES_Y) * (rect.y1 - rect.y0);
      let hitProp = false;
      let hitUnit = false;
      if (withProps) {
        for (let index = 0; index < COVER_PROPS.length; index += 1) {
          const prop = COVER_PROPS[index];
          const screens = PROP_RECTS[index];
          if (prop === undefined || screens === undefined) { continue; }
          if (!screens.some((screen) => contains(screen, px, py))) { continue; }
          if (!inFrontOf(worldRectOf(prop.cells), mine)) { continue; }
          hitProp = true;
          break;
        }
      }
      for (const other of units) {
        if (other.id === unit.id) { continue; }
        if (!contains(unitRect(other), px, py)) { continue; }
        if (!inFrontOf(footprintOf(other), mine)) { continue; }
        hitUnit = true;
        break;
      }
      if (hitProp) { props += 1; }
      if (hitUnit) { bodies += 1; }
      if (hitProp || hitUnit) { any += 1; }
    }
  }
  const total = SAMPLES_X * SAMPLES_Y;
  return { byProps: props / total, byUnits: bodies / total, total: any / total };
}

/* --- the sample --------------------------------------------------------- */

function standardDeviation(values: number[]): number {
  if (values.length === 0) { return 0; }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

interface Sample {
  t: number;
  depthSd: number;
  rankSd: number;
  bboxW: number;
  bboxH: number;
  meanNearest: number;
  /** Units whose target is >=25 % hidden by the props that exist in THIS variant. */
  coveredFraction: number;
  /** The same, counting only `board.ts`'s existing free-placed set dressing. */
  coveredByBoardArt: number;
  occlusionByProps: number;
  occlusionByUnits: number;
  mostlyHidden: number;
  suppressedShots: number;
  attacking: number;
  /** Bodies whose target is inside their own attack range. */
  inReach: number;
}

function sampleOf(state: SimState, space: SpaceMode): Sample {
  const units = state.units;
  const side0 = units.filter((unit) => unit.side === 0);
  const depth = side0.map((unit) => (unit.x + unit.z) / Math.SQRT2);
  const rank = side0.map((unit) => (unit.x - unit.z) / Math.SQRT2);

  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let nearestSum = 0;
  for (const unit of units) {
    const rect = unitRect(unit);
    x0 = Math.min(x0, rect.x0);
    x1 = Math.max(x1, rect.x1);
    y0 = Math.min(y0, rect.y0);
    y1 = Math.max(y1, rect.y1);
    let nearest = Infinity;
    for (const other of units) {
      if (other.id === unit.id) { continue; }
      nearest = Math.min(nearest, Math.hypot(other.x - unit.x, other.z - unit.z));
    }
    nearestSum += Number.isFinite(nearest) ? nearest : 0;
  }

  const byId = new Map(units.map((unit) => [unit.id, unit]));
  let covered = 0;
  let coveredByArt = 0;
  let propOcclusion = 0;
  let unitOcclusion = 0;
  let mostlyHidden = 0;
  let attacking = 0;
  let inReach = 0;
  for (const unit of units) {
    const target = byId.get(unit.targetId);
    if (target !== undefined) {
      if (Math.hypot(target.x - unit.x, target.z - unit.z)
        <= profileOf(unit.archetype, unit.tier).attackRange) {
        inReach += 1;
      }
      const eye = eyeHeightOf(unit.tier);
      const height = heightOf(target.tier);
      const all = space === "cover"
        ? sightBetween(unit.x, unit.z, eye, target.x, target.z, height)
        : retrofitSightBetween(unit.x, unit.z, eye, target.x, target.z, height);
      const art = retrofitSightBetween(unit.x, unit.z, eye, target.x, target.z, height);
      if (all.occlusion >= 0.25) { covered += 1; }
      if (art.occlusion >= 0.25) { coveredByArt += 1; }
    }
    const occlusion = occlusionOf(unit, units, space === "cover");
    propOcclusion += occlusion.byProps;
    unitOcclusion += occlusion.byUnits;
    if (occlusion.total > 0.5) { mostlyHidden += 1; }
    if (unit.attackStep >= 0) { attacking += 1; }
  }

  const count = Math.max(1, units.length);
  return {
    attacking,
    bboxH: Math.round(y1 - y0),
    bboxW: Math.round(x1 - x0),
    coveredByBoardArt: coveredByArt / count,
    coveredFraction: covered / count,
    depthSd: standardDeviation(depth),
    inReach,
    meanNearest: nearestSum / count,
    mostlyHidden,
    occlusionByProps: propOcclusion / count,
    occlusionByUnits: unitOcclusion / count,
    rankSd: standardDeviation(rank),
    suppressedShots: units.reduce((sum, unit) => sum + unit.suppressedShots, 0),
    t: state.step * FIXED_STEP,
  };
}

const SAMPLE_AT = [0, 2, 4, 6, 8, 10, 14, 20];

interface Run {
  space: SpaceMode;
  samples: Sample[];
  /** Wall-clock ms to simulate one 4-second slice, for the #97 comparison. */
  msPerSlice: number;
}

function run(space: SpaceMode): Run {
  const state = createSpaceBattle(space);
  const samples: Sample[] = [];
  let at = 0;
  for (const seconds of SAMPLE_AT) {
    advanceBattle(state, stepsFor(seconds) - at);
    at = stepsFor(seconds);
    samples.push(sampleOf(state, space));
  }
  const timed = createSpaceBattle(space);
  const started = performance.now();
  advanceBattle(timed, stepsFor(4));
  return { msPerSlice: Number((performance.now() - started).toFixed(1)), samples, space };
}

/* --- report ------------------------------------------------------------- */

function pct(value: number): string {
  return `${(value * 100).toFixed(1)} %`;
}

function table(rows: string[][]): string {
  const head = rows[0];
  if (head === undefined) { return ""; }
  const divider = head.map(() => "---");
  return [head, divider, ...rows.slice(1)]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function seriesRow(label: string, runs: Run[], read: (sample: Sample) => string): string[] {
  return [label, ...runs.flatMap((entry) => entry.samples.map(read))];
}

function main(): void {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const out = outIndex >= 0 ? args[outIndex + 1] ?? "." : ".";
  mkdirSync(out, { recursive: true });

  const plaza = run("plaza");
  const cover = run("cover");
  const snaps = snapReport();
  const trueTiles = snaps.reduce((sum, row) => sum + row.trueTiles, 0);
  const outwardTiles = snaps.reduce((sum, row) => sum + row.outwardTiles, 0);
  const nearestTiles = snaps.reduce((sum, row) => sum + row.nearestTiles, 0);

  const board = {
    authoredProps: COVER_PROPS.filter((prop) => !prop.retrofit).length,
    boardExtentWorld: Number((TILE * 20).toFixed(2)),
    fodderHeightWorld: FODDER_HEIGHT,
    heroHeightWorld: HERO_HEIGHT,
    overlappingRetrofits: overlappingRetrofits(),
    retrofitProps: COVER_PROPS.filter((prop) => prop.retrofit).length,
    snap: {
      nearestMaxIntrusionWorld: Number(
        Math.max(...snaps.map((row) => row.nearestIntrusion)).toFixed(3),
      ),
      nearestTiles: Number(nearestTiles.toFixed(2)),
      outwardTiles: Number(outwardTiles.toFixed(2)),
      overClaim: Number((outwardTiles / trueTiles - 1).toFixed(3)),
      trueTiles: Number(trueTiles.toFixed(2)),
    },
    tileWorld: Number(TILE.toFixed(4)),
    walkableTiles: walkableCells().length,
  };

  writeFileSync(
    join(out, "metrics.json"),
    `${JSON.stringify({ board, cover, plaza }, null, 2)}\n`,
  );

  const header = ["metric", ...SAMPLE_AT.map((t) => `A t=${String(t)}`), ...SAMPLE_AT.map((t) => `B t=${String(t)}`)];
  const runs = [plaza, cover];
  const body = [
    header,
    seriesRow("depth s.d. (world)", runs, (s) => s.depthSd.toFixed(2)),
    seriesRow("rank s.d. (world)", runs, (s) => s.rankSd.toFixed(2)),
    seriesRow("crowd bbox w x h (px)", runs, (s) => `${String(s.bboxW)}x${String(s.bboxH)}`),
    seriesRow("mean nearest body (world)", runs, (s) => s.meanNearest.toFixed(2)),
    seriesRow("in cover (target >=25 % hidden)", runs, (s) => pct(s.coveredFraction)),
    seriesRow("in cover from board.ts art alone", runs, (s) => pct(s.coveredByBoardArt)),
    seriesRow("silhouette hidden by props", runs, (s) => pct(s.occlusionByProps)),
    seriesRow("silhouette hidden by bodies", runs, (s) => pct(s.occlusionByUnits)),
    seriesRow("bodies >50 % hidden", runs, (s) => String(s.mostlyHidden)),
    seriesRow("target within reach", runs, (s) => `${String(s.inReach)}/40`),
    seriesRow("mid-attack this frame", runs, (s) => String(s.attacking)),
    seriesRow("shots suppressed, cumulative", runs, (s) => String(s.suppressedShots)),
  ];

  const lines = [
    "# #100 battlefield space — measured",
    "",
    "Same seed, same roster, same camera. **A** is the open plaza, **B** is",
    "tiles and cover. Generated by `measure.ts`; see its header for how far each",
    "number can be trusted.",
    "",
    table(body),
    "",
    "## The board",
    "",
    table([
      ["fact", "value"],
      ["tile, world units", board.tileWorld.toFixed(4)],
      ["tile vs SEPARATION_RADIUS (1.05)", `${(board.tileWorld / 1.05).toFixed(2)}x`],
      ["grid", `20 x 20 (${board.boardExtentWorld.toFixed(1)} world units square)`],
      ["walkable tiles", `${String(board.walkableTiles)} of 400`],
      ["authored cover props", String(board.authoredProps)],
      ["retrofitted board.ts props", String(board.retrofitProps)],
      ["sim cost, one 4 s slice", `A ${plaza.msPerSlice.toFixed(1)} ms / B ${cover.msPerSlice.toFixed(1)} ms`],
    ]),
    "",
    "## What a tile grid costs the existing art",
    "",
    "`board.ts`'s props are free-placed. Giving them footprints means snapping,",
    "and there is no free option:",
    "",
    table([
      ["snap", "tiles claimed", "vs true footprint", "cost"],
      [
        "outward (safe)",
        board.snap.outwardTiles.toFixed(1),
        `+${(board.snap.overClaim * 100).toFixed(0)} %`,
        "bodies stand off from walls they are nowhere near",
      ],
      [
        "nearest (honest floor)",
        board.snap.nearestTiles.toFixed(1),
        `${((nearestTiles / trueTiles - 1) * 100).toFixed(0)} %`,
        `feet sink up to ${board.snap.nearestMaxIntrusionWorld.toFixed(2)} world units into the art`,
      ],
      ["tile-authored", "exact", "0 %", "the footprint IS the declaration"],
    ]),
    "",
    `Outward snapping also makes ${String(board.overlappingRetrofits.length)} pairs of props overlap on the grid that do`,
    "not overlap in world space:",
    "",
    ...board.overlappingRetrofits.map((pair) => `- \`${pair}\``),
    "",
  ];
  writeFileSync(join(out, "metrics.md"), `${lines.join("\n")}\n`);
  process.stdout.write(`${lines.join("\n")}\n`);
  process.stdout.write(`\nwrote ${join(out, "metrics.json")} and ${join(out, "metrics.md")}\n`);
}

main();
