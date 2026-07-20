# ADR 0003: event-sourced agent runtime (packages/agent)

- **Status**: accepted
- **Date**: 2026-07-20
- **Decided in**: [hazard-pay#11](https://github.com/arnavp103/hazard-pay/issues/11) (wayfinder map [#1](https://github.com/arnavp103/hazard-pay/issues/1)) — full discussion and rationale live on the ticket.

## Context

Hazard Pay's AI leaders are real LLM agents (distinct prompts/tools/models)
whose reasoning must be spectatable, replayable, and comparable across model
and prompt versions. The framework survey (#3) and durable-execution research
(#2) preceded this; ADR 0001 co-located queue and game state in one Postgres,
ADR 0002 fixed functional core / imperative shell with ctx-first services.

## Decision

1. **Own event-sourced runtime; AI SDK as the model layer only.** `packages/agent`
   implements the loop, store, and replay on an append-only Postgres log
   (ADK-style: event = unit of streaming and persistence, commit-before-
   continue). The Vercel AI SDK supplies model calls, tool typing, and stream
   vocabulary beneath a loop we own. Mastra/ADK-TS are references, not deps.
2. **Tools are in-process adapters on the shared contract.** A game action is
   one zod contract + ctx-first domain function; the HTTP route and the leader
   tool are two derivations of it. Mutating tools run inside a single
   transaction that commits the game write and the `tool_result` event
   together — exactly-once structurally, no per-route idempotency layer.
   Agents never touch pg-boss; the queue stays inside `apps/api`.
3. **Leaders are game code; the harness is generic.** Leader definitions live
   in `apps/api/src/leaders/` as declarative config over a heavy
   `packages/agent` harness. Config is data: zod-validated `defineLeader`,
   content-hashed per lane; full JSON stored once in `leader_configs`, lanes
   stamp `config_hash` — enabling cross-model/cross-prompt trace comparison.
   Git is the source of truth for configs.
4. **The log is the checkpoint layer; leaders are octopuses.** No separate
   step-checkpoint tables for agent work. A leader owns one long-lived
   **foreground lane** plus bounded, concurrently-running **missions**
   (`lanes` with `kind`, `parent_lane_id`; `lane_events` with PK
   `(lane_id, seq)` as the optimistic-append guard). The log doubles as the
   lane's inbox: external writers append input-type events only. Spawn returns
   a receipt immediately — lanes are never awaited; parent and child exchange
   `send_message` events without either closing. Event payloads carry
   AI-SDK-shaped content inside a small versioned envelope of ours; never
   provider-raw JSON. One `model_turn` event per model call (request
   fingerprint + full response); no request-side event. Resume folds the log
   and discharges unresolved obligations (set-based, survives parallel tool
   calls). Compaction is a recorded event that folds start from; reserved now,
   implemented later, alongside a reserved `forked_from (lane_id, seq)` seam.
5. **Determinism rules now, replay apparatus later.** The fold path reads no
   wall clock, randomness, or environment; effects happen only through
   recorded seams; fingerprints are verified in dev/CI. No content-addressed
   cache: replay never re-executes, so the log is the cache.
6. **Wakes are doorbell jobs.** pg-boss jobs carry `{laneId}` only; inputs are
   enqueued transactionally with their cause (outbox). One queued wake per
   lane (singleton key); wakes batch all pending inputs into one turn; claim
   by guarded update (`open → waking`), recovery by redelivery; run to
   quiescence under per-config `maxTurnsPerWake`. No resident scheduler.
7. **Admin is a read-only microscope** over five queries: lane index,
   transcript, context-at-turn-N (the same exported fold the runtime uses),
   config fetch/diff by hash, lane tree + `trace_id` into the JSONL stream.
   TanStack Query polling only — append-only logs need no realtime transport.

Working names (`lane`, `mission`, `wake`, `input`, `model_turn`, `compaction`)
are ratified in the domain-vocabulary ticket (#12).

## Consequences

- Adding a leader is configuration; adding a game action is one domain
  function plus two thin derivations; neither touches the runtime.
- Crash-consistency reduces to one invariant — log and world share commits —
  asserted by a kill-mid-wake test against a template-clone db; CI runs the
  whole spine on a stub model provider with no API key.
- Trace tooling, evals, and replay all consume one fold implementation, so
  what admin shows, what evals score, and what the model saw cannot drift.
- Storage grows append-only; compaction bounds fold cost, and archival/bloat
  hygiene from the durable-execution research applies when volume warrants.
- Forking and cross-version replay are deliberately deferred; their seams
  (`forked_from`, fingerprints, fold-through-parent) are load-bearing today.
