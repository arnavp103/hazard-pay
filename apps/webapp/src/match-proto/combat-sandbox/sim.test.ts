import { describe, expect, it } from "vitest";

import { HERO_HEIGHT, TIER_SCALE } from "./figure.ts";
import {
  advanceBattle,
  ATTACK_STEPS,
  attackPhaseOf,
  battleAt,
  cloneBattle,
  createBattle,
  FIXED_STEP,
  RELEASE_STEP,
  type SimState,
  type SimUnit,
  sliceBattle,
  stepBattle,
  stepsFor,
} from "./sim.ts";

function advance(seconds: number, state = createBattle()): SimState {
  return advanceBattle(state, stepsFor(seconds));
}

function snapshot(units: SimUnit[]): string {
  return [...units]
    .sort((a, b) => a.id - b.id)
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

  it("fields the ~40 bodies the bake-off converged on, by default", () => {
    expect(createBattle().units).toHaveLength(40);
  });

  it("puts the medic hero on the crew side", () => {
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

  it("lets a caller swap the roster without touching the layout", () => {
    const state = createBattle({ fodderArchetypeAt: () => "medic" });
    const fodder = state.units.filter((unit) => unit.tier === "fodder");
    expect(fodder.every((unit) => unit.archetype === "medic")).toBe(true);
    // Layout is unchanged: the same slots, the same jitter draws.
    const positions = state.units.map((u) => `${u.x},${u.z}`).join("|");
    const base = createBattle().units.map((u) => `${u.x},${u.z}`).join("|");
    expect(positions).toBe(base);
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

  it("does not depend on the order units sit in the array", () => {
    // The step sorts by id and double-buffers the steering, so shuffling the
    // array cannot change the result — not even in the order floats sum.
    const straight = createBattle();
    const shuffled = createBattle();
    shuffled.units.reverse();
    advanceBattle(straight, stepsFor(6));
    advanceBattle(shuffled, stepsFor(6));
    expect(snapshot(shuffled.units)).toBe(snapshot(straight.units));
  });

  it("keeps time on an integer clock, so `t` cannot drift", () => {
    const state = advance(10);
    expect(state.step).toBe(600);
    expect(state.t).toBe(600 * FIXED_STEP);
  });

  it("gives every unit its own random stream", () => {
    const state = createBattle();
    const streams = new Set(state.units.map((unit) => unit.randomState));
    expect(streams.size).toBe(state.units.length);
  });
});

describe("slices resume instead of replaying", () => {
  const HALF = stepsFor(3);

  it("advancing from a mid-battle state equals simulating straight through", () => {
    const straight = battleAt(6);
    const resumed = advanceBattle(battleAt(3), HALF);
    expect(resumed).toEqual(straight);
  });

  it("survives a JSON round-trip of the boundary state", () => {
    // This is the whole point of the serialisable state: the slice boundary
    // has to be storable and shippable, not just re-runnable.
    const boundary = battleAt(3);
    const shipped = JSON.parse(JSON.stringify(boundary)) as SimState;
    expect(shipped).toEqual(boundary);
    expect(advanceBattle(shipped, HALF)).toEqual(battleAt(6));
  });

  it("survives structuredClone too", () => {
    const resumed = advanceBattle(structuredClone(battleAt(3)), HALF);
    expect(resumed).toEqual(battleAt(6));
  });

  it("tiles the timeline exactly across many slices", () => {
    let slice = sliceBattle(createBattle(), stepsFor(1));
    for (let i = 0; i < 5; i += 1) { slice = sliceBattle(slice.end, stepsFor(1)); }
    expect(slice.toStep).toBe(stepsFor(6));
    expect(slice.end).toEqual(battleAt(6));
  });

  it("reports the window it covered", () => {
    const slice = sliceBattle(battleAt(2), stepsFor(5));
    expect(slice.fromStep).toBe(stepsFor(2));
    expect(slice.toStep).toBe(stepsFor(7));
    expect(slice.steps).toBe(stepsFor(5));
    expect(slice.from).toBeCloseTo(2, 9);
    expect(slice.to).toBeCloseTo(7, 9);
  });

  it("records one frame per step when asked, and none when not", () => {
    const recorded = sliceBattle(createBattle(), stepsFor(0.5), { record: true });
    expect(recorded.frames).toHaveLength(stepsFor(0.5));
    expect(recorded.frames[0]).toHaveLength(40);
    expect(sliceBattle(createBattle(), stepsFor(0.5)).frames).toHaveLength(0);
  });

  it("leaves the source state untouched when copying", () => {
    const source = battleAt(2);
    const before = cloneBattle(source);
    const slice = sliceBattle(source, stepsFor(2), { copy: true });
    expect(source).toEqual(before);
    expect(slice.end.step).toBe(stepsFor(4));
  });
});

describe("engagement", () => {
  it("closes the gap between the lines", () => {
    const depth = (state: SimState, side: number): number => {
      const mine = state.units.filter((u) => u.side === side);
      return mine.reduce((sum, u) => sum + (u.x + u.z) / 2, 0) / mine.length;
    };
    const start = createBattle();
    const openingGap = Math.abs(depth(start, 0) - depth(start, 1));
    const later = advance(10);
    expect(Math.abs(depth(later, 0) - depth(later, 1))).toBeLessThan(openingGap);
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
    expect(state.units.filter((unit) => unit.firedAtStep >= 0).length).toBeGreaterThan(8);
    expect(state.units.filter((unit) => unit.hitAtStep >= 0).length).toBeGreaterThan(8);
  });

  it("releases damage partway through the swing, not on the first step", () => {
    expect(RELEASE_STEP).toBeGreaterThan(ATTACK_STEPS * 0.2);
    expect(RELEASE_STEP).toBeLessThan(ATTACK_STEPS * 0.8);
  });

  it("desynchronises attacks instead of firing the whole line at once", () => {
    const state = advance(14);
    const firing = state.units.filter((unit) => unit.attackStep >= 0);
    const phases = new Set(firing.map((unit) => Math.round(attackPhaseOf(unit) * 8)));
    // If the crowd were synchronised, every attacker would share one bucket.
    expect(phases.size).toBeGreaterThan(1);
  });

  it("never lets the attack clip run past its own length", () => {
    // The float version of this comparison had a 1.67e-15 margin. The integer
    // version cannot miss.
    const state = createBattle();
    for (let i = 0; i < stepsFor(20); i += 1) {
      stepBattle(state);
      for (const unit of state.units) {
        expect(unit.attackStep).toBeLessThan(ATTACK_STEPS);
        expect(attackPhaseOf(unit)).toBeLessThan(1);
      }
    }
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
  it("keeps the hero boost inside the 1.2-1.3x ruling", () => {
    expect(TIER_SCALE).toBeGreaterThanOrEqual(1.2);
    expect(TIER_SCALE).toBeLessThanOrEqual(1.3);
    expect(HERO_HEIGHT).toBeCloseTo(1.85, 6);
  });
});
