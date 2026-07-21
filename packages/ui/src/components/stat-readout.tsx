import { cn } from "../lib/cn.ts";
import { HazardMeter, type HazardMeterProps } from "./hazard-meter.tsx";

const deltaTone = {
  ok: "text-accent-2",
  bad: "text-danger",
} as const;

export interface StatReadoutProps {
  /** Stamp micro-label, e.g. "Heat". */
  label: string;
  /** Formatted value, e.g. "12,480". */
  value: string;
  /** Trailing unit rendered small, e.g. "%", "¤". */
  unit?: string;
  /** Signed change since last tick. */
  delta?: { text: string; tone: keyof typeof deltaTone };
  /** Optional meter bar under the value. */
  meter?: Omit<HazardMeterProps, "label" | "className">;
  className?: string;
}

/** Big condensed number with a stamp label — the overworld resource readout. */
export function StatReadout({ label, value, unit, delta, meter, className }: StatReadoutProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="self-start border border-line bg-panel-2 px-1.5 py-px font-data text-[9px] tracking-[0.12em] text-ink-dim uppercase">
        {label}
      </span>
      <span className="font-display text-[2.5rem] leading-none font-extrabold tracking-[0.02em] text-ink">
        {value}
        {unit !== undefined && (
          <span className="ml-1 align-baseline font-data text-sm font-normal text-ink-dim">{unit}</span>
        )}
        {delta !== undefined && (
          <span className={cn("ml-2 align-middle font-data text-xs font-bold", deltaTone[delta.tone])}>
            {delta.text}
          </span>
        )}
      </span>
      {meter !== undefined && <HazardMeter label={label} {...meter} />}
    </div>
  );
}
