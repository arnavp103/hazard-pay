import { describe, expect, it } from "vitest";

import {
  aimAt,
  angleDelta,
  armEndEffector,
  clamp,
  damp,
  hash01,
  leanOf,
  LEAN_LIMIT,
  makeRandom,
  solveArmIk,
  Spring,
  strideOf,
  unitJitter,
} from "./procedural.ts";

describe("angle helpers", () => {
  it("wraps the shortest way around", () => {
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 6);
    expect(angleDelta(0, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 6);
    // 350 degrees clockwise is 10 degrees anticlockwise.
    expect(angleDelta(0, (350 * Math.PI) / 180)).toBeCloseTo((-10 * Math.PI) / 180, 6);
  });

  it("damps toward the target without overshooting", () => {
    let value = 1;
    for (let i = 0; i < 60; i += 1) { value = damp(value, 0, 6, 1 / 60); }
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(0.01);
  });

  it("clamps", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
  });
});

describe("per-unit desynchronisation", () => {
  it("is deterministic for a given id", () => {
    expect(unitJitter(12)).toEqual(unitJitter(12));
  });

  it("spreads phase across the loop rather than clustering", () => {
    const buckets = [0, 0, 0, 0];
    for (let id = 0; id < 400; id += 1) {
      const phase = unitJitter(id).phase / 4;
      const bucket = Math.min(3, Math.floor(phase * 4));
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) { expect(count).toBeGreaterThan(60); }
  });

  it("keeps rate and amplitude uncorrelated", () => {
    // A single hash reused for both makes the crowd re-synchronise into
    // visible bands, so the two must not track each other.
    let same = 0;
    for (let id = 0; id < 200; id += 1) {
      const jitter = unitJitter(id);
      const rateHigh = jitter.rate > 1;
      const amplitudeHigh = jitter.amplitude > 1;
      if (rateHigh === amplitudeHigh) { same += 1; }
    }
    expect(same).toBeGreaterThan(60);
    expect(same).toBeLessThan(140);
  });

  it("hashes into the unit interval", () => {
    for (let i = 0; i < 500; i += 1) {
      const value = hash01(i);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("replays the same seeded stream", () => {
    const a = makeRandom(99);
    const b = makeRandom(99);
    for (let i = 0; i < 20; i += 1) { expect(a()).toBe(b()); }
  });
});

describe("stride matched to movement speed", () => {
  it("stands still below the movement floor", () => {
    const stride = strideOf(0.02, 0.6);
    expect(stride.frequency).toBe(0);
    expect(stride.blend).toBe(0);
  });

  it("raises step rate with speed", () => {
    const slow = strideOf(0.6, 0.6);
    const fast = strideOf(1.8, 0.6);
    expect(fast.frequency).toBeGreaterThan(slow.frequency);
    expect(fast.swing).toBeGreaterThan(slow.swing);
  });

  it("saturates amplitude so a sprint does not do the splits", () => {
    const fast = strideOf(2.4, 0.6);
    const absurd = strideOf(12, 0.6);
    expect(absurd.swing).toBeCloseTo(fast.swing, 6);
    expect(absurd.frequency).toBeLessThanOrEqual(3.4);
  });

  it("shortens the step for shorter legs at the same speed", () => {
    const short = strideOf(1.2, 0.4);
    const tall = strideOf(1.2, 0.7);
    expect(short.frequency).toBeGreaterThan(tall.frequency);
  });
});

describe("torso and head aim", () => {
  it("is head-led: the head takes its share before the torso twists", () => {
    const aim = aimAt(0, 0, 0, 1.5, 0.4, 1, 1.5);
    expect(aim.headYaw).toBeGreaterThan(0);
    expect(aim.torsoYaw).toBe(0);
    expect(aim.residual).toBeCloseTo(0, 6);
  });

  it("recruits the torso once the head is at its limit", () => {
    const aim = aimAt(0, 0, 0, 1.5, -3, 1, 1.5);
    expect(aim.headYaw).toBeLessThan(0);
    expect(aim.torsoYaw).toBeLessThan(0);
  });

  it("reports what the body could not cover, so the feet can turn", () => {
    const aim = aimAt(0, 0, 0, 1.5, 0, -4, 1.5);
    expect(Math.abs(aim.residual)).toBeGreaterThan(1);
  });

  it("pitches the head down toward a lower target", () => {
    const aim = aimAt(0, 0, 0, 1.6, 0, 3, 0.4);
    expect(aim.headPitch).toBeGreaterThan(0);
  });
});

describe("two-bone weapon-hand IK", () => {
  const upper = 0.35;
  const lower = 0.31;

  const targets: Array<[number, number, number]> = [
    [0, -0.5, 0.2],
    [0.2, -0.3, 0.4],
    [-0.25, -0.4, 0.15],
    [0.1, 0.15, 0.5],
    [0, -0.62, 0],
    [-0.1, -0.2, -0.35],
  ];

  it("puts the hand on the target for every reachable pose", () => {
    for (const [x, y, z] of targets) {
      const solution = solveArmIk(x, y, z, upper, lower);
      const [ex, ey, ez] = armEndEffector(solution, upper, lower);
      expect(ex).toBeCloseTo(x, 4);
      expect(ey).toBeCloseTo(y, 4);
      expect(ez).toBeCloseTo(z, 4);
    }
  });

  it("bends the elbow the anatomically correct way", () => {
    for (const [x, y, z] of targets) {
      const solution = solveArmIk(x, y, z, upper, lower);
      expect(solution.elbow[0]).toBeLessThanOrEqual(1e-9);
      expect(solution.elbow[0]).toBeGreaterThan(-Math.PI);
    }
  });

  it("straightens rather than dislocating when the target is out of reach", () => {
    const solution = solveArmIk(0, -4, 0, upper, lower);
    expect(Math.abs(solution.elbow[0])).toBeLessThan(0.2);
    const [, ey] = armEndEffector(solution, upper, lower);
    expect(ey).toBeCloseTo(-(upper + lower), 2);
  });

  it("folds rather than exploding when the target is inside the elbow", () => {
    const solution = solveArmIk(0, -0.01, 0, upper, lower);
    expect(Number.isFinite(solution.elbow[0])).toBe(true);
    expect(Number.isFinite(solution.shoulder[0])).toBe(true);
  });
});

describe("lean on accelerate and turn", () => {
  it("leans into acceleration along the facing", () => {
    const lean = leanOf(0, 6, 0, 0);
    expect(lean.pitch).toBeGreaterThan(0);
  });

  it("leans back when decelerating", () => {
    const lean = leanOf(0, -6, 0, 0);
    expect(lean.pitch).toBeLessThan(0);
  });

  it("banks into a turn", () => {
    const left = leanOf(0, 0, 1.4, 0);
    const right = leanOf(0, 0, -1.4, 0);
    expect(left.roll).toBeGreaterThan(0);
    expect(right.roll).toBeLessThan(0);
  });

  it("never exceeds the lean limit", () => {
    const lean = leanOf(80, -80, 40, 1.1);
    expect(Math.abs(lean.pitch)).toBeLessThanOrEqual(LEAN_LIMIT);
    expect(Math.abs(lean.roll)).toBeLessThanOrEqual(LEAN_LIMIT);
  });

  it("is facing-relative, not world-relative", () => {
    const forward = leanOf(0, 5, 0, 0);
    const turned = leanOf(5, 0, 0, Math.PI / 2);
    expect(turned.pitch).toBeCloseTo(forward.pitch, 6);
  });
});

describe("recoil and impact springs", () => {
  it("overshoots then settles back to rest", () => {
    const spring = new Spring(190, 17);
    spring.kick(8);
    let peak = 0;
    for (let i = 0; i < 12; i += 1) { peak = Math.max(peak, spring.step(1 / 60)); }
    expect(peak).toBeGreaterThan(0.05);
    for (let i = 0; i < 200; i += 1) { spring.step(1 / 60); }
    expect(Math.abs(spring.value)).toBeLessThan(0.001);
  });

  it("stays stable across a long frame", () => {
    const spring = new Spring(190, 17);
    spring.kick(9);
    for (let i = 0; i < 40; i += 1) { spring.step(1 / 12); }
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(Math.abs(spring.value)).toBeLessThan(1);
  });

  it("resets", () => {
    const spring = new Spring(120, 12);
    spring.kick(5);
    spring.step(1 / 60);
    spring.reset();
    expect(spring.value).toBe(0);
    expect(spring.velocity).toBe(0);
  });
});
