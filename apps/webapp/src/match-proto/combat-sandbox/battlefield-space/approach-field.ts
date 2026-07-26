/**
 * THROWAWAY PROTOTYPE (#100 round 3): one cost field, two weightings.
 *
 * Rounds 1 and 2 gave cover to shooters only. Melee's appetite was zeroed in
 * round 1 as a bugfix — forty bodies with a weak pull toward the same handful
 * of good tiles converged on those tiles and attacks fell 78 % — so the
 * archetype comparison the ticket exists to run was never actually run.
 *
 * This module is round 3's answer, and it is deliberately **not** two special
 * cases. `docs/research/rain-world-creature-ai.md` identifies the transferable
 * mechanism as per-unit **edge resistance over a shared graph**: the terrain is
 * one set of numbers, and each creature prices moving through it differently.
 * A lizard and a vulture route differently over identical map data because the
 * *pricing* differs, not because there are two pathfinders.
 *
 * So there is one field here — `exposure`, "how much of this tile can the enemy
 * see" — and two ways of spending it:
 *
 * ```
 *  ranged  point-evaluates it     a firing position: a line out, little line in
 *  melee   path-integrates it     a covered approach: prop to prop, then break out
 * ```
 *
 * That asymmetry is the whole finding. A shooter wants a *destination* and can
 * score one tile at a time. A swordsman wants a *route*, and a route is only
 * expressible as a sum of edge costs — which is a pathfinder. See the ticket
 * report: this is the concrete reason #100 and #119 are hard to separate.
 *
 * ## The clustering bug, solved rather than dodged
 *
 * Round 1's failure mode was every body wanting the same tile. Two things stop
 * it here, and both are in the field rather than bolted on afterwards:
 *
 * 1. **Crowd resistance.** A tile your own side already fills costs more to
 *    move through. This is Rain World's yellow-lizard flanking verbatim —
 *    `InverseLerp[0,300,dist] · 200/(n−1)` of added resistance near packmates,
 *    no formation system, no roles. Bodies spread because clustering is
 *    expensive.
 * 2. **Lane offset.** Where several descent steps are near-equally good, the
 *    unit takes the `id % count`-th. That is the same deterministic spreader
 *    round 1 already used for ranged posts (`unit.id % faceLength`), applied to
 *    a route instead of a face.
 *
 * ## Determinism
 *
 * Everything here is a **pure function of `(board, state, side)`**. Fields are
 * scratch, memoised per `SimState` identity and invalidated on `state.step`, so
 * a resumed slice recomputes an identical field rather than carrying a stale
 * one. The only thing that crosses a step boundary is `SimUnit.approachCell`, a
 * plain number, exactly like round 1's `coverCell`. The heap breaks ties on
 * cell index, so the flood order does not depend on float noise.
 */

import { heightOf } from "../units.ts";
import type { SimState, SimUnit } from "../state.ts";
import {
  type CoverBoard,
  cellCentre,
  cellIndexAt,
  eyeHeightOf,
  LATTICE,
  onBoard,
  sightBetween,
  walkable,
} from "./cover-model.ts";

/**
 * Nodes in the graph: the whole shared lattice, not the current board's window.
 *
 * Round 4 made the board a window on a fixed lattice (see `cover-model.ts`), so
 * a cell index means the same tile at every board size. The arrays are sized for
 * the lattice rather than the window so an index can be used unshifted; the
 * flood still only visits walkable cells, which are the window's. 1600 nodes at
 * 8 bytes is 13 kB of scratch a step — the graph is still small, and that is
 * still the point.
 */
const CELLS = LATTICE * LATTICE;

/** Occlusion below which a tile counts as *seen* by a threat. */
export const EXPOSED_AT = 0.35;

/**
 * How many enemies the exposure field samples.
 *
 * Not all of them: the field is a coarse shared approximation and the per-unit
 * sightline behaviour refines it. Sampling by stride over id order keeps it
 * deterministic and keeps the flood affordable — see `msPerSlice` in the
 * metrics table for what it actually costs.
 */
export const THREAT_SAMPLES = 8;

/**
 * How a posture prices the space it moves through. Two vectors, one field.
 *
 * `exposure` is in units of "extra tile-lengths of walking a fully-seen tile is
 * worth avoiding". `crowd` is the same currency, per friendly body already on
 * the tile. `breakout` is where a posture stops paying at all.
 */
export interface Resistance {
  /** Multiplier on `exposure[cell]` when pricing a tile. */
  exposure: number;
  /** Multiplier on friendly occupancy — Rain World's packmate term. */
  crowd: number;
  /**
   * World units from the target inside which the field is ignored entirely.
   *
   * For melee this is the *break out* beat: creep prop to prop, then cross the
   * last stretch in the open because standing off is not a melee option. For a
   * shooter it is 0 — a shooter that closes has stopped being a shooter.
   */
  breakout: number;
}

