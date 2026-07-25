/**
 * THROWAWAY PROTOTYPE (#89): the deterministic battle that drives the crowd.
 *
 * The animation layers need *inputs* — speed, acceleration, turn rate, an
 * aim target, an attack release, an incoming hit. Faking those with noise
 * produces exactly the floaty result #89 warns about, so this module runs a
 * tiny seeded skirmish and the animator reads its state. Same seed and same
 * fixed step means the same frame every capture.
 *
 * It is a capture rig, not gameplay: nothing dies, because a crowd still
 * needs a stable unit count. Hits register as reactions only.
 */

import type { Archetype, Tier } from "./figure.ts";
import { clamp, makeRandom } from "./procedural.ts";

export type Side = 0 | 1;

export interface SimUnit {
  id: number;
  side: Side;
  tier: Tier;
  archetype: Archetype;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Acceleration, low-passed — the lean layer's input. */
  ax: number;
  az: number;
  speed: number;
  facing: number;
  angularVelocity: number;
  /** Aim point in world space. */
  aimX: number;
  aimZ: number;
  aimY: number;
  targetId: number;
  /** -1 when not attacking, else 0..1 progress through the attack clip. */
  attackPhase: number;
  cooldown: number;
  /** Sim time of the last released attack, or -1. */
  firedAt: number;
  /** Sim time of the last incoming hit, or -1. */
  hitAt: number;
}

export interface SimState {
  t: number;
  units: SimUnit[];
  random: () => number;
  retargetAt: number;
}

export interface BattleOptions {
  seed?: number;
  fodderPerSide?: number;
  heroesPerSide?: number;
  /** Half-separation of the two lines along the approach axis. */
  standoff?: number;
  /** Rank spacing along the line axis. */
  spacing?: number;
}

/** Ground axis the lines advance along: screen-vertical under the 2:1 camera. */
const APPROACH_X = Math.SQRT1_2;
const APPROACH_Z = Math.SQRT1_2;
/** Ground axis the ranks spread along: screen-horizontal, uncompressed. */
const RANK_X = Math.SQRT1_2;
const RANK_Z = -Math.SQRT1_2;

const ATTACK_DURATION = 1.15;
/** Fraction of the attack clip at which damage releases. */
export const RELEASE_AT = 0.42;

interface Profile {
  maxSpeed: number;
  standoff: number;
  attackRange: number;
  cooldown: number;
}

function profileOf(archetype: Archetype, tier: Tier): Profile {
  const hero = tier === "hero";
  if (archetype === "ranged") {
    return {
      attackRange: hero ? 6.2 : 5.4,
      cooldown: hero ? 1.5 : 2.1,
      maxSpeed: hero ? 1.05 : 1.15,
      standoff: hero ? 5.6 : 4.7,
    };
  }
  if (archetype === "medic") {
    return { attackRange: 1.3, cooldown: 1.7, maxSpeed: 1.2, standoff: 1.05 };
  }
  return {
    attackRange: hero ? 1.4 : 1.1,
    cooldown: hero ? 1.6 : 1.9,
    maxSpeed: hero ? 1.45 : 1.6,
    standoff: hero ? 1.15 : 0.9,
  };
}

export function profileFor(unit: SimUnit): Profile {
  return profileOf(unit.archetype, unit.tier);
}

function makeUnit(
  id: number,
  side: Side,
  tier: Tier,
  archetype: Archetype,
  x: number,
  z: number,
  facing: number,
  random: () => number,
): SimUnit {
  return {
    aimY: 1,
    aimX: x + Math.sin(facing) * 4,
    aimZ: z + Math.cos(facing) * 4,
    angularVelocity: 0,
    archetype,
    attackPhase: -1,
    ax: 0,
    az: 0,
    cooldown: random() * 1.4,
    facing,
    firedAt: -1,
    hitAt: -1,
    id,
    side,
    speed: 0,
    targetId: -1,
    tier,
    vx: 0,
    vz: 0,
    x,
    z,
  };
}

