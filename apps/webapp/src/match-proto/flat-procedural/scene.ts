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
import {
  type Archetype,
  buildUnit,
  type Faction,
  HERO_HEIGHT,
  LEG_LENGTH,
  MARK_PIXELS,
  SIGNAL,
  type Tier,
  type UnitRig,
} from "./figure.ts";
import { emitMaterial, flatLights, INK, litMaterial, MARK_LAYER } from "./flat.ts";
import { createBattle, type SimUnit, stepBattle } from "./sim.ts";

export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 270;
const PX_PER_UNIT = 40;
/** The shared combat zoom the #81 lane settled on in round 2. */
export const COMBAT_ZOOM = 0.82;
export const CROWD_ZOOM = 0.55;

/** Screen-right and screen-up unit vectors of the dimetric camera, in world space. */
const RIGHT = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const UP = new THREE.Vector3(-0.35355, 0.86603, -0.35355);
const VIEW = new THREE.Vector3(0.61237, 0.5, 0.61237);

export type HeroAnim = "attack" | "idle" | "march" | "turn" | "walk";

/**
 * March speed chosen so the speed-matched stride lands on exactly one cycle
 * per second: a locomotion comparison whose loop does not close is unreadable
 * as a filmstrip. A stride covers two leg lengths, so this must be DERIVED
 * from the rig — the round-2 proportions shortened the legs, and a hard-coded
 * 1.554 would have silently desynchronised every march filmstrip.
 */
const MARCH_SPEED = 2 * LEG_LENGTH * HERO_HEIGHT;
export type SceneView = "crowd" | "hero" | "lineup";

/**
 * The roster the `lineup` view renders, left to right. It exists so tier and
 * archetype separation can be judged as a controlled comparison rather than
 * inferred from a battle still.
 */
const LINEUP: Array<{ archetype: Archetype; faction: Faction; tier: Tier }> = [
  { archetype: "medic", faction: "crew", tier: "hero" },
  { archetype: "melee", faction: "crew", tier: "hero" },
  { archetype: "melee", faction: "crew", tier: "fodder" },
  { archetype: "ranged", faction: "crew", tier: "fodder" },
  { archetype: "melee", faction: "opfor", tier: "hero" },
  { archetype: "ranged", faction: "opfor", tier: "hero" },
  { archetype: "melee", faction: "opfor", tier: "fodder" },
  { archetype: "ranged", faction: "opfor", tier: "fodder" },
];

export interface CostReport {
  view: SceneView;
  base: BaseDensity;
  authoredKeysPerClip: number;
  authoredKeysTotal: number;
  units: number;
  heroes: number;
  fodder: number;
  drawCalls: number;
  /** Extra calls the marking pass costs: the mask render plus one composite. */
  markDrawCalls: number;
  triangles: number;
  programs: number;
  boardMeshes: number;
  boardTriangles: number;
  meshesPerHero: number;
  meshesPerFodder: number;
  /** Extra draw calls the hero marking shell costs, per marked hero. */
  markMeshesPerHero: number;
  marking: boolean;
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
  /** Hero marking (the approved thick border). Default on. */
  mark?: boolean;
  /** Tile N deterministic frames into one contact sheet instead of animating. */
  strip?: { frames: number; fps: number; from: number; columns: number };
}

/**
 * Full-screen dilate of the hero silhouette mask.
 *
 * Samples three concentric rings outward; any pixel that is OUTSIDE a hero but
 * within `radius` of one gets painted in that hero's faction tint. Faction
 * arrives in the mask's red/green channel rather than as a colour, so neither
 * pass has to agree with the renderer about colour space — the tints below are
 * raw display-space components and go straight to the framebuffer.
 */
const MARK_FRAGMENT = `
uniform sampler2D mask;
uniform vec2 texel;
uniform float radius;
uniform vec3 crew;
uniform vec3 opfor;
varying vec2 vUv;
void main() {
  if (texture2D(mask, vUv).a > 0.35) { discard; }
  float bestA = 0.0;
  float bestR = 0.0;
  float bestG = 0.0;
  for (int ring = 1; ring <= 3; ring += 1) {
    float rr = radius * float(ring) / 3.0;
    for (int i = 0; i < 12; i += 1) {
      float a = float(i) / 12.0 * 6.2831853;
      vec4 s = texture2D(mask, vUv + vec2(cos(a), sin(a)) * texel * rr);
      if (s.a > bestA) { bestA = s.a; bestR = s.r; bestG = s.g; }
    }
  }
  if (bestA < 0.35) { discard; }
  gl_FragColor = vec4(bestR >= bestG ? crew : opfor, 1.0);
}
`;

