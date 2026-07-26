/**
 * The three extension points, exercised the way a downstream prototype will
 * use them. These tests exist so that "a second session can add a new unit
 * behaviour without reading PR #90's history" (#96's done-when) is a checked
 * claim rather than a hope.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  ANIMATION_STATES,
  type AnimationState,
  activeState,
  attackState,
  suppresses,
} from "./animation-states.ts";
import { UnitAnimator } from "./animator.ts";
import { ARCHETYPE_NAMES, ARCHETYPES, archetypeSpec, profileOf } from "./archetypes.ts";
import { buildUnit } from "./figure.ts";
import {
  advanceBattle,
  type Behaviour,
  BEHAVIOURS,
  battleAt,
  createBattle,
  type SimUnit,
  stepsFor,
} from "./sim.ts";

const BUILT_IN_BEHAVIOURS = [...BEHAVIOURS];
const BUILT_IN_STATES = [...ANIMATION_STATES];

afterEach(() => {
  BEHAVIOURS.splice(0, BEHAVIOURS.length, ...BUILT_IN_BEHAVIOURS);
  ANIMATION_STATES.splice(0, ANIMATION_STATES.length, ...BUILT_IN_STATES);
});

describe("extension point 1 — a new animation state", () => {
  it("wins the body when its priority is higher", () => {
    const parade: AnimationState = {
      active: () => true,
      apply: (ctx) => { ctx.addRotation("head", [0.2, 0, 0]); },
      doc: "test state",
      name: "parade",
      priority: 50,
      suppresses: ["aim", "cycle"],
    };
    ANIMATION_STATES.push(parade);
    const unit = createBattle().units[0] as SimUnit;
    unit.attackStep = 4;
    expect(activeState(unit)?.name).toBe("parade");
    expect(suppresses(activeState(unit), "cycle")).toBe(true);
  });

  it("leaves the built-in attack in charge otherwise", () => {
    const unit = createBattle().units[0] as SimUnit;
    expect(activeState(unit)).toBeUndefined();
    unit.attackStep = 0;
    expect(activeState(unit)).toBe(attackState);
  });

  it("actually reaches the rig through the animator", () => {
    const tilt: AnimationState = {
      active: () => true,
      apply: (ctx) => { ctx.addRotation("head", [1.1, 0, 0]); },
      doc: "test state",
      name: "tilt",
      priority: 99,
      suppresses: ["aim", "cycle", "lean"],
    };
    const rig = buildUnit({ archetype: "melee", faction: "crew", tier: "hero" });
    const animator = new UnitAnimator(rig, 3, { density: "quad" });
    const unit = createBattle().units[0] as SimUnit;
    animator.update(unit, 0, 1 / 60);
    const before = rig.joints.head.rotation.x;
    ANIMATION_STATES.push(tilt);
    animator.update(unit, 1 / 60, 1 / 60);
    expect(rig.joints.head.rotation.x - before).toBeGreaterThan(0.9);
  });
});

describe("extension point 2 — a new unit archetype", () => {
  it("keeps every archetype's data in one registry entry", () => {
    for (const name of ARCHETYPE_NAMES) {
      const spec = archetypeSpec(name);
      expect(typeof spec.profile).toBe("function");
      expect(typeof spec.headgear).toBe("function");
      expect(typeof spec.torsoTell).toBe("function");
      expect(typeof spec.heroKit).toBe("function");
      expect(typeof spec.weapon).toBe("function");
      expect(spec.bind).toBeTypeOf("object");
    }
  });

  it("derives the Archetype union from the registry keys", () => {
    expect(ARCHETYPE_NAMES.sort()).toEqual(Object.keys(ARCHETYPES).sort());
  });

  it("builds a complete rig for every registered archetype and tier", () => {
    for (const archetype of ARCHETYPE_NAMES) {
      for (const tier of ["hero", "fodder"] as const) {
        const rig = buildUnit({ archetype, faction: "crew", tier });
        expect(rig.cost.triangles).toBeGreaterThan(100);
        expect(rig.foregrip).toBeDefined();
        expect(rig.muzzle).toBeDefined();
      }
    }
  });

  it("gives every archetype combat numbers the behaviours can read", () => {
    for (const archetype of ARCHETYPE_NAMES) {
      for (const tier of ["hero", "fodder"] as const) {
        const profile = profileOf(archetype, tier);
        expect(profile.attackRange).toBeGreaterThan(0);
        expect(profile.cooldown).toBeGreaterThan(0);
        expect(profile.maxSpeed).toBeGreaterThan(0);
        expect(profile.standoff).toBeGreaterThan(0);
        // A unit that cannot reach its own standoff never attacks.
        expect(profile.attackRange).toBeGreaterThanOrEqual(profile.standoff);
      }
    }
  });
});

describe("extension point 3 — a new combat behaviour", () => {
  it("runs a pushed steer behaviour and changes the fight", () => {
    const before = battleAt(3).units.map((unit) => unit.x);
    const drift: Behaviour = {
      doc: "test behaviour",
      name: "drift",
      phase: "steer",
      step: (_unit, ctx) => { ctx.desiredVx += 0.6; },
    };
    BEHAVIOURS.push(drift);
    const after = battleAt(3).units.map((unit) => unit.x);
    expect(after).not.toEqual(before);
  });

  it("still replays deterministically with an extra behaviour installed", () => {
    const wobble: Behaviour = {
      doc: "test behaviour",
      name: "wobble",
      phase: "steer",
      step: (unit, ctx) => { ctx.desiredVz += Math.sin(unit.id + ctx.state.step) * 0.2; },
    };
    BEHAVIOURS.push(wobble);
    expect(battleAt(3)).toEqual(battleAt(3));
    expect(advanceBattle(battleAt(1.5), stepsFor(1.5))).toEqual(battleAt(3));
  });

  it("lets a behaviour be ablated out", () => {
    const withSeparation = battleAt(4).units.map((unit) => unit.x);
    const index = BEHAVIOURS.findIndex((behaviour) => behaviour.name === "separate");
    expect(index).toBeGreaterThanOrEqual(0);
    BEHAVIOURS.splice(index, 1);
    expect(battleAt(4).units.map((unit) => unit.x)).not.toEqual(withSeparation);
  });

  it("survives a unit being removed from the battle mid-fight", () => {
    // #101 will need this: the sim iterates by id, so a hole in the roster is
    // not a hole in anyone's turn order.
    const state = createBattle();
    advanceBattle(state, stepsFor(2));
    state.units.splice(5, 1);
    state.units.splice(11, 1);
    expect(() => advanceBattle(state, stepsFor(4))).not.toThrow();
    expect(state.units).toHaveLength(38);
    for (const unit of state.units) {
      expect(Number.isFinite(unit.x)).toBe(true);
      expect(Number.isFinite(unit.z)).toBe(true);
    }
  });
});
