/**
 * THROWAWAY PROTOTYPE (#82): the Direction B token palette every pixel in
 * this lane is forced onto — character sprites baked out of Blender AND the
 * grime-market board, through the same `image-q` call.
 *
 * That shared step is the lane's cohesion argument. The rival lanes put the
 * unit and the environment on different colour systems (one authored, one
 * rendered); here a single 32-entry palette is the only vocabulary the frame
 * has, so character and board cannot drift apart.
 *
 * Palette law (#68): plum-black `#120b10` is the anchor, no default magenta
 * or chartreuse, ~70% muted world / ~25% identity / ~5% signal. The ramps
 * below are ordered so the environment owns the muted plum/brick end and the
 * unit owns rust + teal — the only saturated marks in the set.
 */

import { applyPaletteSync, utils } from "image-q";

export interface PaletteEntry {
  name: string;
  hex: string;
  /** Which side of the 70/25/5 budget this entry is allowed to serve. */
  role: "identity" | "signal" | "world";
}

/**
 * 32 entries, eight ramps. The cloth/steel/rust ramps were derived from the
 * actual three-band cel output of the Blender materials (base colour times
 * the shadow/mid/lit multipliers), so a baked pixel lands on its intended
 * token instead of being dragged across a ramp boundary by the quantizer.
 */
export const DIRECTION_B_PALETTE: readonly PaletteEntry[] = [
  // Anchor + deep darks.
  { name: "ink", hex: "#120b10", role: "world" },
  { name: "ink-2", hex: "#1a1218", role: "world" },
  { name: "plum-deep", hex: "#241a22", role: "world" },
  { name: "plum-1", hex: "#2c2530", role: "world" },
  // Environment plum ramp — the muted 70%.
  { name: "plum-2", hex: "#211820", role: "world" },
  { name: "plum-3", hex: "#332733", role: "world" },
  { name: "plum-4", hex: "#3d2939", role: "world" },
  { name: "plum-5", hex: "#4b3446", role: "world" },
  { name: "plum-6", hex: "#59404f", role: "world" },
  { name: "plum-7", hex: "#75505a", role: "world" },
  // Warm facade brick.
  { name: "brick-1", hex: "#56303d", role: "world" },
  { name: "brick-2", hex: "#6e413c", role: "world" },
  { name: "brick-3", hex: "#8c5141", role: "world" },
  // The world's own warm bright end. Deliberately more amber than the unit's
  // rust ramp so the board can carry lit trim and signage without wearing a
  // colour the roster reserves — r1 found the board's hazard stripe within
  // (1,3,3) of the medic's dominant accent.
  { name: "copper", hex: "#a06a3e", role: "world" },
  // Sage cloth — the medic's coat, the largest area on the unit.
  { name: "sage-1", hex: "#262a2e", role: "identity" },
  { name: "sage-2", hex: "#3e4744", role: "identity" },
  { name: "sage-3", hex: "#4c5752", role: "identity" },
  { name: "sage-4", hex: "#647167", role: "identity" },
  // Violet cloth — hood, pants, pack, boots.
  { name: "violet-1", hex: "#17131b", role: "identity" },
  { name: "violet-2", hex: "#2b1a28", role: "identity" },
  { name: "violet-3", hex: "#46414a", role: "identity" },
  { name: "violet-4", hex: "#5e404e", role: "identity" },
  // Steel — the cybernetic arm, toe caps, injector barrel.
  { name: "steel-1", hex: "#504b5e", role: "identity" },
  { name: "steel-2", hex: "#696477", role: "identity" },
  { name: "steel-3", hex: "#a5a4ab", role: "identity" },
  { name: "steel-4", hex: "#d4d2d3", role: "identity" },
  // Rust livery — the identity peak.
  { name: "rust-1", hex: "#5e2b28", role: "identity" },
  { name: "rust-2", hex: "#7e382f", role: "identity" },
  { name: "rust-3", hex: "#c46047", role: "identity" },
  { name: "rust-4", hex: "#fc7c5a", role: "identity" },
  // Signal teal + the pale cross/tape — the scarce 5%.
  { name: "signal-1", hex: "#1c5a55", role: "signal" },
  { name: "signal-2", hex: "#2f9e96", role: "signal" },
  { name: "signal-3", hex: "#a8f0e4", role: "signal" },
  { name: "pale", hex: "#c8bda9", role: "signal" },
];

/** Direction B's warm plum-black — shared deepest ink/shadow anchor (#68). */
export const INK = "#120b10";

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/**
 * The board's vocabulary. Canon (#68): "playable map regions use quieter
 * contrast so units can own the darkest contours and brightest focal points."
 * The first pass let the board wear the roster's own accents — its teal floor
 * pad landed within (5,0,1) of the medic's signal teal and its hazard stripe
 * within (1,3,3) of her livery orange — so the unit was camouflaged by its own
 * identity colours. Restricting the environment to the world ramps plus the
 * two darkest rusts and the dead teal reserves the saturated end for units.
 */
export const BOARD_PALETTE: readonly PaletteEntry[] = DIRECTION_B_PALETTE.filter(
  (entry) => entry.role === "world" || entry.name === "rust-1" || entry.name === "rust-2"
    || entry.name === "signal-1",
);

const paletteCache = new Map<string, utils.Palette>();

