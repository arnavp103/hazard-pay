import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Telemetry lands in `var/telemetry/` at the repo root (ADR 0005 §5),
 * regardless of which package's directory the process was started from —
 * turbo runs each package with its own cwd, so the root is discovered by
 * walking up to `pnpm-workspace.yaml`.
 */
export function findRepoRoot(from: string = process.cwd()): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return resolve(from);
    }
    dir = parent;
  }
}

/** Resolves (and creates) the telemetry directory. */
export function telemetryDir(override?: string): string {
  const dir = override ?? join(findRepoRoot(), "var", "telemetry");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Per-service, per-signal file layout: `<service>.jsonl` for logs and domain
 * events, `<service>.spans.jsonl` for spans.
 */
export function telemetryFile(
  service: string,
  signal: "logs" | "spans",
  dirOverride?: string,
): string {
  const base = signal === "spans" ? `${service}.spans.jsonl` : `${service}.jsonl`;
  return join(telemetryDir(dirOverride), base);
}
