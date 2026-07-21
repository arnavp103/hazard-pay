import { describe, expect, it } from "vitest";

import {
  bruiser,
  buildCharacterFrames,
  characters,
  frameToRgba,
  runner,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
} from "./sprites.ts";

const BYTES = SPRITE_WIDTH * SPRITE_HEIGHT * 4;

describe("character sprite specs", () => {
  it("ships exactly the two prototype fighters", () => {
    expect(characters).toEqual([runner, bruiser]);
    expect(characters.map((c) => c.name)).toEqual(["JAX-9", "NYX-4"]);
  });

  it.each(characters.map((c) => [c.name, c] as const))(
    "%s compiles every frame to a full RGBA buffer",
    (_name, spec) => {
      const frames = buildCharacterFrames(spec);
      expect(frames).toHaveLength(2);
      for (const frame of frames) {
        expect(frame).toBeInstanceOf(Uint8Array);
        expect(frame).toHaveLength(BYTES);
      }
    },
  );

  it.each(characters.map((c) => [c.name, c] as const))(
    "%s has a real idle flicker — frames differ",
    (_name, spec) => {
      const [a, b] = buildCharacterFrames(spec);
      expect(a).not.toEqual(b);
    },
  );

  it.each(characters.map((c) => [c.name, c] as const))(
    "%s uses binary alpha: transparent pixels zeroed, painted pixels opaque",
    (_name, spec) => {
      spec.frames.forEach((rows) => {
        const rgba = frameToRgba(rows, spec.palette);
        rows.forEach((row, y) => {
          [...row].forEach((ch, x) => {
            const i = (y * SPRITE_WIDTH + x) * 4;
            if (ch === ".") {
              expect(rgba.slice(i, i + 4)).toEqual(new Uint8Array([0, 0, 0, 0]));
            } else {
              expect(rgba[i + 3]).toBe(0xff);
            }
          });
        });
      });
    },
  );
});

describe("frameToRgba validation", () => {
  const palette = { x: "#ff2e6c" };
  const goodRow = "x".repeat(SPRITE_WIDTH);

  it("rejects a frame with the wrong row count", () => {
    expect(() => frameToRgba([goodRow], palette)).toThrow(/rows/);
  });

  it("rejects a row with the wrong width", () => {
    const rows = Array.from({ length: SPRITE_HEIGHT }, () => goodRow);
    rows[3] = "x";
    expect(() => frameToRgba(rows, palette)).toThrow(/row 3/);
  });

  it("rejects a pixel char missing from the palette", () => {
    const rows = Array.from({ length: SPRITE_HEIGHT }, () => goodRow);
    rows[5] = `?${"x".repeat(SPRITE_WIDTH - 1)}`;
    expect(() => frameToRgba(rows, palette)).toThrow(/no palette entry for "\?"/);
  });

  it("decodes palette hex into the pixel bytes", () => {
    const rows = Array.from({ length: SPRITE_HEIGHT }, () => goodRow);
    const rgba = frameToRgba(rows, palette);
    expect([rgba[0], rgba[1], rgba[2], rgba[3]]).toEqual([0xff, 0x2e, 0x6c, 0xff]);
  });
});
