/**
 * #101. The attrition layer, checked the way the sandbox checks itself: the
 * control is bit-identical to the shipped fight, every treatment resumes
 * exactly, and the two #97 couplings are measured rather than quoted.
 */

import { afterEach, describe, expect, it } from "vitest";

import { ANIMATION_STATES } from "./animation-states.ts";
import { UnitAnimator } from "./animator.ts";
import { measureAttrition, percent } from "./attrition-metrics.ts";
import {
  ATTRITION_NAMES,
  ATTRITION_TREATMENTS,
  COLLAPSE_STEPS,
  FODDER_HP,
  HERO_HP,
  installAttrition,
  isDead,
  treatmentOf,
} from "./attrition.ts";
import { buildUnit } from "./figure.ts";
import {
  advanceBattle,
  BEHAVIOURS,
  battleAt,
  cloneBattle,
  createBattle,
  FIXED_STEP,
  type SimState,
  type SimUnit,
  stepsFor,
} from "./sim.ts";

const BUILT_IN_BEHAVIOURS = [...BEHAVIOURS];
const BUILT_IN_STATES = [...ANIMATION_STATES];

afterEach(() => {
  BEHAVIOURS.splice(0, BEHAVIOURS.length, ...BUILT_IN_BEHAVIOURS);
  ANIMATION_STATES.splice(0, ANIMATION_STATES.length, ...BUILT_IN_STATES);
});

function snapshot(state: SimState): string {
  return [...state.units]
    .sort((a, b) => a.id - b.id)
    .map((u) => `${u.id}:${u.x.toFixed(6)},${u.z.toFixed(6)},${u.facing.toFixed(6)},${u.hp}`)
    .join("|");
}

function fight(name: string, seconds: number, commit = true): SimState {
  const restore = installAttrition(treatmentOf(name), { commit });
  try {
    return advanceBattle(createBattle(), stepsFor(seconds));
  } finally {
    restore();
  }
}

describe("the control changes nothing", () => {
  it("leaves the shipped fight bit-identical with no treatment installed", () => {
    const shipped = snapshot(battleAt(8));
    expect(snapshot(fight("none", 8))).toBe(shipped);
  });

  it("leaves the registries as it found them after an uninstall", () => {
    const before = BEHAVIOURS.map((b) => b.name).join(",");
    const restore = installAttrition(ATTRITION_TREATMENTS.debris);
    expect(BEHAVIOURS.map((b) => b.name).join(",")).not.toBe(before);
    restore();
    expect(BEHAVIOURS.map((b) => b.name).join(",")).toBe(before);
    expect(ANIMATION_STATES.map((s) => s.name).join(",")).toBe(
      BUILT_IN_STATES.map((s) => s.name).join(","),
    );
  });

  it("seeds the stand-in hit points on every unit without anything reading them", () => {
    for (const unit of createBattle().units) {
      expect(unit.hp).toBe(unit.tier === "hero" ? HERO_HP : FODDER_HP);
      expect(unit.deathStep).toBe(-1);
    }
    expect(battleAt(6).units.every((unit) => !isDead(unit))).toBe(true);
  });

  it("registers an unknown ?death= value as the control rather than throwing", () => {
    expect(treatmentOf("nonsense").name).toBe("none");
    expect(treatmentOf(null).name).toBe("none");
  });
});

describe("every treatment stays deterministic and resumable", () => {
  for (const name of ATTRITION_NAMES) {
    it(`replays and resumes identically under ${name}`, () => {
      const restore = installAttrition(treatmentOf(name));
      try {
        const whole = advanceBattle(createBattle(), stepsFor(9));
        const halves = advanceBattle(
          // Through a JSON round trip, because a slice boundary is stored.
          JSON.parse(JSON.stringify(advanceBattle(createBattle(), stepsFor(4)))) as SimState,
          stepsFor(5),
        );
        expect(snapshot(halves)).toBe(snapshot(whole));
        expect(halves.units).toHaveLength(whole.units.length);
        const again = advanceBattle(createBattle(), stepsFor(9));
        expect(snapshot(again)).toBe(snapshot(whole));
      } finally {
        restore();
      }
    });
  }

  it("does not depend on the order units sit in the roster array", () => {
    const restore = installAttrition(ATTRITION_TREATMENTS.downed);
    try {
      const forward = advanceBattle(createBattle(), stepsFor(9));
      const shuffled = cloneBattle(createBattle());
      shuffled.units.reverse();
      advanceBattle(shuffled, stepsFor(9));
      expect(snapshot(shuffled)).toBe(snapshot(forward));
    } finally {
      restore();
    }
  });
});

