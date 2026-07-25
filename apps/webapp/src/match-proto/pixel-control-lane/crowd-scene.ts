/**
 * THROWAWAY PROTOTYPE (#74, round 3) - the crowd stage.
 *
 * Pure scene math for the two-tier crowd still: roster, dimetric placement,
 * y-sorting, and the cheap per-unit idle. No canvas, no DOM - the React
 * surface in `./crowd-prototype.tsx` only blits what this module computes,
 * so the whole thing is testable in plain Node.
 *
 * Two things are deliberate and load-bearing for the experiment:
 *
 * 1. **Everything renders at 1x.** The only difference between the two
 *    configs is which authored grids they use and how tightly they are
 *    packed. Nothing is scaled, so no config gets free detail from
 *    resampling and none gets punished by fractional blur.
 * 2. **Tier separation is size + detail density only.** Heroes get no
 *    marking: no rim halo, no banner, no ground decal, no hero-only hue.
 *    Every unit gets the identical contact shadow, sized from its own
 *    footprint, so grounding is not doing tier work either.
 *
 * The fodder idle is deliberately the *cheap* treatment (the programmatic
 * lane from round 2: whole-row shear + a 1px bob, on-grid) because that is
 * what a crowd of this size can actually afford. Heroes run the richer
 * key-posed idle. Each unit carries a deterministic phase offset so the
 * formation never reads as forty synchronized toys.
 */

import {
  type CrowdGrid,
  type TeamKey,
  getGrid,
} from "./crowd-sprites.ts";

export type ConfigKey = "small" | "large";

/** Stage aperture, unchanged from the lane's other captures. */
export const STAGE_W = 480;
export const STAGE_H = 270;

/**
 * Fixed board camera. This scene tests crowd legibility, not the pan, so
 * the camera is pinned where both orders of battle sit on open ground.
 */
export const CAMERA = { x: -178, y: -92 };

export interface CrowdConfig {
  key: ConfigKey;
  label: string;
  /** Grid keys for the three unit kinds at this config. */
  melee: string;
  ranged: string;
  hero: string;
  /** Dimetric half-tile in screen pixels (2:1 - halfW is twice halfH). */
  halfW: number;
  halfH: number;
  /** Stage-space origin of the left formation's rank/file frame. */
  originX: number;
  originY: number;
  /** Horizontal gap between the two facing formations. */
  gap: number;
}

export const crowdConfigs: Record<ConfigKey, CrowdConfig> = {
  small: {
    key: "small",
    label: "SMALL - fodder 22px / hero 28px (1.27x)",
    melee: "breaker-small",
    ranged: "stinger-small",
    hero: "mara-small",
    halfW: 12,
    halfH: 6,
    originX: 128,
    originY: 132,
    gap: 118,
  },
  large: {
    key: "large",
    label: "LARGE - fodder 34px / hero 44px (1.29x)",
    melee: "breaker-large",
    ranged: "stinger-large",
    hero: "mara-large",
    halfW: 18,
    halfH: 9,
    originX: 118,
    originY: 128,
    gap: 168,
  },
};

/**
 * One side's order of battle. Rank 0 is the front line, rank 2 the rear;
 * files run across the line. 16 fodder + 2 heroes per side - inside the
 * director's 15-20 fodder / 1-2 hero gauge, which is a gauge and not a
 * spec, so nothing here is fitted to an exact unit count.
 */
const FORMATION: { rank: number; file: number; kind: "melee" | "ranged" | "hero" }[] = [
  { rank: 0, file: 0, kind: "melee" },
  { rank: 0, file: 1, kind: "melee" },
  { rank: 0, file: 2, kind: "melee" },
  { rank: 0, file: 3, kind: "melee" },
  { rank: 0, file: 4, kind: "melee" },
  { rank: 0, file: 5, kind: "melee" },
  { rank: 1, file: 0, kind: "ranged" },
  { rank: 1, file: 1, kind: "hero" },
  { rank: 1, file: 2, kind: "melee" },
  { rank: 1, file: 3, kind: "melee" },
  { rank: 1, file: 4, kind: "hero" },
  { rank: 1, file: 5, kind: "ranged" },
  { rank: 2, file: 0, kind: "ranged" },
  { rank: 2, file: 1, kind: "ranged" },
  { rank: 2, file: 2, kind: "ranged" },
  { rank: 2, file: 3, kind: "melee" },
  { rank: 2, file: 4, kind: "ranged" },
  { rank: 2, file: 5, kind: "ranged" },
];

