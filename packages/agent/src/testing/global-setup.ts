import { ensureTemplateDatabase } from "@hazard-pay/db/testing";

/** vitest globalSetup: migrate the template database once per run. */
export default async function setup(): Promise<void> {
  await ensureTemplateDatabase();
}
