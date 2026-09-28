import { describe, expect, it } from "vitest";
import { CHAPTERS, DURATION, chapterAt, unitsAt } from "./scene.ts";
describe("Emberwatch recording", () => {
  it("can seek backwards and reproduce the exact battle state", () => {
    const before = unitsAt(12.7);
    unitsAt(35);
    expect(unitsAt(12.7)).toEqual(before);
    expect(before).toHaveLength(47);
    expect(new Set(before.map((unit) => unit.id)).size).toBe(47);
  });
  it("reserves separate depth lanes and a visible artillery rear line", () => {
    const units = unitsAt(7.5);
    for (const [min, max] of [[160, 180], [210, 230], [260, 280]]) {
      const lane = units.filter((u) => u.id < 46 && u.y >= min! && u.y <= max!);
      expect(lane.some((u) => u.kind === 1)).toBe(true);
      expect(lane.some((u) => u.kind === 4)).toBe(true);
    }
    expect(Math.max(...units.filter((u) => u.kind === 2).map((u) => u.x))).toBeLessThan(240);
  });
  it("gives Hammerfall a windup, airborne travel, landing and multi-unit reaction", () => {
    const hero = (t: number) => unitsAt(t).find((u) => u.id === 46)!;
    expect(hero(17.5).pose).toBe("strike");
    expect(hero(19).pose).toBe("charge");
    expect(hero(19).y).toBeLessThan(190);
    expect(hero(20.3).pose).toBe("strike");
    expect(hero(20.3).y).toBeGreaterThan(250);
    expect(unitsAt(20.5).filter((u) => u.kind >= 4 && u.pose === "stagger").length).toBeGreaterThan(8);
  });
  it("preserves casualties and completes with a settled living crew", () => {
    const casualties = unitsAt(29).filter((u) => u.dead);
    expect(casualties.length).toBeGreaterThan(10);
    expect(unitsAt(DURATION).filter((u) => u.dead).length).toBeGreaterThanOrEqual(casualties.length);
    expect(unitsAt(DURATION).filter((u) => !u.dead).every((u) => u.pose === "idle")).toBe(true);
    expect(chapterAt(DURATION)).toBe(CHAPTERS[5]);
  });
});
