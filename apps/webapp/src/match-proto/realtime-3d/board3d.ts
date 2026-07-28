/**
 * THROWAWAY PROTOTYPE (#81): low-poly 3D recreation of the #74/#79
 * grime-market board. Same layout masses, palette roles, and light
 * direction as `../style-cohesion-assets/grime-market-board.prototype.svg`;
 * world coordinates below are that SVG's screen geometry inverse-projected
 * through the 2:1 dimetric camera (character feet at SVG 421,255 = origin,
 * 40 px per world unit). All geometry authored as code — no assets.
 *
 * ROUND 2 (#81): the round-1 cold critique read the board as a clean
 * sandbox — a debug grid, no surface history, and environment accents
 * that outshouted the unit. This pass fades the grid to a floor-seam
 * hint, knocks the salmon roofs and identity floor decals below the
 * medic's saturation, and adds authored wear. Wear comes in two
 * treatments (`GritMode`) so the round-2 gallery can A/B them:
 *   - "decal": history painted as flat material variation + thin proud
 *     planes (rust streaks, chipped-paint bands, oil stains, tire marks).
 *   - "chip":  history built as geometry (patched panels proud of the
 *     wall in off-tone plates, exposed-substrate corner chips, a broken
 *     hanging plate, a dented crate).
 *   - "both":  the default the winning treatment is committed as.
 */

import * as THREE from "three";

import { cel, flat, INK, inkBox, inkCylinder } from "./cel.ts";

export type GritMode = "both" | "chip" | "decal";

const FLOOR = "#332733";
// Barely-above-floor seam tone: kills the round-1 graph-paper read while
// keeping a faint tile hint so the floor is not a featureless void.
const GRID = "#392b38";
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
  // Round 2: sparser (1.7-unit seams, was 0.85) and near-floor tone — a
  // floor-panel hint, not the round-1 graph-paper overlay.
  const points: number[] = [];
  const step = 1.7;
  const extent = 8 * step;
  for (let i = -8; i <= 8; i += 1) {
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
  group.add(slab([0.26, 0.07, 0.04], [x + flagDx, y + 0.38, z], "#9a6a53"));
  return group;
}

function pallet(cx: number, cz: number, sizeX: number, sizeZ: number): THREE.Group {
  const group = new THREE.Group();
  const body = inkBox(sizeX, 0.14, sizeZ, cel("#6b4a40"), 0.045);
  body.position.set(cx, 0.07, cz);
  group.add(body);
  group.add(slab([sizeX * 0.55, 0.03, sizeZ * 0.53], [cx, 0.155, cz], "#a06342"));
  return group;
}

function cableRun(): THREE.Group {
  const group = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-5.8, 4.45, 4.7),
    new THREE.Vector3(-0.7, 6.9, -0.4),
    new THREE.Vector3(4.3, 4.6, -5.2),
  );
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.055, 6, false), flat(INK)));

  // Broken canopy panels hung along the run, each with one copper glint.
  for (const t of [0.3, 0.46, 0.62, 0.76]) {
    const at = curve.getPoint(t);
    const panel = inkBox(0.95, 0.06, 0.72, flat("#2a1e28"), 0.035);
    panel.position.set(at.x, at.y - 1.35, at.z);
    group.add(panel);
    group.add(slab([0.3, 0.05, 0.05], [at.x + 0.18, at.y - 1.3, at.z + 0.3], "#9c5e42"));
  }
  return group;
}

function platform(): THREE.Group {
  const group = new THREE.Group();
  const deck = inkBox(5.94, 0.12, 4.31, flat("#3c2d39"), 0.05);
  deck.position.set(-5.92, 0.06, -6.28);
  group.add(deck);
  group.add(floorPatch(-8.41, -4.24, 5.27, 3.71, "#2b262d", 0.135));
  const vents: Array<[number, number]> = [[-8.0, -4.6], [-6.6, -5.6], [-5.2, -6.4], [-4.4, -5.0]];
  for (const [x, z] of vents) {
    const vent = inkBox(1.0, 0.09, 0.95, flat("#59404f"), 0.035);
    vent.position.set(x, 0.18, z);
    group.add(vent);
    // Grime ring baked into every vent mouth — reads as soot at any zoom.
    group.add(floorPatch(x - 0.6, z + 0.6, 1.2, 1.2, "#191320", 0.142, 0.6));
  }
  return group;
}

