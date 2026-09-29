import { describe, expect, it } from "vitest";
import { battleAt, chapterAt, DURATION, groundClear, obstacles, project, route, soldiers } from "./timeline.ts";

describe("Moonwake elevated battlefield", () => {
  it("places 88 small combatants into six irregular approach sectors", () => {
    expect(soldiers).toHaveLength(88);
    expect(new Set(soldiers.map((unit) => unit.sector)).size).toBe(6);
    expect(soldiers.filter((unit) => unit.side === "ivory")).toHaveLength(44);
    expect(Math.max(...soldiers.map((unit) => unit.scale))).toBeLessThan(2.5);
  });

  it("projects airborne height independently from a unit's ground position", () => {
    const foot = { x: 820, y: 680 };
    expect(project(foot, 100).x).toBe(project(foot).x);
    expect(project(foot).y - project(foot, 100).y).toBe(100);
    expect(project({ x: foot.x, y: foot.y + 100 }).y).toBeGreaterThan(project(foot).y);
  });

  it("routes around the entire physical ruin footprint", () => {
    const ruin = obstacles[0]!;
    const start = { x: ruin.x - 180, y: ruin.y };
    const path = [start, ...route(start, { x: ruin.x + 180, y: ruin.y })];
    expect(path.length).toBeGreaterThan(2);
    for (let segment = 1; segment < path.length; segment++) {
      const a = path[segment - 1]!;
      const b = path[segment]!;
      for (let step = 0; step <= 100; step++) {
        const t = step / 100;
        expect(groundClear({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })).toBe(true);
      }
    }
  });

  it("keeps every troop outside cover throughout the encounter, including interpolated frames", () => {
    const violations = [];
    for (let time = 0; time <= DURATION; time += 0.137) {
      for (const [id, pose] of battleAt(time).units.entries()) {
        if (!groundClear(pose, 10.8)) {
          violations.push({ time, id, x: pose.x, y: pose.y });
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("spreads battle across both world axes and moves flanks in depth", () => {
    const start = battleAt(0).units;
    const mid = battleAt(18).units;
    const movedInDepth = mid.filter((unit, id) => Math.abs(unit.y - start[id]!.y) > 80);
    expect(movedInDepth.length).toBeGreaterThan(20);
    expect(Math.max(...mid.map((unit) => unit.x)) - Math.min(...mid.map((unit) => unit.x))).toBeGreaterThan(600);
    expect(Math.max(...mid.map((unit) => unit.y)) - Math.min(...mid.map((unit) => unit.y))).toBeGreaterThan(800);
  });

  it("scrubs deterministically and keeps fallen units on their original ground footprints", () => {
    const before = battleAt(21);
    const end = battleAt(DURATION);
    expect(battleAt(21)).toEqual(before);
    const fallen = end.units.filter((unit) => unit.died >= 0);
    expect(fallen.length).toBeGreaterThan(10);
    for (const unit of fallen) {
      expect(groundClear(unit)).toBe(true);
    }
    expect(chapterAt(34).name).toBe("Close the circle");
  });
});
