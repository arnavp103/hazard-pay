# ADR 0004: match transport and tick architecture

- **Status**: accepted
- **Date**: 2026-07-20
- **Decided in**: [hazard-pay#9](https://github.com/arnavp103/hazard-pay/issues/9) (wayfinder map [#1](https://github.com/arnavp103/hazard-pay/issues/1)) — full discussion and rationale live on the ticket.

## Context

The overworld tier is already locked to TanStack Query stale-while-revalidate
polling. This decision covers the match tier — how live match state reaches the
browser — and the server tick loop: cadence, offline-progression catch-up, and
fan-out of results to connected clients. Player commands in a match are
choose-from-a-set with a ~30s (or untimed) window; nothing latency-sensitive
travels client→server. ADR 0002 fixed Fastify and the `server.ts`/`worker.ts`
seam; ADR 0003 fixed doorbell wakes and outbox-enqueued leader inputs.

## Decision

1. **Asymmetric wire.** Player intents go over the normal contract-first HTTP
   routes — typed contract, Neverthrow, the `respond` adapter. The match wire
   is a one-way server→client stream; there is no second command path.
2. **SSE is the match transport.** Events carry a monotone per-match sequence
   id, so `EventSource` auto-reconnect + `Last-Event-ID` makes wifi blips,
   refreshes, and returning spectators one resume path. The stream sits behind
   a thin seam — one server stream module, one client hook — swappable for
   WebSocket later without touching contract routes; no broader transport
   abstraction.
3. **A match has no clock — it is a phase state machine.** A decision phase
   collects commands over HTTP; resolution fires when all commands arrive or
   the deadline hits, is computed atomically in one transaction, and persists
   as an ordered batch of match events the client animates at its own
   presentation pace. The only timer is a pg-boss delayed singleton job per
   `(match, phase)` that force-resolves with defaults, completed early when
   everyone submits. No resident per-match loop: the phase row plus the
   delayed job are the loop state, so restarts are free.
4. **"Tick" means overworld only, and ticks are eager.** A pg-boss cron job
   with backfill, idempotent on `(entity_id, tick_number)`. Leader
   participation enqueues doorbell inputs through the ADR 0003 outbox path;
   the tick never waits for agents — slow wakes batch the next tick's input.
   Offline catch-up is not a mechanism: state is always current, so returning
   is an ordinary overworld fetch. `TICK_INTERVAL` lives in `packages/env`
   with a 5-minute default — headroom for a leader wake to usually finish
   within a tick.
5. **Fan-out: the table is the truth, NOTIFY is the nudge.** SSE connections
   always read the match-events table from their own cursor. The resolving or
   ticking transaction fires `NOTIFY` (post-commit); one shared LISTEN
   connection per server process nudges subscribed connections to re-query; a
   60s per-connection safety re-poll means a dropped notification can only
   delay, never lose. Notifications never carry payloads. Survives the
   ADR 0002 process split. Overworld stays TanStack Query polling — this
   machinery is match-view only.

Working names (`phase`, `decision`, `resolution`) are ratified in the
domain-vocabulary ticket (#12).

## Consequences

- Reconnect, resume, and live-tail are one code path: query the match-events
  table after a sequence id. Server time and presentation time are fully
  decoupled — a 0ms resolution can render as an 8-second fight.
- The api scaffold (#15) gains the SSE endpoint and the shared LISTEN wiring;
  the hello-world tick (#20) has its concrete shape: cron tick → table write →
  NOTIFY → SSE → browser.
- Match progress is crash-safe by construction: commands, phase rows, delayed
  jobs, and event batches are all Postgres state; no process holds match state
  in memory.
- If a future mechanic needs sub-second client→server input mid-combat, the
  stream seam swaps to WebSocket (`@fastify/websocket` is first-party) without
  touching the contract routes or the event-table fan-out.
