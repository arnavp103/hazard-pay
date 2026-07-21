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
 * Temporal graphs, Direction A: hairline grids, 2px phosphor line, value
 * labels in ink — the accent stays reserved for the data itself.
 */

const PLOT_W = 560;
const PLOT_H = 150;
const creditsScale = { width: PLOT_W, height: PLOT_H, min: 9000, max: 13000 };

export function CreditsChart() {
  const pts = toXY(creditsSeries, creditsScale);
  const last = pts.at(-1) ?? [0, 0];
  return (
    <figure className="flex flex-col gap-2.5">
      <figcaption className="font-display text-[10px] font-medium tracking-[0.24em] text-ink-dim uppercase">
        Credits · ticks 960–1024
      </figcaption>
      <svg viewBox={`0 0 ${PLOT_W + 52} ${PLOT_H + 22}`} className="w-full" role="img" aria-label="Credits over ticks, ending at 12,480">
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
          <path d={areaPath(creditsSeries, creditsScale)} fill="var(--hp-accent)" opacity={0.09} />
          <path d={linePath(creditsSeries, creditsScale)} fill="none" stroke="var(--hp-accent)" strokeWidth={2} />
          <circle cx={last[0]} cy={last[1]} r={3.5} fill="var(--hp-accent)" stroke="var(--hp-shell)" strokeWidth={2} />
          <text x={last[0] + 8} y={last[1] + 3} fill="var(--hp-ink)" fontSize={11} fontFamily="var(--hp-font-data)">
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
    <div className="flex items-end gap-3">
      <div className="flex flex-col gap-1">
        <span className="font-display text-[10px] font-medium tracking-[0.24em] text-ink-dim uppercase">
          Heat
        </span>
        <span className="font-data text-2xl leading-none font-medium text-ink tabular-nums">
          62
          <span className="ml-1 text-sm text-ink-dim">%</span>
        </span>
      </div>
      <svg viewBox="0 0 158 40" className="h-10 w-[158px]" role="img" aria-label="Heat over the last 64 ticks, currently 62 percent">
        <line x1={0} y1={thresholdY} x2={150} y2={thresholdY} stroke="var(--hp-danger)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
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
        <div key={lane.id} className="grid grid-cols-[120px_1fr_52px] items-center gap-3 border-b border-line py-2 last:border-b-0">
          <span className="font-data text-[10px] text-ink-dim tabular-nums">
            {lane.id}
            <span className="ml-1.5 text-ink-dim/60">{lane.leader}</span>
          </span>
          <svg viewBox="0 0 560 14" className="h-3.5 w-full" role="img" aria-label={`Wakes for lane ${lane.id}`}>
            <line x1={0} y1={7} x2={560} y2={7} stroke="var(--hp-line)" strokeWidth={1} />
            {lane.wakes.map((t) => (
              <rect
                key={t}
                x={tickX(t, 560) - 1}
                y={2}
                width={2}
                height={10}
                fill={lane.closed ? "var(--hp-ink-dim)" : "var(--hp-accent)"}
                opacity={lane.closed ? 0.5 : 1}
              />
            ))}
          </svg>
          <span className="text-right font-data text-[10px] text-ink-dim tabular-nums">
            {lane.closed ? "closed" : `${lane.wakes.length} wk`}
          </span>
        </div>
      ))}
      <div className="grid grid-cols-[120px_1fr_52px] gap-3 pt-1.5">
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