/**
 * Two facing lines, ranks spread along the screen-horizontal so a crowd
 * still reads as two armies rather than two clumps. Heroes are seeded into
 * the front rank, off-centre, so the "can you pick the hero out" test is a
 * real test and not a centred-subject giveaway.
 */
export function createBattle(options: BattleOptions = {}): SimState {
  const seed = options.seed ?? 20890724;
  const fodderPerSide = options.fodderPerSide ?? 18;
  const heroesPerSide = options.heroesPerSide ?? 2;
  const standoff = options.standoff ?? 6.4;
  const spacing = options.spacing ?? 1.42;
  const random = makeRandom(seed);
  const units: SimUnit[] = [];
  let id = 0;

  for (const side of [0, 1] as Side[]) {
    const sign = side === 0 ? 1 : -1;
    const total = fodderPerSide + heroesPerSide;
    const perRank = Math.ceil(total / 2);
    // Heroes take fixed slots in the front rank so the layout is repeatable.
    const heroSlots = new Set<number>();
    for (let h = 0; h < heroesPerSide; h += 1) {
      heroSlots.add(Math.floor((perRank * (h + 1)) / (heroesPerSide + 1)) + (side === 0 ? 0 : 1));
    }
    let melee = 0;
    let hero = 0;
    for (let i = 0; i < total; i += 1) {
      const rank = i < perRank ? 0 : 1;
      const slot = i < perRank ? i : i - perRank;
      const count = rank === 0 ? perRank : total - perRank;
      const offset = (slot - (count - 1) / 2) * spacing + (random() - 0.5) * 0.34;
      const depth = standoff * sign + sign * rank * 1.55 + (random() - 0.5) * 0.3;
      const x = APPROACH_X * depth + RANK_X * offset;
      const z = APPROACH_Z * depth + RANK_Z * offset;
      const facing = Math.atan2(-APPROACH_X * sign, -APPROACH_Z * sign);

      const isHero = rank === 0 && heroSlots.has(slot) && hero < heroesPerSide;
      if (isHero) {
        hero += 1;
        const archetype: Archetype = side === 0
          ? (hero === 1 ? "medic" : "melee")
          : (hero === 1 ? "melee" : "ranged");
        units.push(makeUnit(id, side, "hero", archetype, x, z, facing, random));
      } else {
        // Melee forward, ranged behind — alternating so the two fodder
        // archetypes interleave and silhouette separation gets tested.
        const archetype: Archetype = rank === 0
          ? (melee % 3 === 2 ? "ranged" : "melee")
          : (melee % 3 === 2 ? "melee" : "ranged");
        melee += 1;
        units.push(makeUnit(id, side, "fodder", archetype, x, z, facing, random));
      }
      id += 1;
    }
  }

  return { random, retargetAt: 0, t: 0, units };
}

function retarget(state: SimState): void {
  for (const unit of state.units) {
    let best = -1;
    let bestDistance = Infinity;
    for (const other of state.units) {
      if (other.side === unit.side) { continue; }
      const distance = (other.x - unit.x) ** 2 + (other.z - unit.z) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = other.id;
      }
    }
    unit.targetId = best;
  }
}

const SEPARATION_RADIUS = 1.05;

