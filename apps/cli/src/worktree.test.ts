import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWorktreeList, validateBranchName } from "./worktree.ts";

test("validateBranchName accepts typical branch names", () => {
  assert.equal(validateBranchName("issue-23-agent"), undefined);
  assert.equal(validateBranchName("issue-14-scaffold-db"), undefined);
  assert.equal(validateBranchName("feat/short-slug"), undefined);
  assert.equal(validateBranchName("fix/v1.2.3"), undefined);
  assert.equal(validateBranchName("a"), undefined);
});

test("validateBranchName rejects missing or empty names", () => {
  assert.notEqual(validateBranchName(undefined), undefined);
  assert.notEqual(validateBranchName(""), undefined);
});

test("validateBranchName rejects names with invalid characters", () => {
  assert.notEqual(validateBranchName("has space"), undefined);
  assert.notEqual(validateBranchName("has\ttab"), undefined);
  assert.notEqual(validateBranchName("caret^name"), undefined);
  assert.notEqual(validateBranchName("tilde~name"), undefined);
  assert.notEqual(validateBranchName("colon:name"), undefined);
  assert.notEqual(validateBranchName("question?name"), undefined);
  assert.notEqual(validateBranchName("star*name"), undefined);
});

test("validateBranchName rejects unsafe path shapes", () => {
  assert.notEqual(validateBranchName("../escape"), undefined);
  assert.notEqual(validateBranchName("a..b"), undefined);
  assert.notEqual(validateBranchName("a//b"), undefined);
  assert.notEqual(validateBranchName("/leading-slash"), undefined);
  assert.notEqual(validateBranchName("trailing-slash/"), undefined);
  assert.notEqual(validateBranchName("trailing-dot."), undefined);
  assert.notEqual(validateBranchName("-leading-dash"), undefined);
  assert.notEqual(validateBranchName(".leading-dot"), undefined);
  assert.notEqual(validateBranchName("ends.lock"), undefined);
});

test("parseWorktreeList parses main checkout, branch worktrees, and detached", () => {
  const porcelain = [
    "worktree /repo",
    "HEAD 1111111111111111111111111111111111111111",
    "branch refs/heads/main",
    "",
    "worktree /repo/.claude/worktrees/issue-9-thing",
    "HEAD 2222222222222222222222222222222222222222",
    "branch refs/heads/issue-9-thing",
    "",
    "worktree /repo/.claude/worktrees/stray",
    "HEAD 3333333333333333333333333333333333333333",
    "detached",
    "",
  ].join("\n");

  const entries = parseWorktreeList(porcelain);

  assert.equal(entries.length, 3);
  assert.deepEqual(entries[0], {
    path: "/repo",
    head: "1111111111111111111111111111111111111111",
    branch: "main",
    detached: false,
    locked: false,
  });
  assert.deepEqual(entries[1], {
    path: "/repo/.claude/worktrees/issue-9-thing",
    head: "2222222222222222222222222222222222222222",
    branch: "issue-9-thing",
    detached: false,
    locked: false,
  });
  assert.equal(entries[2]?.branch, undefined);
  assert.equal(entries[2]?.detached, true);
});

test("parseWorktreeList reads locked worktrees (with and without reason)", () => {
  const porcelain = [
    "worktree /repo/.claude/worktrees/locked-one",
    "HEAD 4444444444444444444444444444444444444444",
    "branch refs/heads/locked-one",
    "locked",
    "",
    "worktree /repo/.claude/worktrees/locked-two",
    "HEAD 5555555555555555555555555555555555555555",
    "branch refs/heads/locked-two",
    "locked agent still running",
    "",
  ].join("\n");

  const entries = parseWorktreeList(porcelain);

  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.locked, true);
  assert.equal(entries[1]?.locked, true);
});

test("parseWorktreeList returns no entries for empty output", () => {
  assert.deepEqual(parseWorktreeList(""), []);
});
