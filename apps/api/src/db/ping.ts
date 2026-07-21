import type { Db } from "@hazard-pay/db";
import { sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { DbUnreachableError } from "../domain/errors.ts";
import { toDbUnreachable } from "./unreachable.ts";

/** One real round-trip through the pool — the health route's proof (#15). */
export function pingDb(db: Db): ResultAsync<void, DbUnreachableError> {
  return ResultAsync.fromPromise(db.execute(sql`select 1`), toDbUnreachable).map(() => undefined);
}
