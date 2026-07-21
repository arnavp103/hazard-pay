import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveRunsVerdict,
  exitCodeForVerdict,
  filterRunsForSha,
  formatVerdictLine,
  isConflicting,
  type WorkflowRun,
} from "./pr-watch.ts";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function run(overrides: Partial<WorkflowRun>): WorkflowRun {
  return { id: 1, name: "CI", headSha: SHA_A, status: "completed", conclusion: "success", ...overrides };
}

test("isConflicting flags CONFLICTING mergeable", () => {
  assert.equal(isConflicting({ mergeable: "CONFLICTING", mergeStateStatus: "UNKNOWN" }), true);
});

test("isConflicting flags DIRTY mergeStateStatus", () => {
  assert.equal(isConflicting({ mergeable: "UNKNOWN", mergeStateStatus: "DIRTY" }), true);
});

test("isConflicting is false for a clean, mergeable PR", () => {
  assert.equal(isConflicting({ mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" }), false);
});

test("isConflicting is false while GitHub hasn't computed mergeability yet", () => {
  assert.equal(isConflicting({ mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" }), false);
});

test("filterRunsForSha keeps only runs matching the exact SHA", () => {
  const runs = [run({ headSha: SHA_A }), run({ headSha: SHA_B }), run({ headSha: SHA_A })];
  const filtered = filterRunsForSha(runs, SHA_A);
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((entry) => entry.headSha === SHA_A));
});

test("filterRunsForSha returns nothing for a SHA with no matching runs", () => {
  assert.deepEqual(filterRunsForSha([run({ headSha: SHA_B })], SHA_A), []);
});

test("deriveRunsVerdict is pending when there are no runs yet", () => {
  assert.deepEqual(deriveRunsVerdict([]), { kind: "pending" });
});

test("deriveRunsVerdict is pending while any run is still in progress", () => {
  const runs = [run({ status: "completed", conclusion: "success" }), run({ status: "in_progress", conclusion: null })];
  assert.deepEqual(deriveRunsVerdict(runs), { kind: "pending" });
});

test("deriveRunsVerdict is success when all runs completed with a success-like conclusion", () => {
  const runs = [
    run({ name: "unit", status: "completed", conclusion: "success" }),
    run({ name: "lint", status: "completed", conclusion: "skipped" }),
    run({ name: "extra", status: "completed", conclusion: "neutral" }),
  ];
  assert.deepEqual(deriveRunsVerdict(runs), { kind: "success" });
});

test("deriveRunsVerdict is failure and names the failing runs", () => {
  const runs = [
    run({ name: "unit", status: "completed", conclusion: "success" }),
    run({ name: "lint", status: "completed", conclusion: "failure" }),
    run({ name: "type-check", status: "completed", conclusion: "cancelled" }),
  ];
  assert.deepEqual(deriveRunsVerdict(runs), { kind: "failure", failingRuns: ["lint", "type-check"] });
});

test("formatVerdictLine renders each verdict kind as a terse greppable line", () => {
  assert.equal(formatVerdictLine({ kind: "success" }), "verdict: success");
  assert.equal(formatVerdictLine({ kind: "failure", failingRuns: ["lint"] }), "verdict: failure — lint");
  assert.equal(formatVerdictLine({ kind: "conflicting" }), "verdict: conflicting — no CI will run; merge main");
  assert.equal(
    formatVerdictLine({ kind: "no-ci", sha: SHA_A, graceSeconds: 90 }),
    `verdict: no CI detected for ${SHA_A} after 90s`,
  );
  assert.equal(formatVerdictLine({ kind: "timeout", timeoutMinutes: 15 }), "verdict: timeout after 15m");
  assert.equal(formatVerdictLine({ kind: "error", message: "no pull requests found" }), "verdict: error — no pull requests found");
});

test("exitCodeForVerdict is 0 only for success, distinct non-zero codes otherwise", () => {
  assert.equal(exitCodeForVerdict({ kind: "success" }), 0);
  const nonZero = [
    exitCodeForVerdict({ kind: "failure", failingRuns: [] }),
    exitCodeForVerdict({ kind: "conflicting" }),
    exitCodeForVerdict({ kind: "no-ci", sha: SHA_A, graceSeconds: 90 }),
    exitCodeForVerdict({ kind: "timeout", timeoutMinutes: 15 }),
    exitCodeForVerdict({ kind: "error", message: "x" }),
  ];
  assert.ok(nonZero.every((code) => code !== 0));
});
