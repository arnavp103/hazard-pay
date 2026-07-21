import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.ts";

export type Db = NodePgDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  /** Closes the underlying pool. Call once, at shutdown. */
  close: () => Promise<void>;
}

/**
 * Plain factory, no classes: builds a pg Pool and a Drizzle instance over it.
 * Callers own the lifecycle; apps assemble the handle into their ctx at boot.
 */
export function createDb(connectionString: string): DbHandle {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}
