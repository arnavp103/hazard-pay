/**
 * THROWAWAY PROTOTYPE (#74, round 3) — the two-tier resolution fork.
 *
 * The cofounder ruled (#69) that units split into **crowd fodder** and
 * **hero units**, that tier separation is expressed as a *slight* size
 * boost plus *higher detail density*, and that marking (rim light, banner,
 * ground decal) is explicitly DEFERRED. The director then recorded the
 * contradiction this lane exists to settle: fodder in the Hero's Hour
 * register (~20-24px tall) plus a slight hero boost lands heroes at
 * ~26-30px, where "more detail" may have too few pixels to read.
 *
 * This module authors the sprite tiers at BOTH candidate resolutions so a
 * picture can settle it:
 *
 *   Config SMALL - fodder figure 22px, hero figure 28px (1.27x boost)
 *   Config LARGE - fodder figure 34px, hero figure 44px (1.29x boost)
 *
 * Everything renders at **1x** - one authored pixel is one screen pixel.
 * No fractional scaling anywhere in the crowd stage, because pixel art
 * scales cleanly only by whole numbers; that is exactly why each config
 * needs its own authored grids rather than a resample of the other, and
 * why the cost report counts authored cells per tier per config.
 *
 * Style laws carried from the #79 synthesis and the medic:
 * - continuous plum-black silhouette ink, large material-local clusters;
 * - a sparse third band only on focal materials (metal, emission, the
 *   livery edge) - heroes get more of it, fodder almost none;
 * - wear reserved for focal history, no global dither;
 * - light upper-left, shadow right/low;
 * - 70/25/5 value budget: quiet coat mass, livery carries identity,
 *   emission is a handful of pixels.
 *
 * TIER SEPARATION IS SIZE + DETAIL DENSITY ONLY. No rim halo, no banner,
 * no ground decal, no hero-only hue: heroes and fodder of one side share
 * the same three livery entries, so the only levers under test are how
 * many pixels the figure gets and how densely they are used.
 */

export type CrowdPalette = Record<string, string>;

/** Shared, team-independent roles. Livery (`l`/`L`/`i`) is filled per team. */
const sharedRoles: CrowdPalette = {
  k: "#120b10", // plum-black silhouette ink (world anchor)
  c: "#46534f", // coat/uniform base
  C: "#28322f", // coat shadow
  e: "#5b6a65", // coat light (form break)
  m: "#77777d", // metal base
  M: "#34343a", // metal shadow
  n: "#c9c3b8", // metal highlight (focal third band)
  t: "#2f9e96", // emission teal
  u: "#d0fff4", // emission hot point
  s: "#a96e51", // skin
  S: "#70483a", // skin shadow
  p: "#3b3942", // trouser base
  P: "#242229", // trouser shadow
  b: "#29252a", // boot / strap
  B: "#171217", // boot shadow / sole
  w: "#554951", // wear chip (focal scuffs only)
};

const LIVERY_CHARS = ["l", "L", "i"] as const;

export type TeamKey = "rust" | "slate";

/**
 * The two sides differ ONLY in the three livery entries. Both are muted
 * (no default magenta/chartreuse per #68) and both sit in the 25% band of
 * the 70/25/5 budget. Heroes use their side's livery unchanged - colour is
 * a team read, never a tier read.
 */
export const teamPalettes: Record<TeamKey, CrowdPalette> = {
  rust: { ...sharedRoles, l: "#a6533f", L: "#62352f", i: "#d1845d" },
  slate: { ...sharedRoles, l: "#4d6076", L: "#2b374a", i: "#8399b4" },
};

export interface CrowdGrid {
  /** Stable id used by the roster and the tests. */
  key: string;
  /** Human label for the gallery/HUD. */
  label: string;
  tier: "fodder" | "hero";
  config: "small" | "large";
  width: number;
  height: number;
  /** Top row carrying ink, inclusive - the figure's crown. */
  topRow: number;
  /** Bottom row carrying ink, inclusive - the figure's contact row. */
  bottomRow: number;
  rows: string[];
}

// ---------------------------------------------------------------------
// CONFIG SMALL - the Hero's Hour register the cofounder asked for.
// Fodder 16x24 (figure 22px), hero 20x30 (figure 28px).
// ---------------------------------------------------------------------

