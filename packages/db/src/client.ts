import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as agentSchema from "./agent-schema.ts";
import * as authSchema from "./auth-schema.ts";
import * as schema from "./schema.ts";

const fullSchema = { ...agentSchema, ...authSchema, ...schema };

export type Db = NodePgDatabase<typeof fullSchema>;

/** The transaction handle Drizzle passes to `db.transaction` callbacks. */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Both the pool-backed `Db` and an open transaction satisfy the query API —
 * the parameter type for query helpers that run either standalone or inside
 * a caller's transaction (e.g. a leader tool's open tool transaction).
 */
export type DbLike = Db | DbTx;

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
  const db = drizzle(pool, { schema: fullSchema });
  return { db, close: () => pool.end() };
}
