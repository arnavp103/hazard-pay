import { describe, expect, it } from "vitest";
import { DURATION, enginePosition, engineFacing, ENGINES, insideObstacle, projectileAt, project, renderOrder, SKIRMISHES, statusAt } from "./painting.ts";

describe("Velvet Siege elevated battlefield", () => {
  it("begins with 84 engines and retains the final wrecks", () => {
    expect(statusAt(0)).toMatchObject({ violet: 42, ivory: 42 });
    expect(statusAt(DURATION)).toMatchObject({ violet: 31, ivory: 0 });
    for (const unit of ENGINES.filter((unit) => unit.death <= DURATION)) {
      expect(enginePosition(unit, DURATION)).toEqual(enginePosition(unit, unit.death));
    }
  });
  it("routes every grounded actor outside solid footprints throughout the encounter", () => {
    const invalid: string[] = [];
    for (let time = 0; time <= DURATION; time += 0.08) {
      for (const unit of ENGINES) {
        const p = enginePosition(unit, time);
        if (!Number.isFinite(p.x + p.y) || p.x < 60 || p.x > 1480 || p.y < 30 || p.y > 1030 || insideObstacle(p, 12)) {
          invalid.push(`${unit.id}@${time}`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });
  it("preserves individual staging positions and flanks across ground depth", () => {
    for (const time of [0, 6, 8, 15]) {
      expect(new Set(ENGINES.map((unit) => {
        const p = enginePosition(unit, time);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })).size).toBe(84);
    }
    const flankers = ENGINES.filter((unit) => unit.row === 2 && unit.id % 14 >= 7);
    expect(flankers.filter((unit) => Math.abs(enginePosition(unit, 31).y - enginePosition(unit, 23).y) > 200).length).toBeGreaterThan(10);
    expect(flankers.some((unit) => engineFacing(unit, 27).back)).toBe(true);
  });
  it("interleaves solid props and soldiers by ground contact depth", () => {
    for (const t of [8, 19, 29]) {
      const order = renderOrder(t);
      expect(order).toHaveLength(88);
      expect(order.some((item) => item.type === "prop")).toBe(true);
      expect(order.every((item, i) => i === 0 || item.depth >= order[i - 1]!.depth)).toBe(true);
    }
  });
  it("keeps projectile height independent of its ground trajectory", () => {
    const from = { x: 100, y: 200 };
    const to = { x: 500, y: 700 };
    expect(projectileAt(from, to, 1, 100)).toMatchObject(to);
    const middle = projectileAt(from, to, 0.5, 100);
    expect(middle).toEqual({ x: 300, y: 450, z: 121 });
    expect(project(middle, middle.z).y).toBe(project(middle).y - 121);
    for (const shot of SKIRMISHES) {
      expect(ENGINES[shot.source]?.faction).not.toBe(ENGINES[shot.target]?.faction);
    }
  });
});
