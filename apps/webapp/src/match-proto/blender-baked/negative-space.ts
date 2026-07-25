/**
 * THROWAWAY PROTOTYPE (#82), round 6: negative space, measured.
 *
 * The cofounder's direction for this round is "make it thinner and taller and
 * play around with negative space between arms and torso, and legs". Negative
 * space is the one art-direction note in this whole bake-off that can be turned
 * into an integer without arguing about it: a gap is a run of BACKGROUND pixels
 * with figure on both sides of it, and either the shipped atlas has them or it
 * does not.
 *
 * Two things make this worth its own module rather than a line in the bake:
 *
 *  1. This lane's own passes eat small features. The contour pass dilates the
 *     silhouette one pixel outward on all eight neighbours, so it closes a gap
 *     from BOTH sides — a 2-px gap in the render is a 0-px gap in the atlas. The
 *     consolidation pass has already deleted a deliberate 2-px livery mark once
 *     (round 5, `c083e86`). Measuring the render and calling it evidence would
 *     therefore be measuring the wrong image, which is a mistake this lane has
 *     been caught making before.
 *  2. A 2D pixel grid is drawn at one facing. A rig is baked at eight, and an
 *     arm that clears the torso from the front is in front of it from the side.
 *     "Does the figure have gaps" is not a yes/no in a 3D lane; it is a count of
 *     facings, and reporting the best one would be a lie by selection.
 *
 * So everything here works on a reconstructed atlas cell, over every facing, and
 * every number is reported as a distribution rather than a maximum.
 */

/** One row of the figure: the interior background runs found in it. */
export interface RowGaps {
  y: number;
  /** Widths of interior background runs, left to right. */
  runs: readonly { x: number; width: number }[];
}

export interface BandGaps {
  /** Rows in this band that contain at least one interior gap. */
  rowsWithGap: number;
  /** Rows with a gap on BOTH sides of the body's centre of mass. */
  rowsWithBothSides: number;
  rowsWithLeftGap: number;
  rowsWithRightGap: number;
  /** Widest single gap anywhere in the band, in art pixels. */
  maxWidth: number;
  /** Mean width over the gaps that exist. 0 when there are none. */
  meanWidth: number;
  /** Longest run of CONSECUTIVE rows carrying a gap — sustained daylight. */
  longestSustainedRows: number;
  /** Total background pixels enclosed by the figure in this band. */
  gapPixels: number;
}

export interface SpriteGaps {
  /** Opaque rows in the sprite. */
  rows: number;
  /** Upper band: head, torso, arms. */
  arm: BandGaps;
  /** Lower band: legs. */
  leg: BandGaps;
  /** Widest horizontal extent of the bottom two opaque rows, in art px. */
  contactSpan: number;
  /** `contactSpan` over the sprite's drawn height — the anti-float number. */
  contactRatio: number;
  /** Opaque pixels. */
  pixels: number;
  /** Drawn bounding box. */
  width: number;
  height: number;
}

/**
 * Where the legs start, as a fraction of drawn height measured from the top.
 *
 * Every rig in this lane puts its pelvis between 0.44 and 0.50 of rig height,
 * and the hem hangs a little below that, so 0.60 lands just under the hem on all
 * four. It is a constant rather than a per-rig number on purpose: the two bands
 * are a reporting convenience, and letting each rig choose its own split would
 * make the per-archetype comparison meaningless.
 */
export const LEG_BAND_FROM_TOP = 0.6;

function opaqueMask(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    mask[i] = (rgba[i * 4 + 3] ?? 0) > 0 ? 1 : 0;
  }
  return mask;
}

/**
 * Interior background runs of one row: transparent stretches with figure on
 * both sides. A run open at either end of the row is the outside world, not a
 * gap, and counting it would turn "this unit is narrow" into "this unit has
 * lovely negative space".
 */
export function interiorRuns(
  mask: Uint8Array,
  width: number,
  y: number,
): { x: number; width: number }[] {
  const row = y * width;
  let first = -1;
  let last = -1;
  for (let x = 0; x < width; x += 1) {
    if (mask[row + x] !== 1) { continue; }
    if (first < 0) { first = x; }
    last = x;
  }
  if (first < 0 || last <= first) { return []; }
  const runs: { x: number; width: number }[] = [];
  let start = -1;
  for (let x = first; x <= last; x += 1) {
    const solid = mask[row + x] === 1;
    if (!solid && start < 0) { start = x; }
    if (solid && start >= 0) {
      runs.push({ width: x - start, x: start });
      start = -1;
    }
  }
  return runs;
}

function bandGaps(
  mask: Uint8Array,
  width: number,
  from: number,
  to: number,
): BandGaps {
  let rowsWithGap = 0;
  let rowsWithBothSides = 0;
  let rowsWithLeftGap = 0;
  let rowsWithRightGap = 0;
  let maxWidth = 0;
  let widthSum = 0;
  let gapCount = 0;
  let gapPixels = 0;
  let sustained = 0;
  let longest = 0;

  for (let y = from; y < to; y += 1) {
    const runs = interiorRuns(mask, width, y);
    if (runs.length === 0) {
      sustained = 0;
      continue;
    }
    // The body's own centre in this row, so "left" and "right" mean left and
    // right of the FIGURE rather than of the cell — a sprite is not centred in
    // its cell once the pose lunges.
    let sum = 0;
    let count = 0;
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) { continue; }
      sum += x;
      count += 1;
    }
    const centre = count === 0 ? width / 2 : sum / count;
    let left = false;
    let right = false;
    for (const run of runs) {
      gapCount += 1;
      widthSum += run.width;
      gapPixels += run.width;
      maxWidth = Math.max(maxWidth, run.width);
      if (run.x + run.width / 2 < centre) {
        left = true;
      } else {
        right = true;
      }
    }
    rowsWithGap += 1;
    if (left) { rowsWithLeftGap += 1; }
    if (right) { rowsWithRightGap += 1; }
    if (left && right) { rowsWithBothSides += 1; }
    sustained += 1;
    longest = Math.max(longest, sustained);
  }

  return {
    gapPixels,
    longestSustainedRows: longest,
    maxWidth,
    meanWidth: gapCount === 0 ? 0 : Number((widthSum / gapCount).toFixed(2)),
    rowsWithBothSides,
    rowsWithGap,
    rowsWithLeftGap,
    rowsWithRightGap,
  };
}

