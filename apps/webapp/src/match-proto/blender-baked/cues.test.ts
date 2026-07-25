import { describe, expect, it } from "vitest";

import { cueAt, PIVOT_MS, trackKey, TURN_CYCLE_MS, TURN_DWELLS_MS, turnCue } from "./cues.ts";
import { CLIPS, FACINGS } from "./framing.ts";

const idle = CLIPS.find((clip) => clip.name === "idle");
const pivot = CLIPS.find((clip) => clip.name === "pivot");

describe("clip loops", () => {
  it("steps a clip at its authored fps and wraps", () => {
    expect(idle).toBeDefined();
    expect(cueAt("idle", 0, 3)).toEqual({ clip: "idle", facing: 3, frame: 0 });
    expect(cueAt("idle", 125, 3).frame).toBe(1);
    expect(cueAt("idle", 1000, 3).frame).toBe(0);
  });

  it("never leaves the baked frame range", () => {
    for (const clip of CLIPS) {
      if (clip.name === "pivot") { continue; }
      for (let ms = 0; ms < 4000; ms += 7) {
        const cue = cueAt(clip.name === "attack" ? "attack" : "idle", ms, 0);
        expect(cue.frame).toBeGreaterThanOrEqual(0);
        expect(cue.frame).toBeLessThan(clip.frames);
      }
    }
  });
});

describe("turn schedule", () => {
  it("holds the first facing for its dwell, then pivots", () => {
    const dwell = TURN_DWELLS_MS[0] ?? 0;
    expect(turnCue(0).clip).toBe("idle");
    expect(turnCue(dwell - 1).facing).toBe(0);
    expect(turnCue(dwell).clip).toBe("pivot");
  });

  it("swaps the facing at the pivot apex, not at its start or end", () => {
    const dwell = TURN_DWELLS_MS[0] ?? 0;
    const fps = pivot?.fps ?? 12;
    const frameMs = 1000 / fps;
    // Frames 0-2 stay on the old facing (anticipation + lift)…
    expect(turnCue(dwell + frameMs * 0.5).facing).toBe(0);
    expect(turnCue(dwell + frameMs * 2.5).facing).toBe(0);
    // …frames 3-5 are already the new one (apex, land, settle).
    expect(turnCue(dwell + frameMs * 3.5).facing).toBe(1);
    expect(turnCue(dwell + frameMs * 5.5).facing).toBe(1);
  });

  it("visits all eight facings in one cycle and returns home", () => {
    const seen = new Set<number>();
    for (let ms = 0; ms < TURN_CYCLE_MS; ms += 5) {
      seen.add(turnCue(ms).facing);
    }
    expect(seen.size).toBe(FACINGS);
    expect(turnCue(TURN_CYCLE_MS)).toEqual(turnCue(0));
  });

  it("uses uneven dwells so the turn cannot read as a turntable", () => {
    expect(new Set(TURN_DWELLS_MS).size).toBeGreaterThan(4);
    expect(TURN_CYCLE_MS).toBe(
      TURN_DWELLS_MS.reduce((sum, value) => sum + value, 0) + FACINGS * PIVOT_MS,
    );
  });

  it("stays inside the baked range for every millisecond of the cycle", () => {
    for (let ms = 0; ms < TURN_CYCLE_MS + 500; ms += 3) {
      const cue = turnCue(ms);
      const clip = CLIPS.find((entry) => entry.name === cue.clip);
      expect(clip).toBeDefined();
      expect(cue.frame).toBeLessThan(clip?.frames ?? 0);
      expect(cue.facing).toBeGreaterThanOrEqual(0);
      expect(cue.facing).toBeLessThan(FACINGS);
    }
  });

  it("is stable under negative and huge clocks", () => {
    expect(turnCue(-1).facing).toBeGreaterThanOrEqual(0);
    expect(turnCue(TURN_CYCLE_MS * 37 + 12)).toEqual(turnCue(12));
  });
});

describe("trackKey", () => {
  it("names the per-facing animation track in the baked sheet", () => {
    expect(trackKey({ clip: "attack", facing: 5, frame: 2 })).toBe("attack_5");
  });
});
