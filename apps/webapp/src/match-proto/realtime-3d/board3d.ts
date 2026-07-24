/**
 * THROWAWAY PROTOTYPE (#81): low-poly 3D recreation of the #74/#79
 * grime-market board. Same layout masses, palette roles, and light
 * direction as `../style-cohesion-assets/grime-market-board.prototype.svg`;
 * world coordinates below are that SVG's screen geometry inverse-projected
 * through the 2:1 dimetric camera (character feet at SVG 421,255 = origin,
 * 40 px per world unit). All geometry authored as code — no assets.
 */

import * as THREE from "three";

import { cel, flat, INK, inkBox } from "./cel.ts";

const FLOOR = "#332733";
const GRID = "#4d3947";
const GRIME = "#211820";

/** Floor patch: anchor is the min-x / max-z corner; extends +X and -Z like the SVG bands. */
function floorPatch(
  x0: number,
  z0: number,
  lenX: number,
  lenZ: number,
  hex: string,
  y: number,
  opacity = 1,
): THREE.Mesh {
  const material = opacity < 1
    ? new THREE.MeshBasicMaterial({ color: hex, opacity, transparent: true })
    : flat(hex);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(lenX, lenZ), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x0 + lenX / 2, y, z0 - lenZ / 2);
  return mesh;
}

function grid(): THREE.LineSegments {
  const points: number[] = [];
  const step = 0.85;
  const extent = 15 * step;
  for (let i = -15; i <= 15; i += 1) {
    const at = i * step;
    points.push(at, 0.002, -extent, at, 0.002, extent);
    points.push(-extent, 0.002, at, extent, 0.002, at);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: GRID }));
}

interface BuildingSpec {
  base: { center: [number, number, number]; size: [number, number, number]; wall: string; roof: string };
  upper: { center: [number, number, number]; size: [number, number, number]; wall: string; roof: string };
}

function building(spec: BuildingSpec): THREE.Group {
  const group = new THREE.Group();

  const base = inkBox(spec.base.size[0], spec.base.size[1], spec.base.size[2], cel(spec.base.wall), 0.05);
  base.position.set(...spec.base.center);
  group.add(base);

  const baseRoof = inkBox(spec.base.size[0] + 0.16, 0.14, spec.base.size[2] + 0.16, cel(spec.base.roof), 0.05);
  baseRoof.position.set(spec.base.center[0], spec.base.center[1] + spec.base.size[1] / 2 + 0.07, spec.base.center[2]);
  group.add(baseRoof);

  const upper = inkBox(spec.upper.size[0], spec.upper.size[1], spec.upper.size[2], cel(spec.upper.wall), 0.05);
  upper.position.set(...spec.upper.center);
  group.add(upper);

  const upperRoof = inkBox(spec.upper.size[0] + 0.16, 0.12, spec.upper.size[2] + 0.16, cel(spec.upper.roof), 0.05);
  upperRoof.position.set(spec.upper.center[0], spec.upper.center[1] + spec.upper.size[1] / 2 + 0.06, spec.upper.center[2]);
  group.add(upperRoof);

  return group;
}

/** Thin unlit slab — window voids, banners, and the scarce emissive strips. */
function slab(
  size: [number, number, number],
  at: [number, number, number],
  hex: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), flat(hex));
  mesh.position.set(...at);
  return mesh;
}

function antenna(x: number, y: number, z: number, flagDx: number): THREE.Group {
  const group = new THREE.Group();
  group.add(slab([0.06, 0.95, 0.06], [x, y, z], INK));
  group.add(slab([0.26, 0.07, 0.04], [x + flagDx, y + 0.38, z], "#a06f56"));
  return group;
}

function pallet(cx: number, cz: number, sizeX: number, sizeZ: number): THREE.Group {
  const group = new THREE.Group();
  const body = inkBox(sizeX, 0.14, sizeZ, cel("#745044"), 0.045);
  body.position.set(cx, 0.07, cz);
  group.add(body);
  group.add(slab([sizeX * 0.55, 0.03, sizeZ * 0.53], [cx, 0.155, cz], "#b76d46"));
  return group;
}

