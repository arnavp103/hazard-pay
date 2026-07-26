import { describe, expect, it } from "vitest";

import {
  AUTHORED_MODE,
  authoredClip,
  authoredKeyTotal,
  BASE_DENSITIES,
  BASE_KEY_COUNT,
  type BaseDensity,
  type ClipName,
  samplePose,
} from "./authored.ts";

const CLIPS: ClipName[] = ["stand", "walk", "attack"];

describe("the authored-base ladder", () => {
  it("has exactly the advertised key count at each rung", () => {
    for (const density of BASE_DENSITIES) {
      for (const name of CLIPS) {
        expect(authoredClip(name, density).keys.length).toBe(BASE_KEY_COUNT[density]);
      }
    }
  });

  it("is monotonic — every rung costs strictly more than the one below", () => {
    const totals = BASE_DENSITIES.map((density) => authoredKeyTotal(density));
    for (let i = 1; i < totals.length; i += 1) {
      expect(totals[i]).toBeGreaterThan(totals[i - 1] ?? -1);
    }
    expect(authoredKeyTotal("none")).toBe(0);
    expect(authoredKeyTotal("quad")).toBe(12);
  });

  it("only replaces the procedural cycle once a loop is expressible", () => {
    // One key cannot encode a loop, so `stance` may only bias posture.
    expect(AUTHORED_MODE.none).toBe("off");
    expect(AUTHORED_MODE.stance).toBe("additive");
    expect(AUTHORED_MODE.pair).toBe("replace");
    expect(AUTHORED_MODE.quad).toBe("replace");
  });

  it("keeps keys sorted in clip time", () => {
    for (const density of BASE_DENSITIES) {
      for (const name of CLIPS) {
        const keys = authoredClip(name, density).keys;
        for (let i = 1; i < keys.length; i += 1) {
          expect(keys[i]?.t ?? 0).toBeGreaterThan(keys[i - 1]?.t ?? 0);
        }
      }
    }
  });
});

describe("clip sampling", () => {
  it("returns a neutral pose when nothing is authored", () => {
    const pose = samplePose(authoredClip("walk", "none"), 0.37);
    expect(Object.keys(pose.rot)).toHaveLength(0);
    expect(pose.squash).toBe(1);
  });

  it("holds a single key at every phase", () => {
    const clip = authoredClip("walk", "stance");
    const a = samplePose(clip, 0);
    const b = samplePose(clip, 0.63);
    expect(b.rot.hipL).toEqual(a.rot.hipL);
  });

  it("wraps from the last key back to the first", () => {
    const clip = authoredClip("walk", "quad");
    const atEnd = samplePose(clip, 0.999);
    const atStart = samplePose(clip, 0);
    const endHip = atEnd.rot.hipL?.[0] ?? 0;
    const startHip = atStart.rot.hipL?.[0] ?? 0;
    // 0.999 is almost all the way back around to key 0.
    expect(Math.abs(endHip - startHip)).toBeLessThan(0.05);
  });

  it("is continuous across the seam", () => {
    const clip = authoredClip("walk", "quad");
    const before = samplePose(clip, 0.98).rot.hipL?.[0] ?? 0;
    const after = samplePose(clip, 0.02).rot.hipL?.[0] ?? 0;
    expect(Math.abs(after - before)).toBeLessThan(0.15);
  });

  it("handles negative and >1 phases identically to their wrapped value", () => {
    const clip = authoredClip("walk", "quad");
    const wrapped = samplePose(clip, 0.4).rot.hipR?.[0] ?? 0;
    expect(samplePose(clip, 2.4).rot.hipR?.[0] ?? 0).toBeCloseTo(wrapped, 9);
    expect(samplePose(clip, -1.6).rot.hipR?.[0] ?? 0).toBeCloseTo(wrapped, 9);
  });

  it("interpolates midway between two keys", () => {
    const clip = authoredClip("walk", "quad");
    const a = samplePose(clip, 0).rot.hipL?.[0] ?? 0;
    const b = samplePose(clip, 0.25).rot.hipL?.[0] ?? 0;
    const mid = samplePose(clip, 0.125).rot.hipL?.[0] ?? 0;
    expect(mid).toBeCloseTo((a + b) / 2, 6);
  });
});

describe("what a two-key walk cannot express", () => {
  /**
   * The reported boundary, asserted as a property rather than a screenshot:
   * a four-key walk lifts the swinging knee between contacts, a two-key walk
   * cannot — its knees only ever interpolate between the two contact values,
   * so the foot skims instead of clearing the ground.
   */
  function deepestKnee(density: BaseDensity): number {
    const clip = authoredClip("walk", density);
    let deepest = 0;
    for (let i = 0; i < 64; i += 1) {
      const pose = samplePose(clip, i / 64);
      deepest = Math.min(deepest, pose.rot.kneeR?.[0] ?? 0, pose.rot.kneeL?.[0] ?? 0);
    }
    return deepest;
  }

  it("never bends the knee deeper than its contact keys", () => {
    const pair = deepestKnee("pair");
    const quad = deepestKnee("quad");
    expect(quad).toBeLessThan(pair);
  });

  it("has no vertical dip to time the passing position against", () => {
    const clip = authoredClip("walk", "pair");
    const dips = new Set<number>();
    for (let i = 0; i < 32; i += 1) { dips.add(samplePose(clip, i / 32).dip); }
    expect(dips.size).toBe(1);
  });
});