export interface PlacedUnit {
  id: string;
  gridKey: string;
  tier: "fodder" | "hero";
  team: TeamKey;
  /** Horizontal centre of the figure, in stage pixels. */
  x: number;
  /** Contact row (the figure's feet), in stage pixels. */
  y: number;
  /** Right-facing sprites are mirrored for the side that faces left. */
  mirrored: boolean;
  /** Deterministic animation phase so the crowd is not in lockstep. */
  phaseMs: number;
}

/** Cheap deterministic hash -> [0,1). Keeps captures byte-reproducible. */
function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function kindGrid(config: CrowdConfig, kind: "melee" | "ranged" | "hero"): string {
  if (kind === "melee") { return config.melee; }
  if (kind === "ranged") { return config.ranged; }
  return config.hero;
}

/**
 * Build both orders of battle. The right-hand side is the same formation
 * reflected across the field, so the two crowds are directly comparable
 * and no side gets an easier read.
 */
export function buildRoster(config: CrowdConfig): PlacedUnit[] {
  const units: PlacedUnit[] = [];
  const sides: { team: TeamKey; dir: 1 | -1; offset: number }[] = [
    { team: "rust", dir: 1, offset: 0 },
    { team: "slate", dir: -1, offset: config.gap },
  ];

  sides.forEach((side, sideIndex) => {
    FORMATION.forEach((slot, slotIndex) => {
      const seed = sideIndex * 97 + slotIndex * 13 + 7;
      const jitterX = Math.round(hash01(seed) * 5) - 2;
      const jitterY = Math.round(hash01(seed + 41) * 3) - 1;
      const gx = slot.rank;
      const gy = slot.file;
      const baseX = config.originX + side.offset + side.dir * ((gx - gy) * config.halfW);
      const baseY = config.originY + (gx + gy) * config.halfH;
      units.push({
        id: `${side.team}-${String(slotIndex)}`,
        gridKey: kindGrid(config, slot.kind),
        tier: slot.kind === "hero" ? "hero" : "fodder",
        team: side.team,
        x: baseX + jitterX,
        y: baseY + jitterY,
        mirrored: side.dir === -1,
        phaseMs: Math.round(hash01(seed + 211) * 1400),
      });
    });
  });

  // Painter's order: far units first so near ranks overlap them.
  return units.sort((a, b) => (a.y - b.y) || (a.x - b.x));
}

/**
 * A deliberately un-crowded control: one of each unit kind per side,
 * standing apart on the same ground line at the same 1x scale. The crowd
 * still answers "can you find the hero in a mass"; this answers the
 * narrower question underneath it - "with occlusion removed, does the
 * extra authored detail on the hero read at all at this resolution?"
 */
export function buildLineup(config: CrowdConfig): PlacedUnit[] {
  const step = config.halfW * 3;
  const kinds: ("melee" | "ranged" | "hero")[] = ["melee", "hero", "ranged"];
  const units: PlacedUnit[] = [];
  const sides: { team: TeamKey; dir: 1 | -1; centre: number }[] = [
    { team: "rust", dir: 1, centre: Math.round(STAGE_W * 0.3) },
    { team: "slate", dir: -1, centre: Math.round(STAGE_W * 0.72) },
  ];
  sides.forEach((side, sideIndex) => {
    kinds.forEach((kind, index) => {
      units.push({
        id: `lineup-${side.team}-${kind}`,
        gridKey: kindGrid(config, kind),
        tier: kind === "hero" ? "hero" : "fodder",
        team: side.team,
        x: side.centre + (index - 1) * step,
        y: config.originY + config.halfH * 4 + sideIndex * 2,
        mirrored: side.dir === -1,
        phaseMs: index * 380,
      });
    });
  });
  return units;
}

// --- generic grid transforms (any width/height) -----------------------

const TRANSPARENT = ".";

function toCells(rows: string[]): string[][] {
  return rows.map((row) => [...row]);
}

/** Horizontal shear about a pivot row - a hole-free whole-body lean. */
export function leanRows(rows: string[], pivotY: number, k: number): string[] {
  if (k === 0) { return rows.slice(); }
  const width = rows[0]?.length ?? 0;
  const src = toCells(rows);
  const out = rows.map(() => Array.from({ length: width }, () => TRANSPARENT));
  src.forEach((srcRow, y) => {
    const dx = y < pivotY ? Math.round(k * (pivotY - y)) : 0;
    const dstRow = out[y];
    if (dstRow === undefined) { return; }
    srcRow.forEach((ch, x) => {
      if (ch === TRANSPARENT) { return; }
      const nx = x + dx;
      if (nx >= 0 && nx < width) { dstRow[nx] = ch; }
    });
  });
  return out.map((row) => row.join(""));
}

