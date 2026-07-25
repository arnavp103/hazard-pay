/**
 * THROWAWAY PROTOTYPE (#81): the lane's camera basis, in one place.
 *
 * Every measurement in this lane is taken in the camera's own screen basis
 * rather than in world Y, because the 2:1 dimetric camera looks DOWN at the
 * figure: `UP` has a negative Z term as well as a positive Y term, so world
 * +Y and world -Z both push a point up-screen. Measuring "is the head above
 * the shoulders" in world Y is exactly the mistake that let the sibling
 * lane's head sink behind its own chest while its world-space numbers
 * looked fine — see the round-3 note at the top of `medic3d.ts`.
 *
 * Because the camera is orthographic, `dot(p, UP)` is a screen height in
 * world units and multiplying by `PX_PER_UNIT * zoom` converts it to pixels
 * exactly. That is what makes "this unit is 22 px tall" a computable
 * property rather than something measured off a screenshot.
 */

import * as THREE from "three";

/** Screen-right unit vector of the dimetric camera, in world space. */
export const RIGHT = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
/** Screen-up. Both world +Y and world -Z project up-screen. */
export const UP = new THREE.Vector3(-0.35355, 0.86603, -0.35355);
/** Target-to-camera direction; `dot(p, VIEW)` increases toward the camera. */
export const VIEW = new THREE.Vector3(0.61237, 0.5, 0.61237);

/** Screen pixels per world unit at zoom 1. */
export const PX_PER_UNIT = 40;

/** Screen-space vertical extent of an object tree, in world units. */
export function screenHeight(object: THREE.Object3D): number {
  object.updateMatrixWorld(true);
  let lo = Infinity;
  let hi = -Infinity;
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) { return; }
    const geometry = node.geometry as THREE.BufferGeometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (box === null) { return; }
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const at = new THREE.Vector3(x, y, z).applyMatrix4(node.matrixWorld).dot(UP);
          lo = Math.min(lo, at);
          hi = Math.max(hi, at);
        }
      }
    }
  });
  return hi - lo;
}

/**
 * Uniformly scale `object` until it stands exactly `target` world units tall
 * on screen. Tier separation is specified as a ratio of *apparent* heights,
 * so it has to be enforced on the projected extent — authoring two rigs to
 * the same nominal height and hoping is how a "1.25x" boost silently
 * becomes 1.1x once one archetype grows a helmet.
 */
export function fitScreenHeight(object: THREE.Object3D, target: number): number {
  object.scale.setScalar(1);
  const natural = screenHeight(object);
  const factor = natural === 0 ? 1 : target / natural;
  object.scale.setScalar(factor);
  object.updateMatrixWorld(true);
  return factor;
}

/** A rasterised screen silhouette: occupancy only, all colour discarded. */
export interface Silhouette {
  grid: boolean[];
  cols: number;
  rows: number;
  /** Occupied cells. */
  filled: number;
  /** Occupied cells / bounding-box cells — how solid the shape is. */
  density: number;
  /** Widest occupied run in any single row, in cells. */
  widestRow: number;
  /** Median occupied cells per non-empty row — the "core" width. */
  medianRow: number;
  width: number;
  height: number;
}

function hull(points: Array<[number, number]>): Array<[number, number]> {
  const sorted = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: [number, number], a: [number, number], b: [number, number]): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (source: Array<[number, number]>): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (const point of source) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, point) <= 0) {
        out.pop();
      }
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

function inside(poly: Array<[number, number]>, x: number, y: number): boolean {
  if (poly.length < 3) { return false; }
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) { return false; }
  }
  return true;
}

/**
 * Rasterise an object's screen silhouette by projecting each mesh's bounding
 * box corners into the camera's (RIGHT, UP) plane, taking the convex hull of
 * that projection, and filling it.
 *
 * The hull step is load-bearing. An oriented box viewed dimetrically projects
 * to a hexagon whose area is far smaller than its screen-space AABB, so
 * filling the AABB instead — the obvious shortcut — reports every archetype
 * as a solid rectangle at ~0.92 density and makes two completely different
 * shapes look identical. Silhouette claims measured that way are worthless,
 * which is exactly the claim this lane is being judged on.
 */
export function rasterSilhouette(object: THREE.Object3D, rows: number): Silhouette {
  object.updateMatrixWorld(true);
  const hulls: Array<Array<[number, number]>> = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) { return; }
    const geometry = node.geometry as THREE.BufferGeometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (box === null) { return; }
    const projected: Array<[number, number]> = [];
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const at = new THREE.Vector3(x, y, z).applyMatrix4(node.matrixWorld);
          const point: [number, number] = [at.dot(RIGHT), at.dot(UP)];
          projected.push(point);
          minX = Math.min(minX, point[0]); maxX = Math.max(maxX, point[0]);
          minY = Math.min(minY, point[1]); maxY = Math.max(maxY, point[1]);
        }
      }
    }
    hulls.push(hull(projected));
  });

  const cell = (maxY - minY) / rows;
  const cols = Math.max(1, Math.round((maxX - minX) / cell));
  const grid = new Array<boolean>(cols * rows).fill(false);
  for (let r = 0; r < rows; r += 1) {
    const y = minY + (r + 0.5) * cell;
    for (let c = 0; c < cols; c += 1) {
      const x = minX + (c + 0.5) * cell;
      for (const poly of hulls) {
        if (!inside(poly, x, y)) { continue; }
        grid[r * cols + c] = true;
        break;
      }
    }
  }

  const perRow: number[] = [];
  for (let r = 0; r < rows; r += 1) {
    let n = 0;
    for (let c = 0; c < cols; c += 1) {
      if (grid[r * cols + c] === true) { n += 1; }
    }
    if (n > 0) { perRow.push(n); }
  }
  perRow.sort((a, b) => a - b);
  const filled = grid.filter(Boolean).length;
  return {
    cols,
    density: filled / (cols * rows),
    filled,
    grid,
    height: maxY - minY,
    medianRow: perRow[Math.floor(perRow.length / 2)] ?? 0,
    rows,
    widestRow: perRow[perRow.length - 1] ?? 0,
    width: maxX - minX,
  };
}

/** Screen height in world units -> pixels at a given zoom. */
export function toPixels(height: number, zoom: number): number {
  return height * PX_PER_UNIT * zoom;
}

/** The zoom that renders a unit of screen height `height` at `px` pixels. */
export function zoomForPixels(height: number, px: number): number {
  return px / (height * PX_PER_UNIT);
}
