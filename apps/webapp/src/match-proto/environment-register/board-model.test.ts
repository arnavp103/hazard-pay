import { describe, expect, it } from "vitest";

import {
  AMBIENT_FRAMES,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GRID,
  TILE_H,
  TILE_W,
  ambientAt,
  cameras,
  groundAt,
  project,
  props,
  sortedProps,
  units,
} from "./board-model.ts";
import { FODDER_HEIGHT } from "./unit-sprites.ts";
import { MEDIC_HEIGHT } from "./borrowed-medic-48.ts";

describe("projection", () => {
  it("is 2:1 dimetric and fixed-angle", () => {
    expect(TILE_W / TILE_H).toBe(2);
    const origin = project(0, 0);
    const east = project(1, 0);
    const south = project(0, 1);
    expect(east.x - origin.x).toBe(TILE_W / 2);
    expect(east.y - origin.y).toBe(TILE_H / 2);
    expect(south.x - origin.x).toBe(-TILE_W / 2);
    expect(south.y - origin.y).toBe(TILE_H / 2);
  });

  it("keeps the whole grid inside the board", () => {
    for (let cx = 0; cx < GRID; cx += 1) {
      for (let cy = 0; cy < GRID; cy += 1) {
        const point = project(cx, cy);
        expect(point.x).toBeGreaterThanOrEqual(-TILE_W);
        expect(point.x).toBeLessThanOrEqual(BOARD_WIDTH + TILE_W);
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

  it("emits the same capture size for the combat and crowd framings", () => {
    expect(cameras.combat.width * cameras.combat.scale).toBe(cameras.crowd.width * cameras.crowd.scale);
    expect(cameras.combat.height * cameras.combat.scale).toBe(cameras.crowd.height * cameras.crowd.scale);
  });

  it("keeps every aperture inside the board", () => {
    for (const camera of Object.values(cameras)) {
      expect(camera.x + camera.width).toBeLessThanOrEqual(BOARD_WIDTH);
      expect(camera.y + camera.height).toBeLessThanOrEqual(BOARD_HEIGHT);
    }
  });
});

describe("board content", () => {
  it("is deterministic — the floor plan has no RNG", () => {
    const first = Array.from({ length: GRID }, (_, cx) => groundAt(cx, cx));
    const second = Array.from({ length: GRID }, (_, cx) => groundAt(cx, cx));
    expect(second).toEqual(first);
  });

  it("keeps the walkable aisle clear of everything but lamps and signs", () => {
    const interior = props.filter((prop) => prop.cx > 1 && prop.cy > 1 && prop.cx < GRID - 2 && prop.cy < GRID - 2);
    const inAisle = interior.filter((prop) => Math.abs(prop.cx - prop.cy) <= 1
      || (prop.cx + prop.cy >= 18 && prop.cx + prop.cy <= 20));
    for (const prop of inAisle) {
      expect(["lampPost", "signPylon"]).toContain(prop.kind);
    }
  });

  it("sorts props back to front for painter compositing", () => {
    const order = sortedProps().map((prop) => prop.cx + prop.cy);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("unit roster", () => {
  it("carries both tiers on both sides", () => {
    for (const side of ["crew", "rival"] as const) {
      expect(units.some((unit) => unit.side === side && unit.tier === "hero")).toBe(true);
      expect(units.filter((unit) => unit.side === side && unit.tier === "fodder").length).toBeGreaterThan(10);
    }
  });

  it("uses the slight hero size boost from the tier-separation ruling", () => {
    const ratio = MEDIC_HEIGHT / FODDER_HEIGHT;
    expect(ratio).toBeGreaterThan(1.15);
    expect(ratio).toBeLessThan(1.35);
  });
});

describe("ambient schedule", () => {
  it("loops and is deterministic", () => {
    for (let frame = 0; frame < AMBIENT_FRAMES; frame += 1) {
      expect(ambientAt(frame)).toEqual(ambientAt(frame + AMBIENT_FRAMES));
    }
  });

  it("dims at least one signal channel somewhere in the loop", () => {
    const levels = Array.from({ length: AMBIENT_FRAMES }, (_, frame) => ambientAt(frame).amber);
    expect(Math.min(...levels)).toBeLessThan(1);
  });
});
