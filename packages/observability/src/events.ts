import { trace } from "@opentelemetry/api";

import { createLogger } from "./logger.ts";
import { redactDeep } from "./redact.ts";
import { getRootLogger } from "./state.ts";

export type DomainEventAttributes = Record<string, unknown>;

export interface DomainEventRecord {
  event: string;
  trace_id?: string;
  span_id?: string;
  attrs: DomainEventAttributes;
}

export type DomainEventSubscriber = (record: DomainEventRecord) => void;

/**
 * Emit a domain event: a past-tense fact about the game domain (ADR 0005 §3),
 * e.g. `emitEvent("match.completed", { matchId })`. Distinct from execution
 * logs; today it becomes a structured line in `<service>.jsonl` with an
 * `event` field and trace ids stamped, later the subscription point for a
 * product-analytics sink — call sites never migrate.
 */
export function emitEvent(name: string, attrs: DomainEventAttributes = {}): void {
  const spanContext = trace.getActiveSpan()?.spanContext();
  const record: DomainEventRecord = {
    event: name,
    trace_id: spanContext?.traceId,
    span_id: spanContext?.spanId,
    attrs: redactDeep(attrs),
  };
  for (const subscriber of subscribers) {
    subscriber(record);
  }
}

/**
 * The product-analytics seam (#8 / ADR 0005 §3): emission is decoupled from
 * the log destination. The default subscriber writes JSONL through the root
 * logger; a PostHog-style sink subscribes here later, inside this package —
 * this is deliberately not part of the facade surface.
 */
export function subscribeToDomainEvents(subscriber: DomainEventSubscriber): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

function jsonlSubscriber(record: DomainEventRecord): void {
  // Emitting before any createLogger call is a boot-order bug; surface it in
  // unknown.jsonl rather than dropping the domain fact or throwing.
  const logger = getRootLogger() ?? createLogger("unknown");
  logger.info(
    {
      ...record.attrs,
      event: record.event,
      trace_id: record.trace_id,
      span_id: record.span_id,
    },
    record.event,
  );
}

const subscribers = new Set<DomainEventSubscriber>([jsonlSubscriber]);
