import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn.ts";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 border-2 font-display font-bold uppercase transition-all duration-75 outline-none select-none focus-visible:ring-2 focus-visible:ring-info active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "border-accent-2 bg-accent-2 text-shell shadow-hard-accent hover:brightness-110",
        ghost: "border-accent bg-transparent text-accent shadow-hard hover:bg-accent/15",
        danger: "border-danger bg-danger/15 text-danger shadow-hard hover:bg-danger/30",
      },
      size: {
        sm: "h-8 px-3 text-sm tracking-[0.1em]",
        md: "h-10 px-5 text-base tracking-[0.12em]",
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
