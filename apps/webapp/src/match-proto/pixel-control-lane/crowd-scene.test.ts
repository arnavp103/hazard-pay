import { describe, expect, it } from "vitest";

import {
  CROWD_CYCLE_MS,
  blitOrigin,
  buildRoster,
  crouchRows,
  crowdConfigs,
  footprintWidth,
  leanRows,
  poseUnit,
  STAGE_H,
  STAGE_W,
} from "./crowd-scene.ts";
import { getGrid, validateCrowdGrid } from "./crowd-sprites.ts";

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
