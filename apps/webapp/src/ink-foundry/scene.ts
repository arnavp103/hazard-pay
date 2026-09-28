import * as THREE from "three";

import { createEffects } from "./effects.ts";
import { animateFigure, buildFigure, type Figure, type Role } from "./figure.ts";
import { type Clip } from "./motion.ts";

export type View = "hero" | "crowd" | "lineup";
export interface SceneOptions { view: View; clip: Clip; frozen: number | null; stepped: boolean }
export interface SceneStats { seconds: number; calls: number; triangles: number; bodies: number }

const C = { ground: "#aca897", dark: "#292e31", wall: "#727970", paper: "#d8cdb0", rust: "#a15b40", teal: "#487a76" };

function basic(color: string) { return new THREE.MeshLambertMaterial({ color, flatShading: true }); }
function block(parent: THREE.Object3D, width: number, height: number, depth: number, x: number, y: number, z: number, color: string) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), basic(color));
  mesh.position.set(x, y, z);
  mesh.receiveShadow = mesh.castShadow = true;
  parent.add(mesh);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color: "#3b403e" }));
  mesh.add(edges);
  return mesh;
}

function groundMark(parent: THREE.Object3D, x: number, z: number, width: number, depth: number, color: string, turn = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ color }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = turn;
  mesh.position.set(x, 0.014, z);
  parent.add(mesh);
}

function buildSet(scene: THREE.Scene, view: View) {
  const group = new THREE.Group();
  scene.add(group);
  const width = view === "crowd" ? 24 : view === "lineup" ? 17 : 9;
  const depth = view === "crowd" ? 18 : 8;
  block(group, width, 0.3, depth, 0, -0.17, 0, C.ground);
  // Poured-concrete seams and deliberate uneven scuff clusters, all code-authored.
  for (let x = -width / 2 + 2; x < width / 2; x += 2.5) { groundMark(group, x, 0, 0.018, depth, "#929183"); }
  for (let z = -depth / 2 + 2; z < depth / 2; z += 2.5) { groundMark(group, 0, z, width, 0.018, "#929183"); }
  for (let i = 0; i < 70; i++) {
    const x = Math.sin(i * 73.21) * (width / 2 - 0.4);
    const z = Math.cos(i * 39.13) * (depth / 2 - 0.4);
    groundMark(group, x, z, 0.06 + (i % 5) * 0.11, 0.016 + (i % 3) * 0.013, i % 2 ? "#bdb7a3" : "#8d9081", i * 0.63);
  }
  for (let i = 0; i < 15; i++) {
    groundMark(group, -width / 2 + 0.45 + i * 0.36, depth / 2 - 0.43, 0.18, 0.37, i % 2 ? C.dark : C.paper, 0.35);
  }
  // A low process wall frames the top left, leaving the character silhouette in air.
  block(group, width - 0.6, 0.45, 0.3, 0, 0.13, -depth / 2 + 0.25, C.wall);
  block(group, 0.35, 1.45, 0.4, -width / 2 + 0.45, 0.57, -depth / 2 + 0.28, C.dark);
  block(group, 0.35, 1.45, 0.4, width / 2 - 0.45, 0.57, -depth / 2 + 0.28, C.dark);
  for (const x of [-width / 2 + 1.25, width / 2 - 1.25]) {
    const crate = block(group, 1.05, 0.72, 0.85, x, 0.35, -depth / 2 + 1.1, C.teal);
    for (let s = -1; s <= 1; s += 2) { block(crate, 0.1, 0.75, 0.9, s * 0.33, 0, 0, C.dark); }
    block(crate, 0.28, 0.22, 0.02, 0, 0.06, 0.44, C.paper);
  }
  if (view === "crowd") {
    for (let i = 0; i < 5; i++) {
      const x = (i % 2 ? 1 : -1) * (1.4 + i * 0.55);
      const z = -5.3 + i * 2.65;
      block(group, 1.6, 0.67, 0.5, x, 0.31, z, i % 2 ? C.wall : C.rust);
      block(group, 1.68, 0.08, 0.55, x, 0.69, z, C.paper);
      for (let j = 0; j < 3; j++) { groundMark(group, x - 0.5 + j * 0.45, z + 0.4, 0.2, 0.2, C.dark, 0.5); }
    }
  } else if (view === "hero") {
    groundMark(group, 0, 0, 2.2, 0.028, "#d5c9a9");
    groundMark(group, 0, 0, 0.028, 2.2, "#d5c9a9");
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.12, 64), new THREE.MeshBasicMaterial({ color: C.paper, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);
  }
}

