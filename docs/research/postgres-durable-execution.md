# Postgres as durable-execution infrastructure

Research notes for Hazard Pay's agent runtime and server-tick loop. Question:
what are the established patterns for building durable-execution / workflow
infrastructure directly on Postgres — table shapes, job queues, state
machines, exactly-once semantics — and which should our runtime sit on?

Sources surveyed (primary wherever possible): Temporal's architecture docs and
blog, DBOS docs plus its actual system-database schema in source, the
graphile-worker / pg-boss / River / pgmq schemas and docs, and the canonical
"Postgres as a queue" posts (2ndQuadrant/EDB, Brandur Leach, Crunchy Data,
Recall.ai). Every claim carries its source URL.

---

## 1. Two families of durable execution

Everything in this space is one of two recovery models.

### Replay-based (Temporal)

Temporal persists an append-only **Event History** per workflow execution
(`WorkflowExecutionStarted`, `ActivityTaskScheduled/Completed`,
`TimerStarted/Fired`, ...) and recovers by re-running the workflow code from
the beginning, feeding recorded results back instead of re-executing side
effects: "Temporal doesn't restore memory from a snapshot. It starts the
Workflow code from the beginning, replays the Event History step by step...
When a Workflow calls an Activity, the Activity runs once, its result is
recorded in the Event History. During replay, that result is reused, not
recomputed" ([docs.temporal.io/workflows](https://docs.temporal.io/workflows)).
This demands strict determinism: "A Workflow is deterministic if every
execution of its Workflow Definition produces the same Commands in the same
sequence given the same input"
([docs.temporal.io event-history](https://docs.temporal.io/encyclopedia/event-history/event-history-python));
a replay mismatch is a workflow task failure
([TMPRL1100](https://github.com/temporalio/rules/blob/main/rules/TMPRL1100.md)).

Persistence concepts worth stealing even if we never run Temporal
([history-service.md](https://github.com/temporalio/temporal/blob/main/docs/architecture/history-service.md),
[persistence docs](https://docs.temporal.io/temporal-service/persistence)):

- **History table** — append-only log of events (the source of truth).
- **Execution / Mutable State table** — a materialized summary of current
  state (in-flight activities, timers, children) kept consistent with history
  by recording the id of the latest event it reflects.
- **Task tables** — transfer, timer, and visibility task queues co-located
  with workflow state per shard, written **atomically with state updates** —
  an explicit transactional-outbox: "every shard which stores workflow state
  also stores a queue... add the task to the local queue of that shard [and
  commit] atomically"
  ([workflow-engine-principles](https://temporal.io/blog/workflow-engine-principles)).
- Durable timers are first-class rows, so "you can run millions of Timers off
  a single Worker" ([timers docs](https://docs.temporal.io/develop/go/timers)).

Temporal is a separate server + sharded store; the pattern is portable, the
software is heavy.

### Checkpoint-based (DBOS)

DBOS Transact is a **library** that checkpoints each step's output as rows in
Postgres and resumes from the last completed step: "First, checkpoint the
workflow itself in the workflow_status table, then checkpoint the outcome of
each individual step in the operation_outputs table... for each step we first
check: have we executed this step before? If so, we directly read the recorded
output from the database and return the output instead of re-executing it"
([Why All Your Workflows Should Be Postgres Rows](https://www.dbos.dev/blog/why-workflows-should-be-postgres-rows)).
Same determinism rule as Temporal — non-deterministic work goes in steps.

Its actual system tables (verified in source,
[dbos-transact-py `system_database.py`](https://raw.githubusercontent.com/dbos-inc/dbos-transact-py/main/dbos/_schemas/system_database.py);
doc restatement at [docs.dbos.dev system tables](https://docs.dbos.dev/explanations/system-tables)):

- `workflow_status(workflow_uuid PK, status, name, inputs, output, error,
  executor_id, recovery_attempts, queue_name, deduplication_id, priority,
  workflow_timeout_ms, parent_workflow_id, ...)` — status enum
  `PENDING | SUCCESS | ERROR | ENQUEUED | DELAYED | CANCELLED |
  MAX_RECOVERY_ATTEMPTS_EXCEEDED`; partial indexes on `PENDING`/`DELAYED`;
  unique `(queue_name, deduplication_id)`.
- `operation_outputs(workflow_uuid, function_id PK pair, function_name,
  output, error, child_workflow_id, ...)` — one row per completed step.
- `workflow_events` / `workflow_events_history`, `notifications`, `streams` —
  durable key-value events, inter-workflow messaging, ordered streams.
- `queues(name, concurrency, worker_concurrency, rate_limit_max,
  rate_limit_period_sec, priority_enabled, ...)` — queues are just workflow
  rows with `queue_name` set; dedup/priority live on `workflow_status`.
- `workflow_schedules` — cron rows (`schedule`, `last_fired_at`, timezone).

Recovery: workflow IDs are idempotency keys ("if a workflow is called
multiple times with the same ID, it executes only once",
[workflow tutorial](https://docs.dbos.dev/python/tutorials/workflow-tutorial));
on restart every `PENDING` workflow tagged with the process's `executor_id`
is re-invoked and fast-forwards through checkpoints
([workflow recovery](https://docs.dbos.dev/production/workflow-recovery)).

---

## 2. The recurring queue/table patterns

All four surveyed queue implementations converge on the same primitives.

### 2.1 The jobs-table shape

A single table (optionally partitioned per queue) with roughly this shape —
composite of graphile-worker's `_private_jobs`
([schema.sql](https://raw.githubusercontent.com/graphile/worker/refs/heads/main/__tests__/schema.sql)),
pg-boss's `job`
([plans.ts](https://raw.githubusercontent.com/timgit/pg-boss/master/src/plans.ts)),
and River's `river_job`
([river_job.sql](https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/internal/dbsqlc/river_job.sql)):

```sql
CREATE TYPE job_state AS ENUM (
  'available','scheduled','running','retryable','completed','cancelled','discarded'
);  -- River's enum, the most complete state machine of the four

CREATE TABLE jobs (
  id           bigserial PRIMARY KEY,
  kind         text NOT NULL,             -- task identifier / queue name
  args         jsonb NOT NULL DEFAULT '{}',
  state        job_state NOT NULL DEFAULT 'available',
  priority     smallint NOT NULL DEFAULT 0,
  run_at       timestamptz NOT NULL DEFAULT now(),  -- scheduled_at
  attempts     smallint NOT NULL DEFAULT 0,
  max_attempts smallint NOT NULL DEFAULT 25,
  errors       jsonb[],                   -- or last_error text
  locked_at    timestamptz,
  locked_by    text,                      -- worker id (River: attempted_by text[])
  key          text,                      -- dedup / job_key
  finalized_at timestamptz,
  metadata     jsonb NOT NULL DEFAULT '{}'
);
```

Recurring refinements seen in the wild:

- **Generated availability column** — graphile-worker:
  `is_available boolean GENERATED ALWAYS AS ((locked_at IS NULL) AND
  (attempts < max_attempts)) STORED`
  ([schema.sql](https://raw.githubusercontent.com/graphile/worker/refs/heads/main/__tests__/schema.sql)).
- **Partial unique indexes for singleton/dedup semantics** — pg-boss enforces
  its queue policies (`short`, `singleton`, `stately`) with e.g.
  `CREATE UNIQUE INDEX ... ON job (name, COALESCE(singleton_key,'')) WHERE
  state = 'active' AND policy = 'singleton'`
  ([plans.ts](https://raw.githubusercontent.com/timgit/pg-boss/master/src/plans.ts));
  River gates uniqueness by a state bitmask:
  `CREATE UNIQUE INDEX river_job_unique_idx ON river_job (unique_key) WHERE
  unique_key IS NOT NULL AND ... river_job_state_in_bitmask(unique_states, state)`
  ([006_bulk_unique.up.sql](https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/migration/main/006_bulk_unique.up.sql)).
- **State-transition invariants as CHECK constraints** — River:
  `finalized_at` must be set iff state is terminal
  ([002_initial_schema.up.sql](https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/migration/main/002_initial_schema.up.sql)).
- **List-partitioning by queue name** — pg-boss v10+ exposes one logical
  `job` table, `PARTITION BY LIST (name)`, so hot queues can get a dedicated
  physical partition
  ([introduction.md](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/introduction.md)).
- **Dead-letter queues as a column** — pg-boss `dead_letter text` names the
  target queue; provenance columns (`source_name`, `source_id`, ...) allow
  `redrive()` back
  ([10.0.0 release notes](https://github.com/timgit/pg-boss/releases/tag/10.0.0)).
- **Archive tables** — pgmq moves consumed messages from `q_<name>` to
  `a_<name>`; pg-boss archives completed jobs on a retention timer. Keeping
  the hot table small is a bloat defense (see 2.4).

### 2.2 The dequeue: `FOR UPDATE SKIP LOCKED`

Universal since Postgres 9.5. The canonical explanation is Craig Ringer's
2ndQuadrant post: `SKIP LOCKED` "tries to acquire a lock on each row. If it
fails to acquire the lock, it ignores the row as if it wasn't in the table at
all and carries on" — fixing the naive patterns where "all but one worker are
blocked on a row lock"
([mirror of the 2ndQuadrant post](https://jaytaylor.com/notes/node/1540867485000.html);
original 2ndQuadrant URL now redirects post-EDB-acquisition). Brandur: "The
most important [Postgres feature] for a queue was the addition of SKIP LOCKED
in 9.5" ([brandur.org/river](https://brandur.org/river)).

The claim-and-mark shape, verbatim from River's `JobGetAvailable`
([river_job.sql](https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/internal/dbsqlc/river_job.sql)):

```sql
WITH locked_jobs AS (
  SELECT * FROM river_job
  WHERE state = 'available' AND queue = @queue AND scheduled_at <= now()
  ORDER BY priority ASC, scheduled_at ASC, id ASC
  LIMIT @max_to_lock
  FOR UPDATE SKIP LOCKED
)
UPDATE river_job
SET state = 'running', attempt = attempt + 1, attempted_at = now(),
    attempted_by = array_append(attempted_by, @attempted_by)
FROM locked_jobs WHERE river_job.id = locked_jobs.id
RETURNING river_job.*;
```

graphile-worker's `batchGetJobs` builds essentially the same statement
(with an extra `SKIP LOCKED` subselect on `_private_job_queues` for
serialized named queues)
([getJobs.ts](https://raw.githubusercontent.com/graphile/worker/refs/heads/main/src/sql/getJobs.ts)).
Crunchy Data shows the `DELETE ... USING (SELECT ... FOR UPDATE SKIP LOCKED)`
destructive variant
([Message Queuing Using Native PostgreSQL](https://www.crunchydata.com/blog/message-queuing-using-native-postgresql)).

Two crash-recovery styles for claimed-but-dead jobs:

- **Visibility timeout** (pgmq): `read()` bumps a `vt` timestamptz; a message
  whose worker died simply reappears when `vt` passes. pgmq documents
  "exactly once delivery of messages to a consumer within a visibility
  timeout" — i.e. at-least-once across timeouts
  ([pgmq README](https://raw.githubusercontent.com/pgmq/pgmq/main/pgmq-extension/README.md)).
- **Lock columns + rescuer** (graphile-worker, River): `locked_at/locked_by`
  or `running` state, reclaimed by an explicit sweep (River's "rescuer"
  maintenance service; graphile-worker's `force_unlock_workers`).

### 2.3 Low-latency wakeup: LISTEN/NOTIFY, with a caveat

All four use `pg_notify` on insert to wake pollers: River's `AFTER INSERT`
trigger fires `pg_notify('river_insert', ...)` when a job is inserted
`available`
([002_initial_schema.up.sql](https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/migration/main/002_initial_schema.up.sql));
graphile-worker claims sub-3ms schedule-to-execution latency this way
([worker.graphile.org performance](https://worker.graphile.org/docs/performance));
"Postgres' NOTIFY respects transactions, so the moment a job is ready to work
a job queue can wake a worker" ([brandur.org/river](https://brandur.org/river)).

**Caveat**: NOTIFY takes a database-wide `AccessExclusiveLock` during commit
"effectively serializing all commits" on write-heavy databases — Recall.ai
had three outages from this in March 2025 and concluded "Don't use
LISTEN/NOTIFY if you want your database to scale to many writers"
([recall.ai post](https://www.recall.ai/blog/postgres-listen-notify-does-not-scale);
a [Postgres core fix](https://github.com/postgres/postgres/commit/282b1cde9dedf456ecf02eb27caf086023a7bb71)
has since landed upstream). Pattern: treat NOTIFY as a latency optimization
over polling, never as the correctness mechanism — every library retains a
poll loop.

### 2.4 Bloat and the long-transaction hazard

Brandur's "Postgres Job Queues & Failure by MVCC" documents the classic
failure: deleted/updated job rows "are not actually deleted immediately, but
rather only flagged as deleted so that they'll still be available to any open
snapshots"; one long-running transaction anywhere in the database holds the
vacuum horizon and dequeue latency ballooned ~15x
([brandur.org/postgres-queues](https://brandur.org/postgres-queues)).
Mitigations that recur across sources: keep the hot table small (archive
tables, pg-boss retention, pgmq `a_<name>`), highly selective partial
indexes on the pending state, terminate long-open transactions, and — if the
queue table is only a staging area — drain it in bulk to the executor
("Transactionally Staged Job Drains",
[brandur.org/job-drain](https://brandur.org/job-drain)).

### 2.5 Exactly-once semantics: what is actually achievable

Exactly-once **delivery** is not on offer anywhere; exactly-once
**processing** is, via three composable patterns:

1. **Transactional enqueue** — insert the job in the same transaction as the
   state change that warrants it; the job "is enqueued if [its] transaction
   commits, [is] removed if [its] transaction rolls back, and [isn't] visible
   for work until commit" — River's flagship feature
   ([transactional enqueueing](https://riverqueue.com/docs/transactional-enqueueing)),
   and the generalized transactional-outbox pattern ("publish an event or
   message as part of a database transaction... a separate process polls the
   outbox table"; consumers "must be idempotent" because the relay may
   duplicate,
   [microservices.io](https://microservices.io/patterns/data/transactional-outbox.html)).
   Temporal uses exactly this internally per shard
   ([workflow-engine-principles](https://temporal.io/blog/workflow-engine-principles)).
2. **Idempotency keys** — a unique key per logical operation plus recorded
   response and a `recovery_point` state machine
   (`started → ride_created → charge_created → finished`) so retries resume
   rather than redo; DBOS workflow IDs are precisely this
   ([brandur.org/idempotency-keys](https://brandur.org/idempotency-keys),
   [DBOS workflow tutorial](https://docs.dbos.dev/python/tutorials/workflow-tutorial)).
3. **Piggybacked checkpoints** — when the step's own writes go to the same
   Postgres, commit the step's effects and its completion record in one
   transaction: "the step either fully completes and commits (including its
   checkpoint) or fails and completely rolls back — the step is guaranteed to
   execute exactly once"
   ([Why Postgres is a Good Choice for Durable Workflow Execution](https://www.dbos.dev/blog/why-postgres-durable-execution)).
   This is the strongest guarantee available and it **only** works because
   app state and workflow state share a database — directly relevant to us,
   since Hazard Pay's game state is already in Postgres. Steps with external
   side effects degrade to at-least-once + idempotency
   ([DBOS steps tutorial](https://docs.dbos.dev/python/tutorials/step-tutorial)).

### 2.6 Singleton workers, leader election, and recurring ticks

- **Advisory locks** — application-defined locks
  (`pg_advisory_lock` / `pg_try_advisory_lock`, session- or
  transaction-scoped) are the standard "only one of me runs" primitive
  ([Postgres docs, Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html);
  worked singleton example in
  [Atomic Object's Redis-vs-Postgres post](https://spin.atomicobject.com/redis-postgresql/)).
- **Leader table with TTL** — River elects one leader per database via an
  unlogged `river_leader(name PK, leader_id, elected_at, expires_at)` row
  with a 5s TTL; the leader runs maintenance services (cleaner, rescuer,
  scheduler, periodic enqueuer)
  ([002_initial_schema.up.sql](https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/migration/main/002_initial_schema.up.sql)).
- **Cron via the queue itself** — graphile-worker's crontab enqueues normal
  jobs and dedupes across workers "thanks to SQL ACID-compliant transactions
  and our known_crontabs lock table," with backfill of missed runs
  ([worker.graphile.org/docs/cron](https://worker.graphile.org/docs/cron));
  pg-boss schedules with `cron-parser` plus a DB-held distributed lock so one
  instance fires
  ([scheduling.md](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/scheduling.md));
  pg_cron runs inside Postgres, supports sub-minute `'[1-59] seconds'`
  intervals, and runs "only one instance of each specific job at a time"
  ([pg_cron](https://github.com/citusdata/pg_cron),
  [Making Postgres tick](https://www.citusdata.com/blog/2023/10/26/making-postgres-tick-new-features-in-pg-cron/)).
- **Throttle/debounce slots** — pg-boss `singleton_on` time-slot column gives
  "one job per interval" semantics (`sendThrottled`/`sendDebounced`)
  ([jobs.md](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/jobs.md))
  — a good fit for "at most one offline-progression catch-up job per player."

No first-party source covers a fixed-interval *game tick* loop specifically;
the composable pattern for it is: leader-elected ticker (advisory lock or
TTL row) enqueues a tick job per interval, tick processing is idempotent on
`(entity_id, tick_number)`, and missed ticks are handled by backfill logic
(graphile-worker cron's backfill is the closest prior art).

---

## 3. Candidate approaches and tradeoffs

### A. Adopt a queue library: pg-boss or graphile-worker (Node/TS)

Both give the jobs table, SKIP LOCKED dequeue, retries/backoff, cron,
LISTEN/NOTIFY wakeup, and archival out of the box.

- **graphile-worker**: fastest (~183k trivial jobs/sec with batching in
  their benchmark; sub-3ms latency claim,
  [performance docs](https://worker.graphile.org/docs/performance)),
  job_key dedup modes, crontab with backfill. Schema is explicitly private
  (`_private_*` since v0.16,
  [0.16 release](https://worker.graphile.org/news/2023-12-11-016-release)) —
  you are not meant to build on its tables directly.
- **pg-boss**: richest queue semantics (policies, throttle/debounce slots,
  DLQs with redrive, pub/sub, per-queue partitioning,
  [introduction.md](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/introduction.md)).

Tradeoff: these are **job queues, not workflow engines** — no step
checkpointing, no multi-step recovery. A crashed multi-step agent run
restarts from the top; we'd hand-roll the checkpoint layer anyway.
(River is Go-only — pattern donor, not a candidate.)

### B. Adopt a durable-execution library: DBOS Transact (TypeScript)

Gives workflows + steps + checkpointing + queues + cron in-process against
our existing Postgres; no extra server; exactly-once for steps that write to
the same Postgres ([DBOS vs. Temporal](https://www.dbos.dev/compare/dbos-vs-temporal)
— vendor-authored, performance numbers therein are marketing claims).
Workflow-ID idempotency and executor-tagged recovery come free.
Tradeoffs: decorator/wrapper-oriented API to reconcile with our functional
style; framework buy-in on the critical path of the game loop; smaller
community than the queue libraries.

### C. Adopt Temporal

Strongest tooling and replay model, but a separate always-on server cluster
and its own persistence — heavy for a pnpm monorepo game backend whose state
is already in one Postgres. The patterns (event history + mutable state +
outbox task queues) are worth copying; the deployment is not warranted at
our scale.

### D. Hand-roll on SKIP LOCKED + Drizzle

Own a `jobs` table (2.1), the River-style claim query (2.2), a
`workflow_status`/`operation_outputs`-shaped checkpoint pair (1.2), advisory
-lock ticker, and piggybacked-checkpoint transactions (2.5.3). Every piece is
well documented above and Drizzle-friendly; total surface is a few hundred
lines of SQL + TS. Tradeoffs: we own retry edge cases, bloat hygiene
(archival, partial indexes, long-transaction policing — the entire failure
literature of 2.4), rescuer sweeps, and backpressure — the exact
accumulated-scar-tissue that pg-boss/River encode.

---

## 4. Recommendation shortlist

For the later "agent runtime design" decision, in order of current preference:

1. **pg-boss for the queue + a thin hand-rolled checkpoint layer** —
   pg-boss owns dequeue/retry/cron/DLQ/throttling (its
   singleton-slot semantics map cleanly onto per-player offline-progression
   catch-up); we add two small tables modeled on DBOS's
   `workflow_status` / `operation_outputs` for multi-step agent runs, with
   checkpoints piggybacked on the same transactions as game-state writes for
   exactly-once steps. Small owned surface, battle-tested queue core.
2. **DBOS Transact wholesale** — if prototyping shows agent runs are deeply
   multi-step and we'd otherwise rebuild most of DBOS. Strongest guarantee
   story with least code; costs framework coupling.
3. **Full hand-roll on SKIP LOCKED** (River's schema as the blueprint) —
   only if we hit a design wall in both libraries; maximal control, maximal
   scar tissue to re-earn.

Not shortlisted: Temporal (operational weight disproportionate at our scale);
pgmq (SQS-shaped visibility-timeout messaging, no retry/state machine —
wrong layer for us); graphile-worker (excellent, but pg-boss's
singleton/throttle/DLQ semantics fit the game domain better and its schema
is meant to be private).

Whatever is chosen: keep NOTIFY as an optimization over polling only (2.3),
budget for archival + partial indexes from day one (2.4), and make every tick
handler idempotent on `(entity_id, tick_number)` (2.5).

---

## Source index

- Temporal: https://temporal.io/blog/workflow-engine-principles ·
  https://docs.temporal.io/workflows ·
  https://docs.temporal.io/encyclopedia/event-history/event-history-python ·
  https://docs.temporal.io/temporal-service/persistence ·
  https://docs.temporal.io/task-queue ·
  https://docs.temporal.io/develop/go/timers ·
  https://github.com/temporalio/temporal/blob/main/docs/architecture/history-service.md ·
  https://github.com/temporalio/rules/blob/main/rules/TMPRL1100.md
- DBOS: https://www.dbos.dev/blog/why-workflows-should-be-postgres-rows ·
  https://www.dbos.dev/blog/why-postgres-durable-execution ·
  https://www.dbos.dev/compare/dbos-vs-temporal ·
  https://docs.dbos.dev/explanations/system-tables ·
  https://docs.dbos.dev/production/workflow-recovery ·
  https://docs.dbos.dev/python/tutorials/workflow-tutorial ·
  https://docs.dbos.dev/python/tutorials/step-tutorial ·
  https://raw.githubusercontent.com/dbos-inc/dbos-transact-py/main/dbos/_schemas/system_database.py
- graphile-worker: https://worker.graphile.org/docs ·
  https://worker.graphile.org/docs/performance ·
  https://worker.graphile.org/docs/cron ·
  https://worker.graphile.org/docs/schema ·
  https://worker.graphile.org/news/2023-12-11-016-release ·
  https://raw.githubusercontent.com/graphile/worker/refs/heads/main/__tests__/schema.sql ·
  https://raw.githubusercontent.com/graphile/worker/refs/heads/main/src/sql/getJobs.ts
- pg-boss: https://raw.githubusercontent.com/timgit/pg-boss/master/docs/introduction.md ·
  https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/jobs.md ·
  https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/scheduling.md ·
  https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/pubsub.md ·
  https://raw.githubusercontent.com/timgit/pg-boss/master/src/plans.ts ·
  https://github.com/timgit/pg-boss/releases/tag/10.0.0
- River: https://riverqueue.com/docs/transactional-enqueueing ·
  https://riverqueue.com/docs/unique-jobs ·
  https://riverqueue.com/blog/announcing-river ·
  https://brandur.org/river ·
  https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/internal/dbsqlc/river_job.sql ·
  https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/migration/main/002_initial_schema.up.sql ·
  https://raw.githubusercontent.com/riverqueue/river/master/riverdriver/riverpgxv5/migration/main/006_bulk_unique.up.sql
- pgmq: https://raw.githubusercontent.com/pgmq/pgmq/main/pgmq-extension/README.md ·
  https://raw.githubusercontent.com/pgmq/pgmq/main/pgmq-extension/sql/pgmq.sql
- Postgres-as-a-queue literature:
  https://jaytaylor.com/notes/node/1540867485000.html (mirror of the
  2ndQuadrant SKIP LOCKED post; original URL now redirects to EDB) ·
  https://www.crunchydata.com/blog/message-queuing-using-native-postgresql ·
  https://brandur.org/postgres-queues · https://brandur.org/job-drain ·
  https://brandur.org/idempotency-keys ·
  https://www.recall.ai/blog/postgres-listen-notify-does-not-scale ·
  https://github.com/postgres/postgres/commit/282b1cde9dedf456ecf02eb27caf086023a7bb71 ·
  https://microservices.io/patterns/data/transactional-outbox.html ·
  https://spin.atomicobject.com/redis-postgresql/ ·
  https://www.postgresql.org/docs/current/explicit-locking.html ·
  https://github.com/citusdata/pg_cron ·
  https://www.citusdata.com/blog/2023/10/26/making-postgres-tick-new-features-in-pg-cron/
