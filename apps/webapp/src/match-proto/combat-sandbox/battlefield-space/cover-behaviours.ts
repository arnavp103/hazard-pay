/**
 * THROWAWAY PROTOTYPE (#100): the unit AI that makes cover consequential.
 *
 * Five behaviours pushed into the sandbox's `BEHAVIOURS` registry (extension
 * point 3). **Every one of them returns immediately when `state.coverMode` is
 * 0**, so variant A — the open plaza — is bit-identical to the sandbox default
 * and stays honestly comparable with the #96 gallery. Only variant B pays for
 * any of this.
 *
 * ```
 *  acquire  seekCoverCell      choose the tile to fight from, on retarget steps
 *  steer    readSightline      how hidden is my target from me, right now
 *  steer    holdCover          walk to the chosen tile
 *  steer    avoidFootprints    push out of prop footprints, slide along faces
 *  act      blockedFire        a shot into cover is held or degraded
 *  act      clampToFootprints  a body never ends a step inside a prop
 * ```
 *
 * ## What "cover" is modelled to do, and what it is not
 *
 * Cover here degrades the **exchange of fire in both directions across it**.
 * `readSightline` measures how much of a unit's target is hidden *from that
 * unit*, and `blockedFire` holds or spoils the shot accordingly — so two units
 * on opposite sides of a crate stack suppress each other, and the fight becomes
 * about finding an angle rather than about who is protected.
 *
 * There is no peek, no stance, and no "break cover to fire". That is the first
 * question this prototype puts to a human: a defensive-only cover stat (you are
 * protected but always shoot) is the cheaper, more familiar auto-battler model
 * and it produces a visibly different fight.
 *
 * ## Determinism
 *
 * Per the rules at the top of `behaviours.ts`: draws come from
 * `nextRandom(unit)`, deadlines compare `state.step`, props are iterated by
 * array index with ties broken on index, and everything stored is a plain
 * number on `SimUnit`.
 *
 * **One caveat, deliberately surfaced rather than hidden.** `clampToFootprints`
 * corrects a unit's position in the `act` phase, after the integrator. The
 * `act` phase is not double-buffered, so a low-id unit's clamp is visible to a
 * high-id unit's `attackCycle` in the same step. The battle is still exactly
 * reproducible from `(seed, options, steps)` and still resumes from a
 * serialised slice — but variant B is the first thing in this sandbox where a
 * *position* depends on combat state, which is the feedback loop #97's research
 * measured as absent ("attacks do not affect the simulation"). Its conclusion
 * that float determinism has nine orders of margin was explicitly conditional
 * on that loop staying open. Variant B closes it.
 */

import { type Behaviour, BEHAVIOURS, type BehaviourContext } from "../behaviours.ts";
import { clamp, nextRandom } from "../procedural.ts";
import type { SimUnit } from "../state.ts";
import { heightOf } from "../units.ts";
import {
  blockedAt,
  bodyRadius,
  cellCentre,
  cellEdge,
  cellIndexAt,
  COVER_PROPS,
  coverFaceCells,
  eyeHeightOf,
  GRID,
  isUsableCover,
  sightBetween,
  walkable,
  worldRectOf,
} from "./cover-model.ts";

/** Occlusion at or above which a shot is simply not taken. */
export const FIRE_BLOCK = 0.85;
/** Steps a unit waits after holding a shot before trying again (0.25 s). */
export const HOLD_STEPS = 15;
/** Occlusion above which a unit tries to slide around the thing in its way. */
export const FLANK_AT = 0.35;
/** How far a unit will walk to reach cover, in world units (~5 tiles). */
export const COVER_SEEK_RANGE = 5.8;
/**
 * The occlusion a unit *wants*. Not 1.0: total cover means the unit cannot
 * shoot either, so the AI aims for a partial line and the fight keeps moving.
 */
export const COVER_SWEET = 0.55;
/** World units of cover value, traded against world units of walking. */
const COVER_PULL = 4.5;

