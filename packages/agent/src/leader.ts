import type { Db } from "@hazard-pay/db";
import type { Logger } from "@hazard-pay/observability";
import type { ResultAsync } from "neverthrow";
import { z } from "zod";

import { contentHash } from "./hash.ts";
import type { JsonValue } from "./envelope.ts";

/** The transaction handle Drizzle passes to `db.transaction` callbacks. */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * What a tool's `execute` sees: the open transaction (the game write and the
 * `tool_result` lane event commit together — ADR 0003 §2), the calling lane,
 * and a scoped logger. Tools invoke domain functions in-process; they never
 * see the model, the queue, or `process.env`.
 */
export interface ToolExecutionCtx {
  tx: DbTx;
  laneId: string;
  logger: Logger;
}

/** A recoverable tool failure, recorded as an `isError` tool result. */
export interface ToolError {
  tag: string;
  detail?: JsonValue;
}

/**
 * A leader tool with its input type erased for registry storage: the runtime
 * always validates `inputSchema` before calling `execute`, so the `never`
 * parameter (sound under contravariance) lets concretely-typed tools live in
 * one `Record`. Write tools against your zod schema's output type; the
 * runtime passes exactly what the schema parsed.
 */
export interface LeaderTool {
  description: string;
  inputSchema: z.ZodType;
  /**
   * Runs inside the tool transaction. An `err()` rolls the transaction's
   * writes back (savepoint) but still records the failure as an `isError`
   * tool result; a throw is a defect and aborts the whole tool transaction,
   * leaving the obligation open for recovery.
   */
  execute: (ctx: ToolExecutionCtx, input: never) => ResultAsync<JsonValue, ToolError>;
}

/** Tool names owned by the harness itself — leaders cannot redefine them. */
export const RESERVED_TOOL_NAMES = ["spawn_lane", "send_message", "cancel_lane"] as const;

const leaderShapeSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_-]*$/),
  system: z.string().min(1),
  maxTurnsPerWake: z.number().int().min(1).max(32),
});

export interface LeaderDefinitionInput extends z.infer<typeof leaderShapeSchema> {
  tools: Record<string, LeaderTool>;
}

export interface DefinedLeader extends LeaderDefinitionInput {
  /** Content hash of `config`; lanes stamp it (ADR 0003 §3). */
  configHash: string;
  /** The hashable data projection, stored once in `leader_config`. */
  config: JsonValue;
}

/**
 * Validates a declarative leader config and stamps its content hash
 * (ADR 0003 §3: leaders are game code, config is data, git is the source of
 * truth). The hash covers the data projection — name, system prompt, wake
 * policy, and each tool's name, description, and JSON-schema'd input — so
 * any change to what the model can see or do changes the hash. Harness
 * built-ins (`spawn_lane`, `send_message`, `cancel_lane`) are versioned by
 * the envelope, not the config hash.
 *
 * Invalid definitions throw: leader configs are code reviewed in git, so a
 * bad one is a defect caught at module load, not a runtime condition.
 */
export function defineLeader(input: LeaderDefinitionInput): DefinedLeader {
  const shape = leaderShapeSchema.parse(input);
  for (const toolName of Object.keys(input.tools)) {
    if ((RESERVED_TOOL_NAMES as readonly string[]).includes(toolName)) {
      throw new Error(`leader "${shape.name}" redefines harness tool "${toolName}"`);
    }
  }
  const config: JsonValue = {
    v: 1,
    name: shape.name,
    system: shape.system,
    maxTurnsPerWake: shape.maxTurnsPerWake,
    tools: Object.fromEntries(
      Object.entries(input.tools)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([toolName, tool]) => [
          toolName,
          {
            description: tool.description,
            inputSchema: z.toJSONSchema(tool.inputSchema) as JsonValue,
          },
        ]),
    ),
  };
  return { ...shape, tools: input.tools, config, configHash: contentHash(config) };
}
