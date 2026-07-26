/**
 * THROWAWAY SCAFFOLDING (#96, ported from #89): mount/teardown, the camera,
 * the cost meter and the capture hook.
 *
 * ## The camera is a constant, not a choice
 *
 * Fixed 2:1 dimetric orthographic, **30 degrees elevation / 45 degrees
 * azimuth, translation only, never rotating**, 480x270 aperture, pixelRatio 1.
 * The same numbers are copy-pasted across four bake-off lanes and #95 treats
 * them as de facto canon so combat experiments stay visually comparable with
 * the bake-off galleries. `motion=1` pans it; nothing rotates it. Do not
 * change these numbers to make a prototype look better — the comparability is
 * the point.
 *
 * ## Views
 *
 *   crowd   the seeded battle from sim.ts — ~40 bodies, the default.
 *   hero    one unit at combat zoom, driven by a scripted controller.
 *   lineup  every archetype x tier x faction, held in a row. Generated from
 *           the archetype registry, so a new archetype appears here for free.
 *
 * ## Capture hook
 *
 * Every render publishes `window.__combatSandbox`:
 *
 *   cost()              draw calls, triangles, frame budget at crowd scale
 *   png()               pixel-exact PNG data URL of the current frame
 *   renderAt(seconds)   step the fixed-step clock forward to `seconds` and
 *                       render one deterministic frame (forward only)
 *   simTime()           where the clock is now
 *
 * `capture.mjs` drives exactly that surface, so a capture is the same steps
 * the browser runs and cannot drift from what a human sees.
 *
 * Nothing here is an art-direction commitment. See `README.md`.
 */

import * as THREE from "three";

import { ALL_LAYERS, type LayerFlags, UnitAnimator } from "./animator.ts";
import { ARCHETYPE_NAMES, profileOf } from "./archetypes.ts";
import { authoredKeyTotal, BASE_KEY_COUNT, type BaseDensity } from "./authored.ts";
// #100 battlefield space. `space=cover` adds the tile-grid cover layer and
// turns on the cover behaviours; `space=plaza` (the default) is untouched.
// Round 2 adds `density` (how much cover), `roster` (who is fighting) and
// `fire` (whether a shot is drawn at all — see `fire-render.ts`'s header).
import { buildCoverBoard } from "./battlefield-space/cover-board.ts";
// Registers the duck/peek silhouettes at module scope. Imported for the side
// effect, exactly as `cover-behaviours.ts` registers its behaviours.
import "./battlefield-space/cover-poses.ts";
import type { CoverDensity } from "./battlefield-space/cover-model.ts";
import {
  type FireMode,
  FireField,
  firesOrdnance,
  shotOf,
} from "./battlefield-space/fire-render.ts";
import { createSpaceBattle, type RosterMode, type SpaceMode } from "./battlefield-space/space.ts";
import { buildBoard } from "./board.ts";
import { buildUnit, HERO_HEIGHT, LEG_LENGTH, type UnitRig } from "./figure.ts";
import { flatLights, INK, MARK_LAYER } from "./flat.ts";
import {
  advanceBattle,
  ATTACK_STEPS,
  FIXED_STEP,
  RELEASE_AT,
  type SimState,
  type SimUnit,
  soloUnit,
  stepBattle,
  stepsFor,
} from "./sim.ts";
import { factionOf, MARK_PIXELS, SIGNAL, sideOf, type Tier } from "./units.ts";

export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 270;
const PX_PER_UNIT = 40;
/** The shared combat zoom the bake-off settled on. */
export const COMBAT_ZOOM = 0.82;
export const CROWD_ZOOM = 0.55;

/** Screen-right and screen-up unit vectors of the dimetric camera, in world space. */
const RIGHT = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
const UP = new THREE.Vector3(-0.35355, 0.86603, -0.35355);
const VIEW = new THREE.Vector3(0.61237, 0.5, 0.61237);
/** Ground axis whose screen projection is purely vertical; positive is nearer. */
const FORWARD = new THREE.Vector3(Math.SQRT1_2, 0, Math.SQRT1_2);

