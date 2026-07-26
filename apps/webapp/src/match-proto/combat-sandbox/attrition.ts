/**
 * THROWAWAY SCAFFOLDING (#101): units dying and leaving the field.
 *
 * An **opt-in layer** over the sandbox. With no treatment installed the fight
 * is the one the sandbox shipped with, step for step; every treatment here is
 * selected by `?death=<name>` and installed into the two registries
 * (`BEHAVIOURS`, `ANIMATION_STATES`) through `installAttrition`.
 *
 * ## What this module is NOT
 *
 * **It is not a damage model.** HP, damage formulas, lethality and balance are
 * explicitly out of scope on map #95. `hp` here is a *prototype stand-in*: a
 * hit stamp costs 1, fodder start at 3, heroes at 6, chosen because it is the
 * crudest rule that produces a believable attrition curve — and because it is
 * the rule #97's research measured its death numbers against, so the pictures
 * this produces and the percentages that ticket quotes describe the same
 * fight. Do not read a balance decision out of it.
 *
 * It is also not a ruling on any of this. #101 is a HITL prototype: it builds
 * the variants and asks. See `README.md`.
 *
 * ## The one decision, not two
 *
 * #97 measured that target commitment and corpse persistence are a single
 * choice. Committing to a target takes "wind up at A, land the blow on B" from
 * 12.4 % of attacks to 0 %, but takes "still aimed at a corpse" from 5.3 % to
 * 13.7 % of unit-frames. Tighter commitment means more units visibly finishing
 * a swing at something already dead — which reads as *follow-through* if a body
 * is still there and as *whiffing at air* if it is not. So every treatment
 * below carries both halves: how long the body lingers (`lingerSteps`) and what
 * the renderer does with it (`corpse`), and the commitment rule is installed
 * with them rather than separately. `?commit=0` ablates it, which is how the
 * gallery shows the 12.4 % problem rather than asserting it.
 *
 * ## Treatments
 *
 *   none      the control. Nothing dies. As shipped.
 *   downed    a body stays for the whole fight; crowd density holds.
 *   fade      the body dissolves out over 1.6 s and is spliced.
 *   debris    the body collapses, settles flat, darkens, and stays as debris.
 *   removed   spliced the step it dies. No exit state at all — the pop.
 *   ranks     removed, plus gaps close forward: the unit behind takes a dead
 *             front-ranker's slot and an emptied rear rank is dropped, so the
 *             block narrows and shallows instead of going sparse. #97's
 *             candidate answer to "can you see who is winning" without a HUD.
 *
 * ## Determinism
 *
 * Every behaviour here obeys the rules at the top of `behaviours.ts`: no
 * `Math.random`, no wall clock, step indices never seconds, all state on
 * plain-number `SimUnit` fields, and every sort is total-ordered with a unit-id
 * tiebreak. `attrition.test.ts` asserts `battleAt(a + b) === advance(battleAt(a), b)`
 * under each treatment, including across a JSON round trip.
 */

import {
  type AnimationState,
  ANIMATION_STATES,
  type AnimationStateContext,
} from "./animation-states.ts";
import { type Behaviour, BEHAVIOURS, FIXED_STEP } from "./behaviours.ts";
import { clamp } from "./procedural.ts";
import type { SimState, SimUnit } from "./state.ts";
import type { Side, Tier } from "./units.ts";

// --- The prototype stand-in ------------------------------------------------

/** Hit stamps a fodder body survives. PROTOTYPE STAND-IN — see the header. */
export const FODDER_HP = 3;
/** Hit stamps a hero survives. PROTOTYPE STAND-IN — see the header. */
export const HERO_HP = 6;

/** Starting hit stamps for a tier. Called once, from `makeUnit`. */
export function startingHp(tier: Tier): number {
  return tier === "hero" ? HERO_HP : FODDER_HP;
}

/** Alive-or-not, in one place, because a dozen call sites ask. */
export function isDead(unit: SimUnit): boolean {
  return unit.deathStep >= 0;
}

/** Steps since a unit died. `Infinity` for the living, so comparisons read right. */
export function deathAge(unit: SimUnit, step: number): number {
  return unit.deathStep < 0 ? Infinity : step - unit.deathStep;
}

// --- Timings ---------------------------------------------------------------

