import { emitEvent, withSpan } from "@hazard-pay/observability";
import { ResultAsync, errAsync, okAsync } from "neverthrow";

import { ENVELOPE_VERSION } from "./envelope.ts";
import { callModel, modelIdentity } from "./model-call.ts";
import {
  cancelLaneInputSchema,
  sendMessageInputSchema,
  spawnLaneInputSchema,
} from "./model-call.ts";
import { foldLaneEvents, hasPendingWork } from "./fold.ts";
import { requestFingerprint, verifyLaneFingerprints } from "./fingerprint.ts";
import { storeFailed } from "./errors.ts";
import {
  appendLaneEvent,
  claimWake,
  closeLane,
  ensureLeaderConfig,
  findForegroundLane,
  insertLane,
  loadLane,
  loadLaneEvents,
  nextSeq,
  releaseWake,
  restampLaneConfig,
} from "./store.ts";
import type { AgentError } from "./errors.ts";
import type { JsonValue } from "./envelope.ts";
import type { LaneSnapshot, Obligation } from "./fold.ts";
import type { DefinedLeader } from "./leader.ts";
import type { Db, DbLike, DbTx } from "@hazard-pay/db";
import type { Logger } from "@hazard-pay/observability";
import type { LanguageModel } from "ai";

/**
 * The runtime factory (issue #23's env/model seam): takes an AI SDK model
 * *instance* — it never reads `process.env`, never constructs a provider,
 * never sees an API key. Hosts (api worker, eval/smoke harnesses) construct
 * the provider at their own edge and inject the model here.
 */
export interface CreateRuntimeOptions {
  db: Db;
  model: LanguageModel;
  logger: Logger;
  /** The leader registry — git is the source of truth (ADR 0003 §3). */
  leaders: DefinedLeader[];
  /** AI SDK retry budget per model call (exponential backoff; 429s). */
  maxModelRetries?: number;
  /** A `waking` claim older than this is a corpse and may be reclaimed. */
  reclaimStaleWakeAfterMs?: number;
}

export interface WakeReport {
  laneId: string;
  /** Model turns taken this wake. */
  turns: number;
  toolExecutions: number;
  /** False when `maxTurnsPerWake` cut the wake short of quiescence. */
  quiescent: boolean;
  finalSeq: number;
  spawnedLaneIds: string[];
  messagedLaneIds: string[];
}

export interface Runtime {
  /** Create a lane for a registered leader. Missions come from `spawn_lane`. */
  createLane: (args: {
    leader: string;
    kind?: "foreground" | "mission";
    parentLaneId?: string;
  }) => ResultAsync<{ laneId: string; configHash: string }, AgentError>;
  /**
   * Idempotent boot-time handle on a leader's single foreground lane
   * (issue #52): returns the existing lane or creates it. If the leader's
   * config changed since the lane was stamped, the lane is re-stamped to the
   * current hash — the foreground lane carries the persona's continuity
   * across config edits (each `model_turn` records the hash it actually ran
   * under, so fingerprint verification survives the restamp).
   */
  ensureForegroundLane: (args: {
    leader: string;
  }) => ResultAsync<{ laneId: string; configHash: string; created: boolean }, AgentError>;
  /**
   * Append an input lane event — the log doubles as the lane's inbox
   * (ADR 0003 §4): external writers append input-type events only.
   * Pass `tx` to ride an already-open transaction (the outbox pattern:
   * the input commits atomically with its cause, e.g. the tick write);
   * without it the append runs in its own transaction.
   */
  appendInput: (args: {
    laneId: string;
    author: string;
    content: string;
    data?: JsonValue;
    tx?: DbTx;
  }) => ResultAsync<{ seq: number }, AgentError>;
  /**
   * One activation of a lane (CONTEXT.md: Wake): guarded claim, fold,
   * discharge unresolved obligations, batch pending inputs into model turns
   * until quiescence under the leader's `maxTurnsPerWake`, release.
   */
  wake: (args: { laneId: string }) => ResultAsync<WakeReport, AgentError>;
  /** The exported fold — the same one the loop uses (ADR 0003 §7). */
  foldLane: (args: { laneId: string }) => ResultAsync<LaneSnapshot, AgentError>;
  /** Replays the log, recomputing every model turn's request fingerprint. */
  verifyFingerprints: (args: {
    laneId: string;
  }) => ResultAsync<{ verified: number }, AgentError>;
}