/**
 * The two weightings.
 *
 * Derived from the combat profile's standoff rather than the archetype name, so
 * a new archetype gets a posture for free and nothing branches on a string —
 * the same rule `archetypes.ts` documents for the rest of the sandbox.
 */
export const RESISTANCES: Record<Posture, Resistance> = {
  /** Swords. Pays exposure while closing, stops paying inside `breakout`. */
  assault: { breakout: 2.6, crowd: 0.55, exposure: 2.4 },
  /** Medics and anything with no reason to lead. Follows, does not seek. */
  escort: { breakout: 1.8, crowd: 0.8, exposure: 1.2 },
  /** Shooters. Prices a tile, does not integrate a route. */
  firing: { breakout: 0, crowd: 0.4, exposure: 3.2 },
};

export type Posture = "assault" | "escort" | "firing";

/**
 * Which posture a combat profile fights in.
 *
 * The standoff is the honest discriminator: a body that wants to be 4.7 units
 * away is solving a different spatial problem from one that wants to be 0.9
 * away, whatever it is called.
 */
export function postureOf(standoff: number, attackRange: number): Posture {
  if (standoff >= 2.5) { return "firing"; }
  return attackRange >= 1.25 ? "escort" : "assault";
}

/* ------------------------------------------------------------------ */
/* The shared field                                                    */
/* ------------------------------------------------------------------ */

/** One side's view of the board: what the enemy can see, per tile. */
export interface ExposureField {
  /** 0..1 per cell — share of sampled threats with a clear line to it. */
  exposure: Float64Array;
  /** Friendly bodies standing on each cell. The crowd term's input. */
  occupancy: Float64Array;
  /** Cells the enemy occupies — the flood's sources. */
  goals: number[];
}

/**
 * How exposed every tile on the board is to `side`'s enemies.
 *
 * A tile is exposed to a threat when the sightline between them clears the
 * props — the same `sightBetween` the fire model uses, so a tile the field
 * calls safe is a tile `blockedFire` would actually protect. That shared
 * definition is what makes the field mean something rather than being a second,
 * parallel guess at where cover is.
 */
export function buildExposure(board: CoverBoard, state: SimState, side: number): ExposureField {
  const exposure = new Float64Array(CELLS);
  const occupancy = new Float64Array(CELLS);
  const goals: number[] = [];

  // **Sorted by id, not left in array order.** The stride below picks which
  // enemies the field samples, so array order would leak into the sample and
  // therefore into every route on the board — which is exactly the coupling
  // `battlefield-space.test.ts`'s "does not depend on array order" case exists
  // to catch, and did.
  const threats: SimUnit[] = [];
  const enemies = state.units
    .filter((unit) => unit.side !== side)
    .sort((a, b) => a.id - b.id);
  const stride = Math.max(1, Math.ceil(enemies.length / THREAT_SAMPLES));
  for (let index = 0; index < enemies.length; index += stride) {
    const enemy = enemies[index];
    if (enemy !== undefined) { threats.push(enemy); }
  }
  for (const enemy of enemies) {
    const cell = cellOf(board, enemy);
    if (cell >= 0) { goals.push(cell); }
  }
  goals.sort((a, b) => a - b);

  for (const unit of state.units) {
    if (unit.side !== side) { continue; }
    const cell = cellOf(board, unit);
    if (cell >= 0) { occupancy[cell] = (occupancy[cell] ?? 0) + 1; }
  }

  if (threats.length === 0) { return { exposure, goals, occupancy }; }

  // A representative body, not each unit's own: the field is shared, and one
  // per unit would be forty floods a step for a difference smaller than the
  // sampling error already accepted above.
  const standing = heightOf("fodder");
  for (let cy = board.lo; cy < board.hi; cy += 1) {
    for (let cx = board.lo; cx < board.hi; cx += 1) {
      if (!walkable(board, cx, cy)) { continue; }
      const at = cellCentre(cx, cy);
      let seen = 0;
      for (const threat of threats) {
        const sight = sightBetween(
          board,
          threat.x,
          threat.z,
          eyeHeightOf(threat.tier),
          at.x,
          at.z,
          standing,
        );
        if (sight.occlusion < EXPOSED_AT) { seen += 1; }
      }
      exposure[cy * LATTICE + cx] = seen / threats.length;
    }
  }
  return { exposure, goals, occupancy };
}