/**
 * Fodder melee - "breaker". Silhouette contract: WIDE. Bucket helm, heavy
 * shoulders, a slab shield held forward as a solid rectangle, a cleaver
 * raised above the head line, planted wide stance. Reads as a mass.
 */
const breakerSmallRows: string[] = [
  "................",
  "................",
  "..kk............",
  ".kmnk...........",
  ".kmmk..kkkk.....",
  ".kMmk.kLllLk....",
  "..kmk.klLLlk....",
  "..kMk.kllllk....",
  "...k..kLllLk....",
  "..kCkkCCLLCk....",
  ".kcccccccccCkkkk",
  ".kcccccccccLllik",
  ".kccCccccccLlllk",
  ".kccCccccccLlllk",
  "..kCCcccccCLlllk",
  "..kCCccccCkLllik",
  "...kCccccCkLllik",
  "...kppppCkkkkkkk",
  "...kppppk.......",
  "..kppPkppk......",
  "..kppk.kppk.....",
  ".kbbbk.kbbbk....",
  ".kbbbk.kbbbk....",
  ".kBBBk.kBBBk....",
];

/**
 * Fodder ranged - "stinger". Silhouette contract: NARROW, with a long
 * straight diagonal (the rifle) and a thin comms spike above the head.
 * Nothing about it can be confused with the breaker in pure black.
 */
const stingerSmallRows: string[] = [
  "................",
  "................",
  "....k...........",
  "....k...........",
  "....k..kkkkk....",
  "....k.kLllllk...",
  "....k.klttllk...",
  "....kkkLLLllk...",
  ".....kCCLLLLk...",
  "...kklccccck....",
  "...klieccccCkkk.",
  "...kliecccCMmmnk",
  "...kLLcccCMmnkk.",
  "....kLccCMmkk...",
  "....kppppPk.....",
  "...kppppppk.....",
  "...kpppppppk....",
  "...kppkkpppk....",
  "...kpk..kppk....",
  "..kbpk...kppk...",
  "..kbbk...kppk...",
  "..kbbk...kbbbk..",
  ".kbbbk...kbbbbk.",
  ".kBBBk...kBBBBk.",
];

/**
 * Hero at the SMALL config - Mara Voss re-authored for a 28px figure.
 * Every hero-tier cue the 48x64 canon sprite carries is attempted here:
 * hood, respirator, back-slung med case with a pale cross, cybernetic
 * forearm with a teal pip, injector, staggered stance, hem wear.
 */
const maraSmallRows: string[] = [
  "....................",
  "....................",
  "........kkkkk.......",
  "......kkcccccck.....",
  ".....keccccccck.....",
  ".....kecccccCssk....",
  ".....keccccCCmmMk...",
  ".....keccccccCtMk...",
  "......kccccccCkk....",
  "....kkkcccccccCk....",
  "..kkiiikCcccccCk....",
  "..kllnlkCcccccCk....",
  "..klnnlkCcccccCk....",
  "..klnnlkCcccccCkkmmk",
  "..kllnlkCcccccCktmnk",
  "..kLLLLkCcccccCkkuMk",
  "...kkkkkCccccccCk...",
  ".......kbbbbbbbk....",
  ".......kBBBBBBBk....",
  "......kcccCkppPk....",
  "......kcwcCkppPk....",
  "......kccCCkppPk....",
  ".......kCkppkppPk...",
  ".......kppppkppPk...",
  ".......kpwbpkpwbk...",
  ".......kppppkpppk...",
  "......kbbbbpkbbbk...",
  "......kbbbbBkbbbbk..",
  "......kBBBBBkBBBBk..",
  "......kkkkkkkkkkkk..",
];

// ---------------------------------------------------------------------
// CONFIG LARGE - the register this lane has been drawing in.
// Fodder 24x36 (figure 34px), hero 32x46 (figure 44px).
// ---------------------------------------------------------------------

