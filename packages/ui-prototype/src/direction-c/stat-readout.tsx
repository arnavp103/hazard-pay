import { Meter } from "@base-ui-components/react/meter";

import { cn } from "../lib/cn.ts";

const meterTone = {
  accent: "bg-accent",
  warn: "bg-warn",
  danger: "bg-danger",
} as const;

const deltaTone = {
  ok: "text-accent",
  bad: "text-danger",
} as const;

export interface StatReadoutProps {
  /** Micro-label above the value. */
  label: string;
  /** Formatted value — rendered in serif numerals. */
  value: string;
  /** Trailing unit rendered small. */
  unit?: string;
  /** Signed change since last tick. */
  delta?: { text: string; tone: keyof typeof deltaTone };
  /** Optional thin rounded meter (0–100). */
  meter?: { value: number; tone?: keyof typeof meterTone };
  className?: string;
}

export function StatReadout({ label, value, unit, delta, meter, className }: StatReadoutProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="font-data text-[9px] tracking-[0.3em] text-ink-dim uppercase">
        {label}
      </span>
      <span className="font-display text-[27px] leading-none font-medium text-ink tabular-nums">
        {value}
        {unit !== undefined && (
          <span className="ml-1 font-data text-sm font-light text-ink-dim">{unit}</span>
        )}
        {delta !== undefined && (
          <span className={cn("ml-2 align-middle font-data text-[11px] font-normal", deltaTone[delta.tone])}>
            {delta.text}
          </span>
        )}
      </span>
      {meter !== undefined && (
        <Meter.Root value={meter.value} aria-label={label}>
          <Meter.Track className="h-[3px] w-full overflow-hidden rounded-full bg-line">
            <Meter.Indicator
              className={cn(
                "h-full rounded-full transition-[width] duration-700 ease-out",
                meterTone[meter.tone ?? "accent"],
              )}
            />
          </Meter.Track>
        </Meter.Root>
      )}
    </div>
  );
}
