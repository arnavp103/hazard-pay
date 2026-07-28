import { describe, expect, it } from "vitest";

import { medicSide, validateGrid } from "./medic-48.ts";
import {
  ATTACK_CYCLE_MS,
  IDLE_CYCLE_MS,
  lean,
  medicSideArm,
  medicSideBody,
  moveRegion,
  overlay,
  renderPose,
  shearX,
  shiftY,
  subjectFor,
  treatments,
} from "./medic-rig.ts";

/** Row bands used to prove the *whole body* moves, not just the arm. */
const HEAD_BAND = [6, 18] as const;
const LEG_BAND = [49, 61] as const;
const ARM_BAND = [31, 37] as const;

function band(grid: string[], [a, b]: readonly [number, number]): string {
  return grid.slice(a, b + 1).join("\n");
}

function sample(fn: (ms: number) => { rows: string[] }, cycleMs: number, n = 16): string[][] {
  return Array.from({ length: n }, (_, i) => fn(Math.round((i / n) * cycleMs)).rows);
}

describe("grid transforms", () => {
  it("preserve 48×64 dimensions and palette validity", () => {
    const cases = [
      lean(medicSide, 38, 0.12),
      shearX(medicSide, (y) => y / 10),
      shiftY(medicSide, 2),
      moveRegion(medicSide, 24, 49, 34, 61, 3, 0),
      overlay(medicSideBody, medicSideArm),
    ];
    for (const g of cases) { expect(validateGrid(g, "transform")).toEqual([]); }
  });

  it("body+arm compose back to a complete figure (no hole where the arm was)", () => {
    const composed = overlay(medicSideBody, medicSideArm);
    // the coat column behind the arm is filled on the body layer
    expect(band(medicSideBody, ARM_BAND)).toContain("c");
    expect(validateGrid(composed, "composed")).toEqual([]);
  });

  it("lean is hole-free: same opaque pixel count as the source", () => {
    const count = (g: string[]) => g.join("").replace(/\./g, "").length;
    expect(count(lean(medicSide, 38, 0.1))).toBe(count(medicSide));
  });
});

describe("animation treatments", () => {
  it("ships three distinct treatments", () => {
    expect(treatments.map((t) => t.key)).toEqual(["authored", "programmatic", "hybrid"]);
  });

  it.each(treatments.map((t) => [t.key, t] as const))(
    "%s emits well-formed frames across the whole idle + attack cycle",
    (_key, treatment) => {
      for (const rows of sample(treatment.idle, IDLE_CYCLE_MS)) {
        expect(validateGrid(rows, "idle")).toEqual([]);
      }
      for (const rows of sample(treatment.attack, ATTACK_CYCLE_MS)) {
        expect(validateGrid(rows, "attack")).toEqual([]);
      }
    },
  );

  it.each(treatments.map((t) => [t.key, t] as const))(
    "%s attack ACTS WITH THE WHOLE BODY — head and legs both move, not just the arm",
    (_key, treatment) => {
      const frames = sample(treatment.attack, ATTACK_CYCLE_MS, 20);
      const headStates = new Set(frames.map((f) => band(f, HEAD_BAND)));
      const legStates = new Set(frames.map((f) => band(f, LEG_BAND)));
      // round-1 failure was a static torso/head/legs with only the forearm
      // swiveling. Require real motion above and below the hips.
      expect(headStates.size).toBeGreaterThan(1);
      expect(legStates.size).toBeGreaterThan(1);
    },
  );

  it.each(treatments.map((t) => [t.key, t] as const))(
    "%s idle breathes with the body (head band changes over the loop)",
    (_key, treatment) => {
      const frames = sample(treatment.idle, IDLE_CYCLE_MS, 16);
      expect(new Set(frames.map((f) => band(f, HEAD_BAND))).size).toBeGreaterThan(1);
    },
  );
});

describe("renderPose", () => {
  it("windup leans the head back while the feet stay planted", () => {
    const rest = renderPose({ lean: 0 });
    const windup = renderPose({ lean: -0.09, headDip: 1, armDx: -9, armDy: -3 });
    expect(band(windup, HEAD_BAND)).not.toBe(band(rest, HEAD_BAND));
    expect(band(windup, LEG_BAND)).toBe(band(rest, LEG_BAND));
  });

  it("thrust extends the needle past the resting reach", () => {
    const rest = renderPose({});
    const thrust = renderPose({ lean: 0.12, armDx: 2, armDy: 1, legDx: 3, needle: 5 });
    const reach = (g: string[]) => Math.max(...g.map((r) => r.replace(/\.+$/, "").length));
    expect(reach(thrust)).toBeGreaterThan(reach(rest));
  });
});

describe("subjectFor", () => {
  it("mirrors the left facing and holds front/back static", () => {
    expect(subjectFor(0, "left", "idle", "hybrid").mirrored).toBe(true);
    expect(subjectFor(500, "front", "idle", "hybrid").frame.rows).toEqual(subjectFor(0, "front", "attack", "authored").frame.rows);
  });

  it("runs the selected treatment on the side facing", () => {
    const a = subjectFor(300, "side", "attack", "authored").frame.rows;
    const b = subjectFor(0, "side", "none", "authored").frame.rows;
    expect(a).not.toEqual(b);
    expect(subjectFor(0, "side", "none", "authored").frame.rows).toEqual(medicSide);
  });
});