/**
 * How badly an archetype wants cover, read off its standoff.
 *
 * **Zero for melee and the medic, by construction.** The first build gave
 * everyone a small appetite and the fight stopped happening: forty bodies with
 * a weak pull toward the same handful of good tiles converge on those tiles,
 * so nobody reaches anybody and attacks fell 78 %. Swords charge. Shooters use
 * cover. That reads at 28 px; a crowd all drifting slightly toward the middle
 * does not.
 */
function coverAppetite(standoff: number): number {
  return clamp((standoff - 2.5) / 2.5, 0, 1);
}

function isOn(ctx: BehaviourContext): boolean {
  return ctx.state.coverMode === 1;
}

/** The target this unit is fighting, read fresh (acquire may have moved it). */
function targetOf(unit: SimUnit, ctx: BehaviourContext): SimUnit | undefined {
  return unit.targetId < 0 ? undefined : ctx.byId.get(unit.targetId);
}

/**
 * Choose the tile to fight from.
 *
 * Runs only on retarget steps, so the cover decision has the same cadence as
 * the targeting decision — a unit that re-picks its tile every frame reads as
 * indecisive at 28 px, and it is 27x the cost for no visible gain.
 *
 * Scoring trades walking distance against how close the tile lands to
 * `COVER_SWEET`. Ties break on prop index, which is fixed by the manifest.
 */
export const seekCoverCell: Behaviour = {
  doc: "pick the tile to fight from — a cover post near the current threat",
  name: "seekCoverCell",
  phase: "acquire",
  step(unit, ctx) {
    if (!isOn(ctx)) { return; }
    const target = targetOf(unit, ctx);
    if (target === undefined) {
      unit.coverCell = -1;
      return;
    }
    const appetite = coverAppetite(ctx.profile.standoff);
    if (appetite < 0.1) {
      unit.coverCell = -1;
      return;
    }
    const height = heightOf(unit.tier);
    const threatEye = eyeHeightOf(target.tier);
    let bestScore = Infinity;
    let bestCell = -1;
    for (let index = 0; index < COVER_PROPS.length; index += 1) {
      const prop = COVER_PROPS[index];
      if (prop === undefined || !isUsableCover(prop.cover)) { continue; }
      // A slot along the prop's far face rather than one tile behind it: two
      // dozen shooters all wanting the same tile is how the first build turned
      // the fight into a queue. Slots are picked by unit id, so a barrier
      // fills along its length and stays deterministic.
      const face = coverFaceCells(prop, target.x, target.z);
      const post = face[unit.id % Math.max(1, face.length)];
      if (post === undefined) { continue; }
      const at = cellCentre(post.cx, post.cy);
      const walk = Math.hypot(at.x - unit.x, at.z - unit.z);
      if (walk > COVER_SEEK_RANGE) { continue; }
      // Cover a unit cannot shoot from is a hiding place, not a firing
      // position. Without this the shooters walk backwards out of the fight.
      if (Math.hypot(at.x - target.x, at.z - target.z) > ctx.profile.attackRange) { continue; }
      const sight = sightBetween(target.x, target.z, threatEye, at.x, at.z, height);
      if (sight.occlusion < 0.2) { continue; }
      const value = Math.max(0, 1 - Math.abs(sight.occlusion - COVER_SWEET) / COVER_SWEET);
      const score = walk - value * COVER_PULL;
      if (score < bestScore) {
        bestScore = score;
        bestCell = post.cy * GRID + post.cx;
      }
    }
    unit.coverCell = bestCell;
  },
};

/**
 * How much of this unit's target is hidden from it, this step.
 *
 * Stored on the unit rather than recomputed in `act` because two behaviours
 * and every metric want it, and because it is genuinely part of the slice
 * state: "what can this body see" is the thing a cover model adds.
 */
