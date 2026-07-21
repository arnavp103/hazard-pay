import { createScorer, evalite } from "evalite";
import { toolCallAccuracy } from "evalite/scorers/deterministic";

import { createHelloLeader } from "./hello-leader.ts";
import { runSession } from "./testing/session-harness.ts";
import { scriptedModel, textTurn, toolCallTurn } from "./testing/mock-model.ts";
import type { SessionResult } from "./testing/session-harness.ts";

/**
 * Mock-model evals for the hello leader (issue #25): proves the session
 * harness surfaces correct log shapes, tool usage, and obligation discharge
 * for scripted sessions — the "one hello eval proving the harness runs in
 * CI" from #25's issue body. `scriptedModel` canned turns are the whole
 * input, no API key anywhere near this file, so it is the suite `pnpm eval`
 * always runs.
 *
 * Scorers are deliberately structural, not semantic: the log's event-type
 * sequence, which tools ran in what order, and whether every wake finished
 * quiescent with no obligations left open. Only `evalite/scorers/deterministic`
 * is imported here — never the LLM-judge scorers in `evalite/scorers` — so
 * "no judge in the mock suite" is enforced by the import path, not just
 * convention. Semantic/LLM-judge scoring is the promptfoo/adversarial-eval
 * follow-up flagged in #5's resolution, not this file.
 */

// `unknown` for TInput/TExpected slots this file's two data shapes (a single
// string input and a two-turn string[] input) don't both need — a scorer
// reused across `evalite()` calls must accept the widest shape it's handed.
const eventTypesMatch = createScorer<unknown, SessionResult, string[]>({
  name: "log shape",
  description: "the lane_event type sequence matches exactly",
  scorer: ({ output, expected }) => {
    if (expected === undefined) {
      return 0;
    }
    const actual = output.events.map((row) => row.type);
    const matches = actual.length === expected.length
      && actual.every((type, index) => type === expected[index]);
    return matches ? 1 : 0;
  },
});

const obligationsDischarged = createScorer<unknown, SessionResult, unknown>({
  name: "obligation discharge",
  description: "every wake ended quiescent with no open obligations left",
  scorer: ({ output }) => {
    const allQuiescent = output.wakeReports.every((report) => report.quiescent);
    const noOpenObligations = output.snapshot.openObligations.length === 0;
    return allQuiescent && noOpenObligations ? 1 : 0;
  },
});

evalite("hello leader (mock): status report", {
  data: () => [
    {
      input: "status report please",
      expected: ["input", "model_turn", "tool_result", "model_turn", "tool_result", "model_turn"],
    },
  ],
  task: async (input) => {
    const model = scriptedModel([
      toolCallTurn([{ toolCallId: "c1", toolName: "read_tick_count", input: {} }]),
      toolCallTurn([{ toolCallId: "c2", toolName: "record_tick", input: {} }]),
      textTurn("All quiet: 0 ticks so far, visit recorded."),
    ]);
    return runSession({
      leader: createHelloLeader(),
      model,
      turns: [{ author: "eval", content: input }],
    });
  },
  scorers: [
    eventTypesMatch,
    obligationsDischarged,
    {
      name: "tool usage",
      scorer: ({ output }) =>
        toolCallAccuracy({
          actualCalls: output.toolCalls.map((call) => ({ toolName: call.toolName, input: call.input })),
          expectedCalls: [{ toolName: "read_tick_count" }, { toolName: "record_tick" }],
          mode: "exact",
        }),
    },
  ],
});

evalite("hello leader (mock): two-turn session", {
  data: () => [
    {
      input: ["status report please", "thanks!"],
      expected: [
        "input",
        "model_turn",
        "tool_result",
        "model_turn",
        "tool_result",
        "model_turn",
        "input",
        "model_turn",
      ],
    },
  ],
  task: async (input) => {
    const model = scriptedModel([
      toolCallTurn([{ toolCallId: "c1", toolName: "read_tick_count", input: {} }]),
      toolCallTurn([{ toolCallId: "c2", toolName: "record_tick", input: {} }]),
      textTurn("All quiet: 0 ticks so far, visit recorded."),
      textTurn("Anytime!"),
    ]);
    return runSession({
      leader: createHelloLeader(),
      model,
      turns: input.map((content) => ({ author: "eval", content })),
    });
  },
  scorers: [eventTypesMatch, obligationsDischarged],
});
