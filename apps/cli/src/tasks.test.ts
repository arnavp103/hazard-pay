import assert from "node:assert/strict";
import { test } from "node:test";
import {
  closingIssueNumbers,
  filterIssuesOnly,
  groupTasks,
  issueNumberFromBranch,
  matchPrForIssue,
  toIssueSummary,
  type IssueSummary,
  type OpenPr,
  type RawIssue,
} from "./tasks.ts";

function rawIssue(overrides: Partial<RawIssue>): RawIssue {
  return { number: 1, title: "some issue", state: "open", assignees: [], ...overrides };
}

test("filterIssuesOnly drops entries that carry a pull_request field", () => {
  const items = [
    rawIssue({ number: 1 }),
    rawIssue({ number: 2, pull_request: { url: "https://example.test" } }),
    rawIssue({ number: 3 }),
  ];
  const result = filterIssuesOnly(items);
  assert.deepEqual(result.map((issue) => issue.number), [1, 3]);
});

test("toIssueSummary maps assignee logins and defaults blockedByCount to 0", () => {
  const summary = toIssueSummary(rawIssue({
    number: 5,
    title: "scaffold thing",
    assignees: [{ login: "arnavp103" }],
  }));
  assert.deepEqual(summary, {
    number: 5,
    title: "scaffold thing",
    assignees: ["arnavp103"],
    blockedByCount: 0,
  });
});

test("toIssueSummary reads issue_dependencies_summary.blocked_by when present", () => {
  const summary = toIssueSummary(rawIssue({ issue_dependencies_summary: { blocked_by: 2 } }));
  assert.equal(summary.blockedByCount, 2);
});

test("issueNumberFromBranch matches the issue-<n>-* convention", () => {
  assert.equal(issueNumberFromBranch("issue-42-fix-thing"), 42);
  assert.equal(issueNumberFromBranch("issue-7-x"), 7);
});

test("issueNumberFromBranch is undefined for non-conforming branches", () => {
  assert.equal(issueNumberFromBranch("feat/short-slug"), undefined);
  assert.equal(issueNumberFromBranch("main"), undefined);
  assert.equal(issueNumberFromBranch("not-issue-42-fix"), undefined);
});

test("closingIssueNumbers extracts Fixes/Closes/Resolves footers, case-insensitively", () => {
  assert.deepEqual(closingIssueNumbers("Fixes #38\nFixes #39"), [38, 39]);
  assert.deepEqual(closingIssueNumbers("closes #12"), [12]);
  assert.deepEqual(closingIssueNumbers("Resolved #4 and also fixed #5"), [4, 5]);
});

test("closingIssueNumbers returns nothing for prose without closing keywords", () => {
  assert.deepEqual(closingIssueNumbers("Refs #38, see also #39 for context"), []);
});

test("matchPrForIssue matches by branch-name convention", () => {
  const prs: OpenPr[] = [{ number: 100, headRefName: "issue-42-fix-thing", body: "" }];
  assert.equal(matchPrForIssue(42, prs)?.number, 100);
  assert.equal(matchPrForIssue(43, prs), undefined);
});

test("matchPrForIssue matches by a Fixes footer in the PR body", () => {
  const prs: OpenPr[] = [{ number: 42, headRefName: "some-branch", body: "Fixes #38\nFixes #39" }];
  assert.equal(matchPrForIssue(38, prs)?.number, 42);
  assert.equal(matchPrForIssue(39, prs)?.number, 42);
  assert.equal(matchPrForIssue(40, prs), undefined);
});

test("groupTasks partitions unassigned+unblocked, unassigned+blocked, and assigned issues", () => {
  const issues: IssueSummary[] = [
    { number: 1, title: "frontier item", assignees: [], blockedByCount: 0 },
    { number: 2, title: "blocked item", assignees: [], blockedByCount: 1 },
    { number: 3, title: "in flight item", assignees: ["arnavp103"], blockedByCount: 0 },
  ];
  const blockersByIssue = new Map([[2, [99]]]);
  const prs: OpenPr[] = [{ number: 55, headRefName: "issue-3-in-flight", body: "" }];

  const groups = groupTasks(issues, blockersByIssue, prs);

  assert.deepEqual(groups.frontier, [{ number: 1, title: "frontier item" }]);
  assert.deepEqual(groups.blocked, [{ number: 2, title: "blocked item", blockedByOpen: [99] }]);
  assert.deepEqual(groups.inFlight, [
    { number: 3, title: "in flight item", assignees: ["arnavp103"], pr: { number: 55, headRefName: "issue-3-in-flight" } },
  ]);
});

test("groupTasks leaves pr undefined for in-flight issues with no matching PR", () => {
  const issues: IssueSummary[] = [{ number: 9, title: "assigned, no PR yet", assignees: ["someone"], blockedByCount: 0 }];
  const groups = groupTasks(issues, new Map(), []);
  assert.equal(groups.inFlight[0]?.pr, undefined);
});

test("groupTasks treats an assigned+blocked issue as in-flight, not blocked", () => {
  const issues: IssueSummary[] = [{ number: 4, title: "claimed but blocked", assignees: ["arnavp103"], blockedByCount: 1 }];
  const groups = groupTasks(issues, new Map([[4, [1]]]), []);
  assert.equal(groups.blocked.length, 0);
  assert.equal(groups.inFlight.length, 1);
});
