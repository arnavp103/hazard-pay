/**
 * THROWAWAY SCAFFOLDING (#96, ported from #89): the flat material register.
 *
 * Deliberately the opposite of the #81 lane's kit. That lane's signature is
 * a hard three-band toon ramp (30/150/255) plus a plum-black ink shell
 * around every box — high internal contrast, heavy contours, gritty. This
 * one is:
 *
 *   - **no outlines at all** — separation comes from colour blocking, so
 *     adjacent masses must differ in hue or value on their own;
 *   - **minimal value banding** — a wide ambient plus a weak key gives the
 *     three visible faces of any mass a ~1.2x perceptual spread instead of
 *     a ~5x one, so a unit reads as flat painted shapes;
 *   - **one lit material and one unlit material for the whole scene.**
 *     Colour lives in a vertex attribute, so every mass a bone owns merges
 *     into a single draw call. That is what makes crowd scale affordable.
 *
 * Light direction still matches the shared bake-off protocol: key from
 * screen upper-right, so tops are brightest, +X (screen lower-right) walls
 * sit mid, and +Z (screen lower-left) walls fall into the ambient floor.
 */

import * as THREE from "three";

/** Direction B's warm plum-black — the shared deepest ink/shadow anchor. */
export const INK = "#120b10";

/**
 * Narrow-banding key/fill pair. Both are physically-scaled (three divides
 * irradiance by PI), so the effective legacy factors are ambient ~0.64 and
 * key ~0.45·dot. Top faces land near 1.0, the lit side near 0.82, the
 * shadowed side at the 0.64 ambient floor.
 */
export function flatLights(): THREE.Object3D[] {
  const key = new THREE.DirectionalLight("#fdeeda", 1.42);
  key.position.set(3.2, 4.0, 0.2);
  const ambient = new THREE.AmbientLight("#cbb6c6", 2.02);
  return [key, ambient];
}

/** Shared lit material — every solid mass in the scene draws with this one. */
export const litMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

/** Shared unlit material for the scarce emission accents (the <=5% budget). */
export const emitMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

/**
 * Hero marking — the "thick border or highlight" approved on #69.
 *
 * The obvious implementation is an inverted hull, and it was tried first: bake
 * an outward-expanded shell per bone and draw it behind the solids. It fails
 * for an articulated figure. A hull is per-bone, so it traces every limb
 * separately and outlines each place a limb crosses the torso — heroes came
 * out as scribble and read WORSE than bare fodder, inverting the very
 * hierarchy the marking exists to create.
 *
 * So the border is a screen-space silhouette instead. Every marked unit gets
 * mask meshes that SHARE their solid geometry buffers (no extra vertex memory)
 * on a dedicated camera layer. scene.ts renders that layer alone into a small
 * target, then dilates it in one full-screen pass and composites the ring that
 * falls outside the unit. The result is a true outer contour at a controlled
 * pixel width with no internal contours at all — which also keeps this lane
 * out of the #81 lane's ink-shell register.
 *
 * Faction is encoded in the mask's colour CHANNEL rather than its colour, so
 * the composite shader can pick a border tint without either pass having to
 * agree with the renderer about colour space.
 */
export const MARK_LAYER = 1;

/** Mask channel per faction — red for crew, green for opfor. */
export const MARK_MATERIALS = {
  crew: new THREE.MeshBasicMaterial({ color: 0xff0000, fog: false, toneMapped: false }),
  opfor: new THREE.MeshBasicMaterial({ color: 0x00ff00, fog: false, toneMapped: false }),
};

const SCRATCH = new THREE.Color();

function linearOf(hex: string): [number, number, number] {
  SCRATCH.setStyle(hex, THREE.SRGBColorSpace);
  return [SCRATCH.r, SCRATCH.g, SCRATCH.b];
}

export type Triple = [number, number, number];

/** Local placement for a batched part. Rotation is XYZ euler, radians. */
export interface Placement {
  at?: Triple;
  rot?: Triple;
  scale?: Triple;
}

const MATRIX = new THREE.Matrix4();
const EULER = new THREE.Euler();
const POSITION = new THREE.Vector3();
const QUATERNION = new THREE.Quaternion();
const SCALE = new THREE.Vector3();

