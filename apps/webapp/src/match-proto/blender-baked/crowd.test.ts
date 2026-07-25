import { describe, expect, it } from "vitest";

import {
  buildRoster,
  crowdCueAt,
  crowdMotionStats,
  crowdPixelIdentity,
  type CrowdUnit,
  lockFacings,
  type Treatment,
} from "./crowd.ts";
import { CROWD_CONFIGS, type CrowdConfig } from "./framing.ts";

const small = CROWD_CONFIGS[0] as CrowdConfig;
const clipsFor = (unit: { rig: string }): CrowdConfig["units"][number]["clips"] => {
  const found = small.units.find((entry) => entry.id === unit.rig);
  if (found === undefined) { throw new Error(`no spec for ${unit.rig}`); }
  return found.clips;
};

describe("buildRoster", () => {
  it("matches the #69 capture default: 16 fodder and 2 heroes a side", () => {
    const roster = buildRoster(small);
    for (const side of [0, 1] as const) {
      const ours = roster.filter((unit) => unit.side === side);
      expect(ours.filter((unit) => unit.tier === "fodder")).toHaveLength(16);
      expect(ours.filter((unit) => unit.tier === "hero")).toHaveLength(2);
    }
  });

  it("is deterministic — a SHA-pinned gallery cannot have a random crowd", () => {
    const a = buildRoster(small);
    const b = buildRoster(small);
    expect(a.map((unit) => `${unit.unit}@${unit.x.toFixed(3)},${unit.y.toFixed(3)}`))
      .toEqual(b.map((unit) => `${unit.unit}@${unit.x.toFixed(3)},${unit.y.toFixed(3)}`));
  });

  it("sorts back to front so a nearer unit always overlaps a further one", () => {
    const roster = buildRoster(small);
    for (let i = 1; i < roster.length; i += 1) {
      expect((roster[i]?.y ?? 0) >= (roster[i - 1]?.y ?? 0)).toBe(true);
    }
  });

  it("puts the two sides on opposing facings", () => {
    const roster = buildRoster(small);
    const sideA = roster.filter((unit) => unit.side === 0);
    const sideB = roster.filter((unit) => unit.side === 1);
    // Jitter is +-1 facing, so the two sides may never share one.
    const overlap = new Set(sideA.map((unit) => unit.facing));
    expect(sideB.some((unit) => overlap.has(unit.facing))).toBe(false);
  });
});

describe("crowdCueAt", () => {
  it("names a track that exists in the atlas naming scheme", () => {
    const unit = buildRoster(small)[0] as CrowdUnit;
    const cue = crowdCueAt(unit, clipsFor(unit), 250, "phase");
    expect(cue.track).toBe(`${unit.unit}_${cue.clip}_${String(unit.facing)}`);
  });

  it("never leaves the clip's frame range, at any time, forwards or back", () => {
    const roster = buildRoster(small);
    for (const treatment of ["sync", "phase", "variants", "full"] as Treatment[]) {
      for (const unit of roster) {
        const clips = clipsFor(unit);
        for (const t of [0, 1, 999, 5000, 123456]) {
          const cue = crowdCueAt(unit, clips, t, treatment);
          const clip = clips.find((entry) => entry.name === cue.clip);
          expect(clip).toBeDefined();
          expect(cue.frame).toBeGreaterThanOrEqual(0);
          expect(cue.frame).toBeLessThan(clip?.frames ?? 0);
        }
      }
    }
  });

  it("holds `sync` and `phase` to ONE baked idle, so the delta is measurable", () => {
    const roster = buildRoster(small);
    for (const treatment of ["sync", "phase"] as Treatment[]) {
      const clips = new Set(
        roster.map((unit) => crowdCueAt(unit, clipsFor(unit), 400, treatment).clip),
      );
      expect([...clips]).toEqual(["idle"]);
    }
  });

  it("puts every unit on the same frame under `sync` — the artifact itself", () => {
    const roster = buildRoster(small).filter((unit) => unit.tier === "fodder");
    const frames = new Set(roster.map((unit) => crowdCueAt(unit, clipsFor(unit), 400, "sync").frame));
    expect(frames.size).toBe(1);
  });
});

describe("crowdMotionStats", () => {
  const roster = buildRoster(small);
  const stats = (treatment: Treatment): ReturnType<typeof crowdMotionStats> =>
    crowdMotionStats(roster, clipsFor, treatment);

  it("measures the synchronized-toys artifact and phase offset curing it", () => {
    expect(stats("sync").peakFrameSynchrony).toBe(1);
    expect(stats("sync").changeBurstiness).toBeGreaterThan(2);
    expect(stats("phase").peakFrameSynchrony).toBeLessThan(0.5);
    expect(stats("phase").changeBurstiness).toBeLessThan(0.5);
  });

  it("shows phase offset buying NO new pose vocabulary — the honest half", () => {
    // Same cells, dealt out at different moments. This is the whole finding:
    // a bake fixes timing at runtime and can never fix repertoire.
    expect(stats("phase").distinctCells).toBe(stats("sync").distinctCells);
    expect(stats("variants").distinctCells).toBeGreaterThan(stats("phase").distinctCells);
  });

  it("shows a locked-facing formation losing most of its variety", () => {
    const locked = crowdMotionStats(lockFacings(roster), clipsFor, "phase");
    expect(locked.distinctCells).toBeLessThan(stats("phase").distinctCells);
    expect(locked.meanDuplicateMultiplicity)
      .toBeGreaterThan(stats("phase").meanDuplicateMultiplicity);
  });
});

describe("crowdPixelIdentity", () => {
  // A hash function that is deliberately blind to the difference between two
  // clips: it stands in for two baked cells that came out byte-identical, which
  // is exactly the case a name-based count cannot see.
  const blindHash = (track: string, frame: number): string => `${track.split("_").slice(-1).join()}#${String(frame)}`;
  const trueHash = (track: string, frame: number): string => `${track}#${String(frame)}`;

  it("counts IMAGES, so byte-identical cells with different names collapse", () => {
    const roster = buildRoster(small);
    const blind = crowdPixelIdentity(roster, clipsFor, "variants", blindHash, 1000);
    const named = crowdPixelIdentity(roster, clipsFor, "variants", trueHash, 1000);
    expect(blind.distinctImages).toBeLessThan(named.distinctImages);
    expect(blind.meanIdenticalMultiplicity).toBeGreaterThan(named.meanIdenticalMultiplicity);
  });

  it("shows the second baked idle buying repertoire a locked line badly needs", () => {
    const locked = lockFacings(buildRoster(small));
    const one = crowdPixelIdentity(locked, clipsFor, "phase", trueHash);
    const two = crowdPixelIdentity(locked, clipsFor, "variants", trueHash);
    expect(two.distinctImages).toBeGreaterThan(one.distinctImages);
    expect(two.meanIdenticalMultiplicity).toBeLessThan(one.meanIdenticalMultiplicity);
  });

  it("puts the whole crowd on a handful of images under lockstep", () => {
    const locked = lockFacings(buildRoster(small));
    const sync = crowdPixelIdentity(locked, clipsFor, "sync", trueHash);
    expect(sync.meanIdenticalMultiplicity).toBeGreaterThan(5);
    expect(sync.peakIdenticalUnits).toBeGreaterThan(8);
  });
});
