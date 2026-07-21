import { useState } from "react";

import { cn } from "../lib/cn.ts";

/**
 * Collapsible payload inspector: renders a JSON-shaped value as a dense mono
 * tree with per-node disclosure — the deep-dive half of the trace family's
 * progressive disclosure (#11 rider: one lane event at a time, never a wall
 * of raw JSON). Objects and arrays collapse to a `{…} 3 keys` preview;
 * primitives are tinted by type. Payload-agnostic on purpose: envelope
 * semantics (which key means what) belong to the consuming surface.
 */

export type JsonLike
  = | string
    | number
    | boolean
    | null
    | JsonLike[]
    | { [key: string]: JsonLike };

export interface JsonInspectorProps {
  value: JsonLike;
  /** Optional root label, e.g. the payload field being inspected. */
  label?: string;
  /** Nesting depth auto-expanded on mount; the root is depth 0. Default 1. */
  defaultOpenDepth?: number;
  className?: string;
}

export function JsonInspector({ value, label, defaultOpenDepth = 1, className }: JsonInspectorProps) {
  return (
    <div className={cn("font-data text-[10px] leading-relaxed", className)}>
      <JsonNode name={label} value={value} depth={0} defaultOpenDepth={defaultOpenDepth} />
    </div>
  );
}

function JsonNode({ name, value, depth, defaultOpenDepth }: {
  name: string | undefined;
  value: JsonLike;
  depth: number;
  defaultOpenDepth: number;
}) {
  const [open, setOpen] = useState(depth < defaultOpenDepth);

  if (value === null || typeof value !== "object") {
    return (
      <div className="flex items-baseline gap-1.5 py-px">
        {name !== undefined && (
          <span className="shrink-0 text-ink-dim">
            {name}
            :
          </span>
        )}
        <JsonLeaf value={value} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries: [string, JsonLike][] = isArray
    ? value.map((item, index): [string, JsonLike] => [String(index), item])
    : Object.entries(value);
  const preview = isArray
    ? `[…] ${entries.length} item${entries.length === 1 ? "" : "s"}`
    : `{…} ${entries.length} key${entries.length === 1 ? "" : "s"}`;

  if (entries.length === 0) {
    return (
      <div className="flex items-baseline gap-1.5 py-px">
        {name !== undefined && (
          <span className="shrink-0 text-ink-dim">
            {name}
            :
          </span>
        )}
        <span className="text-ink-dim">{isArray ? "[]" : "{}"}</span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-baseline gap-1.5 py-px text-left outline-none hover:bg-panel-2 focus-visible:ring-2 focus-visible:ring-info"
      >
        <span aria-hidden className="w-2 shrink-0 font-bold text-ink-dim">{open ? "−" : "+"}</span>
        {name !== undefined && (
          <span className="shrink-0 text-ink-dim">
            {name}
            :
          </span>
        )}
        {!open && <span className="text-ink-dim/70">{preview}</span>}
        {open && <span className="text-ink-dim/70">{isArray ? "[" : "{"}</span>}
      </button>
      {open && (
        <div className="ml-1 border-l-2 border-dashed border-line pl-3">
          {entries.map(([key, child]) => (
            <JsonNode
              key={key}
              name={key}
              value={child}
              depth={depth + 1}
              defaultOpenDepth={defaultOpenDepth}
            />
          ))}
        </div>
      )}
      {open && <span aria-hidden className="ml-3 text-ink-dim/70">{isArray ? "]" : "}"}</span>}
    </div>
  );
}

function JsonLeaf({ value }: { value: string | number | boolean | null }) {
  if (value === null) {
    return <span className="text-ink-dim italic">null</span>;
  }
  if (typeof value === "string") {
    return (
      <span className="wrap-anywhere whitespace-pre-wrap text-ink">
        &quot;
        {value}
        &quot;
      </span>
    );
  }
  if (typeof value === "number") {
    return <span className="text-info tabular-nums">{String(value)}</span>;
  }
  return <span className="text-warn">{String(value)}</span>;
}
