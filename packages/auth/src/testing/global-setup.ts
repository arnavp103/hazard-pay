import { ensureTemplateDatabase } from "@hazard-pay/db/testing";

/**
 * vitest globalSetup: migrate the shared template database once per run.
 * Same template @hazard-pay/db's own tests use — the migrations hash guard
 * means this is a no-op when packages/db already primed it in the same
 * `pnpm test` invocation.
 */
export default async function setup(): Promise<void> {
  await ensureTemplateDatabase();
}
