# @hazard-pay/observability

The telemetry facade (ADR 0005). Apps import **only** this package — never
pino or `@opentelemetry/*` directly. Telemetry's primary consumer is a
shell-native coding agent (grep / jq / DuckDB); everything lands as flat
JSONL under `var/telemetry/` at the repo root.

## Surface

| Verb | What it does |
| --- | --- |
| `initObservability(service)` | OTel NodeSDK bootstrap for `node --import`, imported from **`@hazard-pay/observability/init`**. Curated instrumentations: fastify, http, undici, pg, pino. Returns `{ shutdown }`. |
| `createLogger(service)` | The only pino constructor in the repo. Redacting JSONL to `var/telemetry/<service>.jsonl`; level from `LOG_LEVEL` (`@hazard-pay/env`). First call registers the root logger. |
| `withSpan(name, fn, attrs?)` | Runs `fn(span)` in an active span. Neverthrow-aware: an `err()` marks span status ERROR without a throw; a throw is a defect — recorded and rethrown. |
| `emitEvent(name, attrs?)` | A domain event: past-tense domain fact (`"match.completed"`), written as a log line with an `event` field and trace ids. Future product-analytics subscription point. |
| `ingestTelemetryLines(service, lines, opts?)` | Server side of the browser ingest contract below, for the api's dev-only `POST /telemetry` route: re-redacts every line (client buffers are untrusted), routes by the `signal` discriminator (then strips it), stamps `service`, and appends to the per-service files. |

### Node bootstrap

```ts
// apps/api/src/telemetry.ts — the only file that starts the SDK.
// NOTE: import from /init, not the package root — the root entry loads pino,
// and anything imported before the ESM loader hook registers escapes
// instrumentation.
import { initObservability } from "@hazard-pay/observability/init";

await initObservability("api");
```

```bash
node --import ./src/telemetry.ts src/index.ts   # tsx accepts the same flag
```

Boot order matters: the bootstrap must finish before the app's module graph
loads so auto-instrumentation can patch `pg`, `http`, `undici`, `pino`, and
fastify on first import (`initObservability` registers OTel's
import-in-the-middle ESM loader hook itself — apps never touch it). Fastify
then consumes the root logger (ADR 0002):

```ts
import { createLogger } from "@hazard-pay/observability";

const logger = createLogger("api");
const app = fastify({ loggerInstance: logger });
```

Tests never call `initObservability` — without it, `withSpan` is a no-op
pass-through and `createLogger({ level: "silent" })` keeps ctx loggers quiet.

### Browser entry

```ts
import {
  createLogger, currentTraceparent, emitEvent, initObservability, withSpan,
} from "@hazard-pay/observability/browser";

const handle = initObservability("webapp"); // buffered flush to POST /telemetry
```

Same verbs, implemented lightly: lines buffer in memory, flush every 2s (and
on `pagehide` via `sendBeacon`) to the api's **dev-only** `POST /telemetry`
route, and mirror to the console on localhost. `currentTraceparent()` returns
the active span's W3C `traceparent` for fetch headers and the match-transport
envelope, so one trace spans tick → transport → render.

**Ingest wire contract** (the api route implements this):

- `POST /telemetry`, `content-type: application/json`
- Body: `{ "service": string, "lines": object[] }`
- Each line has `signal: "log" | "span"`; the server redacts every line
  (client buffers are untrusted), strips `signal`, and appends logs/events to
  `var/telemetry/<service>.jsonl`, spans to `<service>.spans.jsonl`.
- The route is dev-only, so the client must be gated too: the webapp passes
  its dev flag as `enabled` at init, and a `404` from the endpoint disables
  the client for the page's lifetime (no retry loop, no growing buffer).

## Storage layout

```
var/telemetry/            # gitignored, append-only
  api.jsonl               # logs + domain events (one JSON object per line)
  api.spans.jsonl         # flattened spans
  worker.jsonl            # ... one pair per service
  webapp.jsonl            # browser lines, via POST /telemetry
```

No rotation, no boot-time truncation (a restart must not wipe another
process's history). Clean explicitly:

```bash
pnpm telemetry:clean
```

## Schema contract

### Log lines (`<service>.jsonl`)

| Field | Notes |
| --- | --- |
| `time` | ISO-8601 UTC — lexicographic order is chronological |
| `level` | pino number: 10 trace, 20 debug, 30 info, 40 warn, 50 error, 60 fatal |
| `service` | bound at creation, on every line |
| `msg` | human-readable message |
| `trace_id`, `span_id`, `trace_flags` | stamped by `instrumentation-pino` on lines logged inside a span — identical field names to spans, so trace queries never change |
| `event` | present only on domain events; value is the event name |
| *(rest)* | merge-object keys, post-redaction |

### Span lines (`<service>.spans.jsonl`)

| Field | Notes |
| --- | --- |
| `time` | span start, ISO-8601 UTC |
| `name` | span name (route, query, custom `withSpan` name) |
| `service` | exporter's service |
| `trace_id`, `span_id`, `parent_span_id` | W3C ids, lowercase hex |
| `kind` | `internal` \| `server` \| `client` \| `producer` \| `consumer` |
| `status` | `unset` \| `ok` \| `error` |
| `status_message` | error tag from `withSpan`, when status is `error` |
| `duration_ms` | float milliseconds |
| `attrs` | flattened OTel attributes, post-redaction |
| `events` | span events (e.g. recorded exceptions), when present |

## Canonical queries

```bash
# grep a trace: everything that happened in one distributed trace,
# across every service and both signals, in time order
grep -h "$TRACE_ID" var/telemetry/*.jsonl | jq -s 'sort_by(.time)'

# errors: recent error/fatal log lines with context
jq -c 'select(.level >= 50)' var/telemetry/api.jsonl | tail -20

# error spans with their status message
jq -c 'select(.status == "error")' var/telemetry/api.spans.jsonl | tail -20

# span p95s: where the time goes, in SQL, zero ETL
duckdb -c "SELECT name, count(*) AS n, round(quantile_cont(duration_ms, 0.95), 1) AS p95_ms
           FROM read_ndjson('var/telemetry/*.spans.jsonl')
           GROUP BY name ORDER BY p95_ms DESC LIMIT 20"

# domain event counts
duckdb -c "SELECT event, count(*) AS n
           FROM read_ndjson('var/telemetry/*.jsonl', ignore_errors=true)
           WHERE event IS NOT NULL GROUP BY event ORDER BY n DESC"
```

## Redaction

One shared module (`src/redact.ts`) feeds **both** sinks — the logger factory
and the span exporter — plus browser lines client-side and (server-side) the
ingest route. Keys matching the secret pattern (`password`, `token`, `secret`,
`api key`, `authorization`, `cookie`, `session id`, `credential`,
`private key` — substring, case-insensitive) are replaced with `[REDACTED]`
at any depth. `pg` runs with `enhancedDatabaseReporting` off permanently and
no HTTP header capture is enabled, so parameter and header values never enter
spans in the first place.
