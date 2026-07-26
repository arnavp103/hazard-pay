/**
 * THROWAWAY SCAFFOLDING (#96).
 *
 * # EXTENSION POINT 1 of 3 — add a new animation state
 *
 * The animation vocabulary this sandbox inherits is `idle`, `attack` and
 * `turn` (plus walk/march), and #95 records that as the whole vocabulary any
 * bake-off lane has. `idle` and `walk` are not entries here: they are the
 * always-on cycle layer in `animator.ts`, blended by *speed*, so they are a
 * continuum rather than a state. Everything **discrete** — a strike, a death,
 * a stagger, a cheer, a revive — is a state, and lives in `ANIMATION_STATES`.
 *
 * A state is a pose contribution plus a claim on the body:
 *
 *   active(unit)   is this state running? Read `SimUnit` fields only.
 *   priority       highest matching state wins. One state at a time.
 *   apply(ctx)     add joint rotations, dip, lunge and squash. Additive on top
 *                  of the cycle and the authored base, exactly like a layer.
 *   suppresses     layers this state switches off while it owns the body. A
 *                  death state wants `["aim", "cycle", "ik", "lean"]`; the
 *                  built-in attack wants none of that, it wants to blend.
 *   aimLambda      how fast the aim layer tracks while this state runs. The
 *                  attack snaps (16) because a strike commits; the default is
 *                  a lazy 7.
 *
 * ## To add one (this is the whole procedure)
 *
 *   1. add a field to `SimUnit` in `state.ts` if the state needs one — e.g.
 *      `deathStep: number`, `-1` when not dying, else a step counter. Use an
 *      integer step count, never accumulated seconds;
 *   2. drive that field from an `act` behaviour in `behaviours.ts`
 *      (EXTENSION POINT 3), so it is part of the deterministic sim and not a
 *      renderer-side guess;
 *   3. add an `AnimationState` to `ANIMATION_STATES` below that reads it.
 *
 * Steps 1 and 2 are what keeps a new state reproducible from `(seed, options,
 * seconds)` — a state driven from renderer-local time is invisible to
 * `battleAt` and will not survive a capture.
 *
 * ## What this lane cannot do, and you should know before you try
 *
 * PR #90's round-4 retro concedes it plainly: *"two contact poses is the point
 * at which the procedural layers stop being able to fake an animator."* A
 * state that needs specific contact timing wants authored keys in
 * `authored.ts`, not more sine waves here.
 *
 * Nothing here is an art-direction commitment. See `README.md`.
 */

import type { AuthoredMode, ClipName, JointName, Pose } from "./authored.ts";
import { attackPhaseOf } from "./behaviours.ts";
import type { UnitRig } from "./figure.ts";
import { clamp, type Triple } from "./procedural.ts";
import type { SimUnit } from "./state.ts";

/** Procedural layers a state may switch off while it owns the body. */
export type SuppressibleLayer = "aim" | "cycle" | "ik" | "lean" | "react";

export interface AnimationStateContext {
  unit: SimUnit;
  rig: UnitRig;
  /** Sim time in seconds — the same clock `battleAt` indexes. */
  t: number;
  dt: number;
  /**
   * How the authored-key ladder is combining this frame. `"off"` is the
   * zero-key rung, where a state must supply its own procedural envelope.
   */
  authored: AuthoredMode;
  /** Adds a rotation delta, radians, to a joint. */
  addRotation: (joint: JointName, delta: Triple) => void;
  /** Positive lowers the root. */
  addDip: (amount: number) => void;
  /** Root travel along the facing. */
  addLunge: (amount: number) => void;
  /** Vertical squash; below 1 squashes and XZ compensates. */
  setSquash: (factor: number) => void;
  /** Samples an authored clip at normalised time `u`, at the current rung. */
  sample: (clip: ClipName, u: number) => Pose;
}

export interface AnimationState {
  readonly name: string;
  readonly doc: string;
  /** Highest matching state wins. Built-ins sit at 10; leave room either side. */
  readonly priority: number;
  readonly suppresses?: readonly SuppressibleLayer[];
  /** Aim-layer tracking rate while active. Default 7. */
  readonly aimLambda?: number;
  active: (unit: SimUnit) => boolean;
  apply: (ctx: AnimationStateContext) => void;
}

/**
 * The strike. Authored coil / strike / impact / recover when keys exist,
 * windowed in and out over 0.12 of the clip so it never pops; a pure
 * procedural envelope at the zero-key rung, which is the control the whole
 * authored-base ladder is measured against.
 */
export const attackState: AnimationState = {
  active: (unit) => unit.attackStep >= 0,
  aimLambda: 16,
  apply(ctx) {
    const phase = clamp(attackPhaseOf(ctx.unit), 0, 1);
    if (ctx.authored === "off") {
      const hit = Math.sin(clamp((phase - 0.12) / 0.4, 0, 1) * Math.PI);
      const coil = Math.sin(clamp(phase / 0.34, 0, 1) * Math.PI);
      ctx.addRotation("shoulderR", [0.7 * coil - 1.7 * hit, 0, 0]);
      ctx.addRotation("elbowR", [0.3 * hit, 0, 0]);
      ctx.addRotation("torso", [0.2 * hit, 0.4 * coil - 0.7 * hit, 0]);
      ctx.addLunge(0.3 * hit);
      return;
    }
    const pose = ctx.sample("attack", phase);
    const window = Math.min(1, Math.min(phase, 1 - phase) / 0.12);
    for (const name of Object.keys(pose.rot) as JointName[]) {
      const rot = pose.rot[name];
      if (rot === undefined) { continue; }
      ctx.addRotation(name, [rot[0] * window, rot[1] * window, rot[2] * window]);
    }
    ctx.addDip(pose.dip * window);
    ctx.addLunge(pose.lunge * window);
    ctx.setSquash(1 + (pose.squash - 1) * window);
  },
  doc: "authored coil/strike/impact/recover, windowed; procedural at rung none",
  name: "attack",
  priority: 10,
};

/**
 * The registry. **Add a state here.**
 *
 * Mutable on purpose, same as `BEHAVIOURS`: push at module scope, not per
 * frame. Order does not matter; `priority` does.
 */
export const ANIMATION_STATES: AnimationState[] = [attackState];

/** The state that owns the body this frame, or undefined for the cycle layer. */
export function activeState(unit: SimUnit): AnimationState | undefined {
  let winner: AnimationState | undefined;
  for (const state of ANIMATION_STATES) {
    if (!state.active(unit)) { continue; }
    if (winner === undefined || state.priority > winner.priority) { winner = state; }
  }
  return winner;
}

export function suppresses(
  state: AnimationState | undefined,
  layer: SuppressibleLayer,
): boolean {
  return state?.suppresses?.includes(layer) ?? false;
}
