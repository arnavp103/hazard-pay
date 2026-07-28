import { describe, expect, it } from "vitest";

import {
  type CrowdGrid,
  controlPalettes,
  crowdAnatomy,
  crowdGrids,
  luma,
  crowdRowsToRgba,
  DEPTH_MIX,
  depthPalettes,
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
   * "distinguishable by silhouette alone" claim, measured.
   *
   * ROUND-4 CORRECTION. Round 3 compared the two masks in raw grid
   * coordinates, which is only valid while both archetypes share a canvas
   * width. SMALL's melee canvas widened from 16 to 18 in round 4, and the
   * un-aligned comparison then reports 0.498 for SMALL purely because the
   * two grids no longer line up - a measurement artifact, not a gain. The
   * masks are now aligned on the same anchor the painter uses (grid-width
   * centre, contact row), which is where they actually meet on screen.
   *
   * Aligned, the honest numbers are:
   *   SMALL round 3 0.361 -> round 4 0.395   (the redraw is a real gain)
   *   LARGE          0.451 -> 0.451          (untouched control)
   * so SMALL closed roughly a third of the gap and LARGE still separates the
   * two archetypes better on this metric. Asserted, not aspired to.
   */
  it("separates melee from ranged in black, aligned on the blit anchor", () => {
    const distance = (config: "small" | "large") => {
      const cells = (g: CrowdGrid) => {
        const out = new Set<string>();
        mask(g).forEach((row, y) => {
          row.forEach((on, x) => {
            if (on) { out.add(`${String(x - g.width / 2)},${String(y - g.bottomRow)}`); }
          });
        });
        return out;
      };
      const a = cells(grid(`breaker-${config}`));
      const b = cells(grid(`stinger-${config}`));
      let intersection = 0;
      for (const key of a) {
        if (b.has(key)) { intersection += 1; }
      }
      return 1 - intersection / (a.size + b.size - intersection);
    };
    // round-3 SMALL measured 0.361 on this same aligned metric
    expect(distance("small")).toBeGreaterThan(0.38);
    expect(distance("large")).toBeGreaterThan(0.44);
  });

  /**
   * The cue that actually survives 22 px inside a clump is not mask overlap,
   * it is global proportion: how wide the *body mass* is (median filled run,
   * which the weapon row does not dominate) and how far one protrusion
   * breaks out of it. Round 3 had the two archetypes at 11 vs 9 median run -
   * a 1.22x difference that the critique correctly called unreadable.
   */
  it("gives melee a measurably wider body mass than ranged at SMALL", () => {
    const medianRun = (g: CrowdGrid) => {
      const runs = mask(g)
        .map((row) => {
          const first = row.indexOf(true);
          return first === -1 ? 0 : row.lastIndexOf(true) - first + 1;
        })
        .filter((run) => run > 0)
        .sort((a, b) => a - b);
      return runs[Math.floor(runs.length / 2)] ?? 0;
    };
    const melee = medianRun(grid("breaker-small"));
    const ranged = medianRun(grid("stinger-small"));
    expect(melee / ranged).toBeGreaterThan(1.3);
    // and the ranged unit's widest row still breaks well clear of its body
    expect(widestRun(grid("stinger-small")) - ranged).toBeGreaterThanOrEqual(6);
  });
});

describe("round-4 control repairs", () => {
  /**
   * The round-3 cold critique found three hero-only colours quietly doing the
   * tier separation the experiment claimed size and detail density were doing.
   * At SMALL the hero's palette is now a strict subset of its own faction's
   * fodder palette, counting the two roles the contour policy adds at paint
   * time (`k` ink and `e` coat light), which every SMALL unit receives.
   */
  it("leaves the SMALL hero no palette role its own fodder lack", () => {
    const rolesOf = (key: string) =>
      new Set([...grid(key).rows.join("")].filter((ch) => ch !== "."));
    const fodder = new Set([
      ...rolesOf("breaker-small"),
      ...rolesOf("stinger-small"),
      "k",
      "e",
    ]);
    const exclusive = [...rolesOf("mara-small")].filter((ch) => !fodder.has(ch));
    expect(exclusive).toEqual([]);
  });

  it("steps the depth ramp down in value without losing the world anchor", () => {
    for (const team of ["rust", "slate"] as const) {
      const ramp = depthPalettes[team];
      expect(ramp).toHaveLength(DEPTH_MIX.length);
      expect(ramp[0]).toEqual(teamPalettes[team]);
      for (let step = 1; step < ramp.length; step += 1) {
        const near = ramp[step - 1]?.c ?? "";
        const far = ramp[step]?.c ?? "";
        expect(luma(far)).toBeLessThan(luma(near) - 6);
      }
      // the ink anchor is the thing everything mixes toward, so it never moves
      expect(ramp.every((step) => step.k === teamPalettes[team].k)).toBe(true);
    }
  });
});