/** The palette as image-q sees it. Built once; `Palette` caches its own index. */
export function paletteForQuantizer(subset?: readonly PaletteEntry[]): utils.Palette {
  const entries = subset ?? DIRECTION_B_PALETTE;
  const cacheKey = entries.map((entry) => entry.name).join(",");
  const existing = paletteCache.get(cacheKey);
  if (existing !== undefined) { return existing; }
  const built = new utils.Palette();
  for (const entry of entries) {
    const [r, g, b] = hexToRgb(entry.hex);
    built.add(utils.Point.createByRGBA(r, g, b, 0xff));
  }
  paletteCache.set(cacheKey, built);
  return built;
}

/**
 * Push the board's midtones down before quantizing it.
 *
 * The first pass measured 68.7% of the play field inside a 40-level luminance
 * window with nothing below L20 and nothing above L180 — dim, but flat, and
 * the medic's coat sat at the same luminance as the floor directly under her
 * feet. Deepening the environment's darks buys the near-black massing the
 * grime register wants AND gives the unit a value to stand against, without
 * touching the shared board art the three lanes are all being judged on.
 */
export function deepenBoard(rgba: Uint8ClampedArray | Uint8Array): void {
  // An S-curve, not a straight gamma. Deepening alone bought the near-black
  // massing the grime register wants and then took the board's only light with
  // it: the play field ended up with 0.01% of pixels above L180 in a world
  // whose budget allows ~5% for focal light. Shadows go down, the lit trim and
  // window strips come back up, and the midtone plums stay where they were.
  for (let i = 0; i < rgba.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const value = (rgba[i + c] ?? 0) / 255;
      const deep = value ** 1.22 * 0.93;
      const lit = value ** 0.68;
      const t = Math.min(1, Math.max(0, (value - 0.42) / 0.33));
      const blend = t * t * (3 - 2 * t);
      rgba[i + c] = Math.round(255 * (deep * (1 - blend) + lit * blend));
    }
  }
}

/**
 * Force straight-alpha RGBA pixels onto the palette, in place.
 *
 * CIEDE2000 is the distance metric: plain RGB distance drags the sage coat's
 * mid band onto a plum, because the two are close in RGB and far apart to the
 * eye. Nearest-colour, never dithering — a dither pattern at a 31-px character
 * height is indistinguishable from noise and destroys the flat clusters the
 * reference board asks for.
 *
 * Alpha is carried around the quantizer rather than through it: the palette is
 * opaque, so an alpha-aware distance would map every transparent pixel to some
 * arbitrary colour. Anything under the cutoff is zeroed outright, which also
 * guarantees the binary alpha a pixel-art sprite needs.
 */
export function quantizeToPalette(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  subset?: readonly PaletteEntry[],
): void {
  const alphaCutoff = 128;
  const container = utils.PointContainer.fromUint8Array(rgba, width, height);
  for (const point of container.getPointArray()) {
    point.a = 0xff;
  }
  const mapped = applyPaletteSync(container, paletteForQuantizer(subset), {
    colorDistanceFormula: "ciede2000",
    imageQuantization: "nearest",
  }).toUint8Array();

  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) < alphaCutoff) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 0;
      continue;
    }
    rgba[i] = mapped[i] ?? 0;
    rgba[i + 1] = mapped[i + 1] ?? 0;
    rgba[i + 2] = mapped[i + 2] ?? 0;
    rgba[i + 3] = 0xff;
  }
}

let darkerCache: Map<number, [number, number, number]> | undefined;

/**
 * One step down the ramp for every palette entry.
 *
 * Internal separation on a 31-px figure cannot be plum-black: two touching
 * cloth masses inked in `#120b10` shred the silhouette into speckle (measured,
 * not guessed — it was the first thing the pixels said). Stepping the darker
 * side one rung down its own ramp instead keeps the seam inside the palette's
 * value language, which is how hand-drawn sprites separate same-tone forms.
 */
export function darkerStep(r: number, g: number, b: number): [number, number, number] {
  if (darkerCache === undefined) {
    darkerCache = new Map();
    const entries = DIRECTION_B_PALETTE.map((entry) => hexToRgb(entry.hex));
    for (const [er, eg, eb] of entries) {
      const target: [number, number, number] = [er * 0.58, eg * 0.58, eb * 0.62];
      let best = entries[0] ?? [0, 0, 0];
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const candidate of entries) {
        // Straight squared RGB is right here: we are picking a rung on a ramp
        // we authored, not judging perceptual similarity across hues.
        const distance = (candidate[0] - target[0]) ** 2
          + (candidate[1] - target[1]) ** 2
          + (candidate[2] - target[2]) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }
      darkerCache.set((er << 16) | (eg << 8) | eb, best);
    }
  }
  return darkerCache.get((r << 16) | (g << 8) | b) ?? [r, g, b];
}

/** Distinct palette entries actually used by an RGBA buffer, for reporting. */
export function paletteCoverage(rgba: Uint8Array | Uint8ClampedArray): Set<string> {
  const byKey = new Map<number, string>();
  for (const entry of DIRECTION_B_PALETTE) {
    const [r, g, b] = hexToRgb(entry.hex);
    byKey.set((r << 16) | (g << 8) | b, entry.name);
  }
  const used = new Set<string>();
  for (let i = 0; i < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) === 0) { continue; }
    const key = ((rgba[i] ?? 0) << 16) | ((rgba[i + 1] ?? 0) << 8) | (rgba[i + 2] ?? 0);
    const name = byKey.get(key);
    if (name !== undefined) { used.add(name); }
  }
  return used;
}
