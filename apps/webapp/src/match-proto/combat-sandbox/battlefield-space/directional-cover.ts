/**
 * THROWAWAY PROTOTYPE (#100 round 3): cover has a facing, and a body has a
 * stance.
 *
 * Supersedes the **symmetric sightline** model rounds 1 and 2 implemented by
 * default — which was never ruled, it was simply what falls out of asking
 * "is a prop on the line". Under the ruling a prop protects along a direction,
 * a shot from the side ignores it entirely, and a body is in one of three
 * states rather than two.
 *
 * ```
 *  state     from the cover direction   from the sides   can attack
 *  ducked    immune                     hittable         no
 *  peeking   hittable, but safer        hittable         yes
 *  open      fully hittable             fully hittable   yes
 * ```
 *
 * **Peek is ranged-only.** A sword has no weapon to expose, so it ducks and
 * never peeks. That is what makes the archetypes differ in their *animation
 * set* and not only in their numbers.
 *
 * ## Where the facing comes from, and what it costs to author
 *
 * `PropSpec` has no orientation field. It has `sx`/`sy`, `height` and a
 * `CoverClass` — so the honest position, reported rather than papered over:
 *
 * 1. **For a symmetric mass** — a 1x1 crate, a 5x5 foundry block — a facing is
 *    not derivable *and does not need to be*. Which face protects you is a
 *    property of where you are standing, not of the prop, and this module
 *    computes it per body at no authoring cost.
 * 2. **For an elongated prop** — a 3x1 chain fence, a 2x1 sandbag line — the
 *    long axis is real data that already exists, and taking cover behind the
 *    one-tile *end* of a three-tile fence is not a thing. `usableFaces` below
 *    restricts those props to their long faces off `sx`/`sy` alone.
 * 3. **For a genuinely one-sided prop** — a barricade with a firing step on one
 *    side only — neither works, and that is the case that needs the third
 *    field in the asset contract. Nothing in the current manifest is one, so
 *    the cost is not paid here; it is a real cost for #64 the moment such a
 *    prop is authored.
 *
 * So the schema grows a field for a class of prop we do not yet have, and the
 * ruling is implementable today on the two contracts that already exist.
 *
 * ## Numbers that are arbitrary, flagged as such
 *
 * `FLANK_COS` and the hit probabilities are **not balance proposals**. The
 * ruling fixes the *ordering* (peeking is safer than open) and leaves the
 * magnitudes out of scope; these are placeholders chosen to make the effect
 * measurable within a 20-second run.
 */

import { clamp } from "../procedural.ts";
import type { SimUnit } from "../state.ts";
import {
  blockedAt,
  bodyRadius,
  type BoardProp,
  cellIndexAt,
  type CoverBoard,
  isUsableCover,
  worldRectOf,
} from "./cover-model.ts";

/* ------------------------------------------------------------------ */
/* Stances                                                             */
/* ------------------------------------------------------------------ */

/** In the open: no prop close enough to use. Fully hittable, can attack. */
export const OPEN = 0;
/** Ducked: immune along the cover facing, hittable from the sides, cannot attack. */
export const DUCKED = 1;
/** Peeking: exposed along the cover facing but safer than open, can attack. */
export const PEEKING = 2;

/**
 * How close a body must be to a prop to use it as cover, beyond its own radius.
 *
 * Roughly half a tile. Tighter than the seek behaviour's arrival tolerance on
 * purpose: a body that is *near* cover is not *in* cover, and the gap between
 * those two is where the duck/peek read lives.
 */
export const COVER_REACH = 0.42;

/**
 * Cosine of the half-angle inside which a prop still protects.
 *
 * 0.5 is 60 degrees either side of the facing — a 120-degree protected arc, so
 * roughly a third of the circle is a flank. **Arbitrary**: the ruling makes
 * flanking mechanically real and says nothing about how wide the window is.
 */
export const FLANK_COS = 0.5;

/**
 * Chance a shot lands on a body that is peeking, versus one in the open.
 *
 * Ordered as ruled — peeking is safer — and otherwise **arbitrary**. They exist
 * so "peeking is safer" is something the run can count rather than something
 * the prototype asserts.
 */
export const PEEK_HIT = 0.45;
export const OPEN_HIT = 1;

/* ------------------------------------------------------------------ */
/* Facing                                                              */
/* ------------------------------------------------------------------ */

/** A prop face, as the outward normal of the side a body is tucked behind. */
export interface Facing {
  /** Index into `board.props`. */
  prop: number;
  nx: number;
  nz: number;
  /** Clear distance from the body to the prop's mass. */
  gap: number;
}

/**
 * May a body take cover against this face?
 *
 * Elongated props only protect along their long axis: the end of a three-tile
 * fence is an edge, not a wall. Square props protect on all four. Read off
 * `sx`/`sy`, which the manifest already carries — no new authoring.
 */
export function usableFaces(prop: BoardProp): { alongX: boolean; alongZ: boolean } {
  const sx = prop.cells.cx1 - prop.cells.cx0;
  const sy = prop.cells.cy1 - prop.cells.cy0;
  if (sx === sy) { return { alongX: true, alongZ: true }; }
  // The *normal* of the long side points across the short dimension: a 3x1
  // fence runs along x, so the faces you shelter behind are its z faces.
  return { alongX: sy > sx, alongZ: sx > sy };
}

