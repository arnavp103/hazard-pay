# @hazard-pay/agent

The event-sourced agent runtime (ADR 0003): loop, store functions, and
replay over the append-only lane event log in `@hazard-pay/db`. The AI SDK
is the model layer only — one single-step `generateText` per model turn,
every tool declared execute-less, so the loop boundary stays here.

## The seam: models are injected, env is never read

`createRuntime({ db, model, logger, leaders })` takes an AI SDK model
**instance**. This package never reads `process.env`, never constructs a
provider, never sees an API key. Hosts construct the provider at their own
edge and pass the key explicitly from `@hazard-pay/env` (the SDK's ambient
env pickup is never relied on):

```ts
const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
const runtime = createRuntime({ db, model: google("gemini-2.5-flash"), logger, leaders });
```

Dev/default model: `gemini-2.5-flash` (free-tier key — keep live calls to a
handful; the SDK's `maxRetries` backoff handles 429s). Everything else runs
on the mock model (`src/testing/mock-model.ts`); CI needs no key.

## Vocabulary (CONTEXT.md is law)

Lane, foreground lane, mission, wake, fold, input, model turn, leader,
leader config, lane event (always qualified — never bare "event"). No
"command", no "run", no "session/thread", no "task/subagent".

## How it works

- **The log is the checkpoint layer.** `lane_events` (PK `(lane_id, seq)`
  as the optimistic append guard) is the only persistent state; the fold
  (`foldLaneEvents`, pure — no clock, randomness, or env) derives messages,
  open obligations, and quiescence from it. External writers append
  `input` events only; the loop alone writes `model_turn`/`tool_result`.
- **Wake** = guarded claim (`open → waking`, stale claims reclaimable) →
  fold → discharge unresolved obligations → batch pending inputs into model
  turns until quiescence under the leader's `maxTurnsPerWake` → release.
  Doorbell scheduling (pg-boss) lives in `apps/api`, not here: hosts call
  `runtime.wake({ laneId })`.
- **Tools are in-process adapters.** A mutating tool's game write and its
  `tool_result` lane event commit in ONE transaction; a tool `err()` rolls
  its writes back via savepoint but records the failure; a throw is a
  defect that aborts the transaction and leaves the obligation open for the
  next wake. Harness tools `spawn_lane` / `send_message` / `cancel_lane`
  are always available (spawn-and-report: lanes are never awaited). A
  mission closes via `cancel_lane` — its parent's, or its own once its
  goal is done (CONTEXT.md: "closed when done").
- **Leaders are declarative config** (`defineLeader`), content-hashed;
  the full config JSON is stored once in `leader_config`, lanes stamp
  `config_hash`. Real leaders belong in `apps/api/src/leaders/`; the
  `hello` leader here is the fixture proving the tool-transaction rule.
- **Fingerprints**: every `model_turn` records a request fingerprint;
  `verifyFingerprints` replays the log and recomputes them (dev/CI drift
  detection). Observability: wakes/turns/tools run inside `withSpan`;
  domain events `lane.created`, `lane.woke`, `mission.spawned`,
  `lane.message_sent`, `mission.cancelled` via `emitEvent`.

## Reserved seams — schema only, do not implement

- **Compaction**: the `compaction` lane event type exists in the schema and
  envelope; folds refuse it (`CompactionReserved`). Implementing it means
  folds start from the latest compaction.
- **Forking**: `lane.forked_from_lane_id` / `forked_from_seq` are never
  written. Fork = replay a shared prefix; fingerprints are its test bed.

## Tests and the live smoke

- `pnpm --filter @hazard-pay/agent test` — mock-model suite on
  template-cloned Postgres (dev Postgres on 5433 must be up: `pnpm db:up`).
- `pnpm --filter @hazard-pay/agent smoke` — live smoke against Gemini.
  Boots OTel from `@hazard-pay/observability/init`, runs one hello-leader
  wake on a template-clone db, asserts the lane event log AND that spans +
  domain events landed in `var/telemetry/agent-smoke*.jsonl`. Skips loudly
  (exit 0) when `GEMINI_API_KEY` is absent — CI stays green. Never read or
  print `.env` contents; key presence is checked via the env schema only.

## Evals (evalite)

Per #5's research resolution: `evalite@beta`, per-package, with a thin
in-house eval harness — evalite's unit is one `task(input) -> output` and
has no first-class multi-turn runner, so `src/testing/eval-harness.ts`
fills that gap.

- **Run**: `pnpm --filter @hazard-pay/agent eval` — mock-model suite
  (`src/hello-leader.mock.eval.ts`), keyless, always green. `pnpm --filter
  @hazard-pay/agent eval:live` — the one live suite
  (`src/hello-leader.live.eval.ts`) against real `gemini-2.5-flash`.
- **`eval` is not part of the repo gate.** `pnpm test` runs `vitest run`
  only; vitest's default include glob (`*.test.ts`/`*.spec.ts`) never
  matches `*.eval.ts`, so evals and tests never collide. Evalite is its own
  runner (Vitest-based internally, but not the `vitest` CLI this package's
  `test` script invokes) — `eval`/`eval:live` are manual/opt-in scripts, not
  wired into any turbo task CI runs, and must stay that way.
- **The eval harness** (`runEvalScript({ leader, model, turns, maxModelRetries? })`,
  `src/testing/eval-harness.ts`): clones its own template db
  (`ensureTemplateDatabase()` then `createTestDatabase()` — not vitest, so
  it clones exactly like `scripts/live-smoke.ts` does), boots a runtime for
  one leader, and replays `turns` as `appendInput` + `wake` pairs in order.
  Returns the artifacts evals score against: `configHash` and the raw
  ordered `events` log (ADR 0003 §3 — the cross-trace comparison key and
  the comparable trace artifact), the folded `snapshot`, every `toolCalls`
  entry the script triggered, and `finalText`. Drops its db in `finally`.
- **Scorers stay honest**: the mock suite only imports from
  `evalite/scorers/deterministic` (never the LLM-judge scorers in
  `evalite/scorers`) plus hand-rolled structural scorers over the log
  shape, obligation discharge, and `config_hash` stability (both suites
  assert `output.configHash` against the leader's own content hash — ADR
  0003 §3's comparison key, actually exercised, not just carried through).
  The live suite's behavioral scorer is a substring assertion, also from
  `evalite/scorers/deterministic` — no LLM-judge scoring yet; that is the
  promptfoo/adversarial-eval follow-up #5 flagged, not this package.
- **Live-gating** mirrors the smoke: `hello-leader.live.eval.ts` checks
  `GEMINI_API_KEY` via `@hazard-pay/env` at module load (never reads or
  prints `.env` contents) and registers itself with `evalite.skip` plus a
  loud console banner when absent. `eval:live` deliberately passes no
  `--threshold` flag — evalite treats a null average score (the skip case)
  as an automatic threshold failure whenever `--threshold` is present at
  all, so the flag must be absent for a clean skip to exit 0; that also
  means a keyed run is scored but not threshold-gated (informational, given
  the free-tier key). Keep total model calls in this file to a handful.

## Boundaries

- No queue code here — agents never touch pg-boss (ADR 0003 §2).
- Payloads are the versioned envelope in `src/envelope.ts`, never
  provider-raw JSON; new part kinds are an envelope version bump.
- `@hazard-pay/agent/envelope` is the browser-safe subpath (zod only, no
  runtime imports) — it exists so read surfaces (the api contract, admin's
  trace viewer) can name payload shapes without dragging in drizzle or the
  AI SDK. Keep `envelope.ts` importing nothing but zod.
- `@hazard-pay/agent/testing` exports the scripted mock model so other
  packages' integration tests can seed real lane logs through the runtime
  (apps/api's lane read routes do). Test-only surface — never import it
  from production code.
- Intra-package imports carry the `.ts` extension.
