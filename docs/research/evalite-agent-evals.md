# Evalite for agent behavior evals

Research notes, 2026-07-19. Question: what does [evalite](https://evalite.dev/)
offer for evaluating LLM agent behavior (Hazard Pay's "AI leaders"), how does it
fit this pnpm + turbo monorepo, can it handle multi-turn sessions and tool-use
traces, and what are the alternatives?

## Capability summary

### What it is and how it runs

- Evalite is a TypeScript-native, local-first eval runner by Matt Pocock,
  **built on Vitest**: "Built on Vitest — works out of the box with your stack"
  and "`.eval.ts` is the new `.test.ts`" ([evalite.dev](https://evalite.dev/)).
  Each `evalite()` call becomes a Vitest `describe` block with concurrent `it`
  tests per data point; results go to SQLite and a Fastify server drives the UI
  ([repo CLAUDE.md](https://github.com/mattpocock/evalite/blob/main/CLAUDE.md)).
  It requires Vitest >= 3.2.4 for the annotations API
  ([evalite.ts](https://github.com/mattpocock/evalite/blob/main/packages/evalite/src/evalite.ts)).
- **CLI**: `evalite` (run once, CI mode), `evalite watch` (re-run on change,
  serves UI), `evalite serve`, `evalite export` (static HTML bundle), and
  file-path filtering (`evalite my-eval.eval.ts`)
  ([CLI guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/cli.mdx)).
  The v1 beta formalizes subcommands `run|watch|serve|export` with flags such as
  `--threshold`, `--outputPath`, `--no-cache`
  ([v1 CLI reference](https://github.com/mattpocock/evalite/blob/v1/apps/evalite-docs/src/content/docs/api/cli.mdx)).
- **UI**: local dev server at `http://localhost:3006` (port configurable via
  `evalite.config.ts`)
  ([configuration guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/configuration.mdx)).
- **Storage**: stable 0.19.x saves results "to a sqlite database in
  `node_modules/.evalite`"
  ([quickstart](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/quickstart.mdx)).
  The v1 beta defaults to **in-memory storage** with SQLite opt-in via
  `createSqliteStorage("./evalite.db")`, plus a pluggable `Evalite.Storage`
  interface for custom backends
  ([v1 storage guide](https://github.com/mattpocock/evalite/blob/v1/apps/evalite-docs/src/content/docs/guides/storage.mdx)).
- **CI story**: `--threshold=<0-100>` fails the process (exit code 1) when the
  average score falls below the threshold; `--outputPath=./results.json` emits a
  typed JSON export (`Evalite.Exported.Output` with runs, evals, results,
  scores, traces); `evalite export` produces a serverless static HTML bundle for
  CI artifacts or static hosting, with a documented GitHub Actions example
  ([CI guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/ci.mdx)).

### Authoring API

- Signature (from source,
  [evalite.ts](https://github.com/mattpocock/evalite/blob/main/packages/evalite/src/evalite.ts)
  and
  [types.ts](https://github.com/mattpocock/evalite/blob/main/packages/evalite/src/types.ts)):

  ```ts
  evalite<TInput, TOutput, TExpected = TOutput>(name, {
    data: { input; expected?; only? }[] | () => Promise<...>,
    task: (input) => MaybePromise<TOutput | AsyncIterable<TOutput>>,
    scorers?: (Scorer | ScorerOpts)[],
    columns?: (opts) => RenderedColumn[],   // custom UI columns
    trialCount?: number,                    // repeat runs for variance
  });
  ```

  Plus `evalite.skip()` and `evalite.each(variants)` for A/B variant comparison
  ([v1 API reference](https://github.com/mattpocock/evalite/blob/v1/apps/evalite-docs/src/content/docs/api/evalite.mdx)).
- **Scorers**: stable core ships none; docs recommend Braintrust's
  [`autoevals`](https://github.com/braintrustdata/autoevals) library and provide
  `createScorer()` for custom scorers returning `number | { score, metadata }`
  ([scorers guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/scorers.mdx)).
  The v1 beta adds a built-in library under `evalite/scorers`: deterministic
  (`exactMatch`, `contains`, `levenshtein`), RAG/LLM-judged (`faithfulness`,
  `answerCorrectness`, `answerRelevancy`, `contextRecall`, ...), and the
  agent-focused **`toolCallAccuracy`**
  ([v1 scorers index](https://github.com/mattpocock/evalite/blob/v1/apps/evalite-docs/src/content/docs/api/scorers/index.mdx)).
  Note: an open issue tracks adding a "use built-in scorers sparingly" caveat,
  which Matt Pocock endorsed
  ([issue #356](https://github.com/mattpocock/evalite/issues/356)).
- **Traces**: `reportTrace()` manually records `{ start, end, input, output,
  usage }` per LLM call (a no-op in production), and `traceAISDKModel(model)`
  wraps a Vercel AI SDK model so all its calls are recorded
  ([traces guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/traces.mdx)).
  The v1 beta replaces this with `wrapAISDKModel(model, { tracing?, caching? })`
  which also adds 24h response caching (cache-busted per trial), supporting
  `generateText`, `streamText`, and structured outputs
  ([v1 AI SDK reference](https://github.com/mattpocock/evalite/blob/v1/apps/evalite-docs/src/content/docs/api/ai-sdk.mdx)).
- **Streaming**: a task may return an `AsyncIterable`/`ReadableStream` (e.g.
  `streamText(...).textStream`); Evalite consumes and joins it
  ([streams guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/streams.md)).

### Maturity

- npm `latest` is **0.19.0** (2025-11-06); **1.0.0-beta.16** published
  2026-02-20 under the `beta` tag, with v1 docs at
  [v1.evalite.dev](https://v1.evalite.dev/)
  ([npm](https://www.npmjs.com/package/evalite)).
- MIT licensed, ~1.6k stars, actively developed on the `v1` branch through 2026
  ([github.com/mattpocock/evalite](https://github.com/mattpocock/evalite)).
- Positioning is "local-only... you stay in complete control of your data"
  ([what-is-evalite](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/what-is-evalite.mdx)),
  not a hosted platform. `ai` and `autoevals` are devDependencies of evalite
  itself, so consumers bring their own versions
  ([package.json](https://github.com/mattpocock/evalite/blob/main/packages/evalite/package.json)).

## Monorepo integration (pnpm + turbo)

- **Per-package usage is the natural fit**: the CLI scans the cwd for
  `.eval.ts`, so an `apps/<pkg>` or `packages/<pkg>` can own its evals with a
  local `eval` script, wired into turbo like `lint`/`test`. There is also a
  programmatic API, `runEvalite({ mode, path, cwd, scoreThreshold, outputPath })`
  from `evalite/runner`, if we want a custom turbo task wrapper
  ([running programmatically](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/running-programmatically.mdx)).
- **Config**: since it is Vitest-based, "all Vitest configuration options work
  with Evalite" via `vitest.config.ts`
  ([configuration guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/configuration.mdx)),
  but the project is migrating to `evalite.config.ts` as "the main source of
  truth" ([repo CLAUDE.md](https://github.com/mattpocock/evalite/blob/main/CLAUDE.md)).
- **Known friction**: running evalite alongside **Vitest workspaces** (a root
  workspace config spanning packages) is broken in stable — "No suite present"
  / "No test files found" — with Pocock confirming "Have reproduced locally,
  will fix for v1" ([issue #95](https://github.com/mattpocock/evalite/issues/95)).
  Since Hazard Pay has no root vitest workspace config today, per-package evals
  should sidestep this, but it is the main hazard to watch.
- **Roadmap caveat**: Pocock has said "the long-term plan is probably in a
  couple of major versions time to drop the vitest dependency," because "evals
  are sufficiently distinct from unit tests that I don't think it makes sense
  to run them at the same cadence"
  ([issue #155](https://github.com/mattpocock/evalite/issues/155)). Expect the
  Vitest coupling (and any config we build on it) to change.
- **pnpm gotcha**: `better-sqlite3` is a native dependency; the quickstart
  documents the pnpm fix (`pnpm approve-builds` / `pnpm rebuild better-sqlite3`)
  for "Could not locate the bindings file" errors
  ([quickstart troubleshooting](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/quickstart.mdx)).
  Relevant since pnpm 10 blocks build scripts by default.

## Fit for multi-turn agent evals

Evalite's unit of evaluation is one `task(input) -> output` invocation, scored.
There is **no first-class multi-turn conversation runner or turn-by-turn
scoring primitive**. What exists:

- **Conversation-as-input**: the official AI SDK example types an eval as
  `evalite<CoreMessage[], string, string>` — a whole message history is the
  input, and the task returns one final response
  ([AI SDK example](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/examples/ai-sdk.md)).
- **Roll-your-own loop**: nothing stops a `task()` from running a full agent
  loop (multiple model calls, tool executions) internally; each LLM call is
  captured as a trace via `wrapAISDKModel`/`reportTrace` and shown in the UI
  ([traces guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/traces.mdx)).
  The `Evalite.Trace` type is a flat single-call record (`input`, `output`,
  `start`, `end`, `usage`) — no nested tool-call tree
  ([types.ts](https://github.com/mattpocock/evalite/blob/main/packages/evalite/src/types.ts)).
- **Tool-call scoring (v1 beta)**: the built-in `toolCallAccuracy` scorer is
  explicitly aimed at "multi-step agents that orchestrate API calls," comparing
  actual vs expected `{ toolName, input }` lists in `exact` (ordered) or
  `flexible` (unordered) mode with partial-credit weights
  ([toolCallAccuracy reference](https://github.com/mattpocock/evalite/blob/v1/apps/evalite-docs/src/content/docs/api/scorers/tool-call-accuracy.mdx)).
- **Gap, honestly stated**: neither the stable nor v1 docs trees contain any
  agents/conversations/multi-turn guide, and no open issue tracks first-class
  multi-turn orchestration (checked docs directory listings and issue search on
  [mattpocock/evalite](https://github.com/mattpocock/evalite)). For Hazard
  Pay's AI leaders, the pattern would be: the task function runs (or replays) a
  bounded agent session, returns a structured transcript
  (final answer + tool-call list + decisions), and custom `createScorer`
  scorers plus `toolCallAccuracy` grade it. That is workable but hand-rolled.

## Alternatives

| Tool | Model | Multi-turn/agent story | Cost/hosting |
| --- | --- | --- | --- |
| **evalite** | TS `evalite()` on Vitest, local UI | DIY loop in `task()`, traces + `toolCallAccuracy` (v1 beta) | MIT, fully local ([evalite.dev](https://evalite.dev/)) |
| **Braintrust** | TS `Eval()` (evalite's acknowledged API inspiration), `autoevals`, hosted experiments | Experiment comparison (`baseExperimentName`), `trialCount`; no explicit multi-turn API in docs fetched | Hosted-by-default; free Starter tier (14-day retention), Pro $249/mo; `--no-send-logs` for local runs ([Eval() reference](https://www.braintrust.dev/docs/reference/libs/nodejs/functions/Eval), [pricing](https://www.braintrust.dev/pricing)) |
| **promptfoo** | Declarative `promptfooconfig.yaml`: prompts/providers/tests/asserts | Strongest multi-turn story: chat `messages` fixtures ([chat docs](https://github.com/promptfoo/promptfoo/blob/main/site/docs/configuration/chat.md)) and dedicated multi-turn red-team strategies (Crescendo, GOAT, Hydra...) with `maxTurns`/`stateful` ([multi-turn strategies](https://www.promptfoo.dev/docs/red-team/strategies/multi-turn/)) | MIT Community tier, local/self-host; GitHub Action for PR diffs ([pricing](https://www.promptfoo.dev/pricing/), [action](https://www.promptfoo.dev/docs/integrations/github-action/)) |
| **Plain Vitest harness** | Hand-rolled `describe`/`it` over datasets + AI SDK + `expect`/custom scoring | Anything you write yourself | Free; no UI, traces, thresholds, or exports — exactly the layer evalite adds ([issue #155 discussion](https://github.com/mattpocock/evalite/issues/155)) |
| **Vercel AI SDK itself** | No eval runner; provides OpenTelemetry-based telemetry (`@ai-sdk/otel`, GenAI semantic conventions, tool-call spans) as a substrate for third-party tools | Telemetry only | Part of the SDK ([telemetry docs](https://ai-sdk.dev/docs/ai-sdk-core/telemetry)) |

## Recommendation

**Adopt evalite (pin `evalite@beta`, the 1.0 line) as the per-package eval
runner for AI-leader behavior, and design our own thin "session harness" on top
of it.** Rationale:

1. It matches this repo's grain: TypeScript-first, Vitest-based, no build step,
   local SQLite/in-memory storage, MIT — and this repo already installs Matt
   Pocock's agent skills, so the idioms align. A `packages/evals` (or per-app
   `*.eval.ts` files) with `eval` scripts in turbo, `--threshold` in CI, and
   `evalite export` as a CI artifact covers the runner/CI story with zero
   infrastructure ([CI guide](https://github.com/mattpocock/evalite/blob/main/apps/evalite-docs/src/content/docs/guides/ci.mdx)).
2. Multi-turn is a real but manageable gap: our eval harness should run a
   bounded agent session inside `task()`, emit a structured transcript, and
   score with `createScorer` + `toolCallAccuracy`. Keeping that harness ours
   also insulates us from evalite's stated plan to drop Vitest in a future
   major ([issue #155](https://github.com/mattpocock/evalite/issues/155)).
3. Keep **promptfoo** on the shortlist for a later adversarial pass — its
   multi-turn red-team strategies (Crescendo, GOAT) are the only first-class
   multi-turn machinery among these tools
   ([multi-turn strategies](https://www.promptfoo.dev/docs/red-team/strategies/multi-turn/)) —
   and skip Braintrust for now: its value is the hosted platform, which the
   free tier's 14-day retention undercuts for a local-first project
   ([pricing](https://www.braintrust.dev/pricing)).

Watch items: vitest-workspace incompatibility
([issue #95](https://github.com/mattpocock/evalite/issues/95)) if we ever add a
root Vitest workspace; `better-sqlite3` build approval under pnpm 10; v1 beta
API churn (`wrapAISDKModel`, storage defaults) until 1.0 lands.
