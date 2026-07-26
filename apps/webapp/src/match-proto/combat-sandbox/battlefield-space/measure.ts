/**
 * THROWAWAY PROTOTYPE (#100): the numbers behind the gallery.
 *
 * A still cannot answer "is this more legible" and a GIF barely can, so every
 * variant is also measured. Run headless, no renderer:
 *
 * ```
 * pnpm exec tsx apps/webapp/src/match-proto/combat-sandbox/battlefield-space/measure.ts \
 *   --out apps/webapp/screenshots/battlefield-space-r2
 * ```
 *
 * It writes `metrics.json` and `metrics.md`. Every run uses the same seed, the
 * same opening layout and the same 20 seconds, so every row is a controlled
 * comparison and the only things that differ are the two variables round 2
 * reopened: **prop density** and **composition**.
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
 * - **cover fraction, occlusion** — the sim's own sightline model, not a
 *   re-derivation.
 * - **suppressed shots, shots fired** — counters read off the sim, the second
 *   by stepping one step at a time and counting releases, so it is a true
 *   total and not a sampled estimate.
 *
 * ## One correction to round 1, made deliberately
 *
 * Round 1 reported "silhouette hidden by props" as **0.0 %** in the open plaza.
 * That was an artefact of the measurement, not a fact about the plaza:
 * `board.ts`'s market stack, foundry block, drums and pallets are drawn in
 * *both* variants and occlude bodies in both, and round 1 counted props only
 * when cover was on. So the round-1 gallery's "props hide 17 % of every
 * silhouette" was being compared against a zero that was not the real baseline.
 *
 * Round 2 therefore splits prop occlusion into **board art** (there whatever we
 * decide) and **authored cover** (what this prototype would ask #64 to build).
 * The number that actually bears on "does cover make a fight harder to parse"
 * is the second column, and it is smaller than round 1's headline.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { profileOf } from "../archetypes.ts";
import { FODDER_HEIGHT, heightOf, HERO_HEIGHT } from "../units.ts";
import { advanceBattle, FIXED_STEP, type SimState, type SimUnit, stepsFor } from "../sim.ts";
import {
  type BoardProp,
  boardFor,
  cellEdge,
  type CoverBoard,
  COVER_DENSITIES,
  type CoverDensity,
  densityReport,
  type DensityRow,
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
import { postureOf } from "./approach-field.ts";
import { IN_COVER_AT } from "./cover-behaviours.ts";
import { firesOrdnance } from "./fire-render.ts";
import { createSpaceBattle, type RosterMode, type SpaceMode } from "./space.ts";

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
function propRectsOf(props: readonly BoardProp[]): ScreenRect[][] {
  return props.map((prop) => {
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
  /** Hidden by `board.ts`'s free-placed masses — present in every variant. */
  byBoardArt: number;
  /** Hidden by props this prototype authored — variant B's actual cost. */
  byAuthoredCover: number;
  byUnits: number;
  total: number;
}

/**
 * What a scene occludes with, at one density.
 *
 * Held per board rather than recomputed per sample, and split by provenance for
 * the reason in the header: the plaza is not an empty room.
 */
interface Occluders {
  props: readonly BoardProp[];
  screens: ScreenRect[][];
  /** Which of `props` this prototype would have to author. */
  authored: boolean[];
}

function occludersOf(board: CoverBoard, space: SpaceMode): Occluders {
  // In the plaza, only `board.ts`'s own art is on screen — the authored cover
  // layer is never built. `boardFor("dense")` supplies it because the retrofit
  // set is identical at every density by construction (`thin` never drops one).
  const props = space === "cover"
    ? board.props
    : boardFor("dense").props.filter((prop) => prop.retrofit);
  return {
    authored: props.map((prop) => !prop.retrofit),
    props,
    screens: propRectsOf(props),
  };
}

