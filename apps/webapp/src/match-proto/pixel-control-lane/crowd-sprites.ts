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
 *
 * ROUND 4 (SMALL only; LARGE is the untouched control).
 *
 * The round-3 cold critique failed SMALL on archetype separation and grit,
 * and its argument was an ink budget: at 22 px a uniform 1 px contour ate
 * most of the sprite. Round 4 answers it in two places, and only one of
 * them is the drawing:
 *
 * 1. **Shape language.** Both SMALL fodder archetypes are redrawn to a
 *    silhouette contract rather than a kit list. Breaker is a WIDE, compact,
 *    top-heavy trapezoid whose round-3 shield SLAB is demoted to a 3 px
 *    buckler boss -- that slab was inflating fodder mass to 182 px and
 *    eating the hero's height advantage. Stinger is a NARROW column with a
 *    rifle that BREAKS THE OUTLINE horizontally. In pure black the two are
 *    a wide trapezoid and a thin cross.
 * 2. **Rendering policy.** The SMALL grids are authored as *material only*.
 *    The contour is applied at blit time by `applyContour` in
 *    `./crowd-scene.ts`, which inks the contact edge and undersides, rim
 *    lights the lit edge, and leaves the shadow edge to value contrast.
 *    A separate 1 px halo fires only where one unit actually overlaps
 *    another. Measured on the composited stage, only 4-7 % of this lane's
 *    background-facing silhouette edges were low-contrast against the
 *    board, so a uniform contour was spending most of its pixels on a
 *    figure/ground problem this lane does not have.
 *
 * Depth falloff is expressed as three *discrete* palette steps mixed toward
 * the plum-black world anchor, so the render stays palette-indexed.
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
 *
 * The two ramps are deliberately split in VALUE as well as hue: the first
 * round-3 pass had them at the same luma, so the crowd's faction read
 * collapsed completely in grayscale, which the canon forbids. Rust is now
 * the warm/light side and slate the cool/dark one at every step of the
 * ramp; a test pins the gap.
 */
export const teamPalettes: Record<TeamKey, CrowdPalette> = {
  rust: { ...sharedRoles, l: "#ad5638", L: "#63332a", i: "#e0a06f" },
  slate: { ...sharedRoles, l: "#3f5268", L: "#232f3f", i: "#5c7ea8" },
};

/**
 * Depth falloff, round 4 (SMALL only). Back ranks are mixed toward the
 * plum-black world anchor rather than toward pure black, so they lose value
 * AND chroma together the way aerial perspective actually behaves, and the
 * frame stays palette-indexed: three discrete steps, not a continuous ramp.
 *
 * Round 3 shipped one body colour for every rank, so a 36-unit engagement
 * was a single flat plane with overlap as its only depth cue.
 */
export const DEPTH_MIX = [0, 0.20, 0.36] as const;

function mixHex(hex: string, toward: string, amount: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const out: number[] = [];
  for (let shift = 16; shift >= 0; shift -= 8) {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    out.push(Math.round(from + (to - from) * amount));
  }
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** `depthPalettes[team][step]` - step 0 is the front rank, 2 the rear. */
export const depthPalettes: Record<TeamKey, CrowdPalette[]> = {
  rust: [],
  slate: [],
};

for (const team of ["rust", "slate"] as const) {
  depthPalettes[team] = DEPTH_MIX.map((amount) => {
    const base = teamPalettes[team];
    const out: CrowdPalette = {};
    for (const [role, hex] of Object.entries(base)) {
      out[role] = amount === 0 ? hex : mixHex(hex, base.k ?? "#120b10", amount);
    }
    return out;
  });
}

/** Rec. 709 luma - the grayscale-legibility law is a value law. */
export function luma(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 0xff) + 0.7152 * ((n >> 8) & 0xff) + 0.0722 * (n & 0xff);
}

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
 * Fodder melee - "breaker" (round-4 redraw). Silhouette contract: WIDE,
 * COMPACT, TOP-HEAVY. Shoulder span 14 px against a 8 px hip, the helm sunk
 * between the pauldrons so there is no neck to read, a stubby cleaver adding
 * WIDTH at shoulder height rather than height above the crown, and a 3 px
 * buckler boss where round 3 carried a full shield slab.
 *
 * Authored as material only - `applyContour` inks it at blit time.
 */
