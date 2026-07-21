import { createHelloLeader, createRuntime } from "@hazard-pay/agent";
import { scriptedModel, textTurn, toolCallTurn } from "@hazard-pay/agent/testing";
import { createTestDatabase, type TestDatabase } from "@hazard-pay/db/testing";
import env from "@hazard-pay/env";
import { createLogger } from "@hazard-pay/observability";
import { afterAll, beforeAll, expect, test } from "vitest";

import type { LaneSummary, LaneTracePage } from "./contract/index.ts";
import { buildServer, type ApiServer } from "./server.ts";

/**
 * Lane read routes (#24), tested the honest way: the lane log is seeded by
 * driving the REAL runtime from `@hazard-pay/agent` with its scripted mock
 * model — never by hand-inserting rows — so these tests break if the
 * envelope, the store, or the routes drift apart.
 */
let tdb: TestDatabase;
let app: ApiServer;
let baseUrl: string;
let foregroundId: string;
let missionId: string;

beforeAll(async () => {
  tdb = await createTestDatabase();

  const model = scriptedModel([
    toolCallTurn([{ toolCallId: "c1", toolName: "read_tick_count", input: {} }]),
    toolCallTurn([{
      toolCallId: "c2",
      toolName: "spawn_lane",
      input: { leader: "hello", input: "scout the night market and report back" },
    }]),
    textTurn("Tick count read, mission dispatched to scout the night market."),
  ]);
  const runtime = createRuntime({
    db: tdb.db,
    model,
    logger: createLogger("lanes-test", { level: "silent" }),
    leaders: [createHelloLeader()],
  });
  const created = (await runtime.createLane({ leader: "hello" }))._unsafeUnwrap();
  foregroundId = created.laneId;
  (await runtime.appendInput({
    laneId: foregroundId,
    author: "player:p1",
    content: "status report please",
  }))._unsafeUnwrap();
  const report = (await runtime.wake({ laneId: foregroundId }))._unsafeUnwrap();
  const spawned = report.spawnedLaneIds[0];
  if (spawned === undefined) {
    throw new Error("seed wake did not spawn a mission lane");
  }
  missionId = spawned;

  const logger = createLogger("api-lanes-test", { level: "silent", mirrorToStdout: false });
  app = await buildServer({ db: tdb.db, logger, env });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("server did not bind a port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await app.close();
  await tdb.drop();
});

test("GET /lanes lists the foreground lane and its spawned mission with tallies", async () => {
  const response = await fetch(`${baseUrl}/lanes`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { lanes: LaneSummary[] };
  expect(body.lanes).toHaveLength(2);

  const foreground = body.lanes.find((lane) => lane.id === foregroundId);
  const mission = body.lanes.find((lane) => lane.id === missionId);
  expect(foreground).toMatchObject({
    kind: "foreground",
    leaderName: "hello",
    status: "open",
    parentLaneId: null,
    // input + 3 model turns + 2 tool results, straight from the wake.
    eventCounts: { input: 1, modelTurn: 3, toolResult: 2, compaction: 0, total: 6 },
  });
  expect(foreground?.configHash).toMatch(/^[0-9a-f]{64}$/);
  expect(foreground?.lastEventAt).not.toBeNull();
  // The mission was spawned with its briefing as seq 1 — one input, nothing else.
  expect(mission).toMatchObject({
    kind: "mission",
    leaderName: "hello",
    parentLaneId: foregroundId,
    eventCounts: { input: 1, modelTurn: 0, toolResult: 0, compaction: 0, total: 1 },
  });
});

test("GET /lanes/{id}/events returns the seq-ordered transcript with envelope payloads", async () => {
  const response = await fetch(`${baseUrl}/lanes/${foregroundId}/events`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as LaneTracePage;

  expect(body.lane.id).toBe(foregroundId);
  expect(body.hasMore).toBe(false);
  expect(body.events.map((event) => event.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(body.events.map((event) => event.type)).toEqual([
    "input",
    "model_turn",
    "tool_result",
    "model_turn",
    "tool_result",
    "model_turn",
  ]);

  const input = body.events[0]?.payload;
  expect(input).toMatchObject({ kind: "input", content: "status report please" });
  expect(body.events[0]?.author).toBe("player:p1");

  const firstTurn = body.events[1]?.payload;
  if (firstTurn?.kind !== "model_turn") {
    throw new Error("seq 2 should be a model turn");
  }
  expect(firstTurn.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  expect(firstTurn.model).toEqual({ provider: "mock", modelId: "mock-model" });

  // The spawn receipt links the mission lane — the viewer's cheap cross-link.
  const spawnResult = body.events[4]?.payload;
  if (spawnResult?.kind !== "tool_result") {
    throw new Error("seq 5 should be a tool result");
  }
  expect(spawnResult.toolName).toBe("spawn_lane");
  expect(spawnResult.isError).toBe(false);
  expect(spawnResult.output).toEqual({ spawned: true, laneId: missionId });
});

test("GET /lanes/{id}/events paginates by seq cursor, newest last", async () => {
  const first = await fetch(`${baseUrl}/lanes/${foregroundId}/events?limit=4`);
  const firstPage = (await first.json()) as LaneTracePage;
  expect(firstPage.events.map((event) => event.seq)).toEqual([1, 2, 3, 4]);
  expect(firstPage.hasMore).toBe(true);

  const cursor = firstPage.events.at(-1)?.seq ?? 0;
  const second = await fetch(`${baseUrl}/lanes/${foregroundId}/events?after=${cursor}&limit=4`);
  const secondPage = (await second.json()) as LaneTracePage;
  expect(secondPage.events.map((event) => event.seq)).toEqual([5, 6]);
  expect(secondPage.hasMore).toBe(false);

  // The poll shape (`seq > lastSeen`) with nothing new is an empty page.
  const idle = await fetch(`${baseUrl}/lanes/${foregroundId}/events?after=6`);
  const idlePage = (await idle.json()) as LaneTracePage;
  expect(idlePage.events).toEqual([]);
  expect(idlePage.hasMore).toBe(false);
});

test("GET /lanes/{id}/events rejects an over-cap limit with 400", async () => {
  const response = await fetch(`${baseUrl}/lanes/${foregroundId}/events?limit=501`);
  expect(response.status).toBe(400);
});

test("GET /lanes/{id}/events maps an unknown lane to 404 via the respond table", async () => {
  const response = await fetch(`${baseUrl}/lanes/00000000-0000-4000-8000-000000000000/events`);
  expect(response.status).toBe(404);
  const body = (await response.json()) as { code: string };
  expect(body.code).toBe("NOT_FOUND");
});
