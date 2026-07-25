import { describe, expect, it } from "vitest";

import { consolidate, islandStats } from "./consolidate.ts";

const W = 6;
const H = 6;

function build(rows: string[], palette: Record<string, [number, number, number]>): Uint8Array {
  const out = new Uint8Array(W * H * 4);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") { return; }
      const rgb = palette[ch];
      if (rgb === undefined) { throw new Error(`no palette entry for ${ch}`); }
      const i = (y * W + x) * 4;
      out[i] = rgb[0];
      out[i + 1] = rgb[1];
      out[i + 2] = rgb[2];
      out[i + 3] = 0xff;
    });
  });
  return out;
}

const PALETTE: Record<string, [number, number, number]> = {
  a: [0x4c, 0x57, 0x52],
  b: [0xc4, 0x60, 0x47],
  t: [0x2f, 0x9e, 0x96],
};

function colourAt(rgba: Uint8Array, x: number, y: number): string {
  const i = (y * W + x) * 4;
  return `${String(rgba[i])},${String(rgba[i + 1])},${String(rgba[i + 2])}`;
}

describe("islandStats", () => {
  it("counts flat-colour 4-connected regions among opaque pixels", () => {
    const pixels = build([
      "aaa...",
      "aaa...",
      "...b..",
      "......",
      "..b...",
      "......",
    ], PALETTE);
    const stats = islandStats(pixels, W, H);
    expect(stats.pixels).toBe(8);
    expect(stats.islands).toBe(3);
    expect(stats.ratio).toBeCloseTo(3 / 8, 6);
    expect(stats.singletonShare).toBeCloseTo(2 / 3, 6);
  });

  it("reports zero for an empty cell without dividing by zero", () => {
    expect(islandStats(new Uint8Array(W * H * 4), W, H)).toEqual({
      pixels: 0, islands: 0, ratio: 0, singletonShare: 0,
    });
  });

  it("does not join diagonally touching pixels into one island", () => {
    const pixels = build([
      "b.....",
      ".b....",
      "......",
      "......",
      "......",
      "......",
    ], PALETTE);
    expect(islandStats(pixels, W, H).islands).toBe(2);
  });
});

describe("consolidate", () => {
  it("absorbs a stranded single pixel into the mass around it", () => {
    const pixels = build([
      "aaaa..",
      "abaa..",
      "aaaa..",
      "......",
      "......",
      "......",
    ], PALETTE);
    expect(islandStats(pixels, W, H).islands).toBe(2);
    const rewritten = consolidate(pixels, W, H, 2);
    expect(rewritten).toBe(1);
    expect(colourAt(pixels, 1, 1)).toBe("76,87,82");
    expect(islandStats(pixels, W, H).islands).toBe(1);
  });

  it("leaves a cluster at or above the minimum size alone", () => {
    const pixels = build([
      "aaaa..",
      "abba..",
      "aaaa..",
      "......",
      "......",
      "......",
    ], PALETTE);
    const before = Uint8Array.from(pixels);
    expect(consolidate(pixels, W, H, 2)).toBe(0);
    expect(pixels).toStrictEqual(before);
  });

  it("never absorbs a scarce signal pixel — a 1px visor slit is deliberate", () => {
    const pixels = build([
      "aaaa..",
      "ataa..",
      "aaaa..",
      "......",
      "......",
      "......",
    ], PALETTE);
    expect(consolidate(pixels, W, H, 2)).toBe(0);
    expect(colourAt(pixels, 1, 1)).toBe("47,158,150");
  });

  it("does not grow the opaque area — it recolours, never fills", () => {
    const pixels = build([
      "aaaa..",
      "abaa..",
      "aaaa..",
      "......",
      "......",
      "......",
    ], PALETTE);
    const alphaBefore = islandStats(pixels, W, H).pixels;
    consolidate(pixels, W, H, 2);
    expect(islandStats(pixels, W, H).pixels).toBe(alphaBefore);
  });

  it("converges: a second run over its own output changes nothing", () => {
    const pixels = build([
      "abab..",
      "babа..".replace("а", "a"),
      "abab..",
      "bab...",
      "......",
      "......",
    ], PALETTE);
    consolidate(pixels, W, H, 2);
    const settled = Uint8Array.from(pixels);
    expect(consolidate(pixels, W, H, 2)).toBe(0);
    expect(pixels).toStrictEqual(settled);
  });

  it("drives the singleton share down on confetti, which is the whole point", () => {
    const pixels = build([
      "ababab",
      "bababa",
      "ababab",
      "bababa",
      "ababab",
      "bababa",
    ], PALETTE);
    const before = islandStats(pixels, W, H);
    consolidate(pixels, W, H, 2);
    const after = islandStats(pixels, W, H);
    expect(before.singletonShare).toBe(1);
    expect(after.islands).toBeLessThan(before.islands);
    expect(after.singletonShare).toBeLessThan(before.singletonShare);
  });
});
