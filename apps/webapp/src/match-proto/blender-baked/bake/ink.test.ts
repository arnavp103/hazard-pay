import { describe, expect, it } from "vitest";

import { hexToRgb, INK } from "../palette.ts";
import { alphaBounds, inkSprite } from "./ink.ts";

const W = 8;
const H = 8;

function blank(): { color: Uint8Array; ids: Uint8Array } {
  return { color: new Uint8Array(W * H * 4), ids: new Uint8Array(W * H * 4) };
}

function put(buf: Uint8Array, x: number, y: number, hex: string, id = 1): void {
  const [r, g, b] = hexToRgb(hex);
  const i = (y * W + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = 0xff;
  void id;
}

function putId(buf: Uint8Array, x: number, y: number, id: number): void {
  const i = (y * W + x) * 4;
  buf[i] = id;
  buf[i + 3] = 0xff;
}

function at(buf: Uint8Array, x: number, y: number): string {
  const i = (y * W + x) * 4;
  const value = ((buf[i] ?? 0) << 16) | ((buf[i + 1] ?? 0) << 8) | (buf[i + 2] ?? 0);
  return `#${value.toString(16).padStart(6, "0")}`;
}

describe("inkSprite contour", () => {
  it("grows the contour OUTWARD so it never eats the sprite's own pixels", () => {
    const { color, ids } = blank();
    put(color, 3, 3, "#4c5752");
    putId(ids, 3, 3, 1);

    const out = inkSprite(color, ids, W, H, { contour: true, internalLumaGap: 0, internalMode: "ink" });

    expect(at(out, 3, 3)).toBe("#4c5752");
    for (const [x, y] of [[2, 3], [4, 3], [3, 2], [3, 4]] as const) {
      expect(at(out, x, y)).toBe(INK);
      expect(out[(y * W + x) * 4 + 3]).toBe(0xff);
    }
    // Diagonals stay clear: a 4-neighbour contour, not an 8-neighbour blob.
    expect(out[(2 * W + 2) * 4 + 3]).toBe(0);
  });

  it("leaves the buffer alone when the contour is disabled", () => {
    const { color, ids } = blank();
    put(color, 3, 3, "#4c5752");
    putId(ids, 3, 3, 1);
    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 0, internalMode: "ink" });
    expect(out).toStrictEqual(color);
  });
});

describe("inkSprite internal seams", () => {
  it("inks a seam between two different parts that share a value", () => {
    const { color, ids } = blank();
    put(color, 2, 2, "#4c5752");
    put(color, 3, 2, "#4c5752");
    putId(ids, 2, 2, 1);
    putId(ids, 3, 2, 2);

    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 6, internalMode: "ink" });
    const inked = [at(out, 2, 2), at(out, 3, 2)].filter((hex) => hex === INK);
    expect(inked).toHaveLength(1);
  });

  it("leaves a seam alone when the cel bands already separate the forms", () => {
    const { color, ids } = blank();
    put(color, 2, 2, "#17131b");
    put(color, 3, 2, "#d4d2d3");
    putId(ids, 2, 2, 1);
    putId(ids, 3, 2, 2);

    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 6, internalMode: "ink" });
    expect(at(out, 2, 2)).toBe("#17131b");
    expect(at(out, 3, 2)).toBe("#d4d2d3");
  });

  it("never overwrites a scarce signal pixel", () => {
    const { color, ids } = blank();
    put(color, 2, 2, "#2f9e96");
    put(color, 3, 2, "#2f9e96");
    putId(ids, 2, 2, 1);
    putId(ids, 3, 2, 2);

    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 6, internalMode: "ink" });
    expect(at(out, 2, 2)).toBe("#2f9e96");
    expect(at(out, 3, 2)).toBe("#2f9e96");
  });

  it("does not seam two touching pixels of the SAME part", () => {
    const { color, ids } = blank();
    put(color, 2, 2, "#4c5752");
    put(color, 3, 2, "#4c5752");
    putId(ids, 2, 2, 7);
    putId(ids, 3, 2, 7);

    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 6, internalMode: "ink" });
    expect(at(out, 2, 2)).toBe("#4c5752");
    expect(at(out, 3, 2)).toBe("#4c5752");
  });
});

describe("alphaBounds", () => {
  it("returns the tight opaque box", () => {
    const { color } = blank();
    put(color, 2, 3, "#4c5752");
    put(color, 5, 6, "#4c5752");
    expect(alphaBounds(color, W, H)).toEqual({ x: 2, y: 3, width: 4, height: 4 });
  });

  it("returns null for an empty cell rather than a zero-size box", () => {
    expect(alphaBounds(new Uint8Array(W * H * 4), W, H)).toBeNull();
  });
});
