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

import { hexToRgb, INK } from "../palette.ts";

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
}

export const DEFAULT_INK: InkOptions = { contour: true, internalLumaGap: 6 };

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
      out[i * 4] = ir;
      out[i * 4 + 1] = ig;
      out[i * 4 + 2] = ib;
    }
  }

  if (options.contour) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (opaque(i)) { continue; }
        const touching = (x > 0 && opaque(i - 1))
          || (x < width - 1 && opaque(i + 1))
          || (y > 0 && opaque(i - width))
          || (y < height - 1 && opaque(i + width));
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
