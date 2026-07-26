/**
 * Scratch probe (#101): find a death that happens in the open, and say where it
 * lands on the fixed camera's canvas — the crop the close-up sheet uses.
 *
 *   pnpm exec tsx probe-screen.mts [scale]
 */
import { ATTRITION_TREATMENTS, installAttrition, isDead } from "./attrition.ts";
import { createBattle, FIXED_STEP, stepBattle } from "./sim.ts";

const SCALE = Number(process.argv[2] ?? 3);
const RIGHT = [Math.SQRT1_2, 0, -Math.SQRT1_2] as const;
const UP = [-0.35355, 0.86603, -0.35355] as const;
const target = [UP[0] * 0.85, 0.55 + UP[1] * 0.85, UP[2] * 0.85] as const;
const px = 40 * 0.55 * SCALE;

function project(x: number, z: number): [number, number] {
  const d = [x - target[0], 0.5 - target[1], z - target[2]] as const;
  const sx = d[0] * RIGHT[0] + d[1] * RIGHT[1] + d[2] * RIGHT[2];
  const sy = d[0] * UP[0] + d[1] * UP[1] + d[2] * UP[2];
  return [240 * SCALE + sx * px, 135 * SCALE - sy * px];
}

const restore = installAttrition(ATTRITION_TREATMENTS.downed);
const state = createBattle({ fodderPerSide: 18, heroesPerSide: 2 });
const seen = new Set<number>();
const rows: string[] = [];
for (let i = 0; i < 60 * 24; i += 1) {
  stepBattle(state);
  for (const unit of state.units) {
    if (!isDead(unit) || seen.has(unit.id)) { continue; }
    seen.add(unit.id);
    // How many other bodies sit within a body-and-a-half. Low = it falls in
    // the open and the pose is actually readable.
    const near = state.units.filter(
      (other) => other.id !== unit.id && Math.hypot(other.x - unit.x, other.z - unit.z) < 1.8,
    ).length;
    const [cx, cy] = project(unit.x, unit.z);
    rows.push(
      `t=${(state.step * FIXED_STEP).toFixed(2)}s id=${String(unit.id).padStart(2)} `
      + `side=${unit.side} neighbours=${near} canvas=(${cx.toFixed(0)},${cy.toFixed(0)})`,
    );
  }
}
restore();
process.stdout.write(`${rows.join("\n")}\n`);
