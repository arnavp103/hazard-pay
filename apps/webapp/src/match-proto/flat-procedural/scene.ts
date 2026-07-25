/**
 * THROWAWAY PROTOTYPE (#89): mount/teardown, camera, and the cost meter.
 *
 * Camera is the shared bake-off rig, unchanged from the #81 lane: a fixed
 * 2:1 dimetric orthographic camera at 30 degrees elevation / 45 degrees
 * azimuth, translation-only, MSAA and pixelRatio 1 for honest pixel density.
 * The variable under test in this lane is materials + animation, so the
 * scene plumbing is deliberately the same.
 *
 * Two views:
 *   hero   one unit at combat zoom, driven by a scripted controller
 *          (`idle`, `attack`, `walk`, `turn`).
 *   crowd  the seeded battle from sim.ts — ~40 units, two fodder archetypes
 *          plus heroes per side.
 *
 * Every render publishes a cost report on `window.__flatProceduralCost` so
 * the capture pass can read draw calls, triangles and frame budget at crowd
 * scale straight out of the page.
 */

import * as THREE from "three";

import { ALL_LAYERS, type LayerFlags, NO_LAYERS, UnitAnimator } from "./animator.ts";
import { authoredKeyTotal, BASE_KEY_COUNT, type BaseDensity } from "./authored.ts";
import { buildBoard } from "./board.ts";
import { buildUnit, type UnitRig } from "./figure.ts";
import { emitMaterial, flatLights, INK, litMaterial } from "./flat.ts";
import { clamp } from "./procedural.ts";
import { battleAt, createBattle, type SimUnit, stepBattle } from "./sim.ts";

export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 270;
const PX_PER_UNIT = 40;
/** The shared combat zoom the #81 lane settled on in round 2. */
export const COMBAT_ZOOM = 0.82;
export const CROWD_ZOOM = 0.42;

/** Screen-right and screen-up unit vectors of the dimetric camera, in world space. */
const RIGHT = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const UP = new THREE.Vector3(-0.35355, 0.86603, -0.35355);
const VIEW = new THREE.Vector3(0.61237, 0.5, 0.61237);

export type HeroAnim = "attack" | "idle" | "turn" | "walk";
export type SceneView = "crowd" | "hero";

export interface CostReport {
  view: SceneView;
  base: BaseDensity;
  authoredKeysPerClip: number;
  authoredKeysTotal: number;
  units: number;
  heroes: number;
  fodder: number;
  drawCalls: number;
  triangles: number;
  programs: number;
  boardMeshes: number;
  boardTriangles: number;
  meshesPerHero: number;
  meshesPerFodder: number;
  trianglesPerHero: number;
  trianglesPerFodder: number;
  stage: { width: number; height: number; zoom: number; pixelRatio: number };
  frameMs: { mean: number; p95: number; max: number; samples: number };
  fps: number;
}

export interface MountOptions {
  view?: SceneView;
  anim?: HeroAnim;
  base?: BaseDensity;
  layers?: LayerFlags;
  zoom?: number;
  /** Render one deterministic frame at this clock value (ms) and stop. */
  freezeMs?: number;
  /** Canvas multiplier; framing is unchanged, pixel density is not. */
  scale?: number;
  fodderPerSide?: number;
  heroesPerSide?: number;
  /** Camera pans across the encounter (translation only, never rotation). */
  motion?: boolean;
}

export interface FlatSceneHandle {
  destroy: () => void;
  cost: () => CostReport;
}

/** One merged mesh for every unit shadow — hard-edged, offset, 1 draw call. */
class ShadowField {
  readonly mesh: THREE.Mesh;
  private readonly positions: THREE.Float32BufferAttribute;
  private static readonly SEGMENTS = 6;

