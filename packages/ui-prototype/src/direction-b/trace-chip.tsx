import { useState } from "react";

import { cn } from "../lib/cn.ts";

/**
 * Lane-event chip for the admin lane viewer (#24 scope rider): summary by
 * default, one event deep-dives to its payload at a time. Click toggles.
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
  /** Expandable payload (deep-dive view), rendered as a mono block. */
  payload?: string;
  defaultExpanded?: boolean;
  className?: string;
}

export function TraceChip({ kind, summary, seq, payload, defaultExpanded = false, className }: TraceChipProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const k = kindStyle[kind];
  return (
    <div
      className={cn(
        "border-2 border-line bg-panel-2 font-data",
        payload !== undefined && "cursor-pointer hover:border-line-2",
        className,
      )}
      onClick={payload !== undefined ? () => setExpanded((v) => !v) : undefined}
    >
      <div className="flex items-center gap-2.5 px-2.5 py-1.5">
        <span className="text-[10px] text-ink-dim/70 tabular-nums">{seq}</span>
        <span className={cn("hpb-clip shrink-0 px-1.5 py-px font-display text-[11px] font-bold tracking-[0.12em]", k.className)}>
          {k.tag}
        </span>
        <span className="truncate text-[11px] text-ink">{summary}</span>
      </div>
      {payload !== undefined && expanded && (
        <pre className="hp-anim-stamp overflow-x-auto border-t-2 border-dashed border-line bg-shell px-2.5 py-2 text-[10px] leading-relaxed text-ink-dim">
          {payload}
        </pre>
      )}
    </div>
  );
}
