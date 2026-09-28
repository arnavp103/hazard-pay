import { describe, expect, it } from "vitest";

import { crowdAt, poseAt, project } from "./motion.ts";

describe("pixel noir animation timing", () => {
  it("holds an authored pose throughout its 12 fps exposure", () => {
    expect(poseAt(0.671, "attack")).toEqual(poseAt(0.741, "attack"));
    expect(poseAt(0.667, "attack").flash).toBe(1);
    expect(poseAt(1.1, "attack").flash).toBe(0);
  });

  it("loads behind the body, drives forward at contact, then recovers", () => {
    const load = poseAt(0.333, "attack");
    const contact = poseAt(0.667, "attack");
    const recover = poseAt(2.0, "attack");
    expect(load.lean).toBeLessThan(0);
    expect(contact.lean).toBeGreaterThan(0);
    expect(contact.hand[1]).toBeGreaterThan(load.hand[1] + 20);
    expect(contact.coat).toBeLessThan(0);
    expect(recover.hand).toEqual(poseAt(0, "idle").hand);
  });

  it("alternates foot separation and lift rather than sliding a static torso", () => {
    const a = poseAt(0.25, "walk");
    const b = poseAt(0.75, "walk");
    expect(a.stride).toBeGreaterThan(10);
    expect(b.stride).toBeLessThan(-10);
    expect(poseAt(0, "walk").lift).toBe(1);
    expect(poseAt(0.5, "walk").lift).toBe(-1);
  });

  it("uses an exact fixed 2:1 dimetric projection", () => {
    const origin = project(0, 0);
    const x = project(20, 0);
    const y = project(0, 20);
    expect([x[0] - origin[0], x[1] - origin[1]]).toEqual([20, 10]);
    expect([y[0] - origin[0], y[1] - origin[1]]).toEqual([-20, 10]);
  });

  it("keeps all forty patrol identities stable and independently moving", () => {
    const early = crowdAt(1);
    const later = crowdAt(2);
    expect(early).toHaveLength(40);
    expect(new Set(early.map((unit) => unit.id)).size).toBe(40);
    expect(early.filter((unit) => unit.kind === "medic")).toHaveLength(2);
    expect(early).toEqual(crowdAt(1));
    expect(later.map((unit) => [unit.x, unit.y])).not.toEqual(early.map((unit) => [unit.x, unit.y]));
    expect(new Set(early.map((unit) => unit.action)).size).toBeGreaterThan(1);
  });

  it("stages every patrol clear of fixed barricades across its complete nine-second loop", () => {
    const collisions: { unit: number; frame: number; barrier: number }[] = [];
    for (let frame = 0; frame < 108; frame++) {
      for (const unit of crowdAt(frame / 12)) {
        for (const [barrier, [x, y]] of [[-211, 152], [186, 166], [-9, 370]].entries()) {
          const inside = unit.x > x! - 6 && unit.x < x! + 59 && unit.y > y! - 6 && unit.y < y! + 24;
          if (inside) { collisions.push({ unit: unit.id, frame, barrier }); }
        }
      }
    }
    // Keep full-cycle coverage without constructing 12,960 matcher stacks while
    // the existing simulation stress tests share a small CI runner.
    expect(collisions).toEqual([]);
  });
});
