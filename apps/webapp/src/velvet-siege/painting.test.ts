import { describe, expect, it } from "vitest";

import { DURATION, enginePosition, ENGINES, SKIRMISHES, statusAt } from "./painting.ts";

describe("Velvet Siege authored battle", () => {
  it("begins with fifty combatants and finishes with a decisive result", () => {
    expect(statusAt(0)).toMatchObject({ violet: 25, ivory: 25 });
    expect(statusAt(DURATION)).toMatchObject({ violet: 17, ivory: 0 });
    expect(new Set(ENGINES.map(unit => unit.id)).size).toBe(48);
  });
  it("keeps wrecks fixed at the position of their impact", () => {
    for (const unit of ENGINES.filter(unit => unit.death <= DURATION)) {
      expect(enginePosition(unit, DURATION)).toEqual(enginePosition(unit, unit.death));
    }
  });
  it("keeps every authored movement finite and on the causeway", () => {
    const invalid: string[] = [];
    for (let time = 0; time <= DURATION; time += 0.125) {
      for (const unit of ENGINES) {
        const { x, y } = enginePosition(unit, time);
        if (!Number.isFinite(x + y) || x < 0 || x > 1600 || y < 300 || y > 800) invalid.push(`${unit.id}@${time}`);
      }
    }
    expect(invalid).toEqual([]);
    for (const shot of SKIRMISHES) {
      expect(ENGINES[shot.source]?.faction).not.toBe(ENGINES[shot.target]?.faction);
    }
  });
});
