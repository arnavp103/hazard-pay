/**
 * Deterministic demo series shared by all three directions' graphs so the
 * comparison is honest. Pure data + path math; rendering stays per-direction.
 */

export interface TickPoint {
  tick: number;
  value: number;
}

const TICK_START = 960;
const TICK_END = 1024;

/** Credits over ticks: a noisy climb ending at 12,480. */
export const creditsSeries: TickPoint[] = Array.from({ length: TICK_END - TICK_START + 1 }, (_, i) => {
  const tick = TICK_START + i;
  const trend = 9600 + i * 38;
  const wave = 380 * Math.sin(i / 5.1) + 220 * Math.sin(i / 2.3 + 1.7);
  const dip = i > 40 && i < 46 ? -520 : 0;
  return { tick, value: Math.round(trend + wave + dip) };
});
creditsSeries[creditsSeries.length - 1] = { tick: TICK_END, value: 12480 };

/** Heat over ticks: simmering with a late spike, ending at 62%. */
export const heatSeries: TickPoint[] = Array.from({ length: TICK_END - TICK_START + 1 }, (_, i) => {
  const tick = TICK_START + i;
  const base = 34 + 10 * Math.sin(i / 7.3) + 6 * Math.sin(i / 3.1 + 0.8);
  const spike = i > 48 ? (i - 48) * 1.9 : 0;
  return { tick, value: Math.min(96, Math.round(base + spike)) };
});
heatSeries[heatSeries.length - 1] = { tick: TICK_END, value: 62 };

export interface LaneStrip {
  id: string;
  leader: string;
  closed: boolean;
  /** Ticks at which the lane woke. */
  wakes: number[];
}

/** Lane activity: wakes per lane across the same tick window. */
export const laneStrips: LaneStrip[] = [
  { id: "LN-0F3A", leader: "VEX-7", closed: false, wakes: [962, 966, 971, 973, 978, 984, 989, 993, 996, 1000, 1003, 1007, 1010, 1013, 1016, 1019, 1021, 1024] },
  { id: "LN-1B77", leader: "VEX-7", closed: false, wakes: [968, 976, 988, 1002, 1014] },
  { id: "LN-2C05", leader: "MOTH", closed: false, wakes: [994, 999, 1011, 1023] },
  { id: "LN-09E1", leader: "MOTH", closed: true, wakes: [961, 965, 970, 974, 981, 986, 990, 995, 1001, 1006, 1012, 1017, 1019] },
];

export const tickWindow = { start: TICK_START, end: TICK_END };

export interface ChartScale {
  width: number;
  height: number;
  min: number;
  max: number;
}

export function toXY(series: TickPoint[], scale: ChartScale): [number, number][] {
  const span = TICK_END - TICK_START;
  return series.map(({ tick, value }) => [
    ((tick - TICK_START) / span) * scale.width,
    scale.height - ((value - scale.min) / (scale.max - scale.min)) * scale.height,
  ]);
}

export function linePath(series: TickPoint[], scale: ChartScale): string {
  return toXY(series, scale)
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

export function areaPath(series: TickPoint[], scale: ChartScale): string {
  const line = linePath(series, scale);
  const last = toXY(series, scale).at(-1);
  return `${line} L${last?.[0].toFixed(1) ?? 0},${scale.height} L0,${scale.height} Z`;
}

export function tickX(tick: number, width: number): number {
  return ((tick - TICK_START) / (TICK_END - TICK_START)) * width;
}
