/**
 * THROWAWAY PROTOTYPE (#81): mount/teardown for the real-time 3D lane.
 * Fixed-angle 2:1 dimetric orthographic camera (30° elevation, 45°
 * azimuth — the exact angles that project a floor square to a 2:1
 * diamond). The camera translates only, never rotates; the motion run
 * reproduces PR #79's stepped three-key pan. MSAA only (antialias:
 * true), no TAA, pixelRatio forced to 1 for honest pixel density.
 */

import * as THREE from "three";

import { buildBoard, type GritMode } from "./board3d.ts";
import { applyMedicPose, buildMedic, type MedicAnim } from "./medic3d.ts";

export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 270;
export const LOUPE_WIDTH = 210;
export const LOUPE_HEIGHT = 272;

const PX_PER_UNIT = 40;
const LOUPE_PX_PER_UNIT = 120;

/** Screen-right and screen-up unit vectors of the dimetric camera, in world space. */
const RIGHT = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const UP = new THREE.Vector3(-0.35355, 0.86603, -0.35355);
const VIEW = new THREE.Vector3(0.61237, 0.5, 0.61237);

/** PR #79's camera pan, re-based to the controlled-still framing (px offsets, steps(28) over 4s). */
const PAN_KEYS: Array<[number, number, number]> = [
  [0, -118, -26],
  [0.08, -118, -26],
  [0.48, 22, 6],
  [0.58, 22, 6],
  [0.92, 118, 30],
  [1, 118, 30],
];

function panOffset(t: number, out: THREE.Vector3): void {
  const cycle = (t % 4) / 4;
  const stepped = Math.floor(cycle * 28) / 28;
  let dx = 118;
  let dy = 30;
  for (let i = 0; i < PAN_KEYS.length - 1; i += 1) {
    const from = PAN_KEYS[i];
    const to = PAN_KEYS[i + 1];
    if (from === undefined || to === undefined) { continue; }
    if (stepped >= from[0] && stepped <= to[0]) {
      const span = to[0] - from[0];
      const mix = span === 0 ? 0 : (stepped - from[0]) / span;
      dx = from[1] + (to[1] - from[1]) * mix;
      dy = from[2] + (to[2] - from[2]) * mix;
      break;
    }
  }
  out.set(0, 0, 0)
    .addScaledVector(RIGHT, dx / PX_PER_UNIT)
    .addScaledVector(UP, -dy / PX_PER_UNIT);
}

function makeLights(): THREE.Object3D[] {
  // Key from screen upper-right, matching the SVG board: tops brightest,
  // +X (screen lower-right) walls mid, +Z (lower-left) walls in shadow.
  const key = new THREE.DirectionalLight("#fdeeda", 12);
  key.position.set(3.2, 4.0, 0.2);
  const ambient = new THREE.AmbientLight("#c9aec0", 1.9);
  return [key, ambient];
}

export type { GritMode, MedicAnim };

export interface MountOptions {
  anim: MedicAnim;
  motion: boolean;
  /** Deterministic capture: render exactly this clock value and stop. */
  freezeMs?: number;
  zoom?: number;
  /** Round-2 wear treatment A/B: decal-heavy, geometry-chip-heavy, or both. */
  grit?: GritMode;
}

export interface Realtime3dHandle {
  setAnim: (anim: MedicAnim) => void;
  setMotion: (motion: boolean) => void;
  destroy: () => void;
  /** The stage canvas, for capture. */
  canvas: HTMLCanvasElement;
  /** Render one deterministic frame at clock `t` seconds — filmstrip driver. */
  renderAt: (t: number) => void;
}

