import { describe, expect, it } from "vitest";

import {
  type CrowdGrid,
  crowdGrids,
  luma,
  crowdRowsToRgba,
  distinctRoles,
  figureHeight,
  getGrid,
  inkedCells,
  teamPalettes,
  validateCrowdGrid,
} from "./crowd-sprites.ts";

function grid(key: string): CrowdGrid {
  return getGrid(key);
}

/** Boolean silhouette mask, used to prove archetypes differ in black. */
function mask(g: CrowdGrid): boolean[][] {
  return g.rows.map((row) => [...row].map((ch) => ch !== "."));
}

function widestRun(g: CrowdGrid): number {
  return Math.max(...mask(g).map((row) => {
    const first = row.indexOf(true);
    const last = row.lastIndexOf(true);
    return first === -1 ? 0 : last - first + 1;
  }));
}

describe("crowd grids", () => {
  it.each(crowdGrids.map((g) => [g.key, g] as const))("%s is well formed", (_key, g) => {
    expect(validateCrowdGrid(g)).toEqual([]);
    expect(g.rows).toHaveLength(g.height);
  });

  it.each(crowdGrids.map((g) => [g.key, g] as const))("%s compiles to RGBA for both teams", (_key, g) => {
    for (const team of ["rust", "slate"] as const) {
      const rgba = crowdRowsToRgba(g.rows, g.width, teamPalettes[team]);
      expect(rgba).toHaveLength(g.width * g.height * 4);
      expect(rgba.some((byte) => byte !== 0)).toBe(true);
    }
  });
});

describe("the resolution fork the configs are testing", () => {
  it("puts SMALL fodder in the Hero's Hour register (20-24px)", () => {
    for (const key of ["breaker-small", "stinger-small"]) {
      expect(figureHeight(grid(key))).toBeGreaterThanOrEqual(20);
      expect(figureHeight(grid(key))).toBeLessThanOrEqual(24);
    }
  });

  it("puts the SMALL hero at a slight boost (26-30px)", () => {
    expect(figureHeight(grid("mara-small"))).toBeGreaterThanOrEqual(26);
    expect(figureHeight(grid("mara-small"))).toBeLessThanOrEqual(30);
  });

  it("puts LARGE fodder at 32-38px and the LARGE hero at 44-48px", () => {
    for (const key of ["breaker-large", "stinger-large"]) {
      expect(figureHeight(grid(key))).toBeGreaterThanOrEqual(32);
      expect(figureHeight(grid(key))).toBeLessThanOrEqual(38);
    }
    expect(figureHeight(grid("mara-large"))).toBeGreaterThanOrEqual(44);
    expect(figureHeight(grid("mara-large"))).toBeLessThanOrEqual(48);
  });

  it("keeps the hero boost SLIGHT (1.2-1.35x) in both configs", () => {
    const pairs: [string, string][] = [
      ["breaker-small", "mara-small"],
      ["breaker-large", "mara-large"],
    ];
    for (const [fodder, hero] of pairs) {
      const ratio = figureHeight(grid(hero)) / figureHeight(grid(fodder));
      expect(ratio).toBeGreaterThan(1.2);
      expect(ratio).toBeLessThan(1.35);
    }
  });
});

describe("detail density is the other separation lever", () => {
  it("gives heroes strictly more palette roles than fodder at both configs", () => {
    for (const config of ["small", "large"] as const) {
      const hero = crowdGrids.find((g) => g.tier === "hero" && g.config === config);
      const fodder = crowdGrids.filter((g) => g.tier === "fodder" && g.config === config);
      expect(hero).toBeDefined();
      for (const unit of fodder) {
        expect(distinctRoles(hero as CrowdGrid)).toBeGreaterThan(distinctRoles(unit));
      }
    }
  });

  it("spends more authored cells on the hero than on fodder at both configs", () => {
    for (const config of ["small", "large"] as const) {
      const hero = crowdGrids.find((g) => g.tier === "hero" && g.config === config) as CrowdGrid;
      for (const unit of crowdGrids.filter((g) => g.tier === "fodder" && g.config === config)) {
        expect(inkedCells(hero)).toBeGreaterThan(inkedCells(unit));
      }
    }
  });
});

describe("archetype silhouettes", () => {
  it.each(["small", "large"] as const)("melee reads wider than ranged at config %s", (config) => {
    const melee = grid(`breaker-${config}`);
    const ranged = grid(`stinger-${config}`);
    expect(widestRun(melee)).toBeGreaterThan(widestRun(ranged));
  });

  /**
   * Jaccard distance between the two archetypes' silhouette masks - the
   * "distinguishable by silhouette alone" claim, measured. The numbers are
   * asserted rather than aspired to: LARGE separates the two archetypes
   * measurably better than SMALL, which is itself round-3 evidence.
   */
  it("separates melee from ranged in black, and separates them better at LARGE", () => {
    const distance = (config: "small" | "large") => {
      const a = mask(grid(`breaker-${config}`));
      const b = mask(grid(`stinger-${config}`));
      let intersection = 0;
      let union = 0;
      a.forEach((row, y) => {
        row.forEach((on, x) => {
          const other = b[y]?.[x] ?? false;
          if (on && other) { intersection += 1; }
          if (on || other) { union += 1; }
        });
      });
      return 1 - intersection / union;
    };
    expect(distance("small")).toBeGreaterThan(0.3);
    expect(distance("large")).toBeGreaterThan(0.4);
    expect(distance("large")).toBeGreaterThan(distance("small"));
  });
});

describe("palette law", () => {
  it("keeps the two team liveries as the ONLY colour difference between sides", () => {
    const rust = teamPalettes.rust;
    const slate = teamPalettes.slate;
    const differing = Object.keys(rust).filter((role) => rust[role] !== slate[role]);
    expect(differing.sort()).toEqual(["L", "i", "l"]);
  });

  /**
   * The canon requires silhouettes and important equipment to read in
   * grayscale. The first round-3 pass put both faction ramps at the same
   * luma, so the crowd's faction read vanished without colour. Pin a real
   * value gap at every step of the ramp.
   */
  it("splits the two factions in VALUE, not only in hue", () => {
    for (const role of ["l", "L", "i"] as const) {
      const rust = teamPalettes.rust[role];
      const slate = teamPalettes.slate[role];
      expect(rust).toBeDefined();
      expect(slate).toBeDefined();
      expect(luma(rust as string) - luma(slate as string)).toBeGreaterThan(14);
    }
  });

  it("uses no magenta or chartreuse and anchors on plum-black", () => {
    for (const palette of Object.values(teamPalettes)) {
      expect(palette.k).toBe("#120b10");
      expect(Object.values(palette)).not.toContain("#ff2e6c");
      expect(Object.values(palette)).not.toContain("#c8f031");
    }
  });
});