function cellOf(board: CoverBoard, unit: SimUnit): number {
  const cx = cellIndexAt(unit.x);
  const cy = cellIndexAt(unit.z);
  if (!onBoard(board, cx, cy)) { return -1; }
  return cy * LATTICE + cx;
}

/* ------------------------------------------------------------------ */
/* The router — melee's half                                           */
/* ------------------------------------------------------------------ */

/** Cost-to-contact per cell under one resistance vector. `Infinity` = no route. */
export interface ApproachField {
  cost: Float64Array;
}

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
];
const DIAGONAL: readonly (readonly [number, number])[] = [
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

/**
 * Dijkstra outward from the enemy, pricing every edge by the resistance vector.
 *
 * Flooding from the **goal** rather than from each unit is what makes this
 * affordable: one flood serves every body on the side, which is Rain World's
 * own arrangement ("goal-outward flood fill"). The cost of an edge is its
 * length plus what the destination tile charges for being seen and for being
 * crowded — so a route through open ground is legal but expensive, and the
 * pathfinder degrades to it rather than failing, which is the `Legality` /
 * `resistance` split the research describes.
 *
 * A diagonal that cuts the corner of a blocked tile is refused: a body that
 * slips through a crate's corner is the occupancy model leaking.
 */
export function buildApproach(
  board: CoverBoard,
  field: ExposureField,
  resistance: Resistance,
): ApproachField {
  const cost = new Float64Array(CELLS).fill(Infinity);
  const done = new Uint8Array(CELLS);
  const heap = new CellHeap();
  for (const goal of field.goals) {
    cost[goal] = 0;
    heap.push(goal, 0);
  }

  while (heap.size > 0) {
    const at = heap.pop();
    if (at < 0 || done[at] === 1) { continue; }
    done[at] = 1;
    const cx = at % LATTICE;
    const cy = Math.floor(at / LATTICE);
    const here = cost[at] ?? Infinity;
    for (const [dx, dy] of ORTHOGONAL) {
      relax(cx + dx, cy + dy, here, 1);
    }
    for (const [dx, dy] of DIAGONAL) {
      // No corner cutting: both orthogonal neighbours must be open.
      if (!walkable(board, cx + dx, cy) || !walkable(board, cx, cy + dy)) { continue; }
      relax(cx + dx, cy + dy, here, Math.SQRT2);
    }
  }
  return { cost };

  function relax(nx: number, ny: number, here: number, span: number): void {
    if (!walkable(board, nx, ny)) { return; }
    const to = ny * LATTICE + nx;
    if (done[to] === 1) { return; }
    const seen = field.exposure[to] ?? 0;
    const crowd = field.occupancy[to] ?? 0;
    const price = span * (1 + resistance.exposure * seen) + resistance.crowd * crowd;
    const next = here + price;
    if (next >= (cost[to] ?? Infinity)) { return; }
    cost[to] = next;
    heap.push(to, next);
  }
}

/**
 * The next tile to walk to, descending the field.
 *
 * `hops` steps of descent rather than one, because a single tile of lookahead
 * is re-picked before a body has covered it and the motion reads as a shuffle
 * at 28 px.
 *
 * `lane` is the clustering fix. Among the descent steps that are within
 * `LANE_TOLERANCE` of the best, the unit takes the `lane % count`-th — the same
 * deterministic spreader round 1 used to slot shooters along a prop's face,
 * applied to a route. Without it one flood serves forty bodies by funnelling
 * every one of them through the identical cheapest gap.
 */
export const LANE_TOLERANCE = 1.12;

export function descend(
  board: CoverBoard,
  approach: ApproachField,
  fromCell: number,
  lane: number,
  hops: number,
): number {
  let at = fromCell;
  for (let hop = 0; hop < hops; hop += 1) {
    const next = stepDown(board, approach, at, lane + hop);
    if (next < 0) { return at === fromCell ? -1 : at; }
    at = next;
  }
  return at;
}

function stepDown(
  board: CoverBoard,
  approach: ApproachField,
  at: number,
  lane: number,
): number {
  const here = approach.cost[at] ?? Infinity;
  if (!Number.isFinite(here) || here === 0) { return -1; }
  const cx = at % LATTICE;
  const cy = Math.floor(at / LATTICE);
  const options: { cell: number; cost: number }[] = [];
  for (const [dx, dy] of [...ORTHOGONAL, ...DIAGONAL]) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (!walkable(board, nx, ny)) { continue; }
    if (dx !== 0 && dy !== 0
      && (!walkable(board, nx, cy) || !walkable(board, cx, ny))) { continue; }
    const cell = ny * LATTICE + nx;
    const value = approach.cost[cell] ?? Infinity;
    if (value >= here) { continue; }
    options.push({ cell, cost: value });
  }
  if (options.length === 0) { return -1; }
  options.sort((a, b) => (a.cost - b.cost) || (a.cell - b.cell));
  const best = options[0];
  if (best === undefined) { return -1; }
  // Everything near-as-good as the best is a lane. Ties break on cell index
  // first, so the lane a given id takes is fixed by the board, not by float
  // noise in the flood.
  const ceiling = best.cost === 0 ? 0 : best.cost * LANE_TOLERANCE;
  let count = 1;
  while (count < options.length && (options[count]?.cost ?? Infinity) <= ceiling) { count += 1; }
  return options[lane % count]?.cell ?? best.cell;
}

