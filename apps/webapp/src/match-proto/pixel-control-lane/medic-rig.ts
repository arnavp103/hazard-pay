/**
 * THROWAWAY PROTOTYPE (#74, round 2) — the animation experiment.
 *
 * The round-1 critique passed the medic as a *drawing* but failed it as an
 * *acting* lane: the attack moved ~6 pixels of forearm while the torso,
 * head and legs stayed pixel-identical. Round 2's brief is to answer the
 * cofounder's open production question — "more sprites and interpolate, or
 * what?" — by standing up THREE competing animation treatments over the
 * same 48×64 medic and letting the taste gate pick a pipeline:
 *
 *   A. AUTHORED   — a few hand-shaped full-body key poses, played stepped.
 *                   Weight shifts through the hips/torso; the injector arm
 *                   articulates and the needle is drawn longer at full
 *                   extension (a real silhouette change a transform can't
 *                   fake). Deliberate, but reads stepped/flipbook.
 *   B. PROGRAMMATIC — one base sprite, driven continuously by grid-region
 *                   transforms: a hip-pivoted shear (whole-body lean /
 *                   weight shift, hole-free), vertical bob, a hand-drawn
 *                   motion smear on the fast frame, an emission flash, and
 *                   sub-pixel offsets at render time. Cheap and smooth, but
 *                   can read rubbery because pixels slide as rigid blocks.
 *   C. HYBRID     — authored key poses as anchors, with programmatic
 *                   in-betweening (shear-interpolated) and a smear on the
 *                   snap frame. Deliberate extremes, smooth connective
 *                   motion. The recommended production path.
 *
 * All three run off pure functions of a stepped JS clock so `?freeze=<ms>`
 * pins any instant for deterministic capture. Everything here is a pure
 * transform over the char grids in `./medic-48.ts` — no canvas, no DOM,
 * unit-testable in plain Node.
 *
 * SEAM: in a real pipeline the "authored" keys are Aseprite frames, the
 * "programmatic" transforms are a bone/mesh rig, and "hybrid" is authored
 * keys with engine tweening. This module is the throwaway stand-in that
 * lets the taste gate choose between those directions before we build one.
 */

import {
  MEDIC_HEIGHT,
  MEDIC_WIDTH,
  medicBack,
  medicFront,
  medicSide,
} from "./medic-48.ts";

const W = MEDIC_WIDTH;
const H = MEDIC_HEIGHT;
const TRANSPARENT = ".";

type Cells = string[][];

function toCells(rows: string[]): Cells {
  return rows.map((row) => [...row]);
}
function fromCells(cells: Cells): string[] {
  return cells.map((row) => row.join(""));
}
function blankCells(): Cells {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => TRANSPARENT));
}

/** Stamp `top`'s opaque pixels over a copy of `base`. */
export function overlay(base: string[], top: string[]): string[] {
  const out = toCells(base);
  toCells(top).forEach((row, y) => {
    const target = out[y];
    if (target === undefined) { return; }
    row.forEach((ch, x) => {
      if (ch !== TRANSPARENT) { target[x] = ch; }
    });
  });
  return fromCells(out);
}

/**
 * Horizontal shear: every row `y` slides by `round(shiftAt(y))`. Because a
 * whole row translates together, it never opens a hole in the silhouette —
 * this is the primitive that lets the WHOLE body lean/weight-shift.
 */
export function shearX(rows: string[], shiftAt: (y: number) => number): string[] {
  const src = toCells(rows);
  const out = blankCells();
  for (let y = 0; y < H; y += 1) {
    const srcRow = src[y];
    const dstRow = out[y];
    if (srcRow === undefined || dstRow === undefined) { continue; }
    const dx = Math.round(shiftAt(y));
    for (let x = 0; x < W; x += 1) {
      const ch = srcRow[x] ?? TRANSPARENT;
      if (ch === TRANSPARENT) { continue; }
      const nx = x + dx;
      if (nx >= 0 && nx < W) { dstRow[nx] = ch; }
    }
  }
  return fromCells(out);
}

/** Translate the whole grid vertically by `dy` (breath / crouch). */
export function shiftY(rows: string[], dy: number): string[] {
  if (dy === 0) { return rows.slice(); }
  const src = toCells(rows);
  const out = blankCells();
  for (let y = 0; y < H; y += 1) {
    const ny = y + dy;
    const srcRow = src[y];
    if (ny < 0 || ny >= H || srcRow === undefined) { continue; }
    out[ny] = srcRow.slice();
  }
  return fromCells(out);
}