/** Fraction of one body's silhouette hidden by nearer props and bodies. */
function occlusionOf(unit: SimUnit, units: readonly SimUnit[], world: Occluders): Occlusion {
  const rect = unitRect(unit);
  const mine = footprintOf(unit);
  let art = 0;
  let authored = 0;
  let bodies = 0;
  let any = 0;
  for (let iy = 0; iy < SAMPLES_Y; iy += 1) {
    for (let ix = 0; ix < SAMPLES_X; ix += 1) {
      const px = rect.x0 + ((ix + 0.5) / SAMPLES_X) * (rect.x1 - rect.x0);
      const py = rect.y0 + ((iy + 0.5) / SAMPLES_Y) * (rect.y1 - rect.y0);
      let hitArt = false;
      let hitAuthored = false;
      let hitUnit = false;
      for (let index = 0; index < world.props.length; index += 1) {
        const prop = world.props[index];
        const screens = world.screens[index];
        if (prop === undefined || screens === undefined) { continue; }
        if (!screens.some((screen) => contains(screen, px, py))) { continue; }
        if (!inFrontOf(worldRectOf(prop.cells), mine)) { continue; }
        if (world.authored[index] === true) {
          hitAuthored = true;
        } else {
          hitArt = true;
        }
      }
      for (const other of units) {
        if (other.id === unit.id) { continue; }
        if (!contains(unitRect(other), px, py)) { continue; }
        if (!inFrontOf(footprintOf(other), mine)) { continue; }
        hitUnit = true;
        break;
      }
      if (hitArt) { art += 1; }
      if (hitAuthored) { authored += 1; }
      if (hitUnit) { bodies += 1; }
      if (hitArt || hitAuthored || hitUnit) { any += 1; }
    }
  }
  const total = SAMPLES_X * SAMPLES_Y;
  return {
    byAuthoredCover: authored / total,
    byBoardArt: art / total,
    byUnits: bodies / total,
    total: any / total,
  };
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
  occlusionByBoardArt: number;
  occlusionByAuthoredCover: number;
  occlusionByUnits: number;
  mostlyHidden: number;
  suppressedShots: number;
  attacking: number;
  /** Bodies whose target is inside their own attack range. */
  inReach: number;
  /** Of the shooters only: how many have their target in range. */
  rangedInReach: number;
  rangedUnits: number;
  /** Mean sightline occlusion across shooters that have a target. */
  rangedOcclusion: number;
  /** Shooters holding within 25 % of their archetype's standoff. */
  rangedAtStandoff: number;
  /** Attacks released since t=0. Counted per step, not sampled. */
  shotsFired: number;

  /* --- round 3: does melee do something different from ranged? --------- */
  meleeUnits: number;
  /** Swords whose target is inside their reach. Melee's whole job. */
  meleeInReach: number;
  /**
   * Formation depth s.d. **per archetype**, along the approach axis.
   *
   * Round 2 read one number for the whole army and found ranged holds tighter
   * in the open plaza than on any cover board. Split by archetype it becomes
   * answerable whether that is shooters holding a line or swords running past
   * them, which the pooled number cannot distinguish.
   */
  meleeDepthSd: number;
  rangedDepthSd: number;
  /**
   * Of the steps spent **closing**, the share spent with a clear line to the
   * enemy. The covered approach's own scoreboard: 100 % is walking across the
   * open, 0 % is arriving without ever being seen.
   */
  meleeExposed: number;
  rangedExposed: number;
  /** Steps the swords spent closing at all — the denominator, stated. */
  meleeApproachSteps: number;

  /* --- the directional-cover ruling ------------------------------------ */
  /** Share of all steps each archetype spent ducked behind a prop. */
  meleeDucked: number;
  rangedDucked: number;
  /**
   * Share of steps shooters spent peeking — the exposure they bought in order
   * to shoot. Melee never peeks, so there is deliberately no melee column.
   */
  rangedPeeking: number;
  /**
   * Attacks that landed by coming in outside the target's protected arc.
   *
   * Under the symmetric model rounds 1-2 used this number could not exist:
   * cover either stopped a line or it did not, and going round the side changed
   * nothing. It is the ruling's mechanical content, counted.
   */
  flankedShots: number;
  /**
   * Mean distance to the nearest friendly, for swords only. The round-1
   * clustering bug, measured directly: if the covered approach funnels bodies
   * this collapses, and no amount of suppression makes that acceptable.
   */
  meleeNearestFriendly: number;
  /** Swords standing where a prop hides them from their target. */
  meleeInCover: number;
}