function cableRun(): THREE.Group {
  const group = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-5.9, 4.5, 3.2),
    new THREE.Vector3(-1.2, 7.4, -1.2),
    new THREE.Vector3(3.5, 4.6, -5.7),
  );
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.055, 6, false), flat(INK)));

  // Broken canopy panels hung along the run, each with one copper glint.
  for (const t of [0.3, 0.46, 0.62, 0.76]) {
    const at = curve.getPoint(t);
    const panel = inkBox(0.95, 0.06, 0.72, cel("#2a1e28"), 0.035);
    panel.position.set(at.x, at.y - 1.35, at.z);
    group.add(panel);
    group.add(slab([0.3, 0.05, 0.05], [at.x + 0.18, at.y - 1.3, at.z + 0.3], "#ad6849"));
  }
  return group;
}

function platform(): THREE.Group {
  const group = new THREE.Group();
  const deck = inkBox(5.94, 0.12, 4.31, cel("#3c2d39"), 0.05);
  deck.position.set(-5.92, 0.06, -6.28);
  group.add(deck);
  group.add(floorPatch(-8.41, -4.24, 5.27, 3.71, "#2b262d", 0.135));
  const vents: Array<[number, number]> = [[-8.0, -4.6], [-6.6, -5.6], [-5.2, -6.4], [-4.4, -5.0]];
  for (const [x, z] of vents) {
    const vent = inkBox(1.0, 0.09, 0.95, cel("#59404f"), 0.035);
    vent.position.set(x, 0.18, z);
    group.add(vent);
  }
  return group;
}

