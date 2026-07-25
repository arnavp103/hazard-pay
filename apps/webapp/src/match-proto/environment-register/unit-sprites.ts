/**
 * THROWAWAY PROTOTYPE (#91) — the unit layer, shared by both treatments.
 *
 * Characters are explicitly NOT this lane's variable, so the sprites are
 * borrowed wholesale from the pixel control lane's round 4 (see
 * `borrowed-crowd-small.ts`) and composited over treatment A and treatment B
 * by exactly this code. If the two captures differ in how the characters sit,
 * the difference is the board's doing — which is the whole point of the lane.
 *
 * What this module owns is everything about a unit that the *environment*
 * decides:
 *
 * - **Aerial perspective.** Three discrete palette steps by board depth, so a
 *   unit at the back of the plaza is mixed toward the world anchor. Discrete,
 *   not continuous, so the render stays palette-indexed.
 * - **Shade.** A unit whose foot tile is under a roof, or inside a roof's cast
 *   shadow, renders one further step down. This is half of round 2's answer to
 *   "the characters have no depth under the ceiling": round 1 drew a canopy
 *   and then lit the units beneath it exactly as brightly as the ones standing
 *   in the open, so nothing in the pixels said a ceiling was there.
 * - **Contour.** The pixel lane's round-4 policy, ported: the grids are
 *   authored as *material only* and the silhouette is inked at blit time only
 *   where the unit meets a similar-value background. Because the sampler reads
 *   the composited board, this lane can measure its own figure/ground dissolve
 *   rate off its own pipeline rather than inheriting a sibling lane's number.
 * - **Hero marking.** A two-ring border, tapered above hip height, drawn from
 *   the *unshaded* team palette — a marking is an affordance drawn on top of
 *   the world, so neither the depth ramp nor the cover shade may touch it.
 */

import {
  type CrowdGrid,
  type CrowdPalette,
  type TeamKey,
  DEPTH_MIX,
  getGrid,
  sharedRoles,
  teamPalettes,
} from "./borrowed-crowd-small.ts";
import { type Archetype, type Side, type UnitPlacement } from "./board-model.ts";
import { registerUnitColor } from "./palette.ts";

const TRANSPARENT = ".";

/** How far under-cover units are mixed toward the world anchor. */
export const SHADE_MIX = 0.3;

/** Anchor colour every falloff mixes toward — the plum-black world anchor. */
const ANCHOR = "#120b10";