/**
 * Share of attempted attacks cover denied.
 *
 * The raw suppressed counter is **not** comparable across variants and reading
 * it as if it were is the trap this column exists to close: sparser cover puts
 * far more bodies in reach, so far more attacks are attempted, so the raw count
 * can rise while cover is doing *less*. Attempts are `fired + suppressed`,
 * because `blockedFire` cancels an attack the cycle had already started.
 */
function deniedShare(sample: Sample): number {
  const attempts = sample.shotsFired + sample.suppressedShots;
  return attempts === 0 ? 0 : sample.suppressedShots / attempts;
}

function sampleOf(
  state: SimState,
  board: CoverBoard,
  space: SpaceMode,
  world: Occluders,
  shotsFired: number,
): Sample {
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
  let artOcclusion = 0;
  let authoredOcclusion = 0;
  let unitOcclusion = 0;
  let mostlyHidden = 0;
  let attacking = 0;
  let inReach = 0;
  let rangedUnits = 0;
  let rangedInReach = 0;
  let rangedOcclusionSum = 0;
  let rangedWithTarget = 0;
  let rangedAtStandoff = 0;
  // Round 3. Depth is measured on side 0 only, like the pooled number above, so
  // the two are read against the same bodies — but reach, exposure and crowding
  // count both sides, because "did the swords get there" is a question about the
  // whole fight and `split` puts every sword on one side.
  const meleeDepth: number[] = [];
  const rangedDepth: number[] = [];
  let meleeUnits = 0;
  let meleeInReach = 0;
  let meleeInCover = 0;
  let meleeExposedSteps = 0;
  let meleeApproachSteps = 0;
  let rangedExposedSteps = 0;
  let rangedApproachSteps = 0;
  let meleeNearestSum = 0;
  let meleeDuckedSteps = 0;
  let rangedDuckedSteps = 0;
  let rangedPeekSteps = 0;
  for (const unit of units) {
    const profile = profileOf(unit.archetype, unit.tier);
    const shooter = firesOrdnance(profile.standoff);
    if (shooter) { rangedUnits += 1; }
    const sword = postureOf(profile.standoff, profile.attackRange) === "assault";
    if (sword) {
      meleeUnits += 1;
      meleeExposedSteps += unit.exposedSteps;
      meleeApproachSteps += unit.approachSteps;
      meleeDuckedSteps += unit.duckedSteps;
      if (unit.sightOcclusion >= IN_COVER_AT) { meleeInCover += 1; }
      let nearest = Infinity;
      for (const other of units) {
        if (other.id === unit.id || other.side !== unit.side) { continue; }
        nearest = Math.min(nearest, Math.hypot(other.x - unit.x, other.z - unit.z));
      }
      meleeNearestSum += Number.isFinite(nearest) ? nearest : 0;
    } else if (shooter) {
      rangedExposedSteps += unit.exposedSteps;
      rangedApproachSteps += unit.approachSteps;
      rangedDuckedSteps += unit.duckedSteps;
      rangedPeekSteps += unit.peekSteps;
    }
    if (unit.side === 0) {
      const along = (unit.x + unit.z) / Math.SQRT2;
      if (sword) {
        meleeDepth.push(along);
      } else if (shooter) {
        rangedDepth.push(along);
      }
    }
    const target = byId.get(unit.targetId);
    if (target !== undefined) {
      const gap = Math.hypot(target.x - unit.x, target.z - unit.z);
      if (gap <= profile.attackRange) {
        inReach += 1;
        if (shooter) { rangedInReach += 1; }
        if (sword) { meleeInReach += 1; }
      }
      if (shooter) {
        rangedWithTarget += 1;
        if (Math.abs(gap - profile.standoff) <= profile.standoff * 0.25) { rangedAtStandoff += 1; }
      }
      const eye = eyeHeightOf(unit.tier);
      const height = heightOf(target.tier);
      const all = space === "cover"
        ? sightBetween(board, unit.x, unit.z, eye, target.x, target.z, height)
        : retrofitSightBetween(board, unit.x, unit.z, eye, target.x, target.z, height);
      const art = retrofitSightBetween(board, unit.x, unit.z, eye, target.x, target.z, height);
      if (all.occlusion >= 0.25) { covered += 1; }
      if (art.occlusion >= 0.25) { coveredByArt += 1; }
      if (shooter) { rangedOcclusionSum += all.occlusion; }
    }
    const occlusion = occlusionOf(unit, units, world);
    artOcclusion += occlusion.byBoardArt;
    authoredOcclusion += occlusion.byAuthoredCover;
    unitOcclusion += occlusion.byUnits;
    if (occlusion.total > 0.5) { mostlyHidden += 1; }
    if (unit.attackStep >= 0) { attacking += 1; }
  }

  const count = Math.max(1, units.length);
  const steps = Math.max(1, state.step);
  return {
    attacking,
    meleeDepthSd: standardDeviation(meleeDepth),
    flankedShots: units.reduce((sum, unit) => sum + unit.flankedShots, 0),
    meleeApproachSteps,
    meleeDucked: meleeUnits === 0 ? 0 : meleeDuckedSteps / (meleeUnits * steps),
    meleeExposed: meleeApproachSteps === 0 ? 0 : meleeExposedSteps / meleeApproachSteps,
    meleeInCover,
    meleeInReach,
    meleeNearestFriendly: meleeUnits === 0 ? 0 : meleeNearestSum / meleeUnits,
    meleeUnits,
    rangedDepthSd: standardDeviation(rangedDepth),
    rangedDucked: rangedUnits === 0 ? 0 : rangedDuckedSteps / (rangedUnits * steps),
    rangedPeeking: rangedUnits === 0 ? 0 : rangedPeekSteps / (rangedUnits * steps),
    rangedExposed: rangedApproachSteps === 0 ? 0 : rangedExposedSteps / rangedApproachSteps,
    bboxH: Math.round(y1 - y0),
    bboxW: Math.round(x1 - x0),
    coveredByBoardArt: coveredByArt / count,
    coveredFraction: covered / count,
    depthSd: standardDeviation(depth),
    inReach,
    meanNearest: nearestSum / count,
    mostlyHidden,
    occlusionByAuthoredCover: authoredOcclusion / count,
    occlusionByBoardArt: artOcclusion / count,
    occlusionByUnits: unitOcclusion / count,
    rangedAtStandoff,
    rangedInReach,
    rangedOcclusion: rangedWithTarget === 0 ? 0 : rangedOcclusionSum / rangedWithTarget,
    rangedUnits,
    rankSd: standardDeviation(rank),
    shotsFired,
    suppressedShots: units.reduce((sum, unit) => sum + unit.suppressedShots, 0),
    t: state.step * FIXED_STEP,
  };
}