/** The fall. 0.55 s — long enough to read at 28 px, short enough not to lie. */
export const COLLAPSE_STEPS = 33;
/** Debris settle after the fall: the heap flattens over a further second. */
export const SETTLE_STEPS = 60;
/**
 * How long a fading body takes to go. Deliberately longer than the 0.7 s of
 * attack recovery that follows a release, so a committed attacker's
 * follow-through still lands on a visible body — the #97 coupling, in a number.
 */
export const FADE_STEPS = 96;

/** A challenger must be this much closer than the incumbent to steal a target. */
export const COMMIT_RATIO = 0.75;
const COMMIT_RATIO_SQUARED = COMMIT_RATIO * COMMIT_RATIO;

// --- Formation geometry ----------------------------------------------------
//
// Duplicated from `createBattle`'s private layout constants rather than
// exported from `sim.ts`, because `sim.ts` imports this module for
// `startingHp` and the cycle is not worth the two unit vectors. If the layout
// axes ever move, they move in both places.

/** Ground axis the lines advance along: screen-vertical under the 2:1 camera. */
const APPROACH_X = Math.SQRT1_2;
const APPROACH_Z = Math.SQRT1_2;
/** Ground axis the ranks spread along: screen-horizontal, uncompressed. */
const RANK_X = Math.SQRT1_2;
const RANK_Z = -Math.SQRT1_2;
/** Matches `createBattle`'s default `spacing`. */
const SLOT_SPACING = 1.42;
/** Matches `createBattle`'s rank depth offset. */
const RANK_GAP = 1.55;
/**
 * Survivors below this fit in one rank, so the rear rank is dropped —
 * Bannerlord's `Shorten()`. It is the starting file count of the default
 * 20-a-side roster (`ceil(20 / 2)`).
 */
const SHALLOW_AT = 10;
/** Slot pull while the unit is in reach of its target: it fights, it does not march. */
const SLOT_WEIGHT_ENGAGED = 0.15;
/** Slot pull while disengaged: this is what steps a rear-ranker into a gap. */
const SLOT_WEIGHT_FREE = 0.9;

function acrossOf(unit: SimUnit): number {
  return unit.x * RANK_X + unit.z * RANK_Z;
}

function depthOf(unit: SimUnit): number {
  return unit.x * APPROACH_X + unit.z * APPROACH_Z;
}

// --- Treatments ------------------------------------------------------------

export type AttritionName = "debris" | "downed" | "fade" | "none" | "ranks" | "removed";

/** How the renderer presents a body. `attrition-render.ts` reads this. */
export type CorpsePresentation = "debris" | "fade" | "none" | "prone";

export interface AttritionTreatment {
  readonly name: AttritionName;
  readonly doc: string;
  /** Steps a body stays in `state.units` after death. `Infinity` = for good. */
  readonly lingerSteps: number;
  /** Close gaps forward: survivors re-slot into a narrower, shallower block. */
  readonly closeRanks: boolean;
  readonly corpse: CorpsePresentation;
  /**
   * The animation states this treatment obliges, named. This is the art bill:
   * every entry is a pose an authored or baked lane pays for per facing, and
   * that the procedural lane gets for the cost of a function. Read it next to
   * the gallery — that pairing is the whole point of #101.
   */
  readonly bill: readonly string[];
}

export const ATTRITION_TREATMENTS: Record<AttritionName, AttritionTreatment> = {
  debris: {
    bill: ["death-fall (transient)", "prone (held)", "debris-settle (transient)"],
    closeRanks: false,
    corpse: "debris",
    doc: "collapse, settle flat, darken, stay as debris for the whole fight",
    lingerSteps: Infinity,
    name: "debris",
  },
  downed: {
    bill: ["death-fall (transient)", "prone (held)"],
    closeRanks: false,
    corpse: "prone",
    doc: "a body falls and stays; crowd density holds for the whole fight",
    lingerSteps: Infinity,
    name: "downed",
  },
  fade: {
    bill: ["death-fall (transient)", "prone (held)", "+ alpha dissolve (shader, no frames)"],
    closeRanks: false,
    corpse: "fade",
    doc: "a body falls, holds through the follow-through, then dissolves out",
    lingerSteps: FADE_STEPS,
    name: "fade",
  },
  none: {
    bill: [],
    closeRanks: false,
    corpse: "none",
    doc: "the control: nothing dies, hits are reaction stamps only",
    lingerSteps: Infinity,
    name: "none",
  },
  ranks: {
    bill: ["(none new)", "+ stable slot reassignment in the sim"],
    closeRanks: true,
    corpse: "none",
    doc: "removed, and the block closes gaps forward — narrows and shallows",
    lingerSteps: 0,
    name: "ranks",
  },
  removed: {
    bill: ["(none — the body pops)"],
    closeRanks: false,
    corpse: "none",
    doc: "spliced the step it dies. No exit pose at all",
    lingerSteps: 0,
    name: "removed",
  },
};

