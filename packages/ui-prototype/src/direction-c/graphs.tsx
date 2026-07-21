import {
  areaPath,
  creditsSeries,
  heatSeries,
  laneStrips,
  linePath,
  tickWindow,
  tickX,
  toXY,
} from "../lib/tick-data.ts";

/**
 * Temporal graphs, Direction C: gilded 2px line over a fading gold wash,
 * serif terminal label, diamond wake marks. A ledger, not a dashboard.
 */

const PLOT_W = 560;
const PLOT_H = 150;
const creditsScale = { width: PLOT_W, height: PLOT_H, min: 9000, max: 13000 };

export function CreditsChart() {
  const pts = toXY(creditsSeries, creditsScale);
  const last = pts.at(-1) ?? [0, 0];
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="font-data text-[9px] tracking-[0.3em] text-ink-dim uppercase">
        Credits · ticks 960–1024
      </figcaption>
      <svg viewBox={`0 0 ${PLOT_W + 60} ${PLOT_H + 22}`} className="w-full" role="img" aria-label="Credits over ticks, ending at 12,480">
        <defs>
          <linearGradient id="hpc-credits-wash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hp-accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--hp-accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <g>
          {[10000, 11000, 12000].map((v) => {
            const y = PLOT_H - ((v - 9000) / 4000) * PLOT_H;
            return (
              <g key={v}>
                <line x1={0} y1={y} x2={PLOT_W} y2={y} stroke="var(--hp-line)" strokeWidth={1} />
                <text x={2} y={y - 4} fill="var(--hp-ink-dim)" fontSize={9} fontFamily="var(--hp-font-data)">
                  {v / 1000}
                  k
                </text>
              </g>
            );
          })}
          <path d={areaPath(creditsSeries, creditsScale)} fill="url(#hpc-credits-wash)" />
          <path d={linePath(creditsSeries, creditsScale)} fill="none" stroke="var(--hp-accent)" strokeWidth={2} />
          <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--hp-accent)" stroke="var(--hp-shell)" strokeWidth={2} />
          <text x={last[0] + 9} y={last[1] + 4} fill="var(--hp-ink)" fontSize={13} fontFamily="var(--hp-font-display)">
            12,480
          </text>
          {[960, 976, 992, 1008, 1024].map((t) => (
            <text key={t} x={tickX(t, PLOT_W)} y={PLOT_H + 16} fill="var(--hp-ink-dim)" fontSize={9} fontFamily="var(--hp-font-data)" textAnchor={t === 960 ? "start" : "middle"}>
              {t.toLocaleString("en-US")}
            </text>
          ))}
        </g>
      </svg>
    </figure>
  );
}

const sparkScale = { width: 150, height: 36, min: 0, max: 100 };

export function HeatSparkline() {
  const pts = toXY(heatSeries, sparkScale);
  const last = pts.at(-1) ?? [0, 0];
  const thresholdY = sparkScale.height - (80 / 100) * sparkScale.height;
  return (
    <div className="flex items-end gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="font-data text-[9px] tracking-[0.3em] text-ink-dim uppercase">
          Heat
        </span>
        <span className="font-display text-[27px] leading-none font-medium text-ink tabular-nums">
          62
          <span className="ml-1 font-data text-sm font-light text-ink-dim">%</span>
        </span>
      </div>
      <svg viewBox="0 0 158 40" className="h-10 w-[158px]" role="img" aria-label="Heat over the last 64 ticks, currently 62 percent">
        <line x1={0} y1={thresholdY} x2={150} y2={thresholdY} stroke="var(--hp-danger)" strokeWidth={1} strokeDasharray="1 4" strokeLinecap="round" />
        <text x={152} y={thresholdY + 3} fill="var(--hp-ink-dim)" fontSize={7} fontFamily="var(--hp-font-data)">80</text>
        <path d={linePath(heatSeries, sparkScale)} fill="none" stroke="var(--hp-warn)" strokeWidth={1.5} />
        <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--hp-warn)" stroke="var(--hp-shell)" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

export function LaneTimeline() {
  return (
    <div className="flex flex-col">
      {laneStrips.map((lane) => (
        <div key={lane.id} className="grid grid-cols-[130px_1fr_56px] items-center gap-3 border-b border-line py-2.5 last:border-b-0">
          <span className="font-data text-[10px] text-ink-dim tabular-nums">
            {lane.id}
            <span className="ml-2 text-ink-dim/60">{lane.leader}</span>
          </span>
          <svg viewBox="0 0 560 16" className="h-4 w-full" role="img" aria-label={`Wakes for lane ${lane.id}`}>
            <line x1={0} y1={8} x2={560} y2={8} stroke="var(--hp-line)" strokeWidth={1} />
            {lane.wakes.map((t) => (
              <rect
                key={t}
                x={tickX(t, 560) - 2.6}
                y={5.4}
                width={5.2}
                height={5.2}
                transform={`rotate(45 ${tickX(t, 560)} 8)`}
                fill={lane.closed ? "var(--hp-ink-dim)" : "var(--hp-accent)"}
                opacity={lane.closed ? 0.45 : 1}
              />
            ))}
          </svg>
          <span className="text-right font-data text-[10px] text-ink-dim tabular-nums">
            {lane.closed ? "closed" : `${lane.wakes.length} wk`}
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[130px_1fr_56px] gap-3 pt-2">
        <span />
        <div className="flex justify-between font-data text-[9px] text-ink-dim/80">
          <span>{tickWindow.start.toLocaleString("en-US")}</span>
          <span>992</span>
          <span>{tickWindow.end.toLocaleString("en-US")}</span>
        </div>
        <span />
      </div>
    </div>
  );
}
