import { useState, type ReactNode } from "react";

import { cn } from "../lib/cn.ts";
import { StatusChip } from "./sticker.tsx";

/**
 * Lane-event chip: summary line by default, expandable to a deep-dive —
 * progressive disclosure per the #11 design rider (never a wall of raw
 * JSON). Kinds mirror the lane-event vocabulary (CONTEXT.md): input, model
 * turn, tool result, compaction. The deep-dive is either a mono `payload`
 * string or structured `children` (e.g. a `JsonInspector`); children win
 * when both are given.
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
  /** Right-aligned dim metadata, e.g. author · timestamp. */
  trailing?: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  /** Structured deep-dive content; takes precedence over `payload`. */
  children?: ReactNode;
}

export function TraceChip({
  kind,
  summary,
  seq,
  payload,
  trailing,
  defaultExpanded = false,
  className,
  children,
}: TraceChipProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const style = kindStyle[kind];
  const expandable = children !== undefined || payload !== undefined;
  const header = (
    <>
      <span className="text-[10px] text-ink-dim/70 tabular-nums">{seq}</span>
      <StatusChip tone={style.tone} className="shrink-0 px-1.5 tracking-[0.12em]">{style.tag}</StatusChip>
      <span className="truncate text-[11px] text-ink">{summary}</span>
      {trailing !== undefined && (
        <span className="ml-auto shrink-0 pl-2 text-[10px] text-ink-dim">{trailing}</span>
      )}
    </>
  );
  return (
    <div className={cn("border-2 border-line bg-panel-2 font-data", className)}>
      {expandable
        ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full cursor-pointer items-center gap-2.5 px-2.5 py-1.5 text-left outline-none hover:bg-panel focus-visible:ring-2 focus-visible:ring-info"
            >
              {header}
              <span
                aria-hidden
                className={cn(
                  "shrink-0 text-[11px] font-bold text-ink-dim",
                  trailing === undefined && "ml-auto",
                )}
              >
                {expanded ? "−" : "+"}
              </span>
            </button>
          )
        : (
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">{header}</div>
          )}
      {expandable && expanded && (
        children !== undefined
          ? (
              <div className="hp-anim-stamp overflow-x-auto border-t-2 border-dashed border-line bg-shell px-2.5 py-2">
                {children}
              </div>
            )
          : (
              <pre className="hp-anim-stamp overflow-x-auto border-t-2 border-dashed border-line bg-shell px-2.5 py-2 text-[10px] leading-relaxed text-ink-dim">
                {payload}
              </pre>
            )
      )}
    </div>
  );
}
