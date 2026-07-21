import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn.ts";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** Serif title, mixed case — e.g. "Active missions". */
  title: string;
  /** Right-aligned mono metadata. */
  meta?: ReactNode;
  /** Live panels get a gold top sheen and a gold title diamond. */
  live?: boolean;
  /** Remove body padding (for flush list rows). */
  flush?: boolean;
}

export function Panel({ title, meta, live = false, flush = false, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-line bg-panel/90 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)] backdrop-blur-md",
        live && "hpc-sheen",
        className,
      )}
      {...props}
    >
      <header className="flex h-11 items-center justify-between gap-4 border-b border-line px-5">
        <h2 className="flex items-center gap-2.5 font-display text-[15px] font-medium text-ink">
          <span aria-hidden className={cn("text-[8px]", live ? "text-accent" : "text-ink-dim/60")}>◆</span>
          {title}
        </h2>
        {meta !== undefined && (
          <span className="font-data text-[10px] tracking-[0.2em] text-ink-dim uppercase">
            {meta}
          </span>
        )}
      </header>
      <div className={cn(!flush && "p-5")}>{children}</div>
    </section>
  );
}
