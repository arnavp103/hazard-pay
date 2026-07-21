import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { findWorkspaceRoot, loadEnv, resolveCheckoutRoot } from "./load-env.ts";

/**
 * All fixtures are throwaway temp directories with fake `.env` files. These
 * tests never touch the real checkout's `.env` and never assert on real
 * environment values.
 */

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "hazard-pay-env-test-"));
  cleanups.push(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return realpathSync(dir);
}

function trackEnvVar(name: string): void {
  cleanups.push(() => {
    delete process.env[name];
  });
}

function git(cwd: string, ...args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function gitInitRepo(dir: string): void {
  git(dir, "init", "-b", "main");
  git(dir, "config", "user.email", "test@example.com");
  git(dir, "config", "user.name", "test");
  git(dir, "commit", "--allow-empty", "-m", "init");
}

test("findWorkspaceRoot walks up to the pnpm-workspace.yaml marker", () => {
  const root = tempDir();
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n");
  const nested = path.join(root, "packages", "somewhere");
  mkdirSync(nested, { recursive: true });

  assert.equal(findWorkspaceRoot(nested), root);
});

test("findWorkspaceRoot returns undefined without a marker", () => {
  const dir = tempDir();

  assert.equal(findWorkspaceRoot(dir), undefined);
});

test("resolveCheckoutRoot resolves the repo root from a subdirectory", () => {
  const root = tempDir();
  gitInitRepo(root);
  const nested = path.join(root, "some", "nested", "dir");
  mkdirSync(nested, { recursive: true });

  const resolved = resolveCheckoutRoot(nested);

  assert.ok(resolved !== undefined);
  assert.equal(realpathSync(resolved), root);
});

test("resolveCheckoutRoot resolves the main checkout root from a linked worktree", () => {
  const root = tempDir();
  gitInitRepo(root);
  const worktreeParent = tempDir();
  const worktreePath = path.join(worktreeParent, "wt");
  git(root, "worktree", "add", "-b", "test-branch", worktreePath, "main");

  const resolved = resolveCheckoutRoot(worktreePath);

  assert.ok(resolved !== undefined);
  assert.equal(realpathSync(resolved), root);
});

test("resolveCheckoutRoot falls back to the workspace marker outside a repo", () => {
  const root = tempDir();
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n");
  const nested = path.join(root, "apps", "thing");
  mkdirSync(nested, { recursive: true });

  assert.equal(resolveCheckoutRoot(nested), root);
});

test("loadEnv loads the root .env; already-set process.env vars win", () => {
  const root = tempDir();
  writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages:\n");
  writeFileSync(
    path.join(root, ".env"),
    "HP_TEST_UNSET_VAR=from_file\nHP_TEST_PRESET_VAR=from_file\n",
  );
  trackEnvVar("HP_TEST_UNSET_VAR");
  trackEnvVar("HP_TEST_PRESET_VAR");
  delete process.env.HP_TEST_UNSET_VAR;
  process.env.HP_TEST_PRESET_VAR = "preset";

  loadEnv(root);

  assert.equal(process.env.HP_TEST_UNSET_VAR, "from_file");
  assert.equal(process.env.HP_TEST_PRESET_VAR, "preset");
});

test("loadEnv reaches the main checkout's .env from inside a linked worktree", () => {
  const root = tempDir();
  gitInitRepo(root);
  writeFileSync(path.join(root, ".env"), "HP_TEST_WORKTREE_VAR=from_main_checkout\n");
  const worktreeParent = tempDir();
  const worktreePath = path.join(worktreeParent, "wt");
  git(root, "worktree", "add", "-b", "wt-branch", worktreePath, "main");
  trackEnvVar("HP_TEST_WORKTREE_VAR");
  delete process.env.HP_TEST_WORKTREE_VAR;

  loadEnv(worktreePath);

  assert.equal(process.env.HP_TEST_WORKTREE_VAR, "from_main_checkout");
});

test("loadEnv is a no-op when no .env exists at the root", () => {
  const root = tempDir();
  gitInitRepo(root);
  trackEnvVar("HP_TEST_ABSENT_VAR");
  delete process.env.HP_TEST_ABSENT_VAR;

  loadEnv(root);

  assert.equal(process.env.HP_TEST_ABSENT_VAR, undefined);
});