const breakerLargeRows: string[] = [
  "........................",
  "........................",
  "...kkkk.................",
  "..kmnmmk................",
  "..kmmmmk................",
  "..kmmmmk................",
  "..kkmmkk................",
  "...kmmk.................",
  "...kkmk...kkkkkk........",
  "....km...kkllllkk.......",
  "....km...klllllllk......",
  "....km...klLLLLLLk......",
  ".....k...kllllllllk.....",
  ".....k...kkllllllk......",
  "....kkkkkkkkkkkkkk......",
  "...kkcccccccccccckk.....",
  "..kccccccccccccccllk....",
  "..kcccccccccccccckkkkkkk",
  "..kccCccccccccccckllllik",
  "..kccCcccccccccccklllllk",
  "..kkCCcccccccccccklllllk",
  "...kkCCccccccccccklllllk",
  "....kkCCccccccccckllllik",
  ".....kkCCcccccccckllllik",
  "......kkCccccccccklllllk",
  "......kkcccccccckklllllk",
  "......kppppppppkkkllllik",
  "......kppppppppk.kllllik",
  "......kppppppppk.kkkkkkk",
  "......kpppkkpppk........",
  ".....kbppk..kppbk.......",
  ".....kbbk....kbbk.......",
  "....kbbbk....kbbbk......",
  "....kbbbk....kbbbk......",
  "...kbbbbk...kbbbbk......",
  "...kBBBBk...kBBBBk......",
];

const stingerLargeRows: string[] = [
  "........................",
  "........................",
  "......k.................",
  "......k.................",
  "......k.................",
  "......k.................",
  "......k...kkkkkk........",
  "......k..kkllllkk.......",
  "......k..klllllllk......",
  "......kk.kltttllllk.....",
  ".......k.klLLLLLllk.....",
  ".......k..kkllllllk.....",
  ".......kk.kkkkkkkkk.....",
  "......kkkkkkcccckk......",
  ".....kllccccccccck......",
  ".....kllcccccccccck.....",
  ".....kliecccccccckkkkk..",
  ".....klieccccccckkmmmnk.",
  ".....klLCccccckkmmmnkk..",
  "......kLCcccckkmmnkk....",
  "......kkCcccckmnkk......",
  ".......kCcccckkkk.......",
  ".......kppppppk.........",
  "......kppppppppk........",
  "......kppppppppk........",
  "......kpppppppppk.......",
  "......kppppkkppppk......",
  "......kpppk..kpppk......",
  ".....kbppk....kpppk.....",
  ".....kbbk......kppbk....",
  "....kbbbk......kbbbk....",
  "....kbbbk.......kbbk....",
  "...kbbbbk.......kbbbk...",
  "...kbbbbk.......kbbbk...",
  "..kbbbbbk......kbbbbbk..",
  "..kBBBBBk......kBBBBBk..",
];

/**
 * Hero at the LARGE config - Mara Voss re-authored for a 44px figure.
 * Deliberately NOT the canon 48x64 sprite: a zoom step in a pixel runtime
 * is an authored redraw, and pretending otherwise would have inflated this
 * config with detail the config cannot actually afford.
 */
const maraLargeRows: string[] = [
  "................................",
  "................................",
  ".............kkkkkkk............",
  "...........kkccccccckk..........",
  "..........kecccccccccck.........",
  ".........keccccccccccckk........",
  ".........kecccccccccccck........",
  ".........keccccccccCCsssk.......",
  ".........kecccccccCCsmmmMk......",
  ".........keccccccccCCmtmMk......",
  "..........kecccccccCCMMkk.......",
  "..........kccccccccCCkk.........",
  "..........kcccccccccCCk.........",
  ".........kecccccccccccCk........",
  "........kecccccccccccccCk.......",
  "......kkkkcccccccccccccCk.......",
  "....kkiiiikCccccccccccccCk......",
  "....kllllikCcccccccccccCCk......",
  "....klnnlikCccccccccccccCk......",
  "....klnnlikCccccccccccccCk......",
  "....knnnnikCcccccccccccCCk......",
  "....knnnnikCcccccccccccCk.......",
  "....klnnlikCccccccccckkmmmMk....",
  "....kllllikCcccccccccktmmnMnk...",
  "....kLLLLikCccccccccckkmuMkk....",
  ".....kkkkkkCccccccccccCkkk......",
  "..........kCccccccccccCk........",
  "..........kbbbbbbbbbbbk.........",
  "..........kBBBBBBBBBBBk.........",
  ".........kcccccccCkpppPk........",
  ".........kcccccccCkpppPk........",
  ".........kccwccccCkpppPk........",
  ".........kcccccccCkpppPk........",
  ".........kccccccCCkpppPk........",
  "..........kCCkppkkpppPk.........",
  "..........kppppPk.kpppPk........",
  "..........kppppPk.kpppPk........",
  "..........kpwbbPk.kpwbPk........",
  "..........kppbbPk.kppbPk........",
  "..........kppppPk.kppppPk.......",
  "..........kbbbbPk.kbbbbPk.......",
  ".........kbbbbbBk.kbbbbbBk......",
  ".........kbbbbbBk.kbbbbbBk......",
  ".........kbbbbbBk.kbbbbbBk......",
  ".........kBBBBBBk.kBBBBBBk......",
  ".........kkkkkkkk.kkkkkkkk......",
  "................................",
];

