import { randomBytes } from "node:crypto";

import env from "@hazard-pay/env";

import { createDb, type Db } from "../client.ts";
import { ADVISORY_LOCK_KEY, TEMPLATE_DB, withDatabase, withMaintenanceClient } from "./template.ts";

export interface TestDatabase {
  db: Db;
  connectionString: string;
  /** Closes the pool and drops the database. Always call, in finally/afterAll. */
  drop: () => Promise<void>;
}

/**
 * Clones the migrated template (`CREATE DATABASE … TEMPLATE …`, ~50-200 ms)
 * into a uniquely named database and returns a client bound to it.
 */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `hazard_pay_test_${randomBytes(6).toString("hex")}`;
  await withMaintenanceClient(async (client) => {
    await client.query("select pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query(`create database "${name}" template "${TEMPLATE_DB}"`);
  });
  const connectionString = withDatabase(env.DATABASE_URL, name);
  const handle = createDb(connectionString);
  return {
    db: handle.db,
    connectionString,
    drop: async () => {
      await handle.close();
      await withMaintenanceClient(async (client) => {
        await client.query(`drop database if exists "${name}" with (force)`);
      });
    },
  };
}
