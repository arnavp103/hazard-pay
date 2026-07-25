import { describe, expect, it } from "vitest";

import { consolidate } from "../consolidate.ts";
import { hexToRgb, INK, LIVERY_HEXES } from "../palette.ts";
import { alphaBounds, CROWD_INK, inkSprite, RIM_HEX, SCREEN_KEY } from "./ink.ts";

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
  it("grows a CLOSED contour outward, never eating the sprite's own pixels", () => {
    const { color, ids } = blank();
    put(color, 3, 3, "#4c5752");
    putId(ids, 3, 3, 1);

    const out = inkSprite(color, ids, W, H, { contour: true, internalLumaGap: 0, internalMode: "ink", protect: [], rim: null });

    expect(at(out, 3, 3)).toBe("#4c5752");
    for (const [x, y] of [[2, 3], [4, 3], [3, 2], [3, 4]] as const) {
      expect(at(out, x, y)).toBe(INK);
      expect(out[(y * W + x) * 4 + 3]).toBe(0xff);
    }
    // Diagonals are inked too. A 4-neighbour contour breaks at every diagonal
    // step of a silhouette, leaving a chain of orphan pixels instead of one
    // closed line; the closed ring is what keeps a 31-px figure a figure.
    expect(at(out, 2, 2)).toBe(INK);
    expect(at(out, 4, 4)).toBe(INK);
    // …and nothing two cells away is touched.
    expect(out[(1 * W + 1) * 4 + 3]).toBe(0);
  });

  it("leaves the buffer alone when the contour is disabled", () => {
    const { color, ids } = blank();
    put(color, 3, 3, "#4c5752");
    putId(ids, 3, 3, 1);
    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 0, internalMode: "ink", protect: [], rim: null });
    expect(out).toStrictEqual(color);
  });
});

describe("inkSprite rim", () => {
  it("splits the contour by which side of the figure the key is on", () => {
    const { color, ids } = blank();
    put(color, 3, 3, "#4c5752");
    putId(ids, 3, 3, 1);

    const out = inkSprite(color, ids, W, H, CROWD_INK);

    // The key arrives up and to the right, so the up and right contour keeps
    // the plum-black and the down and left contour is lifted one value.
    expect(at(out, 3, 2)).toBe(INK);
    expect(at(out, 4, 3)).toBe(INK);
    expect(at(out, 3, 4)).toBe(RIM_HEX);
    expect(at(out, 2, 3)).toBe(RIM_HEX);
    // The sprite's own pixel is never touched, rim or no rim.
    expect(at(out, 3, 3)).toBe("#4c5752");
  });

  it("keeps every contour pixel opaque, so the silhouette stays closed", () => {
    const { color, ids } = blank();
    put(color, 3, 3, "#4c5752");
    put(color, 4, 3, "#4c5752");
    putId(ids, 3, 3, 1);
    putId(ids, 4, 3, 1);

    const out = inkSprite(color, ids, W, H, CROWD_INK);
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 5; x += 1) {
        expect(out[(y * W + x) * 4 + 3]).toBe(0xff);
      }
    }
  });

  it("points the key up and to the right, which is where Blender puts it", () => {
    expect(SCREEN_KEY[0]).toBeGreaterThan(0);
    expect(SCREEN_KEY[1]).toBeLessThan(0);
  });
});

describe("inkSprite internal seams", () => {
  it("inks a seam between two different parts that share a value", () => {
    const { color, ids } = blank();
    put(color, 2, 2, "#4c5752");
    put(color, 3, 2, "#4c5752");
    putId(ids, 2, 2, 1);
    putId(ids, 3, 2, 2);

    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 6, internalMode: "ink", protect: [], rim: null });
    const inked = [at(out, 2, 2), at(out, 3, 2)].filter((hex) => hex === INK);
    expect(inked).toHaveLength(1);
  });

  it("leaves a seam alone when the cel bands already separate the forms", () => {
    const { color, ids } = blank();
    put(color, 2, 2, "#17131b");
    put(color, 3, 2, "#d4d2d3");
    putId(ids, 2, 2, 1);
    putId(ids, 3, 2, 2);

    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 6, internalMode: "ink", protect: [], rim: null });
    expect(at(out, 2, 2)).toBe("#17131b");
    expect(at(out, 3, 2)).toBe("#d4d2d3");
  });

  it("never overwrites a scarce signal pixel", () => {
    const { color, ids } = blank();
    put(color, 2, 2, "#2f9e96");
    put(color, 3, 2, "#2f9e96");
    putId(ids, 2, 2, 1);
    putId(ids, 3, 2, 2);

    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 6, internalMode: "ink", protect: [], rim: null });
    expect(at(out, 2, 2)).toBe("#2f9e96");
    expect(at(out, 3, 2)).toBe("#2f9e96");
  });

  it("does not seam two touching pixels of the SAME part", () => {
    const { color, ids } = blank();
    put(color, 2, 2, "#4c5752");
    put(color, 3, 2, "#4c5752");
    putId(ids, 2, 2, 7);
    putId(ids, 3, 2, 7);

    const out = inkSprite(color, ids, W, H, { contour: false, internalLumaGap: 6, internalMode: "ink", protect: [], rim: null });
    expect(at(out, 2, 2)).toBe("#4c5752");
    expect(at(out, 3, 2)).toBe("#4c5752");
  });
});

describe("consolidation protection", () => {
  it("keeps a two-pixel livery mark that consolidation would otherwise absorb", () => {
    // The shared `at` reader indexes at W, so this case is built on W too.
    const width = W;
    const height = H;
    const buf = new Uint8Array(width * height * 4);
    const paint = (x: number, y: number, hex: string): void => {
      const [r, g, b] = hexToRgb(hex);
      const i = (y * width + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 0xff;
    };
    for (let y = 1; y < 5; y += 1) {
      for (let x = 1; x < 5; x += 1) { paint(x, y, "#4c5752"); }
    }
    // One lone livery pixel in the middle of a cloth mass: exactly the case a
    // 22 px fodder torso produces, and exactly what an unprotected consolidate
    // deletes.
    paint(2, 2, "#7e382f");
    const control = new Uint8Array(buf);
    consolidate(control, width, height, 2);
    expect(at(control, 2, 2)).not.toBe("#7e382f");

    const kept = new Uint8Array(buf);
    consolidate(kept, width, height, 2, 4, [0x7e382f]);
    expect(at(kept, 2, 2)).toBe("#7e382f");
  });

  it("lists the livery colours the crowd ink protects", () => {
    expect(CROWD_INK.protect).toContain(RIM_HEX);
    for (const hex of LIVERY_HEXES) { expect(CROWD_INK.protect).toContain(hex); }
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
