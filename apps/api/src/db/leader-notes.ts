import { leaderNote } from "@hazard-pay/db";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

import type { DbLike } from "@hazard-pay/db";
import type { DbUnreachableError } from "../domain/errors.ts";
import { toDbUnreachable } from "./unreachable.ts";

/**
 * The honest leader game write (issue #52): one `leader_note` row —
 * a short in-world note linked to the lane that produced it. Leader tools
 * call this with their open tool transaction, so the note commits with the
 * `tool_result` lane event (ADR 0003 §2); the tick table is never a leader
 * write target.
 */
export function insertLeaderNote(
  db: DbLike,
  args: { laneId: string; leaderName: string; content: string },
): ResultAsync<{ id: number }, DbUnreachableError> {
  return ResultAsync.fromPromise(
    db.insert(leaderNote).values(args).returning({ id: leaderNote.id }),
    toDbUnreachable,
  ).andThen(([row]) =>
    // `returning()` yielding no row is driver-level impossibility — surface
    // it, never fabricate an id the model would then be told about.
    row === undefined
      ? errAsync<{ id: number }, DbUnreachableError>({
          type: "db_unreachable",
          message: "leader_note insert returned no row",
        })
      : okAsync({ id: row.id }));
}
