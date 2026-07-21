import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn.ts";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** Tag-label title, rendered as a taped-on sticker. */
  title: string;
  /** Right-aligned mono metadata. */
  meta?: ReactNode;
  /** Sticker color: acid chartreuse (default) or hot magenta for live panels. */
  tone?: "acid" | "magenta";
  /** Remove body padding (for flush list rows). */
  flush?: boolean;
}

export function Panel({ title, meta, tone = "acid", flush = false, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        "hpb-noise border-2 border-line bg-panel shadow-[8px_8px_0_0_rgba(0,0,0,0.55)]",
        className,
      )}
      {...props}
    >
      <header className="flex items-start justify-between gap-4 px-4 pt-3.5">
        <h2
          className={cn(
            "hpb-clip inline-block -rotate-1 px-2.5 py-0.5 font-display text-base leading-6 font-bold tracking-[0.1em] text-shell uppercase",
            tone === "acid" ? "bg-accent-2" : "bg-accent",
          )}
        >
          {title}
        </h2>
        {meta !== undefined && (
          <span className="pt-1 font-data text-[10px] tracking-[0.06em] text-ink-dim uppercase">
            {meta}
          </span>
        )}
      </header>
      <div className={cn(flush ? "pt-3" : "p-4")}>{children}</div>
    </section>
  );
}
