import { describe, expect, it } from "vitest";

import { DIRECTION_B_PALETTE, hexToRgb, INK, paletteCoverage, quantizeToPalette } from "./palette.ts";

function makePixels(colors: [number, number, number, number][]): Uint8Array {
  const out = new Uint8Array(colors.length * 4);
  colors.forEach(([r, g, b, a], i) => {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  });
  return out;
}

describe("DIRECTION_B_PALETTE", () => {
  it("is anchored on the canon plum-black and has no duplicate entries", () => {
    expect(DIRECTION_B_PALETTE[0]?.hex).toBe(INK);
    const hexes = DIRECTION_B_PALETTE.map((entry) => entry.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
    const names = DIRECTION_B_PALETTE.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("carries no default magenta or chartreuse (#68 palette ruling)", () => {
    for (const entry of DIRECTION_B_PALETTE) {
      expect(entry.hex).not.toBe("#ff2e6c");
      expect(entry.hex).not.toBe("#c8f031");
    }
  });

  it("keeps the saturated end for the unit, not the world", () => {
    const saturation = (hex: string): number => {
      const [r, g, b] = hexToRgb(hex);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      return max === 0 ? 0 : (max - min) / max;
    };
    const worldPeak = Math.max(
      ...DIRECTION_B_PALETTE.filter((e) => e.role === "world").map((e) => saturation(e.hex)),
    );
    const unitPeak = Math.max(
      ...DIRECTION_B_PALETTE.filter((e) => e.role !== "world").map((e) => saturation(e.hex)),
    );
    expect(unitPeak).toBeGreaterThan(worldPeak);
  });
});

describe("quantizeToPalette", () => {
  it("maps every opaque pixel onto a palette entry and nothing else", () => {
    const allowed = new Set(DIRECTION_B_PALETTE.map((entry) => entry.hex));
    const pixels = makePixels([
      [0x3f, 0x4b, 0x49, 0xff],
      [0xa6, 0x53, 0x3f, 0xff],
      [0x8b, 0x8f, 0x99, 0xff],
      [0x2f, 0x9e, 0x96, 0xff],
      [0x01, 0x02, 0x03, 0xff],
      [0xff, 0xff, 0xff, 0xff],
    ]);
    quantizeToPalette(pixels, 6, 1);
    for (let i = 0; i < pixels.length; i += 4) {
      const hex = `#${(((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0))
        .toString(16).padStart(6, "0")}`;
      expect(allowed.has(hex)).toBe(true);
    }
  });

  it("forces binary alpha and zeroes the colour of cut-out pixels", () => {
    const pixels = makePixels([
      [0x80, 0x80, 0x80, 0x00],
      [0x80, 0x80, 0x80, 0x7f],
      [0x80, 0x80, 0x80, 0x80],
      [0x80, 0x80, 0x80, 0xff],
    ]);
    quantizeToPalette(pixels, 4, 1);
    expect([...pixels.slice(0, 4)]).toEqual([0, 0, 0, 0]);
    expect([...pixels.slice(4, 8)]).toEqual([0, 0, 0, 0]);
    expect(pixels[11]).toBe(0xff);
    expect(pixels[15]).toBe(0xff);
  });

  it("keeps the identity ramps apart instead of collapsing them", () => {
    // Rust livery's three cel bands must land on three different tokens, or
    // the unit loses its material read the moment it is quantized.
    const pixels = makePixels([
      [0x7e, 0x38, 0x2f, 0xff],
      [0xc4, 0x60, 0x47, 0xff],
      [0xfc, 0x7c, 0x5a, 0xff],
    ]);
    quantizeToPalette(pixels, 3, 1);
    expect(paletteCoverage(pixels).size).toBe(3);
  });

  it("is idempotent — quantizing an already-quantized buffer changes nothing", () => {
    const pixels = makePixels([
      [0x3f, 0x4b, 0x49, 0xff],
      [0xa6, 0x53, 0x3f, 0xff],
      [0x11, 0x22, 0x33, 0xff],
    ]);
    quantizeToPalette(pixels, 3, 1);
    const once = Uint8Array.from(pixels);
    quantizeToPalette(pixels, 3, 1);
    expect(pixels).toStrictEqual(once);
  });
});

describe("paletteCoverage", () => {
  it("ignores transparent pixels", () => {
    const pixels = makePixels([[0x12, 0x0b, 0x10, 0x00], [0x2f, 0x9e, 0x96, 0xff]]);
    expect([...paletteCoverage(pixels)]).toEqual(["signal-2"]);
  });
});
