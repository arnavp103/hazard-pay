/**
 * THROWAWAY PROTOTYPE (#74) — pixel control lane of the modality bake-off.
 *
 * The field medic re-authored at the revised 48×64-at-1× canon canvas
 * (#68, 2026-07-24 revision). Text-grid format follows `../sprites.ts`
 * (one char per pixel, `.` = transparent, per-character palette) but the
 * grids live here: this is lane-local prototype art, not the seam module.
 *
 * Style laws carried from the #79 four-treatment synthesis:
 * - A: continuous plum-black silhouette ink + large material-local
 *   clusters (two values per material, deliberate shadow shapes).
 * - C: sparse third band (highlight) on focal materials only — metal,
 *   emission, and the livery pack edge.
 * - D: wear reserved for focal history — hand-placed chips on the coat
 *   hem, boot toes, and pack corners. No global dither.
 * Light is upper-left; shadow falls right/low. Palette anchors on the
 * plum-black ink #120b10; no magenta/chartreuse; rust livery + teal
 * emission carry identity (70/25/5 budget).
 */

export const MEDIC_WIDTH = 48;
export const MEDIC_HEIGHT = 64;

/** Pixel char -> #rrggbb. `.` is transparent and never mapped. */
export const medicPalette: Record<string, string> = {
  k: "#120b10", // plum-black silhouette ink
  c: "#485654", // coat base (grey-teal grime)
  C: "#293334", // coat shadow
  l: "#a6533f", // livery rust base (medic identity)
  L: "#62352f", // livery shadow
  i: "#d1845d", // livery highlight (sparse, pack edge only)
  m: "#77777d", // metal base (cyber forearm, injector)
  M: "#34343a", // metal shadow
  n: "#c9c3b8", // metal highlight (focal third band)
  t: "#2f9e96", // emission teal
  T: "#142729", // emission dark housing
  u: "#d0fff4", // emission hot point (budget: a few pixels)
  s: "#a96e51", // skin base
  S: "#70483a", // skin shadow
  h: "#3b2936", // hair base
  H: "#211820", // hair shadow
  p: "#3b3942", // pants base
  P: "#242229", // pants shadow
  b: "#29252a", // boot/strap base
  B: "#171217", // boot shadow / sole
  w: "#554951", // wear chip (focal scuffs only)
};

/**
 * Side facing, right-facing profile. The anchor sprite: hooded coat,
 * back-slung livery med-case with pale cross, rust armband, cybernetic
 * right forearm with teal emission strip, compact injector tool.
 */
export const medicSide: string[] = [
  "................................................",
  "................................................",
  "....................kkkkkkk.....................",
  "..................kkcccccckk....................",
  "................kkcccccccccck...................",
  "...............kcccccccccccckk..................",
  "..............kcccccccccccccck..................",
  ".............kccccccccccccCkk...................",
  ".............kccccccccccCCsssk..................",
  ".............kccccccccccCCsHssk.................",
  ".............kccccccccccCCmmmmMk................",
  "..............kcccccccccCCmmmtk.................",
  "..............kccccccccccCMMk...................",
  "...............kcccccccccCMk....................",
  "...............kcccccccccccCCk..................",
  "..............kccccccccccccccCCk................",
  ".............kccCCcccccccccccCCk................",
  "............kcccCccccccccccccCCCk...............",
  "............kccccccccccccccCCCCCk...............",
  "........kiiiikCcccccccCccccccCck................",
  "........kllllkCcccccccClllllLCck................",
  "........kllllkCcccccccClllllLCck................",
  "........klnnlkCcccccccCccccccCck................",
  "........knnnnkCcccccccCccccccCck................",
  "........knnnnkCcccccccCccccccCck................",
  "........klnnlkCcccccccCccccccCck................",
  "........kllllkCcccccccCccccccCk.................",
  "........kllllkCcccccccCcccckkCk.................",
  "........kllllkCcccccccCknmmmMk..................",
  "........kLLLLkCcccccccCckttmmmMk................",
  ".............kCcccccccCcckummmmMk...............",
  ".............kCcccccccCccckmmmmMkmmmmmmmk.......",
  ".............kCcccccccCccckmmmMkmTttmmMnn.......",
  ".............kCcccccccCccCkMMMkkkkkkkkkk........",
  ".............kbbbbbbbbbbnnbbbbk.................",
  ".............kBBBBBBBBBBBBBBkk..................",
  "............kcccccccccCkppppPk..................",
  "............kcccccccccCkppppPk..................",
  "............kccwccccccCkppppPk..................",
  "............kccccccccCCkppppPk..................",
  "............kcccCccccCCkppppPk..................",
  "............kcccccccCCkkppppPk..................",
  ".............kccccccCCkkppppPk..................",
  ".............kcccccCCkkkppppPk..................",
  "..............kCCkpppkkkppppPk..................",
  "..............kpppppPk.kppppPk..................",
  "..............kpppppPk.kppppPk..................",
  "..............kppwbbBk.kpwbbBk..................",
  "..............kppwbbBk.kpwbbBk..................",
  "..............kppwbbBk.kpwbbBk..................",
  "..............kpppppPk.kppppPk..................",
  "..............kpppppPk.kppppPk..................",
  "..............kpppppPk.kppppPk..................",
  "..............kpppppPk.kppppPk..................",
  "..............kpppppPk.kppppPk..................",
  "..............kpppppPk.kppppPk..................",
  "..............kbbbbbBk.kbbbbBk..................",
  "..............kbbbbbBk.kbbbbBk..................",
  ".............kbbbbbbBk.kbbbbbBk.................",
  ".............kbbbbbbBk.kbbbbwBk.................",
  ".............kBBBBBBBk.kBBBBBBBk................",
  ".............kkkkkkkkk.kkkkkkkkk................",
  "................................................",
  "................................................",
];

