# @hazard-pay/observability

Telemetry facade (ADR 0005; design discussion in #10). Everything an agent
needs to *query* telemetry — storage layout, schema contract, canonical
grep/jq/DuckDB queries — lives in this package's `README.md`. Read it first.

## Rules

- **Facade only.** App code imports `@hazard-pay/observability` (or
  `/browser`); pino and `@opentelemetry/*` appear in this package.json and
  nowhere else. SDK churn stays inside this package.
- **Surface is fixed**: `initObservability`, `createLogger`, `withSpan`,
  `emitEvent`. Growing it is a design decision — take it to a ticket, not a
  PR comment.
- **`createLogger` is the only pino constructor in the repo** (ADR 0002).
  Apps call it once at boot; request/job adapters derive `.child(...)`
  loggers. Never construct a second root.
- **Redaction lives in `src/redact.ts` only** (#22). Both sinks — logger
  factory and span exporter — and the browser buffer feed through it. A new
  emission path must import it; a new secret shape means extending
  `SECRET_KEY_PATTERN` here, with a test at both sinks.
- **Curated instrumentations** (fastify, http, undici, pg, pino) grow only
  when the stack grows, inside `src/init.ts`. `enhancedDatabaseReporting`
  stays off permanently; no HTTP header capture opt-ins.
- **Tests never load the bootstrap.** `withSpan` is a no-op without the SDK;
  span tests use `BasicTracerProvider` + `InMemorySpanExporter` in-memory.
  Logger/exporter tests redirect output with the `telemetryDir` option.
- **Events are domain events** — past-tense facts, named per CONTEXT.md
  vocabulary (`match.completed`, not `matchEnd`). No typed event catalog yet
  (deliberate, ADR 0005 §3); the analytics seam is
  `subscribeToDomainEvents` in `src/events.ts`, internal to this package.
- The `/browser` entry must stay dependency-light (no OTel packages) and
  isomorphic modules (`redact.ts`, `error-description.ts`) must stay free of
  Node imports.

## Layout

- `src/index.ts` — Node facade exports (everything but the bootstrap)
- `src/init.ts` — NodeSDK bootstrap, exported as `/init` only: the root entry
  imports pino, and modules loaded before the ESM hook registers escape
  instrumentation — bootstrap files must import `/init`
- `src/browser/index.ts` — browser facade (buffered flush to `POST /telemetry`)
- `src/redact.ts` — the shared redaction chokepoint
- `src/logger.ts` / `src/events.ts` / `src/span.ts` — the three Node verbs
- `src/otel/jsonl-span-exporter.ts` — flattened-JSONL SpanExporter
- `src/paths.ts` — repo-root discovery + `var/telemetry/` layout

## Verifying

`pnpm --filter @hazard-pay/observability test` (vitest), then root
`pnpm type-check && pnpm lint`.
