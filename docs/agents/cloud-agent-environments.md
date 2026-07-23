# Cloud agent environments

Research date: 2026-07-21. This note compares the hosted environments behind
[OpenAI Codex cloud](https://developers.openai.com/codex/cloud/environments/)
and [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
with what Hazard Pay actually needs. Platform behavior changes quickly, so
re-check the linked first-party pages before relying on a limit or security
control.

## Executive recommendation

Configure **one environment per platform**, but keep the reproducible part in
the repository rather than maintaining two large setup scripts in vendor UIs.
The repository exposes one idempotent bootstrap command:

```bash
./apps/cli/bin/hazard-pay setup
```

It:

1. verifies Node 22+ and pnpm 11.11.0;
2. runs `pnpm install --frozen-lockfile`;
3. starts Docker Compose when available, or an installed Debian/Ubuntu
   PostgreSQL cluster, then waits for `DATABASE_URL`;
4. waits for it and runs `pnpm --filter @hazard-pay/db db:migrate`; and
5. installs the pinned `agent-browser` CLI, Chrome for Testing, and required
   Linux browser libraries for screenshot automation.

Hosted environments must set `HAZARD_PAY_HOSTED_AGENT=true`; then `worktree
new` creates a branch in the provider checkout instead of a nested worktree.
CLI GitHub reads use the HTTP API rather than `gh`, and require
`GITHUB_TOKEN` plus `GITHUB_REPOSITORY=owner/repo`. `GITHUB_API_URL` is optional
and defaults to GitHub.com (override it for GitHub Enterprise Server).

The vendor setup field can then call that command. Keep test/dev/screenshot
commands separate: setup runs while the environment is being prepared, not
necessarily on every task.

It is also safe to call at the start of every local implementation session. A
successful run records a fingerprint of the lockfile, setup implementation,
database URL, runtime, and migrations under ignored `node_modules` state. When
that fingerprint still matches and PostgreSQL is healthy, the next invocation
prints that setup is current and performs no installation or migration work.
`--force` deliberately bypasses this fast path.

**A checked-in `.env` is neither required nor appropriate.** The env package
already supplies development defaults for `DATABASE_URL`, ports, the auth
secret, and tick interval. `GEMINI_API_KEY` is optional and keyless boot is
supported. For hosted agents, configure a platform secret only if the task must
exercise the real Gemini-backed leader; ordinary builds and tests should remain
keyless. If a cloud PostgreSQL service is chosen instead of a local process,
store its `DATABASE_URL` as a platform secret/environment variable. Never ask an
agent to create or commit a real `.env`.

## What the platforms provide

### Codex cloud

* An environment binds repository code to a setup script, environment
  variables, secrets, and internet-access policy. Setup scripts run in the
  environment so project dependencies and tools can be prepared before agent
  work. See [Cloud environments](https://developers.openai.com/codex/cloud/environments/)
  and [Internet access](https://developers.openai.com/codex/cloud/internet-access/).
* Environment variables are available throughout the task. Secrets are exposed
  to the setup script, then removed before the agent phase; setup must not write
  them into files or other durable locations. This distinction matters: a
  runtime `GEMINI_API_KEY` cannot safely be supplied through a setup-only Codex
  secret. Use an ordinary environment variable only after accepting that agent
  code can read it, or leave live-model behavior disabled.
* Internet access is off during the agent phase by default and can be enabled
  with a domain allowlist. Keep the allowlist narrow. Dependency installation
  belongs in setup; only add runtime domains (for example the Gemini API) when a
  task genuinely requires them. OpenAI warns that network access creates prompt
  injection and exfiltration risk.
* Codex works in an isolated container, can run repository commands, and can
  produce changes for review. GitHub integration is the path by which cloud
  tasks operate on a repository and changes become pull requests; see
  [Codex cloud](https://developers.openai.com/codex/cloud/) and
  [GitHub](https://developers.openai.com/codex/integrations/github/).

Do not assume the task container can start Docker inside Docker. Treat
`docker compose` support as an optimization to probe, not a prerequisite. A
user-space PostgreSQL process or an external ephemeral database is the portable
hosted-agent path.

### Claude Code on the web

* Web sessions run remotely in isolated environments after the Claude GitHub
  app is installed and repository access is granted. Claude clones the
  repository, works on a branch, and can create a pull request. See
  [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
  and [GitHub integration](https://code.claude.com/docs/en/github-actions).
* Configure environment setup and environment variables in the web environment
  settings. Anthropic recommends a `SessionStart` hook for repository-defined,
  repeatable initialization; project hooks live in `.claude/settings.json`.
  See [Hooks](https://code.claude.com/docs/en/hooks) and
  [Settings](https://code.claude.com/docs/en/settings).
* Web network access is mediated by Anthropic's proxy and an allowlist. The
  default allowlist covers common package ecosystems and source-control
  services; custom domains can be added. Allowing arbitrary network access
  increases prompt-injection and data-exfiltration risk. See
  [Network configuration](https://code.claude.com/docs/en/network-config).
* Anthropic documents web sessions as restricted sandboxes. Do not design the
  database workflow around a Docker daemon being available. As with Codex, use
  a directly started PostgreSQL process or a dedicated external development
  database, and verify the exact image capabilities in a throwaway session.

`CLAUDE.md` already delegates to `AGENTS.md`, and the checked-in Claude settings
disable attribution text/session URLs. Preserve that arrangement. If a
`SessionStart` hook is added, make it call the same repo bootstrap used by Codex
rather than embedding a second implementation in JSON.

## Hazard Pay requirements discovered in the repository

| Need | Existing contract | Cloud implication |
| --- | --- | --- |
| Toolchain | Node `>=22`, pnpm exactly `11.11.0`, Turborepo | Enable Corepack, activate the pinned pnpm, then use the frozen lockfile. |
| Database | PostgreSQL 18; local compose maps `5433` to `5432` | Hosted fallback must run PostgreSQL 18 on `127.0.0.1:5433`, or override `DATABASE_URL`. |
| Tests | Root `pnpm test`; DB tests clone a migrated template database | PostgreSQL must be healthy before the full suite. The test user needs database-creation privileges. |
| Required checks | `pnpm type-check && pnpm lint && pnpm test` | Put the exact command in agent instructions and PR evidence. Do not silently substitute package-only checks. |
| Dev UI | API `:3000`, admin `:3001`, webapp `:5173`; root `pnpm dev` runs the graph | Start DB, migrate, then start the relevant long-running processes with captured logs and reliable teardown. |
| Environment | Defaults cover `DATABASE_URL`, API URL/port, auth, logs, and tick cadence | No `.env` is needed for normal cloud work. Process env overrides the defaults. |
| Live AI | `GEMINI_API_KEY` is optional; keyless API boot skips leader wakes | Keep autonomous PR/test agents keyless unless explicitly testing the provider boundary. |
| Screenshots | `screenshots/` establishes an evidence convention, but no Playwright dependency/script exists | Add a repository-owned screenshot harness; vendor browser features alone are not reproducible CI evidence. |
| PR policy | Conventional commit with mandatory scope; hooks run syncpack/lint-staged | Give GitHub app least repository access, require CI/branch protection, and let humans merge. |

The current GitHub Actions workflow is also a useful executable reference: it
uses Node 22, the package-manager declaration, frozen installation, PostgreSQL
18, and an explicit service-container `DATABASE_URL`. The cloud bootstrap
should deliberately match it rather than inventing another stack.

## Screenshot and UI workflow

Neither platform's conversational browser UI should be the only screenshot
mechanism. Add Playwright (pinned in the lockfile) and repository scripts that
can run headlessly in Linux. The harness should:

1. start PostgreSQL and migrate;
2. start API and the target Vite app on explicit ports;
3. poll `/health` and the page URL instead of sleeping a fixed duration;
4. open a fixed viewport with reduced motion and deterministic test data;
5. save PNGs under `screenshots/` (or a task artifact directory); and
6. tear down servers even when capture fails.

Playwright's official CI guidance requires installing browser binaries and OS
dependencies (for example `pnpm exec playwright install --with-deps chromium`)
and shows starting a web server from configuration. See
[Playwright CI](https://playwright.dev/docs/ci) and
[webServer configuration](https://playwright.dev/docs/test-webserver).
Whether `--with-deps` can use privilege escalation varies by hosted image; if
it cannot, install dependencies during the vendor setup phase or use the
platform's preinstalled Chromium. Commit the Playwright config and capture
script so the exact same command works locally and in both clouds.

## Proposed rollout

1. **First, add a non-secret bootstrap script.** Make it idempotent and add a
   `--check`/diagnostic mode that prints tool versions and probes PostgreSQL.
   Do not edit `.github/` merely to support an agent; CI already expresses the
   desired test environment.
2. **Add headless UI evidence.** Introduce Playwright, a deterministic smoke
   path, and one documented screenshot command. Decide whether generated images
   are committed or attached to PRs; do not commit browser caches.
3. **Configure Codex.** Setup command: repo bootstrap. Set agent internet access
   off initially. Add no secrets. Only add a `DATABASE_URL` if the PostgreSQL
   fallback cannot run locally.
4. **Configure Claude web.** Grant the GitHub app only this repository. Add the
   same bootstrap through environment setup or a checked-in `SessionStart`
   hook. Start with the default network allowlist and no secrets.
5. **Run two qualification tasks.** Each platform must independently change a
   harmless UI string, run all three required checks, boot the full app, capture
   a screenshot with the repo command, commit with a valid scoped conventional
   message, and open a draft PR. Record time, failures, and required domains.
6. **Harden autonomy.** Protect `main`; require CI and review; limit GitHub-app
   permissions; deny production credentials; use isolated development data;
   review proposed network-allowlist additions; and treat screenshots as
   evidence, not proof that behavior is correct.

## Platform-console checklist

For each provider, record (outside the repository) the environment name,
repository/branch, setup command, Node/pnpm/PostgreSQL versions, network
allowlist, environment-variable names (never values), GitHub permissions, and
last qualification date. Re-run qualification after changing the base image,
lockfile, bootstrap, database major, or browser version.

Before enabling unattended tasks, explicitly verify in a live session:

```text
node --version
pnpm --version
git --version
psql --version
command -v chromium || command -v chromium-browser
docker version                     # informative only; failure is acceptable
pnpm install --frozen-lockfile
pnpm type-check && pnpm lint && pnpm test
```

## Sources

Primary platform and tool documentation used above:

* OpenAI: [Codex cloud](https://developers.openai.com/codex/cloud/),
  [cloud environments](https://developers.openai.com/codex/cloud/environments/),
  [internet access](https://developers.openai.com/codex/cloud/internet-access/),
  and [GitHub integration](https://developers.openai.com/codex/integrations/github/).
* Anthropic: [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web),
  [settings](https://code.claude.com/docs/en/settings),
  [hooks](https://code.claude.com/docs/en/hooks),
  [network configuration](https://code.claude.com/docs/en/network-config), and
  [GitHub Actions/integration](https://code.claude.com/docs/en/github-actions).
* Microsoft Playwright: [continuous integration](https://playwright.dev/docs/ci)
  and [web server configuration](https://playwright.dev/docs/test-webserver).
