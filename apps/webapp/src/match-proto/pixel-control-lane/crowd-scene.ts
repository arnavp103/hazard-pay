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
  type CrowdPalette,
  type TeamKey,
  depthPalettes,
  getGrid,
  teamPalettes,
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
  /**
   * Round-4 rendering policy, per config. LARGE keeps every round-3 value so
   * its committed captures stay valid as the control; only SMALL moves.
   */
  policy: CrowdPolicy;
}

export interface CrowdPolicy {
  /**
   * `authored` - the grid carries its own uniform 1 px contour (round 3).
   * `selective` - the grid is authored as material only and `applyContour`
   * inks the contact edge and undersides, rim lights the lit edge, and
   * leaves the shadow edge to value contrast.
   */
  contour: "authored" | "selective";
  /** Three discrete depth steps mixed toward the world anchor. */
  depth: boolean;
  /**
   * Retained for the record: round 4 first shipped a separate 1 px ink halo
   * fired only where units overlapped. The background-aware contour
   * supersedes it - sampling the *composited* stage means an edge landing on
   * a same-value neighbour inks itself - so this stays false everywhere.
   */
  halo: boolean;
  /** Multiplier on the idle drive - damps the bob that ate the hero's height. */
  idleGain: number;
  /** Bright marking band dies out below hip height instead of wrapping. */
  markingTaper: boolean;
  /** Staging: archetypes interleaved (round 4) or sorted by rank (round 3). */
  staging: "interleaved" | "ranked";
}

export const crowdConfigs: Record<ConfigKey, CrowdConfig> = {
  small: {
    key: "small",
    label: "SMALL - fodder 22px / hero 28px (1.27x)",
    melee: "breaker-small",
    ranged: "stinger-small",
    hero: "mara-small",
    halfW: 13,
    halfH: 7,
    originX: 134,
    originY: 126,
    gap: 112,
    policy: {
      contour: "selective",
      depth: true,
      halo: false,
      idleGain: 0.82,
      markingTaper: true,
      staging: "interleaved",
    },
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
    policy: {
      contour: "authored",
      depth: false,
      halo: false,
      idleGain: 1,
      markingTaper: false,
      staging: "ranked",
    },
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

/**
 * Round-4 staging. The round-3 cold critique found the archetype read in
 * `crowd-small.png` was **positional, not silhouettic** - every ranged unit
 * was staged at the rear-outer edge of its clump, so the formation answered
 * the question the capture was supposed to ask.
 *
 * This layout is constructed so archetype is *exactly* decorrelated from
 * both screen axes: melee and ranged each occupy 8 slots whose rank sum is
 * 8 and whose file sum is 20. Since a unit's screen position is
 * `(rank - file) * halfW` across and `(rank + file) * halfH` down, equal
 * rank and file sums make the two archetypes' mean x and mean y identical
 * by construction, not by eyeball. `crowd-scene.test.ts` pins it.
 */
const FORMATION_INTERLEAVED: { rank: number; file: number; kind: "melee" | "ranged" | "hero" }[] = [
  { rank: 0, file: 0, kind: "melee" },
  { rank: 0, file: 1, kind: "ranged" },
  { rank: 0, file: 2, kind: "melee" },
  { rank: 0, file: 3, kind: "ranged" },
  { rank: 0, file: 4, kind: "ranged" },
  { rank: 0, file: 5, kind: "melee" },
  { rank: 1, file: 0, kind: "melee" },
  { rank: 1, file: 1, kind: "hero" },
  { rank: 1, file: 2, kind: "ranged" },
  { rank: 1, file: 3, kind: "melee" },
  { rank: 1, file: 4, kind: "hero" },
  { rank: 1, file: 5, kind: "ranged" },
  { rank: 2, file: 0, kind: "ranged" },
  { rank: 2, file: 1, kind: "melee" },
  { rank: 2, file: 2, kind: "ranged" },
  { rank: 2, file: 3, kind: "ranged" },
  { rank: 2, file: 4, kind: "melee" },
  { rank: 2, file: 5, kind: "melee" },
];

export function formationFor(config: CrowdConfig) {
  return config.policy.staging === "interleaved" ? FORMATION_INTERLEAVED : FORMATION;
}

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
  /**
   * Per-unit idle amplitude and direction. A shared cycle length keeps the
   * capture loop closing cleanly; varying how FAR and which WAY each unit
   * leans is what stops the formation reaching its extremes on one clock -
   * the "synchronized toys" failure the baked lane could not escape.
   */
  amplitude: number;
  flip: 1 | -1;
  /**
   * Discrete depth bucket, 0 = front rank (full value) .. 2 = rear rank
   * (mixed hardest toward the world anchor). Keyed on `rank + file`, which
   * is exactly what sets the unit's screen y, so it is screen depth rather
   * than formation bookkeeping.
   */
  depthStep: number;
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

  const formation = formationFor(config);
  const depthOf = (slot: { rank: number; file: number }) => {
    if (!config.policy.depth) { return 0; }
    const sum = slot.rank + slot.file;
    if (sum <= 2) { return 2; }
    return sum <= 5 ? 1 : 0;
  };

  sides.forEach((side, sideIndex) => {
    formation.forEach((slot, slotIndex) => {
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
        phaseMs: Math.round(hash01(seed + 211) * CROWD_CYCLE_MS),
        amplitude: 0.6 + hash01(seed + 313) * 0.7,
        flip: hash01(seed + 557) < 0.5 ? -1 : 1,
        depthStep: depthOf(slot),
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
        amplitude: 1,
        flip: 1,
        depthStep: 0,
      });
    });
  });
  return units;
}

