import { builtinToolReceipt, type LaneEventRecord } from "@hazard-pay/api/contract";
import { JsonInspector, StatusChip, TraceChip, type JsonLike } from "@hazard-pay/ui";
import { Link } from "@tanstack/react-router";

import { formatSeq, formatTime, summarizeLaneEvent } from "../lib/trace-format.ts";

/**
 * One lane event as a progressive-disclosure chip: envelope-aware summary
 * up front, the full payload one click away (#11 rider). The deep-dives
 * render the envelope's own shapes — model turn parts (reasoning included),
 * tool receipts, inputs — and cross-link lanes through the envelope's
 * typed `builtinToolReceipt` narrowing (CONTEXT.md: Receipt).
 */
export function LaneEventChip({ record }: { record: LaneEventRecord }) {
  return (
    <TraceChip
      kind={record.payload.kind}
      seq={formatSeq(record.seq)}
      summary={summarizeLaneEvent(record)}
      trailing={`${record.author} · ${formatTime(record.occurredAt)}`}
    >
      <LaneEventDetail record={record} />
    </TraceChip>
  );
}

function LaneEventDetail({ record }: { record: LaneEventRecord }) {
  const payload = record.payload;
  switch (payload.kind) {
    case "input":
      return (
        <div className="flex flex-col gap-2 py-1">
          <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-ink">{payload.content}</p>
          {payload.data !== undefined && (
            <JsonInspector value={payload.data} label="data" defaultOpenDepth={1} />
          )}
          <DetailMeta entries={[["author", record.author], ["occurred", record.occurredAt]]} />
        </div>
      );
    case "model_turn":
      return (
        <div className="flex flex-col gap-2 py-1">
          {payload.content.map((part, index) => {
            if (part.type === "reasoning") {
              return (
                <div key={index} className="border-l-4 border-line-2 pl-2.5">
                  <StatusChip tone="neutral" className="mb-1">reasoning</StatusChip>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-ink-dim italic">
                    {part.text}
                  </p>
                </div>
              );
            }
            if (part.type === "text") {
              return (
                <p key={index} className="text-[11px] leading-relaxed whitespace-pre-wrap text-ink">
                  {part.text}
                </p>
              );
            }
            return (
              <div key={index} className="border-l-4 border-warn/50 pl-2.5">
                <StatusChip tone="warn" className="mb-1">{`tool-call → ${part.toolName}`}</StatusChip>
                <JsonInspector value={part.input as JsonLike} label="input" defaultOpenDepth={1} />
              </div>
            );
          })}
          <DetailMeta entries={[
            ["model", `${payload.model.provider} / ${payload.model.modelId}`],
            ["finish", payload.finishReason],
            ["usage", formatUsage(payload.usage)],
            ["fingerprint", payload.fingerprint],
          ]}
          />
        </div>
      );
    case "tool_result": {
      const receipt = builtinToolReceipt(payload);
      return (
        <div className="flex flex-col gap-2 py-1">
          <JsonInspector value={payload.output as JsonLike} label="output" defaultOpenDepth={2} />
          {receipt !== null && (
            <Link
              to="/lanes/$laneId"
              params={{ laneId: receipt.laneId }}
              className="font-data text-[11px] font-bold tracking-[0.08em] text-accent uppercase underline decoration-dashed underline-offset-4 hover:text-accent-2"
            >
              {receipt.tool === "spawn_lane" ? "open spawned mission →" : "open linked lane →"}
            </Link>
          )}
          <DetailMeta entries={[
            ["tool", payload.toolName],
            ["call", payload.toolCallId],
            ["result", payload.isError ? "error" : "ok"],
          ]}
          />
        </div>
      );
    }
    case "compaction":
      return (
        <div className="flex flex-col gap-2 py-1">
          <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-ink">{payload.summary}</p>
        </div>
      );
  }
}

function DetailMeta({ entries }: { entries: [string, string][] }) {
  return (
    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t-2 border-dashed border-line pt-1.5">
      {entries.map(([term, value]) => (
        <div key={term} className="col-span-2 grid grid-cols-subgrid">
          <dt className="text-[10px] tracking-[0.08em] text-ink-dim uppercase">{term}</dt>
          <dd className="text-[10px] wrap-anywhere text-ink tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatUsage(usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number }): string {
  const format = (value: number | undefined): string => value === undefined ? "?" : String(value);
  return `${format(usage.inputTokens)} in · ${format(usage.outputTokens)} out · ${format(usage.totalTokens)} total`;
}
