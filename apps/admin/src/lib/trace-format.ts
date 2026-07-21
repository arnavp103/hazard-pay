import type { LaneEventRecord, LaneSummary } from "@hazard-pay/api/contract";

/**
 * Envelope-aware one-liners for the trace viewer: the summary a chip shows
 * before disclosure. This knowledge (which payload key means what) is
 * deliberately admin-local — `@hazard-pay/ui`'s trace components stay
 * payload-agnostic.
 */
export function summarizeLaneEvent(record: LaneEventRecord): string {
  const payload = record.payload;
  switch (payload.kind) {
    case "input":
      return truncate(payload.content, 96);
    case "model_turn": {
      const text = payload.content.find((part) => part.type === "text");
      if (text !== undefined) {
        return `${truncate(text.text, 80)} (${formatTokens(payload.usage.totalTokens)})`;
      }
      const calls = payload.content
        .filter((part) => part.type === "tool-call")
        .map((part) => part.toolName);
      return calls.length > 0
        ? `tool-call → ${calls.join(", ")} (${formatTokens(payload.usage.totalTokens)})`
        : `${payload.finishReason} (${formatTokens(payload.usage.totalTokens)})`;
    }
    case "tool_result":
      return `${payload.toolName} → ${payload.isError ? "error" : "ok"}`;
    case "compaction":
      return truncate(payload.summary, 96);
  }
}

/** The lane a tool receipt points at (spawn/send/cancel), if any. */
export function linkedLaneId(record: LaneEventRecord): string | null {
  const payload = record.payload;
  if (payload.kind !== "tool_result" || payload.isError) {
    return null;
  }
  const output = payload.output;
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    return null;
  }
  const laneId = output.laneId;
  return typeof laneId === "string" ? laneId : null;
}

export function laneTitle(lane: LaneSummary): string {
  return `${lane.leaderName} — ${lane.kind === "foreground" ? "foreground lane" : "mission"}`;
}

export function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function formatSeq(seq: number): string {
  return String(seq).padStart(4, "0");
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false });
}

export function formatTokens(total: number | undefined): string {
  if (total === undefined) {
    return "? tok";
  }
  return total >= 1000 ? `${(total / 1000).toFixed(1)}k tok` : `${String(total)} tok`;
}

function truncate(text: string, max: number): string {
  const oneLine = text.replaceAll(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}