/**
 * Front facing (toward viewer). Hair fringe under the hood, twin teal
 * respirator filters, chest livery patch with pale cross, harness strap
 * running shoulder-to-hip, cyber right forearm on the viewer's left.
 */
export const medicFront: string[] = [
  "................................................",
  "................................................",
  "...................kkkkkkkkkk...................",
  ".................kkcccccccccckk.................",
  "................kcccccccccccccck................",
  "...............kcccccccccccccccck...............",
  "...............kccCCCCCCCCCCCCcck...............",
  "...............kcChhhhhhhhhhCck.................",
  "...............kcCssssssssssCck.................",
  "...............kcCsHssssssHsCck.................",
  "...............kcCsmmmmmmmmsCck.................",
  "...............kcCtmmmmmmmmtCck.................",
  "...............kcCCMMmmmmMMCCck.................",
  "...............kccCCCCCCCCCCcck.................",
  "..............kcccccccccccccccck................",
  ".............kcccccccccccccccccck...............",
  ".............kccccccccccccccccCllk..............",
  "............kcccccccccccccccccCllk..............",
  "............kccccccccccccccccccClk..............",
  "...........kcccCccccccccccccbbccCccck...........",
  "...........kcccCcccccccccccbbcccCccck...........",
  "...........kcccCccccccccccbbccccCccck...........",
  "...........kcccCccllllcccbbcccccCccck...........",
  "...........kcccCcclnnlccbbccccccCccck...........",
  "...........kcccCccnnnncbbcccccccCccck...........",
  "...........kcccCcclnnlbbccccccccCccck...........",
  "...........kcccCcccccbbcccccccccCccck...........",
  "...........kcccCccccbbccccccccccCccck...........",
  "...........knmmMcccbbcccccccccccCccck...........",
  "...........ktmmMccbbccccccccccccCccck...........",
  "...........ktmmMccccccccccccccccCbbbk...........",
  "...........kummMccccccccccccccccCbbbk...........",
  "...........kmmmMccccccccccccccccCbbbk...........",
  "...........kMMMkcccccccccccccccckBBBk...........",
  ".............kbbbbbbbbbnnbbbbbbbbbk.............",
  ".............kBBBBBBBBBBBBBBBBBBBBk.............",
  ".............kccccccccCkkCcccccccck.............",
  ".............kccccccccCkkCcccccccck.............",
  ".............kccwcccccCkkCcccccccck.............",
  ".............kccccccccCkkCcccccccck.............",
  ".............kccccccccCkkCccccCccck.............",
  ".............kccccccccCkkCcccccccck.............",
  ".............kcCccccccCkkCccccccCck.............",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kpbbpPk..kpbbpPk................",
  "................kpbbpPk..kpbbpPk................",
  "................kpbbpPk..kpbbpPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kbbbbBk..kbbbbBk................",
  "................kbbbbBk..kbbbbBk................",
  "...............kbbbbbBk..kbbbbbBk...............",
  "...............kwbbbbBk..kbbbbbBk...............",
  "...............kBBBBBBk..kBBBBBBk...............",
  "...............kkkkkkkk..kkkkkkkk...............",
  "................................................",
  "................................................",
];

