/**
 * THROWAWAY PROTOTYPE (#100 round 2): making a shot visible.
 *
 * # This is a prototype stand-in, not an art proposal
 *
 * Map #95's fog records it plainly: *"no lane renders a projectile, muzzle
 * flash or beam. Whether ranged fire is hitscan-invisible or needs travelling
 * ordnance is unasked."* Round 2 has to show a ranged-heavy fight, and a
 * ranged fight where nothing leaves the barrel is a fight where the only
 * evidence of combat is a recoil twitch on a 28 px figure. So this file exists
 * to make the question **judgeable**, and it is deliberately the cheapest thing
 * that can do that: two emissive quads per shot, in the board's own drab
 * register, with no timing curve, no spread, no impact, no light.
 *
 * Do not read a look off it. Read an *answer* off it — whether a ranged
 * exchange is legible without any of this (`none`), with the shot merely
 * stated (`hitscan`), or only with something that visibly crosses the gap
 * (`bolt`). The gallery ships all three of the same fight at the same instant
 * for exactly that comparison.
 *
 * ## What is true about the sim underneath, and what this draws over it
 *
 * **The sim is hitscan and has no notion of a projectile.** `attackCycle`
 * stamps `target.hitAtStep` at `RELEASE_STEP` of the attack clip; nothing
 * travels, nothing can miss, and there is no flight time to be early or late
 * for. Both modes here are drawn *after the fact* from `firedAtStep`, which is
 * why this is a renderer and touches no behaviour:
 *
 *   hitscan  the whole shooter-to-target segment flashes for `FLASH_STEPS` and
 *            fades. Nothing about it is a lie — it is the sim's own instant
 *            resolution, stated.
 *   bolt     a short segment crosses the gap over `BOLT_STEPS`. This one IS a
 *            lie, and a specific one: the damage already landed on the step the
 *            bolt leaves the muzzle. If travel time ever becomes mechanical —
 *            dodging, leading a target, a shot that outlives its shooter — the
 *            sim owes a projectile entity and this file is not it.
 *
 * Because both modes read only `firedAtStep`, turning fire on cannot change a
 * single float in the battle. `space.test.ts` asserts that the state is
 * identical with fire on and off, so the gallery's three fire modes are three
 * pictures of one fight rather than three fights.
 */

import * as THREE from "three";

import type { SimUnit } from "../sim.ts";
import { heightOf } from "../units.ts";

/** How a shot is drawn. `none` is the status quo of every lane on #64. */
export type FireMode = "bolt" | "hitscan" | "none";

export const FIRE_MODES: readonly FireMode[] = ["none", "hitscan", "bolt"];

export function isFireMode(value: string | null): value is FireMode {
  return value === "bolt" || value === "hitscan" || value === "none";
}

/** Steps the hitscan line is on screen (~0.1 s). */
const FLASH_STEPS = 6;
/** Steps a bolt takes to cross the gap (~0.13 s over a 4.7-unit standoff). */
const BOLT_STEPS = 8;
/** Bolt length, world units. Short enough to read as ordnance, not as a beam. */
const BOLT_LENGTH = 0.6;
/** Half-thickness of the drawn streak, world units. */
const HALF_WIDTH = 0.035;
/** Steps the muzzle flash is on screen. */
const FLASH_HOLD = 4;

/**
 * Tracer colour.
 *
 * `SIGNAL.crew` / `SIGNAL.opfor` would faction-code the fire, which is a
 * legibility *feature* and therefore something the human should get to decide
 * rather than something this file should smuggle in. One neutral hot colour,
 * the same for both sides.
 */
const TRACER = new THREE.Color("#ffd48a").convertSRGBToLinear();

interface Shot {
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  /** 0..1 through the shot's on-screen life. */
  age: number;
}

/**
 * Every tracer and muzzle flash on the field, in one mesh — the same one-draw-
 * call discipline `ShadowField` and `board.ts` keep, so turning fire on costs
 * the cost report one draw call and nothing else.
 */
export class FireField {
  readonly mesh: THREE.Mesh;
  private readonly positions: THREE.Float32BufferAttribute;
  private readonly colors: THREE.Float32BufferAttribute;
  /** Quads per shot: the streak, plus the muzzle flash. */
  private static readonly QUADS = 2;
  private static readonly VERTS = FireField.QUADS * 6;
  private readonly slots: number;

