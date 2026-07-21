import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { emitEvent, subscribeToDomainEvents } from "./events.ts";
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

describe("emitEvent", () => {
  it("writes a structured line with an event field through the root logger", () => {
    const dir = tempDir();
    createLogger("api", { telemetryDir: dir, mirrorToStdout: false });
    emitEvent("match.completed", { matchId: "m1", winner: "p1" });
    const [line] = readLines(join(dir, "api.jsonl"));
    expect(line).toMatchObject({
      service: "api",
      event: "match.completed",
      msg: "match.completed",
      matchId: "m1",
      winner: "p1",
    });
  });

  it("redacts secret-shaped attribute keys (the event path of the log sink, #22)", () => {
    const dir = tempDir();
    createLogger("api", { telemetryDir: dir, mirrorToStdout: false });
    emitEvent("player.authenticated", { playerId: "p1", sessionToken: "s3cret" });
    const raw = readFileSync(join(dir, "api.jsonl"), "utf8");
    expect(raw).not.toContain("s3cret");
    const [line] = readLines(join(dir, "api.jsonl"));
    expect(line?.sessionToken).toBe(REDACTED);
  });

  it("routes events to the first-created (root) logger", () => {
    const dirA = tempDir();
    const dirB = tempDir();
    createLogger("api", { telemetryDir: dirA, mirrorToStdout: false });
    createLogger("worker", { telemetryDir: dirB, mirrorToStdout: false });
    emitEvent("tick.applied", {});
    expect(readLines(join(dirA, "api.jsonl"))).toHaveLength(1);
  });

  it("notifies additional subscribers without coupling them to the log sink", () => {
    const dir = tempDir();
    createLogger("api", { telemetryDir: dir, mirrorToStdout: false });
    const subscriber = vi.fn();
    const unsubscribe = subscribeToDomainEvents(subscriber);
    emitEvent("match.completed", { matchId: "m1" });
    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({ event: "match.completed", attrs: { matchId: "m1" } }),
    );
    unsubscribe();
    emitEvent("match.completed", { matchId: "m2" });
    expect(subscriber).toHaveBeenCalledTimes(1);
  });
});