// --- Wear treatments -------------------------------------------------------
//
// Camera sees each mass's +X face (screen lower-right) and +Z face (screen
// lower-left). Wear planes sit proud of those faces by a few cm so the ink
// shells never z-fight. Face coordinates for the two market masses:
//   left  base: x∈[-8.55,-4.52] y∈[0,2.86] z∈[1.43,5.78] → +X face -4.52, +Z 5.78
//   right base: x∈[ 1.79, 5.82] y∈[0,3.15] z∈[-8.32,-4.61] → +X face 5.82, +Z -4.61

/** Rust bleed / chipped-paint / stain history painted as flat planes. */
function decalGrit(board: THREE.Group): void {
  // Rust streaks weeping down the left market +X face from the roofline.
  for (const [z, h, tone] of [[4.9, 1.6, "#6c3c31"], [4.2, 1.2, "#5c352c"], [3.3, 1.8, "#733f32"], [2.4, 1.0, "#5a3229"]] as const) {
    board.add(slab([0.03, h, 0.09], [-4.5, 2.5 - h / 2, z], tone));
  }
  // Chipped-paint band low on the left +Z face — near-ink strip, lighter substrate chip above.
  board.add(slab([2.1, 0.2, 0.02], [-6.7, 0.66, 5.77], "#241a22"));
  board.add(slab([1.6, 0.06, 0.02], [-6.6, 0.8, 5.78], "#5f4a55"));
  // Right foundry +X face: rust weep under the vent, plus a grease smear.
  for (const [y, h, tone] of [[2.5, 1.5, "#6c3c31"], [1.7, 1.1, "#5a3229"]] as const) {
    board.add(slab([0.03, h, 0.08], [5.82, y - h / 2, -6.0], tone));
  }
  board.add(slab([0.03, 0.6, 1.0], [5.82, 1.1, -7.0], "#241d28"));
  // Oil stains on the working floor: bigger blue-black pools + sheen, near the lane.
  board.add(floorPatch(-2.3, 2.6, 2.1, 1.5, "#181620", 0.05, 0.9));
  board.add(floorPatch(-1.9, 2.25, 1.1, 0.75, "#34313f", 0.052, 0.75));
  board.add(floorPatch(3.0, -0.5, 1.9, 1.3, "#181620", 0.05, 0.9));
  board.add(floorPatch(3.5, -0.85, 1.0, 0.6, "#34313f", 0.052, 0.75));
  // Tire / drag marks scored across the visible lane (paired parallel streaks).
  for (const [x0, z0, len] of [[-0.6, 5.6, 5.4], [1.6, 1.8, 4.6], [-2.4, -0.4, 3.2]] as const) {
    board.add(floorPatch(x0, z0, 0.16, len, "#1c1520", 0.048, 0.85));
    board.add(floorPatch(x0 + 0.5, z0 - 0.12, 0.16, len * 0.92, "#1c1520", 0.048, 0.85));
  }
  // Base dirt-line: accumulated grime where every wall meets the ground — the
  // single cheapest "lived-in" tell, and it reads on the hero facades at any zoom.
  board.add(slab([0.02, 0.62, 4.25], [-4.5, 0.33, 3.6], "#241c22"));
  board.add(slab([4.0, 0.62, 0.02], [-6.53, 0.33, 5.77], "#241c22"));
  board.add(slab([0.02, 0.62, 3.65], [5.8, 0.33, -6.46], "#221a20"));
  board.add(slab([3.9, 0.62, 0.02], [3.8, 0.33, -4.6], "#221a20"));
  // Grime blotches climbing the visible facades — irregular dark stains.
  for (const [x, y, z, h] of [[-4.49, 1.5, 4.6, 0.9], [-4.49, 1.1, 2.9, 0.7], [-4.49, 0.9, 5.2, 0.6]] as const) {
    board.add(slab([0.02, h, 0.5], [x, y, z], "#2c2029"));
  }
  for (const [x, y, z, h] of [[5.81, 1.4, -5.4, 0.9], [5.81, 0.95, -7.3, 0.7]] as const) {
    board.add(slab([0.02, h, 0.5], [x, y, z], "#281d24"));
  }
}

