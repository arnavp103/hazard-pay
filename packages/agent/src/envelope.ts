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
 * One `model_turn` lane event per model call (ADR 0003 §4): request
 * fingerprint plus the full response; there is no request-side lane event —
 * the request is reproducible from the fold, which the fingerprint verifies.
 */
export const modelTurnPayloadSchema = z.object({
  v: z.literal(ENVELOPE_VERSION),
  kind: z.literal("model_turn"),
  /** sha-256 over the canonical JSON of what the model was asked. */
  fingerprint: z.string(),
  /**
   * The leader config hash the fingerprint was computed under. Optional
   * (added with issue #52's foreground-lane restamp): a long-lived lane can
   * outlive config edits, so each turn names its own config; turns recorded
   * before this field existed verify against the lane's stamped hash.
   */
  configHash: z.string().optional(),
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
 * The recorded outcome of one tool call. For mutating tools this lane event
 * commits in the same transaction as the game write (ADR 0003 §2) —
 * exactly-once structurally: the write exists iff this lane event exists.
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

/**
 * Typed receipts for the harness's built-in tools (ADR 0003 §4: built-ins
 * are versioned by the envelope, not the config hash). The wire schema
 * above keeps `tool_result.output` opaque — custom leader tools return
 * open JSON — while these name the subset the runtime itself emits. The
 * runtime constructs receipts against these types (`satisfies`), so a
 * drifted shape is a compile error there, not a mis-linked trace here.
 */
export const RESERVED_TOOL_NAMES = ["spawn_lane", "send_message", "cancel_lane"] as const;

export type BuiltinToolName = (typeof RESERVED_TOOL_NAMES)[number];

export const spawnLaneReceiptSchema = z.object({
  spawned: z.literal(true),
  laneId: z.string(),
});

export const sendMessageReceiptSchema = z.object({
  delivered: z.literal(true),
  laneId: z.string(),
});

export const cancelLaneReceiptSchema = z.object({
  closed: z.literal(true),
  laneId: z.string(),
});

/** A recoverable tool failure as recorded in an `isError` tool result. */
export const toolErrorOutputSchema = z.object({
  tag: z.string(),
  detail: jsonValueSchema.optional(),
});

export type SpawnLaneReceipt = z.infer<typeof spawnLaneReceiptSchema>;
export type SendMessageReceipt = z.infer<typeof sendMessageReceiptSchema>;
export type CancelLaneReceipt = z.infer<typeof cancelLaneReceiptSchema>;
export type ToolErrorOutput = z.infer<typeof toolErrorOutputSchema>;

/** What a built-in receipt names: the tool and the lane it acted on. */
export interface BuiltinToolReceipt {
  tool: BuiltinToolName;
  laneId: string;
}

const receiptSchemaFor: Record<BuiltinToolName, z.ZodType<{ laneId: string }>> = {
  spawn_lane: spawnLaneReceiptSchema,
  send_message: sendMessageReceiptSchema,
  cancel_lane: cancelLaneReceiptSchema,
};

/**
 * Narrows a lane-event payload to a built-in tool receipt, or null. The
 * one defined source for lane cross-links in trace views — a custom tool's
 * output never links, whatever fields it happens to carry.
 */
export function builtinToolReceipt(payload: LaneEventPayload): BuiltinToolReceipt | null {
  if (payload.kind !== "tool_result" || payload.isError) {
    return null;
  }
  const tool = RESERVED_TOOL_NAMES.find((name) => name === payload.toolName);
  if (tool === undefined) {
    return null;
  }
  const parsed = receiptSchemaFor[tool].safeParse(payload.output);
  return parsed.success ? { tool, laneId: parsed.data.laneId } : null;
}
