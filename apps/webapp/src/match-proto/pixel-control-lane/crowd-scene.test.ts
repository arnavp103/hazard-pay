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

  it("gives heroes lower-body motion the cheap fodder treatment does not have", () => {
    const config = crowdConfigs.large;
    const roster = buildRoster(config);
    const hero = roster.find((unit) => unit.tier === "hero");
    const fodder = roster.find((unit) => unit.tier === "fodder");
    expect(hero).toBeDefined();
    expect(fodder).toBeDefined();
    const heroGrid = getGrid((hero?.gridKey) ?? "");
    const fodderGrid = getGrid((fodder?.gridKey) ?? "");
    const heroBand = (ms: number) => poseUnit(hero!, ms).rows.slice(heroGrid.bottomRow - 12, heroGrid.bottomRow - 6).join("|");
    const fodderBand = (ms: number) => poseUnit(fodder!, ms).rows.slice(fodderGrid.bottomRow - 8, fodderGrid.bottomRow - 4).join("|");
    const heroFrames = new Set(Array.from({ length: 12 }, (_, i) => heroBand(Math.round((i / 12) * CROWD_CYCLE_MS))));
    const fodderFrames = new Set(Array.from({ length: 12 }, (_, i) => fodderBand(Math.round((i / 12) * CROWD_CYCLE_MS))));
    expect(heroFrames.size).toBeGreaterThan(fodderFrames.size);
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
