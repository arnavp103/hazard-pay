/**
 * Round-3 regression guard for the hero rig (#81).
 *
 * The sibling flat-procedural lane shipped a rig whose head was drawn BEHIND
 * its own chest, and because every animation composes on the rest pose, one
 * rig defect presented as six broken clips. It passed that lane's tests,
 * its typecheck and its loupe. What it could not have passed is a test that
 * fires the camera's own ray at the face and asks what it hits first, which
 * is what this file does.
 *
 * Every assertion here is taken in the CAMERA'S screen basis, not in world
 * Y. Under a 2:1 dimetric camera both world +Y and world -Z push a point
 * up-screen, so a head can sit above the shoulders in world Y and below them
 * on screen. Measuring in the wrong basis is the actual root cause of the
 * defect this file exists to prevent.
 */

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { UP, VIEW } from "./camera3d.ts";
import {
  applyMedicPose,
  buildMedic,
  COLLAR_Y,
  HEAD_Y,
  type MedicAnim,
  type MedicRig,
  NECK_RISE,
  SHOULDER_Y,
} from "./medic3d.ts";

const CLIPS: Array<[MedicAnim, number]> = [["idle", 4.8], ["turn", 3.7], ["attack", 1.8]];

function posed(anim: MedicAnim, t: number): MedicRig {
  const rig = buildMedic();
  applyMedicPose(rig, anim, t);
  rig.root.updateMatrixWorld(true);
  return rig;
}

function headMeshes(rig: MedicRig): Set<THREE.Object3D> {
  const set = new Set<THREE.Object3D>();
  rig.joints.head.traverse((node) => set.add(node));
  return set;
}

/** Highest screen-space point of a mesh, in world units. */
function screenTop(mesh: THREE.Mesh): number {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (box === null) { return -Infinity; }
  let top = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        top = Math.max(top, new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld).dot(UP));
      }
    }
  }
  return top;
}

/** Head-crown minus highest non-head mass, both in screen space. */
function crownClearance(rig: MedicRig): number {
  const head = headMeshes(rig);
  let crown = -Infinity;
  let body = -Infinity;
  rig.root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) { return; }
    const top = screenTop(node);
    if (head.has(node)) {
      crown = Math.max(crown, top);
    } else {
      body = Math.max(body, top);
    }
  });
  return crown - body;
}

/** Fire the camera's own direction at a point; is a head mesh the first hit? */
function headIsFirstHit(rig: MedicRig, at: THREE.Vector3): boolean {
  const direction = VIEW.clone().negate().normalize();
  const raycaster = new THREE.Raycaster();
  raycaster.set(at.clone().addScaledVector(direction, -12), direction);
  const hits = raycaster.intersectObject(rig.root, true);
  const first = hits[0];
  return first !== undefined && headMeshes(rig).has(first.object);
}

function faceCentre(rig: MedicRig): THREE.Vector3 {
  let found: THREE.Vector3 | undefined;
  rig.joints.head.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) { return; }
    const parameters = (node.geometry as THREE.BufferGeometry & {
      parameters?: { width?: number; height?: number; depth?: number };
    }).parameters;
    if (parameters?.width === 0.24 && parameters.height === 0.18) {
      found = new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);
    }
  });
  if (found === undefined) { throw new Error("face plate not found on the head"); }
  return found;
}

