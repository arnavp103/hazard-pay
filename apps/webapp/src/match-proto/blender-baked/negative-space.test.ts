import { describe, expect, it } from "vitest";

import { inkSprite } from "./bake/ink.ts";
import { interiorRuns, measureGaps, summariseFacings } from "./negative-space.ts";

const W = 12;
const H = 14;

/** `#` is figure, `.` is background. Colour is irrelevant here; alpha is not. */
function sprite(rows: readonly string[]): Uint8Array {
  const out = new Uint8Array(W * H * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== "#") { return; }
      const i = (y * W + x) * 4;
      out[i] = 0x4c;
      out[i + 1] = 0x57;
      out[i + 2] = 0x52;
      out[i + 3] = 0xff;
    });
  });
  return out;
}

function mask(rows: readonly string[]): Uint8Array {
  const out = new Uint8Array(W * H);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => { out[y * W + x] = ch === "#" ? 1 : 0; });
  });
  return out;
}

/** A figure with a 2 px window under each shoulder and a 2 px gap between legs. */
const OPEN = [
  "....####....",
  "....####....",
  "..########..",
  "..#..##..#..",
  "..#..##..#..",
  "..#..##..#..",
  "..#..##..#..",
  "..########..",
  "....####....",
  "...##..##...",
  "...##..##...",
  "...##..##...",
  "..###..###..",
  "..###..###..",
];

describe("interiorRuns", () => {
  it("finds background enclosed by the figure and ignores the outside world", () => {
    const runs = interiorRuns(mask(OPEN), W, 4);
    expect(runs).toEqual([{ width: 2, x: 3 }, { width: 2, x: 7 }]);
  });

  it("returns nothing for a solid row", () => {
    expect(interiorRuns(mask(OPEN), W, 2)).toEqual([]);
  });
});

describe("measureGaps", () => {
  it("separates the arm band from the leg band and counts both", () => {
    const stats = measureGaps(sprite(OPEN), W, H);
    // Rows 3-6 carry a window on each side of the torso.
    expect(stats.arm.rowsWithGap).toBe(4);
    expect(stats.arm.rowsWithBothSides).toBe(4);
    expect(stats.arm.maxWidth).toBe(2);
    expect(stats.arm.longestSustainedRows).toBe(4);
    // Rows 9-13 are the legs; the split lands at 0.6 of a 14-row figure.
    expect(stats.leg.rowsWithGap).toBe(5);
    expect(stats.leg.maxWidth).toBe(2);
  });

  it("measures the contact span the anti-float check is written in", () => {
    const stats = measureGaps(sprite(OPEN), W, H);
    expect(stats.contactSpan).toBe(8);
    expect(stats.contactRatio).toBeCloseTo(8 / 14, 3);
  });

  it("reports an empty cell without throwing", () => {
    const stats = measureGaps(new Uint8Array(W * H * 4), W, H);
    expect(stats.pixels).toBe(0);
    expect(stats.arm.rowsWithGap).toBe(0);
  });
});

/**
 * The finding this module exists to make checkable, as a unit test rather than
 * as a paragraph: the contour pass closes a gap from BOTH sides, so a gap needs
 * three background pixels in the render to leave one in the atlas. Every
 * negative-space number this round publishes is measured after this pass for
 * exactly this reason.
 */
describe("the contour pass against negative space", () => {
  const ids = new Uint8Array(W * H * 4);

  it("erases a 2 px window entirely", () => {
    const before = measureGaps(sprite(OPEN), W, H);
    expect(before.arm.rowsWithGap).toBe(4);
    const inked = inkSprite(sprite(OPEN), ids, W, H);
    expect(measureGaps(inked, W, H).arm.rowsWithGap).toBe(0);
  });

  it("leaves 1 px of a 4 px window", () => {
    const wide = [
      "...######...",
      "...######...",
      ".##########.",
      ".#....##....",
      ".#....##...#",
      ".#....##...#",
      ".#....##...#",
      ".##########.",
      "...######...",
      "..##....##..",
      "..##....##..",
      "..##....##..",
      ".###....###.",
      ".###....###.",
    ];
    const inked = inkSprite(sprite(wide), ids, W, H);
    const after = measureGaps(inked, W, H);
    expect(after.arm.maxWidth).toBe(2);
    expect(after.leg.maxWidth).toBe(2);
  });
});

describe("summariseFacings", () => {
  it("counts the facings a gap survives rather than reporting the best one", () => {
    const open = measureGaps(sprite(OPEN), W, H);
    const closed = measureGaps(sprite([
      "....####....",
      "....####....",
      "..########..",
      "..########..",
      "..########..",
      "..########..",
      "..########..",
      "..########..",
      "....####....",
      "...######...",
      "...######...",
      "...######...",
      "..########..",
      "..########..",
    ]), W, H);
    const summary = summariseFacings([open, closed, open, closed]);
    expect(summary.facings).toBe(4);
    expect(summary.facingsWithBothArmGaps).toBe(2);
    expect(summary.facingsWithLegGap).toBe(2);
    expect(summary.meanArmRowsWithGap).toBeCloseTo(2, 5);
    expect(summary.aspect).toBeCloseTo(8 / 14, 2);
  });
});
