import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

import { type Clip, poseAt } from "./motion.ts";

export type Role = "medic" | "breacher" | "ranger";
export type Faction = "teal" | "rust";

const INK = "#171c20";
const PAPER = "#ded5b9";
const materialCache = new Map<string, THREE.MeshToonMaterial>();
const ramp = new THREE.DataTexture(new Uint8Array([82, 150, 218, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;
const outline = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const painted = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });

/** Each articulated joint becomes two draws, regardless of the number of costume marks. */
function batchJointPaint(group: THREE.Group) {
  for (const child of [...group.children]) {
    if (child instanceof THREE.Group) { batchJointPaint(child); }
  }
  const colors: THREE.BufferGeometry[] = [];
  const contours: THREE.BufferGeometry[] = [];
  const originals = new Set<THREE.BufferGeometry>();
  const collect = (mesh: THREE.Mesh, parentMatrix: THREE.Matrix4) => {
    mesh.updateMatrix();
    const matrix = parentMatrix.clone().multiply(mesh.matrix);
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.deleteAttribute("uv");
    geometry.applyMatrix4(matrix);
    originals.add(mesh.geometry);
    if (mesh.material instanceof THREE.MeshToonMaterial) {
      const values = new Float32Array(geometry.getAttribute("position").count * 3);
      for (let i = 0; i < values.length; i += 3) { mesh.material.color.toArray(values, i); }
      geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
      colors.push(geometry);
    } else { contours.push(geometry); }
    for (const child of mesh.children) {
      if (child instanceof THREE.Mesh) { collect(child, matrix); }
    }
  };
  for (const child of [...group.children]) {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshToonMaterial) {
      collect(child, new THREE.Matrix4());
      group.remove(child);
    }
  }
  for (const [geometries, material] of [[colors, painted], [contours, outline]] as const) {
    if (!geometries.length) { continue; }
    const geometry = mergeGeometries(geometries);
    if (geometry) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = material === painted;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const item of geometries) { item.dispose(); }
  }
  for (const geometry of originals) { geometry.dispose(); }
}

function mat(color: string) {
  let material = materialCache.get(color);
  if (!material) {
    material = new THREE.MeshToonMaterial({ color, gradientMap: ramp });
    materialCache.set(color, material);
  }
  return material;
}

/** Hull outlines, hard normals and nonuniform sections give the figure a drawn silhouette. */
function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, ink = true) {
  const mesh = new THREE.Mesh(geometry, mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (ink) {
    const edge = new THREE.Mesh(geometry, outline);
    edge.scale.setScalar(1.055);
    mesh.add(edge);
  }
  parent.add(mesh);
  return mesh;
}
function box(parent: THREE.Object3D, color: string, size: number[], at: number[], ink = true) {
  return part(parent, new THREE.BoxGeometry(size[0], size[1], size[2]), color, at[0] ?? 0, at[1] ?? 0, at[2] ?? 0, ink);
}
function taper(parent: THREE.Object3D, color: string, top: number, bottom: number, height: number, depth: number, at: number[], sides = 6) {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, sides, 1);
  geometry.scale(1, 1, depth);
  return part(parent, geometry, color, at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);
}
function hull(parent: THREE.Object3D, color: string, points: number[][], at = [0, 0, 0]) {
  return part(parent, new ConvexGeometry(points.map((point) => new THREE.Vector3(point[0], point[1], point[2]))), color, at[0] ?? 0, at[1] ?? 0, at[2] ?? 0);
}
function joint(parent: THREE.Object3D, x: number, y: number, z: number) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}
function scratch(parent: THREE.Object3D, x: number, y: number, z: number, length: number, angle: number, color = PAPER) {
  const stripe = box(parent, color, [length, 0.014, 0.006], [x, y, z], false);
  stripe.rotation.z = angle;
}