export function mountRealtime3d(
  stageHost: HTMLElement,
  loupeHost: HTMLElement | null,
  options: MountOptions,
): Realtime3dHandle {
  let anim = options.anim;
  let motion = options.motion;
  const zoom = options.zoom ?? 1;
  const grit = options.grit ?? "both";

  // preserveDrawingBuffer is required for capture: WebGL clears the drawing
  // buffer on composite, so `canvas.toDataURL()` on a default context returns
  // a blank image and element screenshots come back empty.
  const stageRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  stageRenderer.setPixelRatio(1);
  stageRenderer.setSize(STAGE_WIDTH, STAGE_HEIGHT);
  stageRenderer.setClearColor("#120b10");
  stageHost.append(stageRenderer.domElement);

  const stageScene = new THREE.Scene();
  stageScene.add(...makeLights());
  stageScene.add(buildBoard(grit));
  const medic = buildMedic();
  stageScene.add(medic.root);

  // Flat comic drop shadow; follows the root without inheriting its yaw.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: "#120b10", opacity: 0.5, transparent: true }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(0.55, 0.38, 1);
  shadow.position.y = 0.012;
  stageScene.add(shadow);

  // Still framing: feet at viewport (247, 209) like the pixel lane's
  // controlled still — the camera aims up-left of the rig so the rig sits
  // in the lower-right third.
  const target = new THREE.Vector3()
    .addScaledVector(RIGHT, -7 / PX_PER_UNIT)
    .addScaledVector(UP, 74 / PX_PER_UNIT);
  const basePosition = target.clone().addScaledVector(VIEW, 22);

  const halfW = STAGE_WIDTH / (2 * PX_PER_UNIT * zoom);
  const halfH = STAGE_HEIGHT / (2 * PX_PER_UNIT * zoom);
  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 60);
  camera.position.copy(basePosition);
  camera.lookAt(target);

  // Loupe: a second scene with its own rig at 3× for inspection only.
  let loupeRenderer: THREE.WebGLRenderer | undefined;
  let loupeScene: THREE.Scene | undefined;
  let loupeCamera: THREE.OrthographicCamera | undefined;
  let loupeMedic: ReturnType<typeof buildMedic> | undefined;
  if (loupeHost !== null) {
    loupeRenderer = new THREE.WebGLRenderer({ antialias: true });
    loupeRenderer.setPixelRatio(1);
    loupeRenderer.setSize(LOUPE_WIDTH, LOUPE_HEIGHT);
    loupeRenderer.setClearColor("#231b23");
    loupeHost.append(loupeRenderer.domElement);

    loupeScene = new THREE.Scene();
    loupeScene.add(...makeLights());
    loupeMedic = buildMedic();
    loupeScene.add(loupeMedic.root);
    const puck = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshBasicMaterial({ color: "#1b141b" }));
    puck.rotation.x = -Math.PI / 2;
    loupeScene.add(puck);

    const loupeTarget = new THREE.Vector3(0, 0.78, 0);
    const lHalfW = LOUPE_WIDTH / (2 * LOUPE_PX_PER_UNIT);
    const lHalfH = LOUPE_HEIGHT / (2 * LOUPE_PX_PER_UNIT);
    loupeCamera = new THREE.OrthographicCamera(-lHalfW, lHalfW, lHalfH, -lHalfH, 0.1, 60);
    loupeCamera.position.copy(loupeTarget).addScaledVector(VIEW, 12);
    loupeCamera.lookAt(loupeTarget);
  }

  const pan = new THREE.Vector3();
  const start = performance.now();
  let frame = 0;

  const renderAt = (t: number): void => {
    const activeAnim: MedicAnim = motion ? "turn" : anim;
    applyMedicPose(medic, activeAnim, t);
    if (loupeMedic !== undefined) { applyMedicPose(loupeMedic, activeAnim, t); }
    shadow.position.x = medic.root.position.x;
    shadow.position.z = medic.root.position.z;

    if (motion) {
      panOffset(t, pan);
      camera.position.copy(basePosition).add(pan);
    } else {
      camera.position.copy(basePosition);
    }

    stageRenderer.render(stageScene, camera);
    if (loupeRenderer !== undefined && loupeScene !== undefined && loupeCamera !== undefined) {
      loupeRenderer.render(loupeScene, loupeCamera);
    }
  };

  const freezeMs = options.freezeMs;
  if (freezeMs === undefined) {
    const tick = (): void => {
      renderAt((performance.now() - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  } else {
    renderAt(freezeMs / 1000);
  }

  const disposeScene = (scene: THREE.Scene): void => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        (object.geometry as THREE.BufferGeometry).dispose();
      }
    });
  };

  return {
    canvas: stageRenderer.domElement,
    destroy: () => {
      cancelAnimationFrame(frame);
      disposeScene(stageScene);
      stageRenderer.dispose();
      stageRenderer.domElement.remove();
      if (loupeScene !== undefined) { disposeScene(loupeScene); }
      if (loupeRenderer !== undefined) {
        loupeRenderer.dispose();
        loupeRenderer.domElement.remove();
      }
    },
    renderAt,
    setAnim: (next) => {
      anim = next;
      if (freezeMs !== undefined) { renderAt(freezeMs / 1000); }
    },
    setMotion: (next) => {
      motion = next;
      if (freezeMs !== undefined) { renderAt(freezeMs / 1000); }
    },
  };
}
