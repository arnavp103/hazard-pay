import { describe, expect, it } from "vitest";
import { chapterAt, DURATION, soldierAt, soldiers } from "./timeline.ts";
describe("Moonwake authored encounter", () => {
  it("contains two 28-unit companies and three distinct mercenary roles", () => {
    expect(soldiers.filter((unit) => unit.side === "ivory")).toHaveLength(28);
    expect(soldiers.filter((unit) => unit.side === "tide")).toHaveLength(28);
    expect(new Set(soldiers.filter((unit) => unit.side === "ivory").map((unit) => unit.kind)).size).toBe(3);
  });
  it("can scrub backwards without changing a previously sampled frame", () => {
    const before = soldiers.map((unit) => soldierAt(unit, 16.7));
    soldiers.forEach((unit) => soldierAt(unit, DURATION));
    expect(soldiers.map((unit) => soldierAt(unit, 16.7))).toEqual(before);
  });
  it("backs the shield company away from the advancing tidal strike", () => {
    const front = soldiers[6]!;
    expect(soldierAt(front, 17).x).toBeLessThan(soldierAt(front, 13).x - 35);
    expect(soldierAt(front, 16).brace).toBeGreaterThan(0.9);
    expect(soldierAt(front, 25).brace).toBe(0);
  });
  it("links the first arrow impact to a strong target reaction", () => { expect(soldierAt(soldiers[28]!, 7.96).recoil).toBeGreaterThan(0.95); });
  it("leaves persistent casualties and changes formation after the final charge", () => {
    const fallen = soldiers.filter((unit) => soldierAt(unit, DURATION).fallen === 1);
    expect(fallen.length).toBeGreaterThan(15);
    expect(soldierAt(soldiers[6]!, 27).x).toBeGreaterThan(soldierAt(soldiers[6]!, 10).x + 150);
  });
  it("selects exactly the appropriate chapter at the authored transitions", () => { expect(chapterAt(12.99).at).toBe(6); expect(chapterAt(13).at).toBe(13); expect(chapterAt(29).name).toBe("The last toll"); });
});
