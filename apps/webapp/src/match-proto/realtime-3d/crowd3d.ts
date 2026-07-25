/**
 * THROWAWAY PROTOTYPE (#81): the crowd test.
 *
 * #69's two-tier ruling requires a second capture the lane never had — a
 * formation of fodder containing heroes, on the SAME board, at ordinary
 * combat zoom — and a new axis, tier separation, scored on whether a hero
 * can be picked out of the mass at a glance.
 *
 * Three things here are deliberate and were learned the expensive way by
 * sibling lanes rather than invented:
 *
 *   1. **Heroes are never adjacent.** Two marked units standing shoulder to
 *      shoulder fuse their rings into one blob, and the capture then
 *      measures the ring rather than tier separation. `HERO_SLOTS` are
 *      chosen with a minimum slot distance and `crowd3d.test.ts` asserts it,
 *      so the constraint cannot be lost in a later layout tweak.
 *   2. **Two registers, not one.** Fodder at ~22 px and ~35 px, because
 *      every negative result so far has been a function of angular size and
 *      a single register cannot show that.
 *   3. **Per-unit phase, rate AND amplitude.** A bake can only offset
 *      playback phase; this runtime can vary the motion itself, and the
 *      crowd capture is where that difference either shows or doesn't.
 *
 * The board is untouched. Its floor luminance is currently eating roughly
 * half of every unit's contour (escalated on #69 from the Blender lane), but
 * it is the control all four lanes are judged against, so this lane measures
 * that and changes nothing.
 */

import * as THREE from "three";

import { buildBoard, type GritMode } from "./board3d.ts";
import { fitScreenHeight, PX_PER_UNIT, RIGHT, UP, VIEW, zoomForPixels } from "./camera3d.ts";
import { applyFodderPose, buildFodder, type Faction, type FodderArchetype, TIER_SCALE } from "./fodder3d.ts";
import { createMarkPass, enableMark, type MarkPass } from "./mark3d.ts";
import { applyMedicPose, buildMedic, type MedicRig } from "./medic3d.ts";

/** Projected screen height of a hero, in world units. */
export const HERO_SCREEN_HEIGHT = 2.03;
/** ...and of a fodder unit. The tier boost is enforced on projected height. */
export const FODDER_SCREEN_HEIGHT = HERO_SCREEN_HEIGHT / TIER_SCALE;

export type Register = "far" | "near";

/** Fodder pixel heights the two registers are calibrated to. */
export const REGISTER_PX: Record<Register, number> = { far: 22, near: 35 };

export function zoomFor(register: Register): number {
  return zoomForPixels(FODDER_SCREEN_HEIGHT, REGISTER_PX[register]);
}

const RANKS = 4;
const FILES = 5;
const SPACING_FILE = 0.92;
const SPACING_RANK = 0.86;

/**
 * Hero slots as [file, rank]. Chosen far apart on purpose: adjacent hero
 * rings fuse, and a fused ring measures the marking rather than the tier.
 */
export const HERO_SLOTS: Array<[number, number]> = [[1, 0], [4, 2]];