  constructor(count: number) {
    const vertices = count * ShadowField.SEGMENTS * 3;
    this.positions = new THREE.Float32BufferAttribute(new Float32Array(vertices * 3), 3);
    this.positions.setUsage(THREE.DynamicDrawUsage);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", this.positions);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: INK,
        depthWrite: false,
        opacity: 0.46,
        transparent: true,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  set(index: number, x: number, z: number, radius: number, y: number): void {
    const array = this.positions.array as Float32Array;
    const base = index * ShadowField.SEGMENTS * 9;
    for (let s = 0; s < ShadowField.SEGMENTS; s += 1) {
      const a0 = (s / ShadowField.SEGMENTS) * Math.PI * 2;
      const a1 = ((s + 1) / ShadowField.SEGMENTS) * Math.PI * 2;
      const at = base + s * 9;
      array[at] = x;
      array[at + 1] = y;
      array[at + 2] = z;
      // Squashed along the screen-vertical so the blob reads as ground-plane.
      array[at + 3] = x + Math.cos(a0) * radius;
      array[at + 4] = y;
      array[at + 5] = z + Math.sin(a0) * radius * 0.72;
      array[at + 6] = x + Math.cos(a1) * radius;
      array[at + 7] = y;
      array[at + 8] = z + Math.sin(a1) * radius * 0.72;
    }
  }

  commit(): void {
    this.positions.needsUpdate = true;
  }
}

function makeDrive(id: number): SimUnit {
  return {
    aimX: 0,
    aimY: 1.1,
    aimZ: 4,
    angularVelocity: 0,
    archetype: "medic",
    attackPhase: -1,
    ax: 0,
    az: 0,
    cooldown: 0,
    facing: 0,
    firedAt: -1,
    hitAt: -1,
    id,
    side: 0,
    speed: 0,
    targetId: -1,
    tier: "hero",
    vx: 0,
    vz: 0,
    x: 0,
    z: 0,
  };
}

/** Eight held facings with deliberately uneven dwells — a turn, not a turntable. */
const TURN_DWELLS = [0.66, 0.34, 0.5, 0.7, 0.3, 0.52, 0.6, 0.36];
const TURN_LOOP = TURN_DWELLS.reduce((sum, d) => sum + d, 0);

/**
 * Scripted hero drive. Pure function of `t` so every capture is repeatable,
 * and shaped exactly like a sim unit so the animator has one code path.
 */
function driveHero(unit: SimUnit, anim: HeroAnim, t: number): void {
  unit.hitAt = -1;
  if (anim === "idle") {
    unit.x = 0;
    unit.z = 0;
    unit.speed = 0;
    unit.vx = 0;
    unit.vz = 0;
    unit.ax = 0;
    unit.az = 0;
    unit.facing = 0;
    unit.angularVelocity = 0;
    unit.attackPhase = -1;
    // The idle gaze drifts between two points of interest — intent, not noise.
    const look = Math.sin((t / 5.4) * Math.PI * 2);
    unit.aimX = look * 3.2;
    unit.aimZ = 4.4;
    unit.aimY = 1.15;
    return;
  }

  if (anim === "attack") {
    unit.x = 0;
    unit.z = 0;
    unit.speed = 0;
    unit.vx = 0;
    unit.vz = 0;
    unit.ax = 0;
    unit.az = 0;
    unit.facing = 0;
    unit.angularVelocity = 0;
    unit.aimX = 0.15;
    unit.aimZ = 1.35;
    unit.aimY = 1.0;
    const cycle = 1.9;
    const local = t % cycle;
    unit.attackPhase = local < 1.15 ? local / 1.15 : -1;
    if (local >= 0.42 * 1.15 && local < 0.42 * 1.15 + 1 / 30) {
      unit.firedAt = Math.floor(t / cycle) + 1;
    }
    return;
  }

  if (anim === "walk") {
    // A slow circuit: stride tracks the tangential speed while aim stays
    // locked on a fixed point, so feet and gaze visibly decouple.
    const period = 9.5;
    const radius = 1.55;
    const omega = (Math.PI * 2) / period;
    const angle = t * omega;
    unit.x = Math.sin(angle) * radius;
    unit.z = Math.cos(angle) * radius - radius;
    unit.vx = Math.cos(angle) * radius * omega;
    unit.vz = -Math.sin(angle) * radius * omega;
    unit.speed = radius * omega;
    unit.ax = -Math.sin(angle) * radius * omega * omega;
    unit.az = -Math.cos(angle) * radius * omega * omega;
    unit.facing = Math.atan2(unit.vx, unit.vz);
    unit.angularVelocity = -omega;
    unit.attackPhase = -1;
    unit.aimX = 2.4;
    unit.aimZ = 2.4;
    unit.aimY = 1.1;
    return;
  }

  // turn
  unit.x = 0;
  unit.z = 0;
  unit.speed = 0;
  unit.vx = 0;
  unit.vz = 0;
  unit.attackPhase = -1;
  const loop = t % TURN_LOOP;
  let index = 0;
  let start = 0;
  while (index < TURN_DWELLS.length - 1 && start + (TURN_DWELLS[index] ?? 0) <= loop) {
    start += TURN_DWELLS[index] ?? 0;
    index += 1;
  }
  const previous = index === 0 ? TURN_DWELLS.length - 1 : index - 1;
  const local = loop - start;
  const facing = -index * (Math.PI / 4);
  unit.facing = facing;
  // Angular velocity spikes at the snap so the lean layer banks the turn.
  const snap = Math.max(0, 1 - local / 0.18);
  const direction = index === 0 && previous === TURN_DWELLS.length - 1 ? -1 : -1;
  unit.angularVelocity = snap * 6.5 * direction;
  unit.ax = 0;
  unit.az = 0;
  // The head leads the body: aim keeps pointing at the NEXT facing early.
  const dwell = TURN_DWELLS[index] ?? 0.5;
  const lead = local > dwell - 0.22 ? facing - Math.PI / 4 : facing;
  unit.aimX = Math.sin(lead) * 5;
  unit.aimZ = Math.cos(lead) * 5;
  unit.aimY = 1.15;
}

export function mountFlatScene(host: HTMLElement, options: MountOptions = {}): FlatSceneHandle {
  const view = options.view ?? "hero";
  const anim = options.anim ?? "idle";
  const base = options.base ?? "quad";
  const layers = options.layers ?? ALL_LAYERS;
  const scale = options.scale ?? 1;
  const zoom = options.zoom ?? (view === "crowd" ? CROWD_ZOOM : COMBAT_ZOOM);
  const width = Math.round(STAGE_WIDTH * scale);
  const height = Math.round(STAGE_HEIGHT * scale);
  const pxPerUnit = PX_PER_UNIT * scale;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.setClearColor("#1b1220");
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(...flatLights());
  const board = buildBoard();
  scene.add(board.group);

  const rigs: UnitRig[] = [];
  const animators: UnitAnimator[] = [];
  let drives: SimUnit[];
  let battle: ReturnType<typeof createBattle> | undefined;

  if (view === "crowd") {
    battle = createBattle({
      fodderPerSide: options.fodderPerSide ?? 18,
      heroesPerSide: options.heroesPerSide ?? 2,
    });
    drives = battle.units;
  } else {
    drives = [makeDrive(7)];
  }

  for (const drive of drives) {
    const rig = buildUnit({
      archetype: drive.archetype,
      faction: drive.side === 0 ? "crew" : "opfor",
      tier: drive.tier,
    });
    scene.add(rig.root);
    rigs.push(rig);
    animators.push(new UnitAnimator(rig, drive.id, { density: base, layers }));
  }

  const shadows = new ShadowField(drives.length);
  scene.add(shadows.mesh);

  // Framing: hero view reproduces the #81 lane's controlled still (feet in
  // the lower-right third); the crowd view centres the engagement line.
  const target = view === "crowd"
    ? new THREE.Vector3(0, 0.55, 0)
    : new THREE.Vector3()
        .addScaledVector(RIGHT, -7 / PX_PER_UNIT)
        .addScaledVector(UP, 74 / PX_PER_UNIT);
  const basePosition = target.clone().addScaledVector(VIEW, 24);
  const halfW = width / (2 * pxPerUnit * zoom);
  const halfH = height / (2 * pxPerUnit * zoom);
  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 70);
  camera.position.copy(basePosition);
  camera.lookAt(target);

