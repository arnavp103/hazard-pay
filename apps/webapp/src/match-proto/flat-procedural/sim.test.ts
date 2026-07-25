import { describe, expect, it } from "vitest";

import { HERO_HEIGHT, TIER_SCALE } from "./figure.ts";
import { battleAt, createBattle, RELEASE_AT, type SimUnit, stepBattle } from "./sim.ts";

function advance(seconds: number, state = createBattle()): typeof state {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds / dt); i += 1) { stepBattle(state, dt); }
  return state;
}

function snapshot(units: SimUnit[]): string {
  return units
    .map((u) => `${u.id}:${u.x.toFixed(5)},${u.z.toFixed(5)},${u.facing.toFixed(5)}`)
    .join("|");
}

describe("battle composition", () => {
  it("fields both tiers and both fodder archetypes on each side", () => {
    const state = createBattle();
    for (const side of [0, 1]) {
      const mine = state.units.filter((unit) => unit.side === side);
      expect(mine.filter((unit) => unit.tier === "hero")).toHaveLength(2);
      expect(mine.filter((unit) => unit.tier === "fodder")).toHaveLength(18);
      const fodder = mine.filter((unit) => unit.tier === "fodder");
      expect(fodder.some((unit) => unit.archetype === "melee")).toBe(true);
      expect(fodder.some((unit) => unit.archetype === "ranged")).toBe(true);
    }
  });

  it("puts Mara Voss — the medic hero — on the crew side", () => {
    const state = createBattle();
    const medics = state.units.filter((unit) => unit.archetype === "medic");
    expect(medics).toHaveLength(1);
    expect(medics[0]?.tier).toBe("hero");
    expect(medics[0]?.side).toBe(0);
  });

  it("starts the two lines apart and facing each other", () => {
    const state = createBattle();
    const crew = state.units.filter((unit) => unit.side === 0);
    const opfor = state.units.filter((unit) => unit.side === 1);
    const crewDepth = crew.reduce((sum, u) => sum + (u.x + u.z) / 2, 0) / crew.length;
    const opforDepth = opfor.reduce((sum, u) => sum + (u.x + u.z) / 2, 0) / opfor.length;
    expect(crewDepth).toBeGreaterThan(3);
    expect(opforDepth).toBeLessThan(-3);
  });

  it("does not stack two units on the same spot", () => {
    const state = createBattle();
    for (const a of state.units) {
      for (const b of state.units) {
        if (a.id >= b.id) { continue; }
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.4);
      }
    }
  });
});

describe("determinism", () => {
  it("replays identically from the same seed", () => {
    expect(snapshot(advance(6).units)).toBe(snapshot(advance(6).units));
  });

  it("battleAt matches an equivalent hand-stepped run", () => {
    expect(snapshot(battleAt(4).units)).toBe(snapshot(advance(4).units));
  });

  it("diverges under a different seed", () => {
    const a = advance(4, createBattle({ seed: 1 }));
    const b = advance(4, createBattle({ seed: 2 }));
    expect(snapshot(a.units)).not.toBe(snapshot(b.units));
  });
});

describe("engagement", () => {
  it("closes the gap between the lines", () => {
    const start = createBattle();
    const openingGap = Math.abs(
      start.units.filter((u) => u.side === 0).reduce((s, u) => s + (u.x + u.z) / 2, 0) / 20
      - start.units.filter((u) => u.side === 1).reduce((s, u) => s + (u.x + u.z) / 2, 0) / 20,
    );
    const later = advance(10);
    const closedGap = Math.abs(
      later.units.filter((u) => u.side === 0).reduce((s, u) => s + (u.x + u.z) / 2, 0) / 20
      - later.units.filter((u) => u.side === 1).reduce((s, u) => s + (u.x + u.z) / 2, 0) / 20,
    );
    expect(closedGap).toBeLessThan(openingGap);
  });

  it("keeps units from interpenetrating once engaged", () => {
    const state = advance(12);
    let overlaps = 0;
    for (const a of state.units) {
      for (const b of state.units) {
        if (a.id >= b.id) { continue; }
        if (Math.hypot(a.x - b.x, a.z - b.z) < 0.42) { overlaps += 1; }
      }
    }
    expect(overlaps).toBe(0);
  });

  it("produces attacks, releases and incoming hits", () => {
    const state = advance(14);
    expect(state.units.filter((unit) => unit.firedAt >= 0).length).toBeGreaterThan(8);
    expect(state.units.filter((unit) => unit.hitAt >= 0).length).toBeGreaterThan(8);
  });

  it("releases damage partway through the swing, not on the first frame", () => {
    expect(RELEASE_AT).toBeGreaterThan(0.2);
    expect(RELEASE_AT).toBeLessThan(0.8);
  });

  it("desynchronises attacks instead of firing the whole line at once", () => {
    const state = advance(14);
    const firing = state.units.filter((unit) => unit.attackPhase >= 0);
    const phases = new Set(firing.map((unit) => Math.round(unit.attackPhase * 8)));
    // If the crowd were synchronised, every attacker would share one bucket.
    expect(phases.size).toBeGreaterThan(1);
  });

  it("faces units at what they are aiming at once they stop", () => {
    const state = advance(16);
    const planted = state.units.filter((unit) => unit.speed < 0.2);
    expect(planted.length).toBeGreaterThan(3);
    for (const unit of planted) {
      const wanted = Math.atan2(unit.aimX - unit.x, unit.aimZ - unit.z);
      const delta = Math.abs(Math.atan2(
        Math.sin(wanted - unit.facing),
        Math.cos(wanted - unit.facing),
      ));
      expect(delta).toBeLessThan(1.2);
    }
  });

  it("stays finite for a long run", () => {
    const state = advance(40);
    for (const unit of state.units) {
      expect(Number.isFinite(unit.x)).toBe(true);
      expect(Number.isFinite(unit.z)).toBe(true);
      expect(Math.hypot(unit.x, unit.z)).toBeLessThan(30);
    }
  });
});

describe("tier separation is size + detail only", () => {
  it("keeps the hero boost inside the cofounder's 1.2-1.3x ruling", () => {
    expect(TIER_SCALE).toBeGreaterThanOrEqual(1.2);
    expect(TIER_SCALE).toBeLessThanOrEqual(1.3);
    expect(HERO_HEIGHT).toBeCloseTo(1.85, 6);
  });
});
