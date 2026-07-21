import { generateText, stepCountIs, tool } from "ai";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { AgentError } from "./errors.ts";
import type { JsonValue, ModelTurnPart } from "./envelope.ts";
import type { DefinedLeader } from "./leader.ts";
import type { LanguageModel, ModelMessage, ToolSet } from "ai";

/**
 * The AI SDK is the model layer only (ADR 0003 §1): one `generateText` call
 * per model turn, single-step (`stopWhen: stepCountIs(1)`), with every tool
 * declared execute-less — the SDK returns tool calls, our loop records and
 * discharges them. The loop boundary stays in this runtime.
 */

export const spawnLaneInputSchema = z.object({
  leader: z.string().describe("Name of the leader config to run the mission under."),
  input: z.string().describe("The mission briefing, appended as the new lane's first input."),
});

export const sendMessageInputSchema = z.object({
  laneId: z.string().describe("The id of the lane to message."),
  content: z.string().describe("The message, appended to the target lane as an input."),
});

export const cancelLaneInputSchema = z.object({
  laneId: z.string().describe("The id of the mission lane to close."),
});

/**
 * Harness-owned lane tools (ADR 0003 §4): spawn-and-report — `spawn_lane`
 * returns a receipt immediately, lanes are never awaited; parent and child
 * exchange `send_message` inputs without either closing; `cancel_lane`
 * closes a mission. Available to every leader; versioned by the envelope,
 * not the leader's config hash.
 */
function builtinLaneTools(): ToolSet {
  return {
    spawn_lane: tool({
      description:
        "Spawn a mission lane for a bounded goal. Returns a receipt with the new "
        + "lane id immediately; the mission reports back via send_message.",
      inputSchema: spawnLaneInputSchema,
    }),
    send_message: tool({
      description: "Send a message to another lane (e.g. report back to your parent lane).",
      inputSchema: sendMessageInputSchema,
    }),
    cancel_lane: tool({
      description: "Close a mission lane that is no longer needed.",
      inputSchema: cancelLaneInputSchema,
    }),
  };
}

export function buildToolSet(leader: DefinedLeader): ToolSet {
  const tools: ToolSet = { ...builtinLaneTools() };
  for (const [name, definition] of Object.entries(leader.tools)) {
    tools[name] = tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
    });
  }
  return tools;
}

export function modelIdentity(model: LanguageModel): { provider: string; modelId: string } {
  if (typeof model === "string") {
    return { provider: "gateway", modelId: model };
  }
  return { provider: model.provider, modelId: model.modelId };
}

export interface ModelTurnResult {
  parts: ModelTurnPart[];
  toolCalls: { toolCallId: string; toolName: string; input: JsonValue }[];
  finishReason: string;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export function callModel(args: {
  model: LanguageModel;
  leader: DefinedLeader;
  messages: ModelMessage[];
  laneId: string;
  maxRetries?: number;
}): ResultAsync<ModelTurnResult, AgentError> {
  return ResultAsync.fromPromise(
    generateText({
      model: args.model,
      system: args.leader.system,
      messages: args.messages,
      tools: buildToolSet(args.leader),
      stopWhen: stepCountIs(1),
      // The SDK's built-in retry backs off exponentially — this is the 429
      // budget for rate-limited providers (free-tier Gemini).
      maxRetries: args.maxRetries,
    }),
    (cause): AgentError => ({ tag: "ModelCallFailed", laneId: args.laneId, cause }),
  ).map((result) => {
    const parts: ModelTurnPart[] = [];
    const toolCalls: ModelTurnResult["toolCalls"] = [];
    for (const part of result.content) {
      if (part.type === "text") {
        parts.push({ type: "text", text: part.text });
      } else if (part.type === "reasoning") {
        parts.push({ type: "reasoning", text: part.text });
      } else if (part.type === "tool-call") {
        const input = part.input as JsonValue;
        parts.push({
          type: "tool-call",
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input,
        });
        toolCalls.push({ toolCallId: part.toolCallId, toolName: part.toolName, input });
      }
      // Other part kinds (sources, files) have no place in the envelope yet;
      // adding one is an envelope version bump.
    }
    return {
      parts,
      toolCalls,
      finishReason: result.finishReason,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      },
    };
  });
}
