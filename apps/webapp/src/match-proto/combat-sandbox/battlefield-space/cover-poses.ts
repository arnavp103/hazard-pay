/**
 * THROWAWAY PROTOTYPE (#100 round 3): the duck and the peek, as silhouettes.
 *
 * The directional-cover ruling picked its model on a *visibility* argument, not
 * a mechanical one: a defensive-only cover stat is real but invisible, and this
 * one is legible because **a ducked body and a peeking body differ in height**.
 * Height is the channel that survives 22-48 px where pose detail does not. So
 * these two states exist to make that claim checkable in a filmstrip rather
 * than asserted in a report.
 *
 * Two states, pushed into `ANIMATION_STATES` (extension point 1):
 *
 * ```
 *  cover-duck  priority 12  coverState === DUCKED    58 % height
 *  cover-peek  priority  9  coverState === PEEKING   84 % height
 * ```
 *
 * The priorities are the whole design. `duck` sits **above** the built-in
 * attack at 10 because a ducked body cannot attack at all — there is nothing to
 * lose a fight with. `peek` sits **below** it, so a peeking unit that actually
 * releases a shot plays the attack at full height. The read that falls out is
 * the one the ruling describes: short bodies tucked against props, standing up
 * to fire, dropping again.
 *
 * ## What this is not
 *
 * **Not an animation proposal.** Whether peek is a transient rhythm or a held
 * posture is an open question for the cofounder and is not settled here; this
 * is the transient reading because it is the crudest thing that makes the
 * exposure countable (see `PEEK_LEAD` in `directional-cover.ts`). The numbers
 * below are silhouette heights chosen to be distinguishable at 28 px, not an
 * authored pose. #103 owns the real clips.
 *
 * `setSquash` rather than `addDip` on purpose: squash scales root Y about the
 * ground plane, so the feet stay planted and XZ widens to compensate — the body
 * reads as *compacted*, which is a crouch. `addDip` translates the root down,
 * which sinks the feet through the floor.
 */

import { type AnimationState, ANIMATION_STATES } from "../animation-states.ts";
import { DUCKED, PEEKING } from "./directional-cover.ts";

/** Silhouette height while ducked, as a fraction of standing. */
export const DUCK_SQUASH = 0.58;
/** Silhouette height while peeking. Between ducked and standing, and readably so. */
export const PEEK_SQUASH = 0.84;

/**
 * Ducked: folded down behind the prop, arms in, no weapon presented.
 *
 * Above the attack in priority because a ducked unit has no attack — the sim
 * guarantees it (`blockedFire` cancels the cycle), and the pose should not have
 * to fight for the body it already owns.
 */
export const duckState: AnimationState = {
  active: (unit) => unit.coverState === DUCKED,
  aimLambda: 4,
  apply(ctx) {
    ctx.setSquash(DUCK_SQUASH);
    // A fold, not just a scale: the compaction alone reads as a shrunken
    // figure, and the torso pitch is what makes it read as *taking cover*.
    ctx.addRotation("torso", [0.42, 0, 0]);
    ctx.addRotation("head", [-0.22, 0, 0]);
    ctx.addRotation("shoulderL", [-0.5, 0, 0]);
    ctx.addRotation("shoulderR", [-0.5, 0, 0]);
    ctx.addRotation("elbowL", [0.7, 0, 0]);
    ctx.addRotation("elbowR", [0.7, 0, 0]);
  },
  doc: "#100 r3: tucked behind cover, weapon down — cannot attack",
  name: "cover-duck",
  priority: 12,
  suppresses: ["lean", "react"],
};

/**
 * Peeking: half up, weapon presented, paying for the shot with exposure.
 *
 * Below the attack, so the frame a shot actually releases is drawn at full
 * height. That transition is the visible purchase.
 */
export const peekState: AnimationState = {
  active: (unit) => unit.coverState === PEEKING,
  apply(ctx) {
    ctx.setSquash(PEEK_SQUASH);
    ctx.addRotation("torso", [0.16, 0, 0]);
  },
  doc: "#100 r3: half up over cover, able to fire — a stand-in, not a clip",
  name: "cover-peek",
  priority: 9,
};

ANIMATION_STATES.push(duckState, peekState);
