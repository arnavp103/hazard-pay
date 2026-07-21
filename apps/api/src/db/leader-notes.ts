import { leaderNote } from "@hazard-pay/db";
import { ResultAsync } from "neverthrow";

import type { DbLike } from "@hazard-pay/agent";
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
  ).map(([row]) => ({ id: row?.id ?? 0 }));
}
