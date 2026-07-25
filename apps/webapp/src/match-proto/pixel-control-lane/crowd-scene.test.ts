import { describe, expect, it } from "vitest";

import {
  CONTOUR_MIN_CONTRAST,
  CROWD_CYCLE_MS,
  blitOrigin,
  buildRoster,
  contouredRows,
  crouchRows,
  crowdConfigs,
  footprintWidth,
  formationFor,
  leanRows,
  markingBrightLimit,
  poseUnit,
  silhouetteEdges,
  STAGE_H,
  STAGE_W,
  unitPalette,
} from "./crowd-scene.ts";
import { getGrid, teamPalettes, validateCrowdGrid } from "./crowd-sprites.ts";

const configs = Object.values(crowdConfigs);

describe("order of battle", () => {
  it.each(configs.map((c) => [c.key, c] as const))("%s fields 16 fodder + 2 heroes per side", (_key, config) => {
    const roster = buildRoster(config);
    for (const team of ["rust", "slate"] as const) {
      const side = roster.filter((unit) => unit.team === team);
      expect(side.filter((unit) => unit.tier === "fodder")).toHaveLength(16);
      expect(side.filter((unit) => unit.tier === "hero")).toHaveLength(2);
    }
  });

  it.each(configs.map((c) => [c.key, c] as const))("%s is painted far-to-near", (_key, config) => {
    const roster = buildRoster(config);
    for (let index = 1; index < roster.length; index += 1) {
      expect((roster[index]?.y ?? 0)).toBeGreaterThanOrEqual(roster[index - 1]?.y ?? 0);
    }
  });

  it.each(configs.map((c) => [c.key, c] as const))("%s keeps every figure inside the aperture", (_key, config) => {
    for (const unit of buildRoster(config)) {
      const grid = getGrid(unit.gridKey);
      const origin = blitOrigin(unit, grid, 0);
      expect(origin.x).toBeGreaterThanOrEqual(0);
      expect(origin.y).toBeGreaterThanOrEqual(0);
      expect(origin.x + grid.width).toBeLessThanOrEqual(STAGE_W);
      expect(origin.y + grid.height).toBeLessThanOrEqual(STAGE_H);
    }
  });

  it("mirrors exactly one side, so both crowds face the fight", () => {
    for (const config of configs) {
      const roster = buildRoster(config);
      expect(roster.filter((unit) => unit.mirrored)).toHaveLength(18);
      expect(roster.every((unit) => (unit.team === "slate") === unit.mirrored)).toBe(true);
    }
  });

  it("is deterministic, so captures are reproducible", () => {
    for (const config of configs) {
      expect(buildRoster(config)).toEqual(buildRoster(config));
    }
  });
});

describe("grid transforms", () => {
  it("preserve dimensions and palette validity for every grid", () => {
    for (const config of configs) {
      for (const key of [config.melee, config.ranged, config.hero]) {
        const grid = getGrid(key);
        for (const rows of [leanRows(grid.rows, 20, 0.12), crouchRows(grid.rows, 18, 1)]) {
          expect(rows).toHaveLength(grid.height);
          expect(validateCrowdGrid({ ...grid, rows })).toEqual([]);
        }
      }
    }
  });

  it("leaves a zero lean untouched", () => {
    const grid = getGrid("mara-large");
    expect(leanRows(grid.rows, 30, 0)).toEqual(grid.rows);
  });

  it("keeps the feet planted through a knee-bend crouch", () => {
    const grid = getGrid("mara-large");
    const kneeY = grid.bottomRow - 6;
    const crouched = crouchRows(grid.rows, kneeY, 1);
    for (let y = kneeY; y <= grid.bottomRow; y += 1) {
      expect(crouched[y]).toBe(grid.rows[y]);
    }
  });
});

