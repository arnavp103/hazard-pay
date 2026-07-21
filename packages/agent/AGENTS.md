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

## Boundaries

- No queue code here — agents never touch pg-boss (ADR 0003 §2).
- Payloads are the versioned envelope in `src/envelope.ts`, never
  provider-raw JSON; new part kinds are an envelope version bump.
- Intra-package imports carry the `.ts` extension.