export type HeroAnim = "attack" | "idle" | "march" | "turn" | "walk";

/**
 * March speed chosen so the speed-matched stride lands on exactly one cycle
 * per second. A stride covers two leg lengths, so this must be DERIVED from
 * the rig — a hard-coded constant silently desynchronises every filmstrip the
 * moment the proportions move.
 */
const MARCH_SPEED = 2 * LEG_LENGTH * HERO_HEIGHT;
export type SceneView = "crowd" | "hero" | "lineup";

/**
 * The `lineup` roster, generated from the archetype registry so tier and
 * archetype separation can be judged as a controlled comparison — and so a new
 * archetype shows up here without anyone remembering to add it.
 */
const LINEUP = (["crew", "opfor"] as const).flatMap((faction) =>
  (["hero", "fodder"] as Tier[]).flatMap((tier) =>
    ARCHETYPE_NAMES.map((archetype) => ({ archetype, faction, tier }))));

const LINEUP_SPACING = 1.28;
/**
 * Laid out as a grid, not one long row. A single row of twelve runs straight
 * through the market stack and the foundry block at its ends, and the board is
 * not moving — it is the shared bake-off board. Six a row keeps every unit in
 * the open lane, and a new archetype adds a column or a row rather than
 * pushing someone into a wall.
 */
const LINEUP_COLUMNS = Math.min(6, LINEUP.length);
const LINEUP_ROW_GAP = 3.4;
export const LINEUP_ZOOM = Math.min(
  0.95,
  STAGE_WIDTH / (2 * PX_PER_UNIT * (((LINEUP_COLUMNS - 1) / 2) * LINEUP_SPACING + 1.2)),
);

/** The framing each view opens at. Shared so the surface cannot disagree. */
export function defaultZoom(view: SceneView): number {
  if (view === "crowd") { return CROWD_ZOOM; }
  return view === "lineup" ? LINEUP_ZOOM : COMBAT_ZOOM;
}

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
  /** #100: authored cover props drawn. 0 in the open-plaza variant. */
  coverProps: number;
  /** #100: which battlefield-space variant this frame is. */
  space: SpaceMode;
  /** #100 round 2: the prop density the cover board was built at. */
  density: CoverDensity;
  /** #100 round 2: the composition on the field. */
  roster: RosterMode;
  /** #100 round 2: how a ranged attack is drawn. `none` is every lane today. */
  fire: FireMode;
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
  /** Where the fixed-step clock is, in sim seconds. */
  simTime: number;
}

export interface MountOptions {
  view?: SceneView;
  anim?: HeroAnim;
  base?: BaseDensity;
  layers?: LayerFlags;
  zoom?: number;
  /** Battle seed. Same seed + same options = the same fight, always. */
  seed?: number;
  /** Render one deterministic frame at this clock value (ms) and stop. */
  freezeMs?: number;
  /** Canvas multiplier; framing is unchanged, pixel density is not. */
  scale?: number;
  fodderPerSide?: number;
  heroesPerSide?: number;
  /**
   * Fast-forward to this sim time (seconds) before the loop starts. Combined
   * with `sliceSeconds` this is the slice window map #95 asks for: the fight
   * opens mid-battle at a known, reproducible moment.
   */
  startAt?: number;
  /** Stop the live loop `sliceSeconds` after `startAt` and hold on the boundary. */
  sliceSeconds?: number;
  /** Camera pans across the encounter (translation only, never rotation). */
  motion?: boolean;
  /** Hero marking (the approved border). Default on. */
  mark?: boolean;
  /** Tile N deterministic frames into one contact sheet instead of animating. */
  strip?: { frames: number; fps: number; from: number; columns: number };
  /**
   * #100. `"plaza"` (default) is the sandbox's continuous-space fight;
   * `"cover"` adds the tile grid, prop footprints and sightlines.
   */
  space?: SpaceMode;
  /** #100. Draw the tile grid and blocked/roofed cells. Debug overlay. */
  grid?: boolean;
  /**
   * #100 round 2. How much cover the board carries: `"dense"` (default) is
   * round 1's 32-prop board, `"spread"` and `"sparse"` thin it. Ignored in the
   * plaza, which has no board to thin.
   */
  density?: CoverDensity;
  /** #100 round 2. Composition: the mixed roster, all shooters, or ranged vs melee. */
  roster?: RosterMode;
  /**
   * #100 round 3. Melee's covered approach. Default on; `false` reproduces
   * rounds 1 and 2, where only shooters used cover.
   */
  approach?: boolean;
  /**
   * #100 round 2. Whether a ranged attack draws anything. `"none"` (default) is
   * the status quo across every lane on #64. **A prototype stand-in, not an art
   * proposal** — read `fire-render.ts`'s header before using a capture of it
   * as evidence about a look.
   */
  fire?: FireMode;
}

