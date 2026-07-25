import { describe, expect, it } from "vitest";

import {
  BOARD_COLORS,
  FORBIDDEN_DEFAULTS,
  INK,
  bandOf,
  luma,
  ramps,
  shadeStep,
  zoneOf,
} from "./palette.ts";
import { UNIT_COLORS } from "./unit-sprites.ts";
import { buildDepthIndex, composeUnits } from "./compose.ts";
import { renderBoardPixels } from "./treatment-b-pixel.ts";
import { renderBoardSvg, svgColors } from "./treatment-a-svg.ts";
import { surfaceColors } from "./pixel-canvas.ts";

const allowed = new Set([...BOARD_COLORS, ...UNIT_COLORS].map((color) => color.toLowerCase()));

describe("palette canon (#68)", () => {
  it("bans the default magenta and chartreuse", () => {
    for (const banned of FORBIDDEN_DEFAULTS) {
      expect(allowed.has(banned)).toBe(false);
    }
  });

  it("makes plum-black the darkest colour on the board", () => {
    const darkest = [...BOARD_COLORS].sort((a, b) => luma(a) - luma(b))[0];
    expect(darkest).toBe(INK);
  });

  it("bands and zones every board colour", () => {
    for (const color of BOARD_COLORS) {
      expect(bandOf(color), color).toBeDefined();
      expect(zoneOf(color), color).toBeDefined();
    }
  });

  it("steps every ramp colour down its own ramp, never off-palette", () => {
    for (const ramp of Object.values(ramps)) {
      expect(allowed.has(shadeStep(ramp.light))).toBe(true);
      expect(allowed.has(shadeStep(ramp.base))).toBe(true);
      expect(shadeStep(ramp.light)).toBe(ramp.base);
      expect(shadeStep(ramp.base)).toBe(ramp.shadow);
    }
  });
});

describe("declared value zones — the readability repair", () => {
  const zoneRange = (zone: string) => {
    const values = BOARD_COLORS.filter((color) => zoneOf(color) === zone).map(luma);
    return { hi: Math.max(...values), lo: Math.min(...values) };
  };

  it("keeps the walkable plane the quietest band on the board", () => {
    const ground = zoneRange("ground");
    const dressing = zoneRange("dressing");
    // Round 1 put ground and dressing inside one value band, which is why the
    // whole frame read as a single grey. Dressing has to reach higher.
    expect(dressing.hi).toBeGreaterThan(ground.hi + 20);
    expect(ground.hi - ground.lo).toBeLessThan(dressing.hi - dressing.lo);
  });

  it("lets units own both extremes", () => {
    const unitValues = UNIT_COLORS.map(luma);
    const boardMax = Math.max(...BOARD_COLORS.filter((color) => zoneOf(color) !== "unit").map(luma));
    // The one board colour allowed above the unit ceiling is emission, which is
    // a handful of pixels by construction.
    const brightestUnit = Math.max(...unitValues);
    const brightestMaterial = Math.max(
      ...BOARD_COLORS.filter((color) => bandOf(color) !== "emission").map(luma),
    );
    expect(brightestUnit).toBeGreaterThan(brightestMaterial);
    expect(boardMax).toBeGreaterThan(0);
    expect(Math.min(...unitValues)).toBeLessThanOrEqual(luma(INK) + 1);
  });

  it("keeps neighbouring materials apart in grayscale", () => {
    for (const [name, ramp] of Object.entries(ramps)) {
      expect(luma(ramp.light) - luma(ramp.shadow), name).toBeGreaterThan(12);
    }
  });
});

describe("palette conformance", () => {
  it("treatment A emits only declared colours", () => {
    for (const color of svgColors(renderBoardSvg())) {
      expect(allowed.has(color), color).toBe(true);
    }
  });

  it("treatment B emits only declared colours", () => {
    for (const color of surfaceColors(renderBoardPixels())) {
      expect(allowed.has(color.toLowerCase()), color).toBe(true);
    }
  });

  it("stays inside the palette once units are composited", () => {
    const surface = renderBoardPixels();
    composeUnits(surface, { index: buildDepthIndex() });
    for (const color of surfaceColors(surface)) {
      expect(allowed.has(color.toLowerCase()), color).toBe(true);
    }
  });
});
