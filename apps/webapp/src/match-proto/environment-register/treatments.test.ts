import { describe, expect, it } from "vitest";

import { BOARD_HEIGHT, BOARD_WIDTH } from "./board-model.ts";
import { INK, bandOf } from "./palette.ts";
import { INK_OUTER, renderBoardSvg, svgDataUrl } from "./treatment-a-svg.ts";
import { renderBoardPixels, renderPropSwatch } from "./treatment-b-pixel.ts";
import { surfaceHistogram } from "./pixel-canvas.ts";
import { authoredCells, stampPalette, stamps } from "./pixel-stamps.ts";

describe("treatment A — SVG comic-book", () => {
  const markup = renderBoardSvg();

  it("emits one well-formed document at board resolution", () => {
    expect(markup.startsWith("<svg")).toBe(true);
    expect(markup.endsWith("</svg>")).toBe(true);
    expect(markup).toContain(`viewBox="0 0 ${String(BOARD_WIDTH)} ${String(BOARD_HEIGHT)}"`);
  });

  it("carries the register's two-pass ink", () => {
    expect(markup).toContain(`stroke-width="${String(INK_OUTER)}"`);
    expect(markup).toContain(`stroke="${INK}"`);
    expect(markup).toContain("stroke-linejoin=\"bevel\"");
  });

  it("uses flat fills only — no gradients anywhere", () => {
    expect(markup).not.toContain("linearGradient");
    expect(markup).not.toContain("radialGradient");
    expect(markup).not.toContain("filter=");
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

  it("respects the 70/25/5 value-saturation budget", () => {
    const histogram = surfaceHistogram(surface);
    const total = [...histogram.values()].reduce((sum, count) => sum + count, 0);
    const spend = { body: 0, emission: 0, identity: 0 };
    for (const [color, count] of histogram) {
      const band = bandOf(color);
      if (band === undefined) { continue; }
      spend[band] += count;
    }
    expect(spend.emission / total).toBeLessThan(0.05);
    expect(spend.body / total).toBeGreaterThan(0.6);
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

    // The generated passes touch most of the board; the authored stamps
    // touch a few thousand pixels. That ratio is the lane's finding.
    expect(diff(flat.data, generated.data)).toBeGreaterThan(20_000);
    expect(diff(generated.data, authored.data)).toBeGreaterThan(500);
    expect(diff(generated.data, authored.data)).toBeLessThan(diff(flat.data, generated.data));
  });

  it("renders a prop swatch for the authored-vs-generated exhibit", () => {
    const withStamps = renderPropSwatch("stall-ne-1", { stamps: true });
    const without = renderPropSwatch("stall-ne-1", { stamps: false });
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
    expect(authoredCells()).toBeGreaterThan(500);
  });
});
