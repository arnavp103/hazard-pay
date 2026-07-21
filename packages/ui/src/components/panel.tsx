import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn.ts";
import { stickerVariants } from "./sticker.tsx";

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** Tag-label title, rendered as a taped-on sticker. */
  title: string;
  /** Right-aligned mono metadata, e.g. "tick 1,024". */
  meta?: ReactNode;
  /** Sticker tone: acid chartreuse (default) or hot magenta for live panels. */
  tone?: "acid" | "magenta";
  /** Remove body padding (for flush list rows). */
  flush?: boolean;
}

export function Panel({ title, meta, tone = "acid", flush = false, className, children, ...props }: PanelProps) {
  return (
    <section
      className={cn("hp-noise border-2 border-line bg-panel shadow-hard-lg", className)}
      {...props}
    >
      <header className="flex items-start justify-between gap-4 px-4 pt-3.5">
        <h2 className={stickerVariants({ tone })}>{title}</h2>
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