/**
 * Lean the upper body about a hip pivot: rows above `pivotY` slide by
 * `k * (pivotY - y)`, rows at/below stay planted. Positive `k` leans the
 * torso/head toward the facing (right); negative winds it back.
 */
export function lean(rows: string[], pivotY: number, k: number): string[] {
  if (k === 0) { return rows.slice(); }
  return shearX(rows, (y) => (y < pivotY ? k * (pivotY - y) : 0));
}

/** Move a rectangular region by (dx,dy), stamped over the cleared source. */
export function moveRegion(
  rows: string[],
  x0: number, y0: number, x1: number, y1: number,
  dx: number, dy: number,
): string[] {
  const src = toCells(rows);
  const out = toCells(rows);
  for (let y = y0; y <= y1; y += 1) {
    const dstRow = out[y];
    if (dstRow === undefined) { continue; }
    for (let x = x0; x <= x1; x += 1) {
      if (x >= 0 && x < W) { dstRow[x] = TRANSPARENT; }
    }
  }
  for (let y = y0; y <= y1; y += 1) {
    const srcRow = src[y];
    if (srcRow === undefined) { continue; }
    for (let x = x0; x <= x1; x += 1) {
      const ch = srcRow[x] ?? TRANSPARENT;
      if (ch === TRANSPARENT) { continue; }
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) { continue; }
      const dstRow = out[ny];
      if (dstRow !== undefined) { dstRow[nx] = ch; }
    }
  }
  return fromCells(out);
}

/** Swap chars per map (emission dim/pulse). */
export function recolor(rows: string[], map: Record<string, string>): string[] {
  return rows.map((row) => [...row].map((ch) => map[ch] ?? ch).join(""));
}

/** Paint a list of pixels (drawn silhouette extension, flash, smear dots). */
export function paint(rows: string[], px: [number, number, string][]): string[] {
  const out = toCells(rows);
  for (const [y, x, ch] of px) {
    if (y < 0 || y >= H || x < 0 || x >= W) { continue; }
    const row = out[y];
    if (row !== undefined) { row[x] = ch; }
  }
  return fromCells(out);
}

// --- body / arm separation --------------------------------------------
// The injector forearm is lifted onto its own layer so it can articulate
// without tearing a hole in the coat: the body carries a filled coat where
// the arm used to be, and the arm is overlaid (moved) on top.

const ARM_BOX = { x0: 23, y0: 31, x1: 45, y1: 37 };
const HIP_Y = 38;
/** Front (leading) leg column span, for the lunge step. */
const FRONT_LEG = { x0: 24, y0: 49, x1: 34, y1: 61 };
/** Injector needle tip at rest (row, col) — where drawn extensions grow. */
const TIP_Y = 36;
const TIP_X = 40;

/** medicSide with the forearm erased and the coat filled back in. */
export const medicSideBody: string[] = (() => {
  const c = toCells(medicSide);
  for (let y = ARM_BOX.y0; y <= ARM_BOX.y1; y += 1) {
    const row = c[y];
    if (row === undefined) { continue; }
    for (let x = ARM_BOX.x0; x < W; x += 1) {
      row[x] = x <= 28 ? "c" : x === 29 ? "C" : x === 30 ? "k" : TRANSPARENT;
    }
  }
  return fromCells(c);
})();

/** Just the forearm + injector, on a transparent field. */
export const medicSideArm: string[] = (() => {
  const src = toCells(medicSide);
  const out = blankCells();
  for (let y = ARM_BOX.y0; y <= ARM_BOX.y1; y += 1) {
    const row = out[y];
    if (row === undefined) { continue; }
    for (let x = ARM_BOX.x0; x <= ARM_BOX.x1; x += 1) {
      row[x] = src[y]?.[x] ?? TRANSPARENT;
    }
  }
  return fromCells(out);
})();

/** Extend the needle `len` px past the tip (drawn metal + teal pixels). */
function drawNeedle(rows: string[], len: number, dx: number, dy: number): string[] {
  if (len <= 0) { return rows; }
  const px: [number, number, string][] = [];
  const y = TIP_Y + dy;
  for (let i = 1; i <= len; i += 1) {
    const x = TIP_X + dx + i;
    px.push([y, x, i === len ? "u" : i >= len - 1 ? "t" : "n"]);
    if (i < len - 1) { px.push([y - 1, x, "M"]); }
  }
  return paint(rows, px);
}

