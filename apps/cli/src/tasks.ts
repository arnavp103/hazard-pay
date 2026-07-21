import { ghApiGet, ghJson } from "./gh.ts";
import { printSummary } from "./output.ts";

/** Raw shape of a REST issues-list entry (snake_case, as GitHub returns it). */
export interface RawIssue {
  number: number;
  title: string;
  state: string;
  assignees: { login: string }[];
  issue_dependencies_summary?: { blocked_by: number };
  /** Present (as an object) only when this "issue" is actually a PR. */
  pull_request?: unknown;
}

export interface IssueSummary {
  number: number;
  title: string;
  assignees: string[];
  blockedByCount: number;
}

export interface OpenPr {
  number: number;
  headRefName: string;
  body: string;
}

/**
 * The issues REST endpoint mixes pull requests into issue listings — the
 * PR-only field `pull_request` is how GitHub itself tells them apart.
 */
export function filterIssuesOnly(raw: readonly RawIssue[]): RawIssue[] {
  return raw.filter((issue) => issue.pull_request === undefined);
}

export function toIssueSummary(raw: RawIssue): IssueSummary {
  return {
    number: raw.number,
    title: raw.title,
    assignees: raw.assignees.map((assignee) => assignee.login),
    blockedByCount: raw.issue_dependencies_summary?.blocked_by ?? 0,
  };
}

/** `issue-<n>-*` branch naming convention used by `hazard-pay worktree new`. */
export function issueNumberFromBranch(branch: string): number | undefined {
  const match = /^issue-(\d+)-/.exec(branch);
  return match ? Number(match[1]) : undefined;
}

/** GitHub's standard closing-keyword set, as used in PR bodies (`Fixes #38`). */
export function closingIssueNumbers(body: string): number[] {
  const pattern = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;
  const numbers: number[] = [];
  for (const match of body.matchAll(pattern)) {
    numbers.push(Number(match[1]));
  }
  return numbers;
}

/** The open PR (if any) for an issue, by branch-name convention or closing footer. */
export function matchPrForIssue(issueNumber: number, prs: readonly OpenPr[]): OpenPr | undefined {
  return prs.find(
    (pr) => issueNumberFromBranch(pr.headRefName) === issueNumber || closingIssueNumbers(pr.body).includes(issueNumber),
  );
}

export interface FrontierEntry {
  number: number;
  title: string;
}

export interface BlockedEntry {
  number: number;
  title: string;
  blockedByOpen: number[];
}

export interface InFlightEntry {
  number: number;
  title: string;
  assignees: string[];
  pr?: { number: number; headRefName: string };
}

export interface TaskGroups {
  frontier: FrontierEntry[];
  blocked: BlockedEntry[];
  inFlight: InFlightEntry[];
}

/**
 * Partitions open issues into exactly one bucket each:
 *  - assigned issues are always "in flight" (situational awareness on who's
 *    working what beats hiding a blocked-but-claimed issue);
 *  - unassigned + blocked is "blocked";
 *  - unassigned + unblocked is "frontier".
 */
export function groupTasks(
  issues: readonly IssueSummary[],
  blockersByIssue: ReadonlyMap<number, readonly number[]>,
  prs: readonly OpenPr[],
): TaskGroups {
  const frontier: FrontierEntry[] = [];
  const blocked: BlockedEntry[] = [];
  const inFlight: InFlightEntry[] = [];

  for (const issue of issues) {
    if (issue.assignees.length > 0) {
      const pr = matchPrForIssue(issue.number, prs);
      inFlight.push({
        number: issue.number,
        title: issue.title,
        assignees: issue.assignees,
        pr: pr ? { number: pr.number, headRefName: pr.headRefName } : undefined,
      });
    } else if (issue.blockedByCount > 0) {
      blocked.push({
        number: issue.number,
        title: issue.title,
        blockedByOpen: [...(blockersByIssue.get(issue.number) ?? [])],
      });
    } else {
      frontier.push({ number: issue.number, title: issue.title });
    }
  }
  return { frontier, blocked, inFlight };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Terse aligned plain-text table — no table library, just `padEnd`. */
export function renderTable(groups: TaskGroups): string {
  const lines: string[] = [];

  lines.push(`frontier (${groups.frontier.length})`);
  for (const entry of groups.frontier) {
    lines.push(`  #${String(entry.number).padEnd(5)} ${truncate(entry.title, 70)}`);
  }

  lines.push(`blocked (${groups.blocked.length})`);
  for (const entry of groups.blocked) {
    const blockers = entry.blockedByOpen.length > 0 ? entry.blockedByOpen.map((n) => `#${n}`).join(",") : "?";
    lines.push(`  #${String(entry.number).padEnd(5)} ${truncate(entry.title, 55).padEnd(56)} blocked by ${blockers}`);
  }

  lines.push(`in flight (${groups.inFlight.length})`);
  for (const entry of groups.inFlight) {
    const who = entry.assignees.join(",");
    const pr = entry.pr ? `PR #${entry.pr.number}` : "no PR";
    lines.push(`  #${String(entry.number).padEnd(5)} ${truncate(entry.title, 45).padEnd(46)} ${who.padEnd(15)} ${pr}`);
  }

  return lines.join("\n");
}

interface DependencyIssue {
  number: number;
  state: string;
}

/** Fetches the open blocker issue numbers for a single (already known-blocked) issue. */
function fetchOpenBlockers(issueNumber: number): number[] {
  const dependencies = ghApiGet<DependencyIssue[]>(`repos/{owner}/{repo}/issues/${issueNumber}/dependencies/blocked_by`);
  return dependencies.filter((dependency) => dependency.state === "open").map((dependency) => dependency.number);
}

/**
 * `hazard-pay tasks`: fetch open issues (paginated, PRs filtered out),
 * open PRs, and — only for issues that need it — their open blocker
 * numbers, then group and print.
 */
export function tasks(options: { json: boolean }): void {
  const raw = ghApiGet<RawIssue[]>(
    "repos/{owner}/{repo}/issues",
    { state: "open", per_page: "100" },
    { paginate: true },
  );
  const summaries = filterIssuesOnly(raw).map(toIssueSummary);

  const blockersByIssue = new Map<number, number[]>();
  for (const issue of summaries) {
    if (issue.assignees.length === 0 && issue.blockedByCount > 0) {
      blockersByIssue.set(issue.number, fetchOpenBlockers(issue.number));
    }
  }

  // gh's own default page size (30) would silently cap this; --limit forces
  // a page well past any backlog this project is expected to carry.
  const prs = ghJson<OpenPr[]>(["pr", "list", "--state", "open", "--json", "number,headRefName,body", "--limit", "500"]);

  const groups = groupTasks(summaries, blockersByIssue, prs);

  if (options.json) {
    console.log(JSON.stringify(groups, null, 2));
    return;
  }

  console.log(renderTable(groups));
  printSummary("Before starting work:", [
    "claim an issue: `gh issue edit <n> --add-assignee @me`",
  ]);
}