/**
 * Full-screen dilate of the hero silhouette mask.
 *
 * Samples three concentric rings outward; any pixel that is OUTSIDE a hero but
 * within `radius` of one gets painted in that hero's faction tint. Faction
 * arrives in the mask's red/green channel rather than as a colour, so neither
 * pass has to agree with the renderer about colour space.
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

export interface SandboxHandle {
  destroy: () => void;
  cost: () => CostReport;
  /** Step forward to `seconds` and render one frame. Forward only. */
  renderAt: (seconds: number) => void;
  /** Pixel-exact PNG of whatever is on the canvas now. */
  png: () => string;
}

/** What `capture.mjs` finds on the page. */
export interface CaptureBridge {
  cost: () => CostReport;
  png: () => string;
  renderAt: (seconds: number) => void;
  simTime: () => number;
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

  /** Parks unused slots at the origin with zero radius after a unit leaves. */
  clearFrom(index: number, count: number): void {
    for (let i = index; i < count; i += 1) { this.set(i, 0, 0, 0, 0); }
  }

  commit(): void {
    this.positions.needsUpdate = true;
  }
}

/**
 * A unit for the scripted views. Built by `sim.ts` so `SimUnit` has exactly
 * one constructor — a hand-written literal here would silently miss any field
 * a prototype adds for a new animation state.
 */
function makeDrive(id: number): SimUnit {
  const unit = soloUnit(id);
  unit.aimY = 1.1;
  return unit;
}

/** Eight held facings with deliberately uneven dwells — a turn, not a turntable. */
const TURN_DWELLS = [0.66, 0.34, 0.5, 0.7, 0.3, 0.52, 0.6, 0.38];
const TURN_LOOP = TURN_DWELLS.reduce((sum, d) => sum + d, 0);

/**
 * Scripted hero drive. Pure function of `t` so every capture is repeatable,
 * and shaped exactly like a sim unit so the animator has one code path.
 */