/** Emission burst around the needle tip (impact), kept inside the canvas. */
function drawFlash(rows: string[], dx: number, dy: number): string[] {
  const y = TIP_Y + dy;
  const x = Math.min(TIP_X + dx + 3, 45);
  return paint(rows, [
    [y, x, "u"], [y - 1, x, "t"], [y + 1, x, "t"],
    [y - 2, x - 1, "t"], [y + 2, x - 1, "t"],
    [y, x + 1, "u"], [y - 1, x + 2, "t"], [y + 1, x + 2, "t"],
  ]);
}

/** Horizontal motion smear behind the fast-moving forearm (programmatic). */
function drawSmear(rows: string[], reach: number, dy: number): string[] {
  const px: [number, number, string][] = [];
  const y = TIP_Y + dy;
  for (let i = 1; i <= reach; i += 1) {
    const x = TIP_X - i;
    px.push([y, x, i % 2 === 0 ? "n" : "M"]);
    px.push([y - 1, x, "M"]);
  }
  return paint(rows, px);
}

// --- pose model --------------------------------------------------------

interface Pose {
  /** Hip-pivot shear (whole-body lean). */
  lean: number;
  /** Vertical bob (breath / crouch). */
  bob: number;
  /** Chin tuck: hood + head region dips by this many rows. */
  headDip: number;
  /** Injector forearm offset. */
  armDx: number;
  armDy: number;
  /** Leading-leg forward lunge step. */
  legDx: number;
  /** Drawn needle extension length past the tip. */
  needle: number;
  /** Emission burst at the tip. */
  flash: boolean;
  /** Motion-smear reach behind the forearm. */
  smear: number;
}

const REST: Pose = { lean: 0, bob: 0, headDip: 0, armDx: 0, armDy: 0, legDx: 0, needle: 0, flash: false, smear: 0 };

/** Compose one pose into a finished 48×64 grid. */
export function renderPose(partial: Partial<Pose>): string[] {
  const p: Pose = { ...REST, ...partial };
  let body = medicSideBody;
  if (p.legDx !== 0) {
    body = moveRegion(body, FRONT_LEG.x0, FRONT_LEG.y0, FRONT_LEG.x1, FRONT_LEG.y1, p.legDx, 0);
  }
  if (p.headDip !== 0) {
    body = moveRegion(body, 8, 6, 31, 18, 0, p.headDip);
  }
  let arm = medicSideArm;
  if (p.armDx !== 0 || p.armDy !== 0) {
    arm = moveRegion(arm, ARM_BOX.x0, ARM_BOX.y0, ARM_BOX.x1, ARM_BOX.y1, p.armDx, p.armDy);
  }
  let g = overlay(body, arm);
  if (p.needle > 0) { g = drawNeedle(g, p.needle, p.armDx, p.armDy); }
  if (p.smear > 0) { g = drawSmear(g, p.smear, p.armDy); }
  if (p.flash) { g = drawFlash(g, p.armDx, p.armDy); }
  if (p.lean !== 0) { g = lean(g, HIP_Y, p.lean); }
  if (p.bob !== 0) { g = shiftY(g, p.bob); }
  return g;
}

// --- clock helpers -----------------------------------------------------

export interface RigFrame {
  rows: string[];
  /** Sub-pixel render offset in CSS px (programmatic micro-motion). */
  dx: number;
  dy: number;
}

function still(rows: string[]): RigFrame {
  return { rows, dx: 0, dy: 0 };
}

function stepIndex(clockMs: number, durations: number[]): number {
  const total = durations.reduce((s, d) => s + d, 0);
  let local = ((clockMs % total) + total) % total;
  for (let i = 0; i < durations.length; i += 1) {
    if (local < (durations[i] ?? 0)) { return i; }
    local -= durations[i] ?? 0;
  }
  return 0;
}

