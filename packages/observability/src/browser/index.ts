/**
 * Browser facade entry (ADR 0005 §6): same verbs as the Node entry —
 * `initObservability`, `createLogger`, `withSpan`, `emitEvent` — implemented
 * lightly. Lines buffer in memory and flush to the api's dev-only
 * `POST /telemetry` route, which redacts server-side (this buffer is
 * untrusted input) and appends to `var/telemetry/<service>.jsonl` /
 * `<service>.spans.jsonl`. Client-side redaction here is defense in depth.
 *
 * Wire contract: `POST <endpoint>` with JSON `{ service, lines }`; each line
 * carries a `signal` discriminator (`"log"` or `"span"`) the server uses to
 * route to the per-signal file, then strips.
 *
 * Spans are hand-rolled (the OTel Web SDK is rejected — bundle weight,
 * page-load focus): ids are W3C-format random hex, and `currentTraceparent()`
 * exposes the active span's `traceparent` for fetch headers and the
 * match-transport envelope, so one trace spans tick → transport → render.
 * Parent tracking uses a module-level current-span slot restored when a span
 * settles — accurate for sequential `await`ed code, best-effort under
 * concurrently running spans.
 */
import { ResultAsync } from "neverthrow";

import { describeError } from "../error-description.ts";
import { redactDeep } from "../redact.ts";

const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

type LevelName = keyof typeof LEVELS;

const CONSOLE_METHODS: Record<LevelName, "debug" | "info" | "warn" | "error"> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
};

type WireLine = Record<string, unknown> & { signal: "log" | "span"; time: string };

export interface BrowserObservabilityOptions {
  /**
   * Master switch — the webapp passes its dev flag. The ingest route is
   * dev-only, so a production page must not buffer or POST telemetry.
   * Default: true. Independently, the client disables itself when the route
   * answers 404 (route absent — not a dev api).
   */
  enabled?: boolean;
  /** Ingest route on the api. Default: `/telemetry`. */
  endpoint?: string;
  /** Default: 2000. */
  flushIntervalMs?: number;
  /** Oldest lines are dropped beyond this. Default: 1000. */
  maxBufferedLines?: number;
  /** Mirror log lines to the console. Default: true on localhost. */
  consoleMirror?: boolean;
  /** Test seam. Default: global `fetch`. */
  fetchFn?: typeof fetch;
}

export interface BrowserObservabilityHandle {
  flush: () => Promise<void>;
  shutdown: () => Promise<void>;
}

interface BrowserState {
  service: string;
  endpoint: string;
  maxBufferedLines: number;
  consoleMirror: boolean;
  fetchFn: typeof fetch;
}

interface ActiveSpan {
  trace_id: string;
  span_id: string;
}

const DEFAULT_MAX_BUFFERED_LINES = 1000;

let buffer: WireLine[] = [];
let state: BrowserState | undefined;
let flushTimer: ReturnType<typeof setInterval> | undefined;
let currentSpan: ActiveSpan | undefined;
let flushing = false;
let disabled = false;

export function initObservability(
  service: string,
  options: BrowserObservabilityOptions = {},
): BrowserObservabilityHandle {
  disabled = options.enabled === false;
  state = {
    service,
    endpoint: options.endpoint ?? "/telemetry",
    maxBufferedLines: options.maxBufferedLines ?? DEFAULT_MAX_BUFFERED_LINES,
    consoleMirror: options.consoleMirror ?? isLocalhost(),
    fetchFn: options.fetchFn ?? ((...args) => fetch(...args)),
  };
  if (flushTimer !== undefined) {
    clearInterval(flushTimer);
    flushTimer = undefined;
  }
  if (!disabled) {
    flushTimer = setInterval(() => {
      void flush();
    }, options.flushIntervalMs ?? 2000);
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", flushWithBeacon);
    }
  }
  return { flush, shutdown };
}

export interface BrowserLogger {
  trace: LogMethod;
  debug: LogMethod;
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  fatal: LogMethod;
}

type LogMethod = (attrsOrMsg: string | Record<string, unknown>, msg?: string) => void;

/**
 * Same calling convention as pino: `logger.info("msg")` or
 * `logger.info({ attrs }, "msg")`. `scope` bins lines the way a pino child
 * binding would (there is one service per page, so no `service` argument).
 */
export function createLogger(scope?: string): BrowserLogger {
  const method = (level: LevelName): LogMethod => (attrsOrMsg, msg) => {
    const attrs = typeof attrsOrMsg === "string" ? {} : attrsOrMsg;
    const message = typeof attrsOrMsg === "string" ? attrsOrMsg : msg ?? "";
    if (state?.consoleMirror ?? isLocalhost()) {
      // eslint-disable-next-line no-console -- console mirroring in dev is the feature (ADR 0005 §6)
      console[CONSOLE_METHODS[level]](`[${scope ?? "webapp"}] ${message}`, attrs);
    }
    push({
      signal: "log",
      time: new Date().toISOString(),
      level: LEVELS[level],
      scope,
      msg: message,
      trace_id: currentSpan?.trace_id,
      span_id: currentSpan?.span_id,
      ...attrs,
    });
  };
  return {
    trace: method("trace"),
    debug: method("debug"),
    info: method("info"),
    warn: method("warn"),
    error: method("error"),
    fatal: method("fatal"),
  };
}