// --- hero marking (approved 2026-07-25) --------------------------------

/**
 * Ring offsets around a posed silhouette, by Chebyshev distance.
 *
 * Rounds 1-3 ran with marking deliberately withheld so size + detail
 * density could be tested on their own; the cofounder has since ruled that
 * a "thick border or highlight" is in. This grows one from the sprite's
 * own outline rather than stamping a decal, so it tracks every pose and
 * every facing for free and costs no authored cells.
 *
 * Offsets are relative to the sprite's top-left blit origin and may be
 * negative or past the canvas edge - the marking is allowed to grow
 * outside the authored box.
 */
export function markingOffsets(
  rows: string[],
  width: number,
  radius: number,
): { dx: number; dy: number; ring: number }[] {
  const height = rows.length;
  const pad = radius;
  const w = width + pad * 2;
  const h = height + pad * 2;
  const filled = new Uint8Array(w * h);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== TRANSPARENT && x < width) { filled[(y + pad) * w + (x + pad)] = 1; }
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

  const out: { dx: number; dy: number; ring: number }[] = [];
  for (let index = 0; index < distance.length; index += 1) {
    const ring = distance[index] ?? -1;
    if (ring <= 0) { continue; }
    out.push({ dx: (index % w) - pad, dy: Math.floor(index / w) - pad, ring });
  }
  return out;
}

/**
 * Palette role painted at each ring: bright bands seated on one ink ring.
 * The OUTERMOST ring is always ink — without it the border floats on the
 * board with no contour of its own, which is exactly how a sticker reads.
 */
export function markingRole(ring: number, radius: number): string {
  return ring >= radius ? "k" : "i";
}

/** How thick the hero border is, per config - it must scale with the unit. */
export const MARKING_RADIUS: Record<ConfigKey, number> = { small: 2, large: 3 };

/**
 * Rows below the figure's contact row that the marking may occupy. Zero:
 * the border hugs the unit and stops at the ground, instead of closing
 * under the feet into a flat-bottomed capsule that reads as a screen-space
 * cartouche pasted over the board.
 */
export const MARKING_FOOT_BLEED = 0;

/**
 * Where the bright band stops when `policy.markingTaper` is on. The round-3
 * critique measured the SMALL ring's bounding box at 704 px against a whole
 * fodder unit's 330 px - "the affordance attached to one hero occupies more
 * than twice the board area of an entire fodder unit". Letting the bright
 * band die at hip height keeps the arch that does the actual finding work
 * and hands back the lower half, where the ring was competing with the
 * contact shadow.
 */
export function markingBrightLimit(grid: CrowdGrid): number {
  return grid.topRow + Math.round((grid.bottomRow - grid.topRow + 1) * 0.55);
}

// --- round-4 rendering policy -----------------------------------------

/**
 * Roles a contour pass must never overwrite: metal highlight, emission and
 * its hot point, and focal wear. These are the few pixels carrying material
 * history at this register; inking them is how a 22 px unit turns into a
 * black tick with a coloured speck.
 */