describe("units die, and leave the field the way the treatment says", () => {
  it("kills nobody under the control and plenty under every other treatment", () => {
    expect(fight("none", 20).units.filter(isDead)).toHaveLength(0);
    for (const name of ATTRITION_NAMES.filter((entry) => entry !== "none")) {
      const state = fight(name, 20);
      const started = 40;
      const standing = state.units.filter((unit) => !isDead(unit)).length;
      expect(standing).toBeLessThan(started);
      expect(standing).toBeGreaterThan(0);
    }
  });

  it("keeps every body in the roster under downed and debris", () => {
    for (const name of ["debris", "downed"]) {
      const state = fight(name, 20);
      expect(state.units).toHaveLength(40);
      expect(state.units.filter(isDead).length).toBeGreaterThan(0);
    }
  });

  it("splices bodies out under removed, and keeps none at all", () => {
    const state = fight("removed", 20);
    expect(state.units.length).toBeLessThan(40);
    expect(state.units.filter(isDead)).toHaveLength(0);
  });

  it("holds a fading body long enough for a swing to follow through, then drops it", () => {
    const linger = ATTRITION_TREATMENTS.fade.lingerSteps;
    // A release lands at 42 % of a 1.2 s clip, so ~0.7 s of recovery follows.
    expect(linger * FIXED_STEP).toBeGreaterThan(0.7);
    const state = fight("fade", 20);
    expect(state.units.length).toBeLessThan(40);
    for (const body of state.units.filter(isDead)) {
      expect(state.step - body.deathStep).toBeLessThan(linger);
    }
  });

  it("stops a corpse dead instead of letting the living shove it around", () => {
    const restore = installAttrition(ATTRITION_TREATMENTS.downed);
    try {
      const state = advanceBattle(createBattle(), stepsFor(10));
      const corpse = state.units.find(isDead);
      expect(corpse).toBeDefined();
      const at = { x: corpse?.x ?? 0, z: corpse?.z ?? 0 };
      advanceBattle(state, stepsFor(6));
      const after = state.units.find((unit) => unit.id === corpse?.id);
      expect(Math.hypot((after?.x ?? 0) - at.x, (after?.z ?? 0) - at.z)).toBeLessThan(0.05);
      expect(after?.attackStep).toBe(-1);
      expect(after?.targetId).toBe(-1);
    } finally {
      restore();
    }
  });
});

describe("the block narrows and shallows under ranks", () => {
  it("assigns every survivor a slot", () => {
    const state = fight("ranks", 12);
    for (const unit of state.units) {
      expect(Number.isFinite(unit.slotX)).toBe(true);
      expect(Number.isFinite(unit.slotZ)).toBe(true);
    }
  });

  it("drops the rear rank once the survivors fit in one", () => {
    const state = fight("ranks", 22);
    const crew = state.units.filter((unit) => unit.side === 0 && !isDead(unit));
    expect(crew.length).toBeLessThanOrEqual(10);
    // One rank means every slot sits at the same depth along the approach axis.
    const depths = crew.map((unit) => (unit.slotX + unit.slotZ) * Math.SQRT1_2);
    expect(Math.max(...depths) - Math.min(...depths)).toBeLessThan(0.01);
  });

  it("is narrower and shallower than plain removal at the same strength", () => {
    // Matched on survivors, not on time: closing gaps also slows the charge, so
    // comparing the same wall-clock second would compare two different fights.
    const closing = measureAttrition(ATTRITION_TREATMENTS.ranks, { every: 0.5, seconds: 24 });
    const plain = measureAttrition(ATTRITION_TREATMENTS.removed, { every: 0.5, seconds: 24 });
    const at = (report: typeof closing, alive: number): { w: number; h: number } => {
      const sample = report.samples.find((entry) => entry.alive <= alive);
      return { h: sample?.boxHeight ?? 0, w: sample?.boxWidth ?? 0 };
    };
    for (const strength of [30, 24, 18]) {
      expect(at(closing, strength).w).toBeLessThan(at(plain, strength).w);
      expect(at(closing, strength).h).toBeLessThan(at(plain, strength).h);
    }
  });
});

