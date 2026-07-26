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

import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { profileOf } from "../archetypes.ts";
import {
  advanceBattle,
  battleAt,
  cloneBattle,
  createBattle,
  type SimState,
  type SimUnit,
  stepsFor,
} from "../sim.ts";
import { postureOf } from "./approach-field.ts";
import { isInsideFootprint } from "./cover-behaviours.ts";
import {
  coverFacingOf,
  DUCKED,
  OPEN,
  PEEKING,
  shieldedFrom,
  usableFaces,
} from "./directional-cover.ts";
import {
  BOARD_SIZES,
  boardFor,
  type BoardProp,
  bodyRadius,
  cellCentre,
  cellIndexAt,
  COVER_DENSITIES,
  densityReport,
  DENSITY_PROPS,
  LATTICE,
  onBoard,
  SIZE_CELLS,
  overlappingRetrofits,
  RETROFIT_PROPS,
  sightBetween,
  snapReport,
  TILE,
  walkable,
  walkableCells,
  worldRectOf,
} from "./cover-model.ts";
import { firesOrdnance, isFireMode, shotOf } from "./fire-render.ts";
import {
  createSpaceBattle,
  type RosterMode,
  unitsInsideFootprints,
  unitsOffBoard,
  unitsOnWalkableTiles,
} from "./space.ts";
import {
  CAMERA_MODES,
  CROWD_ZOOM,
  FIT_BAND_FLOOR_CELLS,
  fodderPixels,
  LEGIBLE_PX,
  PAN_PERIOD,
  panAmplitude,
  panOffset,
  zoomFor,
} from "../scene.ts";

/** Round 1's board — the density every round-1 claim was measured against. */
const DENSE = boardFor("dense");
const COVER_PROPS = DENSE.props;

function suppressed(state: SimState): number {
  return state.units.reduce((sum, unit) => sum + unit.suppressedShots, 0);
}