export function buildFoundryScene(view: View) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c6bda7");
  const camera = new THREE.OrthographicCamera();
  const direction = new THREE.Vector3(Math.sqrt(3 / 8), 0.5, Math.sqrt(3 / 8));
  const target = new THREE.Vector3(0, view === "hero" ? 0.95 : 0.35, 0);
  camera.position.copy(target).addScaledVector(direction, 40);
  camera.lookAt(target);
  camera.near = 0.1;
  camera.far = 100;
  scene.add(new THREE.HemisphereLight("#f6e8cf", "#465057", 2.2));
  const sun = new THREE.DirectionalLight("#fff3d0", 2.2);
  sun.position.set(-5, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 0.1, far: 40 });
  sun.shadow.bias = -0.001;
  scene.add(sun);
  buildSet(scene, view);
  const roster: { figure: Figure; effects: ReturnType<typeof createEffects>; x: number; z: number; yaw: number; phase: number; clip: Clip }[] = [];
  const roles: Role[] = ["medic", "breacher", "ranger"];
  const count = view === "crowd" ? 40 : view === "lineup" ? 6 : 1;
  for (let i = 0; i < count; i++) {
    const faction = view === "hero" || i < count / 2 ? "teal" : "rust";
    const hero = view === "hero" || i % (view === "crowd" ? 20 : 3) === 0;
    const figure = buildFigure(roles[i % 3]!, faction, hero, i);
    const x = view === "crowd" ? (faction === "teal" ? -1 : 1) * (2.7 + (i % 4) * 1.55) : view === "lineup" ? (i - 2.5) * 1.85 : 0;
    const z = view === "crowd" ? (Math.floor((i % 20) / 4) - 2) * 2.5 + (i % 2) * 0.3 : view === "lineup" ? -(i - 2.5) * 1.85 : 0;
    const yaw = view === "crowd" ? (faction === "teal" ? 1 : -1) * Math.PI / 2 : -0.24;
    figure.root.position.set(x, 0, z);
    figure.root.rotation.y = yaw;
    scene.add(figure.root);
    roster.push({ figure, effects: createEffects(scene), x, z, yaw, phase: i * 0.267, clip: i % 7 === 0 ? "stagger" : i % 3 === 0 ? "walk" : "attack" });
  }
  return { scene, camera, roster, count, view };
}

export type FoundryScene = ReturnType<typeof buildFoundryScene>;

export function frameFoundryCamera(stage: FoundryScene, width: number, height: number) {
  const { camera, view } = stage;
  const baseSpan = view === "crowd" ? 18 : view === "lineup" ? 8.7 : 5.6;
  const minimumWidth = view === "crowd" ? 23 : view === "lineup" ? 15 : 3.2;
  const span = Math.max(baseSpan, minimumWidth * height / width);
  camera.left = -span * width / height / 2;
  camera.right = -camera.left;
  camera.top = span / 2;
  camera.bottom = -camera.top;
  camera.updateProjectionMatrix();
}

export function sampleFoundry(stage: FoundryScene, seconds: number, selectedClip: Clip, stepped = true) {
  const animationTime = stepped ? Math.floor(seconds * 12) / 12 : seconds;
  for (const unit of stage.roster) {
    const clip = stage.view === "crowd" ? unit.clip : selectedClip;
    const pose = animateFigure(unit.figure, clip, animationTime, stage.view === "crowd" ? unit.phase : 0);
    unit.figure.root.rotation.y = unit.yaw + pose.yaw;
    const walk = clip === "walk" && stage.view === "crowd" ? Math.sin(seconds * 0.58 + unit.phase) * 0.52 : 0;
    unit.figure.root.position.x = unit.x + walk;
    unit.figure.root.updateMatrixWorld(true);
    unit.effects.update(unit.figure, pose.shotAge);
  }
}

export function mountFoundry(host: HTMLElement, initial: SceneOptions, onFrame: (stats: SceneStats) => void) {
  const stage = buildFoundryScene(initial.view);
  const { scene, camera, count } = stage;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  let options = initial;
  let seconds = initial.frozen ?? 0;
  let previous = performance.now();
  let frame = 0;
  let request = 0;
  let disposed = false;
  let dirty = true;
  const resize = () => {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height);
    frameFoundryCamera(stage, width, height);
    dirty = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const render = () => {
    if (disposed) { return; }
    const now = performance.now();
    if (options.frozen !== null && !dirty) {
      previous = now;
      request = requestAnimationFrame(render);
      return;
    }
    if (options.frozen !== null) {
      seconds = options.frozen;
    } else {
      seconds += Math.min((now - previous) / 1000, 0.1);
    }
    previous = now;
    sampleFoundry(stage, seconds, options.clip, options.stepped);
    renderer.render(scene, camera);
    dirty = false;
    if (frame++ % 6 === 0 || options.frozen !== null) { onFrame({ seconds, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, bodies: count }); }
    request = requestAnimationFrame(render);
  };
  render();
  return {
    update(next: SceneOptions) {
      options = next;
      dirty = true;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(request);
      observer.disconnect();
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material); }
        }
      });
      for (const geometry of geometries) { geometry.dispose(); }
      for (const material of materials) { material.dispose(); }
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
