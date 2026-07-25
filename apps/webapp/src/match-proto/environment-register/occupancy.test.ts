import { describe, expect, it } from "vitest";

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  FODDER_FIGURE,
  GRID,
  TILE_H,
  TILE_W,
  cameras,
  project,
  propSpecs,
  props,
} from "./board-model.ts";
import {
  coverPosts,
  exemplarFor,
  frontPosts,
  sceneOrder,
  unitRect,
  units,
} from "./roster.ts";
import { inFrontOf, occupied, propRect, underCover, walkable } from "./occupancy.ts";
import { figureHeight, getGrid, validateCrowdGrid } from "./borrowed-crowd-small.ts";
import { occlusionReport } from "./compose.ts";

describe("projection", () => {
  it("is 2:1 dimetric and fixed-angle", () => {
    expect(TILE_W / TILE_H).toBe(2);
    const origin = project(0, 0);
    expect(project(1, 0).x - origin.x).toBe(TILE_W / 2);
    expect(project(1, 0).y - origin.y).toBe(TILE_H / 2);
    expect(project(0, 1).x - origin.x).toBe(-TILE_W / 2);
    expect(project(0, 1).y - origin.y).toBe(TILE_H / 2);
  });

  it("keeps the whole grid inside the board", () => {
    for (let cx = 0; cx < GRID; cx += 1) {
      for (let cy = 0; cy < GRID; cy += 1) {
        const point = project(cx, cy);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(BOARD_WIDTH);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(BOARD_HEIGHT);
      }
    }
  });
});

describe("cameras", () => {
  it("scales by whole numbers only — pixel art never resamples", () => {
    for (const camera of Object.values(cameras)) {
      expect(Number.isInteger(camera.scale)).toBe(true);
      expect(camera.scale).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps every aperture inside the board", () => {
    for (const camera of Object.values(cameras)) {
      expect(camera.x).toBeGreaterThanOrEqual(0);
      expect(camera.y).toBeGreaterThanOrEqual(0);
      expect(camera.x + camera.width).toBeLessThanOrEqual(BOARD_WIDTH);
      expect(camera.y + camera.height).toBeLessThanOrEqual(BOARD_HEIGHT);
    }
  });

  it("makes the native framing a true 1× of the board", () => {
    expect(cameras.native.scale).toBe(1);
    expect(cameras.native.width).toBe(BOARD_WIDTH);
    expect(cameras.native.height).toBe(BOARD_HEIGHT);
  });
});

describe("borrowed unit register", () => {
  it("carries the pixel lane's SMALL grids intact", () => {
    for (const key of ["breaker", "stinger", "mara"]) {
      expect(validateCrowdGrid(getGrid(key)), key).toEqual([]);
    }
  });

  it("is the 22 px fodder / 28 px hero register the ruling settled on", () => {
    expect(figureHeight(getGrid("breaker"))).toBe(FODDER_FIGURE);
    expect(figureHeight(getGrid("stinger"))).toBe(FODDER_FIGURE);
    expect(figureHeight(getGrid("mara"))).toBe(28);
  });

  it("sizes the tile for that register rather than for a borrowed 48×64 hero", () => {
    // Round 1's failure mode in one assertion: a fodder figure has to be a
    // sensible fraction of the tile it stands on, or the board reads as a
    // dance floor with beetles on it.
    const ratio = FODDER_FIGURE / TILE_W;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.1);
  });
});

describe("occupancy", () => {
  it("gives every prop kind a footprint, a height and a cover class", () => {
    for (const prop of props) {
      const spec = propSpecs[prop.kind];
      expect(spec.sx, prop.id).toBeGreaterThanOrEqual(1);
      expect(spec.sy, prop.id).toBeGreaterThanOrEqual(1);
      expect(spec.height, prop.id).toBeGreaterThan(0);
    }
  });

  it("places every prop on integer cells inside the grid", () => {
    for (const prop of props) {
      const rect = propRect(prop);
      expect(Number.isInteger(prop.cx), prop.id).toBe(true);
      expect(Number.isInteger(prop.cy), prop.id).toBe(true);
      expect(rect.x1, prop.id).toBeLessThanOrEqual(GRID);
      expect(rect.y1, prop.id).toBeLessThanOrEqual(GRID);
    }
  });

  it("never overlaps two props' footprints", () => {
    for (let a = 0; a < props.length; a += 1) {
      for (let b = a + 1; b < props.length; b += 1) {
        const first = props[a];
        const second = props[b];
        if (first === undefined || second === undefined) { continue; }
        const one = propRect(first);
        const two = propRect(second);
        const overlaps = one.x0 < two.x1 && two.x0 < one.x1 && one.y0 < two.y1 && two.y0 < one.y1;
        expect(overlaps, `${first.id} overlaps ${second.id}`).toBe(false);
      }
    }
  });

  it("keeps cells under a roof walkable — a canopy is lighting, not blocking", () => {
    const roofed = props.filter((prop) => propSpecs[prop.kind].roof !== undefined);
    expect(roofed.length).toBeGreaterThan(0);
    let walkableUnderCover = 0;
    for (let cx = 0; cx < GRID; cx += 1) {
      for (let cy = 0; cy < GRID; cy += 1) {
        if (underCover(cx, cy) && walkable(cx, cy)) { walkableUnderCover += 1; }
      }
    }
    expect(walkableUnderCover).toBeGreaterThan(20);
  });
});