  constructor(slots: number) {
    this.slots = slots;
    const vertices = slots * FireField.VERTS;
    this.positions = new THREE.Float32BufferAttribute(new Float32Array(vertices * 3), 3);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    this.colors = new THREE.Float32BufferAttribute(new Float32Array(vertices * 3), 3);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", this.positions);
    geometry.setAttribute("color", this.colors);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true,
      }),
    );
    this.mesh.frustumCulled = false;
    // Over the bodies: a tracer that a rig can occlude reads as a bug at 28 px,
    // and sorting it properly is a depth problem this prototype is not here to
    // solve.
    this.mesh.renderOrder = 3;
  }

  /** Park everything. Called every frame before the live shots are written. */
  clear(): void {
    (this.positions.array as Float32Array).fill(0);
    (this.colors.array as Float32Array).fill(0);
  }

  commit(): void {
    this.positions.needsUpdate = true;
    this.colors.needsUpdate = true;
  }

  /** Write one shot into slot `index`. Silently drops past the slot count. */
  set(index: number, shot: Shot, mode: FireMode): void {
    if (index >= this.slots || mode === "none") { return; }
    const dx = shot.toX - shot.fromX;
    const dy = shot.toY - shot.fromY;
    const dz = shot.toZ - shot.fromZ;
    const span = Math.hypot(dx, dz) || 1e-4;
    // Screen-space-ish perpendicular on the ground plane: a streak has to keep
    // its width under the dimetric camera whatever direction it is fired in.
    const px = -dz / span;
    const pz = dx / span;

    let head = 1;
    let tail = 0;
    let fade = 1 - shot.age;
    if (mode === "bolt") {
      head = Math.min(1, shot.age);
      tail = Math.max(0, head - BOLT_LENGTH / Math.max(BOLT_LENGTH, span));
      // A bolt is at full brightness the whole way and simply stops, rather
      // than fading out mid-flight where it would read as a miss.
      fade = 1;
    }

    const ax = shot.fromX + dx * tail;
    const ay = shot.fromY + dy * tail;
    const az = shot.fromZ + dz * tail;
    const bx = shot.fromX + dx * head;
    const by = shot.fromY + dy * head;
    const bz = shot.fromZ + dz * head;

    const base = index * FireField.VERTS;
    this.quad(base, ax, ay, az, bx, by, bz, px, pz, HALF_WIDTH, fade);
    // The muzzle flash: a fat, short stub at the barrel that outlives nothing.
    const flash = shot.age < FLASH_HOLD / Math.max(1, BOLT_STEPS) ? 1 - shot.age * 3 : 0;
    const stub = 0.26;
    this.quad(
      base + 6,
      shot.fromX,
      shot.fromY,
      shot.fromZ,
      shot.fromX + (dx / span) * stub,
      shot.fromY,
      shot.fromZ + (dz / span) * stub,
      px,
      pz,
      HALF_WIDTH * 2.4,
      Math.max(0, flash),
    );
  }

  private quad(
    at: number,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    px: number,
    pz: number,
    half: number,
    brightness: number,
  ): void {
    const pos = this.positions.array as Float32Array;
    const col = this.colors.array as Float32Array;
    const corners = [
      [ax + px * half, ay, az + pz * half],
      [ax - px * half, ay, az - pz * half],
      [bx - px * half, by, bz - pz * half],
      [ax + px * half, ay, az + pz * half],
      [bx - px * half, by, bz - pz * half],
      [bx + px * half, by, bz + pz * half],
    ];
    for (let i = 0; i < 6; i += 1) {
      const corner = corners[i];
      if (corner === undefined) { continue; }
      const v = (at + i) * 3;
      pos[v] = corner[0] ?? 0;
      pos[v + 1] = corner[1] ?? 0;
      pos[v + 2] = corner[2] ?? 0;
      col[v] = TRACER.r * brightness;
      col[v + 1] = TRACER.g * brightness;
      col[v + 2] = TRACER.b * brightness;
    }
  }
}

/**
 * The shot a unit is currently showing, if any — pure function of the unit's
 * `firedAtStep` and the current step, so it cannot desynchronise from the sim
 * and adds nothing to the state.
 *
 * `muzzle` is the rig's real muzzle anchor rather than a derived point: the
 * IK-solved arm swings it several tenths of a unit and a tracer that leaves
 * from where the barrel *ought* to be reads as a rendering bug.
 */
export function shotOf(
  unit: SimUnit,
  target: SimUnit | undefined,
  step: number,
  mode: FireMode,
  muzzle: THREE.Vector3,
): Shot | undefined {
  if (mode === "none" || target === undefined || unit.firedAtStep < 0) { return undefined; }
  const life = mode === "bolt" ? BOLT_STEPS : FLASH_STEPS;
  const elapsed = step - unit.firedAtStep;
  if (elapsed < 0 || elapsed >= life) { return undefined; }
  return {
    age: elapsed / life,
    fromX: muzzle.x,
    fromY: muzzle.y,
    fromZ: muzzle.z,
    toX: target.x,
    toY: heightOf(target.tier) * 0.58,
    toZ: target.z,
  };
}

/**
 * Whether an archetype's attack is drawn as fire at all.
 *
 * A sword swing is not a shot, and drawing a tracer along a blade would make
 * the melee-vs-ranged comparison unreadable. `standoff` is the honest test —
 * it is what already separates the two in `archetypes.ts` — rather than a
 * hard-coded archetype name, so a new shooter added at extension point 2
 * fires for free.
 */
export function firesOrdnance(standoff: number): boolean {
  return standoff >= 2.5;
}
