import { execFileSync } from "node:child_process";
import { githubApiGet, githubRepository, toErrorMessage } from "./gh.ts";
import { printSummary } from "./output.ts";

/** Poll cadence for `pr watch`. */
export const POLL_INTERVAL_MS = 15_000;
/** How long to wait for the first workflow run to appear before giving up. */
export const NO_CI_GRACE_MS = 90_000;
/** Default `--timeout`, in minutes. */
export const DEFAULT_TIMEOUT_MINUTES = 15;

const TERMINAL_SUCCESS_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);

/** GitHub's `mergeable` values, per `gh pr view --json mergeable`. */
export type Mergeable = "CONFLICTING" | "MERGEABLE" | "UNKNOWN";

/** GitHub's `mergeStateStatus` values, per `gh pr view --json mergeStateStatus`. */
export type MergeStateStatus = "BEHIND" | "BLOCKED" | "CLEAN" | "DIRTY" | "DRAFT" | "HAS_HOOKS" | "UNKNOWN" | "UNSTABLE";

export interface PrStatus {
  number: number;
  headRefOid: string;
  headRefName: string;
  mergeable: Mergeable;
  mergeStateStatus: MergeStateStatus;
}

export interface WorkflowRun {
  id: number;
  name: string;
  headSha: string;
  status: string;
  conclusion: string | null;
}

/**
 * A CONFLICTING/DIRTY PR gets zero `pull_request` CI runs, ever, with no
 * visible failure — the trap issue #38 exists to close. Detected up front so
 * `pr watch` never polls (and never times out) waiting for runs that GitHub
 * has already decided not to produce.
 */
export function isConflicting(pr: Pick<PrStatus, "mergeable" | "mergeStateStatus">): boolean {
  return pr.mergeable === "CONFLICTING" || pr.mergeStateStatus === "DIRTY";
}

/** Defensive client-side filter: only runs for the PR's exact head SHA count. */
export function filterRunsForSha(runs: readonly WorkflowRun[], sha: string): WorkflowRun[] {
  return runs.filter((run) => run.headSha === sha);
}

export type RunsVerdict
  = | { kind: "pending" }
    | { kind: "success" }
    | { kind: "failure"; failingRuns: string[] };

/** Pure derivation of a verdict from the current set of runs for a SHA. */
export function deriveRunsVerdict(runs: readonly WorkflowRun[]): RunsVerdict {
  if (runs.length === 0) {
    return { kind: "pending" };
  }
  if (runs.some((run) => run.status !== "completed")) {
    return { kind: "pending" };
  }
  const failing = runs.filter((run) => !TERMINAL_SUCCESS_CONCLUSIONS.has(run.conclusion ?? ""));
  if (failing.length > 0) {
    return { kind: "failure", failingRuns: failing.map((run) => run.name) };
  }
  return { kind: "success" };
}

export type Verdict
  = | { kind: "success" }
    | { kind: "failure"; failingRuns: string[] }
    | { kind: "conflicting" }
    | { kind: "no-ci"; sha: string; graceSeconds: number }
    | { kind: "timeout"; timeoutMinutes: number }
    | { kind: "error"; message: string };

/** The terse, greppable final line — always the last thing `pr watch` prints. */
export function formatVerdictLine(verdict: Verdict): string {
  switch (verdict.kind) {
    case "success":
      return "verdict: success";
    case "failure":
      return `verdict: failure — ${verdict.failingRuns.join(", ")}`;
    case "conflicting":
      return "verdict: conflicting — no CI will run; merge main";
    case "no-ci":
      return `verdict: no CI detected for ${verdict.sha} after ${verdict.graceSeconds}s`;
    case "timeout":
      return `verdict: timeout after ${verdict.timeoutMinutes}m`;
    case "error":
      return `verdict: error — ${verdict.message}`;
  }
}

/** Exit code mirrors the outcome; every non-success verdict is non-zero. */
export function exitCodeForVerdict(verdict: Verdict): number {
  switch (verdict.kind) {
    case "success":
      return 0;
    case "failure":
      return 1;
    case "conflicting":
      return 2;
    case "no-ci":
      return 3;
    case "timeout":
      return 4;
    case "error":
      return 1;
  }
}

interface RawWorkflowRun {
  id: number;
  name: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
}

function toWorkflowRun(raw: RawWorkflowRun): WorkflowRun {
  return { id: raw.id, name: raw.name, headSha: raw.head_sha, status: raw.status, conclusion: raw.conclusion };
}

interface RawPr {
  number: number;
  head: { ref: string; sha: string };
  mergeable: boolean | null;
  mergeable_state: string;
}