const FOCAL_ROLES = new Set(["n", "u", "t", "w"]);

/**
 * Rim-light promotion, lit edge only. Deliberately restricted to the coat
 * and the livery *shadow*: promoting metal or the livery base would scatter
 * near-white and high-chroma pixels across thirty-two fodder heads and eat
 * the frame's bright budget, which is reserved for effects.
 */
const RIM_LIGHT: Record<string, string> = { c: "e", C: "c", L: "l" };

/**
 * How much luma separation counts as "this edge already reads". Below it the
 * edge is inside the background's own value band and needs a contour; above
 * it a contour is redundant and is simply spending the sprite's pixel budget
 * on a problem it does not have.
 */
export const CONTOUR_MIN_CONTRAST = 22;

/** Straight-line luma of a palette hex, Rec. 709. */
function hexLuma(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 0xff) + 0.7152 * ((n >> 8) & 0xff) + 0.0722 * (n & 0xff);
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
export function silhouetteEdges(rows: string[], width: number): EdgePixel[] {
  const height = rows.length;
  const at = (x: number, y: number): string => {
    if (y < 0 || y >= height || x < 0 || x >= width) { return TRANSPARENT; }
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
 * Background-aware contour, the round-4 answer to the round-3 ink budget.
 *
 * Round 3 authored a uniform 1 px plum-black outline into every SMALL grid,
 * and the cold critique's central charge was arithmetic: the outline was
 * eating the sprite.
 *
 * The obvious fix - drop most of the outline - is wrong, and measurement said
 * so. Before any change, only 4-7 % of this lane's background-facing edges
 * sat within 12 luma of what was behind them (median separation 28-33), so
 * most of that ink was solving a figure/ground problem this lane does not
 * have. But a *blind* selective contour made it worse, not better: cutting
 * the top and shadow edges pushed the share of dissolving edges from 4-7 %
 * to 20-26 %, because it removed ink by direction rather than by need.
 *
 * So the rule is the one the evidence actually implies: **ink only where the
 * unit meets a similar-value background.** Every silhouette edge is compared
 * against the composited pixel it abuts:
 *
 * - already separated by `CONTOUR_MIN_CONTRAST` luma -> keep the material;
 * - too close, and the unit is the lighter of the two -> rim light it up its
 *   own material ramp (lit edges only, so the light direction still reads);
 * - too close otherwise -> plum-black ink;
 * - the contact zone is always inked, because that edge is grounding rather
 *   than separation.
 *
 * Because the background it samples is the *composited* stage, this also
 * settles unit-vs-unit fusion: 53 % of all silhouette-boundary pixels abut
 * another unit rather than the board, and a near unit landing on a same-value
 * neighbour inks itself against it automatically, while one landing on a
 * darker back rank does not have to spend the pixel at all.
 */
export function contouredRows(
  rows: string[],
  width: number,
  palette: CrowdPalette,
  sampleLuma: (dx: number, dy: number) => number | null,
): string[] {
  let top = -1;
  let bottom = -1;
  rows.forEach((row, y) => {
    if ([...row].some((ch) => ch !== TRANSPARENT)) {
      if (top === -1) { top = y; }
      bottom = y;
    }
  });
  if (top === -1) { return rows.slice(); }
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

    // The worst-separated open side is the one that decides the pixel.
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

/**
 * The palette the hero marking renders with - **never** depth-shaded.
 *
 * Round 4 shipped the depth ramp and the marking together and the ramp ate
 * the marking: a cold pass measured the bright stroke down 18 % on both sides
 * (171->141 and 125->103) and the cool faction's ring down 60 % in pixel
 * count, dropping hero finding from 4-of-4 to 2-of-4 at 1x. Both heroes sit
 * in the back depth bands, so they took the worst of it.
 *
 * The bug is conceptual, not arithmetic: depth falloff is aerial perspective
 * applied to *material*, and the marking is not material - it is an
 * affordance drawn on top of the world, the way a health bar is. It reads at
 * the same strength wherever the unit stands.
 */
export function markingPalette(unit: PlacedUnit): CrowdPalette {
  return teamPalettes[unit.team];
}

/** The palette a unit's own pixels render with, after depth falloff. */
export function unitPalette(unit: PlacedUnit, config: CrowdConfig): CrowdPalette {
  if (!config.policy.depth) { return teamPalettes[unit.team]; }
  const ramp = depthPalettes[unit.team];
  return ramp[Math.min(ramp.length - 1, unit.depthStep)] ?? teamPalettes[unit.team];
}

/**
 * Posed rows, contoured against whatever is already on the stage behind the
 * unit. The contour has to be computed *after* posing (the lean and the knee
 * settle both change which edges face outward) and *after* the background is
 * composited, which is why it is a paint step and not a sprite property.
 *
 * `sampleLuma` takes sprite-local coordinates and returns the luma of the
 * stage pixel they land on, or null off-stage.
 */
export function renderRows(
  unit: PlacedUnit,
  config: CrowdConfig,
  clockMs: number,
  palette: CrowdPalette,
  sampleLuma: (dx: number, dy: number) => number | null,
): PosedUnit {
  const grid = getGrid(unit.gridKey);
  const posed = poseUnit(unit, clockMs);
  if (config.policy.contour === "authored") { return posed; }
  return { rows: contouredRows(posed.rows, grid.width, palette, sampleLuma), bob: posed.bob };
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
export function poseFodder(
  grid: CrowdGrid,
  clockMs: number,
  phaseMs: number,
  amplitude = 1,
  flip: 1 | -1 = 1,
  gain = 1,
): PosedUnit {
  const t = phase(clockMs + phaseMs, CROWD_CYCLE_MS);
  const wave = Math.sin(t * Math.PI * 2) * flip;
  const pivot = Math.round(grid.bottomRow - (grid.bottomRow - grid.topRow) * 0.35);
  const kneeY = Math.round(grid.bottomRow - (grid.bottomRow - grid.topRow) * 0.18);
  // Scale the sway to the figure, or a 22px fodder unit swings as far as a
  // 34px one and the crowd's motion drowns the tier's height difference.
  const reach = (grid.bottomRow - grid.topRow) / 34;
  // `gain` < 1 damps the idle. The round-3 critique measured 17 % of SMALL
  // fodder swinging 3 px or more peak-to-peak against a hero height advantage
  // of only 6 px - "a bobbing fodder unit at the top of its arc is momentarily
  // as tall as a hero at the bottom of its". At gain 1 this is round-3 code
  // exactly, so LARGE is untouched.
  let rows = leanRows(grid.rows, pivot, 0.11 * reach * amplitude * wave * gain);
  if (wave < (-0.45 * amplitude) / gain) { rows = crouchRows(rows, kneeY, 1); }
  return { rows, bob: wave > 0.55 / (amplitude * gain) ? -1 : 0 };
}

/**
 * Hero idle - the round-2 hybrid vocabulary at this scale: the sway is
 * carried on a knee bend so the lower body breathes, and the chest lifts
 * on the inhale. More authored motion per unit, affordable because there
 * are two of them per side rather than sixteen.
 */
export function poseHero(
  grid: CrowdGrid,
  clockMs: number,
  phaseMs: number,
  amplitude = 1,
  flip: 1 | -1 = 1,
): PosedUnit {
  const t = phase(clockMs + phaseMs, CROWD_CYCLE_MS);
  const wave = Math.sin(t * Math.PI * 2) * flip * amplitude;
  const kneeY = Math.round(grid.bottomRow - (grid.bottomRow - grid.topRow) * 0.22);
  const pivot = Math.round(grid.bottomRow - (grid.bottomRow - grid.topRow) * 0.45);
  const reach = (grid.bottomRow - grid.topRow) / 44;
  let rows = leanRows(grid.rows, pivot, 0.06 * reach * wave);
  if (wave < -0.3) { rows = crouchRows(rows, kneeY, 1); }
  return { rows, bob: wave > 0.6 ? -1 : 0 };
}

export function poseUnit(unit: PlacedUnit, clockMs: number): PosedUnit {
  const grid = getGrid(unit.gridKey);
  const gain = crowdConfigs[grid.config].policy.idleGain;
  return unit.tier === "hero"
    ? poseHero(grid, clockMs, unit.phaseMs, unit.amplitude, unit.flip)
    : poseFodder(grid, clockMs, unit.phaseMs, unit.amplitude, unit.flip, gain);
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
