import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn.ts";
import { StatusChip, type StatusChipProps } from "./sticker.tsx";

const statusChip = {
  running: { text: "LIVE", tone: "acid" },
  blocked: { text: "HELD", tone: "warn" },
  closed: { text: "DONE", tone: "neutral" },
} as const satisfies Record<string, { text: string; tone: StatusChipProps["tone"] }>;

export interface ListRowProps extends HTMLAttributes<HTMLLIElement> {
  status: keyof typeof statusChip;
  /** Large ordinal, e.g. "01". */
  index: string;
  title: string;
  /** Secondary mono line, e.g. "lane LN-0F3A · wake 18". */
  meta?: string;
  /** Right-aligned slot under the status chip. */
  trailing?: ReactNode;
}

/** Mission/lane row: ordinal, title over mono meta, stamped status chip. */
export function ListRow({ status, index, title, meta, trailing, className, ...props }: ListRowProps) {
  const s = statusChip[status];
  return (
    <li
      className={cn(
        "grid cursor-pointer grid-cols-[2.5rem_1fr_auto] items-center gap-x-3 border-b-2 border-dashed border-line px-4 py-3 transition-transform duration-75 last:border-b-0 hover:translate-x-1 hover:bg-panel-2",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="font-display text-3xl leading-none font-extrabold text-ink-dim/40">
        {index}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={cn("truncate font-data text-sm font-bold", status === "closed" ? "text-ink-dim line-through decoration-1" : "text-ink")}>
          {title}
        </span>
        {meta !== undefined && (
          <span className="truncate font-data text-[10px] tracking-[0.04em] text-ink-dim">{meta}</span>
        )}
      </span>
      <span className="flex flex-col items-end gap-1">
        <StatusChip tone={s.tone}>{s.text}</StatusChip>
        {trailing !== undefined && (
          <span className="font-data text-[10px] text-ink-dim tabular-nums">{trailing}</span>
        )}
      </span>
    </li>
  );
}

export function ListRowGroup({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex flex-col", className)} {...props} />;
}
