---
name: director
description: "Orchestrate parallel implementation agents against the issue tracker: dispatch waves, review and merge their PRs, keep the wayfinder map current, and harvest process lessons back into the harness."
---

You are the **director**: the one session that dispatches parallel engineer agents,
reviews and merges their work, records decisions, and keeps the shared map honest.
Engineers implement; the director rules, merges, and bookkeeps. This skill is the
playbook — and its **Harness facts** section is a living record harvested from
engineer retros; keep extending it.

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
- **Workflow**: follow `/implement` (worktree → draft PR first → incremental
  pushes → green gate → /code-review → `gh pr ready`). Agents never merge, never
  close issues, never remove their own worktree.
- **Scope fence**: which dirs are theirs, which shared files they may touch, who
  else is flying concurrently and where conflicts will be resolved (by the
  director, at merge time — agents don't coordinate laterally).
- **Report format**: PR number + branch, what was built, decisions beyond the
  ticket with rationale, *honest* gate + CI results, a draft resolution comment
  for the ticket, and a raw git-workflow retro section.
- **Sub-agent rule**: no background sub-agents for the main thread of work;
  synchronous only, and only for true side-work.

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

- **Top tier (inherit)**: architecture-heavy scaffolds, ADR-implementing packages,
  anything with cross-package contract design, design/aesthetic judgment.
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
  surprises, or workarounds in your git workflow, step by step; don't
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

## Harness facts (living — extend from each retro round)

Environment facts agents keep rediscovering; brief them or fix them:

- `.claude/` is deny-listed for Read/Edit/Write file tools (Bash mostly works).
  Consequence: worktrees live at `<repo>/.worktrees/<branch>`, not
  `.claude/worktrees/` — file tools work normally there. Skills are readable at
  `.agents/skills/<name>/SKILL.md` (the `.claude/skills` symlinks are not).
- Skills carrying `disable-model-invocation: true` are invisible to agents'
  Skill tool. `/implement` deliberately dropped the flag; keep it dropped.
- Subagent cwd is pinned: `cd <dir> && cmd` compounds get denied
  (inconsistently), `EnterWorktree` refuses from a repo-root session. Reliable
  forms: `git -C`, `pnpm -C` / `--filter`, absolute paths everywhere.
- Bash permission denials are classifier-based and non-deterministic — near
  identical commands can differ. Retry with a different shape (flag form, split
  compound) instead of repeating verbatim.
- Background sub-agents lose their parent when it stops; SendMessage to it then
  fails silently from the child's side. Synchronous sub-agents or none.
- `gh issue view <n> --comments` sometimes prints nothing with exit 0. Fall back
  to `--json` fields or `gh api repos/{owner}/{repo}/issues/<n>/comments`.
- The shell is fish: bare `echo ===` separators error; skip decorative
  separators in compound commands.
- Local ports collide with other projects' containers (dev Postgres is committed
  on host 5433 for exactly this reason). `docker compose up -d --wait` can report
  Healthy while re-running an old container config — use `--force-recreate` when
  a port mapping changed.
- The harness's `isolation: worktree` auto-creates `agent-*` worktrees on
  auto-named branches under `.claude/worktrees/`; work pushed from there must
  target the ticket branch explicitly (`git push origin HEAD:<branch>`). Prefer
  skill-managed worktrees.
- Secrets: the root `.env` is loaded via `@hazard-pay/env`'s checkout-root
  resolution (worktree-safe). Agents never read or print `.env` contents;
  presence checks only.
- Background Bash compounds of the shape `sleep N; gh ...` (and multi-step
  `gh run watch` chains) can complete with empty output; poll in the foreground
  instead. `gh pr checks` misattributes runs — resolve the PR's head SHA and
  match runs via `gh run view --json headSha`.
- The scratchpad directory is shared across agent sessions of one conversation:
  stage files under a per-task subdirectory (`stage-issue-<n>/`), never at the
  scratchpad root, or you'll clobber another agent's staging tree.
- The Skill tool serves `.claude/skills/*` symlinked skills fine despite the
  file-tool read-deny on that tree — the deny applies to Read/Edit/Write, not
  skill invocation.
- lint-staged autofixes at commit time make committed files drift from any
  scratchpad staging copies; after committing, treat the worktree (via
  `git show`/`git diff`), not your staging copies, as truth.
- `gh api` with `-f`/`--raw-field` params defaults to **POST** — always pass
  `-X GET` on query-param reads or you'll accidentally try to create resources.
- `mergeable`/`mergeStateStatus` read `UNKNOWN` for a few seconds after any
  push while GitHub recomputes — treat UNKNOWN as not-conflicting, re-poll.
- commitlint's scope universe is read at hook load: a new package's scope is
  invalid until its directory exists (draft-PR empty commits use `repo`).
- CONFLICTING can arrive AFTER a PR went ready — every main merge re-dirties
  the other open PRs; the director re-checks (or has the agent re-check) merge
  state per open PR after every merge.
- agent-browser output paths are daemon-cwd-relative — require absolute paths.
- `hazard-pay worktree clean` removes trees but not dev servers started from
  them — orphaned processes squat ports (Ladle :61000) and confuse the next
  session; kill by port when a capture probe 404s unexpectedly.
- A rate-limit kill mid-flight is fully recoverable: resume the agent via its
  transcript with a "this was a limit, not a problem — re-verify worktree
  state and continue" message. Push-early discipline is what makes this cheap.
- Interruptions reset agents' file-state tracking AND their path habits: one
  resumed agent wrote a batch of files into the MAIN checkout via
  wrong-but-valid absolute paths. Brief resumed agents to re-Read before
  editing, and the director should run `git status --short` on the main
  checkout after any agent resumption — wrong-tree writes surface there
  immediately.
- Shared-literal registries (contract index, error tables, router import
  blocks) conflict on every concurrent PR pair — but stay mechanical
  "keep both rows" merges when the repo's add-an-endpoint pattern is
  followed. If friction recurs, consider a self-registration ADR.
- Under high parallel test-db load, Postgres teardown can flake a CI run
  (`57P01` after all assertions passed) — rerun once before diagnosing.
- A bare `#N` in commit body prose makes commitlint emit **misleading** footer
  errors (`footer-leading-blank`, phantom blank lines) — the fix is always
  "move the ref to the trailing `Refs:` footer", whatever the error says.
  (Hook-level fix tracked as a harness issue.)
- Canary verdict 2026-07-21: after the worktree/CLI/env harness round, a
  mid-tier (sonnet) agent ran a full ticket with zero permission workarounds —
  the hardened path (CLI worktree new, invocable /implement, `.worktrees/` file
  tools, checkout-root env) is confirmed carrying the workflow.