/* ------------------------------------------------------------------ */
/* Memoisation                                                         */
/* ------------------------------------------------------------------ */

interface Cached {
  step: number;
  exposure: (ExposureField | undefined)[];
  approach: (ApproachField | undefined)[];
}

/**
 * Keyed on the `SimState` **object**, not on its step.
 *
 * Two variants are simulated in the same process by `measure.ts` and can sit on
 * the same step at the same density; a value key would hand one run the other's
 * board. Identity cannot collide, and a state resumed from JSON is a new object
 * so it recomputes rather than inheriting anything.
 */
const CACHE = new WeakMap<SimState, Cached>();

function entryFor(state: SimState): Cached {
  const found = CACHE.get(state);
  if (found !== undefined && found.step === state.step) { return found; }
  const fresh: Cached = { approach: [], exposure: [], step: state.step };
  CACHE.set(state, fresh);
  return fresh;
}

/** The exposure field for one side, computed at most once per step. */
export function exposureFor(board: CoverBoard, state: SimState, side: number): ExposureField {
  const entry = entryFor(state);
  const hit = entry.exposure[side];
  if (hit !== undefined) { return hit; }
  const built = buildExposure(board, state, side);
  entry.exposure[side] = built;
  return built;
}

/**
 * The approach field for one side's assault posture, at most once per step.
 *
 * Only `assault` is flooded. `firing` point-evaluates the same exposure field
 * and never needs a route, and `escort` rides the assault field — which is the
 * cheap half of the finding: two weightings, one flood.
 */
export function approachFor(board: CoverBoard, state: SimState, side: number): ApproachField {
  const entry = entryFor(state);
  const hit = entry.approach[side];
  if (hit !== undefined) { return hit; }
  const built = buildApproach(board, exposureFor(board, state, side), RESISTANCES.assault);
  entry.approach[side] = built;
  return built;
}

/* ------------------------------------------------------------------ */
/* A tiny deterministic binary heap                                    */
/* ------------------------------------------------------------------ */

/**
 * Min-heap over (cost, cell). Ties break on cell index so the pop order is
 * fixed by the board rather than by insertion order.
 */
class CellHeap {
  private cells: number[] = [];
  private costs: number[] = [];

  get size(): number { return this.cells.length; }

  push(cell: number, cost: number): void {
    this.cells.push(cell);
    this.costs.push(cost);
    let at = this.cells.length - 1;
    while (at > 0) {
      const up = (at - 1) >> 1;
      if (!this.before(at, up)) { break; }
      this.swap(at, up);
      at = up;
    }
  }

  pop(): number {
    const top = this.cells[0];
    if (top === undefined) { return -1; }
    const lastCell = this.cells.pop();
    const lastCost = this.costs.pop();
    if (this.cells.length > 0 && lastCell !== undefined && lastCost !== undefined) {
      this.cells[0] = lastCell;
      this.costs[0] = lastCost;
      let at = 0;
      for (;;) {
        const left = at * 2 + 1;
        const right = left + 1;
        let small = at;
        if (left < this.cells.length && this.before(left, small)) { small = left; }
        if (right < this.cells.length && this.before(right, small)) { small = right; }
        if (small === at) { break; }
        this.swap(at, small);
        at = small;
      }
    }
    return top;
  }

  private before(a: number, b: number): boolean {
    const ca = this.costs[a] ?? Infinity;
    const cb = this.costs[b] ?? Infinity;
    if (ca !== cb) { return ca < cb; }
    return (this.cells[a] ?? 0) < (this.cells[b] ?? 0);
  }

  private swap(a: number, b: number): void {
    const cell = this.cells[a] ?? 0;
    const cost = this.costs[a] ?? 0;
    this.cells[a] = this.cells[b] ?? 0;
    this.costs[a] = this.costs[b] ?? 0;
    this.cells[b] = cell;
    this.costs[b] = cost;
  }
}
