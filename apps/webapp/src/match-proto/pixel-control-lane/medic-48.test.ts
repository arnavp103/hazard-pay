import { describe, expect, it } from "vitest";

import {
  MEDIC_HEIGHT,
  MEDIC_WIDTH,
  medicBack,
  medicFront,
  medicFrameToRgba,
  medicPalette,
  medicSide,
  validateGrid,
} from "./medic-48.ts";

const BYTES = MEDIC_WIDTH * MEDIC_HEIGHT * 4;
const facings = [
  ["side", medicSide],
  ["front", medicFront],
  ["back", medicBack],
] as const;

describe("medic base facings", () => {
  it.each(facings)("%s is a well-formed 48×64 grid", (name, grid) => {
    expect(validateGrid(grid, name)).toEqual([]);
    expect(grid).toHaveLength(MEDIC_HEIGHT);
    for (const row of grid) { expect(row).toHaveLength(MEDIC_WIDTH); }
  });

  it.each(facings)("%s uses only palette chars", (_name, grid) => {
    for (const row of grid) {
      for (const ch of row) {
        if (ch !== ".") { expect(medicPalette[ch]).toBeDefined(); }
      }
    }
  });

  it.each(facings)("%s carries the rust medic identity + teal emission", (_name, grid) => {
    const flat = grid.join("");
    expect(flat).toContain("l"); // rust livery
    expect(flat).toContain("t"); // teal emission
  });

  it.each(facings)("%s stands stockier — feet reach the canvas floor", (_name, grid) => {
    // round-2 proportions: the sole ink sits on the bottom rows, not floating high
    const lastInk = grid.findLastIndex((row) => row.includes("k"));
    expect(lastInk).toBeGreaterThanOrEqual(MEDIC_HEIGHT - 5);
  });
});

describe("medicFrameToRgba", () => {
  it.each(facings)("%s compiles to a full RGBA buffer with binary alpha", (_name, grid) => {
    const rgba = medicFrameToRgba(grid);
    expect(rgba).toBeInstanceOf(Uint8Array);
    expect(rgba).toHaveLength(BYTES);
    grid.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const i = (y * MEDIC_WIDTH + x) * 4;
        if (ch === ".") {
          expect(rgba.slice(i, i + 4)).toEqual(new Uint8Array([0, 0, 0, 0]));
        } else {
          expect(rgba[i + 3]).toBe(0xff);
        }
      });
    });
  });

  it("throws on a malformed grid", () => {
    expect(() => medicFrameToRgba(["short"])).toThrow();
  });
});

describe("validateGrid", () => {
  const good = Array.from({ length: MEDIC_HEIGHT }, () => ".".repeat(MEDIC_WIDTH));

  it("passes a clean grid", () => {
    expect(validateGrid(good, "clean")).toEqual([]);
  });

  it("reports wrong row count", () => {
    expect(validateGrid(good.slice(1), "x").join(" ")).toMatch(/expected 64 rows/);
  });

  it("reports wrong width and unknown chars", () => {
    const bad = good.slice();
    bad[2] = `?${".".repeat(MEDIC_WIDTH)}`;
    const problems = validateGrid(bad, "x").join(" ");
    expect(problems).toMatch(/row 2/);
    expect(problems).toMatch(/unknown char/);
  });
});