function mixHex(hex: string, toward: string, amount: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const out: number[] = [];
  for (let shift = 16; shift >= 0; shift -= 8) {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    out.push(Math.round(from + (to - from) * amount));
  }
  return `#${out.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mixPalette(base: CrowdPalette, amount: number): CrowdPalette {
  const out: CrowdPalette = {};
  for (const [role, hex] of Object.entries(base)) {
    out[role] = amount === 0 ? hex : mixHex(hex, ANCHOR, amount);
  }
  return out;
}

export const teamOf: Record<Side, TeamKey> = { crew: "rust", rival: "slate" };

/**
 * Every palette variant a unit can render with: team × depth step × shade.
 * Enumerated rather than computed on the fly so the set of colours the unit
 * layer can emit is finite and declarable, which is what makes the palette
 * conformance gate mean something once units share the buffer with the board.
 */
const variants = new Map<string, CrowdPalette>();
function variantKey(team: TeamKey, depthStep: number, shaded: boolean): string {
  return `${team}:${String(depthStep)}:${shaded ? "s" : "l"}`;
}
for (const team of ["rust", "slate"] as const) {
  DEPTH_MIX.forEach((depthAmount, depthStep) => {
    for (const shaded of [false, true]) {
      const amount = shaded ? depthAmount + (1 - depthAmount) * SHADE_MIX : depthAmount;
      variants.set(variantKey(team, depthStep, shaded), mixPalette(teamPalettes[team], amount));
    }
  });
}

/** Which budget band a unit role spends against. */
const roleBand = (role: string): "body" | "emission" | "identity" => {
  if (role === "t" || role === "u") { return "emission"; }
  if (role === "l" || role === "L" || role === "i") { return "identity"; }
  return "body";
};

/** Every colour the unit layer can emit, registered with the budget model. */
export const UNIT_COLORS: readonly string[] = (() => {
  const seen = new Set<string>();
  for (const palette of variants.values()) {
    for (const [role, hex] of Object.entries(palette)) {
      seen.add(hex);
      registerUnitColor(hex, roleBand(role));
    }
  }
  for (const [role, hex] of Object.entries(sharedRoles)) {
    seen.add(hex);
    registerUnitColor(hex, roleBand(role));
  }
  return [...seen];
})();

const gridKey: Record<Archetype, string> = { hero: "mara", melee: "breaker", ranged: "stinger" };

export function gridFor(unit: UnitPlacement): CrowdGrid {
  return getGrid(gridKey[unit.archetype]);
}

/**
 * Three discrete aerial-perspective bands across the plaza's depth. Step 0 is
 * the near rank and renders at full strength; step 2 is the far rank.
 */
export function depthStepFor(cx: number, cy: number): number {
  const sum = cx + cy;
  if (sum >= 22) { return 0; }
  if (sum >= 15) { return 1; }
  return 2;
}

export function paletteFor(unit: UnitPlacement, shaded: boolean): CrowdPalette {
  const key = variantKey(teamOf[unit.side], depthStepFor(unit.cx, unit.cy), shaded);
  return variants.get(key) ?? teamPalettes[teamOf[unit.side]];
}

/** The unshaded, undepthed palette the hero marking renders from. */
export function markingPaletteFor(unit: UnitPlacement): CrowdPalette {
  return teamPalettes[teamOf[unit.side]];
}

/* ------------------------------------------------------------------ */
/* Selective contour (ported policy)                                   */
/* ------------------------------------------------------------------ */

/** Roles a contour pass must never overwrite. */
const FOCAL_ROLES = new Set(["n", "u", "t", "w"]);

/** Rim-light promotion, lit edge only. */
const RIM_LIGHT: Record<string, string> = { c: "e", C: "c", L: "l" };

/**
 * How much luma separation counts as "this edge already reads". Below it the
 * edge is inside the background's own value band and needs a contour.
 */
export const CONTOUR_MIN_CONTRAST = 22;

function hexLuma(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * ((value >> 16) & 0xff) + 0.7152 * ((value >> 8) & 0xff) + 0.0722 * (value & 0xff);
}

export interface EdgePixel {
  x: number;
  y: number;
  role: string;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/** Every filled cell with at least one transparent four-neighbour. */
export function silhouetteEdges(rows: readonly string[], width: number): EdgePixel[] {
  const height = rows.length;
  const at = (x: number, y: number): string => {
    if (x < 0 || y < 0 || x >= width || y >= height) { return TRANSPARENT; }
    return rows[y]?.[x] ?? TRANSPARENT;
  };
  const out: EdgePixel[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const role = at(x, y);
      if (role === TRANSPARENT) { continue; }
      const up = at(x, y - 1) === TRANSPARENT;
      const down = at(x, y + 1) === TRANSPARENT;
      const left = at(x - 1, y) === TRANSPARENT;
      const right = at(x + 1, y) === TRANSPARENT;
      if (up || down || left || right) { out.push({ x, y, role, up, down, left, right }); }
    }
  }
  return out;
}

/**
 * Background-aware contour. Ink only where the unit meets a similar-value
 * background; rim-light the lit edge where the unit is the lighter of the two;
 * always ink the contact zone, because that edge is grounding rather than
 * separation.
 */
export function contouredRows(
  rows: readonly string[],
  width: number,
  palette: CrowdPalette,
  sampleLuma: (x: number, y: number) => number | null,
): string[] {
  let top = -1;
  let bottom = -1;
  rows.forEach((row, y) => {
    if ([...row].some((char) => char !== TRANSPARENT)) {
      if (top === -1) { top = y; }
      bottom = y;
    }
  });
  if (top === -1) { return rows.map((row) => row); }
  const contactY = bottom - Math.max(1, Math.round((bottom - top + 1) * 0.18));

  const out = rows.map((row) => [...row]);
  for (const edge of silhouetteEdges(rows, width)) {
    if (FOCAL_ROLES.has(edge.role)) { continue; }
    const outRow = out[edge.y];
    if (outRow === undefined) { continue; }
    if (edge.y >= contactY) {
      outRow[edge.x] = "k";
      continue;
    }
    const material = palette[edge.role];
    if (material === undefined) { continue; }
    const mine = hexLuma(material);

    let worst: number | null = null;
    const probe = (dx: number, dy: number) => {
      const value = sampleLuma(edge.x + dx, edge.y + dy);
      if (value === null) { return; }
      if (worst === null || Math.abs(mine - value) < Math.abs(mine - worst)) { worst = value; }
    };
    if (edge.up) { probe(0, -1); }
    if (edge.down) { probe(0, 1); }
    if (edge.left) { probe(-1, 0); }
    if (edge.right) { probe(1, 0); }
    if (worst === null) { continue; }

    const behind: number = worst;
    if (Math.abs(mine - behind) >= CONTOUR_MIN_CONTRAST) { continue; }
    const lit = RIM_LIGHT[edge.role];
    if (mine >= behind && lit !== undefined && (edge.up || edge.left)) {
      outRow[edge.x] = lit;
      continue;
    }
    outRow[edge.x] = "k";
  }
  return out.map((row) => row.join(""));
}

/* ------------------------------------------------------------------ */
/* Hero marking                                                        */
/* ------------------------------------------------------------------ */

/** Ring thickness around a hero silhouette, in pixels. */
export const MARKING_RADIUS = 2;

/** Bright band dies at hip height; the arch does the finding work. */
export function markingBrightLimit(grid: CrowdGrid): number {
  return grid.topRow + Math.round((grid.bottomRow - grid.topRow + 1) * 0.55);
}

export interface MarkingPixel { dx: number; dy: number; ring: number }

/** Dilation rings around the silhouette, as offsets from the blit origin. */
export function markingOffsets(rows: readonly string[], width: number, radius: number): MarkingPixel[] {
  const height = rows.length;
  const pad = radius;
  const w = width + pad * 2;
  const h = height + pad * 2;
  const filled = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char !== TRANSPARENT && x < width) { filled[(y + pad) * w + (x + pad)] = 1; }
    });
  });

  const distance = new Int16Array(w * h).fill(-1);
  let front: number[] = [];
  for (let index = 0; index < filled.length; index += 1) {
    if (filled[index] === 1) {
      distance[index] = 0;
      front.push(index);
    }
  }
  for (let ring = 1; ring <= radius; ring += 1) {
    const next: number[] = [];
    for (const index of front) {
      const cy = Math.floor(index / w);
      const cx = index % w;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const ny = cy + oy;
          const nx = cx + ox;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) { continue; }
          const at = ny * w + nx;
          if (distance[at] !== -1) { continue; }
          distance[at] = ring;
          next.push(at);
        }
      }
    }
    front = next;
  }

  const out: MarkingPixel[] = [];
  for (let index = 0; index < distance.length; index += 1) {
    const ring = distance[index] ?? -1;
    if (ring <= 0) { continue; }
    out.push({ dx: (index % w) - pad, dy: Math.floor(index / w) - pad, ring });
  }
  return out;
}

/** Outermost ring is always ink; inside it, the faction highlight. */
export function markingRole(ring: number, radius: number): string {
  return ring >= radius ? "k" : "i";
}
