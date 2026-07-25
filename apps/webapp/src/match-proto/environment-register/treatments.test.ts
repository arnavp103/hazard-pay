import { describe, expect, it } from "vitest";

import { BOARD_HEIGHT, BOARD_WIDTH } from "./board-model.ts";
import { INK } from "./palette.ts";
import { INK_OUTER, renderBoardSvg, svgDataUrl } from "./treatment-a-svg.ts";
import { authoredCells, stampPalette, stamps } from "./pixel-stamps.ts";
import { buildDepthIndex, composeUnits } from "./compose.ts";
import { measureBands, measureSpread, measureZones } from "./budget.ts";
import { renderBoardPixels, renderPropSwatch } from "./treatment-b-pixel.ts";

function composed() {
  const surface = renderBoardPixels();
  const result = composeUnits(surface, { index: buildDepthIndex() });
  return { result, surface };
}

describe("treatment A — SVG comic-book", () => {
  const markup = renderBoardSvg();

  it("emits one well-formed document at board resolution", () => {
    expect(markup.startsWith("<svg")).toBe(true);
    expect(markup.endsWith("</svg>")).toBe(true);
    expect(markup).toContain(`viewBox="0 0 ${String(BOARD_WIDTH)} ${String(BOARD_HEIGHT)}"`);
  });

  it("carries the register's two-pass ink, re-weighted for the 28px tile", () => {
    expect(markup).toContain(`stroke-width="${String(INK_OUTER)}"`);
    expect(markup).toContain(`stroke="${INK}"`);
    expect(markup).toContain("stroke-linejoin=\"bevel\"");
    expect(INK_OUTER).toBeLessThan(4);
  });

  it("uses flat fills only — no gradients anywhere", () => {
    expect(markup).not.toContain("linearGradient");
    expect(markup).not.toContain("radialGradient");
    expect(markup).not.toContain("filter=");
  });

  it("draws the canopy shadow as a shape rather than leaving it implied", () => {
    expect(markup).toContain("hp-mesh");
    expect(markup.length).toBeGreaterThan(20_000);
  });

  it("is deterministic and rasterizable from a data URL", () => {
    expect(renderBoardSvg()).toBe(markup);
    expect(svgDataUrl(markup).startsWith("data:image/svg+xml")).toBe(true);
  });

  it("changes between ambient frames", () => {
    expect(renderBoardSvg({ frame: 2 })).not.toBe(markup);
  });
});

describe("treatment B — MST-register pixel", () => {
  const surface = renderBoardPixels();

  it("covers the whole board with opaque pixels", () => {
    let transparent = 0;
    for (let at = 3; at < surface.data.length; at += 4) {
      if ((surface.data[at] ?? 0) === 0) { transparent += 1; }
    }
    expect(transparent).toBe(0);
  });

  it("is deterministic", () => {
    expect([...renderBoardPixels().data]).toEqual([...surface.data]);
  });

  it("separates the generated detail layer from the authored stamp layer", () => {
    const flat = renderBoardPixels({ detail: false, stamps: false });
    const generated = renderBoardPixels({ detail: true, stamps: false });
    const authored = renderBoardPixels({ detail: true, stamps: true });

    const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
      let changed = 0;
      for (let at = 0; at < a.length; at += 4) {
        if (a[at] !== b[at] || a[at + 1] !== b[at + 1] || a[at + 2] !== b[at + 2]) { changed += 1; }
      }
      return changed;
    };

    expect(diff(flat.data, generated.data)).toBeGreaterThan(10_000);
    expect(diff(generated.data, authored.data)).toBeGreaterThan(200);
    expect(diff(generated.data, authored.data)).toBeLessThan(diff(flat.data, generated.data));
  });

  it("renders a prop swatch for the authored-vs-generated exhibit", () => {
    const withStamps = renderPropSwatch("stall-nw", { stamps: true });
    const without = renderPropSwatch("stall-nw", { stamps: false });
    expect(withStamps.width).toBe(without.width);
    expect([...withStamps.data]).not.toEqual([...without.data]);
  });
});

describe("authored stamps", () => {
  it("uses only palette characters", () => {
    for (const stamp of stamps) {
      for (const row of stamp.rows) {
        expect(row.length, `${stamp.name} row width`).toBe(stamp.width);
        for (const char of row) {
          if (char === ".") { continue; }
          expect(stampPalette[char], `${stamp.name}: unknown char "${char}"`).toBeDefined();
        }
      }
    }
  });

  it("reports its authored cell count for the cost report", () => {
    expect(authoredCells()).toBeGreaterThan(200);
  });

  it("fits the 28px tile — nothing is tiled to fake a size any more", () => {
    for (const stamp of stamps) {
      expect(stamp.width, stamp.name).toBeLessThanOrEqual(16);
      expect(stamp.rows.length, stamp.name).toBeLessThanOrEqual(14);
    }
  });
});

describe("readability budget", () => {
  const { result, surface } = composed();

  it("stays inside the declared palette", () => {
    expect(measureBands(surface).offPalette).toBe(0);
  });

  it("holds emission to the 5% slice", () => {
    expect(measureBands(surface).emission).toBeLessThan(0.05);
  });

  it("moves identity well off round 1's 6.2%", () => {
    // Round 1: body 93.1 / identity 6.2 / emission 0.48 against a canon
    // 70/25/5. Round 2 dresses the board in identity-band cover instead of
    // re-banding its way there, so the number moves for a visible reason.
    const bands = measureBands(surface);
    expect(bands.identity).toBeGreaterThan(0.14);
    expect(bands.body).toBeLessThan(0.86);
  });

  it("spreads the frame across more than one value zone", () => {
    const zones = measureZones(surface);
    // The failure round 1 actually had: one zone owning the whole picture.
    expect(Math.max(zones.backdrop, zones.dressing, zones.ground)).toBeLessThan(0.75);
    expect(zones.dressing).toBeGreaterThan(0.15);
    expect(zones.unit).toBeGreaterThan(0.005);
  });

  it("uses a real chunk of the value range", () => {
    const spread = measureSpread(surface);
    expect(spread.span).toBeGreaterThan(45);
    expect(spread.iqr).toBeGreaterThan(12);
    expect(spread.occupiedBuckets).toBeGreaterThanOrEqual(5);
  });

  it("measures its OWN figure/ground dissolve rate", () => {
    // Not inherited from either sibling lane: this is the share of unit
    // silhouette edges that needed ink or a rim light against this board.
    expect(result.edgesTotal).toBeGreaterThan(500);
    const rate = result.edgesDissolving / result.edgesTotal;
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(0.75);
  });
});