// ---------------------------------------------------------------------
// registry + compile helpers
// ---------------------------------------------------------------------

function inkBounds(rows: string[]): { topRow: number; bottomRow: number } {
  let topRow = -1;
  let bottomRow = -1;
  rows.forEach((row, y) => {
    if ([...row].some((ch) => ch !== ".")) {
      if (topRow === -1) { topRow = y; }
      bottomRow = y;
    }
  });
  return { topRow, bottomRow };
}

function makeGrid(
  key: string,
  label: string,
  tier: "fodder" | "hero",
  config: "small" | "large",
  width: number,
  rows: string[],
): CrowdGrid {
  const { topRow, bottomRow } = inkBounds(rows);
  return { key, label, tier, config, width, height: rows.length, topRow, bottomRow, rows };
}

export const crowdGrids: CrowdGrid[] = [
  makeGrid("breaker-small", "Breaker (melee fodder)", "fodder", "small", 16, breakerSmallRows),
  makeGrid("stinger-small", "Stinger (ranged fodder)", "fodder", "small", 16, stingerSmallRows),
  makeGrid("mara-small", "Mara Voss (hero)", "hero", "small", 20, maraSmallRows),
  makeGrid("breaker-large", "Breaker (melee fodder)", "fodder", "large", 24, breakerLargeRows),
  makeGrid("stinger-large", "Stinger (ranged fodder)", "fodder", "large", 24, stingerLargeRows),
  makeGrid("mara-large", "Mara Voss (hero)", "hero", "large", 32, maraLargeRows),
];

export function getGrid(key: string): CrowdGrid {
  const found = crowdGrids.find((grid) => grid.key === key);
  if (found === undefined) { throw new Error(`unknown crowd grid: ${key}`); }
  return found;
}

/** Figure height in screen pixels at 1x - the number the fork is about. */
export function figureHeight(grid: CrowdGrid): number {
  return grid.bottomRow - grid.topRow + 1;
}

/** Opaque authored cells - the real per-sprite drawing cost. */
export function inkedCells(grid: CrowdGrid): number {
  return grid.rows.reduce((total, row) => total + [...row].filter((ch) => ch !== ".").length, 0);
}

/** Distinct palette roles used - a crude proxy for detail density. */
export function distinctRoles(grid: CrowdGrid): number {
  const seen = new Set<string>();
  for (const row of grid.rows) {
    for (const ch of row) {
      if (ch !== ".") { seen.add(ch); }
    }
  }
  return seen.size;
}

/** Report every malformed row/char (authoring aid + test assertion). */
export function validateCrowdGrid(grid: CrowdGrid): string[] {
  const problems: string[] = [];
  const known = new Set<string>([...Object.keys(sharedRoles), ...LIVERY_CHARS]);
  grid.rows.forEach((row, y) => {
    if (row.length !== grid.width) {
      problems.push(`${grid.key} row ${String(y)}: expected ${String(grid.width)} chars, got ${String(row.length)}`);
    }
    [...row].forEach((ch, x) => {
      if (ch !== "." && !known.has(ch)) {
        problems.push(`${grid.key} row ${String(y)} col ${String(x)}: unknown char "${ch}"`);
      }
    });
  });
  return problems;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Compile a grid (or a posed variant of one) to straight-alpha RGBA. */
export function crowdRowsToRgba(rows: string[], width: number, palette: CrowdPalette): Uint8Array {
  const height = rows.length;
  const out = new Uint8Array(width * height * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "." || x >= width) { return; }
      const hex = palette[ch];
      if (hex === undefined) { return; }
      const [r, g, b] = hexToRgb(hex);
      const at = (y * width + x) * 4;
      out[at] = r;
      out[at + 1] = g;
      out[at + 2] = b;
      out[at + 3] = 0xff;
    });
  });
  return out;
}
