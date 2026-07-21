import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn.ts";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** Uppercase strip title, e.g. "Active missions". */
  title: string;
  /** Right-aligned mono metadata, e.g. "TICK 1,024". */
  meta?: ReactNode;
  /** Live panels get phosphor corner brackets and an accent title glyph. */
  live?: boolean;
  /** Remove body padding (for flush list rows). */
  flush?: boolean;
}

export function Panel({ title, meta, live = false, flush = false, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        "hpa-corners border border-line bg-panel",
        live && "hpa-corners-live",
        className,
      )}
      {...props}
    >
      <header className="flex h-9 items-center justify-between gap-4 border-b border-line px-4">
        <h2 className="flex items-center gap-2 font-display text-[11px] font-semibold tracking-[0.22em] text-ink uppercase">
          <span aria-hidden className={cn("size-1.5", live ? "bg-accent" : "bg-line-2")} />
          {title}
        </h2>
        {meta !== undefined && (
          <span className="font-data text-[10px] tracking-[0.14em] text-ink-dim uppercase">
            {meta}
          </span>
        )}
      </header>
      <div className={cn(!flush && "p-4")}>{children}</div>
    </section>
  );
}