describe("the two #97 couplings, measured against this fight", () => {
  const seconds = 20;

  it("takes mid-swing target flips to zero when commitment is installed", () => {
    const loose = measureAttrition(ATTRITION_TREATMENTS.downed, { commit: false, seconds });
    const committed = measureAttrition(ATTRITION_TREATMENTS.downed, { commit: true, seconds });
    expect(loose.attacks).toBeGreaterThan(40);
    expect(committed.attacks).toBeGreaterThan(40);
    expect(committed.midSwingFlips).toBe(0);
    expect(loose.midSwingFlips).toBeGreaterThan(0);
  });

  it("buys that with more time spent aimed at something already dead", () => {
    const loose = measureAttrition(ATTRITION_TREATMENTS.downed, { commit: false, seconds });
    const committed = measureAttrition(ATTRITION_TREATMENTS.downed, { commit: true, seconds });
    expect(percent(committed.aimedAtDeadFrames, committed.livingUnitFrames))
      .toBeGreaterThan(percent(loose.aimedAtDeadFrames, loose.livingUnitFrames));
  });

  it("gives the fight an arc: a first death, a half-strength moment, survivors", () => {
    const report = measureAttrition(ATTRITION_TREATMENTS.downed, { seconds });
    expect(report.firstDeathStep).toBeGreaterThan(0);
    expect(report.halfStrengthStep).toBeGreaterThan(report.firstDeathStep);
    const last = report.samples[report.samples.length - 1];
    expect(last?.alive).toBeLessThan(40);
    expect(last?.bodies).toBe(40);
  });

  it("has no arc at all under the control — the thing #101 exists to ask about", () => {
    const report = measureAttrition(ATTRITION_TREATMENTS.none, { seconds });
    expect(report.firstDeathStep).toBe(-1);
    expect(report.samples.every((sample) => sample.alive === 40)).toBe(true);
  });
});

describe("the death state owns the body", () => {
  it("suppresses the whole procedural stack", () => {
    for (const name of ["debris", "downed", "fade"]) {
      const restore = installAttrition(treatmentOf(name));
      try {
        const state = ANIMATION_STATES.find((entry) => entry.name.startsWith("death"));
        expect(state).toBeDefined();
        for (const layer of ["aim", "cycle", "ik", "lean", "react"] as const) {
          expect(state?.suppresses?.includes(layer)).toBe(true);
        }
        expect(state?.priority ?? 0).toBeGreaterThan(10);
      } finally {
        restore();
      }
    }
  });

  it("topples the root about the feet, which the layer stack could not do before", () => {
    const restore = installAttrition(ATTRITION_TREATMENTS.downed);
    try {
      const rig = buildUnit({ archetype: "melee", faction: "crew", tier: "fodder" });
      const animator = new UnitAnimator(rig, 3, { density: "quad" });
      const unit = createBattle().units[0] as SimUnit;
      animator.update(unit, 0, FIXED_STEP);
      expect(rig.root.rotation.x).toBe(0);
      unit.deathStep = 0;
      animator.update(unit, COLLAPSE_STEPS * FIXED_STEP, FIXED_STEP);
      // A standing figure rotated about its feet by more than a radian is on
      // the ground; less than that and it is merely leaning.
      expect(rig.root.rotation.x).toBeGreaterThan(1);
      expect(rig.root.rotation.order).toBe("YXZ");
    } finally {
      restore();
    }
  });
});