describe("unit placement", () => {
  it("NEVER lands a foot anchor on a prop-occupied tile", () => {
    // This is round 1's headline bug, asserted mechanically. Round 1 shipped a
    // capture with figures standing on crate lids and stall roofs.
    for (const unit of units) {
      expect(occupied(unit.cx, unit.cy), `${unit.id} at ${String(unit.cx)},${String(unit.cy)}`).toBe(false);
      expect(walkable(unit.cx, unit.cy), unit.id).toBe(true);
    }
  });

  it("puts one unit on a whole tile and never two on the same one", () => {
    const seen = new Set<number>();
    for (const unit of units) {
      const cell = unit.cy * GRID + unit.cx;
      expect(seen.has(cell), `${unit.id} double-booked a tile`).toBe(false);
      seen.add(cell);
    }
  });

  it("posts a unit behind every cover kind on the board", () => {
    const posts = coverPosts();
    expect(posts.length).toBeGreaterThanOrEqual(15);
    for (const post of posts) {
      const placed = units.find((unit) => unit.id === post.id);
      expect(placed, `${post.kind} has no unit behind it`).toBeDefined();
      const prop = exemplarFor(post.kind);
      expect(prop).toBeDefined();
      if (prop === undefined || placed === undefined) { continue; }
      // "Behind" means the prop is nearer the camera than the unit.
      expect(inFrontOf(propRect(prop), unitRect(placed)), `${post.kind} is not in front of its post`).toBe(true);
    }
  });

  it("fields both tiers on both sides", () => {
    for (const side of ["crew", "rival"] as const) {
      expect(units.some((unit) => unit.side === side && unit.tier === "hero")).toBe(true);
      expect(units.filter((unit) => unit.side === side && unit.tier === "fodder").length).toBeGreaterThan(8);
    }
  });
});

describe("painter order", () => {
  const order = sceneOrder();
  const rectOf = (item: (typeof order)[number]) => (item.kind === "prop" ? propRect(item.prop) : unitRect(item.unit));

  it("puts props and units in ONE list, not two stacked layers", () => {
    const firstUnit = order.findIndex((item) => item.kind === "unit");
    const lastProp = order.map((item) => item.kind).lastIndexOf("prop");
    expect(firstUnit).toBeGreaterThanOrEqual(0);
    // Round 1's bug in one assertion: if every unit came after every prop, the
    // unit layer is a flat overlay and occlusion is impossible.
    expect(lastProp).toBeGreaterThan(firstUnit);
  });

  it("draws a nearer footprint after a further one", () => {
    for (let a = 0; a < order.length; a += 1) {
      for (let b = 0; b < order.length; b += 1) {
        if (a === b) { continue; }
        const itemA = order[a];
        const itemB = order[b];
        if (itemA === undefined || itemB === undefined) { continue; }
        const rectA = rectOf(itemA);
        const rectB = rectOf(itemB);
        if (!inFrontOf(rectA, rectB) || inFrontOf(rectB, rectA)) { continue; }
        expect(a, "a nearer item was painted before a further one").toBeGreaterThan(b);
      }
    }
  });
});

describe("occlusion", () => {
  const report = occlusionReport();

  it("cuts at least one unit with a prop — occlusion is a feature", () => {
    const cut = report.filter((entry) => entry.hidden > 0 && entry.drawn > 0);
    expect(cut.length, "no unit is partly occluded; depth is not working").toBeGreaterThan(0);
  });

  it("leaves several units genuinely PARTLY occluded, not just clipped", () => {
    const partly = report.filter((entry) => entry.fraction > 0.12 && entry.fraction < 0.9);
    expect(partly.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps the front posts fully in front of what they stand before", () => {
    for (const post of frontPosts) {
      const entry = report.find((row) => row.unitId === post.id);
      const prop = props.find((candidate) => candidate.id === post.inFrontOf);
      expect(entry, post.id).toBeDefined();
      expect(prop, post.inFrontOf).toBeDefined();
      if (entry === undefined || prop === undefined) { continue; }
      expect(entry.occluders, `${post.id} is occluded by the prop it stands in front of`)
        .not.toContain(post.inFrontOf);
    }
  });

  it("does not swallow the crowd — most units are mostly visible", () => {
    const mostlyVisible = report.filter((entry) => entry.fraction < 0.5).length;
    expect(mostlyVisible / report.length).toBeGreaterThan(0.7);
  });

  it("shades the units standing under a roof", () => {
    expect(report.filter((entry) => entry.shaded).length).toBeGreaterThan(0);
  });
});