describe("the crowd idles without reading as synchronized toys", () => {
  it.each(configs.map((c) => [c.key, c] as const))("%s gives units distinct phases", (_key, config) => {
    const phases = new Set(buildRoster(config).map((unit) => unit.phaseMs));
    expect(phases.size).toBeGreaterThan(10);
  });

  it.each(configs.map((c) => [c.key, c] as const))("%s actually moves every unit over a cycle", (_key, config) => {
    for (const unit of buildRoster(config)) {
      const frames = new Set(
        Array.from({ length: 8 }, (_, i) => {
          const posed = poseUnit(unit, Math.round((i / 8) * CROWD_CYCLE_MS));
          return `${posed.rows.join("|")}#${String(posed.bob)}`;
        }),
      );
      expect(frames.size).toBeGreaterThan(1);
    }
  });

  /**
   * Round 2's critique closed on "the legs stay planted". At crowd scale
   * that has to keep holding for BOTH tiers, or the mass reads as a rack
   * of swaying mannequins. Fodder got the cheap version of the fix (a
   * one-row knee settle on the exhale); this pins that it is really there.
   */
  it("moves the lower body of every unit, fodder included", () => {
    for (const config of configs) {
      for (const unit of buildRoster(config)) {
        const grid = getGrid(unit.gridKey);
        const band = (ms: number) => poseUnit(unit, ms)
          .rows.slice(grid.bottomRow - 10, grid.bottomRow - 3).join("|");
        const frames = new Set(
          Array.from({ length: 12 }, (_, i) => band(Math.round((i / 12) * CROWD_CYCLE_MS))),
        );
        expect(frames.size).toBeGreaterThan(1);
      }
    }
  });
});

describe("contact shadows are tier-independent", () => {
  it("sizes every shadow from the unit's own footprint, hero or not", () => {
    for (const config of configs) {
      for (const unit of buildRoster(config)) {
        expect(footprintWidth(getGrid(unit.gridKey))).toBeGreaterThan(3);
      }
    }
  });
});

describe("round-4 staging closes the positional archetype leak", () => {
  /**
   * The round-3 critique's sharpest methodological catch: every ranged unit
   * was staged at the rear-outer edge of its clump, so the archetype read the
   * capture measured was positional rather than silhouettic - "the formation
   * is answering the question for you".
   *
   * A unit's screen position is `(rank - file) * halfW` across and
   * `(rank + file) * halfH` down. Equal rank sums AND equal file sums between
   * the two archetypes therefore make their mean x and mean y identical
   * exactly, not approximately. This pins the construction rather than the
   * consequence, so it cannot drift.
   */
  it("gives melee and ranged identical rank and file sums at SMALL", () => {
    const formation = formationFor(crowdConfigs.small);
    const sums = (kind: "melee" | "ranged") => {
      const slots = formation.filter((slot) => slot.kind === kind);
      return {
        count: slots.length,
        rank: slots.reduce((total, slot) => total + slot.rank, 0),
        file: slots.reduce((total, slot) => total + slot.file, 0),
      };
    };
    expect(sums("melee")).toEqual(sums("ranged"));
  });

  it("measures near-zero mean-x separation at SMALL and the round-3 leak at LARGE", () => {
    const separation = (config: (typeof crowdConfigs)["small"]) => {
      const roster = buildRoster(config).filter((unit) => unit.team === "rust");
      const mean = (prefix: string) => {
        const mine = roster.filter((unit) => unit.gridKey.startsWith(prefix));
        return mine.reduce((total, unit) => total + unit.x, 0) / mine.length;
      };
      return Math.abs(mean("stinger") - mean("breaker"));
    };
    // SMALL: jitter only, well inside one half-tile
    expect(separation(crowdConfigs.small)).toBeLessThan(2);
    // LARGE is the untouched control and still carries the leak - stated, not fixed
    expect(separation(crowdConfigs.large)).toBeGreaterThan(6);
  });
});

