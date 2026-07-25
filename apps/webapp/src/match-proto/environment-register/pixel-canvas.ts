/**
 * THROWAWAY PROTOTYPE (#91) — pixel primitives for treatment B.
 *
 * A tiny software rasterizer over a straight-alpha RGBA buffer. It exists
 * because the MST register is a *pixel* register: every mark has to land
 * on a whole pixel, chosen deliberately, with no antialiasing anywhere.
 * Canvas 2D would happily antialias these edges and quietly leave the
 * palette; this does not, which is also what makes the palette-conformance
 * gate meaningful.
 *
 * Pure data — no DOM, no canvas — so it runs and is tested in plain Node,
 * per the webapp's "keep renderable state in pure modules" rule.
 */

import { type Point } from "./board-model.ts";
import { hexToRgb, rgbToHex } from "./palette.ts";

export interface Surface {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function createSurface(width: number, height: number): Surface {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function setPixel(surface: Surface, x: number, y: number, hex: string): void {
  const px = Math.trunc(x);
  const py = Math.trunc(y);
  if (px < 0 || py < 0 || px >= surface.width || py >= surface.height) { return; }
  const [r, g, b] = hexToRgb(hex);
  const at = (py * surface.width + px) * 4;
  surface.data[at] = r;
  surface.data[at + 1] = g;
  surface.data[at + 2] = b;
  surface.data[at + 3] = 0xff;
}

export function getPixel(surface: Surface, x: number, y: number): string | undefined {
  const px = Math.trunc(x);
  const py = Math.trunc(y);
  if (px < 0 || py < 0 || px >= surface.width || py >= surface.height) { return undefined; }
  const at = (py * surface.width + px) * 4;
  if ((surface.data[at + 3] ?? 0) === 0) { return undefined; }
  return rgbToHex(surface.data[at] ?? 0, surface.data[at + 1] ?? 0, surface.data[at + 2] ?? 0);
}

export function fillRect(surface: Surface, x: number, y: number, width: number, height: number, hex: string): void {
  for (let py = Math.round(y); py < Math.round(y) + Math.round(height); py += 1) {
    for (let px = Math.round(x); px < Math.round(x) + Math.round(width); px += 1) {
      setPixel(surface, px, py, hex);
    }
  }
}

/**
 * Even-odd scanline fill sampled at pixel centres. Deterministic, and on
 * the 2:1 dimetric diamonds it produces exactly the 2-pixel staircase that
 * the projection implies — the staircase is the art, not an artifact.
 */
export function fillPolygon(surface: Surface, points: Point[], hex: string): void {
  if (points.length < 3) { return; }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const top = Math.max(0, Math.floor(minY));
  const bottom = Math.min(surface.height - 1, Math.ceil(maxY));

  for (let py = top; py <= bottom; py += 1) {
    const sampleY = py + 0.5;
    const crossings: number[] = [];
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      if (a === undefined || b === undefined) { continue; }
      const lower = Math.min(a.y, b.y);
      const upper = Math.max(a.y, b.y);
      if (sampleY < lower || sampleY >= upper) { continue; }
      const t = (sampleY - a.y) / (b.y - a.y);
      crossings.push(a.x + t * (b.x - a.x));
    }
    crossings.sort((left, right) => left - right);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const from = crossings[index];
      const to = crossings[index + 1];
      if (from === undefined || to === undefined) { continue; }
      for (let px = Math.round(from); px < Math.round(to); px += 1) {
        setPixel(surface, px, py, hex);
      }
    }
  }
}

/** Bresenham, one pixel wide. */
export function drawLine(surface: Surface, from: Point, to: Point, hex: string): void {
  let x0 = Math.round(from.x);
  let y0 = Math.round(from.y);
  const x1 = Math.round(to.x);
  const y1 = Math.round(to.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  for (;;) {
    setPixel(surface, x0, y0, hex);
    if (x0 === x1 && y0 === y1) { return; }
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x0 += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y0 += sy;
    }
  }
}

export function strokePolygon(surface: Surface, points: Point[], hex: string): void {
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (a === undefined || b === undefined) { continue; }
    drawLine(surface, a, b, hex);
  }
}

