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
  /** Micro-label above the value, e.g. "Heat". */
  label: string;
  /** Formatted value, e.g. "12,480". */
  value: string;
  /** Trailing unit rendered small, e.g. "%", "¤". */
  unit?: string;
  /** Signed change since last tick, e.g. { text: "+340", tone: "ok" }. */
  delta?: { text: string; tone: keyof typeof deltaTone };
  /** Optional Base UI meter bar under the value (0–100). */
  meter?: { value: number; tone?: keyof typeof meterTone };
  className?: string;
}

export function StatReadout({ label, value, unit, delta, meter, className }: StatReadoutProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-display text-[10px] font-medium tracking-[0.24em] text-ink-dim uppercase">
        {label}
      </span>
      <span className="font-data text-2xl leading-none font-medium text-ink tabular-nums">
        {value}
        {unit !== undefined && <span className="ml-1 text-sm text-ink-dim">{unit}</span>}
        {delta !== undefined && (
          <span className={cn("ml-2 align-middle text-[11px]", deltaTone[delta.tone])}>
            {delta.text}
          </span>
        )}
      </span>
      {meter !== undefined && (
        <Meter.Root value={meter.value} aria-label={label}>
          <Meter.Track className="h-px w-full bg-line-2">
            <Meter.Indicator className={cn("h-[3px] -translate-y-px", meterTone[meter.tone ?? "accent"])} />
          </Meter.Track>
        </Meter.Root>
      )}
    </div>
  );
}
