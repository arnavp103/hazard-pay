/**
 * BORROWED LANE ART (#91) — not this lane's work and not this lane's
 * variable.
 *
 * Verbatim copy of the 48×64 field medic authored by the pixel control
 * lane (#74, PR #84) at `apps/webapp/src/match-proto/pixel-control-lane/
 * medic-48.ts`. The environment-register bake-off varies the *board*, so
 * the hero-tier unit is held fixed by reusing existing lane art rather
 * than authoring a new character. Do not refine it here; refinements
 * belong to #74.
 *
 * Kept as its own file so the diff makes the provenance obvious and the
 * copy can be dropped wholesale when the lanes converge.
 */

export const MEDIC_WIDTH = 48;
export const MEDIC_HEIGHT = 64;

/** Pixel char -> #rrggbb. `.` is transparent and never mapped. */
export const medicPalette: Record<string, string> = {
  k: "#120b10", // plum-black silhouette ink
  c: "#485654", // coat base (grey-teal grime)
  e: "#5c6d6a", // coat rim light (upper-left form edge)
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
 * right forearm with teal emission strip, compact injector tool. Legs
 * shortened and the stance staggered (front foot forward) per the #74
 * round-2 proportions directive.
 */
export const medicSide: string[] = [
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "....................kkkkkkk.....................",
  "..................kkcccccckk....................",
  "................kkeccccccccck...................",
  "...............keccccccccccckk..................",
  "..............keccccccccccccck..................",
  ".............kecccccccccccCkk...................",
  ".............kecccccccccCCsssk..................",
  ".............kecccccccccCCsHssk.................",
  ".............kecccccccccCCmmmmMk................",
  "..............keccccccccCCmmmtk.................",
  "..............kecccccccccCMMk...................",
  "...............kcccccccccCMk....................",
  "...............kcccccccccccCCk..................",
  "..............kecccccccccccccCCk................",
  ".............kecCCcccccccccccCCk................",
  "............kcccCccccccccccccCCCk...............",
  "............kccccccccccccccCCCCCk...............",
  "........kiiiikCcccccccCccccccCck................",
  "........kllwlkCcccccccClllllLCck................",
  "........klnllkCcccccccCllnllLCck................",
  "........klnnlkCcccccccClllllLCck................",
  "........knnnnkCcccccccCccccccCck................",
  "........knnnnkCcccccccCccccccCck................",
  "........klnnlkCcccccccCccccccCck................",
  "........kllllkCcccccccCccccccCk.................",
  "........kllwlkCcccccccCcccckkCk.................",
  "........kllllkCcccccccCknmmmMk..................",
  "........kLLLLkCcccccccCckttmmmMk................",
  ".............kCcccccccCcckummmmMk...............",
  ".............kCcccccccCccckmmmmMkmmmmmmmk.......",
  ".............kCcccccccCccckmmnMkmTunmnMnn.......",
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
  "..............kpppppPk...kppppPk................",
  "..............kpppppPk...kppppPk................",
  "..............kppwbbBk...kpwbbBk................",
  "..............kppwbbBk...kpwbbBk................",
  "..............kppwbbBk...kpwbbBk................",
  "..............kpppppPk...kppppPk................",
  "..............kpppppPk...kppppPk................",
  "..............kbbbbnBk...kbnbbBk................",
  "..............kbbbbbBk...kbbbbBk................",
  ".............kbbbbbbBk...kbbbbbBk...............",
  ".............kbbbbbbBk...kbbbbwBk...............",
  ".............kBBBBBBBk...kBBBBBBBk..............",
  ".............kkkkkkkkk...kkkkkkkkk..............",
  "................................................",
  "................................................",
];

/**
 * Front facing (toward viewer). Hair fringe under the hood, twin teal
 * respirator filters, chest livery patch with pale cross, harness strap
 * running shoulder-to-hip, cyber right forearm on the viewer's left with
 * a teal-tipped injector in the hand.
 */
export const medicFront: string[] = [
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "...................kkkkkkkkkk...................",
  ".................kkcccccccccckk.................",
  "................keccccccccccccck................",
  "...............keccccccccccccccck...............",
  "...............kecCCCCCCCCCCCCcck...............",
  "...............kcChhhhhhhhhhCck.................",
  "...............kcCssssssssssCck.................",
  "...............kcCsHssssssHsCck.................",
  "...............kcCsmmmmmmmmsCck.................",
  "...............kcCtmmmmmmmmtCck.................",
  "...............kcCCMMmmmmMMCCck.................",
  "...............kccCCCCCCCCCCcck.................",
  "..............kcccccccccccccccck................",
  ".............kcecccccccccccccccck...............",
  ".............kecccccccccccccccCllk..............",
  "............kcccccccccccccccccCllk..............",
  "............kccccccccccccccccccClk..............",
  "...........kcccCccccccccccccbbccCccck...........",
  "...........kcccCcccccccccccbbcccCccck...........",
  "...........kcccCccnnccccccbbccccCccck...........",
  "...........kcccCccllllcccbbcccccCccck...........",
  "...........kcccCcclnnlccbbccccccCccck...........",
  "...........kcccCccnnnncbbcccccccCccck...........",
  "...........kcccCccnnnlbbccccccccCccck...........",
  "...........kcccCcccccbbcccccccccCccck...........",
  "...........kcccCccccbbccccccccccCccck...........",
  "...........knmmMcccbbcccccccccccCccck...........",
  "..........mktmmMccbbccccccccccccCccck...........",
  ".........mtktmmMccccccccccccccccCbbbk...........",
  "........mtukummMccccccccccccccccCbbbk...........",
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
  "................kpbbpPk..kpbbpPk................",
  "................kpbbpPk..kpbbpPk................",
  "................kpbbpPk..kpbbpPk................",
  "................kpnppPk..knpppPk................",
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
 * pack with the big pale cross, twin shoulder straps, hood crease. Cyber
 * forearm sits on the viewer's right from behind, injector nub visible.
 */
export const medicBack: string[] = [
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "................................................",
  "...................kkkkkkkkkk...................",
  ".................kkcccccccccckk.................",
  "................keccccccccccccck................",
  "...............keccccccccccccccck...............",
  "...............keccccccCCccccccck...............",
  "...............kcccccccCCccccccck...............",
  "...............kcccccccCCccccccck...............",
  "...............kcccccccCCccccccck...............",
  "...............kccccccccCccccccck...............",
  "...............kccccCCCCCCCCcccck...............",
  "...............kcccCCCCCCCCCCccck...............",
  "...............kcccccccccccccccck...............",
  "..............kcccccccccccccccck................",
  ".............ecccbbccccccccccbbck...............",
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
  "...........kbbbklllllllllllllLLLkmmtmm..........",
  "...........kbbbkLLLLLLLLLLLLLLLLkmmutu..........",
  "...........kbbbkcccccccccccccccckmmmm...........",
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
  "................kpnppPk..knpppPk................",
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
