import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { printSummary } from "./output.ts";

/** Repo-relative directory that holds agent worktrees. */
export const WORKTREES_DIR = ".claude/worktrees";

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

/** The main checkout root: parent of the git common dir, from any worktree. */
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

function upstreamGone(root: string, branch: string): boolean {
  return tryGit(["for-each-ref", "--format=%(upstream:track)", `refs/heads/${branch}`], root) === "[gone]";
}

/**
 * `hazard-pay worktree new <branch>`: fetch origin, create `<branch>` off
 * `origin/main`, add a worktree at `.claude/worktrees/<branch>`, install
 * dependencies, and print the PR-flow checklist.
 */
export function worktreeNew(name: string | undefined): void {
  const invalid = validateBranchName(name);
  if (name === undefined || invalid !== undefined) {
    fail(invalid ?? "a branch name is required");
  }
  const root = checkoutRoot();
  console.log("Fetching origin...");
  run("git", ["fetch", "origin"], root);
  if (branchExists(root, name)) {
    fail(`branch "${name}" already exists — pick another name, or remove the old branch first`);
  }
  const worktreePath = path.join(root, WORKTREES_DIR, name);
  if (existsSync(worktreePath)) {
    fail(`worktree path already exists: ${worktreePath}`);
  }
  run("git", ["worktree", "add", worktreePath, "-b", name, "origin/main"], root);
  run("pnpm", ["install"], worktreePath);
  printSummary(`Worktree ready: ${worktreePath} (branch "${name}" off origin/main). PR flow:`, [
    `cd ${worktreePath}`,
    "open a draft PR before the work: empty commit, `git push -u origin HEAD`, `gh pr create --draft`",
    "push incrementally — progress is tracked from outside via `gh pr list`",
    "green gate before review: `pnpm type-check && pnpm lint && pnpm test`",
    "mark ready with `gh pr ready` — the orchestrator merges, not you",
  ]);
}

/**
 * `hazard-pay worktree clean`: remove worktrees under `.claude/worktrees/`
 * whose branch is merged into `origin/main` or whose remote branch is gone,
 * then delete their local branches and prune. Skips (with a warning) the main
 * checkout, the current worktree, and anything dirty, locked, or detached.
 */
export function worktreeClean(options: { dryRun: boolean }): void {
  const { dryRun } = options;
  const root = checkoutRoot();
  console.log("Fetching origin (pruning stale remote refs)...");
  run("git", ["fetch", "--prune", "origin"], root);

  const entries = parseWorktreeList(git(["worktree", "list", "--porcelain"], root));
  const managedPrefix = path.join(root, WORKTREES_DIR) + path.sep;
  const currentTop = tryGit(["rev-parse", "--show-toplevel"]);
  let removed = 0;
  let kept = 0;

  for (const entry of entries) {
    const worktreePath = path.resolve(entry.path);
    if (!worktreePath.startsWith(managedPrefix)) {
      continue; // never the main checkout, never anything outside .claude/worktrees
    }
    const label = path.relative(root, worktreePath);
    if (entry.detached || entry.branch === undefined) {
      console.warn(`skip ${label}: detached HEAD`);
      kept += 1;
      continue;
    }
    const branch = entry.branch;
    if (branch === "main") {
      console.warn(`skip ${label}: has main checked out`);
      kept += 1;
      continue;
    }
    if (entry.locked) {
      console.warn(`skip ${label}: locked`);
      kept += 1;
      continue;
    }
    if (currentTop !== undefined && path.resolve(currentTop) === worktreePath) {
      console.warn(`skip ${label}: it is the current worktree`);
      kept += 1;
      continue;
    }
    const status = tryGit(["status", "--porcelain"], worktreePath);
    if (status === undefined || status !== "") {
      console.warn(`skip ${label}: uncommitted changes`);
      kept += 1;
      continue;
    }
    const merged = isMergedIntoOriginMain(root, branch);
    const gone = upstreamGone(root, branch);
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
      console.warn(`skip ${label}: git worktree remove failed`);
      kept += 1;
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