/** Carries a domain error out of a Drizzle transaction callback as a throw. */
class TxRollback extends Error {
  constructor(readonly agentError: AgentError) {
    super(`transaction rolled back: ${agentError.tag}`);
  }
}

/** Carries a leader tool's `err()` out of its savepoint. */
class ToolRollback extends Error {
  constructor(readonly toolError: { tag: string; detail?: JsonValue }) {
    super(`tool rolled back: ${toolError.tag}`);
  }
}

/**
 * Bridges a `ResultAsync` into Drizzle's throw-to-rollback contract: an err
 * becomes a `TxRollback` throw that aborts the enclosing transaction, and
 * `inTransaction` converts it back into the tagged error — the throw never
 * escapes an adapter (ADR 0002 §4).
 */
async function unwrapOrRollback<T>(result: ResultAsync<T, AgentError>): Promise<T> {
  const awaited = await result;
  if (awaited.isErr()) {
    throw new TxRollback(awaited.error);
  }
  return awaited.value;
}

function inTransaction<T>(
  db: Db,
  op: string,
  fn: (tx: DbTx) => Promise<T>,
): ResultAsync<T, AgentError> {
  return ResultAsync.fromPromise(db.transaction(fn), (cause) =>
    cause instanceof TxRollback ? cause.agentError : storeFailed(op)(cause));
}

