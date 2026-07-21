import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn.ts";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border font-data uppercase transition-all duration-200 outline-none select-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-shell disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "hpc-shimmer border-accent bg-accent font-medium text-shell hover:brightness-110",
        ghost: "border-line-2/50 bg-transparent text-ink hover:border-accent hover:text-accent",
        danger: "border-danger/50 bg-transparent text-danger hover:border-danger hover:bg-danger/10",
      },
      size: {
        sm: "h-7 px-4 text-[10px] tracking-[0.22em]",
        md: "h-9 px-6 text-[11px] tracking-[0.26em]",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
);

export type ButtonProps
  = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
