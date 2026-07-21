import { ensureTemplateDatabase } from "@hazard-pay/db/testing";

/**
 * vitest globalSetup: migrate the shared template database once per run —
 * the same template `@hazard-pay/db` and `@hazard-pay/auth` use, so it is a
 * no-op when either primed it earlier in the same `pnpm test`.
 */
export default async function setup(): Promise<void> {
  await ensureTemplateDatabase();
}
