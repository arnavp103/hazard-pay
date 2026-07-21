import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import env from "@hazard-pay/env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { createDb } from "../client.ts";

export const TEMPLATE_DB = "hazard_pay_template";

/** Serializes template/clone DDL across vitest workers and worktrees. */
export const ADVISORY_LOCK_KEY = 727275;

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

/** Swaps the database name in a Postgres connection string. */
export function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** Connects to the maintenance database (whatever DATABASE_URL points at). */
export async function connectMaintenance(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Could not reach Postgres at ${env.DATABASE_URL} — is the dev instance running? `
      + "Fix: run `docker compose up -d` (or `pnpm db:up`) from the repo root.",
      { cause: error },
    );
  }
  return client;
}

async function migrationsHash(): Promise<string> {
  const hash = createHash("sha256");
  const entries = await readdir(MIGRATIONS_DIR, { recursive: true });
  for (const entry of [...entries].sort()) {
    if (!/\.(sql|json)$/.test(entry)) {
      continue;
    }
    hash.update(entry);
    hash.update(await readFile(join(MIGRATIONS_DIR, entry)));
  }
  return hash.digest("hex");
}

/**
 * Migrates the template database once per schema state. The migrations hash is
 * stored as the database comment; when it matches, the template is reused
 * untouched, so repeat test runs skip migration entirely.
 */
export async function ensureTemplateDatabase(): Promise<void> {
  const client = await connectMaintenance();
  try {
    const hash = await migrationsHash();
    await client.query("select pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    const existing = await client.query<{ comment: string | null }>(
      "select shobj_description(oid, 'pg_database') as comment from pg_database where datname = $1",
      [TEMPLATE_DB],
    );
    if (existing.rows[0]?.comment === hash) {
      return;
    }
    await client.query(`drop database if exists "${TEMPLATE_DB}" with (force)`);
    await client.query(`create database "${TEMPLATE_DB}"`);
    const template = createDb(withDatabase(env.DATABASE_URL, TEMPLATE_DB));
    try {
      await migrate(template.db, { migrationsFolder: MIGRATIONS_DIR });
    } finally {
      await template.close();
    }
    await client.query(`comment on database "${TEMPLATE_DB}" is '${hash}'`);
  } finally {
    await client.query("select pg_advisory_unlock_all()").catch(() => undefined);
    await client.end();
  }
}