export const readSightline: Behaviour = {
  doc: "measure the occlusion between this unit and its target",
  name: "readSightline",
  phase: "steer",
  step(unit, ctx) {
    if (!isOn(ctx)) { return; }
    const target = targetOf(unit, ctx);
    if (target === undefined) {
      unit.sightOcclusion = 0;
      return;
    }
    const sight = sightBetween(
      unit.x,
      unit.z,
      eyeHeightOf(unit.tier),
      target.x,
      target.z,
      heightOf(target.tier),
    );
    unit.sightOcclusion = sight.occlusion;
    // Slide around whatever is in the way rather than grinding into it. The
    // side is the short way round, from the sign of the cross product — no
    // extra sightline evaluation and no per-unit coin to remember.
    if (sight.by >= 0 && sight.occlusion > FLANK_AT) {
      const prop = COVER_PROPS[sight.by];
      if (prop !== undefined) {
        const rect = worldRectOf(prop.cells);
        const toX = target.x - unit.x;
        const toZ = target.z - unit.z;
        const offX = unit.x - (rect.x0 + rect.x1) / 2;
        const offZ = unit.z - (rect.z0 + rect.z1) / 2;
        const side = toX * offZ - toZ * offX >= 0 ? 1 : -1;
        const span = Math.hypot(toX, toZ) || 1;
        const push = (sight.occlusion - FLANK_AT) * 1.4 * ctx.profile.maxSpeed;
        ctx.desiredVx += (-toZ / span) * side * push;
        ctx.desiredVz += (toX / span) * side * push;
      }
    }
  },
};

/** Walk to the chosen cover tile. Fades out on arrival so nobody vibrates. */
export const holdCover: Behaviour = {
  doc: "steer toward the chosen cover tile, fading out on arrival",
  name: "holdCover",
  phase: "steer",
  step(unit, ctx) {
    if (!isOn(ctx) || unit.coverCell < 0) { return; }
    const at = cellCentre(unit.coverCell % GRID, Math.floor(unit.coverCell / GRID));
    const dx = at.x - unit.x;
    const dz = at.z - unit.z;
    const span = Math.hypot(dx, dz);
    if (span < 0.3) { return; }
    const drive = clamp((span - 0.3) * 2.2, 0, 1) * coverAppetite(ctx.profile.standoff);
    ctx.desiredVx += (dx / span) * drive * ctx.profile.maxSpeed;
    ctx.desiredVz += (dz / span) * drive * ctx.profile.maxSpeed;
  },
};

/**
 * Push away from blocked tiles in the neighbourhood, and slide along a face
 * rather than grinding into it. Soft: the hard guarantee is
 * `clampToFootprints`.
 *
 * Works off the blocked-cell **union**, not per prop, for the reason
 * `blockedAt` documents — four of `board.ts`'s outward-snapped props overlap
 * each other on the grid, and a per-prop repulsion pushes a body into a pocket
 * that has no exit.
 */
