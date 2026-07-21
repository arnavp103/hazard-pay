import { z } from "zod";

/**
 * The versioned lane-event payload envelope (ADR 0003 §4): payloads carry
 * AI-SDK-shaped content inside a small envelope of ours — never provider-raw
 * JSON. `v` is the envelope version; readers refuse unknown versions loudly
 * rather than guessing.
 *
 * The `compaction` payload is a RESERVED seam: the schema exists so the log
 * can later record summarizations that folds start from, but the runtime
 * never emits it and folds refuse it today (`CompactionReserved`).
 */
export const ENVELOPE_VERSION = 1;

export type JsonValue
  = | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]));

/**
 * An input lane event: appended by anything other than the lane's own loop —
 * tick results, player messages, other lanes' `send_message` calls
 * (CONTEXT.md: Input). The appender is recorded in the row's `author`
 * column, not the payload.
 */
export const inputPayloadSchema = z.object({
  v: z.literal(ENVELOPE_VERSION),
  kind: z.literal("input"),
  content: z.string(),
  /** Optional structured payload riding along with the prose content. */
  data: jsonValueSchema.optional(),
});

/** AI-SDK-shaped content parts of one recorded model call. */
export const modelTurnPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  /**
   * Reasoning is recorded for spectating/tracing but deliberately not folded
   * back into the next request's messages.
   */
  z.object({ type: z.literal("reasoning"), text: z.string() }),
  z.object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    input: jsonValueSchema,
  }),
]);

/**
 * One `model_turn` event per model call (ADR 0003 §4): request fingerprint
 * plus the full response; there is no request-side event — the request is
 * reproducible from the fold, which is what the fingerprint verifies.
 */
export const modelTurnPayloadSchema = z.object({
  v: z.literal(ENVELOPE_VERSION),
  kind: z.literal("model_turn"),
  /** sha-256 over the canonical JSON of what the model was asked. */
  fingerprint: z.string(),
  model: z.object({ provider: z.string(), modelId: z.string() }),
  content: z.array(modelTurnPartSchema),
  finishReason: z.string(),
  usage: z.object({
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    totalTokens: z.number().optional(),
  }),
});

/**
 * The recorded outcome of one tool call. For mutating tools this event
 * commits in the same transaction as the game write (ADR 0003 §2) —
 * exactly-once structurally: the write exists iff this event exists.
 */
export const toolResultPayloadSchema = z.object({
  v: z.literal(ENVELOPE_VERSION),
  kind: z.literal("tool_result"),
  toolCallId: z.string(),
  toolName: z.string(),
  output: jsonValueSchema,
  isError: z.boolean(),
});

/** RESERVED (ADR 0003 §4) — never emitted by the runtime today. */
export const compactionPayloadSchema = z.object({
  v: z.literal(ENVELOPE_VERSION),
  kind: z.literal("compaction"),
  summary: z.string(),
});

export const laneEventPayloadSchema = z.discriminatedUnion("kind", [
  inputPayloadSchema,
  modelTurnPayloadSchema,
  toolResultPayloadSchema,
  compactionPayloadSchema,
]);

export type InputPayload = z.infer<typeof inputPayloadSchema>;
export type ModelTurnPart = z.infer<typeof modelTurnPartSchema>;
export type ModelTurnPayload = z.infer<typeof modelTurnPayloadSchema>;
export type ToolResultPayload = z.infer<typeof toolResultPayloadSchema>;
export type CompactionPayload = z.infer<typeof compactionPayloadSchema>;
export type LaneEventPayload = z.infer<typeof laneEventPayloadSchema>;
