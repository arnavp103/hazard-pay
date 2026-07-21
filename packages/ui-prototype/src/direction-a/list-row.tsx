import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn.ts";

const statusGlyph = {
  running: { glyph: "▶", className: "text-accent" },
  blocked: { glyph: "▲", className: "text-warn" },
  closed: { glyph: "■", className: "text-ink-dim" },
} as const;

export interface ListRowProps extends HTMLAttributes<HTMLLIElement> {
  status: keyof typeof statusGlyph;
  /** Mono identifier, e.g. a lane id "LN-0F3A". */
  id: string;
  title: string;
  /** Secondary mono line, e.g. "wake 18 · VEX-7". */
  meta?: string;
  /** Right-aligned slot, e.g. a wake count or chevron. */
  trailing?: ReactNode;
}

export function ListRow({ status, id, title, meta, trailing, className, ...props }: ListRowProps) {
  const s = statusGlyph[status];
  return (
    <li
      className={cn(
        "grid cursor-pointer grid-cols-[1rem_auto_1fr_auto] items-baseline gap-x-3 border-b border-line px-4 py-2.5 transition-colors duration-75 last:border-b-0 hover:bg-panel-2 hover:shadow-[inset_2px_0_0_var(--hp-accent)]",
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("text-[9px]", s.className)}>{s.glyph}</span>
      <span className="font-data text-[11px] text-ink-dim tabular-nums">{id}</span>
      <span className={cn("truncate font-data text-[13px]", status === "closed" ? "text-ink-dim" : "text-ink")}>
        {title}
      </span>
      <span className="text-right font-data text-[11px] text-ink-dim tabular-nums">{trailing}</span>
      {meta !== undefined && (
        <span className="col-start-3 truncate font-data text-[10px] tracking-[0.08em] text-ink-dim/80 uppercase">
          {meta}
        </span>
      )}
    </li>
  );
}

export function ListRowGroup({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex flex-col", className)} {...props} />;
}
