import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createLogger } from "@hazard-pay/observability";
import { errAsync, okAsync } from "neverthrow";
import type { Job } from "pg-boss";
import { afterAll, expect, test } from "vitest";

import { jobHandler } from "./job-handler.ts";

const telemetryDir = mkdtempSync(join(tmpdir(), "hazard-pay-api-jobs-"));
const logger = createLogger("api-test-jobs", {
  level: "silent",
  telemetryDir,
  mirrorToStdout: false,
});

afterAll(() => {
  rmSync(telemetryDir, { recursive: true, force: true });
});

function fakeJob(): Job<object> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "worker.heartbeat",
    data: {},
    expireInSeconds: 60,
    heartbeatSeconds: null,
    signal: new AbortController().signal,
  };
}

test("resolves on ok so pg-boss completes the job", async () => {
  const handler = jobHandler({ logger }, () => okAsync(undefined));
  await expect(handler([fakeJob()])).resolves.toBeUndefined();
});

test("throws the tagged error on err so pg-boss retry/DLQ engages", async () => {
  const handler = jobHandler({ logger }, () =>
    errAsync({ type: "db_unreachable" as const, message: "pool is gone" }));
  await expect(handler([fakeJob()])).rejects.toThrow(
    "worker.heartbeat failed: db_unreachable: pool is gone",
  );
});

test("hands the domain function a ctx whose logger is the per-job child", async () => {
  const seen: unknown[] = [];
  const handler = jobHandler({ logger, extra: "kept" }, (ctx) => {
    seen.push(ctx.extra, ctx.logger.bindings());
    return okAsync(undefined);
  });
  await handler([fakeJob()]);
  expect(seen[0]).toBe("kept");
  expect(seen[1]).toMatchObject({ job_name: "worker.heartbeat" });
});
