import { execFileSync } from "node:child_process";

/**
 * Shared `gh` exec wrapper, mirroring `worktree.ts`'s `git()`/`tryGit()`
 * pattern: run `gh`, capture stderr into the thrown error so callers can
 * report a useful message instead of a bare non-zero exit.
 */
export function gh(args: string[]): string {
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = error !== null && typeof error === "object" && "stderr" in error
      ? String((error as { stderr: unknown }).stderr).trim()
      : "";
    throw new Error(`gh ${args.join(" ")} failed${stderr ? `: ${stderr}` : ""}`);
  }
}

/** Run `gh` and parse its stdout as JSON. Throws with a clear message on failure. */
export function ghJson<T>(args: string[]): T {
  return JSON.parse(gh(args)) as T;
}

/** `error instanceof Error ? error.message : String(error)`, named once. */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * `gh api` GET request against the current repo, with `{owner}`/`{repo}`
 * resolved by `gh` itself from the local git remote — no repo needs to be
 * hardcoded or looked up separately. `params` become `-f key=value` query
 * parameters; `-X GET` is required explicitly because `gh api` defaults to
 * POST once any `-f` params are present. `paginate: true` follows every
 * page and flattens array responses into one array — required for any
 * endpoint whose result can plausibly exceed one page (100 items), since a
 * silently-truncated listing is exactly the kind of quiet miss this CLI
 * exists to avoid.
 */
export function ghApiGet<T>(
  endpoint: string,
  params: Record<string, string> = {},
  options: { paginate?: boolean } = {},
): T {
  const args = ["api", endpoint, "-X", "GET"];
  for (const [key, value] of Object.entries(params)) {
    args.push("-f", `${key}=${value}`);
  }
  if (options.paginate === true) {
    args.push("--paginate");
  }
  return ghJson<T>(args);
}
