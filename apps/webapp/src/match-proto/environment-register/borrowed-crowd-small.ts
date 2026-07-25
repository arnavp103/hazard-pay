/**
 * THROWAWAY PROTOTYPE (#91, round 2) — BORROWED unit art, not authored here.
 *
 * The three SMALL crowd grids from the pixel control lane's round 4
 * (`prototype/pixel-control-lane`, head 2cbaf71806edeb23146ee83bfe0a86b19a39bf2f,
 * `apps/webapp/src/match-proto/pixel-control-lane/crowd-sprites.ts`), copied
 * verbatim so this lane can be read and built without checking that branch
 * out. Characters are explicitly NOT this lane's variable: the environment
 * is. If the pixel lane redraws these, this file is stale by definition and
 * should be re-copied rather than diverged.
 *
 * The register they fix, and which the board around them now has to serve:
 *
 *   fodder figure 22 px, hero figure 28 px (1.27x boost)
 *   dimetric half-tile 13x7 at the pixel lane's SMALL config
 *
 * That last number is why round 2 rescaled the board: round 1 drew a 64x32
 * tile under a 48x64 hero, and a 22 px fodder unit standing on a 64 px tile
 * reads as a beetle on a dance floor.
 *
 * Grids are authored as MATERIAL ONLY — the contour is applied at blit time
 * against whatever is actually behind the unit (see `unit-sprites.ts`), which
 * is the pixel lane's round-4 rendering policy and the reason this lane can
 * measure its own figure/ground dissolve rate rather than inherit a number.
 */

export type CrowdPalette = Record<string, string>;

/** Shared, team-independent roles. Livery (`l`/`L`/`i`) is filled per team. */
export const sharedRoles: CrowdPalette = {
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

export const LIVERY_CHARS = ["l", "L", "i"] as const;

export type TeamKey = "rust" | "slate";

/**
 * The two sides differ ONLY in the three livery entries, and are split in
 * VALUE as well as hue so the faction read survives a grayscale pass.
 */
export const teamPalettes: Record<TeamKey, CrowdPalette> = {
  rust: { ...sharedRoles, l: "#ad5638", L: "#63332a", i: "#e0a06f" },
  slate: { ...sharedRoles, l: "#3f5268", L: "#232f3f", i: "#5c7ea8" },
};

/** Three discrete aerial-perspective steps, mixed toward the world anchor. */
export const DEPTH_MIX = [0, 0.16, 0.28] as const;

/**
 * Fodder melee — "breaker". Silhouette contract: WIDE, COMPACT, TOP-HEAVY.
 * In pure black it is a wide trapezoid.
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
 * Fodder ranged — "stinger". Silhouette contract: NARROW COLUMN plus a hard
 * horizontal weapon line that breaks the outline. In pure black, a thin cross.
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

/** Hero — Mara Voss at the SMALL config, a 28 px figure. */
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

export interface CrowdGrid {
  key: string;
  label: string;
  tier: "fodder" | "hero";
  width: number;
  height: number;
  /** Top row carrying ink, inclusive — the figure's crown. */
  topRow: number;
  /** Bottom row carrying ink, inclusive — the figure's contact row. */
  bottomRow: number;
  rows: string[];
}

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

function makeGrid(key: string, label: string, tier: "fodder" | "hero", width: number, rows: string[]): CrowdGrid {
  const { topRow, bottomRow } = inkBounds(rows);
  return { key, label, tier, width, height: rows.length, topRow, bottomRow, rows };
}

export const crowdGrids: CrowdGrid[] = [
  makeGrid("breaker", "Breaker (melee fodder)", "fodder", 18, breakerSmallRows),
  makeGrid("stinger", "Stinger (ranged fodder)", "fodder", 16, stingerSmallRows),
  makeGrid("mara", "Mara Voss (hero)", "hero", 20, maraSmallRows),
];

export function getGrid(key: string): CrowdGrid {
  const found = crowdGrids.find((grid) => grid.key === key);
  if (found === undefined) { throw new Error(`unknown crowd grid: ${key}`); }
  return found;
}

/** Figure height in screen pixels at 1x — 22 px fodder, 28 px hero. */
export function figureHeight(grid: CrowdGrid): number {
  return grid.bottomRow - grid.topRow + 1;
}

/** Every colour the borrowed unit art can emit, for the palette gate. */
export const CROWD_COLORS: readonly string[] = [
  ...new Set([
    ...Object.values(teamPalettes.rust),
    ...Object.values(teamPalettes.slate),
  ]),
];

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