export const ATTRITION_NAMES = Object.keys(ATTRITION_TREATMENTS) as AttritionName[];

export function treatmentOf(name: string | null | undefined): AttritionTreatment {
  return name !== null && name !== undefined && ATTRITION_NAMES.includes(name as AttritionName)
    ? ATTRITION_TREATMENTS[name as AttritionName]
    : ATTRITION_TREATMENTS.none;
}

// --- Behaviours ------------------------------------------------------------

/**
 * Targeting with commitment — #97's measured fix for the 12.4 % of attacks
 * that wind up at one enemy and land on another once deaths exist.
 *
 * Three rules, in the order they fire:
 *   1. a corpse holds no target;
 *   2. **never switch mid-swing** — this is the one that takes mid-swing flips
 *      to exactly 0 %;
 *   3. otherwise keep the incumbent unless a challenger is `COMMIT_RATIO`
 *      closer, and drop a target that has died.
 *
 * Replaces `nearestEnemy` in place, so the acquire phase keeps its position.
 */
export const commitTarget: Behaviour = {
  doc: "hold the current target unless it dies or a challenger is 25% closer",
  name: "commitTarget",
  phase: "acquire",
  step(unit, ctx) {
    if (isDead(unit)) {
      unit.targetId = -1;
      return;
    }
    // Mid-swing lock. A strike commits; the aim layer already snaps at 16.
    if (unit.attackStep >= 0) { return; }

    let best = -1;
    let bestDistance = Infinity;
    for (const other of ctx.order) {
      if (other.side === unit.side || isDead(other)) { continue; }
      const distance = (other.x - unit.x) ** 2 + (other.z - unit.z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = other.id;
      }
    }

    const incumbent = ctx.target;
    if (incumbent === undefined || isDead(incumbent)) {
      unit.targetId = best;
      return;
    }
    const held = (incumbent.x - unit.x) ** 2 + (incumbent.z - unit.z) ** 2;
    if (best >= 0 && bestDistance < held * COMMIT_RATIO_SQUARED) { unit.targetId = best; }
  },
};

/**
 * The shipped `nearestEnemy`, taught only that corpses are not enemies.
 *
 * It exists so `?commit=0` ablates **commitment alone**. The built-in has no
 * concept of alive at all, so left in place with persistent bodies it walks
 * whole ranks over to swing at the dead — a true finding about the shipped
 * targeting, but one that swamps the comparison #97 asks for. Keep the
 * variable to one.
 */
export const nearestLivingEnemy: Behaviour = {
  doc: "target the closest living enemy, re-chosen every retarget step",
  name: "nearestLivingEnemy",
  phase: "acquire",
  step(unit, ctx) {
    if (isDead(unit)) {
      unit.targetId = -1;
      return;
    }
    let best = -1;
    let bestDistance = Infinity;
    for (const other of ctx.order) {
      if (other.side === unit.side || isDead(other)) { continue; }
      const distance = (other.x - unit.x) ** 2 + (other.z - unit.z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = other.id;
      }
    }
    unit.targetId = best;
  },
};

/**
 * `seekStandoff` with a corpse rule. Identical arithmetic while the target
 * lives; against a dead one the unit **holds its aim and stops closing**,
 * which is what makes the follow-through read as follow-through instead of a
 * unit walking into a body. Replaces `seekStandoff` in place.
 */
export const engageStandoff: Behaviour = {
  doc: "approach a living target to standoff; hold aim, do not close, on a corpse",
  name: "engageStandoff",
  phase: "steer",
  step(unit, ctx) {
    const target = ctx.target;
    if (target === undefined) { return; }
    unit.aimX = target.x;
    unit.aimZ = target.z;
    unit.aimY = target.tier === "hero" ? 1.25 : 1;
    if (isDead(target) || isDead(unit)) { return; }
    const dx = target.x - unit.x;
    const dz = target.z - unit.z;
    const distance = Math.hypot(dx, dz) || 1e-4;
    const gap = distance - ctx.profile.standoff;
    const drive = clamp(gap * 1.6, -0.8, 1);
    ctx.desiredVx += (dx / distance) * drive * ctx.profile.maxSpeed;
    ctx.desiredVz += (dz / distance) * drive * ctx.profile.maxSpeed;
  },
};