/** Measure one sprite cell. `rgba` is a full cell; empty margin is ignored. */
export function measureGaps(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): SpriteGaps {
  const mask = opaqueMask(rgba, width, height);
  let top = height;
  let bottom = -1;
  let left = width;
  let right = -1;
  let pixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) { continue; }
      pixels += 1;
      if (y < top) { top = y; }
      if (y > bottom) { bottom = y; }
      if (x < left) { left = x; }
      if (x > right) { right = x; }
    }
  }
  if (bottom < 0) {
    const none: BandGaps = {
      gapPixels: 0,
      longestSustainedRows: 0,
      maxWidth: 0,
      meanWidth: 0,
      rowsWithBothSides: 0,
      rowsWithGap: 0,
      rowsWithLeftGap: 0,
      rowsWithRightGap: 0,
    };
    return {
      arm: none, contactRatio: 0, contactSpan: 0, height: 0, leg: none, pixels: 0, rows: 0, width: 0,
    };
  }

  const drawnHeight = bottom - top + 1;
  const split = top + Math.round(drawnHeight * LEG_BAND_FROM_TOP);

  // Contact: the horizontal extent of the bottom two opaque rows. Two rather
  // than one because a single row of a dimetric sprite is often one corner of a
  // boot, and the eye reads the whole sole as the contact.
  let contactLeft = width;
  let contactRight = -1;
  for (let y = Math.max(top, bottom - 1); y <= bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) { continue; }
      if (x < contactLeft) { contactLeft = x; }
      if (x > contactRight) { contactRight = x; }
    }
  }
  const contactSpan = contactRight < 0 ? 0 : contactRight - contactLeft + 1;

  return {
    arm: bandGaps(mask, width, top, split),
    contactRatio: Number((contactSpan / drawnHeight).toFixed(3)),
    contactSpan,
    height: drawnHeight,
    leg: bandGaps(mask, width, split, bottom + 1),
    pixels,
    rows: drawnHeight,
    width: right - left + 1,
  };
}

/** Sum two band measurements — used to fold eight facings into one row. */
function addBands(a: BandGaps, b: BandGaps): BandGaps {
  return {
    gapPixels: a.gapPixels + b.gapPixels,
    longestSustainedRows: Math.max(a.longestSustainedRows, b.longestSustainedRows),
    maxWidth: Math.max(a.maxWidth, b.maxWidth),
    meanWidth: a.meanWidth + b.meanWidth,
    rowsWithBothSides: a.rowsWithBothSides + b.rowsWithBothSides,
    rowsWithGap: a.rowsWithGap + b.rowsWithGap,
    rowsWithLeftGap: a.rowsWithLeftGap + b.rowsWithLeftGap,
    rowsWithRightGap: a.rowsWithRightGap + b.rowsWithRightGap,
  };
}

export interface FacingSummary {
  facings: number;
  /** Facings where the arm band has a gap on both sides at once. */
  facingsWithBothArmGaps: number;
  /** Facings where the legs part at all. */
  facingsWithLegGap: number;
  meanArmRowsWithGap: number;
  meanLegRowsWithGap: number;
  maxArmGapWidth: number;
  maxLegGapWidth: number;
  meanContactSpan: number;
  meanContactRatio: number;
  meanWidth: number;
  meanHeight: number;
  /** Drawn width over drawn height — the thin-and-tall number. */
  aspect: number;
  totals: { arm: BandGaps; leg: BandGaps };
}

/** Fold a facing ring into the one row a report should carry. */
export function summariseFacings(all: readonly SpriteGaps[]): FacingSummary {
  const empty: BandGaps = {
    gapPixels: 0,
    longestSustainedRows: 0,
    maxWidth: 0,
    meanWidth: 0,
    rowsWithBothSides: 0,
    rowsWithGap: 0,
    rowsWithLeftGap: 0,
    rowsWithRightGap: 0,
  };
  const n = Math.max(1, all.length);
  const arm = all.reduce((acc, item) => addBands(acc, item.arm), empty);
  const leg = all.reduce((acc, item) => addBands(acc, item.leg), empty);
  const mean = (pick: (item: SpriteGaps) => number): number =>
    Number((all.reduce((sum, item) => sum + pick(item), 0) / n).toFixed(2));
  const meanWidth = mean((item) => item.width);
  const meanHeight = mean((item) => item.height);
  return {
    aspect: Number((meanWidth / Math.max(1, meanHeight)).toFixed(3)),
    facings: all.length,
    facingsWithBothArmGaps: all.filter((item) => item.arm.rowsWithBothSides > 0).length,
    facingsWithLegGap: all.filter((item) => item.leg.rowsWithGap > 0).length,
    maxArmGapWidth: arm.maxWidth,
    maxLegGapWidth: leg.maxWidth,
    meanArmRowsWithGap: Number((arm.rowsWithGap / n).toFixed(2)),
    meanContactRatio: mean((item) => item.contactRatio),
    meanContactSpan: mean((item) => item.contactSpan),
    meanHeight,
    meanLegRowsWithGap: Number((leg.rowsWithGap / n).toFixed(2)),
    meanWidth,
    totals: { arm, leg },
  };
}