const MARK_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Raw display-space components — deliberately no colour-space conversion. */
function rawRgb(hex: string): THREE.Vector3 {
  const value = Number.parseInt(hex.slice(1), 16);
  return new THREE.Vector3(
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  );
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

/**
 * Publishes a pixel-exact PNG of the current capture so the harness can pull
 * frames out without depending on element screenshots and CSS scaling.
 */
function expose(png: () => string): void {
  (globalThis as { __flatProceduralPng?: () => string }).__flatProceduralPng = png;
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
const TURN_DWELLS = [0.66, 0.34, 0.5, 0.7, 0.3, 0.52, 0.6, 0.38];
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
    const look = Math.sin((t / 4) * Math.PI * 2);
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
    const cycle = 2;
    const local = t % cycle;
    unit.attackPhase = local < 1.2 ? local / 1.2 : -1;
    if (local >= 0.42 * 1.2 && local < 0.42 * 1.2 + 1 / 30) {
      unit.firedAt = Math.floor(t / cycle) + 1;
    }
    return;
  }

  if (anim === "march") {
    // Locomotion held in frame: the stride layer runs at full speed while the
    // root stays put, so the authored-base ladder compares cycles rather than
    // chasing the subject out of the crop.
    unit.x = 0;
    unit.z = 0;
    unit.facing = 0.34;
    unit.vx = Math.sin(unit.facing) * MARCH_SPEED;
    unit.vz = Math.cos(unit.facing) * MARCH_SPEED;
    unit.speed = MARCH_SPEED;
    unit.ax = 0;
    unit.az = 0;
    unit.angularVelocity = 0;
    unit.attackPhase = -1;
    unit.aimX = Math.sin(unit.facing) * 5;
    unit.aimZ = Math.cos(unit.facing) * 5;
    unit.aimY = 1.15;
    return;
  }

  if (anim === "walk") {
    // A slow circuit: stride tracks the tangential speed while aim stays
    // locked on a fixed point, so feet and gaze visibly decouple.
    const period = 4.8;
    const radius = 1.5;
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

/** Lineup drive: same scripted clips as the hero view, held in place. */
function driveLineup(unit: SimUnit, anim: HeroAnim, t: number): void {
  const x = unit.x;
  const z = unit.z;
  driveHero(unit, anim === "walk" ? "idle" : anim, t);
  unit.x = x;
  unit.z = z;
  unit.aimX += x;
  unit.aimZ += z;
}

export function mountFlatScene(host: HTMLElement, options: MountOptions = {}): FlatSceneHandle {
  const view = options.view ?? "hero";
  const anim = options.anim ?? "idle";
  const base = options.base ?? "quad";
  const layers = options.layers ?? ALL_LAYERS;
  const scale = options.scale ?? 1;
  const marking = options.mark ?? true;
  const zoom = options.zoom
    ?? (view === "crowd" ? CROWD_ZOOM : (view === "lineup" ? 0.95 : COMBAT_ZOOM));
  const width = Math.round(STAGE_WIDTH * scale);
  const height = Math.round(STAGE_HEIGHT * scale);
  const pxPerUnit = PX_PER_UNIT * scale;

  // preserveDrawingBuffer so a filmstrip can copy each rendered frame out of
  // the WebGL canvas; without it the buffer is cleared on composite and the
  // contact sheet comes out blank.
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
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
  } else if (view === "lineup") {
    drives = LINEUP.map((entry, index) => {
      const drive = makeDrive(index * 5 + 3);
      const offset = (index - (LINEUP.length - 1) / 2) * 1.28;
      drive.archetype = entry.archetype;
      drive.tier = entry.tier;
      drive.side = entry.faction === "crew" ? 0 : 1;
      drive.x = RIGHT.x * offset;
      drive.z = RIGHT.z * offset;
      return drive;
    });
  } else {
    drives = [makeDrive(7)];
  }

  for (const drive of drives) {
    const rig = buildUnit({
      archetype: drive.archetype,
      faction: drive.side === 0 ? "crew" : "opfor",
      mark: marking && drive.tier === "hero",
      tier: drive.tier,
    });
    scene.add(rig.root);
    rigs.push(rig);
    // The controlled hero still is a single subject: per-unit phase, rate and
    // amplitude jitter exist to desynchronise a crowd, and leaving them on
    // here only makes the capture loop close untidily.
    const soloLayers = view === "hero" ? { ...layers, phase: false } : layers;
    animators.push(new UnitAnimator(rig, drive.id, { density: base, layers: soloLayers }));
  }

  const shadows = new ShadowField(drives.length);
  scene.add(shadows.mesh);

  // Framing. At or below the shared combat zoom the hero view reproduces the
  // #81 lane's controlled still (feet in the lower-right third, board in
  // shot). Above it the camera re-centres on the unit, because a loupe that
  // keeps the board framing simply pushes the subject off the canvas.
  const target = view === "crowd"
    ? new THREE.Vector3(0, 0.55, 0).addScaledVector(UP, 0.85)
    : (view === "lineup"
        ? new THREE.Vector3(0, 0.95, 0)
        : zoom > 1.05
          ? new THREE.Vector3(0, 0.95, 0)
          : new THREE.Vector3()
              .addScaledVector(RIGHT, -7 / PX_PER_UNIT)
              .addScaledVector(UP, 74 / PX_PER_UNIT));
  const basePosition = target.clone().addScaledVector(VIEW, 24);
  const halfW = width / (2 * pxPerUnit * zoom);
  const halfH = height / (2 * pxPerUnit * zoom);
  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 70);
  camera.position.copy(basePosition);
  camera.lookAt(target);

  // --- Hero marking pass -----------------------------------------------------
  const markedUnits = rigs.filter((rig) => rig.cost.markMeshes > 0).length;
  const markOn = marking && markedUnits > 0;
  const markTarget = markOn
    ? new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, samples: 4 })
    : undefined;
  const markScene = new THREE.Scene();
  const markCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  if (markTarget !== undefined) {
    markScene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        depthTest: false,
        depthWrite: false,
        fragmentShader: MARK_FRAGMENT,
        transparent: true,
        uniforms: {
          crew: { value: rawRgb(SIGNAL.crew) },
          mask: { value: markTarget.texture },
          opfor: { value: rawRgb(SIGNAL.opfor) },
          radius: { value: MARK_PIXELS * scale },
          texel: { value: new THREE.Vector2(1 / width, 1 / height) },
        },
        vertexShader: MARK_VERTEX,
      }),
    ));
  }

  const pan = new THREE.Vector3();
  const frames: number[] = [];
  let sceneCalls = 0;
  let sceneTriangles = 0;
  let markCalls = 0;
  let heroCount = 0;
  let fodderCount = 0;
  let heroMeshes = 0;
  let heroMarkMeshes = 0;
  let fodderMeshes = 0;
  let heroTriangles = 0;
  let fodderTriangles = 0;
  for (const rig of rigs) {
    if (rig.spec.tier === "hero") {
      heroCount += 1;
      heroMeshes = rig.cost.meshes;
      heroMarkMeshes = rig.cost.markMeshes;
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
    markDrawCalls: 0,
    fps: 0,
    frameMs: { max: 0, mean: 0, p95: 0, samples: 0 },
    heroes: heroCount,
    markMeshesPerHero: heroMarkMeshes,
    marking,
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
      drawCalls: sceneCalls,
      markDrawCalls: markCalls,
      fps: mean > 0 ? Math.round(1000 / mean) : 0,
      frameMs: {
        max: Number((sorted[sorted.length - 1] ?? 0).toFixed(3)),
        mean: Number(mean.toFixed(3)),
        p95: Number(p95.toFixed(3)),
        samples: sorted.length,
      },
      programs: renderer.info.programs?.length ?? 0,
      triangles: sceneTriangles,
    };
    (globalThis as { __flatProceduralCost?: CostReport }).__flatProceduralCost = report;
  };

  // --- Simulation clock ------------------------------------------------------
  //
  // One fixed-step integrator serves the live loop, the freeze capture and the
  // filmstrip. Captures are therefore not a separate code path that can drift
  // from what the browser shows — they are the same steps, replayed.

  const STEP = 1 / 60;
  let simTime = 0;

  const stepOnce = (at: number, dt: number): void => {
    if (battle !== undefined) {
      stepBattle(battle, dt);
    } else if (view === "hero") {
      const drive = drives[0];
      if (drive !== undefined) { driveHero(drive, anim, at); }
    } else {
      for (const drive of drives) { driveLineup(drive, anim, at); }
    }
    for (let i = 0; i < drives.length; i += 1) {
      const drive = drives[i];
      const animator = animators[i];
      if (drive === undefined || animator === undefined) { continue; }
      animator.update(drive, at, dt);
    }
  };

  const advanceTo = (target: number): void => {
    let guard = 0;
    while (simTime + STEP <= target + 1e-9 && guard < 4000) {
      simTime += STEP;
      stepOnce(simTime, STEP);
      guard += 1;
    }
  };

  // Pose everything once at t=0. Without this the first rendered frame shows
  // the bind rigs still stacked at the world origin, which is invisible in a
  // one-unit view and unmistakable in a lineup or a crowd.
  stepOnce(0, STEP);

  const syncShadows = (): void => {
    for (let i = 0; i < drives.length; i += 1) {
      const drive = drives[i];
      const rig = rigs[i];
      if (drive === undefined || rig === undefined) { continue; }
      const radius = rig.height * (rig.spec.tier === "hero" ? 0.3 : 0.28);
      shadows.set(i, drive.x - radius * 0.16, drive.z - radius * 0.06, radius, 0.02);
    }
    shadows.commit();
  };

  const renderAt = (t: number): void => {
    advanceTo(t);
    syncShadows();
    if (options.motion === true) {
      const cycle = (t % 8) / 8;
      const sweep = Math.sin(cycle * Math.PI * 2) * 2.6;
      pan.set(0, 0, 0).addScaledVector(RIGHT, sweep);
      camera.position.copy(basePosition).add(pan);
    }
    const before = performance.now();
    if (markTarget !== undefined) {
      // Heroes alone, flat faction channels, into an offscreen mask.
      camera.layers.set(MARK_LAYER);
      renderer.setRenderTarget(markTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      camera.layers.set(0);
      renderer.setClearColor("#1b1220", 1);
      markCalls = renderer.info.render.calls + 1;
    }
    renderer.render(scene, camera);
    sceneCalls = renderer.info.render.calls;
    sceneTriangles = renderer.info.render.triangles;
    if (markTarget !== undefined) {
      renderer.autoClear = false;
      renderer.render(markScene, markCamera);
      renderer.autoClear = true;
    }
    frames.push(performance.now() - before);
    if (frames.length > 180) { frames.shift(); }
  };

  let frame = 0;
  const strip = options.strip;
  const freezeMs = options.freezeMs;

  if (strip !== undefined) {
    // Filmstrip: N deterministic frames tiled into one PNG. GIF cadence
    // aliases motion beats, so the strip — not the GIF — is the artifact a
    // cold critic should be judging motion from.
    const columns = strip.columns;
    const rows = Math.ceil(strip.frames / columns);
    const sheet = document.createElement("canvas");
    sheet.width = width * columns;
    sheet.height = height * rows;
    const ctx = sheet.getContext("2d");
    host.append(sheet);
    renderer.domElement.style.display = "none";
    for (let i = 0; i < strip.frames; i += 1) {
      renderAt(strip.from / 1000 + i / strip.fps);
      ctx?.drawImage(renderer.domElement, (i % columns) * width, Math.floor(i / columns) * height);
    }
    publish();
    expose(() => sheet.toDataURL("image/png"));
  } else if (freezeMs === undefined) {
    const start = performance.now();
    const tick = (): void => {
      renderAt((performance.now() - start) / 1000);
      publish();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  } else {
    renderAt(freezeMs / 1000);
    publish();
    expose(() => renderer.domElement.toDataURL("image/png"));
  }

  return {
    cost: () => report,
    destroy: () => {
      cancelAnimationFrame(frame);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) { object.geometry.dispose(); }
      });
      markTarget?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export { ALL_LAYERS, litMaterial, NO_LAYERS, emitMaterial };
