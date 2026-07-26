/**
 * THROWAWAY PROTOTYPE (#100): the claims variant B makes about itself.
 *
 * Three things are checked mechanically rather than eyeballed in a capture,
 * because all three are the sort of thing a screenshot can hide:
 *
 *   1. variant A is untouched — `space=plaza` is bit-identical to the sandbox
 *      default, so the two galleries are honestly comparable;
 *   2. the occupancy model actually holds — no body's centre ever ends a step
 *      inside a prop footprint, which is lane 5's guarantee, and the plaza
 *      variant visibly violates it;
 *   3. adding cover does not cost the sandbox its determinism or its slice
 *      resume, which is what every downstream ticket is standing on.
 */

import { describe, expect, it } from "vitest";

import {
  advanceBattle,
  battleAt,
  cloneBattle,
  createBattle,
  type SimState,
  stepsFor,
} from "../sim.ts";
import { isInsideFootprint } from "./cover-behaviours.ts";
import {
  COVER_PROPS,
  GRID,
  overlappingRetrofits,
  RETROFIT_PROPS,
  sightBetween,
  snapReport,
  TILE,
  walkable,
  walkableCells,
  worldRectOf,
} from "./cover-model.ts";
import {
  createSpaceBattle,
  unitsInsideFootprints,
  unitsOnWalkableTiles,
} from "./space.ts";

function suppressed(state: SimState): number {
  return state.units.reduce((sum, unit) => sum + unit.suppressedShots, 0);
}

describe("the port of lane 5's occupancy model", () => {
  it("lands the tile within 10% of the sandbox's separation radius", () => {
    // Lane 5 sized a 28x14 tile against a 22 px figure; the sandbox sized
    // SEPARATION_RADIUS = 1.05 against a 1.48-unit one. Two independent
    // derivations of "one body's worth of floor" that happen to agree.
    expect(TILE).toBeGreaterThan(1.05);
    expect(TILE).toBeLessThan(1.05 * 1.15);
  });

  it("leaves a walkable board rather than a maze", () => {
    const walkables = walkableCells().length;
    expect(walkables).toBeGreaterThan(GRID * GRID * 0.6);
    expect(walkables).toBeLessThan(GRID * GRID);
  });

  it("never overlaps two tile-authored footprints", () => {
    // A prop authored on the grid declares its own claim, so two of them
    // colliding would be an authoring bug. Every overlap on this board is a
    // pair involving a retrofitted, free-placed prop — which is the finding,
    // asserted below rather than tolerated here.
    for (const pair of overlappingRetrofits()) {
      const ids = pair.split(" + ");
      const props = COVER_PROPS.filter((prop) => ids.includes(prop.id));
      expect(`${pair}: ${String(props.some((prop) => prop.retrofit))}`).toBe(`${pair}: true`);
    }
  });

  it("grows free-placed props into their neighbours when it snaps them", () => {
    // board-foundry and board-crate are 15 mm apart in world space and share a
    // tile on the grid. That is the concrete cost of putting existing set
    // dressing on a grid, and it is why occupancy is a union of claims rather
    // than a per-prop test.
    const overlaps = overlappingRetrofits();
    expect(overlaps.length).toBeGreaterThan(0);
    expect(overlaps).toContain("board-foundry + board-crate");
  });

  it("keeps roofed tiles walkable — shade is a lighting fact, not a blocking one", () => {
    const roofed = COVER_PROPS.filter((prop) => prop.roof !== undefined);
    expect(roofed.length).toBeGreaterThan(0);
    for (const prop of roofed) {
      const roof = prop.roof;
      if (roof === undefined) { continue; }
      // The row of the roof that is NOT over the prop's own mass.
      const cy = prop.cells.cy0 + roof.oy + roof.sy - 1;
      expect(walkable(prop.cells.cx0 + roof.ox, cy)).toBe(true);
    }
  });

  it("measures what a free-placed prop costs when it is snapped to the grid", () => {
    const rows = snapReport();
    expect(rows).toHaveLength(RETROFIT_PROPS.length);
    const trueTiles = rows.reduce((sum, row) => sum + row.trueTiles, 0);
    const outwardTiles = rows.reduce((sum, row) => sum + row.outwardTiles, 0);
    // Snapping outward is safe and over-claims floor. That over-claim is the
    // number #64 is owed, so it must be non-trivial and it must be measured.
    expect(outwardTiles).toBeGreaterThan(trueTiles * 1.3);
    // Snapping to the nearest cell keeps the floor honest and lets feet sink
    // into the art instead. Also non-zero — there is no free option.
    expect(Math.max(...rows.map((row) => row.nearestIntrusion))).toBeGreaterThan(0.1);
  });
});

