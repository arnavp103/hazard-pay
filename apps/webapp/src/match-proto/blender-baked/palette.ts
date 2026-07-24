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

let cached: utils.Palette | undefined;

/** The palette as image-q sees it. Built once; `Palette` caches its own index. */
export function paletteForQuantizer(): utils.Palette {
  if (cached === undefined) {
    const built = new utils.Palette();
    for (const entry of DIRECTION_B_PALETTE) {
      const [r, g, b] = hexToRgb(entry.hex);
      built.add(utils.Point.createByRGBA(r, g, b, 0xff));
    }
    cached = built;
  }
  return cached;
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
): void {
  const alphaCutoff = 128;
  const container = utils.PointContainer.fromUint8Array(rgba, width, height);
  for (const point of container.getPointArray()) {
    point.a = 0xff;
  }
  const mapped = applyPaletteSync(container, paletteForQuantizer(), {
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
