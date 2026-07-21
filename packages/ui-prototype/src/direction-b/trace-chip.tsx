import { cn } from "../lib/cn.ts";

/**
 * Lane-event chip for the admin lane viewer (#24 scope rider): summary by
 * default, one event deep-dives to its payload at a time.
 */

const kindStyle = {
  input: { tag: "IN", className: "bg-info text-shell" },
  model_turn: { tag: "TURN", className: "bg-accent text-shell" },
  tool_result: { tag: "TOOL", className: "bg-warn text-shell" },
  compaction: { tag: "FOLD", className: "bg-line-2 text-ink" },
} as const;

export interface TraceChipProps {
  kind: keyof typeof kindStyle;
  /** One-line summary of the lane event. */
  summary: string;
  /** Mono sequence marker, e.g. "0142". */
  seq: string;
  /** Expanded payload (deep-dive view), rendered as a mono block. */
  payload?: string;
  className?: string;
}

export function TraceChip({ kind, summary, seq, payload, className }: TraceChipProps) {
  const k = kindStyle[kind];
  return (
    <div className={cn("border-2 border-line bg-panel-2 font-data", className)}>
      <div className="flex items-center gap-2.5 px-2.5 py-1.5">
        <span className="text-[10px] text-ink-dim/70 tabular-nums">{seq}</span>
        <span className={cn("hpb-clip shrink-0 px-1.5 py-px font-display text-[11px] font-bold tracking-[0.12em]", k.className)}>
          {k.tag}
        </span>
        <span className="truncate text-[11px] text-ink">{summary}</span>
      </div>
      {payload !== undefined && (
        <pre className="overflow-x-auto border-t-2 border-dashed border-line bg-shell px-2.5 py-2 text-[10px] leading-relaxed text-ink-dim">
          {payload}
        </pre>
      )}
    </div>
  );
}
