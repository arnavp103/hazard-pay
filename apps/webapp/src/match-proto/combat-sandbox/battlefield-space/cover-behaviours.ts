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
 *  acquire  seekCoverCell      RANGED: the tile to fight from, on retarget steps
 *  acquire  seekApproach       MELEE:  the next tile on a covered approach
 *  steer    readSightline      how hidden is my target from me, right now
 *  steer    holdCover          walk to the chosen tile
 *  steer    followApproach     walk the approach waypoint
 *  steer    avoidFootprints    push out of prop footprints, slide along faces
 *  act      blockedFire        a shot into cover is held or degraded
 *  act      clampToFootprints  a body never ends a step inside a prop
 * ```
 *
 * ## Round 3: both archetypes want cover, for different reasons
 *
 * Rounds 1 and 2 zeroed melee's cover appetite (see `coverAppetite` below) and
 * the archetype comparison was therefore never run. Round 3 gives melee cover
 * as a **route** rather than a destination, over the *same* field a shooter
 * point-evaluates to pick a firing position. The field, the two resistance
 * vectors and the anti-clustering machinery live in `approach-field.ts`; the
 * two behaviours that spend them are `seekApproach` and `followApproach` here.
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
 * ## Round 2: the board is a parameter
 *
 * Every one of these reads its board from `state.coverDensity` rather than
 * from a module constant, so the *same* behaviours run at all three densities
 * and a difference between two runs is a difference in the board and not in
 * the AI. Not one constant below was retuned for round 2 — the appetite curve,
 * the seek range and the sweet spot are round 1's, deliberately, because
 * retuning them would have made "does the plateau survive lower density"
 * unanswerable.
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
  approachFor,
  descend,
  EXPOSED_AT,
  exposureFor,
  postureOf,
  RESISTANCES,
} from "./approach-field.ts";
import {
  besideAProp,
  coverFacingOf,
  DUCKED,
  PEEK_HIT,
  PEEKING,
  shieldedFrom,
  stanceFor,
} from "./directional-cover.ts";
import {
  blockedAt,
  bodyRadius,
  boardFor,
  cellCentre,
  cellEdge,
  cellIndexAt,
  type CoverBoard,
  coverFaceCells,
  densityAt,
  eyeHeightOf,
  isUsableCover,
  LATTICE,
  onBoard,
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
 * How badly an archetype wants a firing *position*, read off its standoff.
 *
 * Still zero for melee and the medic — but round 3 changes what that means.
 * Through rounds 1 and 2 it meant melee ignored cover entirely, which is why
 * the archetype comparison this ticket exists to run was never actually run.
 * It now means melee does not want a **destination**: it wants a *route*, and
 * that is `seekApproach` below, over the same field. Two postures, one field.
 *
 * The original reasoning for zeroing it stands and is worth keeping visible:
 * a weak pull toward the same handful of good tiles converges forty bodies on
 * those tiles and attacks fell 78 %. Round 3 does not re-introduce that pull.
 * It gives melee an appetite for *cheap ground on the way in*, which the crowd
 * term and the lane offset in `approach-field.ts` keep from stacking.
 */
function coverAppetite(standoff: number): number {
  return clamp((standoff - 2.5) / 2.5, 0, 1);
}

/**
 * World units of walking a fully-exposed tile is worth avoiding, for a shooter
 * choosing where to stand.
 *
 * This is the *point-evaluated* half of the shared field. A shooter already
 * scored posts by occlusion-to-its-target; what it could not see was whether
 * the post was in the open with respect to everyone *else*. Same numbers melee
 * integrates along a route, spent one tile at a time.
 */
const EXPOSURE_PULL = 2.4;

/** Occlusion at or above which a unit counts as standing in cover, for metrics. */
export const IN_COVER_AT = 0.3;

function isOn(ctx: BehaviourContext): boolean {
  return ctx.state.coverMode === 1;
}

/**
 * The board this battle is fighting on.
 *
 * Read off the state every step rather than captured in a module global: two
 * densities are simulated in the same process by `measure.ts`, and `boardFor`
 * memoises, so this is a `Map` lookup and not a rebuild.
 */
function boardOf(ctx: BehaviourContext): CoverBoard {
  return boardFor(densityAt(ctx.state.coverDensity));
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
    const board = boardOf(ctx);
    const height = heightOf(unit.tier);
    const threatEye = eyeHeightOf(target.tier);
    // The shared field, point-evaluated. Round 2's post score knew only about
    // the unit's own target; a post can be perfectly covered from that one body
    // and stand in the open with respect to the other nineteen.
    //
    // Gated on `approachMode` with melee's route, deliberately: the A/B in the
    // metrics table is then "round 3's field, or round 2 exactly", with no
    // third state where half the change is in. That does mean the table's
    // ranged columns move for two reasons at once — said plainly rather than
    // buried, because it is the one place the comparison is not clean.
    const seen = ctx.state.approachMode === 0
      ? undefined
      : exposureFor(board, ctx.state, unit.side).exposure;
    let bestScore = Infinity;
    let bestCell = -1;
    for (let index = 0; index < board.props.length; index += 1) {
      const prop = board.props[index];
      if (prop === undefined || !isUsableCover(prop.cover)) { continue; }
      // A slot along the prop's far face rather than one tile behind it: two
      // dozen shooters all wanting the same tile is how the first build turned
      // the fight into a queue. Slots are picked by unit id, so a barrier
      // fills along its length and stays deterministic.
      const face = coverFaceCells(board, prop, target.x, target.z);
      const post = face[unit.id % Math.max(1, face.length)];
      if (post === undefined) { continue; }
      const at = cellCentre(post.cx, post.cy);
      const walk = Math.hypot(at.x - unit.x, at.z - unit.z);
      if (walk > COVER_SEEK_RANGE) { continue; }
      // Cover a unit cannot shoot from is a hiding place, not a firing
      // position. Without this the shooters walk backwards out of the fight.
      if (Math.hypot(at.x - target.x, at.z - target.z) > ctx.profile.attackRange) { continue; }
      const sight = sightBetween(board, target.x, target.z, threatEye, at.x, at.z, height);
      if (sight.occlusion < 0.2) { continue; }
      const value = Math.max(0, 1 - Math.abs(sight.occlusion - COVER_SWEET) / COVER_SWEET);
      const cell = post.cy * LATTICE + post.cx;
      const score = walk - value * COVER_PULL + (seen?.[cell] ?? 0) * EXPOSURE_PULL;
      if (score < bestScore) {
        bestScore = score;
        bestCell = cell;
      }
    }
    unit.coverCell = bestCell;
  },
};

/**
 * Melee's half of the field: the next tile on a covered approach.
 *
 * The one thing round 3 exists to build. A shooter scores a tile; a swordsman
 * cannot, because what it wants — "get to contact without crossing the open" —
 * is a property of a *path* and only exists as a sum of edge costs. So this
 * descends the flood in `approach-field.ts` a couple of hops and stores the
 * result, and `followApproach` walks it.
 *
 * Three things keep round 1's clustering from coming back, and none of them is
 * "turn the appetite off":
 *
 *   - **crowd resistance** in the field, so a tile your own side already fills
 *     is expensive — Rain World's packmate term, which is what makes its
 *     lizards appear to flank with no formation system at all;
 *   - **lane offset** by `unit.id`, the same deterministic spreader round 1
 *     used to slot shooters along a prop's face;
 *   - **breakout**: inside `RESISTANCES.assault.breakout` the field is dropped
 *     entirely and the unit charges. Cover is a route, not a destination, and a
 *     swordsman that will not cross the last two units of open ground is not
 *     using cover, it is hiding.
 *
 * Runs on retarget steps for the same reason `seekCoverCell` does — and the
 * flood is memoised per side per step, so forty bodies pay for one.
 */
export const seekApproach: Behaviour = {
  doc: "descend the shared cost field toward contact — melee's covered approach",
  name: "seekApproach",
  phase: "acquire",
  step(unit, ctx) {
    if (!isOn(ctx) || ctx.state.approachMode === 0) {
      unit.approachCell = -1;
      return;
    }
    const posture = postureOf(ctx.profile.standoff, ctx.profile.attackRange);
    const target = targetOf(unit, ctx);
    if (posture === "firing" || target === undefined) {
      unit.approachCell = -1;
      return;
    }
    const gap = Math.hypot(target.x - unit.x, target.z - unit.z);
    // Broken out already: stop paying for cover and go.
    if (gap <= RESISTANCES[posture].breakout) {
      unit.approachCell = -1;
      return;
    }
    const board = boardOf(ctx);
    const cx = cellIndexAt(unit.x);
    const cy = cellIndexAt(unit.z);
    if (!onBoard(board, cx, cy)) {
      unit.approachCell = -1;
      return;
    }
    const approach = approachFor(board, ctx.state, unit.side);
    unit.approachCell = descend(board, approach, cy * LATTICE + cx, unit.id, APPROACH_HOPS);
  },
};

/** Tiles of lookahead per waypoint. One reads as a shuffle at 28 px. */
export const APPROACH_HOPS = 2;

/**
 * Walk the approach waypoint.
 *
 * Deliberately *added to* the built-in drive toward the target rather than
 * replacing it: a unit that only follows the field stops fighting the moment
 * the field is stale, and the sum is what produces the read the cofounder
 * described — a body angling toward the next prop while still facing the enemy.
 */
export const followApproach: Behaviour = {
  doc: "steer along the covered approach, fading out near the waypoint",
  name: "followApproach",
  phase: "steer",
  step(unit, ctx) {
    if (!isOn(ctx) || unit.approachCell < 0) { return; }
    const at = cellCentre(unit.approachCell % LATTICE, Math.floor(unit.approachCell / LATTICE));
    const dx = at.x - unit.x;
    const dz = at.z - unit.z;
    const span = Math.hypot(dx, dz);
    if (span < 0.25) { return; }
    const drive = clamp((span - 0.25) * 2.2, 0, 1) * APPROACH_DRIVE;
    ctx.desiredVx += (dx / span) * drive * ctx.profile.maxSpeed;
    ctx.desiredVz += (dz / span) * drive * ctx.profile.maxSpeed;
  },
};

/**
 * How hard the approach pulls, against the built-in drive toward the target.
 *
 * Under 1 on purpose. At 1 the field wins outright and bodies visibly detour
 * away from a target that is already in front of them; this is a lean, not a
 * command.
 */
const APPROACH_DRIVE = 0.75;

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
    const board = boardOf(ctx);
    const sight = sightBetween(
      board,
      unit.x,
      unit.z,
      eyeHeightOf(unit.tier),
      target.x,
      target.z,
      heightOf(target.tier),
    );
    unit.sightOcclusion = sight.occlusion;
    // Round 3's headline metric, counted for free rather than by re-flooding the
    // board every step. Cover here is symmetric by construction — `blockedFire`
    // reads the same number in both directions — so a clear line *out* is a
    // clear line *in*, and a step spent with one is a step spent exposed. It is
    // the same threshold the shared field uses, so the two agree.
    //
    // **Only while closing.** A body in contact is 1.1 units from its target and
    // `sightBetween` excludes the ends of the segment, so nothing can occlude a
    // line that short: counting every step would make "exposed" mean "fighting"
    // and no approach, covered or not, could ever move the number.
    if (Math.hypot(target.x - unit.x, target.z - unit.z) > ctx.profile.attackRange) {
      unit.approachSteps += 1;
      if (sight.occlusion < EXPOSED_AT) { unit.exposedSteps += 1; }
    }
    // Slide around whatever is in the way rather than grinding into it. The
    // side is the short way round, from the sign of the cross product — no
    // extra sightline evaluation and no per-unit coin to remember.
    if (sight.by >= 0 && sight.occlusion > FLANK_AT) {
      const prop = board.props[sight.by];
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
    const at = cellCentre(unit.coverCell % LATTICE, Math.floor(unit.coverCell / LATTICE));
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
    const board = boardOf(ctx);
    const margin = bodyRadius(unit.tier) + 0.14;
    const target = targetOf(unit, ctx);
    const atCx = cellIndexAt(unit.x);
    const atCy = cellIndexAt(unit.z);
    for (let cy = atCy - 1; cy <= atCy + 1; cy += 1) {
      for (let cx = atCx - 1; cx <= atCx + 1; cx += 1) {
        if (!blockedAt(board, cx, cy)) { continue; }
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
 * The stance this body is in: open, ducked, or peeking.
 *
 * The directional-cover ruling's visible half. Runs in `steer` so the value is
 * settled before `blockedFire` reads it in `act`, and before the renderer draws
 * the frame — a body that ducks reads as a *shorter silhouette*, which is the
 * channel the ruling picked precisely because it survives 22-48 px where pose
 * detail does not.
 *
 * Melee never peeks. That is the line that makes the two archetypes differ in
 * their animation *set* rather than only in their numbers.
 */
export const coverStance: Behaviour = {
  doc: "duck, peek, or stand in the open — the directional-cover stance",
  name: "coverStance",
  phase: "steer",
  step(unit, ctx) {
    if (!isOn(ctx)) { return; }
    const board = boardOf(ctx);
    const target = targetOf(unit, ctx);
    const inReach = target !== undefined
      && Math.hypot(target.x - unit.x, target.z - unit.z) <= ctx.profile.attackRange;
    // A cheap tile-adjacency pre-filter before the per-prop scan: most bodies
    // on a `spread` board are nowhere near anything, and this runs every step
    // for every unit rather than on retarget steps.
    const facing = besideAProp(board, unit.x, unit.z)
      ? coverFacingOf(board, unit.x, unit.z, bodyRadius(unit.tier))
      : undefined;
    const canPeek = postureOf(ctx.profile.standoff, ctx.profile.attackRange) === "firing";
    unit.coverState = stanceFor(unit, facing, canPeek, inReach);
    if (unit.coverState === DUCKED) { unit.duckedSteps += 1; }
    if (unit.coverState === PEEKING) { unit.peekSteps += 1; }
  },
};

/**
 * Whether this attack happens at all, under the directional model.
 *
 * Rounds 1 and 2 asked one question — "how much of my target is hidden" — and
 * rolled against it in both directions. The ruling replaces that with two
 * questions with different answers:
 *
 *   1. **Can I attack?** A ducked body cannot. It has to come up first, and
 *      coming up is what `coverStance` charges it for.
 *   2. **Is my target actually protected from *me*?** Only if my line arrives
 *      inside the arc its prop covers. From the side, its cover is worth
 *      nothing — which is what makes flanking mechanically real.
 *
 * A shot at a target that is ducked *and* shielded from this angle is held
 * rather than thrown away, keeping round 1's finding that the visible
 * consequence of cover is fewer telegraphs on screen and not more misses.
 * `flankedShots` counts the other outcome: cover that was present, and bypassed.
 */
export const blockedFire: Behaviour = {
  doc: "hold an attack the stance forbids or the target's facing defeats",
  name: "blockedFire",
  phase: "act",
  step(unit, ctx) {
    if (!isOn(ctx) || unit.attackStep !== 0) { return; }
    // 1. A ducked body has no shot to take.
    if (unit.coverState === DUCKED) {
      hold(unit);
      return;
    }
    const target = targetOf(unit, ctx);
    if (target === undefined) { return; }
    const board = boardOf(ctx);
    const facing = besideAProp(board, target.x, target.z)
      ? coverFacingOf(board, target.x, target.z, bodyRadius(target.tier))
      : undefined;
    // 2. No cover on the target at all, or the wrong side of it: the shot goes.
    if (facing === undefined || !shieldedFrom(facing, target.x, target.z, unit.x, unit.z)) {
      if (facing !== undefined) { unit.flankedShots += 1; }
      return;
    }
    if (target.coverState === DUCKED) {
      hold(unit);
      return;
    }
    // 3. Peeking: hittable from the cover direction, but safer than the open.
    //    The magnitude is arbitrary and flagged in `directional-cover.ts`.
    if (target.coverState === PEEKING && nextRandom(unit) > PEEK_HIT) {
      hold(unit);
    }
  },
};

/** Cancel the attack the cycle just started, before a frame of it is drawn. */
function hold(unit: SimUnit): void {
  unit.attackStep = -1;
  unit.cooldownSteps = HOLD_STEPS;
  unit.suppressedShots += 1;
}

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
    clampUnitOutOfProps(boardOf(ctx), unit);
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
export function clampUnitOutOfProps(board: CoverBoard, unit: SimUnit): boolean {
  const radius = bodyRadius(unit.tier);
  let cx = cellIndexAt(unit.x);
  let cy = cellIndexAt(unit.z);
  let moved = false;

  if (blockedAt(board, cx, cy)) {
    const exits: { cx: number; cy: number; cost: number }[] = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (blockedAt(board, nx, ny) || !onBoard(board, nx, ny)) { continue; }
      const edge = dx !== 0
        ? Math.abs(unit.x - cellEdge(dx < 0 ? cx : cx + 1))
        : Math.abs(unit.z - cellEdge(dy < 0 ? cy : cy + 1));
      exits.push({ cost: edge, cx: nx, cy: ny });
    }
    const exit = exits.sort((a, b) => (a.cost - b.cost) || (a.cy - b.cy) || (a.cx - b.cx))[0];
    if (exit === undefined) {
      const home = nearestOpenCell(board, cx, cy);
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
  if (blockedAt(board, cx - 1, cy) && unit.x < x0 + radius) {
    unit.x = x0 + radius;
    unit.vx = Math.max(0, unit.vx);
    moved = true;
  }
  if (blockedAt(board, cx + 1, cy) && unit.x > x1 - radius) {
    unit.x = x1 - radius;
    unit.vx = Math.min(0, unit.vx);
    moved = true;
  }
  if (blockedAt(board, cx, cy - 1) && unit.z < z0 + radius) {
    unit.z = z0 + radius;
    unit.vz = Math.max(0, unit.vz);
    moved = true;
  }
  if (blockedAt(board, cx, cy + 1) && unit.z > z1 - radius) {
    unit.z = z1 - radius;
    unit.vz = Math.min(0, unit.vz);
    moved = true;
  }
  if (moved) { unit.speed = Math.hypot(unit.vx, unit.vz); }
  return moved;
}

/** Nearest walkable tile by expanding ring, in a fixed scan order. */
function nearestOpenCell(
  board: CoverBoard,
  cx: number,
  cy: number,
): { cx: number; cy: number } | undefined {
  for (let ring = 1; ring <= ESCAPE_RINGS; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) { continue; }
        if (walkable(board, cx + dx, cy + dy)) { return { cx: cx + dx, cy: cy + dy }; }
      }
    }
  }
  return undefined;
}

/** Is this body standing on a tile a prop claims? The invariant, testable. */
export function isInsideFootprint(board: CoverBoard, unit: SimUnit): boolean {
  return blockedAt(board, cellIndexAt(unit.x), cellIndexAt(unit.z));
}

/**
 * Installed at module scope, exactly as `behaviours.ts` documents. The order
 * inside each phase is the order below, appended after the built-ins — so
 * `blockedFire` sees the attack `attackCycle` just started, and the clamp runs
 * last.
 */
BEHAVIOURS.push(
  seekCoverCell,
  seekApproach,
  readSightline,
  holdCover,
  followApproach,
  avoidFootprints,
  coverStance,
  blockedFire,
  clampToFootprints,
);