export function buildFigure(role: Role, faction: Faction, hero: boolean, variation = 0) {
  const root = new THREE.Group();
  const accent = faction === "teal" ? "#407b77" : "#a14f3b";
  const coatColor = hero ? "#243638" : faction === "teal" ? "#36494a" : "#53413b";
  const cloth = "#31343b";
  const steel = "#8e9997";
  const skin = variation % 2 ? "#aa7858" : "#ba9775";
  const hip = joint(root, 0, 1.04, 0);
  taper(hip, cloth, 0.22, 0.25, 0.26, 0.72, [0, 0.01, 0]);
  const chest = joint(hip, 0, 0.22, 0);
  taper(chest, coatColor, 0.31, 0.175, 0.57, 0.65, [0, 0.24, 0]);
  box(chest, INK, [0.5, 0.08, 0.3], [0, -0.015, 0]);
  box(chest, steel, [0.09, 0.075, 0.04], [0.035, -0.012, 0.166]);
  // Offset ivory breastplate and dark diagonal load-bearing strap: three big value zones.
  const plate = hull(chest, role === "medic" ? PAPER : accent, [[-0.15, 0.18, 0], [0.1, 0.15, 0], [0.12, -0.1, 0], [-0.09, -0.16, 0], [-0.14, 0.17, 0.065], [0.09, 0.14, 0.065], [0.1, -0.09, 0.065], [-0.085, -0.15, 0.065]], [-0.08, 0.29, 0.175]);
  plate.rotation.z = -0.07;
  const strap = box(chest, "#222b2d", [0.085, 0.54, 0.08], [0.07, 0.24, 0.2]);
  strap.rotation.z = -0.38;
  for (let i = 0; i < 3; i++) {
    box(chest, "#8c7963", [0.085, 0.13, 0.105], [-0.19 + i * 0.17, 0.035, 0.23]);
    scratch(chest, -0.19 + i * 0.17, 0.06, 0.287, 0.055, 0, "#b5ab91");
  }
  if (role === "medic") {
    box(chest, accent, [0.09, 0.042, 0.012], [-0.11, 0.31, 0.251], false);
    box(chest, accent, [0.032, 0.11, 0.012], [-0.11, 0.31, 0.252], false);
  }
  scratch(chest, -0.15, 0.39, 0.249, 0.07, 0.33, "#6b726a");
  scratch(chest, -0.04, 0.21, 0.249, 0.045, -0.6, "#6b726a");
  // Backpack never crosses the neck; its canisters break the rear silhouette.
  box(chest, "#5b6056", [0.38, 0.41, 0.23], [0, 0.24, -0.23]);
  box(chest, accent, [0.3, 0.09, 0.24], [0, 0.34, -0.24]);
  taper(chest, steel, 0.065, 0.065, 0.27, 1, [-0.25, 0.17, -0.21]);
  taper(chest, "#b9ad8e", 0.06, 0.06, 0.22, 1, [0.24, 0.14, -0.21]);
  if (role === "medic") {
    // A large slung trauma bag is the medic's one asymmetric silhouette anchor.
    const bag = hull(chest, "#87735a", [[-0.22, 0.19, -0.11], [0.17, 0.16, -0.11], [0.2, -0.21, -0.1], [-0.18, -0.25, -0.1], [-0.19, 0.16, 0.12], [0.15, 0.14, 0.12], [0.16, -0.18, 0.14], [-0.16, -0.22, 0.14]], [-0.37, -0.08, -0.06]);
    bag.rotation.z = -0.14;
    box(bag, PAPER, [0.18, 0.15, 0.01], [-0.015, 0.015, 0.145]);
    box(bag, accent, [0.1, 0.03, 0.015], [-0.015, 0.015, 0.155]);
    box(bag, accent, [0.03, 0.09, 0.015], [-0.015, 0.015, 0.156]);
  }
  const head = joint(chest, 0, 0.72, 0.012);
  taper(chest, INK, 0.095, 0.12, 0.17, 0.9, [0, 0.59, 0.01]);
  taper(head, skin, 0.205, 0.145, 0.34, 0.88, [0, 0.02, 0.025], 5);
  // Asymmetrical wrapped hood, angular brow, nose, opaque respirator and exposed cheek.
  const hood = part(head, new THREE.SphereGeometry(0.238, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.54), accent, -0.008, 0.105, -0.034);
  hood.scale.set(1, 0.86, 0.96);
  hood.rotation.z = -0.12;
  hull(head, coatColor, [[-0.23, 0.16, -0.18], [0.21, 0.16, -0.18], [-0.22, -0.19, -0.12], [0.16, -0.15, -0.12], [-0.2, 0.11, 0.08], [0.2, 0.11, 0.08], [-0.17, -0.15, 0.03], [0.15, -0.14, 0.03]]);
  hull(head, "#263137", [[-0.21, 0.17, 0.12], [0.19, 0.14, 0.12], [-0.2, 0.105, 0.22], [0.19, 0.08, 0.22], [-0.21, 0.13, 0.12], [0.19, 0.1, 0.12]]);
  box(head, "#98beb4", [0.12, 0.037, 0.014], [-0.085, 0.109, 0.216], false);
  box(head, "#647a77", [0.08, 0.025, 0.014], [0.087, 0.109, 0.216], false);
  box(head, skin, [0.065, 0.09, 0.08], [0.012, 0.037, 0.185]);
  hull(head, "#3a4242", [[-0.1, 0.02, 0.12], [0.13, 0.015, 0.12], [-0.075, -0.14, 0.12], [0.08, -0.14, 0.12], [-0.08, -0.02, 0.23], [0.12, -0.035, 0.22], [-0.055, -0.12, 0.21], [0.065, -0.14, 0.2]]);
  for (let i = 0; i < 3; i++) { box(head, "#bbc0ad", [0.014, 0.042, 0.006], [0.002 + i * 0.034, -0.068, 0.225], false); }
  box(head, "#aea892", [0.075, 0.03, 0.012], [-0.147, 0.023, 0.158], false).rotation.z = -0.4;
  taper(head, INK, 0.08, 0.08, 0.12, 1, [-0.23, 0.06, 0]);
  const filter = taper(head, "#a4a58f", 0.065, 0.052, 0.065, 1, [0.15, -0.08, 0.16], 7);
  filter.rotation.z = Math.PI / 2;
  if (role === "ranger") {
    const scarf = box(chest, accent, [0.14, 0.5, 0.045], [0.24, 0.34, -0.08]);
    scarf.rotation.z = -0.25;
  }
  const tails = [-1, 1].map((side) => {
    const tail = joint(chest, side * 0.18, 0.005, -0.07);
    const length = side < 0 ? 0.76 : 0.61;
    const panel = hull(tail, coatColor, [[-0.095, 0, -0.065], [0.1, 0, -0.065], [-0.16, -length + 0.06, -0.15], [0.16, -length, -0.13], [-0.09, 0, 0.07], [0.1, 0, 0.065], [-0.17, -length + 0.055, 0.065], [0.18, -length + 0.015, 0.045]]);
    panel.rotation.z = side * 0.085;
    scratch(tail, side * 0.06, -length + 0.16, 0.072, 0.08, 0.3, accent);
    return tail;
  });
  const legs = [-1, 1].map((side) => {
    const thigh = joint(hip, side * 0.155, -0.055, 0);
    taper(thigh, cloth, 0.132, 0.105, 0.44, 0.85, [0, -0.2, 0]);
    const knee = joint(thigh, 0, -0.42, 0);
    taper(knee, coatColor, 0.11, 0.083, 0.4, 0.92, [0, -0.185, 0]);
    box(knee, steel, [0.15, 0.17, 0.07], [0, -0.01, 0.094]);
    scratch(knee, 0.009, 0.02, 0.135, 0.08, -0.2);
    const ankle = joint(knee, 0, -0.38, 0);
    hull(ankle, "#222629", [[-0.1, -0.08, -0.105], [0.1, -0.08, -0.105], [-0.105, -0.08, 0.25], [0.105, -0.08, 0.25], [-0.075, 0.1, -0.09], [0.075, 0.1, -0.09], [-0.08, 0.025, 0.235], [0.08, 0.025, 0.235]]);
    hull(ankle, "#88887a", [[-0.086, 0.03, 0.14], [0.086, 0.03, 0.14], [-0.075, 0.042, 0.23], [0.075, 0.042, 0.23], [-0.095, -0.035, 0.248], [0.095, -0.035, 0.248]]);
    return { thigh, knee, ankle };
  });
  const arms = [-1, 1].map((side) => {
    const shoulder = joint(chest, side * 0.385, 0.46, 0);
    shoulder.rotation.z = side * 0.14;
    taper(shoulder, coatColor, 0.105, 0.065, 0.34, 0.95, [0, -0.135, 0]);
    hull(shoulder, role === "breacher" ? accent : PAPER, [[side * -0.13, 0.075, -0.12], [side * 0.19, -0.035, -0.1], [side * -0.12, 0.065, 0.13], [side * 0.2, -0.05, 0.11], [side * -0.1, -0.1, -0.1], [side * 0.16, -0.16, -0.08], [side * -0.1, -0.09, 0.11], [side * 0.16, -0.17, 0.1]]);
    scratch(shoulder, 0, -0.02, 0.16, 0.12, side * 0.3, "#777c70");
    const elbow = joint(shoulder, 0, -0.31, 0);
    taper(elbow, side === 1 ? steel : coatColor, 0.075, 0.064, 0.3, 0.9, [0, -0.14, 0]);
    taper(elbow, accent, 0.085, 0.075, 0.1, 0.9, [0, -0.2, 0]);
    taper(elbow, "#292e2f", 0.073, 0.069, 0.16, 0.95, [0, -0.325, 0.023]);
    return { shoulder, elbow };
  });
  if (role === "breacher") {
    // A battered forearm shield changes the contour, not merely the paint.
    const shield = box(arms[0]!.elbow, accent, [0.36, 0.59, 0.09], [-0.12, -0.13, 0.1]);
    shield.rotation.z = -0.1;
    box(shield, PAPER, [0.28, 0.065, 0.012], [0, 0.12, 0.055]);
    box(shield, INK, [0.2, 0.035, 0.012], [0, 0.03, 0.055]);
    scratch(shield, -0.065, -0.13, 0.055, 0.14, 0.6);
    scratch(shield, 0.075, -0.19, 0.055, 0.09, 0.7);
    box(arms[1]!.shoulder, accent, [0.32, 0.13, 0.35], [0.04, 0.04, 0]);
  }
  // A forward-pointing tool in hand-local coordinates; shoulder aim raises its barrel.
  const gun = joint(arms[1]!.elbow, 0, -0.32, 0.065);
  gun.rotation.x = Math.PI / 2;
  box(gun, INK, [0.14, 0.14, 0.42], [0, 0, 0.11]);
  box(gun, "#879086", [0.145, 0.12, 0.22], [0, 0.026, 0.2]);
  box(gun, accent, [0.16, 0.17, 0.14], [0, -0.025, 0.03]);
  box(gun, "#d5c5a3", [0.08, 0.045, 0.2], [0, 0.09, 0.15]);
  box(gun, INK, [0.075, 0.075, 0.18], [0, 0.015, 0.38]);
  hull(gun, "#6f7c74", [[-0.075, 0.085, 0.24], [0.075, 0.085, 0.24], [-0.06, 0.06, 0.57], [0.06, 0.06, 0.57], [-0.075, -0.065, 0.24], [0.075, -0.065, 0.24], [-0.052, -0.055, 0.57], [0.052, -0.055, 0.57]]);
  box(gun, INK, [0.06, 0.06, 0.2], [0, 0.01, 0.62]);
  box(gun, "#ba8e54", [0.07, 0.065, 0.06], [0, 0.01, 0.73]);
  box(gun, INK, [0.09, 0.23, 0.075], [0, -0.12, -0.065]).rotation.x = -0.25;
  hull(gun, "#665c4e", [[-0.065, 0.045, -0.1], [0.065, 0.045, -0.1], [-0.08, 0.075, -0.24], [0.08, 0.075, -0.24], [-0.065, -0.08, -0.1], [0.065, -0.08, -0.1], [-0.08, -0.11, -0.24], [0.08, -0.11, -0.24]]);
  if (role === "ranger") {
    box(gun, "#394847", [0.06, 0.06, 0.52], [0, 0.015, 0.8]);
    box(gun, INK, [0.08, 0.08, 0.19], [0, 0.14, 0.11]);
    box(gun, "#c0d2b8", [0.065, 0.06, 0.012], [0, 0.14, 0.212]);
  }
  const muzzle = joint(gun, 0, 0.015, role === "ranger" ? 1.12 : 0.82);
  const flash = part(muzzle, new THREE.OctahedronGeometry(0.19), "#fff2c1", 0, 0, 0, false);
  flash.scale.set(0.6, 0.65, 2.3);
  const flashOuter = part(muzzle, new THREE.OctahedronGeometry(0.15), "#df9a55", 0, 0, 0.1, false);
  flashOuter.scale.set(1.2, 0.7, 2.4);
  muzzle.visible = false;
  if (hero) { root.scale.setScalar(1.18); }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(hero ? 0.5 : 0.37, 24), new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.2, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  root.add(shadow);
  if (hero) {
    const marking = new THREE.Mesh(new THREE.RingGeometry(0.51, 0.54, 32), new THREE.MeshBasicMaterial({ color: accent, side: THREE.DoubleSide }));
    marking.rotation.x = -Math.PI / 2;
    marking.position.y = 0.013;
    root.add(marking);
  }
  batchJointPaint(root);
  return { root, hip, chest, head, legs, arms, tails, muzzle, role, faction, hero };
}
export type Figure = ReturnType<typeof buildFigure>;