const breakerSmallRows: string[] = [
  "..................",
  "..................",
  ".......CCCC.......",
  "......CCCCCC......",
  "......llllll......",
  "......MMMMMM......",
  "....lllcccccClll..",
  "...lllicccccCCilll",
  "..llliccccccCCilll",
  ".mmmccccccccCCmnnn",
  ".mMmccccccccCCmmnn",
  "..mmcccccccccCmmn.",
  "...cccwccccccC....",
  "...cLllllllLC.....",
  "....cccccCwcC.....",
  "....ppPppppP......",
  "....pppp.pppp.....",
  "....pppp.pppp.....",
  "....ppp...ppp.....",
  "...bbbb...bbbb....",
  "...bbbb...bbbb....",
  "..bbbbb...bbbbb...",
  "..BBBBB...BBBBB...",
  "..BBBBB...BBBBB...",
];

/**
 * Fodder ranged - "stinger" (round-4 redraw). Silhouette contract: NARROW
 * COLUMN plus a hard HORIZONTAL weapon line that BREAKS THE OUTLINE. Body
 * mass is 7 px wide against the breaker's 14, and the rifle runs 14 px
 * across chest height, clear of the body on both sides. The archetype read
 * is therefore global (aspect ratio + one protrusion) rather than internal
 * kit, which is the only channel that survives 22 px inside a clump.
 *
 * Authored as material only - `applyContour` inks it at blit time.
 */
const stingerSmallRows: string[] = [
  "................",
  "................",
  ".....CCC........",
  "....CCCCC.......",
  "....lltll.......",
  "....ccccc.......",
  "..llccccc.......",
  "..lliccccc......",
  "..llicccc.......",
  "...lcccccc......",
  ".MmmnmmmmmmnnmM.",
  "...ccwcccc.mm...",
  "...cLlllLc......",
  "...cccccCc......",
  "...pPppppp......",
  "...ppppppp......",
  "...ppp..ppp.....",
  "..ppp....ppp....",
  "..ppp....ppp....",
  ".bbb......bbb...",
  ".bbb......bbb...",
  ".bbbb.....bbbb..",
  "bbbb......bbbbb.",
  "BBBB......BBBBB.",
];

/**
 * Hero at the SMALL config - Mara Voss re-authored for a 28px figure.
 * Every hero-tier cue the 48x64 canon sprite carries is attempted here:
 * hood, respirator, back-slung med case with a pale cross, cybernetic
 * forearm with a teal pip, injector, staggered stance, hem wear.
 *
 * ROUND 4, control repair (not a redesign - the hero sprite is a throwaway
 * placeholder pending the parallel design exploration). The round-3 cold
 * critique found this unit's "unmarked" control was not unmarked: it carried
 * a warm tan skin/visor entry and a near-white cyan specular that **no**
 * fodder unit had, four occurrences per render, one per hero. Those were
 * doing the tier separation the experiment claimed size and density were
 * doing. Both are retired here - the visor takes the unit's own faction
 * highlight `i` and the specular takes the teal `t` that stinger fodder also
 * carry - so the hero's palette is a strict subset of its faction's fodder
 * palette, which is what the critique asked for.
 */
const maraSmallRows: string[] = [
  "....................",
  "....................",
  "........kkkkk.......",
  "......kkcccccck.....",
  ".....keccccccck.....",
  ".....kecccccCiik....",
  ".....keccccCCmmMk...",
  ".....keccccccCtMk...",
  "......kccccccCkk....",
  "....kkkcccccccCk....",
  "..kkiiikCcccccCk....",
  "..kllnlkCcccccCk....",
  "..klnnlkCcccccCk....",
  "..klnnlkCcccccCkkmmk",
  "..kllnlkCcccccCktmnk",
  "..kLLLLkCcccccCkktMk",
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
  makeGrid("breaker-small", "Breaker (melee fodder)", "fodder", "small", 18, breakerSmallRows),
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