const SAMPLE_AT = [0, 2, 4, 6, 8, 10, 14, 20];

interface Variant {
  key: string;
  label: string;
  space: SpaceMode;
  density: CoverDensity;
  roster: RosterMode;
  /** Round 3's variable. `false` is rounds 1–2: only shooters used cover. */
  approach?: boolean;
}

interface Run extends Variant {
  samples: Sample[];
  /** Wall-clock ms to simulate one 4-second slice, for the #97 comparison. */
  msPerSlice: number;
  /**
   * Seconds until **half** the swords have their target inside reach, or -1 if
   * that never happens inside the 20 s window.
   *
   * The median rather than the first: one sword arriving is a body that started
   * close, and the ticket asks how long a *covered approach* costs, which is a
   * question about the army. Measured every step, not at the sample times.
   */
  meleeContactT: number;
}

/**
 * One 20-second run, stepped one step at a time.
 *
 * Not `advanceBattle(state, n)`: a release lives for exactly one step, so
 * counting shots fired means being present on every step. The cost of that is
 * the loop overhead and nothing else — the same `stepBattle` runs either way.
 */
function run(variant: Variant): Run {
  const board = boardFor(variant.density);
  const world = occludersOf(board, variant.space);
  const open = (): SimState => createSpaceBattle(variant.space, {
    approach: variant.approach ?? true,
    density: variant.density,
    roster: variant.roster,
  });
  const state = open();
  const samples: Sample[] = [];
  const wanted = new Set(SAMPLE_AT.map(stepsFor));
  let shots = 0;
  if (wanted.has(0)) { samples.push(sampleOf(state, board, variant.space, world, 0)); }
  const last = Math.max(...SAMPLE_AT.map(stepsFor));
  let contactStep = -1;
  for (let step = 0; step < last; step += 1) {
    advanceBattle(state, 1);
    for (const unit of state.units) {
      if (unit.firedAtStep === state.step) { shots += 1; }
    }
    if (contactStep < 0 && halfTheSwordsAreInReach(state)) { contactStep = state.step; }
    if (wanted.has(state.step)) {
      samples.push(sampleOf(state, board, variant.space, world, shots));
    }
  }
  const timed = open();
  const started = performance.now();
  advanceBattle(timed, stepsFor(4));
  return {
    ...variant,
    meleeContactT: contactStep < 0 ? -1 : Number((contactStep * FIXED_STEP).toFixed(2)),
    msPerSlice: Number((performance.now() - started).toFixed(1)),
    samples,
  };
}