export function createRuntime(options: CreateRuntimeOptions): Runtime {
  const { db, model, logger } = options;
  const maxModelRetries = options.maxModelRetries ?? 2;
  const reclaimStaleWakeAfterMs = options.reclaimStaleWakeAfterMs ?? 5 * 60 * 1000;
  const identity = modelIdentity(model);

  const leaders = new Map<string, DefinedLeader>();
  for (const leader of options.leaders) {
    if (leaders.has(leader.name)) {
      // Like defineLeader's validation, a colliding registry is a defect in
      // reviewed boot code (git is the source of truth for leaders), caught
      // at process start — not a runtime condition. Throwing is deliberate.
      throw new Error(`duplicate leader name "${leader.name}"`);
    }
    leaders.set(leader.name, leader);
  }

  function resolveLeader(name: string): ResultAsync<DefinedLeader, AgentError> {
    const leader = leaders.get(name);
    return leader === undefined
      ? errAsync({ tag: "UnknownLeader", leaderName: name })
      : okAsync(leader);
  }

  const createLane: Runtime["createLane"] = (args) =>
    resolveLeader(args.leader).andThen((leader) =>
      inTransaction(db, "createLane", async (tx) => {
        await unwrapOrRollback(ensureLeaderConfig(tx, { hash: leader.configHash, config: leader.config }));
        const row = await unwrapOrRollback(
          insertLane(tx, {
            kind: args.kind ?? "foreground",
            leaderName: leader.name,
            configHash: leader.configHash,
            parentLaneId: args.parentLaneId,
          }),
        );
        return { laneId: row.id, configHash: row.configHash };
      }).map((created) => {
        emitEvent("lane.created", {
          laneId: created.laneId,
          leader: leader.name,
          kind: args.kind ?? "foreground",
          configHash: created.configHash,
        });
        return created;
      }));

  const ensureForegroundLane: Runtime["ensureForegroundLane"] = (args) =>
    resolveLeader(args.leader).andThen((leader) =>
      inTransaction(db, "ensureForegroundLane", async (tx) => {
        await unwrapOrRollback(ensureLeaderConfig(tx, { hash: leader.configHash, config: leader.config }));
        const existing = await unwrapOrRollback(findForegroundLane(tx, leader.name));
        if (existing !== null) {
          if (existing.configHash !== leader.configHash) {
            await unwrapOrRollback(
              restampLaneConfig(tx, { laneId: existing.id, configHash: leader.configHash }),
            );
          }
          return { laneId: existing.id, configHash: leader.configHash, created: false };
        }
        const row = await unwrapOrRollback(
          insertLane(tx, {
            kind: "foreground",
            leaderName: leader.name,
            configHash: leader.configHash,
          }),
        );
        return { laneId: row.id, configHash: row.configHash, created: true };
      })
        // Two hosts booting at once both miss the select and race the insert;
        // the partial unique index makes the loser's insert a
        // ForegroundLaneExists — resolve it by reading the winner's lane.
        .orElse((error) =>
          error.tag === "ForegroundLaneExists"
            ? findForegroundLane(db, leader.name).andThen((row) =>
                row === null
                  ? errAsync<never, AgentError>(error)
                  : okAsync({ laneId: row.id, configHash: row.configHash, created: false }))
            : errAsync<never, AgentError>(error))
        .map((ensured) => {
          if (ensured.created) {
            emitEvent("lane.created", {
              laneId: ensured.laneId,
              leader: leader.name,
              kind: "foreground",
              configHash: ensured.configHash,
            });
          }
          return ensured;
        }));

  /**
   * The append body, over either the pool handle or a caller's open
   * transaction. Status is checked in the same context as the append so a
   * concurrent cancel_lane cannot slip an input into a just-closed lane.
   */
  const appendInputTo = (
    dbLike: DbLike,
    args: { laneId: string; author: string; content: string; data?: JsonValue },
  ): ResultAsync<{ seq: number }, AgentError> =>
    loadLane(dbLike, args.laneId).andThen((row) =>
      row.status === "closed"
        ? errAsync<{ seq: number }, AgentError>({ tag: "LaneClosed", laneId: args.laneId })
        : nextSeq(dbLike, args.laneId).andThen((seq) =>
            appendLaneEvent(dbLike, {
              laneId: args.laneId,
              seq,
              author: args.author,
              type: "input",
              payload: {
                v: ENVELOPE_VERSION,
                kind: "input",
                content: args.content,
                ...(args.data === undefined ? {} : { data: args.data }),
              },
            }).map(() => ({ seq }))));

  const appendInput: Runtime["appendInput"] = (args) =>
    args.tx !== undefined
      // Outbox mode: the caller owns the transaction; an err here leaves the
      // caller to abort (their commit must not outlive a failed append).
      ? appendInputTo(args.tx, args)
      : inTransaction(db, "appendInput", (tx) => unwrapOrRollback(appendInputTo(tx, args)));

  /**
   * Discharges one obligation: executes the tool and commits its effects
   * with the `tool_result` lane event in ONE transaction (ADR 0003 §2).
   * Recoverable failures (unknown tool, invalid input, a tool's `err()`)
   * still discharge — recorded as `isError` results, with the `err()` case
   * rolling back the tool's own writes via a savepoint. Only a thrown
   * defect or infrastructure failure leaves the obligation open.
   */
  function dischargeObligation(args: {
    laneId: string;
    leader: DefinedLeader;
    obligation: Obligation;
    log: Logger;
    report: { spawnedLaneIds: string[]; messagedLaneIds: string[] };
  }): ResultAsync<void, AgentError> {
    const { obligation, leader, log } = args;
    const laneId = args.laneId;

    const appendToolResult = async (
      tx: DbTx,
      output: JsonValue,
      isError: boolean,
    ): Promise<void> => {
      const seq = await unwrapOrRollback(nextSeq(tx, laneId));
      await unwrapOrRollback(
        appendLaneEvent(tx, {
          laneId,
          seq,
          author: "loop",
          type: "tool_result",
          payload: {
            v: ENVELOPE_VERSION,
            kind: "tool_result",
            toolCallId: obligation.toolCallId,
            toolName: obligation.toolName,
            output,
            isError,
          },
        }),
      );
    };

    return withSpan(
      "lane.tool",
      () =>
        inTransaction(db, `tool:${obligation.toolName}`, async (tx) => {
          if (obligation.toolName === "spawn_lane") {
            const input = spawnLaneInputSchema.safeParse(obligation.input);
            if (!input.success) {
              await appendToolResult(tx, { tag: "invalid_input" }, true);
              return;
            }
            const child = leaders.get(input.data.leader);
            if (child === undefined) {
              await appendToolResult(tx, { tag: "unknown_leader" }, true);
              return;
            }
            await unwrapOrRollback(ensureLeaderConfig(tx, { hash: child.configHash, config: child.config }));
            const childLane = await unwrapOrRollback(
              insertLane(tx, {
                kind: "mission",
                leaderName: child.name,
                configHash: child.configHash,
                parentLaneId: laneId,
              }),
            );
            await unwrapOrRollback(
              appendLaneEvent(tx, {
                laneId: childLane.id,
                seq: 1,
                author: laneId,
                type: "input",
                payload: { v: ENVELOPE_VERSION, kind: "input", content: input.data.input },
              }),
            );
            await appendToolResult(tx, { spawned: true, laneId: childLane.id }, false);
            args.report.spawnedLaneIds.push(childLane.id);
            emitEvent("mission.spawned", {
              laneId: childLane.id,
              parentLaneId: laneId,
              leader: child.name,
            });
            return;
          }

          if (obligation.toolName === "send_message") {
            const input = sendMessageInputSchema.safeParse(obligation.input);
            if (!input.success) {
              await appendToolResult(tx, { tag: "invalid_input" }, true);
              return;
            }
            const target = await loadLane(tx, input.data.laneId);
            if (target.isErr() || target.value.status === "closed") {
              await appendToolResult(tx, { tag: "lane_unavailable" }, true);
              return;
            }
            const targetSeq = await unwrapOrRollback(nextSeq(tx, target.value.id));
            await unwrapOrRollback(
              appendLaneEvent(tx, {
                laneId: target.value.id,
                seq: targetSeq,
                author: laneId,
                type: "input",
                payload: { v: ENVELOPE_VERSION, kind: "input", content: input.data.content },
              }),
            );
            await appendToolResult(tx, { delivered: true, laneId: target.value.id }, false);
            args.report.messagedLaneIds.push(target.value.id);
            emitEvent("lane.message_sent", { fromLaneId: laneId, toLaneId: target.value.id });
            return;
          }

          if (obligation.toolName === "cancel_lane") {
            const input = cancelLaneInputSchema.safeParse(obligation.input);
            if (!input.success) {
              await appendToolResult(tx, { tag: "invalid_input" }, true);
              return;
            }
            const target = await loadLane(tx, input.data.laneId);
            if (target.isErr() || target.value.kind !== "mission") {
              await appendToolResult(tx, { tag: "not_a_mission" }, true);
              return;
            }
            await unwrapOrRollback(closeLane(tx, target.value.id));
            await appendToolResult(tx, { closed: true, laneId: target.value.id }, false);
            emitEvent("mission.cancelled", { laneId: target.value.id, byLaneId: laneId });
            return;
          }

          const definition = leader.tools[obligation.toolName];
          if (definition === undefined) {
            await appendToolResult(tx, { tag: "unknown_tool" }, true);
            return;
          }
          const input = definition.inputSchema.safeParse(obligation.input);
          if (!input.success) {
            await appendToolResult(tx, { tag: "invalid_input" }, true);
            return;
          }
          let output: JsonValue;
          let isError: boolean;
          try {
            // Savepoint: an err() from the tool rolls back the tool's game
            // writes but keeps the outer transaction (and the recorded
            // failure) alive. A throw is a defect and aborts everything.
            output = await tx.transaction(async (inner) => {
              const result = await definition.execute(
                { tx: inner, laneId, logger: log },
                input.data as never,
              );
              if (result.isErr()) {
                throw new ToolRollback(result.error);
              }
              return result.value;
            });
            isError = false;
          } catch (thrown) {
            if (!(thrown instanceof ToolRollback)) {
              throw thrown;
            }
            output = {
              tag: thrown.toolError.tag,
              ...(thrown.toolError.detail === undefined
                ? {}
                : { detail: thrown.toolError.detail }),
            };
            isError = true;
          }
          await appendToolResult(tx, output, isError);
        }),
      { "lane.id": laneId, "tool.name": obligation.toolName },
    );
  }

  const wake: Runtime["wake"] = (args) =>
    withSpan(
      "lane.wake",
      () => {
        const log = logger.child({ laneId: args.laneId });
        return loadLane(db, args.laneId)
          .andThen((row) =>
            row.status === "closed"
              ? errAsync<never, AgentError>({ tag: "LaneClosed", laneId: args.laneId })
              : resolveLeader(row.leaderName).andThen((leader) =>
                  leader.configHash === row.configHash
                    ? okAsync({ row, leader })
                    : errAsync<never, AgentError>({
                        tag: "ConfigDrift",
                        laneId: args.laneId,
                        expected: row.configHash,
                        actual: leader.configHash,
                      })))
          .andThen(({ row, leader }) =>
            claimWake(db, {
              laneId: args.laneId,
              staleAfterMs: reclaimStaleWakeAfterMs,
              // Also the claim token: releaseWake only frees THIS claim, so
              // a slow wake that gets reclaimed cannot release the
              // reclaimer's claim.
              claimedAt: new Date(),
            }).map((claimed) => ({ row, leader, claimedAt: claimed.wokeAt ?? new Date() })))
          .andThen(({ leader, claimedAt }) => {
            const report: WakeReport = {
              laneId: args.laneId,
              turns: 0,
              toolExecutions: 0,
              quiescent: false,
              finalSeq: 0,
              spawnedLaneIds: [],
              messagedLaneIds: [],
            };

            const step = (): ResultAsync<WakeReport, AgentError> =>
              loadLaneEvents(db, args.laneId)
                .andThen((rows) => foldLaneEvents(args.laneId, rows))
                .andThen((snapshot) => {
                  report.finalSeq = snapshot.lastSeq;
                  if (snapshot.openObligations.length > 0) {
                    const [obligation] = snapshot.openObligations;
                    report.toolExecutions += 1;
                    return dischargeObligation({
                      laneId: args.laneId,
                      leader,
                      obligation: obligation as Obligation,
                      log,
                      report,
                    }).andThen(step);
                  }
                  if (!hasPendingWork(snapshot)) {
                    report.quiescent = true;
                    return okAsync(report);
                  }
                  if (report.turns >= leader.maxTurnsPerWake) {
                    return okAsync(report);
                  }
                  const fingerprint = requestFingerprint({
                    configHash: leader.configHash,
                    provider: identity.provider,
                    modelId: identity.modelId,
                    messages: snapshot.messages,
                  });
                  return withSpan(
                    "lane.model_turn",
                    () =>
                      callModel({
                        model,
                        leader,
                        messages: snapshot.messages,
                        laneId: args.laneId,
                        maxRetries: maxModelRetries,
                      }),
                    { "lane.id": args.laneId, "model.fingerprint": fingerprint },
                  )
                    .andThen((turn) =>
                      appendLaneEvent(db, {
                        laneId: args.laneId,
                        seq: snapshot.lastSeq + 1,
                        author: "loop",
                        type: "model_turn",
                        payload: {
                          v: ENVELOPE_VERSION,
                          kind: "model_turn",
                          fingerprint,
                          configHash: leader.configHash,
                          model: identity,
                          content: turn.parts,
                          finishReason: turn.finishReason,
                          usage: turn.usage,
                        },
                      }))
                    .andThen(() => {
                      report.turns += 1;
                      return step();
                    });
                });

            // Past this point we hold the claim: release it on both the
            // quiescent path and the error path. (Before the claim, an error
            // must NOT release — that would free someone else's claim.)
            return step()
              .andThen((finished) =>
                releaseWake(db, { laneId: args.laneId, claimedAt }).map(() => {
                  emitEvent("lane.woke", {
                    laneId: args.laneId,
                    turns: finished.turns,
                    toolExecutions: finished.toolExecutions,
                    quiescent: finished.quiescent,
                    finalSeq: finished.finalSeq,
                  });
                  return finished;
                }))
              .orElse((error) =>
                releaseWake(db, { laneId: args.laneId, claimedAt }).andThen(() =>
                  errAsync<WakeReport, AgentError>(error)));
          });
      },
      { "lane.id": args.laneId },
    );

  const foldLane: Runtime["foldLane"] = (args) =>
    loadLaneEvents(db, args.laneId).andThen((rows) => foldLaneEvents(args.laneId, rows));

  const verifyFingerprints: Runtime["verifyFingerprints"] = (args) =>
    loadLane(db, args.laneId).andThen((row) =>
      loadLaneEvents(db, args.laneId).andThen((rows) =>
        verifyLaneFingerprints(args.laneId, row.configHash, rows)));

  return { createLane, ensureForegroundLane, appendInput, wake, foldLane, verifyFingerprints };
}
