import { describe, expect, it } from "vitest";

import { type PackItem, packBest, packShelves } from "./pack.ts";

function grid(count: number): PackItem[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `cell_${String(i).padStart(3, "0")}`,
    width: 10 + (i % 7),
    height: 12 + (i % 5),
  }));
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("packShelves", () => {
  it("places every item without overlap and inside the sheet", () => {
    const result = packShelves(grid(64), 128);
    expect(result.placements).toHaveLength(64);
    for (const placement of result.placements) {
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.y).toBeGreaterThanOrEqual(0);
      expect(placement.x + placement.width).toBeLessThanOrEqual(result.width);
      expect(placement.y + placement.height).toBeLessThanOrEqual(result.height);
    }
    for (let i = 0; i < result.placements.length; i += 1) {
      for (let j = i + 1; j < result.placements.length; j += 1) {
        const a = result.placements[i];
        const b = result.placements[j];
        if (a === undefined || b === undefined) { continue; }
        expect(overlaps(a, b)).toBe(false);
      }
    }
  });

  it("is deterministic regardless of input order — the atlas is committed", () => {
    const items = grid(40);
    const forward = packShelves(items, 128);
    const shuffled = packShelves([...items].reverse(), 128);
    expect(shuffled).toStrictEqual(forward);
  });

  it("refuses an item wider than the sheet instead of silently clipping it", () => {
    expect(() => packShelves([{ name: "wide", width: 200, height: 4 }], 128)).toThrow(/wider/);
  });

  it("keeps a transparent gutter between neighbours", () => {
    const result = packShelves(
      [{ name: "a", width: 8, height: 8 }, { name: "b", width: 8, height: 8 }],
      64,
    );
    const [a, b] = result.placements;
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(Math.abs((b?.x ?? 0) - (a?.x ?? 0))).toBeGreaterThan(8);
  });
});

describe("packBest", () => {
  it("picks the candidate width with the smallest total area", () => {
    const items = grid(100);
    const best = packBest(items, [64, 128, 256, 512]);
    for (const width of [64, 128, 256, 512]) {
      const widest = items.reduce((max, item) => Math.max(max, item.width), 0);
      if (width < widest + 2) { continue; }
      const candidate = packShelves(items, width);
      expect(best.width * best.height).toBeLessThanOrEqual(candidate.width * candidate.height);
    }
  });

  it("reports occupancy as sprite area over sheet area", () => {
    const items = grid(50);
    const result = packBest(items, [128, 256]);
    const area = items.reduce((sum, item) => sum + item.width * item.height, 0);
    expect(result.occupancy).toBeCloseTo(area / (result.width * result.height), 10);
    expect(result.occupancy).toBeGreaterThan(0.5);
    expect(result.occupancy).toBeLessThanOrEqual(1);
  });
});