  const pan = new THREE.Vector3();
  const frames: number[] = [];
  let heroCount = 0;
  let fodderCount = 0;
  let heroMeshes = 0;
  let fodderMeshes = 0;
  let heroTriangles = 0;
  let fodderTriangles = 0;
  for (const rig of rigs) {
    if (rig.spec.tier === "hero") {
      heroCount += 1;
      heroMeshes = rig.cost.meshes;
      heroTriangles = rig.cost.triangles;
    } else {
      fodderCount += 1;
      fodderMeshes = rig.cost.meshes;
      fodderTriangles = rig.cost.triangles;
    }
  }

  let report: CostReport = {
    authoredKeysPerClip: BASE_KEY_COUNT[base],
    authoredKeysTotal: authoredKeyTotal(base),
    base,
    boardMeshes: board.cost.meshes,
    boardTriangles: Math.round(board.cost.triangles),
    drawCalls: 0,
    fodder: fodderCount,
    fps: 0,
    frameMs: { max: 0, mean: 0, p95: 0, samples: 0 },
    heroes: heroCount,
    meshesPerFodder: fodderMeshes,
    meshesPerHero: heroMeshes,
    programs: 0,
    stage: { height, pixelRatio: 1, width, zoom },
    trianglesPerFodder: Math.round(fodderTriangles),
    trianglesPerHero: Math.round(heroTriangles),
    triangles: 0,
    units: drives.length,
    view,
  };

