/**
 * THROWAWAY SCAFFOLDING (#96, ported from #89): the shared grime-market
 * board, rebuilt in the flat register.
 *
 * World coordinates are the same ones the #81 lane inverse-projected out of
 * the #74/#79 SVG board (character feet at origin, 40 px per world unit), so
 * framing, masses and light direction stay protocol-comparable across lanes.
 * What changes is everything material:
 *
 *   - no ink shells, so masses separate by hue and value alone;
 *   - no rust weeps, oil pools, tire marks, chips or patch plates — the grit
 *     lane owns surface history, this lane owns clean colour blocking;
 *   - the whole board bakes into ONE lit mesh plus ONE unlit mesh, because
 *     a static environment has no bones and therefore no reason to cost more
 *     than two draw calls.
 *
 * The floor sits a band brighter than the #81 board so units own both the
 * darkest and the most saturated pixels, per the 70/25/5 ruling.
 */

import * as THREE from "three";

import { box, FlatBatch, INK, quad, taper, wedge } from "./flat.ts";

// The board keeps the quiet 70% of the value/saturation budget. Warm tones
// are rationed hard, because the crew livery is warm and the environment
// must not compete with it; the foundry block runs cool so the two masses
// separate by temperature as well as position.
const FLOOR = "#443848";
const BAND_WARM = "#4d4053";
const BAND_COOL = "#3a3a4c";
const BAND_DEEP = "#2f2c40";
const WALL_A = "#544a63";
const WALL_B = "#4a4459";
const WALL_C = "#414a5c";
const ROOF_A = "#6e5560";
const ROOF_B = "#57545f";
const DECK = "#3a3c4d";
const CRATE = "#5a4c4a";
const CRATE_TOP = "#695955";
const AWNING = "#6b4c52";
const SIGN_WARM = "#c8874c";
const SIGN_COOL = "#4aa79c";

export interface BoardBuild {
  group: THREE.Group;
  cost: { meshes: number; triangles: number };
}

/** Floor patch anchored at its min-x / max-z corner, like the SVG bands. */
function patch(
  batch: FlatBatch,
  x0: number,
  z0: number,
  lenX: number,
  lenZ: number,
  hex: string,
  y: number,
): void {
  batch.add(quad(lenX, lenZ), hex, { at: [x0 + lenX / 2, y, z0 - lenZ / 2] });
}

interface Stack {
  base: { center: [number, number, number]; size: [number, number, number]; wall: string };
  upper: { center: [number, number, number]; size: [number, number, number]; wall: string };
  roof: string;
}

function stack(batch: FlatBatch, spec: Stack): void {
  batch.add(box(...spec.base.size), spec.base.wall, { at: spec.base.center });
  batch.add(box(spec.base.size[0] + 0.18, 0.16, spec.base.size[2] + 0.18), spec.roof, {
    at: [spec.base.center[0], spec.base.center[1] + spec.base.size[1] / 2 + 0.08, spec.base.center[2]],
  });
  batch.add(box(...spec.upper.size), spec.upper.wall, { at: spec.upper.center });
  // Faceted roof cap — the low-poly register's tell, where #81 uses a slab.
  batch.add(
    wedge(spec.upper.size[0] * 0.72, spec.upper.size[2] + 0.1),
    spec.roof,
    {
      at: [spec.upper.center[0], spec.upper.center[1] + spec.upper.size[1] / 2 + 0.2, spec.upper.center[2]],
      rot: [Math.PI / 2, 0, 0],
    },
  );
}