/** Domain events, same semantics as the Node `emitEvent` (ADR 0005 §3). */
export function emitEvent(name: string, attrs: Record<string, unknown> = {}): void {
  push({
    signal: "log",
    time: new Date().toISOString(),
    level: LEVELS.info,
    event: name,
    msg: name,
    trace_id: currentSpan?.trace_id,
    span_id: currentSpan?.span_id,
    ...attrs,
  });
}

export interface BrowserSpan {
  trace_id: string;
  span_id: string;
  traceparent: string;
  setAttribute: (key: string, value: unknown) => void;
}

/** Neverthrow-aware, same semantics as the Node `withSpan`. */
export function withSpan<T, E>(
  name: string,
  fn: (span: BrowserSpan) => ResultAsync<T, E>,
  attributes?: Record<string, unknown>,
): ResultAsync<T, E> {
  const parent = currentSpan;
  const traceId = parent?.trace_id ?? randomHex(16);
  const spanId = randomHex(8);
  const attrs: Record<string, unknown> = { ...attributes };
  const span: BrowserSpan = {
    trace_id: traceId,
    span_id: spanId,
    traceparent: `00-${traceId}-${spanId}-01`,
    setAttribute: (key, value) => {
      attrs[key] = value;
    },
  };
  const startedMs = Date.now();
  let status: "ok" | "error" = "ok";
  let statusMessage: string | undefined;
  currentSpan = { trace_id: traceId, span_id: spanId };
  const finish = (): void => {
    currentSpan = parent;
    push({
      signal: "span",
      time: new Date(startedMs).toISOString(),
      name,
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parent?.span_id,
      status,
      status_message: statusMessage,
      duration_ms: Date.now() - startedMs,
      attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
    });
  };
  return new ResultAsync(
    (async () => {
      try {
        const result = await fn(span);
        if (result.isErr()) {
          status = "error";
          statusMessage = describeError(result.error);
        }
        return result;
      } catch (defect) {
        status = "error";
        statusMessage = defect instanceof Error ? `${defect.name}: ${defect.message}` : "defect";
        throw defect;
      } finally {
        finish();
      }
    })(),
  );
}

/**
 * The active span's W3C `traceparent` header value, for stamping onto fetch
 * calls and the match-transport message envelope (ADR 0005 §6). Undefined
 * outside any span.
 */
export function currentTraceparent(): string | undefined {
  return currentSpan === undefined
    ? undefined
    : `00-${currentSpan.trace_id}-${currentSpan.span_id}-01`;
}

async function flush(): Promise<void> {
  if (disabled || state === undefined || buffer.length === 0 || flushing) {
    return;
  }
  flushing = true;
  const lines = buffer;
  buffer = [];
  try {
    const response = await state.fetchFn(state.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: state.service, lines }),
      keepalive: true,
    });
    if (response.status === 404) {
      // Route absent: this is not a dev api. Stop for good — no retry loop,
      // no growing buffer on a production page.
      disable();
    } else if (!response.ok) {
      requeue(lines);
    }
  } catch {
    requeue(lines);
  } finally {
    flushing = false;
  }
}

function disable(): void {
  disabled = true;
  buffer = [];
  if (flushTimer !== undefined) {
    clearInterval(flushTimer);
    flushTimer = undefined;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("pagehide", flushWithBeacon);
  }
}

async function shutdown(): Promise<void> {
  if (flushTimer !== undefined) {
    clearInterval(flushTimer);
    flushTimer = undefined;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("pagehide", flushWithBeacon);
  }
  await flush();
  state = undefined;
}

function flushWithBeacon(): void {
  if (state === undefined || buffer.length === 0) {
    return;
  }
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const lines = buffer;
    buffer = [];
    const payload = JSON.stringify({ service: state.service, lines });
    navigator.sendBeacon(state.endpoint, new Blob([payload], { type: "application/json" }));
    return;
  }
  void flush();
}

function push(line: WireLine): void {
  if (disabled) {
    return;
  }
  buffer.push(redactDeep(line));
  trim();
}

function requeue(lines: WireLine[]): void {
  buffer = [...lines, ...buffer];
  trim();
}

function trim(): void {
  const max = state?.maxBufferedLines ?? DEFAULT_MAX_BUFFERED_LINES;
  if (buffer.length > max) {
    buffer.splice(0, buffer.length - max);
  }
}

function isLocalhost(): boolean {
  return typeof location !== "undefined"
    && (location.hostname === "localhost" || location.hostname === "127.0.0.1");
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Test seam only — not part of the facade surface. */
export function resetBrowserObservabilityForTests(): void {
  if (flushTimer !== undefined) {
    clearInterval(flushTimer);
    flushTimer = undefined;
  }
  buffer = [];
  state = undefined;
  currentSpan = undefined;
  flushing = false;
  disabled = false;
}
