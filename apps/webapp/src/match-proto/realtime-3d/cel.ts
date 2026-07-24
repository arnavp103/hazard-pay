/**
 * THROWAWAY PROTOTYPE (#81): cel-shading kit for the real-time 3D
 * bake-off lane. Hard three-band toon ramp, cached flat materials in
 * palette-role colors, and geometry ink outlines built as expanded
 * back-face shells — exact and gap-free on boxes, crisp under MSAA,
 * no post-processing and no temporal AA anywhere.
 */

import * as THREE from "three";

/** Direction B's warm plum-black — the shared deepest ink/shadow anchor. */
export const INK = "#120b10";

let ramp: THREE.DataTexture | undefined;

/** Hard 3-band ramp (deep shadow / mid / lit); nearest filtering keeps band edges knife-sharp. */
export function toonRamp(): THREE.DataTexture {
  if (ramp === undefined) {
    const bands = new Uint8Array([96, 172, 255]);
    ramp = new THREE.DataTexture(bands, bands.length, 1, THREE.RedFormat);
    ramp.minFilter = THREE.NearestFilter;
    ramp.magFilter = THREE.NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
  }
  return ramp;
}

const celCache = new Map<string, THREE.MeshToonMaterial>();

/** Flat cel material in a palette-role color; cached so parts share programs. */
export function cel(hex: string): THREE.MeshToonMaterial {
  let material = celCache.get(hex);
  if (material === undefined) {
    material = new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp() });
    celCache.set(hex, material);
  }
  return material;
}

const flatCache = new Map<string, THREE.MeshBasicMaterial>();

/** Unlit material for the scarce emission accents (the ≤5% budget) and pure-ink props. */
export function flat(hex: string): THREE.MeshBasicMaterial {
  let material = flatCache.get(hex);
  if (material === undefined) {
    material = new THREE.MeshBasicMaterial({ color: hex });
    flatCache.set(hex, material);
  }
  return material;
}

const shellMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

/**
 * Box with a plum-black geometry outline: a back-face shell of the same
 * box expanded by a constant world thickness. The orthographic camera
 * keeps that a constant pixel width at every depth.
 */
export function inkBox(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  shell: number,
): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material));
  if (shell > 0) {
    group.add(new THREE.Mesh(
      new THREE.BoxGeometry(width + shell * 2, height + shell * 2, depth + shell * 2),
      shellMaterial,
    ));
  }
  return group;
}

/** Cylinder with the same expanded-shell ink outline. */
export function inkCylinder(
  radius: number,
  length: number,
  material: THREE.Material,
  shell: number,
): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material));
  if (shell > 0) {
    group.add(new THREE.Mesh(
      new THREE.CylinderGeometry(radius + shell, radius + shell, length + shell * 2, 10),
      shellMaterial,
    ));
  }
  return group;
}