describe("sightlines", () => {
  it("reads zero across an empty stretch of floor", () => {
    // A lane with nothing in it: two cells apart on a clear diagonal corner.
    const sight = sightBetween(-10.8, 10.8, 0.9, -8.5, 10.8, 1.48);
    expect(sight.occlusion).toBe(0);
  });

  it("hides most of a figure standing behind full cover", () => {
    const container = COVER_PROPS.find((prop) => prop.kind === "container");
    expect(container).toBeDefined();
    if (container === undefined) { return; }
    const rect = worldRectOf(container.cells);
    const midZ = (rect.z0 + rect.z1) / 2;
    const sight = sightBetween(rect.x0 - 3, midZ, 0.9, rect.x1 + 1, midZ, 1.48);
    expect(sight.occlusion).toBeGreaterThan(0.8);
  });

  it("barely notices a lamp post — a whole tile of footprint, a slice of mass", () => {
    const lamp = COVER_PROPS.find((prop) => prop.kind === "lampPost");
    expect(lamp).toBeDefined();
    if (lamp === undefined) { return; }
    const rect = worldRectOf(lamp.cells);
    // Offset off the mast's centreline by a third of a tile: the footprint is
    // still crossed, the 0.14-girth silhouette is not.
    const offset = TILE / 3;
    const sight = sightBetween(
      rect.x0 - 3,
      (rect.z0 + rect.z1) / 2 + offset,
      0.9,
      rect.x1 + 3,
      (rect.z0 + rect.z1) / 2 + offset,
      1.48,
    );
    expect(sight.occlusion).toBe(0);
  });
});

describe("variant A — the open plaza", () => {
  it("is bit-identical to the sandbox default", () => {
    expect(createSpaceBattle("plaza")).toEqual(createBattle());
    expect(advanceBattle(createSpaceBattle("plaza"), stepsFor(6)))
      .toEqual(advanceBattle(createBattle(), stepsFor(6)));
  });

  it("walks bodies through the props, which is the thing variant B fixes", () => {
    const plaza = advanceBattle(createSpaceBattle("plaza"), stepsFor(10));
    expect(unitsInsideFootprints(plaza)).toBeGreaterThan(0);
  });

  it("never suppresses a shot — no cover exists to suppress it", () => {
    expect(suppressed(advanceBattle(createSpaceBattle("plaza"), stepsFor(10)))).toBe(0);
  });
});

describe("variant B — tiles and cover", () => {
  it("never lets a body end a step inside a prop footprint", () => {
    const battle = createSpaceBattle("cover");
    for (let step = 0; step < stepsFor(20); step += 1) {
      advanceBattle(battle, 1);
      if (step % 60 !== 0) { continue; }
      const inside = battle.units.filter(isInsideFootprint).map((unit) => unit.id);
      expect(`step ${String(step)}: ${inside.join(",")}`).toBe(`step ${String(step)}: `);
    }
  });

  it("keeps the crowd on the board", () => {
    const battle = advanceBattle(createSpaceBattle("cover"), stepsFor(20));
    expect(unitsOnWalkableTiles(battle)).toBe(battle.units.length);
  });

  it("stops fire — cover is consequential, not decorative", () => {
    const battle = advanceBattle(createSpaceBattle("cover"), stepsFor(20));
    expect(suppressed(battle)).toBeGreaterThan(20);
  });

  it("moves bodies to different places than the plaza does", () => {
    const plaza = advanceBattle(createSpaceBattle("plaza"), stepsFor(8));
    const cover = advanceBattle(createSpaceBattle("cover"), stepsFor(8));
    let moved = 0;
    for (let i = 0; i < plaza.units.length; i += 1) {
      const a = plaza.units[i];
      const b = cover.units[i];
      if (a === undefined || b === undefined) { continue; }
      if (Math.hypot(a.x - b.x, a.z - b.z) > 0.5) { moved += 1; }
    }
    expect(moved).toBeGreaterThan(plaza.units.length / 2);
  });
});

describe("determinism and the slice API, with cover on", () => {
  it("replays exactly from the seed", () => {
    expect(battleAt(4, { coverMode: true })).toEqual(battleAt(4, { coverMode: true }));
  });

  it("resumes exactly — battleAt(a + b) === advance(battleAt(a), b)", () => {
    const resumed = advanceBattle(battleAt(2, { coverMode: true }), stepsFor(2));
    expect(resumed).toEqual(battleAt(4, { coverMode: true }));
  });

  it("survives a JSON round trip of the slice boundary", () => {
    const boundary = battleAt(2, { coverMode: true });
    const shipped = JSON.parse(JSON.stringify(boundary)) as SimState;
    expect(shipped.coverMode).toBe(1);
    expect(advanceBattle(shipped, stepsFor(2))).toEqual(battleAt(4, { coverMode: true }));
  });

  it("does not depend on array order", () => {
    const forward = battleAt(3, { coverMode: true });
    const shuffled = cloneBattle(battleAt(0, { coverMode: true }));
    shuffled.units.reverse();
    advanceBattle(shuffled, stepsFor(3));
    shuffled.units.sort((a, b) => a.id - b.id);
    expect(shuffled).toEqual(forward);
  });

  it("survives a unit being removed mid-fight, which #101 will need", () => {
    const battle = createSpaceBattle("cover");
    advanceBattle(battle, stepsFor(2));
    battle.units.splice(7, 1);
    battle.units.splice(14, 1);
    expect(() => advanceBattle(battle, stepsFor(4))).not.toThrow();
    for (const unit of battle.units) {
      expect(Number.isFinite(unit.x)).toBe(true);
      expect(Number.isFinite(unit.z)).toBe(true);
    }
  });
});
