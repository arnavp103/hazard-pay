import { useState } from "react";

import { cn } from "../lib/cn.ts";

/**
 * Lane-event chip for the admin lane viewer (#24 scope rider): summary by
 * default, one event deep-dives to its payload at a time. Click toggles.
 */

const kindStyle = {
  input: { tag: "in", className: "text-info" },
  model_turn: { tag: "turn", className: "text-accent-2" },
  tool_result: { tag: "tool", className: "text-accent" },
  compaction: { tag: "fold", className: "text-ink-dim" },
} as const;

export interface TraceChipProps {
  kind: keyof typeof kindStyle;
  /** One-line summary of the lane event. */
  summary: string;
  /** Mono sequence marker, e.g. "0142". */
  seq: string;
  /** Expandable payload (deep-dive view). */
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
        "rounded-md border border-line bg-panel-2/80 font-data",
        payload !== undefined && "cursor-pointer",
        className,
      )}
      onClick={payload !== undefined ? () => setExpanded((v) => !v) : undefined}
    >
      <div className="flex items-baseline gap-3 px-3 py-2">
        <span className="text-[10px] text-ink-dim/60 tabular-nums">{seq}</span>
        <span className={cn("w-8 shrink-0 text-[10px] tracking-[0.24em] uppercase", k.className)}>
          {k.tag}
        </span>
        <span className="truncate text-[11px] font-light text-ink">{summary}</span>
      </div>
      {payload !== undefined && expanded && (
        <pre className="hp-anim-slide-in overflow-x-auto rounded-b-md border-t border-line bg-shell/80 px-3 py-2.5 text-[10px] leading-relaxed font-light text-ink-dim">
          {payload}
        </pre>
      )}
    </div>
  );
}
