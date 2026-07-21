import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLogger } from "./logger.ts";
import { REDACTED } from "./redact.ts";
import { resetRootLoggerForTests } from "./state.ts";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "hazard-pay-obs-"));
}

function readLines(file: string): Record<string, unknown>[] {
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

afterEach(() => {
  resetRootLoggerForTests();
});

describe("createLogger", () => {
  it("writes JSONL lines to <dir>/<service>.jsonl", () => {
    const dir = tempDir();
    const logger = createLogger("api", { telemetryDir: dir, mirrorToStdout: false });
    logger.info({ matchId: "m1" }, "match started");
    const [line] = readLines(join(dir, "api.jsonl"));
    expect(line).toMatchObject({ service: "api", msg: "match started", matchId: "m1", level: 30 });
    expect(typeof line?.time).toBe("string");
  });

  it("defaults the level from @hazard-pay/env (LOG_LEVEL default info)", () => {
    const dir = tempDir();
    const logger = createLogger("api", { telemetryDir: dir, mirrorToStdout: false });
    expect(logger.level).toBe("info");
    logger.debug("invisible");
    logger.info("visible");
    const lines = readLines(join(dir, "api.jsonl"));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.msg).toBe("visible");
  });

  it("honors an explicit level override", () => {
    const dir = tempDir();
    const logger = createLogger("api", {
      telemetryDir: dir,
      mirrorToStdout: false,
      level: "silent",
    });
    logger.fatal("nothing");
    expect(readFileSync(join(dir, "api.jsonl"), "utf8")).toBe("");
  });

  it("redacts secret-shaped keys in merge objects (the logger sink, #22)", () => {
    const dir = tempDir();
    const logger = createLogger("api", { telemetryDir: dir, mirrorToStdout: false });
    logger.info(
      {
        user: { password: "hunter2" },
        token: "tok-123",
        headers: { authorization: "Bearer abc", cookie: "sid=1" },
      },
      "login",
    );
    const raw = readFileSync(join(dir, "api.jsonl"), "utf8");
    expect(raw).not.toContain("hunter2");
    expect(raw).not.toContain("tok-123");
    expect(raw).not.toContain("Bearer abc");
    expect(raw).not.toContain("sid=1");
    const [line] = readLines(join(dir, "api.jsonl"));
    expect((line?.user as Record<string, unknown>).password).toBe(REDACTED);
    expect(line?.token).toBe(REDACTED);
  });

  it("redacts secret-shaped keys bound onto child loggers", () => {
    const dir = tempDir();
    const logger = createLogger("api", { telemetryDir: dir, mirrorToStdout: false });
    const child = logger.child({ req: { headers: { authorization: "Bearer abc" } } });
    child.info("handled");
    const raw = readFileSync(join(dir, "api.jsonl"), "utf8");
    expect(raw).not.toContain("Bearer abc");
    expect(raw).toContain(REDACTED);
  });
});
