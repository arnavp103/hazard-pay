/**
 * THROWAWAY PROTOTYPE (#91, round 2) — the readability measurement.
 *
 * Round 1 measured its value-saturation budget at 93.1 / 6.2 / 0.48 against a
 * canon 70 / 25 / 5, wrote a paragraph explaining why that was fine, and
 * shipped. The cofounder's reply began with the word "unreadable", so the
 * paragraph was wrong and the number was right.
 *
 * Round 2 keeps the band measurement — it is canon and it is comparable across
 * rounds — but adds the measurement that actually corresponds to "readable at
 * a glance", because the band split does not:
 *
 * - **Zone occupancy.** The frame is authored into four declared value zones
 *   (`palette.ts`). A frame where 95 % of the pixels sit in one zone is flat no
 *   matter how its bands divide up, and that was round 1's real failure.
 * - **Value spread.** The luma interquartile range and the P5/P95 span of the
 *   whole frame. One number for "is there anything dark and anything light in
 *   this picture at all".
 * - **Figure/ground dissolve.** What share of unit silhouette edges sit within
 *   `CONTOUR_MIN_CONTRAST` luma of the pixel behind them, measured off this
 *   lane's own composited buffer. A sibling lane measured 53 % on its pipeline
 *   and the pixel lane measured 4–7 % on the same board; the mechanism differs
 *   per pipeline, so the only number worth reporting is one's own.
 */

import { type Band, type Zone, bandOf, luma, rgbToHex, zoneOf } from "./palette.ts";
import { type Surface, surfaceHistogram } from "./pixel-canvas.ts";

export interface BandSplit {
  body: number;
  identity: number;
  emission: number;
  /** Pixels whose colour is not in the declared palette at all. */
  offPalette: number;
}

export function measureBands(surface: Surface): BandSplit {
  const histogram = surfaceHistogram(surface);
  let total = 0;
  const spend: Record<Band, number> = { body: 0, emission: 0, identity: 0 };
  let offPalette = 0;
  for (const [color, count] of histogram) {
    total += count;
    const band = bandOf(color);
    if (band === undefined) {
      offPalette += count;
      continue;
    }
    spend[band] += count;
  }
  if (total === 0) { return { body: 0, emission: 0, identity: 0, offPalette: 0 }; }
  return {
    body: spend.body / total,
    identity: spend.identity / total,
    emission: spend.emission / total,
    offPalette: offPalette / total,
  };
}

export type ZoneSplit = Record<Zone | "unknown", number>;

export function measureZones(surface: Surface): ZoneSplit {
  const histogram = surfaceHistogram(surface);
  const out: ZoneSplit = { backdrop: 0, dressing: 0, ground: 0, unit: 0, unknown: 0 };
  let total = 0;
  for (const [color, count] of histogram) {
    total += count;
    const zone = zoneOf(color);
    out[zone ?? "unknown"] += count;
  }
  if (total === 0) { return out; }
  for (const key of Object.keys(out) as (Zone | "unknown")[]) { out[key] /= total; }
  return out;
}

export interface ValueSpread {
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
  /** P75 − P25. A flat frame has a small one. */
  iqr: number;
  /** P95 − P5. How much of the 0–255 range the frame actually uses. */
  span: number;
  /** Distinct 8-step luma buckets carrying at least 0.5 % of the frame. */
  occupiedBuckets: number;
}

export function measureSpread(surface: Surface): ValueSpread {
  const buckets = new Float64Array(256);
  let total = 0;
  for (let at = 0; at < surface.data.length; at += 4) {
    if ((surface.data[at + 3] ?? 0) === 0) { continue; }
    const hex = rgbToHex(surface.data[at] ?? 0, surface.data[at + 1] ?? 0, surface.data[at + 2] ?? 0);
    const value = Math.max(0, Math.min(255, Math.round(luma(hex))));
    buckets[value] = (buckets[value] ?? 0) + 1;
    total += 1;
  }
  if (total === 0) {
    return { p5: 0, p25: 0, median: 0, p75: 0, p95: 0, iqr: 0, span: 0, occupiedBuckets: 0 };
  }
  const quantile = (fraction: number): number => {
    let seen = 0;
    const target = total * fraction;
    for (let value = 0; value < 256; value += 1) {
      seen += buckets[value] ?? 0;
      if (seen >= target) { return value; }
    }
    return 255;
  };
  let occupied = 0;
  for (let base = 0; base < 256; base += 8) {
    let sum = 0;
    for (let value = base; value < base + 8; value += 1) { sum += buckets[value] ?? 0; }
    if (sum / total >= 0.005) { occupied += 1; }
  }
  const p25 = quantile(0.25);
  const p75 = quantile(0.75);
  const p5 = quantile(0.05);
  const p95 = quantile(0.95);
  return {
    p5,
    p25,
    median: quantile(0.5),
    p75,
    p95,
    iqr: p75 - p25,
    span: p95 - p5,
    occupiedBuckets: occupied,
  };
}