function matrixOf(place: Placement | undefined): THREE.Matrix4 | undefined {
  if (place === undefined) { return undefined; }
  const at = place.at ?? [0, 0, 0];
  const rot = place.rot ?? [0, 0, 0];
  const scale = place.scale ?? [1, 1, 1];
  POSITION.set(at[0], at[1], at[2]);
  EULER.set(rot[0], rot[1], rot[2]);
  QUATERNION.setFromEuler(EULER);
  SCALE.set(scale[0], scale[1], scale[2]);
  return MATRIX.compose(POSITION, QUATERNION, SCALE);
}

/**
 * Accumulates coloured primitives and bakes them into at most two meshes.
 *
 * Everything a single bone owns goes through one batch, so a 30-primitive
 * hero costs one lit draw call plus (if it has emission) one unlit call.
 */
export class FlatBatch {
  private readonly litPos: number[] = [];
  private readonly litNorm: number[] = [];
  private readonly litColor: number[] = [];
  private readonly emitPos: number[] = [];
  private readonly emitColor: number[] = [];

  /** Solid mass in a palette-role colour. */
  add(geometry: THREE.BufferGeometry, hex: string, place?: Placement): this {
    const source = geometry.index === null ? geometry.clone() : geometry.toNonIndexed();
    const matrix = matrixOf(place);
    if (matrix !== undefined) { source.applyMatrix4(matrix); }
    const position = source.getAttribute("position");
    const normal = source.getAttribute("normal");
    const [r, g, b] = linearOf(hex);
    for (let i = 0; i < position.count; i += 1) {
      this.litPos.push(position.getX(i), position.getY(i), position.getZ(i));
      this.litNorm.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      this.litColor.push(r, g, b);
    }
    source.dispose();
    geometry.dispose();
    return this;
  }

  /** Unlit accent — signal/emission only, kept scarce by the 70/25/5 budget. */
  addEmit(geometry: THREE.BufferGeometry, hex: string, place?: Placement): this {
    const source = geometry.index === null ? geometry.clone() : geometry.toNonIndexed();
    const matrix = matrixOf(place);
    if (matrix !== undefined) { source.applyMatrix4(matrix); }
    const position = source.getAttribute("position");
    const [r, g, b] = linearOf(hex);
    for (let i = 0; i < position.count; i += 1) {
      this.emitPos.push(position.getX(i), position.getY(i), position.getZ(i));
      this.emitColor.push(r, g, b);
    }
    source.dispose();
    geometry.dispose();
    return this;
  }

  get triangles(): number {
    return (this.litPos.length + this.emitPos.length) / 9;
  }

  get isEmpty(): boolean {
    return this.litPos.length === 0 && this.emitPos.length === 0;
  }

  /** One lit mesh + at most one unlit mesh, both sharing the scene materials. */
  bake(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    if (this.litPos.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.litPos, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(this.litNorm, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.litColor, 3));
      meshes.push(new THREE.Mesh(geometry, litMaterial));
    }
    if (this.emitPos.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.emitPos, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.emitColor, 3));
      meshes.push(new THREE.Mesh(geometry, emitMaterial));
    }
    return meshes;
  }
}

// --- Low-poly primitive vocabulary -----------------------------------------
//
// The #81 lane is built almost entirely from axis-aligned boxes. This lane
// leans on tapered and faceted solids so the silhouette itself reads as a
// different register even before materials are considered.

export function box(width: number, height: number, depth: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(width, height, depth);
}

/** Tapered limb/torso solid — the workhorse shape of the flat register. */
export function taper(
  topRadius: number,
  bottomRadius: number,
  height: number,
  segments = 6,
): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(topRadius, bottomRadius, height, segments);
}

/** Triangular prism: roofs, shoulder plates, blade profiles. */
export function wedge(radius: number, height: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radius, radius, height, 3);
}

export function cone(radius: number, height: number, segments = 6): THREE.BufferGeometry {
  return new THREE.ConeGeometry(radius, height, segments);
}

/** Faceted blob — packs, canisters, helmet crowns. */
export function facet(radius: number, detail = 0): THREE.BufferGeometry {
  return new THREE.OctahedronGeometry(radius, detail);
}

/** Flat ground quad, already laid down in the XZ plane. */
export function quad(width: number, depth: number): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(width, depth);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
