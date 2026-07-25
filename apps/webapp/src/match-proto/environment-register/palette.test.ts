import { describe, expect, it } from "vitest";

import {
  ALL_COLORS,
  FORBIDDEN_DEFAULTS,
  INK,
  bandOf,
  luma,
  ramps,
} from "./palette.ts";
import { renderBoardSvg, svgColors } from "./treatment-a-svg.ts";
import { renderBoardPixels } from "./treatment-b-pixel.ts";
import { surfaceColors } from "./pixel-canvas.ts";

describe("palette canon (#68)", () => {
  it("makes plum-black the deepest ink on the board", () => {
    const others = ALL_COLORS.filter((color) => color !== INK);
    for (const color of others) {
      expect(luma(color), `${color} must not be darker than the ink anchor`).toBeGreaterThan(luma(INK));
    }
  });

  it("keeps the default magenta and chartreuse out of assets", () => {
    for (const forbidden of FORBIDDEN_DEFAULTS) {
      expect(ALL_COLORS).not.toContain(forbidden);
    }
  });

  it("declares a budget band for every colour", () => {
    for (const color of ALL_COLORS) {
      expect(bandOf(color), color).toBeDefined();
    }
  });

  it("separates neighbouring material ramps in grayscale", () => {
    for (const ramp of Object.values(ramps)) {
      expect(luma(ramp.light) - luma(ramp.shadow)).toBeGreaterThan(12);
    }
  });
});

describe("both treatments stay on the same palette", () => {
  it("treatment A emits only palette colours", () => {
    const offPalette = [...new Set(svgColors(renderBoardSvg()))]
      .filter((color) => !ALL_COLORS.includes(color));
    expect(offPalette).toEqual([]);
  });

  it("treatment B emits only palette colours", () => {
    const offPalette = [...surfaceColors(renderBoardPixels())]
      .filter((color) => !ALL_COLORS.includes(color));
    expect(offPalette).toEqual([]);
  });
});
