import { ensureTemplateDatabase } from "./template.ts";

/** vitest globalSetup: migrate the template database once per run. */
export default async function setup(): Promise<void> {
  await ensureTemplateDatabase();
}