  const publish = (): void => {
    const sorted = [...frames].sort((a, b) => a - b);
    const mean = sorted.length === 0
      ? 0
      : sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    report = {
      ...report,
      drawCalls: renderer.info.render.calls,
      fps: mean > 0 ? Math.round(1000 / mean) : 0,
      frameMs: {
        max: Number((sorted[sorted.length - 1] ?? 0).toFixed(3)),
        mean: Number(mean.toFixed(3)),
        p95: Number(p95.toFixed(3)),
        samples: sorted.length,
      },
      programs: renderer.info.programs?.length ?? 0,
      triangles: renderer.info.render.triangles,
    };
    (globalThis as { __flatProceduralCost?: CostReport }).__flatProceduralCost = report;
  };

  const poseAt = (t: number, dt: number): void => {
    if (battle !== undefined) {
      // Fixed-step catch-up keeps the crowd frame-rate independent.
      const step = 1 / 60;
      let remaining = t - battle.t;
      let guard = 0;
      while (remaining > step && guard < 600) {
        stepBattle(battle, step);
        remaining -= step;
        guard += 1;
      }
    } else {
      const drive = drives[0];
      if (drive !== undefined) { driveHero(drive, anim, t); }
    }
    for (let i = 0; i < drives.length; i += 1) {
      const drive = drives[i];
      const animator = animators[i];
      const rig = rigs[i];
      if (drive === undefined || animator === undefined || rig === undefined) { continue; }
      animator.update(drive, t, dt);
      const radius = rig.height * (rig.spec.tier === "hero" ? 0.3 : 0.28);
      shadows.set(i, drive.x - radius * 0.16, drive.z - radius * 0.06, radius, 0.02);
    }
    shadows.commit();
  };

  const renderAt = (t: number, dt: number): void => {
    poseAt(t, dt);
    if (options.motion === true) {
      const cycle = (t % 8) / 8;
      const sweep = Math.sin(cycle * Math.PI * 2) * 2.6;
      pan.set(0, 0, 0).addScaledVector(RIGHT, sweep);
      camera.position.copy(basePosition).add(pan);
    }
    renderer.render(scene, camera);
  };

  let frame = 0;
  const freezeMs = options.freezeMs;
  if (freezeMs === undefined) {
    let previous = performance.now();
    const start = previous;
    const tick = (): void => {
      const now = performance.now();
      const dt = clamp((now - previous) / 1000, 1 / 240, 1 / 12);
      previous = now;
      renderAt((now - start) / 1000, dt);
      frames.push(now === previous ? 0 : (performance.now() - now));
      if (frames.length > 180) { frames.shift(); }
      publish();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  } else {
    // Deterministic capture: replay the whole timeline at a fixed step so a
    // freeze at 4200 ms is byte-identical every run.
    const seconds = freezeMs / 1000;
    if (battle !== undefined) {
      battle = battleAt(seconds, {
        fodderPerSide: options.fodderPerSide ?? 18,
        heroesPerSide: options.heroesPerSide ?? 2,
      });
      drives = battle.units;
    }
    const step = 1 / 60;
    const steps = Math.max(1, Math.round(seconds / step));
    for (let i = 1; i <= steps; i += 1) {
      const at = i * step;
      if (battle === undefined) {
        const drive = drives[0];
        if (drive !== undefined) { driveHero(drive, anim, at); }
      }
      for (let u = 0; u < drives.length; u += 1) {
        const drive = drives[u];
        const animator = animators[u];
        if (drive === undefined || animator === undefined) { continue; }
        animator.update(drive, at, step);
      }
    }
    for (let i = 0; i < drives.length; i += 1) {
      const drive = drives[i];
      const rig = rigs[i];
      if (drive === undefined || rig === undefined) { continue; }
      const radius = rig.height * (rig.spec.tier === "hero" ? 0.3 : 0.28);
      shadows.set(i, drive.x - radius * 0.16, drive.z - radius * 0.06, radius, 0.02);
    }
    shadows.commit();
    const before = performance.now();
    renderer.render(scene, camera);
    frames.push(performance.now() - before);
    publish();
  }

  return {
    cost: () => report,
    destroy: () => {
      cancelAnimationFrame(frame);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) { object.geometry.dispose(); }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export { ALL_LAYERS, litMaterial, NO_LAYERS, emitMaterial };