describe("anatomy, the handle the idle vocabulary moves parts by", () => {
  it("describes every SMALL grid, and only inside its own rows", () => {
    for (const key of ["breaker-small", "stinger-small", "mara-small"]) {
      const anatomy = crowdAnatomy[key];
      const g = grid(key);
      expect(anatomy).toBeDefined();
      const parts = anatomy as NonNullable<typeof anatomy>;
      expect(parts.headTop).toBeGreaterThanOrEqual(g.topRow);
      expect(parts.headBottom).toBeLessThan(parts.gearTop);
      expect(parts.gearBottom).toBeLessThanOrEqual(g.bottomRow);
    }
  });

  /**
   * A `gear-adjust` moves the cells inside the gear band whose role is
   * equipment. If a band held no equipment the beat would be a no-op, and the
   * vocabulary would silently shrink - so assert the gear is actually there.
   */
  it("puts real equipment inside every gear band", () => {
    const gear = new Set(["l", "L", "i", "m", "M", "n"]);
    for (const key of ["breaker-small", "stinger-small"]) {
      const parts = crowdAnatomy[key] as NonNullable<(typeof crowdAnatomy)[string]>;
      const g = grid(key);
      const cells = g.rows
        .slice(parts.gearTop, parts.gearBottom + 1)
        .join("");
      expect([...cells].filter((ch) => gear.has(ch)).length).toBeGreaterThan(5);
    }
  });

  /**
   * The head band is shifted whole, so it must not contain body cells that
   * would tear away from the torso: at 22 px the helmet is the only thing up
   * there, and this pins that it stays that way through a redraw.
   */
  it("keeps the fodder head bands narrower than the body below them", () => {
    for (const key of ["breaker-small", "stinger-small"]) {
      const parts = crowdAnatomy[key] as NonNullable<(typeof crowdAnatomy)[string]>;
      const g = grid(key);
      const span = (row: string) => {
        const first = [...row].findIndex((ch) => ch !== ".");
        return first === -1 ? 0 : row.length - [...row].reverse().findIndex((ch) => ch !== ".") - first;
      };
      const head = Math.max(...g.rows.slice(parts.headTop, parts.headBottom + 1).map(span));
      const torso = span(g.rows[parts.headBottom + 1] ?? "");
      expect(head).toBeLessThanOrEqual(torso);
    }
  });
});

describe("palette law", () => {
  it("keeps the two team liveries as the ONLY colour difference between sides", () => {
    for (const ramp of [teamPalettes, controlPalettes]) {
      const differing = Object.keys(ramp.rust).filter((role) => ramp.rust[role] !== ramp.slate[role]);
      expect(differing.sort()).toEqual(["L", "i", "l"]);
    }
  });

  /**
   * The canon requires silhouettes and important equipment to read in
   * grayscale. The first round-3 pass put both faction ramps at the same
   * luma, so the crowd's faction read vanished without colour. Pin a real
   * value gap at every step of the ramp.
   */
  it("splits the two factions in VALUE, not only in hue", () => {
    for (const ramp of [teamPalettes, controlPalettes]) {
      for (const role of ["l", "L", "i"] as const) {
        const rust = ramp.rust[role];
        const slate = ramp.slate[role];
        expect(rust).toBeDefined();
        expect(slate).toBeDefined();
        expect(luma(rust as string) - luma(slate as string)).toBeGreaterThan(14);
      }
    }
  });

  /**
   * ROUND 5. The livery moved onto the equipment, so it is now read against
   * the NEUTRAL coat rather than against the board, and the direction of that
   * separation is the faction: the warm side's gear sits ABOVE the coat in
   * value and the cool side's BELOW it. Both are therefore legible in
   * grayscale, which two hues at matched luma are not. Round 4's slate livery
   * sat 2.9 luma from the coat - inside its own noise - which is why the cool
   * faction measured 0.0 % accent pixels.
   */
  it("seats the round-5 liveries on opposite sides of the neutral coat", () => {
    const coat = luma(teamPalettes.rust.c as string);
    expect(luma(teamPalettes.rust.l as string) - coat).toBeGreaterThan(20);
    expect(coat - luma(teamPalettes.slate.l as string)).toBeGreaterThan(10);
  });

  /**
   * The accent detectors every cold pass has used are keyed on saturation.
   * Round 4's slate livery ran S 0.39 against rust's 0.68, so the same
   * detector found one faction and not the other. Matching the saturation of
   * the two ramps is what makes the measured identity share symmetric.
   */
  it("matches the two ramps' saturation so an accent detector is fair", () => {
    const sat = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const channels = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
      const max = Math.max(...channels);
      return max === 0 ? 0 : (max - Math.min(...channels)) / max;
    };
    for (const role of ["l", "L", "i"] as const) {
      const rust = sat(teamPalettes.rust[role] as string);
      const slate = sat(teamPalettes.slate[role] as string);
      expect(rust).toBeGreaterThan(0.45);
      expect(slate).toBeGreaterThan(0.45);
      expect(Math.abs(rust - slate)).toBeLessThan(0.2);
    }
  });

  it("uses no magenta or chartreuse and anchors on plum-black", () => {
    for (const palette of [...Object.values(teamPalettes), ...Object.values(controlPalettes)]) {
      expect(palette.k).toBe("#120b10");
      expect(Object.values(palette)).not.toContain("#ff2e6c");
      expect(Object.values(palette)).not.toContain("#c8f031");
    }
  });
});
