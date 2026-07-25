/**
 * THROWAWAY PROTOTYPE (#91) — the shared grime-market board.
 *
 * This module is the *experiment control*. Both treatments render from
 * this one model, so "same board, same camera, same framing" is enforced
 * by construction rather than by eyeballing two drawings:
 *
 * - `groundAt` is the authored floor plan (deterministic, no RNG);
 * - `props` is the authored prop manifest in cell space;
 * - `project` is the single 2:1 dimetric projection (#68: fixed angle,
 *   panning non-rotating camera — the camera below translates and
 *   integer-scales, it never rotates);
 * - `cameras` are the framings every capture is taken through;
 * - `units` are placeholder unit placements at both tiers.
 *
 * Cell space: `cx` runs screen-right-and-down, `cy` screen-left-and-down.
 * Board space: 640×360 native pixels, which is the authoring resolution of
 * treatment B and the `viewBox` of treatment A.
 */

export const BOARD_WIDTH = 640;
export const BOARD_HEIGHT = 360;

/** 2:1 dimetric tile. */
export const TILE_W = 32;
export const TILE_H = 16;

export const GRID = 20;

const ORIGIN_X = 320;
const ORIGIN_Y = 40;

export interface Point { x: number; y: number }

/** Cell centre in board pixels. Fixed angle; never rotated. */
export function project(cx: number, cy: number): Point {
  return {
    x: ORIGIN_X + (cx - cy) * (TILE_W / 2),
    y: ORIGIN_Y + (cx + cy) * (TILE_H / 2),
  };
}

/** Painter-algorithm depth. Larger draws later (nearer the camera). */
export function depth(cx: number, cy: number): number {
  return cx + cy;
}

export type Ground
  = | "asphalt"
    | "asphaltWet"
    | "concrete"
    | "dirt"
    | "grate"
    | "mat";

/**
 * The authored floor plan. A central aisle crossing a transverse lane
 * splits the plaza into four stall quadrants; the perimeter is the
 * concrete apron of the surrounding blocks. Quiet contrast throughout —
 * canon reserves the darkest contours and brightest points for units.
 */
export function groundAt(cx: number, cy: number): Ground {
  const onEdge = cx <= 1 || cy <= 1 || cx >= GRID - 2 || cy >= GRID - 2;
  if (onEdge) { return "concrete"; }

  const aisle = Math.abs(cx - cy) <= 1;
  const cross = cx + cy >= 18 && cx + cy <= 20;
  if (aisle || cross) {
    // Standing water where the aisle meets the low corner of the plaza.
    if (cx >= 4 && cx <= 8 && cy >= 11 && cy <= 15) { return "asphaltWet"; }
    return "asphalt";
  }

  // Drain cluster under the north-east stalls.
  if (cx >= 13 && cx <= 15 && cy >= 4 && cy <= 6) { return "grate"; }

  // Trodden dirt directly around the stall footprints, mats further in.
  const quadrantDepth = Math.min(Math.abs(cx - cy) - 2, Math.abs(cx + cy - 19) - 2);
  return quadrantDepth <= 1 ? "dirt" : "mat";
}

export type PropKind
  = | "awningStall"
    | "barrelPair"
    | "blockWall"
    | "cableSpool"
    | "crateStack"
    | "dumpster"
    | "lampPost"
    | "pipeRack"
    | "rubble"
    | "signPylon"
    | "vent";

export interface Prop {
  id: string;
  kind: PropKind;
  cx: number;
  cy: number;
  /** Which identity ramp this instance wears (stalls, crates, tarps). */
  tone: "cool" | "warm";
  /** Emission channel for the props that carry one. */
  signal?: "amber" | "teal";
  /** Extra board-pixel lift, for props sitting on top of others. */
  lift?: number;
}

/**
 * Authored prop manifest — a market that has been lived in: two runs of
 * awning stalls facing the aisle, service clutter pushed into the corners,
 * a drain-side pipe rack, and the block walls that close the plaza.
 * Hand-placed, deliberately not procedurally scattered.
 */