/**
 * Back facing (away from viewer). The med-case dominates: full rust
 * pack with the big pale cross, twin shoulder straps, hood crease.
 * Cyber forearm sits on the viewer's right from behind.
 */
export const medicBack: string[] = [
  "................................................",
  "................................................",
  "...................kkkkkkkkkk...................",
  ".................kkcccccccccckk.................",
  "................kcccccccccccccck................",
  "...............kcccccccccccccccck...............",
  "...............kcccccccCCccccccck...............",
  "...............kcccccccCCccccccck...............",
  "...............kcccccccCCccccccck...............",
  "...............kcccccccCCccccccck...............",
  "...............kccccccccCccccccck...............",
  "...............kccccCCCCCCCCcccck...............",
  "...............kcccCCCCCCCCCCccck...............",
  "...............kcccccccccccccccck...............",
  "..............kcccccccccccccccck................",
  ".............kcccbbccccccccccbbck...............",
  "............kccccbbccccccccccbbcck..............",
  "............kccccbbccccccccccbbcck..............",
  "............kccccbbccccccccccbbcck..............",
  "...........kccckiiiiiiiiiiiiiLLLkccck...........",
  "...........kcccklllllllllllllLLLkccck...........",
  "...........kcccklllllnnnllllLLLLkccck...........",
  "...........kcccklllllnnnllllLLLLkccck...........",
  "...........kccckllnnnnnnnnnnlLLLkccck...........",
  "...........kccckllnnnnnnnnnnlLLLkccck...........",
  "...........kccckllnnnnnnnnnnlLLLkccck...........",
  "...........kcccklllllnnnllllLLLLkccck...........",
  "...........kcccklllllnnnllllLLLLkccck...........",
  "...........kcccklllllnnnllllLLLLknmmk...........",
  "...........kccckllllllllllllLLLLkmmtk...........",
  "...........kbbbklllllllllllllLLLkmmtk...........",
  "...........kbbbkLLLLLLLLLLLLLLLLkmmuk...........",
  "...........kbbbkcccccccccccccccckmmmk...........",
  "...........kBBBkcccccccccccccccckMMMk...........",
  ".............kbbbbbbbbbbbbbbbbbbbbk.............",
  ".............kBBBBBBBBBBBBBBBBBBBBk.............",
  ".............kccccccccCkkCcccccccck.............",
  ".............kccccccccCkkCcccccccck.............",
  ".............kccccccccCkkCcccccccck.............",
  ".............kccccccccCkkCccCcccck..............",
  ".............kccccccccCkkCccccccck..............",
  ".............kcwccccccCkkCcccccccck.............",
  ".............kccccccccCkkCcccccccck.............",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kppppPk..kppppPk................",
  "................kbbbbBk..kbbbbBk................",
  "................kbbbbBk..kbbbbBk................",
  "...............kbbbbbBk..kbbbbbBk...............",
  "...............kbbbbbBk..kbbbbbBk...............",
  "...............kBBBBBBk..kBBBBBBk...............",
  "...............kkkkkkkk..kkkkkkkk...............",
  "................................................",
  "................................................",
];

export interface MedicFrame {
  name: string;
  rows: string[];
}

const BLANK_ROW = ".".repeat(MEDIC_WIDTH);

/** Copy a grid, replacing the given rows (authored frame deltas). */
function withRows(base: string[], edits: Record<number, string>): string[] {
  return base.map((row, y) => edits[y] ?? row);
}

/** Shift rows [fromY..toY] down by one (chin-tuck / settle motion). */
function dipRows(base: string[], fromY: number, toY: number): string[] {
  return base.map((row, y) => {
    if (y === fromY) { return BLANK_ROW; }
    if (y > fromY && y <= toY) { return base[y - 1] ?? row; }
    return row;
  });
}

/**
 * Idle loop, side facing — 4 deliberate stepped frames: chin tuck on the
 * hood, emission dim/pulse on the forearm strip, vial, and mask filter.
 */
export const medicSideIdle: string[][] = [
  medicSide,
  dipRows(medicSide, 2, 13),
  withRows(dipRows(medicSide, 2, 13), {
    12: "..............kcccccccccCCmmmTk.................",
    30: ".............kCcccccccCccktmmmmMk...............",
    32: ".............kCcccccccCccckmmmMkmTTtmmMnn.......",
  }),
  withRows(medicSide, {
    32: ".............kCcccccccCccckmmmMkmTtummMnn.......",
  }),
];

