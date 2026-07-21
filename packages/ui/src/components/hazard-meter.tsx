import { Meter } from "@base-ui-components/react/meter";

import { cn } from "../lib/cn.ts";

const toneStyle = {
  acid: "bg-accent-2",
  warn: "hp-hazard",
  danger: "bg-danger",
} as const;

export interface HazardMeterProps {
  /** Current value, 0–max. */
  value: number;
  /** Upper bound; defaults to 100. */
  max?: number;
  /** Accessible name for the meter. */
  label: string;
  /** Fill style; warn renders diagonal hazard stripes. */
  tone?: keyof typeof toneStyle;
  /** Scroll the hazard stripes (live meters). Warn tone only. */
  animated?: boolean;
  className?: string;
}

/**
 * Chunky meter bar on the Base UI Meter primitive. Warn tone renders the
 * signature hazard stripes; `animated` scrolls them for live readings.
 */
export function HazardMeter({ value, max = 100, label, tone = "acid", animated = false, className }: HazardMeterProps) {
  return (
    <Meter.Root value={value} max={max} aria-label={label} className={className}>
      <Meter.Track className="h-2 w-full border border-line bg-shell">
        <Meter.Indicator
          className={cn("h-full", toneStyle[tone], tone === "warn" && animated && "hp-hazard-anim")}
        />
      </Meter.Track>
    </Meter.Root>
  );
}