/** Normalized [0,1) phase across a cycle. */
function phase(clockMs: number, cycleMs: number): number {
  return (((clockMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// --- A. AUTHORED: hand-shaped full-body key poses, played stepped ------

/** Shared cycle lengths so all three treatments loop in lockstep (clean
 * side-by-side comparison + clean single-cycle GIF capture). */
export const IDLE_CYCLE_MS = 1800;
export const ATTACK_CYCLE_MS = 1100;

const IDLE_KEYS: Partial<Pose>[] = [
  { lean: 0.02, bob: 0, headDip: 0 },
  { lean: 0.05, bob: 0, headDip: 1, armDy: 1 },
  { lean: 0.02, bob: 1, headDip: 1, armDy: 1 },
  { lean: -0.03, bob: 0, headDip: 0 },
];
const IDLE_KEY_MS = [520, 420, 420, 440];

const ATTACK_KEYS: Partial<Pose>[] = [
  // 0 ready
  { lean: 0.02 },
  // 1 windup: weight back, hood dips, forearm cocked to the chest, front knee draws in
  { lean: -0.09, headDip: 1, armDx: -9, armDy: -3, legDx: -1 },
  // 2 thrust: hard forward lunge, front foot plants ahead, arm + needle fully out
  { lean: 0.12, armDx: 2, armDy: 1, legDx: 3, needle: 5 },
  // 3 impact: held extension, emission burst, tiny recoil
  { lean: 0.11, armDx: 2, armDy: 1, legDx: 3, needle: 5, flash: true },
  // 4 recover: ease back through a shortened cock
  { lean: -0.03, armDx: -3, armDy: -1, legDx: 1 },
  // 5 settle
  { lean: 0.02 },
];
const ATTACK_KEY_MS = [280, 200, 90, 140, 170, 220];

const authoredIdleFrames = IDLE_KEYS.map((k) => renderPose(k));
const authoredAttackFrames = ATTACK_KEYS.map((k) => renderPose(k));

// --- B. PROGRAMMATIC: continuous transforms of the one base sprite -----

function programmaticIdle(clockMs: number): RigFrame {
  const t = phase(clockMs, IDLE_CYCLE_MS);
  const wave = Math.sin(t * Math.PI * 2);
  const breath = Math.sin(t * Math.PI * 2 - Math.PI / 2);
  // whole-body weight shift (hip-pivot lean) + sub-pixel breathing bob
  const rows = lean(medicSide, HIP_Y, 0.035 * wave);
  return { rows, dx: 0.5 * wave, dy: 0.6 * (breath > 0 ? breath : breath * 0.4) };
}

function programmaticAttack(clockMs: number): RigFrame {
  const t = phase(clockMs, ATTACK_CYCLE_MS);
  // piecewise ease: windup -> snap -> hold -> recover, all from one sprite
  if (t < 0.32) {
    const u = t / 0.32; // ease back
    const k = lerp(0, -0.12, u * u);
    return { rows: shiftY(lean(medicSide, HIP_Y, k), Math.round(lerp(0, 1, u))), dx: 0, dy: 0 };
  }
  if (t < 0.46) {
    const u = (t - 0.32) / 0.14; // explosive forward snap + smear
    const k = lerp(-0.12, 0.16, u);
    let rows = lean(medicSide, HIP_Y, k);
    rows = drawSmear(rows, Math.round(lerp(2, 7, u)), 0);
    return { rows, dx: lerp(-1, 2, u), dy: 0 };
  }
  if (t < 0.6) {
    const rows = drawFlash(lean(medicSide, HIP_Y, 0.16), 6, 0);
    return { rows, dx: 2, dy: 0 };
  }
  const u = (t - 0.6) / 0.4; // recover
  const k = lerp(0.16, 0, u);
  return { rows: lean(medicSide, HIP_Y, k), dx: lerp(2, 0, u), dy: 0 };
}

// --- C. HYBRID: authored keys + programmatic in-betweening + smear -----

/** Shear-interpolate between two authored key poses. */
function tween(a: Partial<Pose>, b: Partial<Pose>, u: number, extra?: Partial<Pose>): string[] {
  const pa: Pose = { ...REST, ...a };
  const pb: Pose = { ...REST, ...b };
  return renderPose({
    lean: lerp(pa.lean, pb.lean, u),
    bob: Math.round(lerp(pa.bob, pb.bob, u)),
    headDip: Math.round(lerp(pa.headDip, pb.headDip, u)),
    armDx: Math.round(lerp(pa.armDx, pb.armDx, u)),
    armDy: Math.round(lerp(pa.armDy, pb.armDy, u)),
    legDx: Math.round(lerp(pa.legDx, pb.legDx, u)),
    needle: Math.round(lerp(pa.needle, pb.needle, u)),
    ...extra,
  });
}

function hybridIdle(clockMs: number): RigFrame {
  const t = phase(clockMs, IDLE_CYCLE_MS);
  // walk the authored idle keys but tween between neighbours + sub-pixel
  const n = IDLE_KEYS.length;
  const scaled = t * n;
  const i = Math.floor(scaled);
  const u = scaled - i;
  const a = IDLE_KEYS[i % n] ?? {};
  const b = IDLE_KEYS[(i + 1) % n] ?? {};
  const wave = Math.sin(t * Math.PI * 2);
  return { rows: tween(a, b, u), dx: 0.4 * wave, dy: 0 };
}

function atkKey(i: number): Partial<Pose> {
  return ATTACK_KEYS[i] ?? {};
}

function hybridAttack(clockMs: number): RigFrame {
  const t = phase(clockMs, ATTACK_CYCLE_MS);
  // authored extremes at the milestones, programmatic tween + smear between
  if (t < 0.30) {
    return { rows: tween(atkKey(0), atkKey(1), t / 0.30), dx: 0, dy: 0 };
  }
  if (t < 0.44) {
    const u = (t - 0.30) / 0.14;
    const rows = tween(atkKey(1), atkKey(2), u, { smear: Math.round(lerp(2, 6, u)) });
    return { rows, dx: lerp(-1, 1, u), dy: 0 };
  }
  if (t < 0.58) {
    return { rows: renderPose(atkKey(3)), dx: 1, dy: 0 };
  }
  if (t < 0.78) {
    const u = (t - 0.58) / 0.20;
    return { rows: tween(atkKey(3), atkKey(4), u), dx: lerp(1, 0, u), dy: 0 };
  }
  return { rows: tween(atkKey(4), atkKey(5), (t - 0.78) / 0.22), dx: 0, dy: 0 };
}

// --- treatment registry ------------------------------------------------

export type TreatmentKey = "authored" | "programmatic" | "hybrid";

export interface AnimTreatment {
  key: TreatmentKey;
  name: string;
  blurb: string;
  idle: (clockMs: number) => RigFrame;
  attack: (clockMs: number) => RigFrame;
}

const authoredTreatment: AnimTreatment = {
  key: "authored",
  name: "Authored keys",
  blurb: "hand-shaped full-body poses, stepped",
  idle: (ms) => still(authoredIdleFrames[stepIndex(ms, IDLE_KEY_MS)] ?? medicSide),
  attack: (ms) => still(authoredAttackFrames[stepIndex(ms, ATTACK_KEY_MS)] ?? medicSide),
};

const programmaticTreatment: AnimTreatment = {
  key: "programmatic",
  name: "Programmatic",
  blurb: "one sprite, transformed + smear + sub-pixel",
  idle: programmaticIdle,
  attack: programmaticAttack,
};

const hybridTreatment: AnimTreatment = {
  key: "hybrid",
  name: "Hybrid",
  blurb: "authored keys + programmatic in-betweens",
  idle: hybridIdle,
  attack: hybridAttack,
};

export const treatments: AnimTreatment[] = [authoredTreatment, programmaticTreatment, hybridTreatment];

export function getTreatment(key: string): AnimTreatment {
  return treatments.find((treatment) => treatment.key === key) ?? hybridTreatment;
}

// --- facing selection (turn / static) ----------------------------------

export type Facing = "side" | "front" | "back" | "left";

export interface SubjectState {
  frame: RigFrame;
  mirrored: boolean;
}

/**
 * Resolve the subject for the scene: front/back are static authored
 * facings; side runs the selected animation treatment.
 */
export function subjectFor(
  clockMs: number,
  facing: Facing,
  animation: "idle" | "attack" | "none",
  treatmentKey: string,
): SubjectState {
  const mirrored = facing === "left";
  if (facing === "front") { return { frame: still(medicFront), mirrored }; }
  if (facing === "back") { return { frame: still(medicBack), mirrored }; }
  if (animation === "none") { return { frame: still(medicSide), mirrored }; }
  const treatment = getTreatment(treatmentKey);
  const frame = animation === "attack" ? treatment.attack(clockMs) : treatment.idle(clockMs);
  return { frame, mirrored };
}
