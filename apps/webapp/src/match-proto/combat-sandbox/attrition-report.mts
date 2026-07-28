/**
 * THROWAWAY SCAFFOLDING (#101): the gallery's numbers, as JSON on stdout.
 *
 *   pnpm exec tsx apps/webapp/src/match-proto/combat-sandbox/attrition-report.mts
 *
 * `capture-attrition.sh` writes it next to the stills, so the pictures and the
 * curve that produced them are committed together. Nothing imports this.
 */

import { measureAttrition } from "./attrition-metrics.ts";
import { ATTRITION_NAMES, ATTRITION_TREATMENTS } from "./attrition.ts";
import { FIXED_STEP } from "./sim.ts";

const SECONDS = 24;

function seconds(step: number): number | null {
  return step < 0 ? null : Number((step * FIXED_STEP).toFixed(2));
}

const runs = ATTRITION_NAMES.map((name) => {
  const report = measureAttrition(ATTRITION_TREATMENTS[name], { every: 2, seconds: SECONDS });
  return {
    aimedAtDeadPercent: Number(
      ((report.aimedAtDeadFrames / Math.max(1, report.livingUnitFrames)) * 100).toFixed(1),
    ),
    arc: report.samples.map((sample) => ({
      alive: sample.alive,
      bodies: sample.bodies,
      boxHeight: sample.boxHeight,
      boxWidth: sample.boxWidth,
      medianGapPx: sample.medianGap,
      t: sample.t,
    })),
    attacks: report.attacks,
    bill: ATTRITION_TREATMENTS[name].bill,
    firstDeath: seconds(report.firstDeathStep),
    halfStrength: seconds(report.halfStrengthStep),
    midSwingFlipPercent: Number(
      ((report.midSwingFlips / Math.max(1, report.attacks)) * 100).toFixed(1),
    ),
    quarterStrength: seconds(report.quarterStrengthStep),
    survivors: report.survivors,
    targetChurnPerUnitSecond: report.targetChurnPerUnitSecond,
    treatment: name,
  };
});

// The ablation: the same treatment with the commitment rule taken back out.
const ablation = (["downed", "removed"] as const).flatMap((name) =>
  [false, true].map((commit) => {
    const report = measureAttrition(ATTRITION_TREATMENTS[name], {
      commit,
      every: SECONDS,
      seconds: SECONDS,
    });
    return {
      aimedAtDeadPercent: Number(
        ((report.aimedAtDeadFrames / Math.max(1, report.livingUnitFrames)) * 100).toFixed(1),
      ),
      attacks: report.attacks,
      commit,
      midSwingFlipPercent: Number(
        ((report.midSwingFlips / Math.max(1, report.attacks)) * 100).toFixed(1),
      ),
      targetChurnPerUnitSecond: report.targetChurnPerUnitSecond,
      treatment: name,
    };
  }),
);

process.stdout.write(`${JSON.stringify(
  {
    note: "PROTOTYPE STAND-IN death rule: one hit stamp = 1 damage, fodder 3, hero 6. Not a damage model.",
    seconds: SECONDS,
    seed: "default (20890724)",
    targetCommitment: ablation,
    treatments: runs,
  },
  null,
  2,
)}\n`);