/** Chebyshev distance between two slots — the adjacency the test asserts on. */
export function slotDistance(a: [number, number], b: [number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

/**
 * Front ranks carry shields, back ranks carry barrels — a real formation
 * shape, and it puts the two archetypes in adjacent bands so the silhouette
 * comparison is available in one glance rather than across two captures.
 */
export function archetypeAt(rank: number): FodderArchetype {
  return rank < 2 ? "brute" : "marksman";
}

export interface Slot {
  file: number;
  rank: number;
  hero: boolean;
  archetype: FodderArchetype;
  faction: Faction;
  position: THREE.Vector3;
  yaw: number;
  jitter: number;
}

interface SideSpec {
  faction: Faction;
  center: [number, number];
  yaw: number;
}

const SIDES: SideSpec[] = [
  { center: [-2.85, 2.85], faction: "crew", yaw: (Math.PI * 3) / 4 },
  { center: [2.85, -2.85], faction: "opfor", yaw: -Math.PI / 4 },
];

/**
 * Lay one side out. Files run across the facing, ranks run back from it, so
 * both blocks front each other across the market lane.
 */
function layoutSide(spec: SideSpec, seed: number): Slot[] {
  const forward = new THREE.Vector3(Math.sin(spec.yaw), 0, Math.cos(spec.yaw));
  const across = new THREE.Vector3(Math.cos(spec.yaw), 0, -Math.sin(spec.yaw));
  const slots: Slot[] = [];
  let index = seed;
  for (let rank = 0; rank < RANKS; rank += 1) {
    for (let file = 0; file < FILES; file += 1) {
      index += 1;
      const hero = HERO_SLOTS.some(([f, r]) => f === file && r === rank);
      // A small deterministic wobble so the block is a formation, not a grid.
      const jx = (((index * 37) % 11) / 11 - 0.5) * 0.24;
      const jz = (((index * 53) % 13) / 13 - 0.5) * 0.22;
      const position = new THREE.Vector3(spec.center[0], 0, spec.center[1])
        .addScaledVector(across, (file - (FILES - 1) / 2) * SPACING_FILE + jx)
        .addScaledVector(forward, -rank * SPACING_RANK + jz);
      slots.push({
        archetype: archetypeAt(rank),
        faction: spec.faction,
        file,
        hero,
        jitter: index,
        position,
        rank,
        yaw: spec.yaw + (((index * 29) % 7) / 7 - 0.5) * 0.3,
      });
    }
  }
  return slots;
}

export function layoutCrowd(): Slot[] {
  return [...layoutSide(SIDES[0]!, 0), ...layoutSide(SIDES[1]!, 100)];
}

export interface CrowdStats {
  units: number;
  heroes: number;
  fodder: number;
  calls: number;
  triangles: number;
  markCalls: number;
  markTriangles: number;
  meanMs: number;
  p95Ms: number;
}

export interface CrowdOptions {
  register: Register;
  mark: boolean;
  motion: boolean;
  grit?: GritMode;
  width: number;
  height: number;
  /** Render exactly this clock value and stop, for deterministic capture. */
  freezeMs?: number;
  /** Render only the units, on a flat card — the un-crowded lineup view. */
  lineup?: boolean;
}

export interface CrowdHandle {
  canvas: HTMLCanvasElement;
  destroy: () => void;
  renderAt: (t: number) => void;
  stats: () => CrowdStats;
  measure: (samples: number) => { meanMs: number; p95Ms: number };
}

interface Unit {
  hero: boolean;
  medic?: MedicRig;
  fodder?: ReturnType<typeof buildFodder>;
  jitter: number;
}

/**
 * The lineup: one of every (tier x archetype x faction) on a plain card, at
 * the register's own scale. This view has now caught rigging bugs that the
 * single-subject loupe hid on two separate lanes — a rig can look correct
 * alone and obviously wrong the moment it stands next to its siblings — so
 * it is a first-class capture rather than an afterthought.
 */
function lineupSlots(): Slot[] {
  const specs: Array<[boolean, FodderArchetype, Faction]> = [
    [true, "brute", "crew"],
    [false, "brute", "crew"],
    [false, "marksman", "crew"],
    [true, "brute", "opfor"],
    [false, "brute", "opfor"],
    [false, "marksman", "opfor"],
  ];
  return specs.map(([hero, archetype, faction], i) => ({
    archetype,
    faction,
    file: i,
    hero,
    jitter: i * 7 + 3,
    position: new THREE.Vector3().addScaledVector(RIGHT, (i - (specs.length - 1) / 2) * 1.35),
    rank: 0,
    yaw: (Math.PI * 3) / 4,
  }));
}

function makeLights(): THREE.Object3D[] {
  const key = new THREE.DirectionalLight("#fdeeda", 12);
  key.position.set(3.2, 4.0, 0.2);
  const ambient = new THREE.AmbientLight("#c9aec0", 1.9);
  return [key, ambient];
}

export function mountCrowd3d(host: HTMLElement | null, options: CrowdOptions): CrowdHandle {
  const { height, mark, width } = options;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.setClearColor(options.lineup === true ? "#241c24" : "#120b10");
  if (host !== null) { host.append(renderer.domElement); }

  const scene = new THREE.Scene();
  scene.add(...makeLights());
  if (options.lineup !== true) {
    scene.add(buildBoard(options.grit ?? "both"));
  }

  const slots = options.lineup === true ? lineupSlots() : layoutCrowd();
  const units: Unit[] = [];

  for (const slot of slots) {
    let root: THREE.Group;
    const unit: Unit = { hero: slot.hero, jitter: slot.jitter };
    if (slot.hero) {
      const medic = buildMedic();
      fitScreenHeight(medic.root, HERO_SCREEN_HEIGHT);
      unit.medic = medic;
      root = medic.root;
    } else {
      const fodder = buildFodder(slot.archetype, slot.faction);
      fitScreenHeight(fodder.root, FODDER_SCREEN_HEIGHT);
      unit.fodder = fodder;
      root = fodder.root;
    }
    // The rig's own root carries pose translation, so parent it into a
    // placement group rather than fighting it for the transform.
    const place = new THREE.Group();
    place.position.copy(slot.position);
    place.rotation.y = slot.yaw;
    place.add(root);
    scene.add(place);

    if (slot.hero && mark) { enableMark(root, slot.faction); }

    // Flat comic drop shadow, scaled with the tier so the crowd sits down.
    if (options.lineup !== true) {
      const r = slot.hero ? 0.42 : 0.34;
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1, 16),
        new THREE.MeshBasicMaterial({ color: "#120b10", opacity: 0.45, transparent: true }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.set(r, r * 0.7, 1);
      shadow.position.set(slot.position.x, 0.012, slot.position.z);
      scene.add(shadow);
    }
    units.push(unit);
  }

  const zoom = options.lineup === true
    ? zoomForPixels(FODDER_SCREEN_HEIGHT, REGISTER_PX[options.register] * 3)
    : zoomFor(options.register);
  const halfW = width / (2 * PX_PER_UNIT * zoom);
  const halfH = height / (2 * PX_PER_UNIT * zoom);
  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 90);

  const target = options.lineup === true
    ? new THREE.Vector3().addScaledVector(UP, HERO_SCREEN_HEIGHT / 2)
    : new THREE.Vector3().addScaledVector(UP, 0.9);
  camera.position.copy(target).addScaledVector(VIEW, 30);
  camera.lookAt(target);
  // The main pass must not draw the mask layers as extra geometry.
  camera.layers.set(0);

  let markPass: MarkPass | undefined;
  if (mark) { markPass = createMarkPass(width, height); }

  const renderAt = (t: number): void => {
    for (let i = 0; i < units.length; i += 1) {
      const unit = units[i]!;
      if (unit.medic !== undefined) {
        applyMedicPose(unit.medic, "idle", options.motion ? t + unit.jitter * 0.31 : 0);
      } else if (unit.fodder !== undefined) {
        applyFodderPose(unit.fodder, options.motion ? t : 0, unit.jitter);
      }
    }
    renderer.info.reset();
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    if (markPass !== undefined) { markPass.render(renderer, scene, camera); }
  };

  let frame = 0;
  if (options.freezeMs === undefined) {
    const start = performance.now();
    const tick = (): void => {
      renderAt((performance.now() - start) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  } else {
    renderAt(options.freezeMs / 1000);
  }

  return {
    canvas: renderer.domElement,
    destroy: () => {
      cancelAnimationFrame(frame);
      markPass?.dispose();
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh || node instanceof THREE.LineSegments) {
          (node.geometry as THREE.BufferGeometry).dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
    measure: (samples) => {
      const times: number[] = [];
      for (let i = 0; i < samples; i += 1) {
        const at = performance.now();
        renderAt(i / 30);
        times.push(performance.now() - at);
      }
      times.sort((a, b) => a - b);
      const mean = times.reduce((sum, v) => sum + v, 0) / times.length;
      return { meanMs: mean, p95Ms: times[Math.floor(times.length * 0.95)] ?? mean };
    },
    renderAt,
    stats: () => {
      const markCost = markPass?.lastCost() ?? { calls: 0, triangles: 0 };
      return {
        calls: renderer.info.render.calls,
        fodder: units.filter((u) => !u.hero).length,
        heroes: units.filter((u) => u.hero).length,
        markCalls: markCost.calls,
        markTriangles: markCost.triangles,
        meanMs: 0,
        p95Ms: 0,
        triangles: renderer.info.render.triangles,
        units: units.length,
      };
    },
  };
}
