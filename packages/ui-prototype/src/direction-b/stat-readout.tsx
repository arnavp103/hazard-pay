import { Meter } from "@base-ui-components/react/meter";

import { cn } from "../lib/cn.ts";

const meterTone = {
  acid: "bg-accent-2",
  warn: "hpb-hazard hpb-hazard-anim",
  danger: "bg-danger",
} as const;

const deltaTone = {
  ok: "text-accent-2",
  bad: "text-danger",
} as const;

export interface StatReadoutProps {
  /** Sticker micro-label, e.g. "Heat". */
  label: string;
  /** Formatted value, e.g. "12,480". */
  value: string;
  /** Trailing unit rendered small, e.g. "%", "¤". */
  unit?: string;
  /** Signed change since last tick. */
  delta?: { text: string; tone: keyof typeof deltaTone };
  /** Optional chunky meter bar (0–100); warn tone renders hazard stripes. */
  meter?: { value: number; tone?: keyof typeof meterTone };
  className?: string;
}

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
      {meter !== undefined && (
        <Meter.Root value={meter.value} aria-label={label}>
          <Meter.Track className="h-2 w-full border border-line bg-shell">
            <Meter.Indicator className={cn("h-full", meterTone[meter.tone ?? "acid"])} />
          </Meter.Track>
        </Meter.Root>
      )}
    </div>
  );
}
