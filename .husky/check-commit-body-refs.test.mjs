#!/usr/bin/env node
// Accept/reject test suite for the commit-msg bare-issue-ref pre-check.
//
// Run directly: `node .husky/check-commit-body-refs.test.mjs`
//
// Exercises two layers:
//   1. `findBareRef` in isolation (fast, precise on the detection logic).
//   2. The REAL `.husky/commit-msg` hook path, via a child process, for the
//      cases that matter most for the "clear error, not a misleading one"
//      goal — confirming our check runs and fails BEFORE commitlint ever
//      gets a chance to produce its confusing `footer-leading-blank` message,
//      and that legitimate messages still sail through both stages.
//
// This is repo-root tooling (like commitlint.config.js itself), not a
// workspace package, so it isn't wired into `pnpm test` / turbo — it's run
// on demand, same as the fixtures were run directly against
// `pnpm exec commitlint --strict --edit` during the original investigation.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { findBareRef } from "./check-commit-body-refs.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// ---------------------------------------------------------------------------
// Layer 1: unit-level cases against findBareRef
// ---------------------------------------------------------------------------

test("bare ref on a continuation line (not paragraph-initial) is rejected", () => {
  const msg = `fix(repo): case

This paragraph is totally clean prose with no markers at all.
Reported in #1 for extra context, spanning this second line too.

Refs: #43
`;
  assert.equal(findBareRef(msg), "#1");
});

test("bare ref paragraph-initial is still rejected (stricter than the parser bug)", () => {
  // conventional-commits-parser does NOT currently misparse this position
  // (verified against the real config: the reclassified footer boundary
  // coincides with an existing blank line, so footer-leading-blank never
  // fires) — but we reject it anyway because the rule this repo documents is
  // "bare refs go in the trailing footer, period," not "bare refs are fine
  // wherever the parser happens not to choke on them."
  const msg = `fix(repo): case

See #1 for background.

Refs: #43
`;
  assert.equal(findBareRef(msg), "#1");
});

test("ref properly in a trailing Refs footer passes", () => {
  const msg = `fix(repo): case

Adds a commit-msg pre-check that rejects bare issue references in the
commit body and points the author at the correct footer syntax.

Refs: #43
`;
  assert.equal(findBareRef(msg), null);
});

test("Fixes #N footer (no colon) passes", () => {
  const msg = `fix(repo): case

Adds a commit-msg pre-check for bare issue refs.

Fixes #43
`;
  assert.equal(findBareRef(msg), null);
});

test("a bare ref that opens its own line is caught, not mistaken for a git comment", () => {
  // Regression: stripCommentLines used to strip any line starting with "#",
  // which silently swallowed body prose whose first character happens to be
  // a bare ref (as opposed to genuine git scaffolding comments, which always
  // have a space after the "#", e.g. "# Please enter the commit message...").
  const msg = `fix(repo): case

#43 also affects the queue path and needs a closer look before release.

Refs: #43
`;
  assert.equal(findBareRef(msg), "#43");
});

test("a malformed trailing paragraph reports the true bare-ref offender, not the valid trailer next to it", () => {
  // Regression: when the last paragraph mixes a properly-formatted trailer
  // line with a stray non-trailer line containing its own bare ref, the
  // whole paragraph is (rightly) disqualified as a clean footer — but the
  // reported violation must point at the actual offending line, not the
  // "Refs: #43" line that was already correctly formatted.
  const msg = `fix(repo): case

Some clean lead-in prose with no markers.

Refs: #43
Also noting #1 for context
`;
  assert.equal(findBareRef(msg), "#1");
});

test("real git scaffolding comment lines are still ignored", () => {
  const msg = `fix(repo): case

Adds a commit-msg pre-check for bare issue refs.

Refs: #43
# Please enter the commit message for your changes. Lines starting
# with '#' will be ignored, and an empty message aborts the commit.
`;
  assert.equal(findBareRef(msg), null);
});

test(":NNNN bare in body prose passes — verified non-issue under this config", () => {
  // issuePrefixes is only ['#'] here (config-conventional's
  // conventional-changelog-conventionalcommits parserPreset), so a bare
  // colon-number never matches the real parser's reference regex at all.
  // Confirmed directly against `pnpm exec commitlint --strict --edit` during
  // the investigation for hazard-pay#43 — this is not a guess.
  const msg = `fix(repo): case

The dev server ends up serving on :3001 instead of the configured port
after this change, which was confusing during manual verification.

Refs: #43
`;
  assert.equal(findBareRef(msg), null);
});

test("code-span ref passes — mirrors the real parser's boundary blindness", () => {
  const msg = `fix(repo): case

This paragraph is totally clean prose with no markers at all.
See the \`#1\` code reference in the config for details on this fix.

Refs: #43
`;
  assert.equal(findBareRef(msg), null);
});

test("normal multi-paragraph body with no refs passes", () => {
  const msg = `fix(repo): improve retry logic in matchmaking queue

Retries now use exponential backoff instead of a fixed delay.

This should reduce load spikes when many clients reconnect after a
transient outage, since retries spread out over time.
`;
  assert.equal(findBareRef(msg), null);
});

// ---------------------------------------------------------------------------
// Layer 2: the real .husky/commit-msg hook path (spawns a subprocess)
// ---------------------------------------------------------------------------

function runCommitMsgHook(message) {
  const dir = mkdtempSync(join(tmpdir(), "commit-msg-test-"));
  const file = join(dir, "MSG");
  writeFileSync(file, message);
  try {
    execFileSync("sh", [".husky/commit-msg", file], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stderr: "" };
  } catch (error) {
    return {
      status: error.status,
      stderr: error.stderr?.toString() ?? "",
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("real hook: bare ref in body rejects with OUR message, before commitlint runs", () => {
  const msg = `fix(repo): case

This paragraph is totally clean prose with no markers at all.
Reported in #1 for extra context, spanning this second line too.

Refs: #43
`;
  const result = runCommitMsgHook(msg);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /bare issue ref "#1" in commit body/);
  // The confusing commitlint error must never appear — our check exits first.
  assert.doesNotMatch(result.stderr, /footer-leading-blank/);
});

test("real hook: valid Refs footer passes the full pipeline", () => {
  const msg = `fix(repo): case

Adds a commit-msg pre-check that rejects bare issue references in the
commit body and points the author at the correct footer syntax.

Refs: #43
`;
  const result = runCommitMsgHook(msg);
  assert.equal(result.status, 0);
});

test("real hook: normal multi-paragraph body passes the full pipeline", () => {
  const msg = `fix(repo): improve retry logic in matchmaking queue

Retries now use exponential backoff instead of a fixed delay.

This should reduce load spikes when many clients reconnect after a
transient outage, since retries spread out over time.
`;
  const result = runCommitMsgHook(msg);
  assert.equal(result.status, 0);
});