/** The time-to-contact predicate, checked every step rather than at samples. */
function halfTheSwordsAreInReach(state: SimState): boolean {
  const byId = new Map(state.units.map((unit) => [unit.id, unit]));
  let swords = 0;
  let arrived = 0;
  for (const unit of state.units) {
    const profile = profileOf(unit.archetype, unit.tier);
    if (postureOf(profile.standoff, profile.attackRange) !== "assault") { continue; }
    swords += 1;
    const target = byId.get(unit.targetId);
    if (target === undefined) { continue; }
    if (Math.hypot(target.x - unit.x, target.z - unit.z) <= profile.attackRange) { arrived += 1; }
  }
  return swords > 0 && arrived * 2 >= swords;
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

/** One row per variant, one column per sample time. */
function overTime(runs: Run[], read: (sample: Sample) => string): string[][] {
  return [
    ["variant", ...SAMPLE_AT.map((t) => `t=${String(t)}`)],
    ...runs.map((entry) => [entry.label, ...entry.samples.map(read)]),
  ];
}

/** One row per variant, one column per metric, at a single instant. */
function atTime(
  runs: Run[],
  seconds: number,
  columns: [string, (sample: Sample) => string][],
): string[][] {
  const at = SAMPLE_AT.indexOf(seconds);
  return [
    ["variant", ...columns.map(([name]) => name)],
    ...runs.map((entry) => {
      const sample = entry.samples[at];
      if (sample === undefined) { return [entry.label]; }
      return [entry.label, ...columns.map(([, read]) => read(sample))];
    }),
  ];
}

/**
 * Rounds 1-2's tables, pinned to `approach: false`.
 *
 * These sections say "round 2" and they now have to keep meaning it: round 3
 * changed the default, and leaving these on the default would have silently
 * rewritten round 2's published numbers under round 2's own headings. The A/B
 * in the round-3 section is where the change is supposed to show up.
 */
const MIXED: Variant[] = [
  { approach: false, density: "dense", key: "plaza", label: "A — open plaza", roster: "mixed", space: "plaza" },
  { approach: false, density: "dense", key: "dense", label: "B — cover, dense (round 1)", roster: "mixed", space: "cover" },
  { approach: false, density: "spread", key: "spread", label: "B — cover, spread", roster: "mixed", space: "cover" },
  { approach: false, density: "sparse", key: "sparse", label: "B — cover, sparse", roster: "mixed", space: "cover" },
];

const RANGED: Variant[] = [
  { approach: false, density: "dense", key: "ranged-plaza", label: "ranged — open plaza", roster: "ranged", space: "plaza" },
  { approach: false, density: "dense", key: "ranged-dense", label: "ranged — cover, dense", roster: "ranged", space: "cover" },
  { approach: false, density: "spread", key: "ranged-spread", label: "ranged — cover, spread", roster: "ranged", space: "cover" },
  { approach: false, density: "sparse", key: "ranged-sparse", label: "ranged — cover, sparse", roster: "ranged", space: "cover" },
];

const SPLIT: Variant[] = [
  { approach: false, density: "dense", key: "split-plaza", label: "ranged vs melee — plaza", roster: "split", space: "plaza" },
  { approach: false, density: "dense", key: "split-dense", label: "ranged vs melee — dense", roster: "split", space: "cover" },
  { approach: false, density: "spread", key: "split-spread", label: "ranged vs melee — spread", roster: "split", space: "cover" },
  { approach: false, density: "sparse", key: "split-sparse", label: "ranged vs melee — sparse", roster: "split", space: "cover" },
];

/**
 * Round 3's A/B, at the ruled configuration.
 *
 * `spread` density and `hitscan` fire are not reopened, so every pair below is
 * the same board and the same roster with melee's covered approach switched on
 * and off. The `dense` and `sparse` pairs are there for one reason: the ticket
 * asks whether *melee having a reason to want props* changes the density
 * answer, and that cannot be read off `spread` alone.
 */
const APPROACH: Variant[] = [
  { approach: false, density: "spread", key: "r2-mixed-spread", label: "mixed, spread — r2 (melee ignores cover)", roster: "mixed", space: "cover" },
  { approach: true, density: "spread", key: "r3-mixed-spread", label: "mixed, spread — r3 (melee routes)", roster: "mixed", space: "cover" },
  { approach: false, density: "spread", key: "r2-split-spread", label: "split, spread — r2", roster: "split", space: "cover" },
  { approach: true, density: "spread", key: "r3-split-spread", label: "split, spread — r3", roster: "split", space: "cover" },
  { approach: false, density: "dense", key: "r2-mixed-dense", label: "mixed, dense — r2", roster: "mixed", space: "cover" },
  { approach: true, density: "dense", key: "r3-mixed-dense", label: "mixed, dense — r3", roster: "mixed", space: "cover" },
  { approach: false, density: "sparse", key: "r2-mixed-sparse", label: "mixed, sparse — r2", roster: "mixed", space: "cover" },
  { approach: true, density: "sparse", key: "r3-mixed-sparse", label: "mixed, sparse — r3", roster: "mixed", space: "cover" },
  { approach: true, density: "dense", key: "r3-plaza", label: "mixed, plaza — no cover at all", roster: "mixed", space: "plaza" },
];

function main(): void {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const out = outIndex >= 0 ? args[outIndex + 1] ?? "." : ".";
  mkdirSync(out, { recursive: true });

  const mixed = MIXED.map(run);
  const ranged = RANGED.map(run);
  const split = SPLIT.map(run);
  const approach = APPROACH.map(run);
  const all = [...mixed, ...ranged, ...split, ...approach];

  const densities: DensityRow[] = COVER_DENSITIES.map((density) => densityReport(boardFor(density)));
  const dense = boardFor("dense");
  const snaps = snapReport();
  const trueTiles = snaps.reduce((sum, row) => sum + row.trueTiles, 0);
  const outwardTiles = snaps.reduce((sum, row) => sum + row.outwardTiles, 0);
  const nearestTiles = snaps.reduce((sum, row) => sum + row.nearestTiles, 0);

  const board = {
    boardExtentWorld: Number((TILE * 20).toFixed(2)),
    densities,
    fodderHeightWorld: FODDER_HEIGHT,
    heroHeightWorld: HERO_HEIGHT,
    overlappingRetrofits: overlappingRetrofits(dense),
    retrofitProps: dense.props.filter((prop) => prop.retrofit).length,
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
    walkableTilesDense: walkableCells(dense).length,
  };

  writeFileSync(
    join(out, "metrics.json"),
    `${JSON.stringify({ board, runs: all }, null, 2)}\n`,
  );

  const lines = [
    "# #100 battlefield space, round 2 — measured",
    "",
    "Round 1 measured one board and one roster. Round 2 varies the two things",
    "the reopen note says were never varied: **prop density** and **who is",
    "fighting**. Same seed, same opening layout, same camera, same 20 seconds",
    "everywhere — see `measure.ts`'s header for how far each number can be",
    "trusted, and for one correction to a round-1 number.",
    "",
    "## The density axis",
    "",
    "One knob — how many authored props survive, chosen farthest-point from each",
    "other and from `board.ts`'s existing masses. `dense` is round 1's board",
    "unchanged; the spacing columns are outcomes of the knob, not the knob.",
    "",
    table([
      ["density", "authored props", "props total", "closest authored pair (tiles)", "mean floor to nearest prop (tiles)", "blocked tiles", "walkable", "board blocked"],
      ...densities.map((row) => [
        row.density,
        String(row.authoredProps),
        String(row.totalProps),
        row.minGap.toFixed(2),
        row.meanFloorToProp.toFixed(2),
        String(row.blockedTiles),
        `${String(row.walkableTiles)} / 400`,
        pct(row.blockedFraction),
      ]),
    ]),
    "",
    "## Question 1 — does the formation plateau survive lower density?",
    "",
    "#97's rank-depth s.d. Round 1's finding was that the plaza climbs and never",
    "recovers while cover plateaus. The question is whether the plateau is a",
    "property of cover or of *that much* cover.",
    "",
    table(overTime(mixed, (s) => s.depthSd.toFixed(2))),
    "",
    "Spread along the line (rank s.d.), same runs:",
    "",
    table(overTime(mixed, (s) => s.rankSd.toFixed(2))),
    "",
    "### What density costs the fight",
    "",
    "At t=20, mixed roster:",
    "",
    table(atTime(mixed, 20, [
      ["target in reach", (s) => `${String(s.inReach)}/40`],
      ["mid-attack", (s) => String(s.attacking)],
      ["shots fired, total", (s) => String(s.shotsFired)],
      ["attempts denied by cover", (s) => pct(deniedShare(s))],
      ["hidden by board art", (s) => pct(s.occlusionByBoardArt)],
      ["hidden by authored cover", (s) => pct(s.occlusionByAuthoredCover)],
      ["hidden by bodies", (s) => pct(s.occlusionByUnits)],
      ["bodies >50 % hidden", (s) => String(s.mostlyHidden)],
      ["crowd bbox", (s) => `${String(s.bboxW)}x${String(s.bboxH)}`],
    ])),
    "",
    "Bodies in reach over time — the number round 1 flagged as the cost of cover:",
    "",
    table(overTime(mixed, (s) => `${String(s.inReach)}/40`)),
    "",
    "## Question 2 — ranged",
    "",
    "Every body a shooter (4.7–6.2 unit standoff, 1.5–2.1 s cooldown). This is",
    "the composition cover is *for*, and round 1 never isolated it.",
    "",
    table(atTime(ranged, 20, [
      ["in reach", (s) => `${String(s.rangedInReach)}/${String(s.rangedUnits)}`],
      ["at standoff (±25 %)", (s) => `${String(s.rangedAtStandoff)}/${String(s.rangedUnits)}`],
      ["mean sightline occlusion", (s) => pct(s.rangedOcclusion)],
      ["shots fired, total", (s) => String(s.shotsFired)],
      ["attempts denied by cover", (s) => pct(deniedShare(s))],
      ["mid-attack", (s) => String(s.attacking)],
      ["depth s.d.", (s) => s.depthSd.toFixed(2)],
      ["bodies >50 % hidden", (s) => String(s.mostlyHidden)],
    ])),
    "",
    "Formation decay, ranged roster:",
    "",
    table(overTime(ranged, (s) => s.depthSd.toFixed(2))),
    "",
    "Shots actually released, cumulative — the thing a ranged fight is made of:",
    "",
    table(overTime(ranged, (s) => String(s.shotsFired))),
    "",
    "### Ranged versus melee across cover",
    "",
    "Side 0 all shooters, side 1 all swords. The asymmetric case.",
    "",
    table(atTime(split, 20, [
      ["shooters in reach", (s) => `${String(s.rangedInReach)}/${String(s.rangedUnits)}`],
      ["all bodies in reach", (s) => `${String(s.inReach)}/40`],
      ["at standoff (±25 %)", (s) => `${String(s.rangedAtStandoff)}/${String(s.rangedUnits)}`],
      ["mean sightline occlusion", (s) => pct(s.rangedOcclusion)],
      ["shots fired, total", (s) => String(s.shotsFired)],
      ["attempts denied by cover", (s) => pct(deniedShare(s))],
      ["depth s.d.", (s) => s.depthSd.toFixed(2)],
    ])),
    "",
    "## Round 3 — melee uses cover",
    "",
    "Rounds 1 and 2 zeroed melee's cover appetite as a fix for clustering, so",
    "half the army ignored cover by construction and the archetype comparison",
    "was never run. Each pair below is the **same board, same roster, same",
    "seed** with melee's covered approach off (r2) and on (r3).",
    "",
    "### Do the two archetypes now do different things?",
    "",
    "The question the round is for. `exposed` is the share of steps a body spent",
    "with a clear line to the enemy — the thing a covered approach is supposed",
    "to buy down, and the thing a firing position is supposed to *keep* on its",
    "own terms. If the two columns move together, the archetypes still converge.",
    "",
    table(atTime(approach, 20, [
      ["swords exposed", (s) => pct(s.meleeExposed)],
      ["shooters exposed", (s) => pct(s.rangedExposed)],
      ["swords in cover", (s) => `${String(s.meleeInCover)}/${String(s.meleeUnits)}`],
      ["sword steps spent closing", (s) => String(s.meleeApproachSteps)],
      ["sword depth s.d.", (s) => s.meleeDepthSd.toFixed(2)],
      ["shooter depth s.d.", (s) => s.rangedDepthSd.toFixed(2)],
    ])),
    "",
    "### The stances, and flanking",
    "",
    "The directional ruling, counted. `ducked` and `peeking` are shares of all",
    "steps; melee has no peek column because melee never peeks. `flanked` is",
    "attacks that landed by arriving outside the target's protected arc — a",
    "number that **could not exist** under the symmetric model rounds 1-2 used,",
    "where going round the side of a crate changed nothing.",
    "",
    table(atTime(approach, 20, [
      ["swords ducked", (s) => pct(s.meleeDucked)],
      ["shooters ducked", (s) => pct(s.rangedDucked)],
      ["shooters peeking", (s) => pct(s.rangedPeeking)],
      ["flanking hits", (s) => String(s.flankedShots)],
      ["shots fired, total", (s) => String(s.shotsFired)],
    ])),
    "",
    "### Did the fight still happen?",
    "",
    "Round 1's clustering bug, watched directly. `nearest friendly` is the",
    "measurement that would have caught it: bodies converging on the same good",
    "tiles collapse it. Attacks falling while that number falls is the bug",
    "coming back; attacks holding while it holds is the fix working.",
    "",
    table(atTime(approach, 20, [
      ["swords in reach", (s) => `${String(s.meleeInReach)}/${String(s.meleeUnits)}`],
      ["all bodies in reach", (s) => `${String(s.inReach)}/40`],
      ["mid-attack", (s) => String(s.attacking)],
      ["shots fired, total", (s) => String(s.shotsFired)],
      ["attempts denied by cover", (s) => pct(deniedShare(s))],
      ["nearest friendly, swords", (s) => s.meleeNearestFriendly.toFixed(2)],
    ])),
    "",
    "### Time to contact",
    "",
    "Seconds until half the swords have their target inside reach. `-1` means",
    "it never happened inside the 20 s window — which is the failure mode a",
    "covered approach risks, and the number that says whether it happened.",
    "",
    table([
      ["variant", "half the swords in reach at", "sword depth s.d. @20", "swords exposed @20"],
      ...approach.map((entry) => {
        const last = entry.samples[entry.samples.length - 1];
        return [
          entry.label,
          entry.meleeContactT < 0 ? "never" : `${entry.meleeContactT.toFixed(2)} s`,
          last === undefined ? "-" : last.meleeDepthSd.toFixed(2),
          last === undefined ? "-" : pct(last.meleeExposed),
        ];
      }),
    ]),
    "",
    "## Cost",
    "",
    table([
      ["variant", "sim ms per 4 s slice"],
      ...all.map((entry) => [entry.label, entry.msPerSlice.toFixed(1)]),
    ]),
    "",
    "## The board, unchanged from round 1",
    "",
    table([
      ["fact", "value"],
      ["tile, world units", board.tileWorld.toFixed(4)],
      ["tile vs SEPARATION_RADIUS (1.05)", `${(board.tileWorld / 1.05).toFixed(2)}x`],
      ["grid", `20 x 20 (${board.boardExtentWorld.toFixed(1)} world units square)`],
      ["retrofitted board.ts props (every density)", String(board.retrofitProps)],
    ]),
    "",
    "`board.ts`'s props are free-placed. Giving them footprints means snapping,",
    "and there is no free option — this is density-independent, because the",
    "retrofits are never thinned:",
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
  ];
  writeFileSync(join(out, "metrics.md"), `${lines.join("\n")}\n`);
  process.stdout.write(`${lines.join("\n")}\n`);
  process.stdout.write(`\nwrote ${join(out, "metrics.json")} and ${join(out, "metrics.md")}\n`);
}

main();