/** The same history built as geometry: patched plates, a blown-out panel,
 *  substrate chips, a crate stack + spilled debris, a fallen barrel. The
 *  cold critique wants the chip pass to LEAD — geometry breaks the boxy
 *  playset silhouette where a flat decal cannot. */
function chipGrit(board: THREE.Group): void {
  // Patched panels — off-tone plates riveted proud of the wall, ink-outlined.
  const patchL = inkBox(0.06, 0.8, 0.95, cel("#5d3a45"), 0.02);
  patchL.position.set(-4.5, 1.2, 3.9);
  board.add(patchL);
  const patchR = inkBox(0.06, 0.7, 0.8, cel("#583f4d"), 0.02);
  patchR.position.set(5.82, 1.4, -6.5);
  board.add(patchR);
  // Blown-out wall panel on the left mass — a dark recess with a substrate lip;
  // reads as a hole punched in the clean box.
  board.add(slab([0.04, 0.6, 0.72], [-4.49, 1.55, 2.55], "#140e13"));
  board.add(slab([0.06, 0.11, 0.78], [-4.49, 1.88, 2.55], "#5f4a55"));
  board.add(slab([0.06, 0.6, 0.09], [-4.49, 1.55, 2.2], "#4a3944"));
  // Silhouette notch: a missing roof-corner block on the left upper mass —
  // an ink gap + exposed substrate that breaks the boxy top edge.
  board.add(slab([0.5, 0.34, 0.5], [-4.9, 4.5, 4.5], INK));
  board.add(slab([0.3, 0.14, 0.3], [-4.95, 4.42, 4.55], "#6b5560"));
  // Exposed-substrate corner chips where the roof meets the wall (bigger).
  for (const [x, y, z] of [[-4.52, 2.72, 5.55], [-4.52, 2.72, 1.75], [5.82, 3.0, -4.85], [5.82, 3.0, -7.7]] as const) {
    board.add(slab([0.16, 0.18, 0.18], [x, y, z], "#6b5560"));
  }
  // A broken cladding plate hanging off the left mass at an angle.
  const brokenPlate = inkBox(0.05, 0.6, 0.44, cel("#452b36"), 0.02);
  brokenPlate.position.set(-4.5, 1.95, 3.35);
  brokenPlate.rotation.x = 0.55;
  board.add(brokenPlate);
  // A dented supply-crate stack at the right block base — chipped lid, off-tone slat.
  const crate = inkBox(0.66, 0.64, 0.66, cel("#5a4038"), 0.03);
  crate.position.set(2.4, 0.32, -4.1);
  board.add(crate);
  board.add(slab([0.54, 0.05, 0.54], [2.4, 0.66, -4.1], "#3a2a28"));
  board.add(slab([0.16, 0.18, 0.18], [2.68, 0.54, -3.82], "#7a5a4a"));
  const crate2 = inkBox(0.44, 0.42, 0.46, cel("#513a34"), 0.03);
  crate2.position.set(2.15, 0.85, -4.35);
  crate2.rotation.y = 0.3;
  board.add(crate2);
  // A tipped-over crate + spilled slats on the ground beside the stack.
  const tipped = inkBox(0.4, 0.4, 0.42, cel("#4c372f"), 0.03);
  tipped.position.set(3.15, 0.2, -3.55);
  tipped.rotation.z = 0.5;
  board.add(tipped);
  for (const [x, z, rot] of [[3.5, -3.1, 0.3], [3.7, -3.3, -0.2]] as const) {
    const plank = slab([0.6, 0.05, 0.09], [x, 0.06, z], "#6b4a40");
    plank.rotation.y = rot;
    board.add(plank);
  }
  // A bent length of rebar / conduit propped against the crate.
  const rebar = slab([0.05, 0.85, 0.05], [2.0, 0.4, -3.7], "#4a4148");
  rebar.rotation.z = 0.42;
  board.add(rebar);
  // A fallen barrel near the left play edge — a strong round mass against the boxes.
  const barrel = inkCylinder(0.26, 0.62, cel("#4f4149"), 0.03);
  barrel.rotation.z = Math.PI / 2;
  barrel.rotation.y = 0.4;
  barrel.position.set(-2.7, 0.26, 4.2);
  board.add(barrel);
  board.add(slab([0.04, 0.42, 0.42], [-2.98, 0.26, 4.32], "#2e262f"));
  board.add(slab([0.42, 0.05, 0.16], [-2.55, 0.02, 4.2], "#241d24"));
  // Scuff + wear plates on the crate stack so the crates aren't clean boxes.
  board.add(slab([0.36, 0.2, 0.02], [2.4, 0.3, -3.76], "#3a2a26"));
  board.add(slab([0.02, 0.4, 0.36], [2.74, 0.34, -4.1], "#38282a"));
  board.add(slab([0.24, 0.02, 0.24], [2.15, 1.07, -4.35], "#33231f"));
  board.add(slab([0.3, 0.14, 0.02], [3.12, 0.24, -3.36], "#2f221f"));
  // Scattered litter in the working lane — small dark debris bits.
  for (const [x, z, sx, sz] of [[1.2, 4.5, 0.16, 0.1], [-1.4, -1.2, 0.12, 0.14], [4.6, 1.5, 0.14, 0.1], [-3.4, 2.0, 0.1, 0.12]] as const) {
    board.add(slab([sx, 0.045, sz], [x, 0.022, z], "#241c22"));
  }
}

