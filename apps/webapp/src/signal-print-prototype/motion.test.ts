import { describe, expect, it } from "vitest";

import { LOOP_MS, poseAt, project, type Role } from "./motion.ts";

describe("print motion contract", () => {
  it("gathers before the strike, then lets the cloth settle after impact", () => {
    const gather = poseAt(1750, "medic");
    const hit = poseAt(2250, "medic");
    const follow = poseAt(2600, "medic");
    expect(gather.lean).toBeLessThan(0);
    expect(gather.reach).toBeLessThan(0);
    expect(hit.reach).toBeGreaterThan(20);
    expect(hit.impact).toBeGreaterThan(0);
    expect(follow.impact).toBe(0);
    expect(follow.cloth).toBeGreaterThan(hit.cloth);
  });

  it("seeks and wraps without accumulated simulation state", () => {
    for (const role
      of ["medic", "veteran", "esper"] as Role[]) {
      expect(poseAt(1234, role)).toEqual(poseAt(1234 + LOOP_MS, role));
      expect(poseAt(-1, role)).toEqual(poseAt(LOOP_MS - 1, role));
      for (let ms = 0; ms < LOOP_MS; ms += 13) {
        for (const value
          of Object.values(poseAt(ms, role))) {
          if (typeof value === "number") {
            expect(Number.isFinite(value)).toBe(true);
          }
        }
      }
    }
  });

  it("keeps the ground axes at exactly two horizontal pixels to one vertical", () => {
    const o = project(0, 0);
    for (const p
      of [project(100, 0), project(0, 100)]) {
      expect(Math.abs((p[0] - o[0]) / (p[1] - o[1]))).toBeCloseTo(2, 6);
    }
    expect(project(0, 0, 50)[1]).toBe(o[1] - 50);
  });
});
