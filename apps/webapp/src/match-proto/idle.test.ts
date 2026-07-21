import { describe, expect, it } from "vitest";

import { idleBobArtPixels } from "./idle.ts";

describe("idleBobArtPixels", () => {
  it("always lands on a whole art pixel within one pixel of rest", () => {
    for (let t = 0; t < 10_000; t += 16) {
      const bob = idleBobArtPixels(t, 0);
      expect([-1, 0, 1]).toContain(bob);
    }
  });

  it("actually bobs — hits every step of the cycle over time", () => {
    const seen = new Set<number>();
    for (let t = 0; t < 10_000; t += 16) {
      seen.add(idleBobArtPixels(t, 0));
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([-1, 0, 1]);
  });

  it("desyncs fighters by phase: opposite phases bob against each other", () => {
    // At the sine peak for phase 0, a fighter half a cycle out is at the trough.
    const peakT = (Math.PI / 2) * 480;
    expect(idleBobArtPixels(peakT, 0)).toBe(1);
    expect(idleBobArtPixels(peakT, Math.PI)).toBe(-1);
  });
});