/**
 * The prop this body is using as cover, and the direction that prop protects.
 *
 * The nearest usable prop within `COVER_REACH`, ties broken on prop index so
 * the choice is fixed by the manifest rather than by float noise. Returns
 * `undefined` for a body in the open — which is most of them, most of the time,
 * and is the point.
 */
export function coverFacingOf(board: CoverBoard, x: number, z: number, radius: number): Facing | undefined {
  const reach = radius + COVER_REACH;
  let best: Facing | undefined;
  for (let index = 0; index < board.props.length; index += 1) {
    const prop = board.props[index];
    if (prop === undefined || !isUsableCover(prop.cover)) { continue; }
    const rect = worldRectOf(prop.cells);
    const dx = x - clamp(x, rect.x0, rect.x1);
    const dz = z - clamp(z, rect.z0, rect.z1);
    const gap = Math.hypot(dx, dz);
    if (gap > reach) { continue; }
    const faces = usableFaces(prop);
    // Whichever axis the body is displaced along is the face it is behind.
    const acrossX = Math.abs(dx) >= Math.abs(dz);
    if (acrossX && !faces.alongX) { continue; }
    if (!acrossX && !faces.alongZ) { continue; }
    const nx = acrossX ? Math.sign(dx) : 0;
    const nz = acrossX ? 0 : Math.sign(dz);
    if (nx === 0 && nz === 0) { continue; }
    if (best === undefined || gap < best.gap) { best = { gap, nx, nz, prop: index }; }
  }
  return best;
}

/**
 * Does this body's cover apply to a shot arriving from `(fromX, fromZ)`?
 *
 * The flank test, and the whole mechanical content of "cover is directional".
 * A prop that happens to sit on the line still counts for nothing if the shot
 * comes in from outside its arc — which is what makes moving round the side a
 * real play rather than flavour.
 */
export function shieldedFrom(
  facing: Facing,
  atX: number,
  atZ: number,
  fromX: number,
  fromZ: number,
): boolean {
  const toX = fromX - atX;
  const toZ = fromZ - atZ;
  const span = Math.hypot(toX, toZ);
  if (span < 1e-6) { return false; }
  return (facing.nx * toX + facing.nz * toZ) / span >= FLANK_COS;
}

/* ------------------------------------------------------------------ */
/* The stance a body is in                                             */
/* ------------------------------------------------------------------ */

/**
 * Steps before a shot is ready at which a shooter comes up.
 *
 * This is the **transient** reading of peek — duck, come up, fire, duck — as
 * opposed to holding the peek for a whole engagement. Both are consistent with
 * the ruling and choosing between them is explicitly *not* this round's call.
 * Transient is built here because it is the crudest thing that makes the
 * purchase countable: `peekSteps` below is literally "exposure bought in order
 * to shoot", and under a held peek that number would just be "time engaged".
 *
 * **Stand-in. Say so wherever this is shown.**
 */
export const PEEK_LEAD = 12;

/**
 * The stance a body should be in this step.
 *
 * Melee never peeks — no weapon to expose — so a sword in cover with its target
 * out of reach ducks, and once it is in reach it is in the open and fighting.
 * That is the same breakout beat the covered approach already has: cover is a
 * route, and arriving means leaving it.
 */
export function stanceFor(
  unit: SimUnit,
  facing: Facing | undefined,
  canPeek: boolean,
  inReach: boolean,
): number {
  if (facing === undefined) { return OPEN; }
  // A body with a strike already in flight is **committed**. Without this a
  // unit can open an attack in the open, drift into cover, and be drawn ducked
  // mid-swing — which breaks the invariant the ruling actually cares about
  // ("ducked means cannot attack") and reads as a body fighting from a crouch
  // it never adopted. A shooter resolves this by peeking, which it is doing
  // anyway; melee simply stays up.
  if (unit.attackStep >= 0) { return canPeek ? PEEKING : OPEN; }
  if (!canPeek) {
    // Melee. In contact it has broken out: ducking there would freeze the fight
    // and would be a lie about what the picture shows. **Only melee** gets this
    // rule — for a shooter, "target in reach" is the engaged state cover exists
    // for, and applying breakout to it put every shooter in the open the moment
    // it had a shot, which is the opposite of the model.
    return inReach ? OPEN : DUCKED;
  }
  const readying = unit.attackStep >= 0 || unit.cooldownSteps <= PEEK_LEAD;
  return readying ? PEEKING : DUCKED;
}

/** Is this body standing where a prop could shelter it at all? */
export function inCoverAt(board: CoverBoard, unit: SimUnit): boolean {
  return coverFacingOf(board, unit.x, unit.z, bodyRadius(unit.tier)) !== undefined;
}

/** Is the tile a body stands on adjacent to any blocked tile? Cheap pre-filter. */
export function besideAProp(board: CoverBoard, x: number, z: number): boolean {
  const cx = cellIndexAt(x);
  const cy = cellIndexAt(z);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (blockedAt(board, cx + dx, cy + dy)) { return true; }
    }
  }
  return false;
}
