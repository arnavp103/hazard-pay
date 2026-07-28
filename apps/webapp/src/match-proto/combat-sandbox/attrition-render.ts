/**
 * THROWAWAY SCAFFOLDING (#101): the renderer half of a corpse.
 *
 * `attrition.ts` owns everything the *sim* knows about dying — when a unit
 * falls, how long the body lingers, whether the block closes up. Two things
 * are left over that only the scene can do, and they live here so `scene.ts`
 * gains three lines instead of thirty:
 *
 *   1. **a rig whose unit is gone.** Rigs are built once at mount and keyed by
 *      unit id. When a treatment splices a body out of `state.units` the rig is
 *      still in the scene graph, frozen in its last pose — a permanent statue
 *      of the moment somebody died. It has to be hidden.
 *   2. **per-body material state.** A fade needs alpha; debris needs to drop
 *      out of the faction's value range so it stops competing with the living
 *      for silhouette attention on a fixed camera.
 *
 * ## Cost, because it is a finding and not an implementation detail
 *
 * The whole lane is built on `flat.ts` sharing exactly **one lit material and
 * one unlit material for the entire scene** — that is what the file says makes
 * crowd scale affordable. Per-body alpha or per-body tint cannot use a shared
 * material, so every corpse under `fade` or `debris` gets its own clone. Here
 * that is cheap (each rig already bakes to its own mesh, so it was already its
 * own draw call, and a clone adds uniforms rather than calls) — but a lane that
 * *does* batch a crowd into one mesh would pay for a fade in draw calls, and
 * would want a dissolve driven from a vertex attribute instead. The gallery's
 * `cost-report.json` per shot is the receipt.
 */

import * as THREE from "three";

import { type AttritionTreatment, deathAge, isDead } from "./attrition.ts";
import type { UnitRig } from "./figure.ts";
import { emitMaterial, litMaterial, MARK_MATERIALS } from "./flat.ts";
import { clamp } from "./procedural.ts";
import type { SimUnit } from "./state.ts";

/** How dark debris sits relative to a living body. */
const DEBRIS_VALUE = 0.44;
/** Alpha a fading body still holds when its last step arrives. */
const FADE_FLOOR = 0;

export interface AttritionBody {
  rig: UnitRig;
}

export interface AttritionView {
  /** Called once per simulated step, after the animators have posed the rigs. */
  sync(
    bodies: ReadonlyMap<number, AttritionBody>,
    units: readonly SimUnit[],
    step: number,
  ): void;
  dispose: () => void;
}

function isShared(material: THREE.Material): boolean {
  return material === litMaterial || material === emitMaterial;
}

function isMark(material: THREE.Material): boolean {
  return material === MARK_MATERIALS.crew || material === MARK_MATERIALS.opfor;
}

/**
 * Gives one rig its own copy of the shared materials, so this body can fade or
 * darken without taking the other 39 with it. Also drops the hero marking: a
 * dead hero is not a hero anyone needs to find, and leaving the approved ring
 * on makes the corpse the brightest thing in the frame.
 *
 * `clone` is false for the plain downed body, which needs no per-body material
 * at all — and deliberately keeps full faction colour, so "do corpses compete
 * with the living for attention" is answered at full value rather than quietly
 * pre-softened by the prototype.
 */
function detach(rig: UnitRig, clone: boolean): THREE.Material[] {
  const clones: THREE.Material[] = [];
  rig.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) { return; }
    const material = object.material;
    if (Array.isArray(material)) { return; }
    if (isMark(material)) {
      object.visible = false;
      return;
    }
    if (!clone || !isShared(material)) { return; }
    const copy = material.clone();
    object.material = copy;
    clones.push(copy);
  });
  return clones;
}

class CorpseView implements AttritionView {
  private readonly detached = new Map<number, THREE.Material[]>();
  private readonly live = new Set<number>();

  constructor(private readonly treatment: AttritionTreatment) {}

  sync(
    bodies: ReadonlyMap<number, AttritionBody>,
    units: readonly SimUnit[],
    step: number,
  ): void {
    this.live.clear();
    for (const unit of units) { this.live.add(unit.id); }
    for (const [id, body] of bodies) {
      body.rig.root.visible = this.live.has(id);
    }
    if (this.treatment.corpse === "none") { return; }
    for (const unit of units) {
      if (!isDead(unit)) { continue; }
      const body = bodies.get(unit.id);
      if (body === undefined) { continue; }
      let materials = this.detached.get(unit.id);
      if (materials === undefined) {
        materials = detach(body.rig, this.treatment.corpse !== "prone");
        this.detached.set(unit.id, materials);
      }
      this.paint(materials, deathAge(unit, step));
    }
  }

  private paint(materials: THREE.Material[], age: number): void {
    if (this.treatment.corpse === "fade") {
      const alpha = clamp(1 - age / this.treatment.lingerSteps, FADE_FLOOR, 1);
      for (const material of materials) {
        material.transparent = true;
        material.opacity = alpha;
        // Keep depth writes while the body is still solid enough to occlude;
        // dropping them early makes a fading corpse show through the living.
        material.depthWrite = alpha > 0.9;
      }
      return;
    }
    if (this.treatment.corpse !== "debris") { return; }
    // Debris drops out of the faction's value range once, and is then left
    // alone: it is scenery, and scenery does not animate its own colour.
    for (const material of materials) {
      if (!(material instanceof THREE.MeshLambertMaterial)
        && !(material instanceof THREE.MeshBasicMaterial)) { continue; }
      material.color.setScalar(DEBRIS_VALUE);
    }
  }

  dispose(): void {
    for (const materials of this.detached.values()) {
      for (const material of materials) { material.dispose(); }
    }
    this.detached.clear();
  }
}

/**
 * The view for a treatment, or `undefined` for the control — with nothing
 * dying there is no rig to hide and no material to clone, and the no-attrition
 * capture should cost exactly what the sandbox costs today.
 */
export function attritionView(treatment: AttritionTreatment): AttritionView | undefined {
  return treatment.name === "none" ? undefined : new CorpseView(treatment);
}