export function animateFigure(figure: Figure, clip: Clip, seconds: number, phase = 0) {
  const pose = poseAt(clip, seconds, phase);
  const sole = (thigh: number, knee: number) => -0.055 - 0.42 * Math.cos(thigh) - 0.38 * Math.cos(thigh + knee) - 0.08;
  // The lower sole stays on the board. Ankles counter-rotate independently of knees.
  figure.hip.position.y = 0.013 - Math.min(sole(pose.leftHip, pose.leftKnee), sole(pose.rightHip, pose.rightKnee));
  figure.chest.position.y = 0.22 + pose.bob * 0.3;
  figure.hip.position.x = pose.hipX;
  figure.chest.rotation.set(pose.torsoX, pose.torsoY, pose.torsoZ);
  figure.head.rotation.y = pose.headY;
  figure.legs[0]!.thigh.rotation.x = pose.leftHip;
  figure.legs[1]!.thigh.rotation.x = pose.rightHip;
  figure.legs[0]!.knee.rotation.x = pose.leftKnee;
  figure.legs[1]!.knee.rotation.x = pose.rightKnee;
  figure.legs[0]!.thigh.position.x = -0.155 - pose.brace * 0.055;
  figure.legs[1]!.thigh.position.x = 0.155 + pose.brace * 0.055;
  figure.legs[0]!.ankle.rotation.x = -pose.leftHip - pose.leftKnee;
  figure.legs[1]!.ankle.rotation.x = -pose.rightHip - pose.rightKnee;
  figure.arms[0]!.shoulder.rotation.x = pose.leftShoulder;
  figure.arms[1]!.shoulder.rotation.x = pose.rightShoulder;
  figure.arms[0]!.elbow.rotation.x = pose.leftElbow;
  figure.arms[1]!.elbow.rotation.x = pose.rightElbow;
  figure.arms[0]!.shoulder.rotation.z = -0.14 + pose.brace * 0.92;
  figure.arms[0]!.elbow.rotation.z = pose.brace * 0.3;
  figure.arms[1]!.shoulder.rotation.z = 0.14 - pose.brace * 0.1;
  figure.tails[0]!.rotation.x = pose.coat;
  figure.tails[1]!.rotation.x = -pose.coat * 0.8;
  figure.muzzle.visible = pose.muzzle;
  return pose;
}

export function disposeFigureResources() {
  for (const material of materialCache.values()) { material.dispose(); }
  materialCache.clear();
}
