import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Walk upward from `cwd` looking for a directory containing
 * `pnpm-workspace.yaml` — the workspace root marker. Returns `undefined` when
 * no marker is found before the filesystem root.
 */
export function findWorkspaceRoot(cwd: string): string | undefined {
  let dir = path.resolve(cwd);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

/**
 * Resolve the main checkout root: the parent of `git rev-parse
 * --git-common-dir`. From a linked worktree (e.g. under `.claude/worktrees/`)
 * the common dir lives in the main checkout, so the root resolved here is the
 * main checkout — not the worktree. Falls back to an upward search for
 * `pnpm-workspace.yaml` when git is unavailable or `cwd` is not in a repo.
 */
export function resolveCheckoutRoot(cwd: string = process.cwd()): string | undefined {
  try {
    const commonDir = execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    return path.dirname(commonDir);
  } catch {
    return findWorkspaceRoot(cwd);
  }
}

/**
 * Load `<checkout root>/.env` into `process.env` via Node's native
 * `process.loadEnvFile`. Node's semantics apply: variables already set in
 * `process.env` win over file values. A missing `.env` (or unresolvable root)
 * is a no-op, so importing the env package never requires the file. Values
 * are never logged.
 */
export function loadEnv(cwd: string = process.cwd()): void {
  const root = resolveCheckoutRoot(cwd);
  if (root === undefined) {
    return;
  }
  const envFile = path.join(root, ".env");
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}