function driveHero(unit: SimUnit, anim: HeroAnim, t: number): void {
  unit.hitAtStep = -1;
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
    unit.attackStep = -1;
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
    unit.attackStep = local < 1.2
      ? Math.min(ATTACK_STEPS - 1, Math.floor((local / 1.2) * ATTACK_STEPS))
      : -1;
    if (local >= RELEASE_AT * 1.2 && local < RELEASE_AT * 1.2 + 1 / 30) {
      unit.firedAtStep = Math.floor(t / cycle) + 1;
    }
    return;
  }

  if (anim === "march") {
    // Locomotion held in frame: the stride layer runs at full speed while the
    // root stays put, so a filmstrip compares cycles rather than chasing the
    // subject out of the crop.
    unit.x = 0;
    unit.z = 0;
    unit.facing = 0.34;
    unit.vx = Math.sin(unit.facing) * MARCH_SPEED;
    unit.vz = Math.cos(unit.facing) * MARCH_SPEED;
    unit.speed = MARCH_SPEED;
    unit.ax = 0;
    unit.az = 0;
    unit.angularVelocity = 0;
    unit.attackStep = -1;
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
    unit.attackStep = -1;
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
  unit.attackStep = -1;
  const loop = t % TURN_LOOP;
  let index = 0;
  let start = 0;
  while (index < TURN_DWELLS.length - 1 && start + (TURN_DWELLS[index] ?? 0) <= loop) {
    start += TURN_DWELLS[index] ?? 0;
    index += 1;
  }
  const facing = -index * (Math.PI / 4);
  unit.facing = facing;
  // Angular velocity spikes at the snap so the lean layer banks the turn.
  const local = loop - start;
  const snap = Math.max(0, 1 - local / 0.18);
  unit.angularVelocity = snap * -6.5;
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

export function mountCombatSandbox(host: HTMLElement, options: MountOptions = {}): SandboxHandle {
  const view = options.view ?? "crowd";
  const anim = options.anim ?? "idle";
  const base = options.base ?? "quad";
  const layers = options.layers ?? ALL_LAYERS;
  const scale = options.scale ?? 1;
  const marking = options.mark ?? true;
  const zoom = options.zoom ?? defaultZoom(view);
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

  const space: SpaceMode = options.space ?? "plaza";
  const density: CoverDensity = options.density ?? "dense";
  const roster: RosterMode = options.roster ?? "mixed";
  const fire: FireMode = options.fire ?? "none";
  const scene = new THREE.Scene();
  scene.add(...flatLights());
  const board = buildBoard();
  scene.add(board.group);
  // The cover layer is variant B only, and its cost folds into the board's so
  // the report keeps saying "what does the environment cost" in one number.
  const cover = space === "cover"
    ? buildCoverBoard({ density, grid: options.grid ?? false })
    : undefined;
  if (cover !== undefined) { scene.add(cover.group); }

  let battle: SimState | undefined;
  let drives: SimUnit[];

  if (view === "crowd") {
    battle = createSpaceBattle(space, {
      approach: options.approach ?? true,
      density,
      fodderPerSide: options.fodderPerSide ?? 18,
      heroesPerSide: options.heroesPerSide ?? 2,
      roster,
      ...(options.seed === undefined ? {} : { seed: options.seed }),
    });
    drives = battle.units;
  } else if (view === "lineup") {
    const rows = Math.ceil(LINEUP.length / LINEUP_COLUMNS);
    drives = LINEUP.map((entry, index) => {
      const drive = makeDrive(index * 5 + 3);
      const column = index % LINEUP_COLUMNS;
      const row = Math.floor(index / LINEUP_COLUMNS);
      const across = (column - (LINEUP_COLUMNS - 1) / 2) * LINEUP_SPACING;
      // Front row nearer the camera; rows are laid along the approach axis so
      // the offset is purely screen-vertical and nothing shifts sideways.
      const depth = ((rows - 1) / 2 - row) * LINEUP_ROW_GAP;
      drive.archetype = entry.archetype;
      drive.tier = entry.tier;
      drive.side = sideOf(entry.faction);
      drive.x = RIGHT.x * across + FORWARD.x * depth;
      drive.z = RIGHT.z * across + FORWARD.z * depth;
      return drive;
    });
  } else {
    drives = [makeDrive(7)];
  }

  // Keyed by unit id, not by array index, so a behaviour that removes a unit
  // from the battle (#101) cannot silently re-pair rigs with the wrong drives.
  const bodies = new Map<number, { rig: UnitRig; animator: UnitAnimator }>();
  for (const drive of drives) {
    const rig = buildUnit({
      archetype: drive.archetype,
      faction: factionOf(drive.side),
      mark: marking && drive.tier === "hero",
      tier: drive.tier,
    });
    scene.add(rig.root);
    // The controlled hero still is a single subject: per-unit phase, rate and
    // amplitude jitter exist to desynchronise a crowd, and leaving them on
    // here only makes the capture loop close untidily.
    const soloLayers = view === "hero" ? { ...layers, phase: false } : layers;
    bodies.set(drive.id, {
      animator: new UnitAnimator(rig, drive.id, { density: base, layers: soloLayers }),
      rig,
    });
  }

  const shadows = new ShadowField(drives.length);
  scene.add(shadows.mesh);
  const shadowSlots = drives.length;

  // #100 round 2. Only allocated when fire is actually being drawn, so the
  // `fire=none` capture is the same scene graph round 1 shot.
  const fires = fire === "none" ? undefined : new FireField(drives.length);
  if (fires !== undefined) { scene.add(fires.mesh); }

  // Framing. At or below the shared combat zoom the hero view reproduces the
  // bake-off's controlled still. Above it the camera re-centres on the unit,
  // because a loupe that keeps the board framing pushes the subject off frame.
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
  const markedUnits = [...bodies.values()].filter((body) => body.rig.cost.markMeshes > 0).length;
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
  /** Scratch for the muzzle world position. Reused so a frame allocates none. */
  const muzzleAt = new THREE.Vector3();
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
  for (const { rig } of bodies.values()) {
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
    boardMeshes: board.cost.meshes + (cover?.cost.meshes ?? 0),
    boardTriangles: Math.round(board.cost.triangles + (cover?.cost.triangles ?? 0)),
    coverProps: cover?.drawn ?? 0,
    density,
    drawCalls: 0,
    fire,
    fodder: fodderCount,
    fps: 0,
    frameMs: { max: 0, mean: 0, p95: 0, samples: 0 },
    heroes: heroCount,
    markDrawCalls: 0,
    marking,
    markMeshesPerHero: heroMarkMeshes,
    meshesPerFodder: fodderMeshes,
    meshesPerHero: heroMeshes,
    programs: 0,
    roster,
    simTime: 0,
    space,
    stage: { height, pixelRatio: 1, width, zoom },
    triangles: 0,
    trianglesPerFodder: Math.round(fodderTriangles),
    trianglesPerHero: Math.round(heroTriangles),
    units: drives.length,
    view,
  };

  // --- Simulation clock ------------------------------------------------------
  //
  // One fixed-step integrator serves the live loop, the freeze capture and the
  // filmstrip. Captures are therefore not a separate code path that can drift
  // from what the browser shows — they are the same steps, replayed.

  // Integer steps, same as the sim: the renderer's clock must not drift away
  // from the state's, or a capture stops landing on the frame it names.
  let simSteps = 0;
  let simTime = 0;

  const publish = (): void => {
    const sorted = [...frames].sort((a, b) => a - b);
    const mean = sorted.length === 0
      ? 0
      : sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
    report = {
      ...report,
      drawCalls: sceneCalls,
      fps: mean > 0 ? Math.round(1000 / mean) : 0,
      frameMs: {
        max: Number((sorted[sorted.length - 1] ?? 0).toFixed(3)),
        mean: Number(mean.toFixed(3)),
        p95: Number(p95.toFixed(3)),
        samples: sorted.length,
      },
      markDrawCalls: markCalls,
      programs: renderer.info.programs?.length ?? 0,
      simTime: Number(simTime.toFixed(4)),
      triangles: sceneTriangles,
    };
  };

  /** Steps of real animation run before a fast-forwarded opening frame. */
  const ANIMATOR_WARMUP = 45;

  const stepOnce = (at: number, dt: number): void => {
    if (battle !== undefined) {
      stepBattle(battle);
      drives = battle.units;
    } else if (view === "hero") {
      const drive = drives[0];
      if (drive !== undefined) { driveHero(drive, anim, at); }
    } else {
      for (const drive of drives) { driveLineup(drive, anim, at); }
    }
    for (const drive of drives) {
      bodies.get(drive.id)?.animator.update(drive, at, dt);
    }
  };

  // `stepsFor`, not a local rounding rule: after `renderAt(t)` the battle must
  // be on exactly the step `battleAt(t)` would have reached, or a capture does
  // not show the frame it claims to.
  const advanceTo = (to: number): void => {
    const wanted = Math.min(stepsFor(to), simSteps + 40000);
    while (simSteps < wanted) {
      simSteps += 1;
      simTime = simSteps * FIXED_STEP;
      stepOnce(simTime, FIXED_STEP);
    }
  };

  // Pose everything at t=0 WITHOUT consuming a step. Without a pose the first
  // frame shows the bind rigs stacked at the world origin; with a step, the
  // battle would sit permanently one step ahead of `simSteps`.
  if (view === "hero") {
    const drive = drives[0];
    if (drive !== undefined) { driveHero(drive, anim, 0); }
  } else if (view === "lineup") {
    for (const drive of drives) { driveLineup(drive, anim, 0); }
  }
  for (const drive of drives) {
    bodies.get(drive.id)?.animator.update(drive, 0, FIXED_STEP);
  }

  if (options.startAt !== undefined && options.startAt > 0) {
    // Open mid-fight the way a slice resolution would: resume the battle
    // straight to the boundary and only run the last `ANIMATOR_WARMUP` steps
    // through the animators, which need a little history for their springs and
    // stride clocks to settle. Skipping 8 seconds costs one battle replay
    // instead of 480 crowd-wide animator updates.
    const target = stepsFor(options.startAt);
    if (battle !== undefined && target > ANIMATOR_WARMUP) {
      advanceBattle(battle, target - ANIMATOR_WARMUP);
      drives = battle.units;
      simSteps = target - ANIMATOR_WARMUP;
      simTime = simSteps * FIXED_STEP;
    }
    advanceTo(options.startAt);
  }
  const sliceEnd = options.sliceSeconds === undefined
    ? undefined
    : (options.startAt ?? 0) + options.sliceSeconds;

  const syncShadows = (): void => {
    let index = 0;
    for (const drive of drives) {
      const rig = bodies.get(drive.id)?.rig;
      if (rig === undefined || index >= shadowSlots) { continue; }
      const radius = rig.height * (rig.spec.tier === "hero" ? 0.3 : 0.28);
      shadows.set(index, drive.x - radius * 0.16, drive.z - radius * 0.06, radius, 0.02);
      index += 1;
    }
    shadows.clearFrom(index, shadowSlots);
    shadows.commit();
  };

  /**
   * Tracers, from `firedAtStep` alone — see `fire-render.ts`. `updateMatrixWorld`
   * is called per firing unit because the muzzle anchor hangs off an IK-solved
   * arm whose world matrix Three would not otherwise refresh until render, and
   * a one-frame-stale muzzle puts the streak visibly off the barrel.
   */
  const syncFire = (): void => {
    if (fires === undefined || battle === undefined) { return; }
    fires.clear();
    const byId = new Map(battle.units.map((unit) => [unit.id, unit]));
    let slot = 0;
    for (const drive of drives) {
      if (!firesOrdnance(profileOf(drive.archetype, drive.tier).standoff)) { continue; }
      const rig = bodies.get(drive.id)?.rig;
      if (rig === undefined) { continue; }
      rig.root.updateMatrixWorld(true);
      const shot = shotOf(
        drive,
        drive.targetId < 0 ? undefined : byId.get(drive.targetId),
        battle.step,
        fire,
        rig.muzzle.getWorldPosition(muzzleAt),
      );
      if (shot === undefined) { continue; }
      fires.set(slot, shot, fire);
      slot += 1;
    }
    fires.commit();
  };

  const renderAt = (t: number): void => {
    advanceTo(t);
    syncShadows();
    syncFire();
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
  let png = (): string => renderer.domElement.toDataURL("image/png");

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
    png = () => sheet.toDataURL("image/png");
  } else if (freezeMs === undefined) {
    const start = performance.now();
    const tick = (): void => {
      const wall = (performance.now() - start) / 1000 + (options.startAt ?? 0);
      renderAt(sliceEnd === undefined ? wall : Math.min(wall, sliceEnd));
      publish();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  } else {
    renderAt(freezeMs / 1000);
    publish();
  }

  const bridge: CaptureBridge = {
    cost: () => report,
    png: () => png(),
    renderAt: (seconds: number) => {
      renderAt(seconds);
      publish();
    },
    simTime: () => simTime,
  };
  (globalThis as { __combatSandbox?: CaptureBridge }).__combatSandbox = bridge;

  return {
    cost: () => report,
    destroy: () => {
      cancelAnimationFrame(frame);
      if ((globalThis as { __combatSandbox?: CaptureBridge }).__combatSandbox === bridge) {
        delete (globalThis as { __combatSandbox?: CaptureBridge }).__combatSandbox;
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) { object.geometry.dispose(); }
      });
      markTarget?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
    png: () => png(),
    renderAt: bridge.renderAt,
  };
}
