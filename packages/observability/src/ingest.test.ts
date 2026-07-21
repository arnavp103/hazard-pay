import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test } from "vitest";

import { ingestTelemetryLines } from "./ingest.ts";

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "hazard-pay-ingest-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function readLines(file: string): Record<string, unknown>[] {
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

test("routes lines by signal, strips it, and stamps the service", () => {
  const dir = tempDir();
  const result = ingestTelemetryLines(
    "webapp",
    [
      { signal: "log", level: 30, msg: "hello", service: "spoofed" },
      { signal: "span", name: "load", duration_ms: 12 },
    ],
    { telemetryDir: dir },
  );

  expect(result._unsafeUnwrap()).toEqual({ logs: 1, spans: 1, dropped: 0 });
  const logs = readLines(join(dir, "webapp.jsonl"));
  const spans = readLines(join(dir, "webapp.spans.jsonl"));
  expect(logs).toEqual([{ level: 30, msg: "hello", service: "webapp" }]);
  expect(spans).toEqual([{ name: "load", duration_ms: 12, service: "webapp" }]);
});

test("re-redacts secret-shaped keys server-side", () => {
  const dir = tempDir();
  ingestTelemetryLines(
    "webapp",
    [{ signal: "log", msg: "login", apiToken: "hunter2", ctx: { password: "pw" } }],
    { telemetryDir: dir },
  );

  const raw = readFileSync(join(dir, "webapp.jsonl"), "utf8");
  expect(raw).not.toContain("hunter2");
  expect(raw).not.toContain("pw\"");
  const [line] = readLines(join(dir, "webapp.jsonl"));
  expect(line?.apiToken).toBe("[REDACTED]");
  expect((line?.ctx as Record<string, unknown>).password).toBe("[REDACTED]");
});

test("drops lines without a valid signal discriminator", () => {
  const dir = tempDir();
  const result = ingestTelemetryLines(
    "webapp",
    [{ msg: "no signal" }, { signal: "bogus", msg: "wrong" }],
    { telemetryDir: dir },
  );

  expect(result._unsafeUnwrap()).toEqual({ logs: 0, spans: 0, dropped: 2 });
});

test("rejects a path-traversal-shaped service name", () => {
  const dir = tempDir();
  const result = ingestTelemetryLines("../evil", [{ signal: "log", msg: "x" }], {
    telemetryDir: dir,
  });

  expect(result._unsafeUnwrapErr().type).toBe("invalid_service");
});
