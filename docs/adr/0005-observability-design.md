# ADR 0005: observability design (packages/observability)

- **Status**: accepted
- **Date**: 2026-07-21
- **Decided in**: [hazard-pay#10](https://github.com/arnavp103/hazard-pay/issues/10) (wayfinder map [#1](https://github.com/arnavp103/hazard-pay/issues/1)) — full discussion and rationale live on the ticket.

## Context

Telemetry's primary consumer is a shell-native coding agent (grep/jq/DuckDB),
secondarily the dev. The agent-readable observability research (#4)
recommended pino JSONL with OTel-compatible field names and hand-rolled trace
context, holding the OTel SDK as a drop-in upgrade. ADR 0002 fixed the logging
contract (root logger at boot, pino children at the edges, W3C traceparent
propagation), and the packages/db resolution (#8) required emission to stay
decoupled from the log destination so a product-analytics sink can subscribe
later. The realtime match runs in the browser, making the client a
first-class telemetry source rather than an afterthought.

## Decision

1. **OTel tracing SDK from day one, curated auto-instrumentation.**
   Instrumenting early beats retrofitting. Logs stay on pino (OTel's logs
   signal is experimental); spans land via a small custom flattened-JSONL
   `SpanExporter`. Instrumentations are curated — `fastify`, `http`,
   `undici`, `pg`, `pino` — grown only when the stack grows, inside the
   package. Accepted costs: 0.x SDK churn (pinned versions) and a
   `node --import` bootstrap per instrumented process.
2. **Facade: `@hazard-pay/observability` is the only telemetry import.**
   Surface: `initObservability(service)`, `createLogger`, `withSpan`,
   `emitEvent`. `withSpan` is Neverthrow-aware — an `err()` result marks span
   status without a throw. `@opentelemetry/api` appears in exactly one
   package.json; SDK churn never touches app code.
3. **`emitEvent(name, attrs)` is first-class.** Past-tense domain facts
   (`match.completed`), distinct from execution logs. Today a structured log
   line (`event` field, trace ids stamped); later the subscription point for
   product analytics — call sites never migrate. No typed event catalog until
   CONTEXT.md names the domain.
4. **No metrics API.** Durations, counts, and error rates are derived from
   spans and events (DuckDB over JSONL). Revisit when a question can't be
   answered that way (production sampling, process gauges).
5. **Storage: `var/telemetry/`, per-service per-signal JSONL.**
   `<service>.jsonl` (logs + events) and `<service>.spans.jsonl`; gitignored,
   append-only. Cleanup is an explicit clean script — no boot-time
   truncation (a restart must not wipe another process's history), no
   rotation infrastructure.
6. **Footprint: api server + worker (covering the in-process agent runtime)
   load the bootstrap; the browser uses a facade `/browser` entry.** Same
   verbs, implemented lightly: buffered flush to a dev-only `POST /telemetry`
   route on the api, landing in `webapp.jsonl` through the same redacting
   pipeline. `traceparent` rides fetch calls and the match-transport message
   envelope, so one trace spans tick → transport → render. The OTel Web SDK
   is rejected (bundle weight, page-load focus, collector assumption).
   Admin/SSR servers adopt the bootstrap when they hold real logic; tests
   never load it.
7. **Redaction is one shared module feeding both sinks** — logger factory
   and span exporter (tracked in #22). `enhancedDatabaseReporting` stays off
   permanently; no HTTP header capture; browser lines are redacted
   server-side on ingest (the client buffer is untrusted input).
8. **Consumption is documentation, not tooling.** The package README holds
   the schema contract and canonical copy-paste queries (grep-a-trace,
   jq-errors, DuckDB span p95s and event counts); the package AGENTS.md
   points agents at them. An MCP server and CLI query commands are deferred
   with explicit triggers (non-shell agent surface; CLI dev-workflow ticket).

## Consequences

- Full span coverage of pg and HTTP internals from the first commit; agents
  reconstruct cross-process, cross-browser traces from flat files with grep.
- Every emission path — logs, spans, events, browser ingest — passes a single
  redaction chokepoint before disk.
- The analytics seam is load-bearing: a PostHog-style sink subscribes inside
  the package when rollout work begins, with zero call-site changes.