export const avoidFootprints: Behaviour = {
  doc: "repel from blocked tiles in the neighbourhood",
  name: "avoidFootprints",
  phase: "steer",
  step(unit, ctx) {
    if (!isOn(ctx)) { return; }
    // Deliberately weak and short-ranged. The hard guarantee is the clamp; a
    // strong repulsion field here is what stopped melee closing in the first
    // build, because two bodies either side of a one-tile crate were each held
    // 0.6 units off it and could never come within a 1.1-unit reach.
    const margin = bodyRadius(unit.tier) + 0.14;
    const target = targetOf(unit, ctx);
    const atCx = cellIndexAt(unit.x);
    const atCy = cellIndexAt(unit.z);
    for (let cy = atCy - 1; cy <= atCy + 1; cy += 1) {
      for (let cx = atCx - 1; cx <= atCx + 1; cx += 1) {
        if (!blockedAt(cx, cy)) { continue; }
        const x0 = cellEdge(cx);
        const x1 = cellEdge(cx + 1);
        const z0 = cellEdge(cy);
        const z1 = cellEdge(cy + 1);
        const dx = unit.x - clamp(unit.x, x0, x1);
        const dz = unit.z - clamp(unit.z, z0, z1);
        const gap = Math.hypot(dx, dz);
        if (gap > margin) { continue; }
        const strength = (1 - gap / margin) * 1.5;
        if (gap < 1e-4) {
          const outX = unit.x - (x0 + x1) / 2;
          const outZ = unit.z - (z0 + z1) / 2;
          const away = Math.hypot(outX, outZ) || 1;
          ctx.desiredVx += (outX / away) * strength;
          ctx.desiredVz += (outZ / away) * strength;
          continue;
        }
        ctx.desiredVx += (dx / gap) * strength;
        ctx.desiredVz += (dz / gap) * strength;
        // Slide along the face toward the target instead of grinding into it.
        // This is local avoidance standing in for a pathfinder, and it is only
        // as good as one tile of lookahead — see the report.
        if (target === undefined) { continue; }
        const toX = target.x - unit.x;
        const toZ = target.z - unit.z;
        const along = toX * (-dz / gap) + toZ * (dx / gap);
        const slide = Math.hypot(toX, toZ) < 1e-4 ? 0 : Math.sign(along) * strength * 0.9;
        ctx.desiredVx += (-dz / gap) * slide;
        ctx.desiredVz += (dx / gap) * slide;
      }
    }
  },
};

/**
 * A shot into cover is held, or taken and spoiled.
 *
 * Runs after the built-in `attackCycle`, so it sees the attack the cycle just
 * started (`attackStep === 0`) and can cancel it before a single frame of
 * wind-up is drawn. Cancelling rather than spoiling the release is the choice
 * with a picture attached: #97 measured that 42 % of the army is mid-wind-up at
 * any instant, so the visible consequence of cover is *fewer telegraphs on
 * screen*, not more misses.
 */
export const blockedFire: Behaviour = {
  doc: "hold or spoil an attack whose line into the target is covered",
  name: "blockedFire",
  phase: "act",
  step(unit, ctx) {
    if (!isOn(ctx) || unit.attackStep !== 0) { return; }
    const occlusion = unit.sightOcclusion;
    if (occlusion <= 0.01) { return; }
    const denied = occlusion >= FIRE_BLOCK || nextRandom(unit) < occlusion;
    if (!denied) { return; }
    unit.attackStep = -1;
    unit.cooldownSteps = HOLD_STEPS;
    unit.suppressedShots += 1;
  },
};

/**
 * A body never ends a step inside a prop's footprint.
 *
 * The hard half of the occupancy model — lane 5 makes standing on a crate
 * *unrepresentable* by deriving placement from the model, and a live sim has to
 * get the same guarantee from a correction. Projects out along the shallowest
 * axis and kills the inward velocity so the unit does not immediately re-enter.
 */
export const clampToFootprints: Behaviour = {
  doc: "project a unit out of any prop footprint it ended the step inside",
  name: "clampToFootprints",
  phase: "act",
  step(unit, ctx) {
    if (!isOn(ctx)) { return; }
    clampUnitOutOfProps(unit);
  },
};

/** Rings searched outward when a body somehow ends up deep in a blocked run. */
const ESCAPE_RINGS = 4;

/**
 * The clamp: a body never ends a step on a blocked tile, and never gets closer
 * than its own radius to one.
 *
 * Two stages. If the body is on a blocked tile it leaves through the nearest
 * walkable face — a slide, not a teleport, because a pop at 28 px reads as a
 * bug. If every face is blocked (only reachable by a bad opening layout) it
 * falls back to the nearest walkable tile's centre, scanning rings in a fixed
 * order so the result is reproducible. Then it holds a body's radius of
 * clearance from each blocked neighbour, which is possible for both axes at
 * once because `bodyRadius` is comfortably under half a tile.
 */
