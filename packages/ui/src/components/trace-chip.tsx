import { useState } from "react";

import { cn } from "../lib/cn.ts";
import { StatusChip } from "./sticker.tsx";

/**
 * Lane-event chip: summary line by default, expandable to the payload.
 * Kinds mirror the lane-event vocabulary (CONTEXT.md): input, model turn,
 * tool result, compaction.
 */

const kindStyle = {
  input: { tag: "IN", tone: "info" },
  model_turn: { tag: "TURN", tone: "magenta" },
  tool_result: { tag: "TOOL", tone: "warn" },
  compaction: { tag: "FOLD", tone: "neutral" },
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
  const style = kindStyle[kind];
  const header = (
    <>
      <span className="text-[10px] text-ink-dim/70 tabular-nums">{seq}</span>
      <StatusChip tone={style.tone} className="shrink-0 px-1.5 tracking-[0.12em]">{style.tag}</StatusChip>
      <span className="truncate text-[11px] text-ink">{summary}</span>
    </>
  );
  return (
    <div className={cn("border-2 border-line bg-panel-2 font-data", className)}>
      {payload === undefined
        ? (
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">{header}</div>
          )
        : (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-left outline-none hover:bg-panel focus-visible:ring-2 focus-visible:ring-info"
            >
              {header}
            </button>
          )}
      {payload !== undefined && expanded && (
        <pre className="hp-anim-stamp overflow-x-auto border-t-2 border-dashed border-line bg-shell px-2.5 py-2 text-[10px] leading-relaxed text-ink-dim">
          {payload}
        </pre>
      )}
    </div>
  );
}