/** A prop with nothing but a footprint — `usableFaces` reads nothing else. */
function fakeProp(sx: number, sy: number): BoardProp {
  return { cells: { cx0: 0, cx1: sx, cy0: 0, cy1: sy } } as BoardProp;
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
    const walkables = walkableCells(DENSE).length;
    const tiles = DENSE.cells * DENSE.cells;
    expect(walkables).toBeGreaterThan(tiles * 0.6);
    expect(walkables).toBeLessThan(tiles);
  });

  it("never overlaps two tile-authored footprints", () => {
    // A prop authored on the grid declares its own claim, so two of them
    // colliding would be an authoring bug. Every overlap on this board is a
    // pair involving a retrofitted, free-placed prop — which is the finding,
    // asserted below rather than tolerated here.
    for (const pair of overlappingRetrofits(DENSE)) {
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
    const overlaps = overlappingRetrofits(DENSE);
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
      expect(walkable(DENSE, prop.cells.cx0 + roof.ox, cy)).toBe(true);
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
    const sight = sightBetween(DENSE, -10.8, 10.8, 0.9, -8.5, 10.8, 1.48);
    expect(sight.occlusion).toBe(0);
  });

  it("hides most of a figure standing behind full cover", () => {
    const container = COVER_PROPS.find((prop) => prop.kind === "container");
    expect(container).toBeDefined();
    if (container === undefined) { return; }
    const rect = worldRectOf(container.cells);
    const midZ = (rect.z0 + rect.z1) / 2;
    const sight = sightBetween(DENSE, rect.x0 - 3, midZ, 0.9, rect.x1 + 1, midZ, 1.48);
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
      DENSE,
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
    expect(unitsInsideFootprints(DENSE, plaza)).toBeGreaterThan(0);
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
      const inside = battle.units.filter((unit) => isInsideFootprint(DENSE, unit)).map((unit) => unit.id);
      expect(`step ${String(step)}: ${inside.join(",")}`).toBe(`step ${String(step)}: `);
    }
  });

  it("keeps the crowd on the board", () => {
    const battle = advanceBattle(createSpaceBattle("cover"), stepsFor(20));
    expect(unitsOnWalkableTiles(DENSE, battle)).toBe(battle.units.length);
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
    expect(shipped.coverDensity).toBe(0);
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

/* ====================================================================== */
/* Round 2 — density, roster, and drawing a shot                          */
/* ====================================================================== */

describe("round 2 — the density axis", () => {
  it("is monotone: fewer props, more floor, at every step", () => {
    const rows = COVER_DENSITIES.map((density) => densityReport(boardFor(density)));
    for (let i = 1; i < rows.length; i += 1) {
      const looser = rows[i];
      const tighter = rows[i - 1];
      if (looser === undefined || tighter === undefined) { continue; }
      expect(looser.authoredProps).toBeLessThan(tighter.authoredProps);
      expect(looser.walkableTiles).toBeGreaterThan(tighter.walkableTiles);
      expect(looser.meanFloorToProp).toBeGreaterThan(tighter.meanFloorToProp);
    }
  });

  it("leaves round 1's board untouched at `dense`", () => {
    // The whole comparison rests on this: `dense` is not a re-authored board,
    // it is the one round 1 measured. Thinning at a zero gap is the identity.
    expect(boardFor("dense").authored).toHaveLength(32);
    expect(boardFor("dense").props).toHaveLength(42);
    expect(walkableCells(boardFor("dense"))).toHaveLength(268);
  });

  it("never drops a board.ts prop — those are real art, not our choice", () => {
    for (const density of COVER_DENSITIES) {
      const retrofits = boardFor(density).props.filter((prop) => prop.retrofit);
      expect(`${density}: ${String(retrofits.length)}`)
        .toBe(`${density}: ${String(RETROFIT_PROPS.length)}`);
    }
  });

  it("keeps props in manifest order, which ties break on", () => {
    // `seekCoverCell` breaks ties on prop index and `sightBetween` returns one.
    // If thinning reordered the array, the same manifest entry could score
    // differently at two densities for a reason nobody authored.
    const denseIds = boardFor("dense").props.map((prop) => prop.id);
    for (const density of COVER_DENSITIES) {
      const ids = boardFor(density).props.map((prop) => prop.id);
      expect(denseIds.filter((id) => ids.includes(id))).toEqual(ids);
    }
  });

  it("still holds the occupancy invariant at every density", () => {
    for (const density of COVER_DENSITIES) {
      const board = boardFor(density);
      const battle = advanceBattle(createSpaceBattle("cover", { density }), stepsFor(20));
      const inside = battle.units.filter((unit) => isInsideFootprint(board, unit));
      expect(`${density}: ${inside.map((unit) => unit.id).join(",")}`).toBe(`${density}: `);
      expect(unitsOnWalkableTiles(board, battle)).toBe(battle.units.length);
    }
  });

  it("carries the density through a slice boundary", () => {
    const boundary = advanceBattle(createSpaceBattle("cover", { density: "sparse" }), stepsFor(2));
    const shipped = JSON.parse(JSON.stringify(boundary)) as SimState;
    expect(shipped.coverDensity).toBe(2);
    expect(advanceBattle(shipped, stepsFor(2)))
      .toEqual(advanceBattle(createSpaceBattle("cover", { density: "sparse" }), stepsFor(4)));
  });

  it("produces a different fight at each density", () => {
    const seen = COVER_DENSITIES.map((density) => {
      const battle = advanceBattle(createSpaceBattle("cover", { density }), stepsFor(8));
      return battle.units.map((unit) => `${unit.x.toFixed(3)},${unit.z.toFixed(3)}`).join("|");
    });
    expect(new Set(seen).size).toBe(COVER_DENSITIES.length);
  });
});

describe("round 2 — rosters", () => {
  const rosters: RosterMode[] = ["mixed", "ranged", "split"];

  it("changes who is on the field without moving anyone", () => {
    // The claim the whole ranged comparison rests on: three rosters, one
    // deployment. If a roster moved a body, "ranged does worse here" could be
    // an artefact of where the shooters happened to start.
    const base = createSpaceBattle("plaza").units.map((unit) => [unit.x, unit.z]);
    for (const roster of rosters) {
      expect(createSpaceBattle("plaza", { roster }).units.map((unit) => [unit.x, unit.z]))
        .toEqual(base);
    }
  });

  it("leaves the per-unit random streams alone", () => {
    // Archetype is rewritten after `createBattle`, so nothing about the roster
    // may have shifted a draw — the opening cursors must be identical.
    const base = createSpaceBattle("plaza").units.map((unit) => unit.randomState);
    for (const roster of rosters) {
      expect(createSpaceBattle("plaza", { roster }).units.map((unit) => unit.randomState))
        .toEqual(base);
    }
  });

  it("makes every body a shooter under `ranged`", () => {
    const battle = createSpaceBattle("cover", { roster: "ranged" });
    expect(battle.units.every((unit) => unit.archetype === "ranged")).toBe(true);
  });

  it("puts shooters on one side and swords on the other under `split`", () => {
    const battle = createSpaceBattle("cover", { roster: "split" });
    expect(battle.units.filter((unit) => unit.side === 0)
      .every((unit) => unit.archetype === "ranged")).toBe(true);
    expect(battle.units.filter((unit) => unit.side === 1)
      .every((unit) => unit.archetype === "melee")).toBe(true);
  });

  it("still replays exactly with a roster set", () => {
    for (const roster of rosters) {
      expect(advanceBattle(createSpaceBattle("cover", { roster }), stepsFor(4)))
        .toEqual(advanceBattle(createSpaceBattle("cover", { roster }), stepsFor(4)));
    }
  });
});

describe("round 2 — drawing a shot", () => {
  /**
   * A muzzle anchor's world position is all `shotOf` wants from the rig — so
   * the test needs no renderer and no `three` import to drive it.
   */
  const muzzle = new Vector3(0, 1, 0);

  it("only fires for archetypes that hold a standoff", () => {
    // A sword swing is not a shot. `firesOrdnance` reads the standoff rather
    // than the archetype name, so a new shooter added at extension point 2
    // gets a tracer without editing this file.
    expect(firesOrdnance(4.7)).toBe(true);
    expect(firesOrdnance(6.2)).toBe(true);
    expect(firesOrdnance(1.05)).toBe(false);
    expect(firesOrdnance(0.9)).toBe(false);
  });

  it("cannot change the fight — it is a renderer, not a behaviour", () => {
    // Why fire is drawn from `firedAtStep` and nothing else: the gallery's
    // three fire modes have to be three pictures of ONE battle, or the
    // comparison between them is worthless.
    const battle = advanceBattle(createSpaceBattle("cover", { roster: "ranged" }), stepsFor(6));
    const before = JSON.stringify(battle);
    const shooter = battle.units[0];
    const target = battle.units[20];
    if (shooter === undefined || target === undefined) { return; }
    shotOf(shooter, target, battle.step, "bolt", muzzle);
    shotOf(shooter, target, battle.step, "hitscan", muzzle);
    expect(JSON.stringify(battle)).toBe(before);
  });

  it("shows a shot only while it is live", () => {
    const battle = createSpaceBattle("cover", { roster: "ranged" });
    const shooter = battle.units[0];
    const target = battle.units[20];
    if (shooter === undefined || target === undefined) { return; }
    expect(shotOf(shooter, target, 0, "bolt", muzzle)).toBeUndefined();
    shooter.firedAtStep = 10;
    expect(shotOf(shooter, target, 10, "none", muzzle)).toBeUndefined();
    expect(shotOf(shooter, target, 10, "bolt", muzzle)).toBeDefined();
    // ...and expires, rather than smearing across the whole cooldown.
    expect(shotOf(shooter, target, 40, "bolt", muzzle)).toBeUndefined();
  });

  it("parses the query parameter it is driven by", () => {
    expect(isFireMode("bolt")).toBe(true);
    expect(isFireMode("hitscan")).toBe(true);
    expect(isFireMode("none")).toBe(true);
    expect(isFireMode("tracer")).toBe(false);
    expect(isFireMode(null)).toBe(false);
  });
});

describe("round 2 — cover once the roster is all shooters", () => {
  it("suppresses fire at every density", () => {
    for (const density of COVER_DENSITIES) {
      const battle = advanceBattle(
        createSpaceBattle("cover", { density, roster: "ranged" }),
        stepsFor(20),
      );
      expect(`${density}: ${String(suppressed(battle) > 0)}`).toBe(`${density}: true`);
    }
  });

  it("suppresses nothing in the plaza, whatever the roster", () => {
    for (const roster of ["mixed", "ranged", "split"] as RosterMode[]) {
      const battle = advanceBattle(createSpaceBattle("plaza", { roster }), stepsFor(20));
      expect(`${roster}: ${String(suppressed(battle))}`).toBe(`${roster}: 0`);
    }
  });
});

/* ---------------------------------------------------------------------- */
/* Round 3 — melee uses cover, and cover has a facing                      */
/* ---------------------------------------------------------------------- */

function attacking(state: SimState): number {
  return state.units.filter((unit) => unit.attackStep >= 0).length;
}

function swordsOf(state: SimState): SimUnit[] {
  return state.units.filter((unit) => {
    const profile = profileOf(unit.archetype, unit.tier);
    return postureOf(profile.standoff, profile.attackRange) === "assault";
  });
}

describe("round 3 — the shared cost field", () => {
  it("routes melee, and routes nobody when the approach is off", () => {
    const on = advanceBattle(createSpaceBattle("cover", { density: "spread" }), stepsFor(3));
    const off = advanceBattle(
      createSpaceBattle("cover", { approach: false, density: "spread" }),
      stepsFor(3),
    );
    expect(on.units.some((unit) => unit.approachCell >= 0)).toBe(true);
    expect(off.units.every((unit) => unit.approachCell === -1)).toBe(true);
  });

  it("only ever routes swords — a shooter wants a post, not a path", () => {
    const state = advanceBattle(createSpaceBattle("cover", { density: "spread" }), stepsFor(3));
    for (const unit of state.units) {
      if (unit.approachCell < 0) { continue; }
      const profile = profileOf(unit.archetype, unit.tier);
      expect(postureOf(profile.standoff, profile.attackRange)).not.toBe("firing");
    }
  });

  it("puts every waypoint on a tile a body may actually stand on", () => {
    const board = boardFor("spread");
    const state = advanceBattle(createSpaceBattle("cover", { density: "spread" }), stepsFor(4));
    for (const unit of state.units) {
      if (unit.approachCell < 0) { continue; }
      expect(walkable(board, unit.approachCell % LATTICE, Math.floor(unit.approachCell / LATTICE)))
        .toBe(true);
    }
  });

  it("does not bring round 1's clustering bug back", () => {
    // Round 1 zeroed melee's appetite because giving everyone one dropped
    // attacks 78 %. The crowd term and the lane offset exist so that the fight
    // still happens with the appetite on; this is the assertion that says so.
    for (const density of COVER_DENSITIES) {
      const on = advanceBattle(createSpaceBattle("cover", { density }), stepsFor(20));
      const off = advanceBattle(
        createSpaceBattle("cover", { approach: false, density }),
        stepsFor(20),
      );
      const before = off.units.reduce((sum, unit) => sum + (unit.firedAtStep >= 0 ? 1 : 0), 0);
      const after = on.units.reduce((sum, unit) => sum + (unit.firedAtStep >= 0 ? 1 : 0), 0);
      expect(`${density}: ${String(after >= before * 0.6)}`).toBe(`${density}: true`);
      expect(`${density}: ${String(attacking(on) > 0)}`).toBe(`${density}: true`);
    }
  });

  it("carries the approach flag through a slice boundary", () => {
    const state = createSpaceBattle("cover", { approach: false, density: "spread" });
    const back = JSON.parse(JSON.stringify(advanceBattle(state, stepsFor(2)))) as SimState;
    expect(back.approachMode).toBe(0);
    expect(advanceBattle(back, stepsFor(2)).units.every((unit) => unit.approachCell === -1))
      .toBe(true);
  });

  it("still replays exactly with melee routing", () => {
    const once = battleAt(6, { coverDensity: 1, coverMode: true });
    const twice = battleAt(6, { coverDensity: 1, coverMode: true });
    expect(twice).toEqual(once);
  });
});

describe("round 3 — cover is directional", () => {
  const board = boardFor("dense");
  const radius = bodyRadius("fodder");

  it("protects from the direction the body is tucked behind", () => {
    const prop = COVER_PROPS.find((entry) => entry.cover === "full");
    expect(prop).toBeDefined();
    if (prop === undefined) { return; }
    const rect = worldRectOf(prop.cells);
    // Standing just past the +x face, so the prop covers the -x direction.
    const x = rect.x1 + radius + 0.1;
    const z = (rect.z0 + rect.z1) / 2;
    const facing = coverFacingOf(board, x, z, radius);
    expect(facing).toBeDefined();
    if (facing === undefined) { return; }
    // A shot from further along +x arrives inside the arc: cover holds.
    expect(shieldedFrom(facing, x, z, x + 6, z)).toBe(true);
    // A shot from the side ignores it entirely — the ruling's whole content.
    expect(shieldedFrom(facing, x, z, x, z + 6)).toBe(false);
    expect(shieldedFrom(facing, x, z, x, z - 6)).toBe(false);
  });

  it("offers an elongated prop only its long faces", () => {
    // A 3x1 fence runs along x, so you shelter behind its z faces, not its ends.
    expect(usableFaces(fakeProp(3, 1))).toEqual({ alongX: false, alongZ: true });
    expect(usableFaces(fakeProp(1, 3))).toEqual({ alongX: true, alongZ: false });
    // A square mass protects on all four.
    expect(usableFaces(fakeProp(2, 2))).toEqual({ alongX: true, alongZ: true });
  });

  it("lets a flanking shot through cover that would have stopped it head-on", () => {
    const state = advanceBattle(createSpaceBattle("cover", { density: "dense" }), stepsFor(20));
    const flanked = state.units.reduce((sum, unit) => sum + unit.flankedShots, 0);
    expect(flanked).toBeGreaterThan(0);
  });
});

describe("round 3 — the three exposure states", () => {
  it("never lets a ducked body attack", () => {
    const state = createSpaceBattle("cover", { density: "dense" });
    for (let step = 0; step < stepsFor(20); step += 1) {
      advanceBattle(state, 1);
      for (const unit of state.units) {
        if (unit.coverState === DUCKED) { expect(unit.attackStep).toBeLessThan(0); }
      }
    }
  });

  it("never lets a sword peek — it has no weapon to expose", () => {
    const state = createSpaceBattle("cover", { density: "dense" });
    for (let step = 0; step < stepsFor(20); step += 1) {
      advanceBattle(state, 1);
      for (const unit of swordsOf(state)) {
        expect(unit.coverState).not.toBe(PEEKING);
      }
    }
    expect(swordsOf(state).length).toBeGreaterThan(0);
  });

  it("makes shooters buy their shots with exposure", () => {
    const state = advanceBattle(createSpaceBattle("cover", { density: "dense" }), stepsFor(20));
    expect(state.units.reduce((sum, unit) => sum + unit.peekSteps, 0)).toBeGreaterThan(0);
    expect(state.units.reduce((sum, unit) => sum + unit.duckedSteps, 0)).toBeGreaterThan(0);
  });

  it("leaves every body in the open in the plaza — nothing to duck behind", () => {
    const state = advanceBattle(createSpaceBattle("plaza"), stepsFor(20));
    expect(state.units.every((unit) => unit.coverState === OPEN)).toBe(true);
  });
});

describe("round 4: the board is a window on a fixed lattice", () => {
  it("reproduces rounds 1-3's board exactly at `compact`", () => {
    // The whole round rests on this. If the lattice refactor moved a single
    // prop, every round-4 number is measured against a different board than
    // rounds 1-3 and the comparison is worthless.
    for (const density of COVER_DENSITIES) {
      const board = boardFor(density, "compact");
      expect(board.cells).toBe(20);
      expect(board.authored.length).toBe(DENSITY_PROPS[density]);
      expect(densityReport(board).authoredPer400).toBeCloseTo(DENSITY_PROPS[density], 6);
    }
  });

  it("holds prop density per unit of floor across the area axis", () => {
    // Round 4's methodological precondition: if this drifts, the round tested
    // prop count again by accident and nothing measured on it means anything.
    for (const size of BOARD_SIZES) {
      const report = densityReport(boardFor("spread", size));
      expect(report.authoredPer400).toBeGreaterThan(15);
      expect(report.authoredPer400).toBeLessThan(17);
    }
  });

  it("scales floor per unit with area, not with side", () => {
    const compact = densityReport(boardFor("spread", "compact")).floorPerUnit;
    const vast = densityReport(boardFor("spread", "vast")).floorPerUnit;
    expect(vast / compact).toBeCloseTo(4, 5);
  });

  it("keeps a cell index meaning the same tile at every board size", () => {
    // The reason the lattice is fixed rather than per-board. `SimUnit.coverCell`
    // is a plain number that has to survive a slice boundary, so it may not
    // decode to a different tile depending on a second field.
    for (const size of BOARD_SIZES) {
      const board = boardFor("spread", size);
      const cell = cellIndexAt(0.4);
      expect(onBoard(board, cell, cell)).toBe(true);
      const centre = cellCentre(cell, cell);
      expect(cellIndexAt(centre.x)).toBe(cell);
    }
  });

  it("never places a prop whose footprint leaves the board", () => {
    // A clipped footprint is a prop whose silhouette and occupancy disagree,
    // which is the one thing the two-contract schema exists to prevent.
    for (const size of BOARD_SIZES) {
      const board = boardFor("spread", size);
      for (const prop of board.authored) {
        expect(prop.cells.cx0).toBeGreaterThanOrEqual(board.lo);
        expect(prop.cells.cy0).toBeGreaterThanOrEqual(board.lo);
        expect(prop.cells.cx1).toBeLessThanOrEqual(board.hi);
        expect(prop.cells.cy1).toBeLessThanOrEqual(board.hi);
      }
    }
  });

  it("keeps every body on the board it was deployed onto", () => {
    for (const size of BOARD_SIZES) {
      const board = boardFor("spread", size);
      const state = advanceBattle(
        createSpaceBattle("cover", { density: "spread", size }),
        stepsFor(20),
      );
      expect(unitsOffBoard(board, state)).toBe(0);
      expect(unitsInsideFootprints(board, state)).toBe(0);
    }
  });

  it("still resumes a slice bit-for-bit at every board size", () => {
    // Resumability is asserted for the compact board elsewhere; round 4 added a
    // state field, so it has to keep holding at every size.
    for (const size of BOARD_SIZES) {
      const straight = advanceBattle(
        createSpaceBattle("cover", { density: "spread", size }),
        stepsFor(8),
      );
      const boundary = advanceBattle(
        createSpaceBattle("cover", { density: "spread", size }),
        stepsFor(3),
      );
      const resumed = advanceBattle(
        JSON.parse(JSON.stringify(boundary)) as SimState,
        stepsFor(8) - stepsFor(3),
      );
      expect(resumed.units.map((unit) => [unit.x, unit.z]))
        .toEqual(straight.units.map((unit) => [unit.x, unit.z]));
    }
  });

  it("spreads the army with the board rather than resizing it", () => {
    // Round 4's fence: vary the floor, never the army.
    for (const size of BOARD_SIZES) {
      expect(createSpaceBattle("cover", { density: "spread", size }).units.length).toBe(40);
    }
    const spanOf = (state: SimState): number => {
      const along = state.units.map((unit) => (unit.x - unit.z) / Math.SQRT2);
      return Math.max(...along) - Math.min(...along);
    };
    const compact = spanOf(createSpaceBattle("plaza", { size: "compact" }));
    const vast = spanOf(createSpaceBattle("plaza", { size: "vast" }));
    expect(vast / compact).toBeCloseTo(2, 0);
  });
});

describe("round 4: the camera collision", () => {
  it("puts the crossover below the first step up the area axis", () => {
    // The number the choice turns on: past this board side, pulling back drops
    // a fodder figure out of the 22-48 px band every finding was measured in,
    // so panning stops being a preference.
    expect(FIT_BAND_FLOOR_CELLS).toBeGreaterThan(SIZE_CELLS.compact);
    expect(FIT_BAND_FLOOR_CELLS).toBeLessThan(SIZE_CELLS.broad);
  });

  it("keeps `compact` in the band under both treatments", () => {
    for (const camera of CAMERA_MODES) {
      const px = fodderPixels(zoomFor(camera, "compact"));
      expect(px).toBeGreaterThanOrEqual(LEGIBLE_PX.low);
      expect(px).toBeLessThanOrEqual(LEGIBLE_PX.high);
    }
  });

  it("drops every bigger board out of the band under `fit`", () => {
    for (const size of ["broad", "vast"] as const) {
      expect(fodderPixels(zoomFor("fit", size))).toBeLessThan(LEGIBLE_PX.low);
    }
  });

  it("holds the figure size at every board size under `pan`", () => {
    for (const size of BOARD_SIZES) {
      expect(fodderPixels(zoomFor("pan", size))).toBeCloseTo(fodderPixels(CROWD_ZOOM), 9);
    }
  });

  it("traverses the board once per half period, linearly", () => {
    const sweep = panAmplitude("vast", CROWD_ZOOM);
    expect(sweep).toBeGreaterThan(0);
    expect(panOffset(0, sweep)).toBeCloseTo(-sweep, 9);
    expect(panOffset(PAN_PERIOD / 2, sweep)).toBeCloseTo(sweep, 9);
    expect(panOffset(PAN_PERIOD, sweep)).toBeCloseTo(-sweep, 9);
    // Linear rather than eased, so the middle of a traverse is the middle of
    // the board and a 4-second filmstrip is not two shots of one edge.
    expect(panOffset(PAN_PERIOD / 4, sweep)).toBeCloseTo(0, 9);
  });

  it("holds the camera still when the board already fits", () => {
    expect(panOffset(3, 0)).toBe(0);
  });
});