export function buildBoard(): BoardBuild {
  const batch = new FlatBatch();

  // Big enough that the ortho frustum never sees the floor's own edge, even
  // pulled back to crowd zoom.
  batch.add(quad(62, 62), FLOOR, { at: [0, -0.002, 0] });

  // Quiet floor bands — the same large low-contrast masses the SVG board
  // used to keep the playable lane from competing with the units.
  let layer = 0.004;
  const bands: Array<[number, number, number, number, string]> = [
    [-10.70, 6.66, 1.41, 10.68, BAND_WARM],
    [-6.98, -9.53, 11.95, 1.45, BAND_WARM],
    [-4.97, 9.28, 1.91, 12.52, BAND_COOL],
    [-3.73, -2.99, 12.59, 1.91, BAND_COOL],
    [-13.81, 2.35, 1.10, 6.15, BAND_DEEP],
    [-2.83, -12.02, 6.72, 1.10, BAND_DEEP],
    [-2.88, 6.42, 2.58, 9.12, BAND_WARM],
    [-0.37, 6.52, 2.55, 9.37, BAND_COOL],
  ];
  for (const [x0, z0, lenX, lenZ, hex] of bands) {
    patch(batch, x0, z0, lenX, lenZ, hex, layer);
    layer += 0.002;
  }

  // Two painted floor marks, held below the units' saturation.
  patch(batch, -4.31, -3.32, 2.6, 1.3, "#553f4b", layer);
  patch(batch, -4.66, 4.7, 1.7, 1.15, "#354a4c", layer + 0.002);
  layer += 0.006;

  // Left market stack.
  stack(batch, {
    base: { center: [-6.53, 1.43, 3.60], size: [4.03, 2.86, 4.35], wall: WALL_A },
    roof: ROOF_A,
    upper: { center: [-5.92, 3.74, 3.45], size: [2.55, 1.47, 2.90], wall: WALL_B },
  });
  batch.add(box(0.08, 0.62, 2.6), INK, { at: [-4.47, 1.9, 3.5] });
  batch.add(box(0.1, 0.55, 1.8), INK, { at: [-4.61, 3.92, 3.45] });
  batch.add(box(2.0, 0.55, 0.08), INK, { at: [-6.9, 2.2, 5.8] });
  // Awnings: big clean colour blocks, the flat register's substitute for grime.
  // Each tilts about the axis that drops its OUTER edge — a +X-face awning
  // banks about Z, a +Z-face awning about X. Tilting the wrong axis is what
  // makes them read as planks floating beside the wall instead of shade.
  batch.add(box(0.8, 0.09, 2.4), AWNING, { at: [-4.16, 2.44, 3.5], rot: [0, 0, -0.3] });
  batch.add(box(2.0, 0.09, 0.8), AWNING, { at: [-6.8, 2.44, 6.05], rot: [-0.3, 0, 0] });
  batch.addEmit(box(0.06, 0.09, 1.15), SIGN_WARM, { at: [-4.44, 3.7, 3.4] });
  batch.addEmit(box(1.3, 0.06, 0.06), SIGN_WARM, { at: [-7.0, 1.94, 5.75] });

  // Right foundry / clinic block.
  stack(batch, {
    base: { center: [3.80, 1.58, -6.46], size: [4.03, 3.15, 3.71], wall: WALL_C },
    roof: ROOF_B,
    upper: { center: [3.10, 3.94, -6.10], size: [2.48, 1.30, 2.05], wall: WALL_A },
  });
  batch.add(box(1.9, 0.5, 0.08), INK, { at: [3.4, 2.1, -4.55] });
  batch.add(box(0.08, 0.5, 1.5), INK, { at: [5.83, 2.3, -6.2] });
  batch.add(box(2.1, 0.09, 0.8), AWNING, { at: [3.5, 2.64, -4.25], rot: [0.3, 0, 0] });
  batch.addEmit(box(0.06, 0.07, 1.0), SIGN_COOL, { at: [5.87, 2.24, -6.2] });
  batch.addEmit(box(0.7, 0.08, 0.06), SIGN_WARM, { at: [2.95, 3.95, -5.0] });

  // Rear platform + vent drums.
  batch.add(box(5.94, 0.14, 4.31), DECK, { at: [-5.92, 0.07, -6.28] });
  patch(batch, -8.41, -4.24, 5.27, 3.71, BAND_DEEP, 0.15);
  for (const [x, z] of [[-8.0, -4.6], [-6.6, -5.6], [-5.2, -6.4], [-4.4, -5.0]] as const) {
    batch.add(taper(0.42, 0.5, 0.42, 6), "#4f4859", { at: [x, 0.35, z] });
    batch.add(taper(0.46, 0.46, 0.06, 6), "#33303f", { at: [x, 0.57, z] });
  }

  // Antenna masts — thin dark verticals that break the boxy roof line.
  for (const [x, y, z] of [[-6.7, 5.05, 2.6], [-5.3, 5.15, 3.9], [2.2, 5.1, -6.8], [3.9, 5.2, -5.6]] as const) {
    batch.add(box(0.07, 0.95, 0.07), INK, { at: [x, y, z] });
    batch.add(box(0.24, 0.07, 0.05), ROOF_B, { at: [x + 0.14, y + 0.36, z] });
  }

  // Cable run across the lane, with hanging canopy panels.
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-5.8, 4.45, 4.7),
    new THREE.Vector3(-0.7, 6.9, -0.4),
    new THREE.Vector3(4.3, 4.6, -5.2),
  );
  batch.add(new THREE.TubeGeometry(curve, 40, 0.05, 5, false), INK);
  for (const t of [0.3, 0.5, 0.7]) {
    const at = curve.getPoint(t);
    batch.add(box(1.0, 0.08, 0.78), "#383246", { at: [at.x, at.y - 1.4, at.z] });
  }

  // Pallets and crates: clean solids, no spilled debris.
  for (const [cx, cz, sx, sz] of [[-1.755, 3.13, 1.13, 1.06], [2.99, -1.52, 1.10, 1.13]] as const) {
    batch.add(box(sx, 0.16, sz), CRATE, { at: [cx, 0.08, cz] });
    batch.add(box(sx * 0.56, 0.04, sz * 0.54), CRATE_TOP, { at: [cx, 0.18, cz] });
  }
  batch.add(box(0.7, 0.68, 0.7), CRATE, { at: [2.4, 0.34, -4.1] });
  batch.add(box(0.58, 0.05, 0.58), CRATE_TOP, { at: [2.4, 0.7, -4.1] });
  batch.add(box(0.46, 0.44, 0.48), CRATE, { at: [2.15, 0.9, -4.35], rot: [0, 0.3, 0] });
  batch.add(taper(0.28, 0.28, 0.66, 8), "#4e4a5e", { at: [-2.7, 0.33, 4.2] });
  batch.add(taper(0.3, 0.3, 0.06, 8), "#33303f", { at: [-2.7, 0.68, 4.2] });

  const group = new THREE.Group();
  let meshes = 0;
  for (const mesh of batch.bake()) {
    mesh.frustumCulled = false;
    group.add(mesh);
    meshes += 1;
  }
  return { cost: { meshes, triangles: batch.triangles }, group };
}