export function clampUnitOutOfProps(unit: SimUnit): boolean {
  const radius = bodyRadius(unit.tier);
  let cx = cellIndexAt(unit.x);
  let cy = cellIndexAt(unit.z);
  let moved = false;

  if (blockedAt(cx, cy)) {
    const exits: { cx: number; cy: number; cost: number }[] = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (blockedAt(nx, ny) || !onBoard(nx, ny)) { continue; }
      const edge = dx !== 0
        ? Math.abs(unit.x - cellEdge(dx < 0 ? cx : cx + 1))
        : Math.abs(unit.z - cellEdge(dy < 0 ? cy : cy + 1));
      exits.push({ cost: edge, cx: nx, cy: ny });
    }
    const exit = exits.sort((a, b) => (a.cost - b.cost) || (a.cy - b.cy) || (a.cx - b.cx))[0];
    if (exit === undefined) {
      const home = nearestOpenCell(cx, cy);
      if (home === undefined) { return false; }
      const centre = cellCentre(home.cx, home.cy);
      unit.x = centre.x;
      unit.z = centre.z;
      unit.vx = 0;
      unit.vz = 0;
      cx = home.cx;
      cy = home.cy;
    } else {
      if (exit.cx !== cx) {
        unit.x = exit.cx < cx ? cellEdge(cx) - radius : cellEdge(cx + 1) + radius;
        unit.vx = exit.cx < cx ? Math.min(0, unit.vx) : Math.max(0, unit.vx);
      } else {
        unit.z = exit.cy < cy ? cellEdge(cy) - radius : cellEdge(cy + 1) + radius;
        unit.vz = exit.cy < cy ? Math.min(0, unit.vz) : Math.max(0, unit.vz);
      }
      cx = exit.cx;
      cy = exit.cy;
    }
    moved = true;
  }

  const x0 = cellEdge(cx);
  const x1 = cellEdge(cx + 1);
  const z0 = cellEdge(cy);
  const z1 = cellEdge(cy + 1);
  if (blockedAt(cx - 1, cy) && unit.x < x0 + radius) {
    unit.x = x0 + radius;
    unit.vx = Math.max(0, unit.vx);
    moved = true;
  }
  if (blockedAt(cx + 1, cy) && unit.x > x1 - radius) {
    unit.x = x1 - radius;
    unit.vx = Math.min(0, unit.vx);
    moved = true;
  }
  if (blockedAt(cx, cy - 1) && unit.z < z0 + radius) {
    unit.z = z0 + radius;
    unit.vz = Math.max(0, unit.vz);
    moved = true;
  }
  if (blockedAt(cx, cy + 1) && unit.z > z1 - radius) {
    unit.z = z1 - radius;
    unit.vz = Math.min(0, unit.vz);
    moved = true;
  }
  if (moved) { unit.speed = Math.hypot(unit.vx, unit.vz); }
  return moved;
}

function onBoard(cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < GRID && cy < GRID;
}

/** Nearest walkable tile by expanding ring, in a fixed scan order. */
function nearestOpenCell(cx: number, cy: number): { cx: number; cy: number } | undefined {
  for (let ring = 1; ring <= ESCAPE_RINGS; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) { continue; }
        if (walkable(cx + dx, cy + dy)) { return { cx: cx + dx, cy: cy + dy }; }
      }
    }
  }
  return undefined;
}

/** Is this body standing on a tile a prop claims? The invariant, testable. */
export function isInsideFootprint(unit: SimUnit): boolean {
  return blockedAt(cellIndexAt(unit.x), cellIndexAt(unit.z));
}

/**
 * Installed at module scope, exactly as `behaviours.ts` documents. The order
 * inside each phase is the order below, appended after the built-ins — so
 * `blockedFire` sees the attack `attackCycle` just started, and the clamp runs
 * last.
 */
BEHAVIOURS.push(
  seekCoverCell,
  readSightline,
  holdCover,
  avoidFootprints,
  blockedFire,
  clampToFootprints,
);