/**
 * Knee-bend settle: everything above `kneeY` sinks by `dy` rows while the
 * shins and feet stay planted. The lower body participates in the breath -
 * the fix round 2's critique asked for, carried down to this scale.
 */
export function crouchRows(rows: string[], kneeY: number, dy: number): string[] {
  if (dy === 0) { return rows.slice(); }
  const width = rows[0]?.length ?? 0;
  const src = toCells(rows);
  const out = toCells(rows);
  for (let y = 0; y < kneeY; y += 1) {
    const dstRow = out[y];
    if (dstRow === undefined) { continue; }
    for (let x = 0; x < width; x += 1) { dstRow[x] = TRANSPARENT; }
  }
  for (let y = 0; y < kneeY; y += 1) {
    const srcRow = src[y];
    const dstRow = out[y + dy];
    if (srcRow === undefined || dstRow === undefined || y + dy >= kneeY) { continue; }
    srcRow.forEach((ch, x) => {
      if (ch !== TRANSPARENT) { dstRow[x] = ch; }
    });
  }
  return out.map((row) => row.join(""));
}

// --- idle treatments ---------------------------------------------------

/** Shared loop length so a single-cycle capture closes cleanly. */
export const CROWD_CYCLE_MS = 1600;

function phase(clockMs: number, cycleMs: number): number {
  return (((clockMs % cycleMs) + cycleMs) % cycleMs) / cycleMs;
}

export interface PosedUnit {
  rows: string[];
  /** Whole-pixel vertical bob applied at blit time (never sub-pixel). */
  bob: number;
}

/**
 * Fodder idle - the cheap programmatic treatment. A low-pivot shear sways
 * the mass over planted feet and a 1px bob carries the breath. Two grid
 * transforms per unit per frame; this is what a crowd can afford.
 */
export function poseFodder(grid: CrowdGrid, clockMs: number, phaseMs: number): PosedUnit {
  const t = phase(clockMs + phaseMs, CROWD_CYCLE_MS);
  const wave = Math.sin(t * Math.PI * 2);
  const pivot = Math.round(grid.bottomRow - (grid.bottomRow - grid.topRow) * 0.35);
  const kneeY = Math.round(grid.bottomRow - (grid.bottomRow - grid.topRow) * 0.18);
  let rows = leanRows(grid.rows, pivot, 0.1 * wave);
  if (wave < -0.45) { rows = crouchRows(rows, kneeY, 1); }
  return { rows, bob: wave > 0.4 ? -1 : 0 };
}

/**
 * Hero idle - the round-2 hybrid vocabulary at this scale: the sway is
 * carried on a knee bend so the lower body breathes, and the chest lifts
 * on the inhale. More authored motion per unit, affordable because there
 * are two of them per side rather than sixteen.
 */
export function poseHero(grid: CrowdGrid, clockMs: number, phaseMs: number): PosedUnit {
  const t = phase(clockMs + phaseMs, CROWD_CYCLE_MS);
  const wave = Math.sin(t * Math.PI * 2);
  const kneeY = Math.round(grid.bottomRow - (grid.bottomRow - grid.topRow) * 0.22);
  const pivot = Math.round(grid.bottomRow - (grid.bottomRow - grid.topRow) * 0.45);
  let rows = leanRows(grid.rows, pivot, 0.05 * wave);
  if (wave < -0.3) { rows = crouchRows(rows, kneeY, 1); }
  return { rows, bob: wave > 0.6 ? -1 : 0 };
}

export function poseUnit(unit: PlacedUnit, clockMs: number): PosedUnit {
  const grid = getGrid(unit.gridKey);
  return unit.tier === "hero"
    ? poseHero(grid, clockMs, unit.phaseMs)
    : poseFodder(grid, clockMs, unit.phaseMs);
}

/** Top-left blit origin for a unit's grid, given its anchor. */
export function blitOrigin(unit: PlacedUnit, grid: CrowdGrid, bob: number): { x: number; y: number } {
  return {
    x: Math.round(unit.x - grid.width / 2),
    y: Math.round(unit.y - grid.bottomRow) + bob,
  };
}

/** Rough footprint width used for the (tier-independent) contact shadow. */
export function footprintWidth(grid: CrowdGrid): number {
  let widest = 0;
  const from = Math.max(0, grid.bottomRow - 3);
  for (let y = from; y <= grid.bottomRow; y += 1) {
    const row = grid.rows[y];
    if (row === undefined) { continue; }
    const first = [...row].findIndex((ch) => ch !== TRANSPARENT);
    const last = row.length - 1 - [...row].reverse().findIndex((ch) => ch !== TRANSPARENT);
    if (first >= 0) { widest = Math.max(widest, last - first + 1); }
  }
  return widest;
}
