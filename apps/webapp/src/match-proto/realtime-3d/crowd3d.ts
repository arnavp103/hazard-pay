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

/**
 * The formation is deliberately NOT screen-aligned, and that took two tries.
 *
 * Facing the sides at each other along screen-x puts the rank axis on
 * (1,0,-1)/sqrt2 and the file axis on (-1,0,-1)/sqrt2 — which project to
 * pure screen-horizontal (travel 1.414) and pure screen-vertical (travel
 * 0.5) respectively. Two consequences, both bad: equal world spacing puts
 * ranks nearly 3x further apart on screen than files, and even after
 * correcting for that the block reads as a flat grid pasted on the viewport,
 * because neither axis recedes.
 *
 * Facing them along world X instead puts both axes on (0.707, -0.354) and
 * (0.707, 0.354) — the camera's own ground diagonals. Ranks now recede
 * down-right, files run up-right, the two armies confront each other across
 * the screen diagonal, and because both axes project at the same magnitude
 * (0.79) a single spacing number produces even screen spacing.
 */
const AXIS_SCREEN_TRAVEL = Math.hypot(Math.SQRT1_2, 0.35355);
const SPACING_RANK = 1.02;
const SPACING_FILE = 1.02;

/**
 * Hero slots as [file, rank], chosen to maximise SCREEN separation.
 *
 * "Non-adjacent in the formation" is not the same constraint as
 * "non-adjacent on screen", and this camera is exactly where the two come
 * apart. Under the dimetric projection a slot's screen offset is
 * proportional to `((file - mid) - rank, (file - mid) + rank)`, so a pair
 * three files and two ranks apart — Chebyshev distance 3, comfortably
 * "non-adjacent" — collapses to 1.94 world units on screen and its two rings
 * touch. The pair below is Chebyshev 4 but 5.06 units apart on screen, 2.6x
 * further, because it is separated along the axis the projection stretches
 * rather than the one it compresses.
 *
 * Fused rings matter because the capture then measures the ring instead of
 * measuring tier separation.
 *
 * There is a SECOND constraint pulling the other way, learned by overshooting
 * the first. Maximising screen separation alone put a hero at rank 3, and the
 * back rank is the farthest thing from a camera that looks down the +X/+Z
 * diagonal — so its own army stood in front of it, the depth-tested marking
 * pass correctly suppressed the ring, and the hero vanished from the capture
 * entirely. Heroes therefore stay in the front two ranks. 2.81 units of
 * screen travel is 60 px at the near register and 38 px at the far one,
 * against a 2.2 px ring on a ~16 px-wide unit: nowhere near fusing.
 */
export const HERO_SLOTS: Array<[number, number]> = [[0, 0], [4, 1]];
/** Heroes never stand behind their own army. */
export const HERO_MAX_RANK = 1;

/** Chebyshev distance between two slots. */
export function slotDistance(a: [number, number], b: [number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
}

/**
 * Screen-space distance between two slots, in world units of screen travel.
 * This is the number that decides whether two hero rings fuse.
 */
export function slotScreenDistance(a: [number, number], b: [number, number]): number {
  const mid = (FILES - 1) / 2;
  const at = (slot: [number, number]): [number, number] => [
    SPACING_FILE * Math.SQRT1_2 * ((slot[0] - mid) - slot[1]),
    SPACING_FILE * 0.35355 * ((slot[0] - mid) + slot[1]),
  ];
  const p0 = at(a);
  const p1 = at(b);
  return Math.hypot(p0[0] - p1[0], p0[1] - p1[1]);
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

/**
 * Both blocks are pulled off the world-X axis toward the screen centre. On
 * the axis, each side's back ranks reached x = +/-5.7 and ran behind the
 * market stalls: with the marking pass correctly depth-tested, an occluded
 * hero's ring is suppressed, so a hero simply vanished from the capture and
 * the hero-finding test had 3 findable heroes instead of 4. Sliding along
 * -Z / +Z moves each block up-right / down-left on screen, out from behind
 * its own building, without changing the confrontation.
 */
const SIDES: SideSpec[] = [
  { center: [-2.6, -1.15], faction: "crew", yaw: Math.PI / 2 },
  { center: [2.6, 1.15], faction: "opfor", yaw: -Math.PI / 2 },
];

/** Screen travel per world unit of formation spacing, for the cost report. */
export const FORMATION_AXIS_TRAVEL = AXIS_SCREEN_TRAVEL;

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
      const jx = (((index * 37) % 11) / 11 - 0.5) * 0.5;
      const jz = (((index * 53) % 13) / 13 - 0.5) * 0.3;
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
  /** Draw calls for the lit scene pass alone, before any marking. */
  baseCalls: number;
  baseTriangles: number;
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
  /**
   * Board with no units. Used to sample the floor's luminance distribution
   * for the contrast measurement escalated on #69.
   */
  boardOnly?: boolean;
  /**
   * Units on a keyed background no palette colour can collide with, so the
   * unit mask — and therefore the silhouette edge — can be extracted exactly
   * rather than thresholded out of the composited frame.
   */
  maskMode?: boolean;
}

/** The key colour for `maskMode`. Not reachable by any material in the lane. */
export const MASK_KEY: [number, number, number] = [255, 0, 255];

export interface CrowdHandle {
  canvas: HTMLCanvasElement;
  /** World point -> stage pixel, so loupe crops are computed, not eyeballed. */
  project: (at: THREE.Vector3) => [number, number];
  /** Where each unit stands, for targeting loupes and hero-finding checks. */
  slots: Slot[];
  destroy: () => void;
  renderAt: (t: number) => void;
  stats: () => CrowdStats;
  measure: (samples: number) => { meanMs: number; p95Ms: number };
}

export interface CrowdUnit {
  hero: boolean;
  medic?: MedicRig;
  fodder?: ReturnType<typeof buildFodder>;
  jitter: number;
  /** Placement group: owns position and facing, so the rig root keeps pose. */
  place: THREE.Group;
}

/**
 * Build the units for a set of slots, with no renderer involved.
 *
 * Split out of `mountCrowd3d` on purpose. The frozen-crowd defect — two
 * motion GIFs that were 24 identical frames — lived in the per-frame posing
 * call inside the render loop, which no test could reach because reaching it
 * needed a WebGL context. Everything except the actual draw call is pure
 * three.js and runs fine in node, so it lives here where a test can drive it.
 */
export function buildCrowdUnits(slots: Slot[], markHeroes: boolean, maskIds = false): CrowdUnit[] {
  const units: CrowdUnit[] = [];
  for (const slot of slots) {
    let root: THREE.Group;
    let medic: MedicRig | undefined;
    let fodder: ReturnType<typeof buildFodder> | undefined;
    if (slot.hero) {
      medic = buildMedic(slot.faction);
      fitScreenHeight(medic.root, HERO_SCREEN_HEIGHT);
      root = medic.root;
    } else {
      fodder = buildFodder(slot.archetype, slot.faction);
      fitScreenHeight(fodder.root, FODDER_SCREEN_HEIGHT);
      root = fodder.root;
    }
    // The rig's own root carries pose translation, so parent it into a
    // placement group rather than fighting it for the transform.
    const place = new THREE.Group();
    place.position.copy(slot.position);
    place.rotation.y = slot.yaw;
    place.add(root);

    if (slot.hero && markHeroes) { enableMark(root, slot.faction); }

    // Mask mode paints each unit a unique flat id colour. Keying the whole
    // crowd to one colour instead measures only the outer boundary of each
    // clump — every interior unit-against-unit edge, which is most of the
    // contour in a formation, is invisible to it.
    if (maskIds) {
      const id = units.length + 1;
      const idMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(
          (((id * 37) % 251) + 4) / 255,
          (((id * 91) % 251) + 4) / 255,
          0.5,
        ),
      });
      root.traverse((node) => {
        if (node instanceof THREE.Mesh) { node.material = idMaterial; }
      });
    }

    units.push({ fodder, hero: slot.hero, jitter: slot.jitter, medic, place });
  }
  return units;
}