describe("hero rig proportions", () => {
  it("puts the head joint above the shoulder joint — the defect the sibling lane shipped", () => {
    expect(NECK_RISE).toBeGreaterThan(0);
    expect(HEAD_Y).toBeGreaterThan(SHOULDER_Y);
  });

  it("carries a neck of roughly 0.14 head-heights, measured on screen", () => {
    const rig = posed("idle", 0);
    const head = new THREE.Vector3().setFromMatrixPosition(rig.joints.head.matrixWorld);
    const left = new THREE.Vector3().setFromMatrixPosition(rig.joints.shoulderL.matrixWorld);
    const right = new THREE.Vector3().setFromMatrixPosition(rig.joints.shoulderR.matrixWorld);
    const shoulders = left.clone().add(right).multiplyScalar(0.5);
    // One head-height on screen, used as the normaliser throughout.
    const headHeight = 0.5539;
    const rise = (head.dot(UP) - shoulders.dot(UP)) / headHeight;
    expect(rise).toBeGreaterThan(0.1);
    expect(rise).toBeLessThan(0.2);
  });

  it("stands 3.2-4 heads tall — oversized head, not naturalistic proportion", () => {
    const rig = posed("idle", 0);
    let low = Infinity;
    let high = -Infinity;
    rig.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) { return; }
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox;
      if (box === null) { return; }
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const at = new THREE.Vector3(x, y, z).applyMatrix4(node.matrixWorld).dot(UP);
            low = Math.min(low, at);
            high = Math.max(high, at);
          }
        }
      }
    });
    const heads = (high - low) / 0.5539;
    expect(heads).toBeGreaterThan(3.2);
    expect(heads).toBeLessThan(4);
  });

  it("keeps every non-head mass below the collar", () => {
    expect(COLLAR_Y).toBeLessThan(HEAD_Y);
    expect(COLLAR_Y).toBeGreaterThan(SHOULDER_Y);

    // ...and check the geometry, not just the constants. Asserting the
    // constants alone passes happily while a 0.34-tall aerial pokes a third
    // of a head-height above the collar, which is exactly the round-2 defect.
    // The ink shell is allowed to overhang by its own thickness; the mass
    // inside it is not.
    const rig = posed("idle", 0);
    const head = headMeshes(rig);
    const limit = COLLAR_Y + 0.022 + 0.003;
    const offenders: Array<[string, number]> = [];
    rig.joints.torso.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || head.has(node)) { return; }
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox;
      if (box === null) { return; }
      let top = -Infinity;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const at = new THREE.Vector3(x, y, z)
              .applyMatrix4(node.matrixWorld)
              .applyMatrix4(new THREE.Matrix4().copy(rig.joints.torso.matrixWorld).invert());
            top = Math.max(top, at.y);
          }
        }
      }
      if (top > limit) { offenders.push([node.uuid, top]); }
    });
    expect(offenders).toEqual([]);
  });
});

describe("head occlusion", () => {
  it("gives the head the top of the silhouette outright in the rest pose", () => {
    expect(crownClearance(posed("idle", 0))).toBeGreaterThan(0.1);
  });

  it.each(CLIPS)("keeps the crown clear of every other mass through %s", (anim, period) => {
    for (let i = 0; i < 90; i += 1) {
      const rig = posed(anim, (i / 90) * period);
      expect(crownClearance(rig)).toBeGreaterThan(0);
    }
  });

  it("draws the face nearer the camera than the chest front", () => {
    const rig = posed("idle", 0);
    // Front-most point of each plate, not its centre: the sibling lane's
    // defect was the chest's front-top EDGE being nearer than the face, so
    // the comparison has to be surface-to-surface to mean anything.
    let faceDepth = -Infinity;
    rig.joints.head.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) { return; }
      const parameters = (node.geometry as THREE.BufferGeometry & {
        parameters?: { width?: number; height?: number };
      }).parameters;
      if (parameters?.width !== 0.24 || parameters.height !== 0.18) { return; }
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox;
      if (box === null) { return; }
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            faceDepth = Math.max(
              faceDepth,
              new THREE.Vector3(x, y, z).applyMatrix4(node.matrixWorld).dot(VIEW),
            );
          }
        }
      }
    });
    let chestDepth = -Infinity;
    rig.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) { return; }
      const parameters = (node.geometry as THREE.BufferGeometry & {
        parameters?: { width?: number; height?: number };
      }).parameters;
      if (parameters?.width !== 0.5 || parameters.height !== 0.44) { return; }
      node.geometry.computeBoundingBox();
      const box = node.geometry.boundingBox;
      if (box === null) { return; }
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            chestDepth = Math.max(
              chestDepth,
              new THREE.Vector3(x, y, z).applyMatrix4(node.matrixWorld).dot(VIEW),
            );
          }
        }
      }
    });
    expect(faceDepth).toBeGreaterThan(chestDepth);
  });

  it.each(CLIPS)("hits the head first when the camera looks at the face during %s", (anim, period) => {
    for (let i = 0; i < 40; i += 1) {
      const rig = posed(anim, (i / 40) * period);
      expect(headIsFirstHit(rig, faceCentre(rig))).toBe(true);
    }
  });
});