export function buildBoard(): THREE.Group {
  const board = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), flat(FLOOR));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  board.add(floor);
  board.add(grid());

  // Quiet floor bands (SVG's large dark patches keep the playable lane low-contrast).
  let layer = 0.004;
  const bands: Array<[number, number, number, number, string]> = [
    [-10.70, 6.66, 1.41, 10.68, "#442f3e"],
    [-6.98, -9.53, 11.95, 1.45, "#442f3e"],
    [-4.97, 9.28, 1.91, 12.52, "#2d2730"],
    [-3.73, -2.99, 12.59, 1.91, "#2d2730"],
    [-13.81, 2.35, 1.10, 6.15, "#281f29"],
    [-2.83, -12.02, 6.72, 1.10, "#281f29"],
    [-2.88, 6.42, 2.58, 9.12, "#43313e"],
    [-0.37, 6.52, 2.55, 9.37, "#2b252d"],
  ];
  for (const [x0, z0, lenX, lenZ, hex] of bands) {
    board.add(floorPatch(x0, z0, lenX, lenZ, hex, layer));
    layer += 0.002;
  }

  // Painted decals: one rust, one teal — the two identity-color floor marks.
  board.add(floorPatch(-4.31, -3.32, 3.11, 1.63, "#50313c", layer));
  board.add(floorPatch(-4.24, -3.67, 2.76, 1.10, "#b0523d", layer + 0.002));
  board.add(floorPatch(-4.81, 4.88, 2.47, 1.70, "#273b3e", layer + 0.004));
  board.add(floorPatch(-4.70, 4.63, 2.12, 1.24, "#2c8581", layer + 0.006));
  layer += 0.008;

  // Long shadow strips cast by off-board structure.
  board.add(floorPatch(-9.42, 3.91, 0.49, 3.46, GRIME, layer, 0.75));
  board.add(floorPatch(1.85, -6.95, 0.49, 3.32, GRIME, layer, 0.75));
  layer += 0.002;

  // Restrained grime clusters — deliberate flat patches, not a noise wash.
  const grime: Array<[number, number, number, number]> = [
    [-5.64, 8.96, 0.85, 1.34],
    [-3.59, 7.19, 0.46, 0.88],
    [-5.52, 2.69, 0.60, 0.74],
    [0.57, 4.81, 0.50, 0.67],
    [2.12, 0.42, 0.60, 0.85],
    [5.41, -1.73, 0.67, 1.10],
  ];
  for (const [x0, z0, lenX, lenZ] of grime) {
    board.add(floorPatch(x0, z0, lenX, lenZ, GRIME, layer, 0.75));
  }
  layer += 0.002;

  // Dropped planks and scratch history in the working lane.
  board.add(floorPatch(-3.27, 8.58, 0.71, 1.73, "#8c6044", layer));
  board.add(floorPatch(5.67, -0.87, 0.71, 1.84, "#8c6044", layer));
  const scratches: Array<[number, number, number]> = [
    [-0.11, 3.43, 0.55],
    [0.81, 3.22, 0.81],
    [2.63, 3.24, 0.60],
    [4.03, 0.35, 0.67],
    [5.37, -0.50, 0.46],
    [-1.06, 5.16, 0.39],
  ];
  for (const [x0, z0, len] of scratches) {
    board.add(floorPatch(x0, z0, 0.13, len, "#7d4c4d", layer + 0.002));
    board.add(floorPatch(x0 + 0.03, z0 - 0.02, 0.035, len * 0.9, "#bb7650", layer + 0.004));
  }
  layer += 0.006;

  // Pebble pairs.
  const pebbles: Array<[number, number]> = [[2.60, 1.50], [2.78, 1.36], [6.17, -3.34], [6.32, -3.47], [-4.95, 6.58], [-4.80, 6.44]];
  for (const [x, z] of pebbles) {
    board.add(slab([0.1, 0.05, 0.09], [x, 0.025, z], "#8a554b"));
  }

  // Left market stack.
  board.add(building({
    base: { center: [-6.53, 1.43, 3.60], size: [4.03, 2.86, 4.35], wall: "#4f2f3b", roof: "#6e413c" },
    upper: { center: [-5.92, 3.74, 3.45], size: [2.55, 1.47, 2.90], wall: "#54333f", roof: "#8c5141" },
  }));
  // Market signage: window voids stay near-ink; strips carry the emission budget.
  board.add(slab([0.06, 0.55, 1.8], [-4.60, 3.92, 3.45], "#171217"));
  board.add(slab([0.07, 0.09, 1.15], [-4.57, 3.70, 3.40], "#d08a49"));
  board.add(slab([0.07, 0.09, 0.55], [-4.46, 2.52, 4.10], "#2f9e96"));
  board.add(slab([0.06, 0.62, 2.6], [-4.46, 1.90, 3.50], "#1a1219"));
  board.add(slab([0.07, 0.06, 2.1], [-4.45, 1.44, 3.50], "#7c4d4c"));
  board.add(slab([0.07, 0.045, 1.35], [-4.45, 1.28, 3.20], "#b76d46"));
  board.add(slab([2.0, 0.55, 0.06], [-6.90, 2.20, 5.81], "#171217"));
  board.add(slab([1.3, 0.06, 0.07], [-7.00, 1.94, 5.84], "#d08a49"));
  board.add(antenna(-6.7, 5.05, 2.6, 0.16));
  board.add(antenna(-5.3, 5.15, 3.9, -0.16));
  // Leaning junk at the market base.
  const plankA = slab([0.85, 0.07, 0.10], [-4.25, 0.34, 4.95], "#b76d46");
  plankA.rotation.z = 0.55;
  board.add(plankA);
  const plankB = slab([0.06, 0.05, 0.8], [-8.85, 0.22, 6.15], "#b76d46");
  board.add(plankB);
  const plankC = slab([0.05, 0.04, 0.7], [-8.55, 0.18, 6.45], "#d09a65");
  board.add(plankC);

  // Right foundry / clinic block.
  board.add(building({
    base: { center: [3.80, 1.58, -6.46], size: [4.03, 3.15, 3.71], wall: "#4a3340", roof: "#755044" },
    upper: { center: [3.10, 3.94, -6.10], size: [2.48, 1.30, 2.05], wall: "#503741", roof: "#6b4a3e" },
  }));
  board.add(slab([0.9, 0.09, 0.07], [3.20, 2.60, -4.58], "#bb6546"));
  board.add(slab([1.9, 0.5, 0.06], [3.40, 2.10, -4.58], "#171217"));
  board.add(slab([2.2, 0.55, 0.06], [3.60, 1.35, -4.58], "#241a22"));
  board.add(slab([1.5, 0.05, 0.07], [3.50, 1.05, -4.56], "#8f7488"));
  board.add(slab([0.06, 0.35, 1.7], [5.84, 2.95, -6.30], "#1a1219"));
  board.add(slab([0.06, 0.5, 1.5], [5.84, 2.30, -6.20], "#17272a"));
  board.add(slab([0.07, 0.07, 1.0], [5.86, 2.24, -6.20], "#2f9e96"));
  board.add(slab([0.07, 0.05, 1.3], [5.86, 2.05, -6.30], "#1f6b66"));
  board.add(slab([1.5, 0.45, 0.06], [3.00, 4.15, -5.05], "#171217"));
  board.add(slab([0.7, 0.08, 0.07], [2.95, 3.95, -5.03], "#d08a49"));
  board.add(antenna(2.2, 5.1, -6.8, 0.16));
  board.add(antenna(3.9, 5.2, -5.6, -0.16));

  board.add(platform());
  board.add(cableRun());
  board.add(pallet(-1.755, 3.13, 1.13, 1.06));
  board.add(pallet(2.99, -1.52, 1.10, 1.13));

  return board;
}