export function stepBattle(state: SimState, dt: number): void {
  state.t += dt;
  if (state.t >= state.retargetAt) {
    retarget(state);
    state.retargetAt = state.t + 0.45;
  }

  const byId = new Map<number, SimUnit>();
  for (const unit of state.units) { byId.set(unit.id, unit); }

  for (const unit of state.units) {
    const profile = profileFor(unit);
    const target = unit.targetId < 0 ? undefined : byId.get(unit.targetId);

    let desiredVx = 0;
    let desiredVz = 0;
    if (target !== undefined) {
      const dx = target.x - unit.x;
      const dz = target.z - unit.z;
      const distance = Math.hypot(dx, dz) || 1e-4;
      const gap = distance - profile.standoff;
      const drive = clamp(gap * 1.6, -0.8, 1);
      desiredVx = (dx / distance) * drive * profile.maxSpeed;
      desiredVz = (dz / distance) * drive * profile.maxSpeed;
      unit.aimX = target.x;
      unit.aimZ = target.z;
      unit.aimY = target.tier === "hero" ? 1.25 : 1.0;
    }

    // Separation: the cheapest crowd-liveliness layer there is. Without it
    // the ranks interpenetrate and the mass reads as a decal, not bodies.
    for (const other of state.units) {
      if (other.id === unit.id) { continue; }
      const dx = unit.x - other.x;
      const dz = unit.z - other.z;
      const distance = Math.hypot(dx, dz);
      if (distance > SEPARATION_RADIUS || distance < 1e-4) { continue; }
      const push = (1 - distance / SEPARATION_RADIUS) * 2.4;
      desiredVx += (dx / distance) * push;
      desiredVz += (dz / distance) * push;
    }

    const accelX = (desiredVx - unit.vx) * 6;
    const accelZ = (desiredVz - unit.vz) * 6;
    // Low-passed acceleration; the lean layer wants intent, not integrator noise.
    unit.ax += (accelX - unit.ax) * Math.min(1, dt * 9);
    unit.az += (accelZ - unit.az) * Math.min(1, dt * 9);

    unit.vx += accelX * dt;
    unit.vz += accelZ * dt;
    const speed = Math.hypot(unit.vx, unit.vz);
    if (speed > profile.maxSpeed) {
      unit.vx = (unit.vx / speed) * profile.maxSpeed;
      unit.vz = (unit.vz / speed) * profile.maxSpeed;
    }
    unit.speed = Math.hypot(unit.vx, unit.vz);
    unit.x += unit.vx * dt;
    unit.z += unit.vz * dt;

    // Facing: travel direction while moving, aim direction while planted.
    const wanted = unit.speed > 0.25
      ? Math.atan2(unit.vx, unit.vz)
      : Math.atan2(unit.aimX - unit.x, unit.aimZ - unit.z);
    let delta = (wanted - unit.facing) % (Math.PI * 2);
    if (delta > Math.PI) { delta -= Math.PI * 2; }
    if (delta <= -Math.PI) { delta += Math.PI * 2; }
    const turn = clamp(delta * 5.5, -3.4, 3.4);
    unit.angularVelocity += (turn - unit.angularVelocity) * Math.min(1, dt * 12);
    unit.facing += unit.angularVelocity * dt;

    // Attack cycle.
    if (unit.attackPhase >= 0) {
      const previous = unit.attackPhase;
      unit.attackPhase += dt / ATTACK_DURATION;
      if (previous < RELEASE_AT && unit.attackPhase >= RELEASE_AT) {
        unit.firedAt = state.t;
        if (target !== undefined) { target.hitAt = state.t; }
      }
      if (unit.attackPhase >= 1) {
        unit.attackPhase = -1;
        unit.cooldown = profile.cooldown * (0.75 + state.random() * 0.5);
      }
    } else {
      unit.cooldown -= dt;
      const distance = target === undefined
        ? Infinity
        : Math.hypot(target.x - unit.x, target.z - unit.z);
      if (unit.cooldown <= 0 && distance <= profile.attackRange) {
        unit.attackPhase = 0;
      }
    }
  }
}

/** Advances a fresh battle to `seconds` at a fixed step — capture determinism. */
export function battleAt(seconds: number, options: BattleOptions = {}): SimState {
  const state = createBattle(options);
  const dt = 1 / 60;
  const steps = Math.max(0, Math.round(seconds / dt));
  for (let i = 0; i < steps; i += 1) { stepBattle(state, dt); }
  return state;
}
