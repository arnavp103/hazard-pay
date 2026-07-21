import { Result, err, ok } from "neverthrow";

import { applyLaneEvent, emptySnapshot } from "./fold.ts";
import { contentHash } from "./hash.ts";
import { ENVELOPE_VERSION, modelTurnPayloadSchema } from "./envelope.ts";
import type { AgentError } from "./errors.ts";
import type { JsonValue } from "./envelope.ts";
import type { LaneEventRow } from "./store.ts";
import type { ModelMessage } from "ai";

/**
 * The request fingerprint stored on every `model_turn` (ADR 0003 §4/§5):
 * a content hash of everything that determines what the model was asked —
 * the leader config (system prompt + toolset, via its hash), the model
 * identity, and the folded messages. There is no request-side lane event;
 * the fingerprint is the proof that the fold reproduces the request.
 */
export function requestFingerprint(args: {
  configHash: string;
  provider: string;
  modelId: string;
  messages: ModelMessage[];
}): string {
  return contentHash({
    v: ENVELOPE_VERSION,
    configHash: args.configHash,
    provider: args.provider,
    modelId: args.modelId,
    messages: args.messages as unknown as JsonValue,
  });
}

/**
 * Replays a lane's log and recomputes each model turn's fingerprint from the
 * fold state just before it, comparing against the recorded one (ADR 0003
 * §5: fingerprints are verified in dev/CI). A mismatch means the fold no
 * longer reproduces what the model actually saw — determinism drift.
 */
export function verifyLaneFingerprints(
  laneId: string,
  configHash: string,
  rows: LaneEventRow[],
): Result<{ verified: number }, AgentError> {
  let snapshot = emptySnapshot(laneId);
  let verified = 0;
  for (const row of rows) {
    if (row.type === "model_turn") {
      const parsed = modelTurnPayloadSchema.safeParse(row.payload);
      if (!parsed.success) {
        return err({ tag: "EnvelopeInvalid", laneId, seq: row.seq, cause: parsed.error });
      }
      const expected = requestFingerprint({
        configHash,
        provider: parsed.data.model.provider,
        modelId: parsed.data.model.modelId,
        messages: snapshot.messages,
      });
      if (expected !== parsed.data.fingerprint) {
        return err({
          tag: "FingerprintMismatch",
          laneId,
          seq: row.seq,
          expected,
          actual: parsed.data.fingerprint,
        });
      }
      verified += 1;
    }
    const applied = applyLaneEvent(snapshot, row);
    if (applied.isErr()) {
      return err(applied.error);
    }
    snapshot = applied.value;
  }
  return ok({ verified });
}