/**
 * Composite a text-grid stamp (the `sprites.ts` authoring format) at a
 * board position. `.` is transparent; every other char must be in the
 * stamp's palette. Anchored bottom-centre, the way a prop sits on a cell.
 */
export function stampGrid(
  surface: Surface,
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
  anchorX: number,
  anchorY: number,
): void {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const originX = Math.round(anchorX - width / 2);
  const originY = Math.round(anchorY - height);
  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char === ".") { return; }
      const hex = palette[char];
      if (hex === undefined) { return; }
      setPixel(surface, originX + x, originY + y, hex);
    });
  });
}

/** Stable 32-bit hash — the determinism behind every "random-looking" mark. */
export function hash2(x: number, y: number, seed: number): number {
  let value = (Math.trunc(x) * 374761393 + Math.trunc(y) * 668265263 + seed * 1442695040) | 0;
  value = (value ^ (value >>> 13)) * 1274126177;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

/**
 * Blobby value field on a coarse lattice. This is the difference between
 * *clustered* shading and dither noise: samples are interpolated across a
 * `scale`-pixel lattice, so thresholding it yields connected patches
 * several pixels across rather than a per-pixel checkerboard.
 */
export function clusterField(x: number, y: number, scale: number, seed: number): number {
  const gx = Math.floor(x / scale);
  const gy = Math.floor(y / scale);
  const fx = x / scale - gx;
  const fy = y / scale - gy;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sx = smooth(fx);
  const sy = smooth(fy);
  const c00 = hash2(gx, gy, seed);
  const c10 = hash2(gx + 1, gy, seed);
  const c01 = hash2(gx, gy + 1, seed);
  const c11 = hash2(gx + 1, gy + 1, seed);
  const top = c00 + (c10 - c00) * sx;
  const bottom = c01 + (c11 - c01) * sx;
  return top + (bottom - top) * sy;
}

/** Every distinct colour present in the surface, lower-cased hex. */
export function surfaceColors(surface: Surface): Set<string> {
  const seen = new Set<string>();
  for (let at = 0; at < surface.data.length; at += 4) {
    if ((surface.data[at + 3] ?? 0) === 0) { continue; }
    seen.add(rgbToHex(surface.data[at] ?? 0, surface.data[at + 1] ?? 0, surface.data[at + 2] ?? 0));
  }
  return seen;
}

/** Colour histogram, for the 70/25/5 budget measurement. */
export function surfaceHistogram(surface: Surface): Map<string, number> {
  const counts = new Map<string, number>();
  for (let at = 0; at < surface.data.length; at += 4) {
    if ((surface.data[at + 3] ?? 0) === 0) { continue; }
    const hex = rgbToHex(surface.data[at] ?? 0, surface.data[at + 1] ?? 0, surface.data[at + 2] ?? 0);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  return counts;
}

/** The exact pixel set a polygon covers, using the same scanline rule. */
export function polygonPixels(points: Point[], width: number, height: number): Point[] {
  const out: Point[] = [];
  if (points.length < 3) { return out; }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const top = Math.max(0, Math.floor(minY));
  const bottom = Math.min(height - 1, Math.ceil(maxY));
  for (let py = top; py <= bottom; py += 1) {
    const sampleY = py + 0.5;
    const crossings: number[] = [];
    for (let index = 0; index < points.length; index += 1) {
      const a = points[index];
      const b = points[(index + 1) % points.length];
      if (a === undefined || b === undefined) { continue; }
      const lower = Math.min(a.y, b.y);
      const upper = Math.max(a.y, b.y);
      if (sampleY < lower || sampleY >= upper) { continue; }
      const t = (sampleY - a.y) / (b.y - a.y);
      crossings.push(a.x + t * (b.x - a.x));
    }
    crossings.sort((left, right) => left - right);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const from = crossings[index];
      const to = crossings[index + 1];
      if (from === undefined || to === undefined) { continue; }
      for (let px = Math.max(0, Math.round(from)); px < Math.min(width, Math.round(to)); px += 1) {
        out.push({ x: px, y: py });
      }
    }
  }
  return out;
}