function toPrStatus(pr: RawPr): PrStatus {
  const mergeable: Mergeable = pr.mergeable === true ? "MERGEABLE" : pr.mergeable === false ? "CONFLICTING" : "UNKNOWN";
  const state = pr.mergeable_state.toUpperCase();
  const mergeStateStatus: MergeStateStatus = state === "DIRTY" || state === "BLOCKED" || state === "BEHIND"
    ? state
    : state === "CLEAN" || state === "UNSTABLE" || state === "DRAFT" || state === "HAS_HOOKS"
      ? state
      : "UNKNOWN";
  return { number: pr.number, headRefOid: pr.head.sha, headRefName: pr.head.ref, mergeable, mergeStateStatus };
}

async function fetchPr(number: number | undefined): Promise<PrStatus> {
  if (number !== undefined) { return toPrStatus(await githubApiGet<RawPr>(`repos/{repo}/pulls/${number}`)); }
  const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  if (branch === "") { throw new Error("cannot infer a PR from detached HEAD; pass its number"); }
  const owner = githubRepository().split("/")[0];
  const prs = await githubApiGet<RawPr[]>("repos/{repo}/pulls", { head: `${owner}:${branch}`, state: "open" });
  if (prs.length !== 1) { throw new Error(`expected one open PR for branch ${branch}, found ${prs.length}; pass its number`); }
  const [pr] = prs;
  if (pr === undefined) { throw new Error(`open PR for branch ${branch} disappeared while resolving it`); }
  return toPrStatus(pr);
}

async function fetchRunsForSha(sha: string): Promise<WorkflowRun[]> {
  const { workflow_runs: runs } = await githubApiGet<{ workflow_runs: RawWorkflowRun[] }>(
    "repos/{repo}/actions/runs",
    { head_sha: sha },
  );
  return filterRunsForSha(runs.map(toWorkflowRun), sha);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export interface PrWatchOptions {
  number?: number;
  timeoutMinutes: number;
}

/**
 * `hazard-pay pr watch [number]`: resolve the PR's head SHA, then poll CI
 * runs for that exact SHA (never a different commit on the same branch —
 * the misattribution problem the retro in #38 called out). Blocks in the
 * foreground until a terminal verdict, then prints it as the last line and
 * exits with a matching non-zero code on anything but success.
 */
export async function prWatch(options: PrWatchOptions): Promise<never> {
  let pr: PrStatus;
  try {
    pr = await fetchPr(options.number);
  } catch (error) {
    return conclude({ kind: "error", message: toErrorMessage(error) });
  }

  console.log(`Watching PR #${pr.number} (${pr.headRefName}) at ${pr.headRefOid}`);

  if (isConflicting(pr)) {
    console.log(`mergeable=${pr.mergeable} mergeStateStatus=${pr.mergeStateStatus}`);
    return conclude({ kind: "conflicting" });
  }

  const graceSeconds = Math.round(NO_CI_GRACE_MS / 1000);
  const timeoutMs = options.timeoutMinutes * 60_000;
  const startedAt = Date.now();
  let sawAnyRun = false;

  for (;;) {
    const elapsedMs = Date.now() - startedAt;
    let runs: WorkflowRun[];
    try {
      runs = await fetchRunsForSha(pr.headRefOid);
    } catch (error) {
      return conclude({ kind: "error", message: toErrorMessage(error) });
    }

    if (runs.length === 0) {
      if (!sawAnyRun && elapsedMs >= NO_CI_GRACE_MS) {
        return conclude({ kind: "no-ci", sha: pr.headRefOid, graceSeconds });
      }
      console.log(`no CI runs yet for ${pr.headRefOid} (${Math.round(elapsedMs / 1000)}s elapsed)...`);
    } else {
      sawAnyRun = true;
      const verdict = deriveRunsVerdict(runs);
      if (verdict.kind === "success" || verdict.kind === "failure") {
        return conclude(verdict);
      }
      console.log(`${runs.length} run(s) for ${pr.headRefOid}, still in progress (${Math.round(elapsedMs / 1000)}s elapsed)...`);
    }

    if (elapsedMs >= timeoutMs) {
      return conclude({ kind: "timeout", timeoutMinutes: options.timeoutMinutes });
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

function conclude(verdict: Verdict): never {
  if (verdict.kind === "failure" || verdict.kind === "timeout" || verdict.kind === "no-ci") {
    printSummary("CI did not conclude successfully:", [
      "re-check the PR's Actions and merge state in GitHub",
      "after pushing a fix, `hazard-pay pr watch` will pick up the new head SHA automatically",
    ]);
  } else if (verdict.kind === "conflicting") {
    printSummary("PR cannot get CI until it merges cleanly:", [
      "merge or rebase `origin/main` into this branch, then push",
    ]);
  }
  console.log(formatVerdictLine(verdict));
  process.exit(exitCodeForVerdict(verdict));
}