/**
 * A body does not steer. Appended **last** in the steer phase so it overrides
 * every contribution above it, including the separation push the living exert
 * on it — otherwise corpses slide around the field like furniture.
 */
export const corpseFreeze: Behaviour = {
  doc: "a corpse contributes no desired velocity, whatever pushed at it",
  name: "corpseFreeze",
  phase: "steer",
  step(unit, ctx) {
    if (!isDead(unit)) { return; }
    ctx.desiredVx = 0;
    ctx.desiredVz = 0;
  },
};

/**
 * Turns the sandbox's reaction stamps into attrition.
 *
 * `hitAtStep > damagedStep` rather than `hitAtStep === state.step`, because
 * units act in ascending id order: an attacker with a higher id stamps its
 * victim after the victim's own `act` has already run. Comparing against the
 * last *consumed* stamp makes the result independent of who acted first, which
 * is the same property the double-buffered steer pass buys.
 */
export const resolveDamage: Behaviour = {
  doc: "convert hit stamps into hp, and mark the step a unit died on",
  name: "resolveDamage",
  phase: "act",
  step(unit, ctx) {
    if (isDead(unit)) { return; }
    if (unit.hitAtStep > unit.damagedStep) {
      unit.hp -= 1;
      unit.damagedStep = unit.hitAtStep;
    }
    if (unit.hp > 0) { return; }
    unit.deathStep = ctx.state.step;
    unit.attackStep = -1;
    unit.targetId = -1;
    unit.vx = 0;
    unit.vz = 0;
    unit.ax = 0;
    unit.az = 0;
    // Freeze the gaze at the moment of death. The integrator turns a planted
    // unit toward its aim point, so without this a corpse slowly pirouettes to
    // face whatever killed it.
    unit.aimX = unit.x + Math.sin(unit.facing) * 2;
    unit.aimZ = unit.z + Math.cos(unit.facing) * 2;
  },
};

/**
 * Splices expired bodies out of the roster. Runs once per step, on the last
 * unit in id order, so every death resolved this step is visible to it —
 * `lingerSteps: 0` therefore means "gone on the step it died", not one late.
 *
 * Removal is safe by construction: `stepBattle` iterates a sorted copy and the
 * renderer keys rigs by unit id, so a hole in the roster is not a hole in
 * anyone's turn order (`extension-points.test.ts` locks that).
 */
function reaper(lingerSteps: number): Behaviour {
  return {
    doc: `splice a body out ${lingerSteps} steps after it dies`,
    name: "reapCorpses",
    phase: "act",
    step(unit, ctx) {
      const last = ctx.order[ctx.order.length - 1];
      if (last === undefined || unit.id !== last.id) { return; }
      if (!Number.isFinite(lingerSteps)) { return; }
      const units = ctx.state.units;
      for (let i = units.length - 1; i >= 0; i -= 1) {
        const body = units[i];
        if (body === undefined || !isDead(body)) { continue; }
        if (ctx.state.step - body.deathStep >= lingerSteps) { units.splice(i, 1); }
      }
    },
  };
}

/**
 * Close gaps forward — Bannerlord's `FillInTheGapsOfFileAux` plus `Shorten()`,
 * reduced to the part that is visible at 28 px.
 *
 * Every retarget step (0.45 s — the same throttle Company of Heroes uses for
 * repathing, and the cadence the sandbox already retargets on) the survivors of
 * each side are laid back into a block:
 *
 *   - **files** are assigned in left-to-right order of current lateral
 *     position, id-tiebroken, so nobody teleports across the block. Stable
 *     reassignment is the whole point: CoH keeps swaps minimal because "it
 *     looks awkward when a soldier randomly runs from the left side of a squad
 *     to the right".
 *   - within a file, **ranks** are assigned by depth, so the man behind a dead
 *     front-ranker inherits the front slot.
 *   - the block is `ceil(n / ranks)` files wide, and drops to a single rank
 *     once the survivors fit in one. So it **narrows and shallows** as
 *     casualties mount rather than going sparse.
 *
 * It writes `slotX` / `slotZ` only; the pull itself is `holdSlot`, so the
 * assignment cost is paid at 2.2 Hz and the steering runs every step.
 */