/**
 * Drive every unit's pose from one clock. `t` IS the clock: a still is
 * `poseCrowd(units, 0)` and a loop is a sequence of t. There is deliberately
 * no "should we animate" flag in here — the previous version had one, and it
 * silently rendered every frame of both crowd motion GIFs at t=0.
 */
export function poseCrowd(units: CrowdUnit[], t: number): void {
  for (const unit of units) {
    if (unit.medic !== undefined) {
      applyMedicPose(unit.medic, "idle", t + unit.jitter * 0.31);
    } else if (unit.fodder !== undefined) {
      applyFodderPose(unit.fodder, t, unit.jitter);
    }
  }
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
    // 1.1 rather than 1.35: at the near register's 3x lineup zoom the
    // aperture is 7.45 world units wide and six units at 1.35 spanned 8.0,
    // so the last unit was cropped straight out of the capture.
    position: new THREE.Vector3().addScaledVector(RIGHT, (i - (specs.length - 1) / 2) * 1.1),
    rank: 0,
    yaw: Math.PI / 2,
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
  // At the 22 px register the aperture is 35.5 x 20 world units, but the
  // shared board's floor is a 30 x 30 plane whose dimetric projection is a
  // diamond — so its corners fall short of a 16:9 frame and the clear colour
  // shows through. Clearing to the floor's own tone keeps that from reading
  // as a hole in the capture. The BOARD is untouched; this is a framing
  // choice in the capture surface, and it is called out in the gallery.
  const clear = options.maskMode === true
    ? "#ff00ff"
    : (options.lineup === true ? "#241c24" : "#332733");
  renderer.setClearColor(clear);
  if (host !== null) { host.append(renderer.domElement); }

  const scene = new THREE.Scene();
  scene.add(...makeLights());
  if (options.lineup !== true && options.maskMode !== true) {
    scene.add(buildBoard(options.grit ?? "both"));
  }

  const slots = options.boardOnly === true
    ? []
    : (options.lineup === true ? lineupSlots() : layoutCrowd());
  const units = buildCrowdUnits(slots, mark, options.maskMode === true);
  for (const unit of units) { scene.add(unit.place); }

  // Flat comic drop shadows, scaled with the tier so the crowd sits down.
  if (options.lineup !== true && options.maskMode !== true) {
    for (const slot of slots) {
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

  // three resets `renderer.info` at the start of every `render()` call, so a
  // multi-pass frame reports only its LAST pass. Left on, the mark pass
  // measured as -1444 draw calls. Counters are now driven by hand.
  renderer.info.autoReset = false;

  const renderAt = (t: number): void => {
    poseCrowd(units, t);
    renderer.info.reset();
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    baseCalls = renderer.info.render.calls;
    baseTriangles = renderer.info.render.triangles;
    if (markPass !== undefined) { markPass.render(renderer, scene, camera); }
  };

  let baseCalls = 0;
  let baseTriangles = 0;

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
    project: (at: THREE.Vector3) => {
      const ndc = at.clone().project(camera);
      return [(ndc.x * 0.5 + 0.5) * width, (1 - (ndc.y * 0.5 + 0.5)) * height];
    },
    slots,
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
        baseCalls,
        baseTriangles,
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
