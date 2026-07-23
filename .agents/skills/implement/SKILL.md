---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
---

<!-- Deliberately model-invocable: implementation agents load this themselves.
     If skill invocation is unavailable in your context, read this file directly
     at .agents/skills/implement/SKILL.md (the .claude/skills path is read-denied
     to agents). -->

Implement the work described by the user in the spec or tickets. All implementation
work happens in a dedicated git worktree and lands as a pull request — never commit
to `main` directly.

## 1. Prepare the environment, then the worktree

Run the repository bootstrap first. It is a quick readiness check after its
first successful run, so use it in local worktrees as well as hosted-agent
checkouts:

```bash
./apps/cli/bin/hazard-pay setup
```

The command installs dependencies and the screenshot browser, ensures Postgres
is reachable, and applies migrations only when its setup fingerprint is stale.
Use `--force` only to repair or deliberately reprovision an environment.

Then set up an isolated worktree (skip if you're already inside
one — check whether `git rev-parse --git-common-dir` differs from `.git`).
When `HAZARD_PAY_HOSTED_AGENT=true`, the command works directly on the provider
checkout's branch instead of creating a nested worktree; do not `cd` afterward.
Preferred path — the dev CLI does fetch, branch off `origin/main`, worktree add,
and `pnpm install` in one step, then prints the PR-flow checklist:

```bash
./apps/cli/bin/hazard-pay worktree new <branch>
cd .worktrees/<branch>
```

Fallback (manual git), if the CLI is unavailable:

```bash
git fetch origin
git worktree add .worktrees/<branch> -b <branch> origin/main
cd .worktrees/<branch>
pnpm install
```

Branch naming: `issue-<n>-<short-slug>` when working a ticket (e.g.
`issue-14-scaffold-db`), otherwise `<type>/<short-slug>` matching the commit type
you expect to lead with. `.worktrees/` is gitignored; never commit anything under
it from the parent checkout. Worktrees live at the repo root — not under
`.claude/` — because the `.claude/` tree is deny-listed for agent file tools.
Lifecycle: `hazard-pay worktree clean` removes worktrees (in `.worktrees/` and
legacy `.claude/worktrees/`) whose branch is merged into `origin/main` or whose
remote branch is gone — the orchestrator runs it, not you.

## Agent constraints

Session quirks that bite implementation agents; work with them, not against them:

- Your session cwd is pinned; `cd <dir> && cmd` compounds get denied. Always use
  flag forms — `git -C <path>`, `pnpm -C <path>` / `--filter` — and absolute
  paths everywhere. EnterWorktree does not work from a repo-root session; don't
  try it.
- If Skill invocation fails, this file is readable directly at
  `.agents/skills/implement/SKILL.md`.
- Don't spawn background sub-agents for the main implementation thread —
  coordination with a stopped parent breaks silently. If you must delegate, use
  synchronous (`run_in_background: false`) sub-agents.
- `gh issue view N --comments` sometimes prints nothing with exit 0; fall back
  to `--json` fields or `gh api repos/{owner}/{repo}/issues/N/comments`.
- The shell is fish: bare `echo ===`-style separators error; avoid decorative
  separators in compound commands.

## 2. Open a draft PR before the work

Your first commit is an empty one, so the PR exists while you work — not after:

```bash
git commit --allow-empty -m "chore(<scope>): open draft pr"
git push -u origin HEAD
gh pr create --draft --head "<branch>" \
  --title "<conventional-commit title>" \
  --body "Fixes #<issue>"
```

Open it early because the orchestrator tracks parallel work via `gh pr list` — a PR
that appears only at the end makes parallel streams invisible until they land.
If your commit's package directory doesn't exist yet (new-package tickets),
commitlint won't know its scope — use `repo` for the draft-PR commit; the real
scope becomes valid the moment the directory exists.
`Fixes #N` auto-closes the ticket on merge. If the merge does *not* itself resolve
the ticket (audit/prepare-only work), use a non-closing `Refs #N` instead.

## 3. Implement, pushing incrementally

- Use /tdd where possible, at pre-agreed seams.
- Run typechecking regularly, single test files regularly, and the full test suite
  once at the end.
- Commit in logical chunks and push each as you go — incremental pushes are how
  progress stays visible from outside the session.
- **UI changes**: capture screenshots of the running app with the `agent-browser`
  CLI, save them somewhere durable outside the repo, and list their absolute paths
  in your final report — the orchestrator reviews them before merging.

## 4. Green gate, then review

`pnpm type-check && pnpm lint && pnpm test` must pass. Then use /code-review to
review the work and address what it finds.

## 5. Mark ready — you do not merge

Wait for CI with the CLI (foreground, exits with a `verdict:` line — never
background `sleep`-and-poll compounds, they return empty):

```bash
./apps/cli/bin/hazard-pay pr watch <number>
gh pr ready <number>
```

Re-check `gh pr view <n> --json mergeStateStatus` right after marking ready —
main may have moved while you gated, and a CONFLICTING PR silently gets no CI
runs. If DIRTY: merge `origin/main` (lockfile conflicts: take main's version,
rerun `pnpm install`), re-gate, push, re-watch.

The **orchestrator** merges, cleans up the worktree (`hazard-pay worktree clean`),
and deletes the branch. Do not babysit CI, do not merge, do not
`git worktree remove` your own worktree. Mark the PR ready, write your report —
including a raw git-workflow-friction retro section — and end.

## Known hazards

- **Base every PR on `main`.** A stacked PR is auto-closed unrecoverably when its
  base branch is deleted on merge; open a fresh PR instead of stacking.
- **Issue refs in commit bodies go in a trailing `Refs: #<n>` footer**, not in body
  prose. `commit-msg` now checks this directly and fails fast with a clear,
  actionable message if you get it wrong — no need to reverse-engineer a
  confusing commitlint parser error anymore.
- No AI attribution in PR titles, bodies, or commit messages.
- On a projectCards GraphQL error from `gh pr view` / `gh issue view` / `gh pr edit`,
  switch to the REST equivalents (`gh api repos/{owner}/{repo}/...`) — don't retry.
- Before merging with `--delete-branch` (orchestrator's job), check
  `gh pr list --base <branch>` and retarget any dependent PRs to `main` first.