export const formationSlots: Behaviour = {
  doc: "re-slot each side's survivors into a narrower, shallower block",
  name: "formationSlots",
  phase: "acquire",
  step(unit, ctx) {
    const first = ctx.order[0];
    if (first === undefined || unit.id !== first.id) { return; }
    for (const side of [0, 1] as Side[]) { reslot(ctx.state, side); }
  },
};

function reslot(state: SimState, side: Side): void {
  const living = state.units.filter((unit) => unit.side === side && !isDead(unit));
  const count = living.length;
  if (count === 0) { return; }
  const sign = side === 0 ? 1 : -1;
  const ranks = count > SHALLOW_AT ? 2 : 1;
  const files = Math.ceil(count / ranks);

  const sorted = [...living].sort((a, b) => acrossOf(a) - acrossOf(b) || a.id - b.id);
  const columns: SimUnit[][] = Array.from({ length: files }, () => []);
  for (let i = 0; i < count; i += 1) {
    const unit = sorted[i];
    const column = columns[Math.floor((i * files) / count)];
    if (unit !== undefined && column !== undefined) { column.push(unit); }
  }

  // The block centres on where the side actually is, so it advances with the
  // fight instead of dragging everyone back to a fixed start line.
  const meanDepth = living.reduce((sum, u) => sum + depthOf(u), 0) / count;
  const frontDepth = meanDepth - sign * ((ranks - 1) / 2) * RANK_GAP;

  for (let file = 0; file < files; file += 1) {
    const column = columns[file];
    if (column === undefined) { continue; }
    column.sort((a, b) => (depthOf(a) - depthOf(b)) * sign || a.id - b.id);
    const across = (file - (files - 1) / 2) * SLOT_SPACING;
    for (let rank = 0; rank < column.length; rank += 1) {
      const unit = column[rank];
      if (unit === undefined) { continue; }
      const depth = frontDepth + sign * rank * RANK_GAP;
      unit.slotX = APPROACH_X * depth + RANK_X * across;
      unit.slotZ = APPROACH_Z * depth + RANK_Z * across;
    }
  }
}

/**
 * The second level of the two-level model: steering back toward the assigned
 * slot. Weak while the unit is in reach of its target (it fights, it does not
 * march) and strong while it is not — which is exactly the rear-ranker whose
 * slot just moved forward into a dead man's place.
 */
export const holdSlot: Behaviour = {
  doc: "steer toward the assigned formation slot, weakly while engaged",
  name: "holdSlot",
  phase: "steer",
  step(unit, ctx) {
    if (isDead(unit)) { return; }
    const dx = unit.slotX - unit.x;
    const dz = unit.slotZ - unit.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.05) { return; }
    const target = ctx.target;
    const engaged = target !== undefined
      && !isDead(target)
      && Math.hypot(target.x - unit.x, target.z - unit.z) <= ctx.profile.attackRange * 1.15;
    const weight = engaged ? SLOT_WEIGHT_ENGAGED : SLOT_WEIGHT_FREE;
    const drive = clamp(distance * 1.4, 0, 1) * weight * ctx.profile.maxSpeed;
    ctx.desiredVx += (dx / distance) * drive;
    ctx.desiredVz += (dz / distance) * drive;
  },
};

// --- Animation states ------------------------------------------------------

function easeOut(k: number): number {
  return 1 - (1 - k) ** 3;
}

/** 0..1 through the fall; 1 once the body is down. */
function collapsePhase(ctx: AnimationStateContext): number {
  const age = ctx.t - ctx.unit.deathStep * FIXED_STEP;
  return easeOut(clamp(age / (COLLAPSE_STEPS * FIXED_STEP), 0, 1));
}

/**
 * The fall, and the prone hold it settles into — one state, two poses' worth
 * of bill. The root pitches about the feet, which is what topples a standing
 * figure, and the knees and torso fold so it lands as a crumple rather than a
 * plank. It suppresses the whole procedural stack (`aim`, `cycle`, `ik`,
 * `lean`, `react`): a corpse does not breathe, track, grip or flinch, and a
 * body that keeps flinching when the swing that killed it follows through is
 * the single most obvious tell that nothing has actually died.
 */
