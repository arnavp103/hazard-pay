# Agent-readable observability

Research notes for a future `packages/observability`. Question: what is the
lightest observability stack whose output a coding agent (Claude-Code-style)
can query directly — no human dashboard — across the api, webapp, and agent
processes?

Compared axes: OpenTelemetry Node SDK vs hand-rolled structured JSON logging
(pino); tail collectors (otel-collector, vector) vs none; distributed trace
correlation; and storage an agent can grep or SQL (JSONL files vs Postgres).

Date: 2026-07-19. Sources are primary (official docs, specs, GitHub READMEs,
npm registry) and linked per claim.

---

## Key facts that shape every option

- **OTel JS has no file exporter.** The official exporter list offers console
  (stdout, debug-only) and OTLP over HTTP/protobuf/gRPC — nothing that writes
  JSON to disk ([exporters doc](https://opentelemetry.io/docs/languages/js/exporters/)),
  and the OTLP spec defines only gRPC/HTTP transports
  ([OTLP spec](https://opentelemetry.io/docs/specs/otlp/)). Getting OTel spans
  into a greppable file means either a ~15-line custom `SpanExporter` or a
  collector with a `fileexporter`.
- **OTel JS logs are experimental.** `@opentelemetry/sdk-logs` and `api-logs`
  live under `experimental/` in the monorepo and warn of breaking changes
  ([sdk-logs](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/sdk-logs),
  [api-logs on npm](https://www.npmjs.com/package/@opentelemetry/api-logs));
  the official Node getting-started guide skips logging entirely because "the
  logging library ... is still under development"
  ([guide](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)).
  Even `@opentelemetry/sdk-node` itself is labeled "experimental package under
  active development"
  ([README](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-sdk-node/README.md)).
  Tracing is the stable signal.
- **Dependency weight is lopsided.** Measured against the npm registry
  (2026-07): `pino` 10.3.1 has 11 direct deps, ~14 installed packages, 2.2 MB;
  `@opentelemetry/sdk-node` 0.220.0 has 27 direct deps, ~34 packages / 48 MB,
  growing to ~82 packages / 75 MB with `auto-instrumentations-node`
  ([pino](https://www.npmjs.com/package/pino),
  [sdk-node](https://www.npmjs.com/package/@opentelemetry/sdk-node)).
- **pino is JSONL by default.** One JSON object per line, child loggers bind
  fields onto every line, `pino/file` transport writes to a path from a worker
  thread ([README](https://github.com/pinojs/pino/blob/master/README.md),
  [transports](https://github.com/pinojs/pino/blob/master/docs/transports.md),
  [child loggers](https://github.com/pinojs/pino/blob/master/docs/child-loggers.md)).
- **Trace correlation is just three fields.** W3C `traceparent` is
  `00-{32 hex trace-id}-{16 hex span-id}-{2 hex flags}`
  ([W3C Trace Context](https://www.w3.org/TR/trace-context/)). OTel propagates
  it automatically over HTTP
  ([propagation](https://opentelemetry.io/docs/concepts/context-propagation/),
  [instrumentation-http](https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-instrumentation-http/README.md));
  `@opentelemetry/instrumentation-pino` injects `trace_id`, `span_id`,
  `trace_flags` into every pino line logged inside a span
  ([README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-pino)).
  A hand-rolled setup can carry the same header format itself and stay
  wire-compatible with OTel later.
- **JSONL is SQL-able without ETL.** DuckDB's `read_json_auto()` /
  `read_ndjson()` query newline-delimited JSON files (including globs) directly
  with schema auto-detection
  ([DuckDB JSON loading](https://duckdb.org/docs/lts/data/json/loading_json)).
- **Postgres jsonb is agent-friendly but has no OTLP inlet.** `->>`, `@>`, `?`
  operators plus GIN indexes (`jsonb_ops` / smaller-faster `jsonb_path_ops`)
  make jsonb rows cheap to filter
  ([GIN](https://www.postgresql.org/docs/current/gin.html),
  [JSON functions](https://www.postgresql.org/docs/current/functions-json.html)).
  But there is no maintained OTLP→Postgres exporter — collector-contrib has a
  `postgresqlreceiver` (scrapes Postgres stats, the inverse direction) and the
  de facto SQL sink for OTel is the ClickHouse exporter (alpha)
  ([clickhouseexporter README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/exporter/clickhouseexporter/README.md)).
  Writing spans to Postgres means writing the inserter ourselves.

## Prior art on agent-queryable telemetry

The pattern that exists in the wild is almost entirely **MCP servers wrapping a
vendor query API**, not raw files:

- Sentry ships a first-party MCP server aimed explicitly at "coding agents
  like Cursor, Claude Code" ([getsentry/sentry-mcp](https://github.com/getsentry/sentry-mcp),
  [blog](https://blog.sentry.io/yes-sentry-has-an-mcp-server-and-its-pretty-good/)).
- Grafana ([mcp-grafana](https://github.com/grafana/mcp-grafana), plus
  [loki-mcp](https://github.com/grafana/loki-mcp) and
  [tempo-mcp-server](https://github.com/grafana/tempo-mcp-server)),
  Honeycomb ([honeycomb-mcp](https://github.com/honeycombio/honeycomb-mcp)),
  Axiom ([mcp.axiom.co](https://mcp.axiom.co/)), Dash0
  ([changelog](https://www.dash0.com/changelog/dash0-mcp-server)), and SigNoz
  ([signoz-mcp-server](https://github.com/SigNoz/signoz-mcp-server)) all ship
  first-party MCP servers. SigNoz's framing is the closest to this ticket's
  premise: "Agents do not use observability tools like humans do. They work
  through APIs, schemas, natural-language descriptions, and raw telemetry"
  ([blog](https://signoz.io/blog/introducing-agent-native-observability/)).
- ClickHouse's own blog argues generic SQL-over-MCP underperforms purpose-built
  investigative tools for agents
  ([blog](https://clickhouse.com/blog/observability-mcp-server-ai-notebooks));
  traceloop ships a backend-agnostic OTel-trace-query MCP server
  ([opentelemetry-mcp-server](https://github.com/traceloop/opentelemetry-mcp-server)).
- Claude Code itself emits OTel spans/metrics/logs for its own activity
  ([Agent SDK observability](https://code.claude.com/docs/en/agent-sdk/observability)).
- The clearest non-MCP precedent is simonw's `llm` CLI, which logs every
  prompt/response to SQLite (`~/.llm/logs.db`) with an FTS index, designed for
  direct SQL exploration ([logging docs](https://llm.datasette.io/en/stable/logging.html)).

**Gap:** nobody has published "emit JSONL, let the agent grep/DuckDB it" as a
deliberate telemetry pattern for coding agents. The building blocks are all
documented, but the pattern itself is unclaimed territory — which also means
no prior art constrains us, and a shell-native agent (grep/jq/SQL) needs no
MCP server at all.

---

## The stacks, ranked by setup cost

### Stack 1 — pino JSONL + hand-rolled trace context ("no OTel")

**Setup cost: lowest.** One dependency (`pino`, 2.2 MB). A shared logger
factory in `packages/observability`, `pino/file` transport writing
`var/telemetry/<service>.jsonl`, and a tiny trace-context module: generate a
W3C-format `traceparent` at each entry point, carry it via `AsyncLocalStorage`,
bind `trace_id`/`span_id` onto a child logger, forward the header on outbound
HTTP. "Spans" are just log lines with `span`, `parent_span_id`, and
`duration_ms` fields emitted by a `withSpan()` helper (~50 lines total).
Metrics are periodic counter-dump log lines. No collector, no sidecar process.

**Query ergonomics** (the agent shells in directly):

```bash
# all errors in the last run of the api
grep '"level":50' var/telemetry/api.jsonl | tail -20 | jq .

# everything that happened in one distributed trace, across all three processes
grep -h '4bf92f3577b34da6a3ce929d0e0e4736' var/telemetry/*.jsonl | jq -s 'sort_by(.time)'

# p95 duration of a span, in SQL, zero ETL (DuckDB reads the glob directly)
duckdb -c "SELECT span, quantile_cont(duration_ms, 0.95) AS p95, count(*) AS n
           FROM read_ndjson('var/telemetry/*.jsonl')
           WHERE span IS NOT NULL GROUP BY span ORDER BY p95 DESC"
```

DuckDB's ndjson readers and glob support are documented at
[duckdb.org](https://duckdb.org/docs/lts/data/json/loading_json).

**Trace correlation:** manual but trivial and wire-compatible — we mint and
propagate the exact [W3C traceparent](https://www.w3.org/TR/trace-context/)
format, so any future OTel SDK on either side of an HTTP hop interoperates
without change. Cost: only instrumented hops correlate; library-internal calls
(pg, fetch) produce no spans unless we wrap them.

### Stack 2 — pino JSONL + OTel tracing only (no collector)

**Setup cost: low-medium.** Adds `@opentelemetry/sdk-node` (+34 packages /
48 MB; ~82 / 75 MB with auto-instrumentations) and a bootstrap file loaded via
`node --import`
([getting started](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)).
Skip the experimental logs signal entirely: pino stays the log pipeline, and
`@opentelemetry/instrumentation-pino` stamps `trace_id`/`span_id`/`trace_flags`
onto every log line automatically
([README](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-pino)).
Because there is no first-party file exporter, write a ~15-line custom
`SpanExporter` that appends one flattened JSON span per line to
`var/telemetry/spans.jsonl` (flatten rather than dump raw OTLP: OTLP JSON
nests attributes as `[{key, value: {stringValue}}]` arrays
([example](https://github.com/open-telemetry/opentelemetry-proto/blob/main/examples/trace.json)),
which is hostile to grep/jq).

**Query ergonomics:** same grep/jq/DuckDB surface as Stack 1, but spans now
cover pg queries, inbound/outbound HTTP, etc. for free via
auto-instrumentation:

```bash
# reconstruct one trace: logs + spans interleaved
grep -h "$TRACE_ID" var/telemetry/*.jsonl | jq -s 'sort_by(.time // .start)'

# slowest db statements across services
duckdb -c "SELECT name, attrs->>'db.statement' AS stmt, max(duration_ms) AS worst
           FROM read_ndjson('var/telemetry/spans.jsonl')
           WHERE attrs->>'db.system' = 'postgresql' GROUP BY 1, 2 ORDER BY worst DESC LIMIT 10"
```

**Trace correlation: best-in-class and automatic.** The Node SDK defaults to
`W3CTraceContextPropagator`; `instrumentation-http` injects/extracts
`traceparent` on every hop with no manual code
([propagators spec](https://opentelemetry.io/docs/specs/otel/context/api-propagators/),
[core README](https://github.com/open-telemetry/opentelemetry-js/blob/main/packages/opentelemetry-core/README.md)).
Risk: `sdk-node` is version-churny (0.x, experimental label), and the
`--import` bootstrap constrains how each process starts.

### Stack 3 — OTel SDK → otel-collector `fileexporter` (OTLP JSONL on disk)

**Setup cost: medium.** Everything in Stack 2, plus a collector binary running
as a sidecar. The contrib `fileexporter` (alpha) writes one OTLP JSON object
per line and is the only piece here with built-in rotation
(`max_megabytes`/`max_days`/`max_backups`) and zstd compression; a companion
`otlpjsonfilereceiver` can replay the files
([fileexporter README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/exporter/fileexporter/README.md)).
Vector is the alternative tail: it has an OTLP source and a file sink with
newline-delimited JSON, but traces are "a special kind of log event" in its
data model and OTLP traces/metrics support is explicitly experimental
([OTLP source](https://vector.dev/docs/reference/configuration/sources/opentelemetry/),
[file sink](https://vector.dev/docs/reference/configuration/sinks/file/),
[data model](https://vector.dev/docs/architecture/data-model/)) — it adds a
second config language (VRL) for no gain at this scale.

**Query ergonomics: the weakest.** Raw OTLP JSON nests spans three levels deep
(`resourceSpans[].scopeSpans[].spans[]`) with attribute arrays, so the agent
needs unwrapping incantations for every query:

```bash
jq '.resourceSpans[].scopeSpans[].spans[]
    | select(.attributes[]? | select(.key=="http.route").value.stringValue=="/api/jobs")' \
  var/telemetry/otel.jsonl
```

**Trace correlation:** identical to Stack 2 (same SDK). The collector adds an
extra process to babysit in exchange for rotation and fan-out we do not need
yet. Verdict: only worth it if we later export to a vendor and to files
simultaneously.

### Stack 4 — telemetry in Postgres jsonb

**Setup cost: medium (all bespoke).** No maintained OTLP→Postgres path exists
(see key facts), so this is a hand-built pipeline regardless of the SDK
choice: a pino transport or custom span exporter that batch-INSERTs into
`telemetry.log(ts, service, level, trace_id, span_id, msg, attrs jsonb)` and
`telemetry.span(...)` with a GIN index on `attrs`.

**Query ergonomics: strongest for aggregates, worst for tailing.**

```sql
-- everything in one trace, ordered
SELECT ts, service, msg, attrs FROM telemetry.log
WHERE trace_id = '4bf92f3577b34da6a3ce929d0e0e4736' ORDER BY ts;

-- indexed containment filter (jsonb @> uses the GIN index)
SELECT count(*) FROM telemetry.span WHERE attrs @> '{"http.status_code": 500}';
```

([jsonb operators](https://www.postgresql.org/docs/current/functions-json.html),
[GIN indexing](https://www.postgresql.org/docs/current/gin.html)). The agent
already speaks SQL fluently and the project already runs Postgres, so query
power is excellent — but no grep/tail, telemetry writes now share fate with
the app database, and dev-loop debugging requires the DB to be up. simonw's
`llm` demonstrates the SQL-store pattern works well for agents, though with
SQLite and for LLM invocation logs, not service telemetry
([llm logging](https://llm.datasette.io/en/stable/logging.html)).

---

## Recommendation for `packages/observability`

**Start with Stack 1 and design its field names so Stack 2 is a drop-in
upgrade.** Concretely:

1. `packages/observability` exports a pino factory (JSONL to
   `var/telemetry/<service>.jsonl`, level from `packages/env` with a default,
   per AGENTS.md's env convention) and a trace-context module that mints and
   propagates W3C-format `traceparent` via `AsyncLocalStorage` + HTTP header.
2. Use OTel's field names now — `trace_id`, `span_id`, `trace_flags` exactly
   as `instrumentation-pino` would inject them — so log lines are
   indistinguishable from OTel-correlated ones and queries never change.
3. Provide `withSpan(name, fn)` emitting span-shaped log lines with
   `duration_ms`; that is the entire tracing API surface consumers see.
4. Document three canonical queries in the package README (grep-a-trace,
   jq-errors, DuckDB-p95) so agents discover the ergonomics instantly.
5. Adopt Stack 2 (OTel tracing + custom JSONL span exporter, logs stay on
   pino) only when hand-instrumentation stops being enough — the propagation
   format, field names, and query surface already match, so nothing downstream
   breaks. Skip collectors (Stack 3) unless a vendor export appears, and skip
   Postgres storage (Stack 4) unless retention/aggregation outgrows files —
   DuckDB over JSONL covers the SQL need until then.

Rationale: the consumer is a shell-native coding agent, and flat JSONL is the
only storage all three of its native tools (grep, jq, SQL-via-DuckDB) hit with
zero infrastructure. The heavyweight parts of OTel (experimental logs SDK,
collector, 48–75 MB of deps) buy nothing at this stage, while the cheap part
of OTel — its wire format and field names — costs nothing to adopt from day
one and keeps every future door open.
