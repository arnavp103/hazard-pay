import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createTestDatabase } from "@hazard-pay/db/testing";
import env from "@hazard-pay/env";
import { createLogger } from "@hazard-pay/observability";
import { expect, test } from "vitest";

import { createDb, findPlayerByUserId } from "./db/index.ts";
import { buildServer } from "./server.ts";

/**
 * Honest integration tests: a real Fastify server on an ephemeral port, a
 * template-cloned Postgres database, real fetch — nothing mocked
 * (ADR 0001 §3, ADR 0002 consequences).
 */
interface TestServer {
  baseUrl: string;
  telemetryDir: string;
  db: Awaited<ReturnType<typeof createTestDatabase>>["db"];
  close: () => Promise<void>;
}

async function startTestServer(
  options: { dbHandle?: ReturnType<typeof createDb> } = {},
): Promise<TestServer> {
  // Default: a template-cloned throwaway database. `dbHandle` overrides it
  // for tests that need a broken pool.
  const source = options.dbHandle ?? (await createTestDatabase());
  const db = source.db;
  const telemetryDir = mkdtempSync(join(tmpdir(), "hazard-pay-api-test-"));
  const logger = createLogger("api-test", {
    level: "silent",
    telemetryDir,
    mirrorToStdout: false,
  });
  const app = await buildServer({ db, logger, env }, { telemetryDir });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (address === null || typeof address === "string") {
    throw new Error("server did not bind a port");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    telemetryDir,
    db,
    close: async () => {
      await app.close();
      if ("drop" in source) {
        await source.drop();
      } else {
        await source.close();
      }
      rmSync(telemetryDir, { recursive: true, force: true });
    },
  };
}

test("GET /health proves a real db round-trip through the contract handler", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "reachable" });
  } finally {
    await server.close();
  }
});

test("GET /health maps db_unreachable to 503 via the respond table", async () => {
  // A deliberately unreachable connection string — the one place the "always
  // read DATABASE_URL" rule (packages/db AGENTS.md) does not apply, because
  // the point is a database that is NOT there: port 9 (discard) refuses
  // connections immediately on any host.
  const dead = createDb("postgres://postgres:postgres@127.0.0.1:9/nowhere");
  const server = await startTestServer({ dbHandle: dead });
  try {
    const response = await fetch(`${server.baseUrl}/health`);
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
  } finally {
    await server.close();
  }
});

test("unmatched routes fall through the contract handler to a 404", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/no-such-route`);
    expect(response.status).toBe(404);
  } finally {
    await server.close();
  }
});

test("POST /telemetry re-redacts untrusted lines and routes them per signal", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        service: "webapp",
        lines: [
          // A secret-shaped key that "slipped through" the client-side pass:
          // the server must strip it on ingest (#22 — client buffers are
          // untrusted even though the browser entry redacts too).
          { signal: "log", level: 30, msg: "signed in", sessionToken: "hunter2" },
          { signal: "span", name: "match.render", duration_ms: 8.2 },
        ],
      }),
    });
    expect(response.status).toBe(204);

    const logLines = readFileSync(join(server.telemetryDir, "webapp.jsonl"), "utf8");
    expect(logLines).not.toContain("hunter2");
    expect(logLines).toContain("[REDACTED]");
    expect(logLines).toContain("\"service\":\"webapp\"");

    const spanLines = readFileSync(join(server.telemetryDir, "webapp.spans.jsonl"), "utf8");
    expect(spanLines).toContain("match.render");
  } finally {
    await server.close();
  }
});

test("POST /telemetry rejects a malformed payload with 400", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(`${server.baseUrl}/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: "not-an-array" }),
    });
    expect(response.status).toBe(400);
  } finally {
    await server.close();
  }
});

test("anonymous sign-in round-trips better-auth and creates the player row", async () => {
  const server = await startTestServer();
  try {
    const signIn = await fetch(`${server.baseUrl}/api/auth/sign-in/anonymous`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(signIn.status).toBe(200);
    const body = (await signIn.json()) as { user: { id: string } };
    expect(body.user.id).toBeTruthy();

    const cookies = signIn.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThan(0);

    // The databaseHooks wiring from @hazard-pay/auth ran inside this app.
    const playerRow = await findPlayerByUserId(server.db, body.user.id);
    expect(playerRow._unsafeUnwrap()?.userId).toBe(body.user.id);

    // And the session cookie is honored on a follow-up request.
    const session = await fetch(`${server.baseUrl}/api/auth/get-session`, {
      headers: { cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; ") },
    });
    expect(session.status).toBe(200);
    const sessionBody = (await session.json()) as { user: { id: string } } | null;
    expect(sessionBody?.user.id).toBe(body.user.id);
  } finally {
    await server.close();
  }
});