export const deathFall: AnimationState = {
  active: isDead,
  aimLambda: 0,
  apply(ctx) {
    const k = collapsePhase(ctx);
    ctx.addRotation("kneeL", [-1.15 * k, 0, 0]);
    ctx.addRotation("kneeR", [-0.86 * k, 0, 0]);
    ctx.addRotation("hipL", [0.52 * k, 0, 0.14 * k]);
    ctx.addRotation("hipR", [0.34 * k, 0, -0.1 * k]);
    ctx.addRotation("pelvis", [-0.18 * k, 0, 0]);
    ctx.addRotation("torso", [0.46 * k, 0.12 * k, 0.22 * k]);
    ctx.addRotation("head", [0.34 * k, 0, 0.18 * k]);
    ctx.addRotation("shoulderL", [0.62 * k, 0, 0.44 * k]);
    ctx.addRotation("shoulderR", [0.48 * k, 0, -0.5 * k]);
    ctx.addRotation("elbowL", [-0.55 * k, 0, 0]);
    ctx.addRotation("elbowR", [-0.42 * k, 0, 0]);
    ctx.addTilt(1.42 * k, 0.16 * k);
    ctx.addDip(0.05 * k);
  },
  doc: "topple about the feet and fold; holds prone once down",
  name: "deathFall",
  priority: 40,
  suppresses: ["aim", "cycle", "ik", "lean", "react"],
};

/**
 * The fall, then a further settle: the heap compacts toward a low mound over a
 * second. It is the third pose on the debris bill, and it is what stops a
 * persistent body from reading as a *sleeping* body — a flattened silhouette
 * competes far less with the living for attention on a fixed camera.
 */
export const deathDebris: AnimationState = {
  active: isDead,
  aimLambda: 0,
  apply(ctx) {
    deathFall.apply(ctx);
    const age = ctx.t - ctx.unit.deathStep * FIXED_STEP - COLLAPSE_STEPS * FIXED_STEP;
    const settle = easeOut(clamp(age / (SETTLE_STEPS * FIXED_STEP), 0, 1));
    ctx.addRotation("kneeL", [-0.5 * settle, 0, 0]);
    ctx.addRotation("kneeR", [-0.44 * settle, 0, 0]);
    ctx.addRotation("torso", [0.2 * settle, 0, 0]);
    ctx.addTilt(0.1 * settle, 0.06 * settle);
    ctx.setSquash(1 - 0.34 * settle);
  },
  doc: "the fall, then compacts toward a flat mound over a further second",
  name: "deathDebris",
  priority: 41,
  suppresses: ["aim", "cycle", "ik", "lean", "react"],
};

// --- Install ---------------------------------------------------------------

export interface AttritionOptions {
  /**
   * Install the commitment rule. Default true. `false` keeps the shipped
   * nearest-enemy-every-0.45 s targeting, which is how the gallery shows the
   * mid-swing flip #97 measured rather than asserting it.
   */
  commit?: boolean;
}

function replace(list: Behaviour[], name: string, replacement: Behaviour): void {
  const at = list.findIndex((entry) => entry.name === name);
  if (at < 0) {
    list.push(replacement);
    return;
  }
  list.splice(at, 1, replacement);
}

/**
 * Install a treatment into the two shared registries and return the undo.
 *
 * Call it **once**, at mount, before the battle takes a step — a battle that
 * changes its own pipeline mid-run is not reproducible from `(seed, options)`.
 * The undo restores whatever was in the registries beforehand, so a test (or a
 * remount) does not leak a treatment into the next one.
 */
export function installAttrition(
  treatment: AttritionTreatment,
  options: AttritionOptions = {},
): () => void {
  const behaviours = [...BEHAVIOURS];
  const states = [...ANIMATION_STATES];
  const restore = (): void => {
    BEHAVIOURS.splice(0, BEHAVIOURS.length, ...behaviours);
    ANIMATION_STATES.splice(0, ANIMATION_STATES.length, ...states);
  };
  if (treatment.name === "none") { return restore; }

  replace(BEHAVIOURS, "nearestEnemy", options.commit === false ? nearestLivingEnemy : commitTarget);
  replace(BEHAVIOURS, "seekStandoff", engageStandoff);
  if (treatment.closeRanks) {
    BEHAVIOURS.unshift(formationSlots);
    BEHAVIOURS.push(holdSlot);
  }
  // Last in the steer phase, so it wins over separation and slot pull alike.
  BEHAVIOURS.push(corpseFreeze);
  BEHAVIOURS.push(resolveDamage);
  BEHAVIOURS.push(reaper(treatment.lingerSteps));

  if (treatment.corpse === "debris") {
    ANIMATION_STATES.push(deathDebris);
  } else if (treatment.corpse === "fade" || treatment.corpse === "prone") {
    ANIMATION_STATES.push(deathFall);
  }
  return restore;
}
