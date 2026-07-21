import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Shared helpers for tests that redirect telemetry into a temp directory. */
export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "hazard-pay-obs-"));
}

export function readLines(file: string): Record<string, unknown>[] {
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}
