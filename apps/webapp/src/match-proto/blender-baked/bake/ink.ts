/**
 * THROWAWAY PROTOTYPE (#82): contour and internal separation, added in
 * TypeScript after quantization rather than as 3D geometry.
 *
 * The rival real-time lane draws its plum-black outlines as expanded
 * back-face shells, 0.022 world units thick. At this lane's 16 art px per
 * world unit that is a third of a pixel — it would simply not exist. A pixel
 * sprite's contour has to be authored in pixel space, at exactly 1 px, which
 * is what this module does:
 *
 *  - the silhouette contour is grown OUTWARD into the transparent margin, so
 *    the ink frames the figure instead of eating a third of a 3-px forearm;
 *  - internal edges come from the per-part ID pass Blender renders alongside
 *    the colour pass, and are drawn only where two touching parts are close
 *    in value. Where the cel bands already separate the forms, adding a line
 *    would just make a 31-px figure muddy.
 */

import { darkerStep, hexToRgb, INK } from "../palette.ts";

export interface InkOptions {
  /** Grow a 1 px plum-black contour into the transparent margin. */
  contour: boolean;
  /**
   * Max luma gap between two touching parts that still gets an internal line.
   * Deliberately tiny: at a 31-px character height a 1-px ink line costs a
   * third of a forearm, so it is spent only where two parts genuinely merge
   * into one blob. Anything the cel bands already separate is left alone.
   * 0 disables internal ink entirely.
   */
  internalLumaGap: number;
  /**
   * How a seam is drawn. "ink" is the textbook plum-black line and is kept
   * only so the gallery can show why it does not survive at this scale;
   * "darken" steps the darker side one rung down its own ramp.
   */
  internalMode: "darken" | "ink";
}

export const DEFAULT_INK: InkOptions = { contour: true, internalLumaGap: 10, internalMode: "darken" };

/** Palette entries the internal pass must never overwrite: the scarce 5%. */
const PROTECTED = new Set(["#2f9e96", "#a8f0e4", "#c8bda9"]);

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hexOf(rgba: Uint8Array, index: number): string {
  const r = rgba[index] ?? 0;
  const g = rgba[index + 1] ?? 0;
  const b = rgba[index + 2] ?? 0;
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/**
 * `color` and `ids` are straight-alpha RGBA buffers of the same cell; `ids`
 * carries the Blender per-part index in its red channel. Returns a new buffer.
 */
export function inkSprite(
  color: Uint8Array,
  ids: Uint8Array,
  width: number,
  height: number,
  options: InkOptions = DEFAULT_INK,
): Uint8Array {
  const [ir, ig, ib] = hexToRgb(INK);
  const out = new Uint8Array(color);
  const opaque = (i: number): boolean => (color[i * 4 + 3] ?? 0) > 0;

  if (options.internalLumaGap > 0) {
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const a = y * width + x;
        if (!opaque(a)) { continue; }
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= width || ny >= height) { continue; }
          const b = ny * width + nx;
          if (!opaque(b)) { continue; }
          if ((ids[a * 4] ?? 0) === (ids[b * 4] ?? 0)) { continue; }
          const la = luma(color[a * 4] ?? 0, color[a * 4 + 1] ?? 0, color[a * 4 + 2] ?? 0);
          const lb = luma(color[b * 4] ?? 0, color[b * 4 + 1] ?? 0, color[b * 4 + 2] ?? 0);
          if (Math.abs(la - lb) > options.internalLumaGap) { continue; }
          // The line hugs the darker side, the way a hand-drawn sprite does.
          const target = la <= lb ? a : b;
          if (PROTECTED.has(hexOf(color, target * 4))) { continue; }
          mask[target] = 1;
        }
      }
    }
    for (let i = 0; i < mask.length; i += 1) {
      if (mask[i] !== 1) { continue; }
      const [dr, dg, db] = options.internalMode === "ink"
        ? [ir, ig, ib]
        : darkerStep(color[i * 4] ?? 0, color[i * 4 + 1] ?? 0, color[i * 4 + 2] ?? 0);
      out[i * 4] = dr;
      out[i * 4 + 1] = dg;
      out[i * 4 + 2] = db;
    }
  }

  if (options.contour) {
    // Eight-neighbour dilation, not four. A four-neighbour contour leaves the
    // ring broken at every diagonal step of the silhouette: the corner ink
    // pixels only touch each other diagonally, so the outline is a chain of
    // orphans rather than one closed line. Measured on this rig it turned a
    // consolidated 0.14 islands/px into 0.38 with half the islands single
    // pixels — the contour pass was undoing the consolidation pass. Closing
    // the diagonals costs one pixel at each corner and buys a contour that is
    // actually continuous.
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (opaque(i)) { continue; }
        let touching = false;
        for (let dy = -1; dy <= 1 && !touching; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) { continue; }
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) { continue; }
            if (opaque(ny * width + nx)) {
              touching = true;
              break;
            }
          }
        }
        if (!touching) { continue; }
        out[i * 4] = ir;
        out[i * 4 + 1] = ig;
        out[i * 4 + 2] = ib;
        out[i * 4 + 3] = 0xff;
      }
    }
  }

  return out;
}

/**
 * Hero marking: a thick outline grown OUTSIDE the finished silhouette.
 *
 * Approved on #69 after the flat-procedural lane proved size + detail density
 * cannot separate a hero from fodder at small angular size — a perception
 * limit no pipeline escapes. The important property for a bake-off is where
 * this costs: the ring is authored in pixel space over cells that already
 * exist, so it needs no new render, no new rig and no new pose. It does need
 * atlas cells, which is exactly the trade this lane keeps paying.
 *
 * The ring is grown from the sprite's own alpha with a Chebyshev distance
 * transform, so it is a constant `thickness` all the way round including the
 * diagonals — a 4-neighbour grow leaves a ring that thins at every corner,
 * which is the same defect the contour pass had at 1 px.
 */
export function markOutline(
  rgba: Uint8Array,
  width: number,
  height: number,
  hex: string,
  thickness: number,
): Uint8Array {
  const out = new Uint8Array(rgba);
  if (thickness <= 0) { return out; }
  const [mr, mg, mb] = hexToRgb(hex);
  let ring: number[] = [];
  for (let i = 0; i < width * height; i += 1) {
    if ((rgba[i * 4 + 3] ?? 0) > 0) { ring.push(i); }
  }
  const claimed = new Uint8Array(width * height);
  for (const i of ring) { claimed[i] = 1; }

  for (let step = 0; step < thickness; step += 1) {
    const next: number[] = [];
    for (const at of ring) {
      const x = at % width;
      const y = (at - x) / width;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) { continue; }
          const n = ny * width + nx;
          if (claimed[n] === 1) { continue; }
          claimed[n] = 1;
          next.push(n);
          out[n * 4] = mr;
          out[n * 4 + 1] = mg;
          out[n * 4 + 2] = mb;
          out[n * 4 + 3] = 0xff;
        }
      }
    }
    ring = next;
  }
  return out;
}

/** Tight opaque bounding box, or null for an entirely empty cell. */
export function alphaBounds(
  rgba: Uint8Array,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((rgba[(y * width + x) * 4 + 3] ?? 0) === 0) { continue; }
      if (x < minX) { minX = x; }
      if (x > maxX) { maxX = x; }
      if (y < minY) { minY = y; }
      if (y > maxY) { maxY = y; }
    }
  }
  if (maxX < 0) { return null; }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
