import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn.ts";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 border font-display uppercase transition-colors duration-100 outline-none select-none focus-visible:ring-1 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-shell disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "border-accent bg-accent font-semibold text-shell hover:bg-accent/85",
        ghost: "border-line-2 bg-transparent text-ink hover:border-accent hover:text-accent",
        danger: "border-danger/60 bg-transparent text-danger hover:bg-danger/10",
      },
      size: {
        sm: "h-7 px-3 text-[11px] tracking-[0.14em]",
        md: "h-9 px-5 text-xs tracking-[0.18em]",
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