export function buildBoard(grit: GritMode = "both"): THREE.Group {
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
  // Round 2: both knocked below the medic's livery/visor saturation and
  // shrunk, so the unit — not the furniture — owns the saturation peak.
  board.add(floorPatch(-4.31, -3.32, 2.6, 1.3, "#412c34", layer));
  board.add(floorPatch(-4.14, -3.6, 1.9, 0.8, "#7c4232", layer + 0.002));
  // Teal floor mark muted + shrunk so it never rivals the unit's teal emission.
  board.add(floorPatch(-4.66, 4.7, 1.7, 1.15, "#223634", layer + 0.004));
  board.add(floorPatch(-4.45, 4.45, 1.2, 0.7, "#234f4c", layer + 0.006));
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
  board.add(floorPatch(-3.27, 8.58, 0.71, 1.73, "#77543c", layer));
  board.add(floorPatch(5.67, -0.87, 0.71, 1.84, "#77543c", layer));
  const scratches: Array<[number, number, number]> = [
    [-0.11, 3.43, 0.55],
    [0.81, 3.22, 0.81],
    [2.63, 3.24, 0.60],
    [4.03, 0.35, 0.67],
    [5.37, -0.50, 0.46],
    [-1.06, 5.16, 0.39],
  ];
  for (const [x0, z0, len] of scratches) {
    board.add(floorPatch(x0, z0, 0.13, len, "#6d4444", layer + 0.002));
    board.add(floorPatch(x0 + 0.03, z0 - 0.02, 0.035, len * 0.9, "#9c6446", layer + 0.004));
  }
  layer += 0.006;

  // Pebble pairs.
  const pebbles: Array<[number, number]> = [[2.60, 1.50], [2.78, 1.36], [6.17, -3.34], [6.32, -3.47], [-4.95, 6.58], [-4.80, 6.44]];
  for (const [x, z] of pebbles) {
    board.add(slab([0.1, 0.05, 0.09], [x, 0.025, z], "#7a4d44"));
  }

  // Left market stack. Round 2: roofs desaturated one band so the salmon
  // upper roof no longer outshouts the medic.
  board.add(building({
    base: { center: [-6.53, 1.43, 3.60], size: [4.03, 2.86, 4.35], wall: "#4f2f3b", roof: "#5c3a36" },
    upper: { center: [-5.92, 3.74, 3.45], size: [2.55, 1.47, 2.90], wall: "#54333f", roof: "#6f4539" },
  }));
  // Market signage: window voids stay near-ink; strips carry the emission budget.
  board.add(slab([0.06, 0.55, 1.8], [-4.60, 3.92, 3.45], "#171217"));
  board.add(slab([0.07, 0.09, 1.15], [-4.57, 3.70, 3.40], "#c07f45"));
  board.add(slab([0.07, 0.09, 0.55], [-4.46, 2.52, 4.10], "#2f9e96"));
  board.add(slab([0.06, 0.62, 2.6], [-4.46, 1.90, 3.50], "#1a1219"));
  board.add(slab([0.07, 0.06, 2.1], [-4.45, 1.44, 3.50], "#6d4444"));
  board.add(slab([0.07, 0.045, 1.35], [-4.45, 1.28, 3.20], "#a0603e"));
  board.add(slab([2.0, 0.55, 0.06], [-6.90, 2.20, 5.81], "#171217"));
  board.add(slab([1.3, 0.06, 0.07], [-7.00, 1.94, 5.84], "#c07f45"));
  board.add(antenna(-6.7, 5.05, 2.6, 0.16));
  board.add(antenna(-5.3, 5.15, 3.9, -0.16));
  // Leaning junk at the market base.
  const plankA = slab([0.85, 0.07, 0.10], [-4.25, 0.34, 4.95], "#a0603e");
  plankA.rotation.z = 0.55;
  board.add(plankA);
  const plankB = slab([0.06, 0.05, 0.8], [-8.85, 0.22, 6.15], "#a0603e");
  board.add(plankB);
  const plankC = slab([0.05, 0.04, 0.7], [-8.55, 0.18, 6.45], "#b98a5c");
  board.add(plankC);

  // Right foundry / clinic block.
  board.add(building({
    base: { center: [3.80, 1.58, -6.46], size: [4.03, 3.15, 3.71], wall: "#4a3340", roof: "#5f463c" },
    upper: { center: [3.10, 3.94, -6.10], size: [2.48, 1.30, 2.05], wall: "#503741", roof: "#5a4036" },
  }));
  board.add(slab([0.9, 0.09, 0.07], [3.20, 2.60, -4.58], "#a15a3e"));
  board.add(slab([1.9, 0.5, 0.06], [3.40, 2.10, -4.58], "#171217"));
  board.add(slab([2.2, 0.55, 0.06], [3.60, 1.35, -4.58], "#241a22"));
  board.add(slab([1.5, 0.05, 0.07], [3.50, 1.05, -4.56], "#7c6478"));
  board.add(slab([0.06, 0.35, 1.7], [5.84, 2.95, -6.30], "#1a1219"));
  board.add(slab([0.06, 0.5, 1.5], [5.84, 2.30, -6.20], "#17272a"));
  board.add(slab([0.07, 0.07, 1.0], [5.86, 2.24, -6.20], "#2f9e96"));
  board.add(slab([0.07, 0.05, 1.3], [5.86, 2.05, -6.30], "#1f6b66"));
  board.add(slab([1.5, 0.45, 0.06], [3.00, 4.15, -5.05], "#171217"));
  board.add(slab([0.7, 0.08, 0.07], [2.95, 3.95, -5.03], "#c07f45"));
  board.add(antenna(2.2, 5.1, -6.8, 0.16));
  board.add(antenna(3.9, 5.2, -5.6, -0.16));

  board.add(platform());
  board.add(cableRun());
  board.add(pallet(-1.755, 3.13, 1.13, 1.06));
  board.add(pallet(2.99, -1.52, 1.10, 1.13));

  if (grit === "decal" || grit === "both") { decalGrit(board); }
  if (grit === "chip" || grit === "both") { chipGrit(board); }

  return board;
}
