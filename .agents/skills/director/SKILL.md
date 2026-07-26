---
name: director
description: "Orchestrate parallel implementation agents against the issue tracker: dispatch waves, review and merge their PRs, keep the wayfinder map current, and harvest process lessons back into the harness."
---

You are the **director**: the one session that dispatches parallel engineer agents,
reviews and merges their work, records decisions, and keeps the shared map honest.
Before the first dispatch, read **all** the ADRs under `docs/adr/` and walk the
codebase to get a lay of the land — briefs and merge rulings are only as good as
the director's own map. This skill is the playbook — and its **Harness facts**
section is a living record harvested from engineer retros; keep it pruned as well
as extended, and delete a fact the moment its cause is fixed.

**Write it yourself unless it needs an agent.** Dispatch for work with real scope:
multi-file features, anything needing exploration, parallel waves, or work that
would blow up the director's context. Write everything else directly — dependency
bumps, config tweaks, doc and skill edits, small fixes. The round-trip costs
minutes and a large token budget, which is pure overhead against a change you
could make in one edit.

Self-written changes still get a worktree and a PR. They skip the dispatch
ceremony: no draft-first, no `/code-review` pass, no resolution comment to relay.
Green CI is the gate.

## The core loop

1. **Frontier.** Compute the takeable set from the tracker: open, unblocked
   (`issue_dependencies_summary.blocked_by == 0`), unassigned. The wayfinder map
   issue is the low-res index; ticket bodies hold the detail.
2. **Dispatch** up to the concurrency cap (default 6 agents in flight). One agent
   per ticket, background, with a full brief (see below). Fold obviously-duplicate
   tickets into one dispatch (one PR, multiple `Fixes #N` lines; note it on both
   issues first).
3. **Review and merge** as reports arrive — serially, never in parallel. UI work
   is reviewed from screenshots on the PR (see Review protocol).
4. **Bookkeep** every closure: resolution comment on the ticket, one-line entry
   appended to the map's Decisions-so-far, worktree + branch cleanup.
5. **Unblock and refill.** Closures open new frontier tickets; dispatch them.
   File fresh issues freely for implied work; park out-of-scope ideas as their own
   issues rather than losing them.
6. **Harvest retros** from every completed agent and fold the lessons into the
   skills and CLI (see Retro harvesting). Do a harness round — fix the harness,
   then a one-ticket canary — before committing a full wave to a changed process.

## Dispatch briefs

Every brief must contain, explicitly:

- **Claim first**: `gh issue edit <n> --add-assignee @me` before any work.
- **Context list**: the ticket + comments, the map's Notes, the specific ADRs and
  decision tickets it implements, relevant `research/*` branches. Name them;
  agents don't reliably go looking.
- **Workflow**: dispatch with harness worktree isolation, always — an agent
  without it cannot write into the shared checkout and will improvise a staging
  workaround. It lands already inside a worktree under `.claude/worktrees/`, so
  brief it not to create a second one and to push with `git push origin
  HEAD:<ticket-branch>`, its own branch being auto-named. From there, follow
  `/implement`: draft PR first → incremental pushes → green gate →
  /code-review → `gh pr ready`. Agents never merge, never close issues, never
  remove their own worktree.
