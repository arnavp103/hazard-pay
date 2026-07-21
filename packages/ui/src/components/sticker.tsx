import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../lib/cn.ts";

/**
 * Taped-on label vocabulary: `Sticker` is the large rotated tag (panel
 * titles, section headers); `StatusChip` is the small stamp (list rows,
 * inline status). Both clip the top-right corner.
 */

export const stickerVariants = cva(
  "hp-clip inline-block px-2.5 py-0.5 font-display text-base leading-6 font-bold tracking-[0.1em] uppercase",
  {
    variants: {
      tone: {
        acid: "bg-accent-2 text-shell",
        magenta: "bg-accent text-shell",
        warn: "bg-warn text-shell",
        neutral: "bg-panel-2 text-ink-dim",
      },
      rotated: {
        true: "-rotate-1",
        false: "",
      },
    },
    defaultVariants: {
      tone: "acid",
      rotated: true,
    },
  },
);

export type StickerProps
  = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof stickerVariants>;

export function Sticker({ className, tone, rotated, ...props }: StickerProps) {
  return (
    <span className={cn(stickerVariants({ tone, rotated }), className)} {...props} />
  );
}

export const statusChipVariants = cva(
  "hp-clip inline-block px-1.5 py-px font-display text-[11px] font-bold tracking-[0.14em] uppercase",
  {
    variants: {
      tone: {
        acid: "bg-accent-2 text-shell",
        magenta: "bg-accent text-shell",
        warn: "bg-warn text-shell",
        danger: "bg-danger text-shell",
        info: "bg-info text-shell",
        neutral: "bg-panel-2 text-ink-dim",
      },
      /** Stamp-in on mount (hp-stamp keyframes). */
      stamped: {
        true: "hp-anim-stamp",
        false: "",
      },
    },
    defaultVariants: {
      tone: "neutral",
      stamped: false,
    },
  },
);

export type StatusChipProps
  = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof statusChipVariants>;

export function StatusChip({ className, tone, stamped, ...props }: StatusChipProps) {
  return (
    <span className={cn(statusChipVariants({ tone, stamped }), className)} {...props} />
  );
}