/**
 * Attack, side facing — 6 stepped frames of an injector jab:
 * ready, cock back, thrust, impact flash, recover, settle.
 */
export const medicSideAttack: string[][] = [
  // 1 — ready (base stance)
  medicSide,
  // 2 — anticipation: arm cocked, injector pulled to the chest
  withRows(medicSide, {
    27: "........kllllkCcccccccCccccccCk.................",
    28: "........kllllkCcccccccCcknmMkk..................",
    29: "........kLLLLkCcccccccCcktmmMk..................",
    30: ".............kCcccccccCckummmMk.................",
    31: ".............kCcccccccCcckmmmmMkk...............",
    32: ".............kCcccccccCcckmmMkmTtk..............",
    33: ".............kCcccccccCccCkMMkkkk...............",
  }),
  // 3 — thrust: arm extended, needle forward
  withRows(medicSide, {
    27: "........kllllkCcccccccCccccccCk.................",
    28: "........kllllkCcccccccCknnnnnmmmmmkkkkkkk.......",
    29: "........kLLLLkCcccccccCkmmmmmmmmmMkmTttmmMnn....",
    30: ".............kCcccccccCkttummmmmMkkkkkkkkk......",
    31: ".............kCcccccccCkkMMMMMMMkk..............",
    32: ".............kCcccccccCcckkkkkk.................",
    33: ".............kCcccccccCccCkkk...................",
  }),
  // 4 — impact flash: emission flare + spark past the needle tip
  withRows(medicSide, {
    27: "........kllllkCcccccccCccccccCk............t....",
    28: "........kllllkCcccccccCknnnnnmmmmmkkkkkkk.u.u...",
    29: "........kLLLLkCcccccccCkmmmmmmmmmMkmuuummMuu.t..",
    30: ".............kCcccccccCkttummmmmMkkkkkkkkk.u....",
    31: ".............kCcccccccCkkMMMMMMMkk......t.......",
    32: ".............kCcccccccCcckkkkkk.................",
    33: ".............kCcccccccCccCkkk...................",
  }),
  // 5 — recover: back through the cocked pose
  withRows(medicSide, {
    27: "........kllllkCcccccccCccccccCk.................",
    28: "........kllllkCcccccccCcknmMkk..................",
    29: "........kLLLLkCcccccccCcktmmMk..................",
    30: ".............kCcccccccCckummmMk.................",
    31: ".............kCcccccccCcckmmmmMkk...............",
    32: ".............kCcccccccCcckmmMkmTtk..............",
    33: ".............kCcccccccCccCkMMkkkk...............",
  }),
  // 6 — settle (base)
  medicSide,
];

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Validate a grid and report every malformed row (authoring aid). */
export function validateGrid(rows: string[], name: string): string[] {
  const problems: string[] = [];
  if (rows.length !== MEDIC_HEIGHT) {
    problems.push(`${name}: expected ${String(MEDIC_HEIGHT)} rows, got ${String(rows.length)}`);
  }
  rows.forEach((row, y) => {
    if (row.length !== MEDIC_WIDTH) {
      problems.push(`${name} row ${String(y)}: expected ${String(MEDIC_WIDTH)} chars, got ${String(row.length)}`);
    }
    [...row].forEach((ch, x) => {
      if (ch !== "." && medicPalette[ch] === undefined) {
        problems.push(`${name} row ${String(y)} col ${String(x)}: unknown char "${ch}"`);
      }
    });
  });
  return problems;
}

/** Compile one grid to a straight-alpha RGBA buffer (48×64×4). */
export function medicFrameToRgba(rows: string[]): Uint8Array {
  const problems = validateGrid(rows, "frame");
  if (problems.length > 0) {
    throw new Error(problems.join("\n"));
  }
  const out = new Uint8Array(MEDIC_WIDTH * MEDIC_HEIGHT * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") { return; }
      const hex = medicPalette[ch];
      if (hex === undefined) { return; }
      const [r, g, b] = hexToRgb(hex);
      const at = (y * MEDIC_WIDTH + x) * 4;
      out[at] = r;
      out[at + 1] = g;
      out[at + 2] = b;
      out[at + 3] = 0xff;
    });
  });
  return out;
}
