/* eslint-disable no-console -- console is this CLI script's user interface */
/**
 * Live smoke: run the hello leader for one short wake against the real
 * Google Gemini model, then prove that (a) an append-only lane event log was
 * written and (b) observability landed spans + domain events in
 * `var/telemetry/`. This is the first end-to-end tracing test bed (#28).
 *
 * - SKIPS loudly (exit 0) when `GEMINI_API_KEY` is absent — CI has no key
 *   and must stay green. Presence is checked via the env schema only; this
 *   script never reads or prints `.env` contents or the key itself.
 * - The provider is constructed HERE, at the host edge, with the key passed
 *   explicitly — `createRuntime` only ever sees a model instance (the
 *   env/model seam from issue #23). Never rely on the SDK's ambient env
 *   pickup.
 * - Free-tier budget: one wake, `maxTurnsPerWake` bounds it to a handful of
 *   model calls; 429s ride the SDK's exponential-backoff retries.
 *
 * Run: `pnpm --filter @hazard-pay/agent smoke` (dev Postgres must be up).
 */

// The OTel bootstrap must load before anything else pulls in pino/pg, and
// always from `/init` (ADR 0005 §6) — hence dynamic imports throughout.
const { initObservability } = await import("@hazard-pay/observability/init");
const observability = await initObservability("agent-smoke");

const { default: env } = await import("@hazard-pay/env");

if (env.GEMINI_API_KEY === undefined) {
  console.error(
    [
      "",
      "==================== LIVE SMOKE SKIPPED ====================",
      "GEMINI_API_KEY is not set (checked via @hazard-pay/env).",
      "Add it to the checkout-root .env to run the live smoke.",
      "This is expected in CI, which runs keyless and stays green.",
      "============================================================",
      "",
    ].join("\n"),
  );
  await observability.shutdown();
  process.exit(0);
}

const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
const { createLogger } = await import("@hazard-pay/observability");
const { createTestDatabase, ensureTemplateDatabase } = await import("@hazard-pay/db/testing");
const { laneEvent } = await import("@hazard-pay/db");
const { asc, eq } = await import("drizzle-orm");
const { readFileSync } = await import("node:fs");
const { join } = await import("node:path");
const { createHelloLeader } = await import("../src/hello-leader.ts");
const { createRuntime } = await import("../src/runtime.ts");

function fail(message: string): never {
  console.error(`SMOKE FAILED: ${message}`);
  process.exit(1);
}

const logger = createLogger("agent-smoke");

// Host edge: construct the provider with the key passed explicitly.
const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
const model = google("gemini-2.5-flash");

// A template-clone database: the smoke never touches dev data. The template
// is shared across worktrees, so make sure it matches THIS checkout's
// migrations before cloning (a concurrent worktree may have rebuilt it).
await ensureTemplateDatabase();
const tdb = await createTestDatabase();

try {
  const runtime = createRuntime({
    db: tdb.db,
    model,
    logger,
    leaders: [createHelloLeader()],
    maxModelRetries: 3,
  });

  const { laneId } = (await runtime.createLane({ leader: "hello" }))._unsafeUnwrap();
  (
    await runtime.appendInput({
      laneId,
      author: "smoke",
      content: "Status report, please.",
    })
  )._unsafeUnwrap();

  console.log(`waking hello leader (lane ${laneId}) against gemini-2.5-flash...`);
  const woke = await runtime.wake({ laneId });
  if (woke.isErr()) {
    fail(`wake errored: ${JSON.stringify(woke.error, null, 2)}`);
  }
  const report = woke.value;
  console.log(
    `wake finished: turns=${report.turns} toolExecutions=${report.toolExecutions} `
    + `quiescent=${report.quiescent} finalSeq=${report.finalSeq}`,
  );

  // (a) The lane event log was written, append-only, and it replays.
  const rows = await tdb.db
    .select()
    .from(laneEvent)
    .where(eq(laneEvent.laneId, laneId))
    .orderBy(asc(laneEvent.seq));
  console.log(`lane event log: ${rows.map((row) => `${row.seq}:${row.type}`).join(" ")}`);
  if (report.turns < 1) {
    fail("expected at least one model turn");
  }
  if (rows.length < 2 || rows.some((row, index) => row.seq !== index + 1)) {
    fail("expected a gapless lane event log with at least input + model_turn");
  }
  if (!rows.some((row) => row.type === "tool_result")) {
    console.warn("WARN: the model took no tool calls this run (log still valid)");
  }
  const verified = await runtime.verifyFingerprints({ laneId });
  if (verified.isErr()) {
    fail(`fingerprint verification failed: ${JSON.stringify(verified.error)}`);
  }
  console.log(`fingerprints verified for ${verified.value.verified} model turn(s)`);

  // (b) Spans + domain events landed in var/telemetry/ — flush first.
  await observability.shutdown();
  const { existsSync } = await import("node:fs");
  const { dirname, resolve } = await import("node:path");
  // Same walk as the observability package: telemetry lands at the
  // workspace root regardless of the package cwd turbo/pnpm gave us.
  let workspaceRoot = resolve(process.cwd());
  while (!existsSync(join(workspaceRoot, "pnpm-workspace.yaml"))) {
    const parent = dirname(workspaceRoot);
    if (parent === workspaceRoot) {
      fail("could not locate the workspace root for var/telemetry");
    }
    workspaceRoot = parent;
  }
  const telemetryDir = join(workspaceRoot, "var", "telemetry");
  const spans = readFileSync(join(telemetryDir, "agent-smoke.spans.jsonl"), "utf8");
  for (const name of ["lane.wake", "lane.model_turn"]) {
    if (!spans.includes(`"${name}"`)) {
      fail(`no "${name}" span found in agent-smoke.spans.jsonl`);
    }
  }
  const logs = readFileSync(join(telemetryDir, "agent-smoke.jsonl"), "utf8");
  for (const eventName of ["lane.created", "lane.woke"]) {
    if (!logs.includes(`"event":"${eventName}"`)) {
      fail(`no "${eventName}" domain event found in agent-smoke.jsonl`);
    }
  }
  console.log("spans and domain events landed in var/telemetry/");
  console.log("LIVE SMOKE PASSED");
} finally {
  await tdb.drop();
}

// All imports are dynamic (the OTel bootstrap must load first), so mark the
// file as a module explicitly for top-level await.
export {};