export const props: readonly Prop[] = [
  // Perimeter block walls, drawn first (deepest).
  { id: "wall-nw", kind: "blockWall", cx: 1, cy: 4, tone: "cool" },
  { id: "wall-n", kind: "blockWall", cx: 2, cy: 1, tone: "warm" },
  { id: "wall-ne", kind: "blockWall", cx: 6, cy: 1, tone: "cool" },
  { id: "wall-ne2", kind: "blockWall", cx: 10, cy: 1, tone: "warm" },
  { id: "wall-e", kind: "blockWall", cx: 14, cy: 1, tone: "cool" },
  { id: "wall-w", kind: "blockWall", cx: 1, cy: 8, tone: "warm" },
  { id: "wall-w2", kind: "blockWall", cx: 1, cy: 12, tone: "cool" },

  // North-east stall run, facing the aisle.
  { id: "stall-ne-1", kind: "awningStall", cx: 12, cy: 5, tone: "warm", signal: "amber" },
  { id: "stall-ne-2", kind: "awningStall", cx: 15, cy: 8, tone: "cool", signal: "teal" },
  { id: "crate-ne", kind: "crateStack", cx: 14, cy: 7, tone: "warm" },
  { id: "barrel-ne", kind: "barrelPair", cx: 16, cy: 6, tone: "cool" },
  { id: "vent-ne", kind: "vent", cx: 17, cy: 4, tone: "cool", signal: "teal" },
  { id: "pipe-ne", kind: "pipeRack", cx: 17.4, cy: 5.2, tone: "cool" },
  { id: "rubble-ne", kind: "rubble", cx: 13, cy: 8, tone: "warm" },

  // South-west stall run.
  { id: "stall-sw-1", kind: "awningStall", cx: 5, cy: 12, tone: "cool", signal: "teal" },
  { id: "stall-sw-2", kind: "awningStall", cx: 8, cy: 15, tone: "warm", signal: "amber" },
  { id: "crate-sw", kind: "crateStack", cx: 3.2, cy: 13.4, tone: "cool" },
  { id: "dumpster-sw", kind: "dumpster", cx: 3, cy: 11, tone: "warm" },
  { id: "spool-sw", kind: "cableSpool", cx: 6, cy: 16, tone: "warm" },
  { id: "rubble-sw", kind: "rubble", cx: 7.6, cy: 14.6, tone: "cool" },

  // North-west quadrant: service side.
  { id: "crate-nw", kind: "crateStack", cx: 4, cy: 6, tone: "warm" },
  { id: "barrel-nw", kind: "barrelPair", cx: 2.6, cy: 5.4, tone: "warm" },
  { id: "vent-nw", kind: "vent", cx: 5, cy: 3, tone: "warm", signal: "amber" },
  { id: "dumpster-nw", kind: "dumpster", cx: 6.4, cy: 4.2, tone: "cool" },

  // South-east quadrant.
  { id: "crate-se", kind: "crateStack", cx: 15, cy: 13, tone: "cool" },
  { id: "barrel-se", kind: "barrelPair", cx: 13, cy: 15, tone: "warm" },
  { id: "spool-se", kind: "cableSpool", cx: 16.6, cy: 14.2, tone: "cool" },
  { id: "pipe-se", kind: "pipeRack", cx: 17, cy: 12, tone: "warm" },

  // Aisle furniture — the two lamps and the plaza sign are the only
  // things allowed to stand in the walkable lane.
  { id: "lamp-n", kind: "lampPost", cx: 9, cy: 7, tone: "warm", signal: "amber" },
  { id: "lamp-s", kind: "lampPost", cx: 12, cy: 14, tone: "cool", signal: "teal" },
  { id: "sign-plaza", kind: "signPylon", cx: 3, cy: 8, tone: "warm", signal: "amber" },
  { id: "sign-clinic", kind: "signPylon", cx: 17, cy: 9, tone: "cool", signal: "teal" },
];

/** Props sorted back-to-front for painter compositing. */
export function sortedProps(): Prop[] {
  return [...props].sort((a, b) => depth(a.cx, a.cy) - depth(b.cx, b.cy));
}

export type Tier = "fodder" | "hero";
export type Side = "crew" | "rival";
export type Archetype = "medic" | "melee" | "ranged";

