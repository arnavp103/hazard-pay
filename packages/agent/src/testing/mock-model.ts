import { MockLanguageModelV4 } from "ai/test";

import type { JsonValue } from "../envelope.ts";

/**
 * Scripted mock model (the AI SDK's V4 test double): each entry is the
 * result of one `doGenerate` call, in order. CI runs the whole spine on
 * these — no API key anywhere near the tests (ADR 0003 consequences).
 */

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

export function textTurn(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage,
    warnings: [],
  };
}

export function toolCallTurn(
  calls: { toolCallId: string; toolName: string; input: JsonValue }[],
) {
  return {
    content: calls.map((call) => ({
      type: "tool-call" as const,
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: JSON.stringify(call.input),
    })),
    finishReason: { unified: "tool-calls" as const, raw: "tool-calls" },
    usage,
    warnings: [],
  };
}

type ScriptedResult = ReturnType<typeof textTurn> | ReturnType<typeof toolCallTurn>;

export function scriptedModel(script: ScriptedResult[]): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId: "mock-model",
    doGenerate: script,
  });
}
