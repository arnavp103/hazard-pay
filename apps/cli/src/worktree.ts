import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import env from "@hazard-pay/env";
import { printSummary } from "./output.ts";

/** Where `worktree new` creates agent worktrees (repo-relative). */
export const WORKTREES_DIR = ".worktrees";

/**
 * All roots `worktree clean` sweeps. `.claude/worktrees/` is the legacy
 * location (still used by the harness's own auto-isolation); `.worktrees/`
 * is the current one — the `.claude/` tree is deny-listed for agent file
 * tools, so worktrees now live outside it.
 */
export const MANAGED_WORKTREE_DIRS = [".worktrees", ".claude/worktrees"] as const;

/**
 * Validate a branch/worktree name. Full branch names are accepted as-is
 * (`issue-23-agent`, `feat/foo`) — no forced prefix. Returns an error
 * message, or `undefined` when the name is valid.
 */
export function validateBranchName(name: string | undefined): string | undefined {
  if (name === undefined || name === "") {
    return "a branch name is required (e.g. issue-42-fix-thing)";
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)) {
    return `invalid branch name "${name}": use letters, digits, ".", "_", "-" or "/", starting with a letter or digit`;
  }
  if (name.includes("..")) {
    return `invalid branch name "${name}": must not contain ".."`;
  }
  if (name.includes("//")) {
    return `invalid branch name "${name}": must not contain "//"`;
  }
  if (name.endsWith("/") || name.endsWith(".")) {
    return `invalid branch name "${name}": must not end with "/" or "."`;
  }
  if (name.endsWith(".lock")) {
    return `invalid branch name "${name}": must not end with ".lock"`;
  }
  return undefined;
}

/** One entry of `git worktree list --porcelain` output. */
export interface WorktreeEntry {
  path: string;
  head?: string;
  /** Short branch name (without `refs/heads/`); undefined when detached. */
  branch?: string;
  detached: boolean;
  locked: boolean;
}

/** Parse `git worktree list --porcelain` output. Pure — exported for tests. */
export function parseWorktreeList(porcelain: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  let current: WorktreeEntry | undefined;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length), detached: false, locked: false };
      entries.push(current);
    } else if (current === undefined) {
      continue;
    } else if (line.startsWith("HEAD ")) {
      current.head = line.slice("HEAD ".length);
    } else if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "detached") {
      current.detached = true;
    } else if (line === "locked" || line.startsWith("locked ")) {
      current.locked = true;
    }
  }
  return entries;
}

/** Parse `git ls-remote --heads` output into a set of refs. Pure — exported for tests. */
export function parseRemoteHeads(output: string): Set<string> {
  const refs = new Set<string>();
  for (const line of output.split("\n")) {
    const ref = line.split("\t")[1];
    if (ref !== undefined && ref !== "") {
      refs.add(ref);
    }
  }
  return refs;
}

function fail(message: string): never {
  console.error(`hazard-pay worktree: ${message}`);
  process.exit(1);
}