export interface UnitPlacement {
  id: string;
  tier: Tier;
  side: Side;
  archetype: Archetype;
  cx: number;
  cy: number;
  /** `true` renders the sprite mirrored (the other authored facing). */
  mirrored: boolean;
}

function formation(
  side: Side,
  archetype: Archetype,
  originX: number,
  originY: number,
  columns: number,
  rows: number,
  mirrored: boolean,
): UnitPlacement[] {
  const out: UnitPlacement[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      out.push({
        id: `${side}-${archetype}-${String(row)}-${String(column)}`,
        tier: "fodder",
        side,
        archetype,
        cx: originX + column * 1.1 + row * 0.45,
        cy: originY + row * 1.1 - column * 0.35,
        mirrored,
      });
    }
  }
  return out;
}

/**
 * Placeholder roster at both tiers. Heroes are the borrowed 48×64 medic
 * (lane art from #74 — characters are explicitly not this lane's
 * variable); fodder are two archetypes at 38×50, the "slight size boost"
 * hero:fodder ratio from the #69 tier-separation ruling (≈1.28×).
 */
export const units: readonly UnitPlacement[] = [
  { id: "hero-crew", tier: "hero", side: "crew", archetype: "medic", cx: 8.4, cy: 11.2, mirrored: false },
  { id: "hero-rival", tier: "hero", side: "rival", archetype: "medic", cx: 12.2, cy: 8.4, mirrored: true },
  ...formation("crew", "melee", 6.2, 12.6, 4, 2, false),
  ...formation("crew", "ranged", 4.6, 14.4, 4, 2, false),
  ...formation("rival", "melee", 12.4, 6.4, 4, 2, true),
  ...formation("rival", "ranged", 14.2, 4.6, 4, 2, true),
];

export interface Camera {
  key: string;
  label: string;
  /** Crop origin in board pixels. */
  x: number;
  y: number;
  /** Crop size in board pixels. */
  width: number;
  height: number;
  /** Integer upscale — pixel art only ever scales by whole numbers. */
  scale: number;
}

/**
 * Both framings emit 1280×720 so captures are directly comparable, and
 * both scale by an integer so treatment B is never resampled.
 */
export const cameras = {
  combat: {
    key: "combat",
    label: "combat zoom (4× of a 320×180 aperture)",
    x: 160,
    y: 120,
    width: 320,
    height: 180,
    scale: 4,
  },
  crowd: {
    key: "crowd",
    label: "crowd scale (2× of the full 640×360 board)",
    x: 0,
    y: 0,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    scale: 2,
  },
  split: {
    key: "split",
    label: "side-by-side combat zoom (3× of a 320×180 aperture)",
    x: 160,
    y: 120,
    width: 320,
    height: 180,
    scale: 3,
  },
} as const satisfies Record<string, Camera>;

export type CameraKey = keyof typeof cameras;

/** Ambient loop length. Both treatments run the same schedule. */
export const AMBIENT_FRAMES = 6;

export interface Ambient {
  /** Emission level for amber signals, 0..1. */
  amber: number;
  /** Emission level for teal signals, 0..1. */
  teal: number;
  /** Vertical offset of the vent steam puffs, in board pixels. */
  steamRise: number;
  /** Which of the three steam puffs are alive this frame. */
  steamAlive: readonly boolean[];
}

/**
 * The ambient schedule: a mains flicker on the amber signals, a slower
 * breathing teal, and three vent puffs on staggered phases. Deterministic
 * so a filmstrip is reproducible.
 */
export function ambientAt(frame: number): Ambient {
  const phase = ((frame % AMBIENT_FRAMES) + AMBIENT_FRAMES) % AMBIENT_FRAMES;
  const amberSchedule = [1, 1, 0.55, 1, 0.8, 1];
  const tealSchedule = [0.75, 0.9, 1, 0.9, 0.75, 0.6];
  return {
    amber: amberSchedule[phase] ?? 1,
    teal: tealSchedule[phase] ?? 1,
    steamRise: phase * 2,
    steamAlive: [phase < 4, phase >= 1 && phase < 5, phase >= 2],
  };
}