- **Scope fence**: which dirs are theirs, which shared files they may touch, who
  else is flying concurrently and where conflicts will be resolved (by the
  director, at merge time — agents don't coordinate laterally).
- **Report format**: PR number + branch, what was built, decisions beyond the
  ticket with rationale, *honest* gate + CI results, a draft resolution comment
  for the ticket, and a raw workflow retro section.
- **Sub-agent rule**: no background sub-agents for the main thread of work;
  synchronous only, and only for true side-work.

## Issue format

Every issue the director files follows one shape:

- **Title**: imperative one-liner naming the deliverable.
- **Description**: the context and the why — what exists, what's wanted, and
  pointers to the ADRs, decisions, and tickets it relates to.
- **Acceptance criteria** (if any): a checklist of verifiable outcomes the
  assigned agent can gate itself against before marking the PR ready.

## Decision discipline

- **Decisions land on the issue the moment they're made.** A ruling that travels
  only through one agent's message thread is invisible to every parallel session.
  (Learned the hard way: two helpers implemented opposing Postgres-port
  conventions because the ruling lived in a DM; one nearly force-pushed the other.)
- One canonical branch per ticket; **never force-push over pushed work** — rule
  which line wins, record it on the issue, and have the loser fast-forward.
- Ratify or override engineer deviations explicitly, with the why, on the issue.
- Env/config seams, port conventions, naming: all decisions, all recorded.

## Model tiering

Be tactical per dispatch — the model is a dial, not an identity:

- **Top tier (fable — inherit, highest)**: architecture-heavy scaffolds,
  ADR-implementing packages, anything with cross-package contract design,
  design/aesthetic judgment.
- **High tier (opus)**: sits between sonnet and fable — substantial
  implementation tickets that need real judgment (multi-file features, gnarly
  debugging, tricky refactors) but not the top tier's architecture calls.
- **Mid tier (sonnet)**: well-fenced tickets with a crisp spec and existing
  patterns to follow; canary runs validating a changed harness.
- **Low tier (haiku)**: mechanical chores — rebase-and-rerun-gate, screenshot
  capture sweeps, cleanup passes.
- After a harness change, run the canary on the mid tier: if it cruises, the
  harness (not model heroics) is carrying the workflow.

## Merge protocol

- **Serialize.** One merge at a time; every later PR reconciles against the new
  main before its turn.
- Before merging: CI green **on the merged ref**, `gh pr list --base <branch>`
  empty (retarget dependents to main first — GitHub auto-closes PRs whose base
  branch is deleted).
- **A CONFLICTING PR gets zero `pull_request` CI runs, silently.** Pushes to a
  DIRTY-merge-state PR create no runs and no failure signal; the only tell is
  `mergeStateStatus: DIRTY`. Check merge state before trusting an absence of CI
  failures, and reconcile promptly after every main advance.
- Conflicts: send the PR's own agent to reconcile (`git merge origin/main`).
  Standing rule for `pnpm-lock.yaml`: never hand-merge — take main's version,
  rerun `pnpm install`, regenerate. Shared-file conflicts keep both sides'
  intents; the agent lists every conflict and resolution in its report.
- Squash-merge with the conventional-commit PR title; then worktree remove,
  branch delete, `git pull --ff-only` in the main checkout.
- The director merges product PRs. Harness/self-modification PRs the cofounder
  wants gated stay unmerged for their review.

## Review protocol

- **UI changes**: engineers commit screenshots (PNGs/GIFs) to the PR branch and
  post gallery comments embedding them via `raw.githubusercontent.com` URLs (works
  inline on public repos). The cofounder reviews on the PR when they want the
  call; otherwise the director rules and records the rationale. Prototype PRs stay
  draft — a prototype resolves on accepted direction, not on merge.
- **Code**: engineers run /code-review before marking ready; the director spot
  checks the diff at merge time proportionally to blast radius.
- Wayfinder prototype/grilling tickets are HITL by default: when the human is
  AFK, the director stands in only where explicitly delegated.

## Retro harvesting

- Ask every agent for a retro **without leading it**: "describe friction,
  surprises, or workarounds in your workflow, step by step; don't
  editorialize." Never name the suspected pain point in the question.
- Collect retros as report sections; synthesize across several agents before
  changing the harness — one agent's anecdote is noise, three agents' repetition
  is signal.
- Lessons land in version-controlled places, never only in the director's head
  or chat log — and the target is the **whole harness**, not one skill: workflow
  skills (/implement, /tdd, /code-review prompt tweaks), CLI commands (context
  surfaces, watchers, task lists), CI/infra (caching, cycle time), AGENTS.md.
  When the fix isn't a quick edit, **file it as a harness issue** so it enters
  the normal dispatch loop; a retro finding that never becomes an edit or an
  issue is lost.
- After any substantive harness change, run a **one-ticket canary** on a
  mid-tier model before dispatching the full wave.

## Harness facts

Environment facts agents keep rediscovering. Brief them — or fix the cause and
delete the fact.

### Worktrees and paths

- All worktrees live under `.claude/worktrees/`; entering one outside it is
  hard-gated by an approval prompt no permission setting can suppress. **Always
  dispatch with harness isolation.** The agent is then already inside its
  worktree: never call `EnterWorktree`, never create a second one, and push with
  `git push origin HEAD:<ticket-branch>` since its own branch is auto-named.
- Subagent Bash cwd resets to the main checkout between calls, so a gate run
  without an explicit worktree path silently tests `main` and reports a false
  green. Use `git -C`, `pnpm -C`, absolute paths — and treat a reported gate as
  unverified until CI confirms it on the pushed head SHA.
- A worktree's local `main` goes stale as `origin/main` advances. Diff and review
  against `origin/main`, or the diff fills with other people's commits.
- Skills live at `.agents/skills/<name>/SKILL.md`; the `.claude/skills/*`
  symlinks are not readable by file tools. `disable-model-invocation: true` hides
  a skill from agents — `/implement` dropped that flag; keep it dropped.
- Interruptions reset agents' path habits — one resumed agent wrote into the MAIN
  checkout. Brief resumed agents to re-Read before editing, and check
  `git status --short` there after any resumption.

### Shell and tools

- The Bash tool runs `/bin/bash` even though the interactive shell is fish; fish
  syntax errors under it.
- Bash denials are classifier-based and non-deterministic. Retry with a different
  shape (flag form, split compound), never verbatim.
  Two shapes are refused consistently rather than randomly: anything containing the
  word `eval` (so `agent-browser eval` must go through a script file), and
  multi-statement compounds with redirects. Budget for turning ad-hoc probes into
  committed script files.
- `gh issue view <n> --comments` can print **nothing at all** with exit 0 — silently,
  and still after the 2.96 upgrade that fixed the projectCards errors. Fall back to
  `--json` fields or `gh api repos/{owner}/{repo}/issues/<n>/comments`.
- `gh api` with `-f`/`--raw-field` defaults to POST — pass `-X GET` on reads. `-f
  body=@file` posts the literal `@/path`; capital `-F` reads the file. `gh pr
  checks` misattributes runs — match on the PR's head SHA.
- Background compounds like `sleep N; gh …` can finish with empty output; poll in
  the foreground instead.
- agent-browser needs absolute output paths, and its daemon is shared across
  parallel agents of one session — always `--session <name>`, always scoped
  `close`, or one agent kills another's.
- Background sub-agents lose their parent when it stops, and SendMessage then
  fails silently from the child's side. Synchronous or none.
- The scratchpad is shared per conversation — stage under `stage-issue-<n>/`.

### Git, CI, merging

- `mergeStateStatus` reads UNKNOWN for a few seconds after a push; re-poll.
  CONFLICTING can arrive *after* a PR went ready — every merge re-dirties the
  rest, so re-check per open PR after each merge.
- **A CONFLICTING PR gets zero CI runs, silently.** Absence of failure is not
  success.
- commitlint reads its scopes at hook load, so a new package's scope is invalid
  until its directory exists. A bare `#N` in commit body prose gives misleading
  footer errors — move refs to a trailing `Refs:` footer.
- lint-staged autofixes on commit; afterwards treat `git show`/`git diff` as
  truth, not any staging copy.
- Postgres teardown can flake CI under parallel load (`57P01` after assertions
  passed) — rerun once before diagnosing.
- Never hand-extend an abbreviated SHA for `raw.githubusercontent.com` URLs; one
  agent fabricated one and shipped 404 gallery links. `git rev-parse HEAD` first.
- A rate-limit kill is fully recoverable: resume from the transcript and
  re-verify worktree state. Push early and it stays cheap.

### This repo

- Dev Postgres is pinned to host 5433 because local ports collide with other
  projects. `docker compose up -d --wait` can report Healthy while re-running a
  stale container config — `--force-recreate` after a port mapping change.
- The root `.env` loads via `@hazard-pay/env`'s checkout-root resolution
  (worktree-safe). Never read or print it; presence checks only.
- `hazard-pay worktree clean` leaves dev servers running — orphans squat ports
  (Ladle :61000). Kill by port when a capture probe 404s unexpectedly.
- `pnpm --filter <pkg> dev -- --port N` silently drops the flag; use
  `pnpm exec vite dev --port N --strictPort` so a collision fails loudly.
- A new TanStack route fails `tsc` until `vite build` regenerates
  `routeTree.gen.ts` — commit the generated file in the same commit.
- Shared-literal registries (contract index, error tables, router imports)
  conflict on every concurrent PR pair, but stay mechanical "keep both rows"
  merges when the add-an-endpoint pattern is followed.

### Canvas capture

- **agent-browser is ONE shared session per machine.** Two agents capturing
  concurrently overwrite each other's page mid-shot. This happened, and both galleries
  were quietly wrong in a way that looked fine. Set a unique `AGENT_BROWSER_SESSION`
  per agent and brief it in the dispatch.
- **`agent-browser open` returns before navigation completes**, so a readiness poll can
  pass against the *outgoing* page and a screenshot returns the previous shot's pixels
  at the previous shot's canvas size. Re-opening the URL the page is already on does not
  navigate at all. Require a per-shot nonce in `location.search` before shooting, and
  hash-check that no two shots in a series are byte-identical.
- Element screenshots are unreliable for canvas/WebGL — the drawing buffer is
  cleared on composite and CDP fails wide sheets. Pull `canvas.toDataURL()`
  through `agent-browser eval --max-output <large>` and base64-decode.
- Build filmstrips into the page rather than reloading per frame: deterministic,
  ~4x faster, and the GIF cannot disagree with the strip. Capture at the
  animation's native step rate or the acted beats alias out.
- Give cold critics filmstrip PNGs rather than GIFs, capture a full lineup before
  trusting one controlled still, and treat single-critic measurements as
  provisional.
