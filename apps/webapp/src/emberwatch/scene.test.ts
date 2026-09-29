import { describe, expect, it } from "vitest";
import { CHAPTERS, DURATION, PROPS, chapterAt, project, queenAt, unitsAt } from "./scene.ts";
describe("Emberwatch elevated battlefield", () => {
  it("seeks repeatably with 89 individually identified units plus the queen", () => {
    const before = unitsAt(16.7);
    unitsAt(43);
    expect(unitsAt(16.7)).toEqual(before);
    expect(before).toHaveLength(89);
    expect(new Set(before.map((unit) => unit.id)).size).toBe(89);
    expect(queenAt(10).dead).toBe(false);
  });
  it("moves on both world axes and uses multiple facing directions", () => {
    const start = unitsAt(1); const contact = unitsAt(10);
    expect(contact.filter((u, i) => Math.abs(u.x - start[i]!.x) > 20 && Math.abs(u.y - start[i]!.y) > 10).length).toBeGreaterThan(20);
    expect(new Set(contact.map((u) => u.direction)).size).toBe(4);
    expect(Math.max(...contact.map((u) => u.y)) - Math.min(...contact.map((u) => u.y))).toBeGreaterThan(370);
    expect(project(20, 300).y).toBeGreaterThan(project(20, 100).y);
  });
  it("keeps grounded troops and the charging queen outside cover throughout the battle", () => {
    const collisions: string[] = [];
    for (let t = 0; t <= DURATION; t += 0.25) {
      for (const u of unitsAt(t)) {
        if (u.z > 10) { continue; }
        for (const p of PROPS) {
          if (Math.hypot(u.x - p.x, u.y - p.y) < p.radius + 5) { collisions.push(`${t}:${u.id}`); }
        }
      }
      const queen = queenAt(t);
      for (const p of PROPS) {
        if (Math.hypot(queen.x - p.x, queen.y - p.y) < p.radius + 19) { collisions.push(`${t}:queen`); }
      }
    }
    expect(collisions).toEqual([]);
  });
  it("keeps Hammerfall above its ground shadow before an area reaction", () => {
    const hero = (t: number) => unitsAt(t).find((u) => u.id === 88)!;
    expect(hero(21.5).pose).toBe("strike");
    expect(hero(22.7).z).toBeGreaterThan(35);
    expect(hero(22.7).pose).toBe("charge");
    expect(hero(23.7).z).toBeLessThan(0.01);
    expect(unitsAt(23.7).some((u) => u.kind >= 4 && u.pose === "stagger")).toBe(true);
  });
  it("leaves casualties at their fallen positions and settles at 44 seconds", () => {
    const casualties = unitsAt(37).filter((u) => u.dead);
    expect(casualties.length).toBeGreaterThan(40);
    const end = unitsAt(DURATION);
    for (const u of casualties) {
      const later = end.find((v) => v.id === u.id)!;
      expect([later.x, later.y, later.dead]).toEqual([u.x, u.y, true]);
    }
    expect(end.filter((u) => !u.dead).every((u) => u.pose === "idle")).toBe(true);
    expect(queenAt(DURATION).dead).toBe(true);
    expect(chapterAt(DURATION)).toBe(CHAPTERS[5]);
  });
});
