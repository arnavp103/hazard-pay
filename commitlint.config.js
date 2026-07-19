import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));

/**
 * Directory names under a top-level workspace dir (`apps/`, `packages/`) are the
 * workspace package locations, and therefore the valid app/package commit
 * scopes. Reading them at config-load time keeps the scope list in sync with the
 * repo layout, so adding an app/package no longer requires editing this file.
 *
 * Returns an empty list (instead of throwing) when the directory is missing.
 */
function workspaceScopes(dir) {
  try {
    return readdirSync(join(configDir, dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name !== "node_modules" && !name.startsWith("."));
  } catch {
    return [];
  }
}

/**
 * Non-directory scopes that don't map to a workspace package — repo-level
 * chores, CI, and dependency bumps. Keep this list small: only add a scope once
 * it has real usage.
 */
const extraScopes = ["repo", "ci", "deps", "infra"];

// Order-stable: apps first, then packages, then the extra scopes; de-duplicated
// while preserving first-seen order.
const allowedScopes = [
  ...new Set([
    ...workspaceScopes("apps"),
    ...workspaceScopes("packages"),
    ...extraScopes,
  ]),
];

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [2, "never"],
    "scope-enum": [2, "always", allowedScopes],
  },
};