function git(args: string[], cwd?: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryGit(args: string[], cwd?: string): string | undefined {
  try {
    return git(args, cwd);
  } catch {
    return undefined;
  }
}

/** Run a command with inherited stdio; returns whether it exited 0. */
function tryRun(command: string, args: string[], cwd: string): boolean {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  return result.status === 0;
}

function run(command: string, args: string[], cwd: string): void {
  if (!tryRun(command, args, cwd)) {
    fail(`\`${command} ${args.join(" ")}\` failed`);
  }
}

/**
 * The main checkout root: parent of the git common dir, from any worktree.
 * Deliberately not `resolveCheckoutRoot` from `@hazard-pay/env`: that one
 * falls back to a workspace-marker search when git is missing, while the
 * worktree commands are git operations and must fail fast instead.
 */
function checkoutRoot(): string {
  const commonDir = tryGit(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  if (commonDir === undefined) {
    fail("not inside a git repository — run from a hazard-pay checkout");
  }
  return path.dirname(commonDir);
}

function branchExists(root: string, name: string): boolean {
  return tryGit(["rev-parse", "--verify", "--quiet", `refs/heads/${name}`], root) !== undefined;
}

function isMergedIntoOriginMain(root: string, branch: string): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", branch, "origin/main"], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * The remote-side ref this branch pushes to (e.g. `refs/heads/foo`), or
 * undefined when the branch has never been pushed with an upstream.
 */
function upstreamRef(root: string, branch: string): string | undefined {
  const ref = tryGit(["config", `branch.${branch}.merge`], root);
  return ref === undefined || ref === "" ? undefined : ref;
}

/**
 * `hazard-pay worktree new <branch>`: fetch origin, create `<branch>` off
 * `origin/main`, add a worktree at `.worktrees/<branch>`, install
 * dependencies, and print the PR-flow checklist.
 */
export function worktreeNew(name: string | undefined): void {
  const invalid = validateBranchName(name);
  if (name === undefined || invalid !== undefined) {
    fail(invalid ?? "a branch name is required");
  }
  const root = checkoutRoot();
  if (env.HAZARD_PAY_HOSTED_AGENT) {
    if (tryGit(["status", "--porcelain"], root) !== "") {
      fail("the hosted-agent checkout has uncommitted changes — create the branch before editing");
    }
    const current = tryGit(["branch", "--show-current"], root);
    if (current === name) {
      console.log(`Hosted-agent checkout is already on branch "${name}"; no worktree created.`);
      return;
    }
    run("git", ["switch", "-c", name], root);
    printSummary(`Hosted-agent branch ready: ${name}.`, [
      "work directly in this checkout; do not create a nested worktree",
      "green gate before review: `pnpm type-check && pnpm lint && pnpm test`",
    ]);
    return;
  }
  console.log("Fetching origin...");
  run("git", ["fetch", "origin"], root);
  if (branchExists(root, name)) {
    fail(`branch "${name}" already exists — pick another name, or remove the old branch first`);
  }
  const worktreePath = path.join(root, WORKTREES_DIR, name);
  if (existsSync(worktreePath)) {
    fail(`worktree path already exists: ${worktreePath}`);
  }
  // --no-track: without it the new branch's upstream would be origin/main,
  // which would make `worktree clean` misread a fresh worktree as pushed.
  run("git", ["worktree", "add", "--no-track", worktreePath, "-b", name, "origin/main"], root);
  run("pnpm", ["install"], worktreePath);
  printSummary(`Worktree ready: ${worktreePath} (branch "${name}" off origin/main). PR flow:`, [
    `cd ${worktreePath}`,
    "open a draft PR before the work: empty commit, `git push -u origin HEAD`, `gh pr create --draft`",
    "push incrementally — progress is tracked from outside via `gh pr list`",
    "green gate before review: `pnpm type-check && pnpm lint && pnpm test`",
    "mark ready with `gh pr ready` — the orchestrator merges, not you",
    "finish with a report that includes a raw git-workflow-friction retro section",
  ]);
}

/**
 * `hazard-pay worktree clean`: remove worktrees under the managed roots
 * (`.worktrees/`, `.claude/worktrees/`) whose branch is merged into
 * `origin/main` or whose remote branch is gone, then delete their local
 * branches and prune. Skips (with a warning) the main checkout, the current
 * worktree, and anything dirty, locked, or detached.
 */
export function worktreeClean(options: { dryRun: boolean }): void {
  const { dryRun } = options;
  const root = checkoutRoot();
  console.log("Fetching origin...");
  run("git", ["fetch", "origin"], root);
  const remoteHeads = parseRemoteHeads(git(["ls-remote", "--heads", "origin"], root));

  const entries = parseWorktreeList(git(["worktree", "list", "--porcelain"], root));
  const managedPrefixes = MANAGED_WORKTREE_DIRS.map((dir) => path.join(root, dir) + path.sep);
  const currentTop = tryGit(["rev-parse", "--show-toplevel"]);
  let removed = 0;
  let kept = 0;
  const skip = (label: string, reason: string): void => {
    console.warn(`skip ${label}: ${reason}`);
    kept += 1;
  };

  for (const entry of entries) {
    const worktreePath = path.resolve(entry.path);
    if (!managedPrefixes.some((prefix) => worktreePath.startsWith(prefix))) {
      continue; // never the main checkout, never anything outside the managed roots
    }
    const label = path.relative(root, worktreePath);
    if (entry.detached || entry.branch === undefined) {
      skip(label, "detached HEAD");
      continue;
    }
    const branch = entry.branch;
    if (branch === "main") {
      skip(label, "has main checked out");
      continue;
    }
    if (entry.locked) {
      skip(label, "locked");
      continue;
    }
    if (currentTop !== undefined && path.resolve(currentTop) === worktreePath) {
      skip(label, "it is the current worktree");
      continue;
    }
    const status = tryGit(["status", "--porcelain"], worktreePath);
    if (status === undefined || status !== "") {
      skip(label, "uncommitted changes");
      continue;
    }
    // A branch that was never pushed as its own remote branch is never
    // cleaned: a freshly created worktree (zero commits) points at
    // origin/main and would otherwise be classified as "merged" and removed
    // from under its agent. Only an upstream matching the branch name — what
    // `git push -u origin HEAD` sets — counts; branches auto-tracking main
    // do not. The PR flow always pushes, so finished work is still swept.
    const upstream = upstreamRef(root, branch);
    if (upstream !== `refs/heads/${branch}`) {
      console.log(`keep ${label}: branch "${branch}" was never pushed (no matching upstream)`);
      kept += 1;
      continue;
    }
    const merged = isMergedIntoOriginMain(root, branch);
    // "Gone" = the upstream ref no longer exists on origin, checked against
    // one `git ls-remote` snapshot so --dry-run needs no `fetch --prune`
    // (which would mutate remote-tracking refs).
    const gone = !remoteHeads.has(upstream);
    if (!merged && !gone) {
      console.log(`keep ${label}: branch "${branch}" not merged and its remote branch still exists`);
      kept += 1;
      continue;
    }
    const reason = merged ? "merged into origin/main" : "remote branch gone";
    if (dryRun) {
      console.log(`would remove ${label} and delete branch "${branch}" (${reason})`);
      removed += 1;
      continue;
    }
    console.log(`removing ${label} and deleting branch "${branch}" (${reason})`);
    if (!tryRun("git", ["worktree", "remove", worktreePath], root)) {
      skip(label, "git worktree remove failed");
      continue;
    }
    if (!tryRun("git", ["branch", "-D", branch], root)) {
      console.warn(`could not delete branch "${branch}" — delete it manually`);
    }
    removed += 1;
  }

  if (!dryRun) {
    run("git", ["worktree", "prune"], root);
  }
  const heading = dryRun
    ? `Dry run: ${removed} worktree(s) removable, ${kept} kept.`
    : `Cleaned ${removed} worktree(s), ${kept} kept.`;
  printSummary(heading, dryRun && removed > 0
    ? ["run `hazard-pay worktree clean` without --dry-run to remove them"]
    : []);
}