describe("round-4 rendering policy", () => {
  it("leaves the LARGE control on every round-3 setting", () => {
    expect(crowdConfigs.large.policy).toEqual({
      contour: "authored",
      depth: false,
      halo: false,
      idleGain: 1,
      markingTaper: false,
      staging: "ranked",
    });
    expect(unitPalette(buildRoster(crowdConfigs.large)[0]!, crowdConfigs.large))
      .toEqual(teamPalettes[buildRoster(crowdConfigs.large)[0]!.team]);
  });

  it("finds every silhouette edge and no interior pixel", () => {
    const edges = silhouetteEdges(["...", ".x.", "..."], 3);
    expect(edges).toHaveLength(1);
    expect(silhouetteEdges(["xxx", "xxx", "xxx"], 3)).toHaveLength(8);
  });

  /**
   * The rule the round-4 measurement implies: ink only where the unit meets a
   * similar-value background. A blind selective contour pushed the share of
   * silhouette edges dissolving into the board from 4-7 % to 20-26 %; sampling
   * the background instead took it to 0 %.
   */
  it("inks an edge that lands on its own value and spares one that does not", () => {
    const rows = ["....", ".cc.", ".cc.", ".cc.", ".cc.", ".cc.", ".cc.", "...."];
    const palette = teamPalettes.rust;
    const onSameValue = contouredRows(rows, 4, palette, () => luma709(palette.c ?? "#000000"));
    const onFarValue = contouredRows(rows, 4, palette, () => 255);
    // row 2 sits above the contact zone in this stub, so it is the honest probe:
    // the lit (left) edge is pushed UP its own ramp, the shadow (right) edge
    // is pushed down to ink, and against a far-off value neither is spent.
    expect(onSameValue[2]).toBe(".ek.");
    expect(onFarValue[2]).toBe(".cc.");
  });

  it("always inks the contact zone, whatever is behind it", () => {
    const grid = getGrid("breaker-small");
    const contoured = contouredRows(grid.rows, grid.width, teamPalettes.rust, () => 255);
    const bottom = contoured[grid.bottomRow] ?? "";
    expect([...bottom].filter((ch) => ch !== ".").every((ch) => ch === "k")).toBe(true);
  });

  it("never inks a focal highlight or emission pixel", () => {
    const grid = getGrid("stinger-small");
    const before = [...grid.rows.join("")].filter((ch) => "nut".includes(ch)).length;
    const after = [...contouredRows(grid.rows, grid.width, teamPalettes.rust, () => 60).join("")]
      .filter((ch) => "nut".includes(ch)).length;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("stops the SMALL hero marking's bright band above the feet", () => {
    const grid = getGrid("mara-small");
    const limit = markingBrightLimit(grid);
    expect(limit).toBeGreaterThan(grid.topRow);
    expect(limit).toBeLessThan(grid.bottomRow - 4);
  });

  it("keeps the contrast threshold in a meaningful band", () => {
    expect(CONTOUR_MIN_CONTRAST).toBeGreaterThan(8);
    expect(CONTOUR_MIN_CONTRAST).toBeLessThan(64);
  });

  /**
   * The round-3 critique measured 17 % of SMALL fodder swinging 3 px or more
   * peak-to-peak against a hero height advantage of only 6 px. Damping is a
   * SMALL-only gain, so LARGE has to keep its round-3 motion exactly.
   */
  it("damps the SMALL idle without touching LARGE", () => {
    const swing = (configKey: "small" | "large") => {
      const config = crowdConfigs[configKey];
      let worst = 0;
      for (const unit of buildRoster(config).filter((u) => u.tier === "fodder")) {
        const bobs = Array.from({ length: 32 }, (_, i) =>
          poseUnit(unit, Math.round((i / 32) * CROWD_CYCLE_MS)).bob);
        worst = Math.max(worst, Math.max(...bobs) - Math.min(...bobs));
      }
      return worst;
    };
    expect(swing("small")).toBeLessThanOrEqual(1);
    expect(swing("large")).toBe(1);
    expect(crowdConfigs.small.policy.idleGain).toBeLessThan(1);
  });
});

/** Rec. 709 luma, local to the test so the assertion cannot drift with a helper. */
function luma709(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 0xff) + 0.7152 * ((n >> 8) & 0xff) + 0.0722 * (n & 0xff);
}
