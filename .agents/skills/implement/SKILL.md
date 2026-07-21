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

## 1. Worktree first

Before any other work, set up an isolated worktree (skip if you're already inside
one — check whether `git rev-parse --git-common-dir` differs from `.git`).
Preferred path — the dev CLI does fetch, branch off `origin/main`, worktree add,
and `pnpm install` in one step, then prints the PR-flow checklist:

```bash
./apps/cli/bin/hazard-pay worktree new <branch>
cd .claude/worktrees/<branch>
```

Fallback (manual git), if the CLI is unavailable:

```bash
git fetch origin
git worktree add .claude/worktrees/<branch> -b <branch> origin/main
cd .claude/worktrees/<branch>
pnpm install
```

Branch naming: `issue-<n>-<short-slug>` when working a ticket (e.g.
`issue-14-scaffold-db`), otherwise `<type>/<short-slug>` matching the commit type
you expect to lead with. `.claude/worktrees/` is gitignored; never commit anything
under it from the parent checkout. Lifecycle: `hazard-pay worktree clean` removes
worktrees whose branch is merged into `origin/main` or whose remote branch is gone
— the orchestrator runs it, not you.

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

```bash
gh pr ready <number>
```

The **orchestrator** merges, cleans up the worktree (`hazard-pay worktree clean`),
and deletes the branch. Do not babysit CI, do not merge, do not
`git worktree remove` your own worktree. Mark the PR ready, write your report,
and end.

## Known hazards

- **Base every PR on `main`.** A stacked PR is auto-closed unrecoverably when its
  base branch is deleted on merge; open a fresh PR instead of stacking.
- **Issue refs in commit bodies go in a trailing `Refs: #<n>` footer**, not in body
  prose — keeps commitlint's footer parsing happy.
- No AI attribution in PR titles, bodies, or commit messages.
- On a projectCards GraphQL error from `gh pr view` / `gh issue view` / `gh pr edit`,
  switch to the REST equivalents (`gh api repos/{owner}/{repo}/...`) — don't retry.
- Before merging with `--delete-branch` (orchestrator's job), check
  `gh pr list --base <branch>` and retarget any dependent PRs to `main` first.
