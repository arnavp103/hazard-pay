/* eslint-disable no-console -- the loud-skip banner is this eval's user interface */
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import env from "@hazard-pay/env";
import { evalite } from "evalite";
import { contains } from "evalite/scorers/deterministic";

import { createHelloLeader } from "./hello-leader.ts";
import { runSession } from "./testing/session-harness.ts";

/**
 * ONE live eval against the real gemini-2.5-flash model (issue #25): proves
 * the harness works end-to-end with a real provider, not just the mock.
 *
 * Key-gated exactly like `scripts/live-smoke.ts`: presence of
 * `GEMINI_API_KEY` is checked via `@hazard-pay/env` (never reads or prints
 * `.env` contents) at module load. Absent, this registers the suite with
 * `evalite.skip` — a loud console banner plus a vitest-level skip. The
 * `eval:live` script deliberately omits `--threshold`: evalite treats a
 * `null` average score (zero evals run — the skip case) as an automatic
 * threshold failure whenever `--threshold` is passed at all, regardless of
 * its value, so the flag has to be absent for a clean skip to exit 0. That
 * also means a keyed run is scored but not threshold-gated — informational,
 * not a hard pass/fail, matching its opt-in/free-tier nature; a thrown task
 * still fails the process via evalite's normal failed-task exit code. The
 * provider is constructed HERE, at this file's own edge — the same
 * env/model seam `packages/agent`'s runtime never crosses itself.
 *
 * Free-tier key: one data point, one turn. `maxTurnsPerWake` bounds the
 * hello leader to at most 3 model calls per wake (read_tick_count,
 * record_tick, final text) — comfortably under the ≤5-calls budget for this
 * whole file. `maxModelRetries` rides the AI SDK's built-in backoff for
 * 429s, same as the live smoke.
 *
 * Only `evalite/scorers/deterministic` is imported — an assertion-style
 * substring check, not an LLM judge. Semantic/LLM-judge scoring for live
 * sessions is the promptfoo/adversarial-eval follow-up flagged in #5's
 * resolution, not this file.
 */

const hasKey = env.GEMINI_API_KEY !== undefined;

if (!hasKey) {
  console.warn(
    [
      "",
      "==================== LIVE EVAL SKIPPED ====================",
      "hello leader (live): status report — GEMINI_API_KEY is not",
      "set (checked via @hazard-pay/env). Expected keyless/CI.",
      "=============================================================",
      "",
    ].join("\n"),
  );
}

const run = hasKey ? evalite : evalite.skip;

run("hello leader (live): status report", {
  data: () => (hasKey ? [{ input: "Status report, please.", expected: "tick" }] : []),
  task: async (input) => {
    const apiKey = env.GEMINI_API_KEY;
    if (apiKey === undefined) {
      // Unreachable: `run` is `evalite.skip` whenever the key is absent, so
      // vitest never invokes task() in that case.
      throw new Error("live eval task ran without GEMINI_API_KEY");
    }
    const google = createGoogleGenerativeAI({ apiKey });
    return runSession({
      leader: createHelloLeader(),
      model: google("gemini-2.5-flash"),
      turns: [{ author: "eval", content: input }],
      maxModelRetries: 3,
    });
  },
  scorers: [
    {
      name: "mentions a tick count",
      scorer: ({ output, expected }) =>
        contains({ actual: output.finalText.toLowerCase(), expected: expected ?? "tick" }),
    },
  ],
});
