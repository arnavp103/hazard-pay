/** Throwaway art-direction study: 36 seconds, 56 combatants, no backend. */
export const DURATION = 36;
export const volleys = [6.6, 8.8, 11, 19.2, 24.4] as const;
const arrowHits = Array.from({ length: 28 }, (_, n) => volleys.flatMap((launch) => Array.from({ length: 17 }, (_, j) => j * 11 % 28 === n ? launch + j * 0.055 + 1.25 : -1).filter((at) => at >= 0)));
export const chapters = [
  { at: 0, name: "The tide remembers", detail: "The Ivory Company advances beneath the drowned bells." },
  { at: 6, name: "A constellation of arrows", detail: "Lantern bows loose three staggered flights over the shield wall." },
  { at: 13, name: "Breakwater", detail: "The bell-keeper calls the sea. The company braces." },
  { at: 21, name: "The captain's passage", detail: "Harpoons bind the giant; Captain Vey crosses the breach." },
  { at: 29, name: "The last toll", detail: "A crescent cut silences the bell. The water gives them back." },
] as const;
export const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const ease = (n: number) => { const v = clamp(n); return v * v * (3 - 2 * v); };
export const ramp = (time: number, from: number, to: number) => ease((time - from) / (to - from));
export function chapterAt(time: number) { return chapters.findLast((chapter) => time >= chapter.at) ?? chapters[0]; }
export interface Soldier { id: number; side: "ivory" | "tide"; kind: number; x: number; y: number; scale: number }
export const soldiers: Soldier[] = Array.from({ length: 56 }, (_, id) => {
  const side = id < 28 ? "ivory" : "tide";
  const n = id % 28;
  const row = Math.floor(n / 7);
  const col = n % 7;
  return { id, side, kind: side === "ivory" ? col < 2 ? 1 : col < 4 ? 2 : 0 : n % 3, x: side === "ivory" ? 120 + col * 64 + Math.sin(n * 8) * 11 : 972 + col * 59 + Math.sin(n * 3) * 16, y: 530 + row * 68 + Math.sin(n * 9.7) * 19, scale: (0.65 + row * 0.115) * (1 + Math.sin(n * 11) * 0.075) };
});
export function soldierAt(unit: Soldier, time: number) {
  const n = unit.id % 28;
  const advance = ramp(time, 0.8 + n * 0.018, 5.8 + n * 0.018);
  const breach = ramp(time, 16, 17.3) * (1 - ramp(time, 18.2, 20));
  const retreat = ramp(time, 29 + n * 0.07, 33 + n * 0.06);
  const charge = ramp(time, 23 + n * 0.035, 27 + n * 0.04);
  const col = n % 7;
  const cadence = (time + Math.floor(n / 7) * 0.47 + (unit.side === "ivory" ? 6 - col : col) * 0.16) % 2.7;
  const anticipation = ramp(cadence, 0.4, 1.1) * (1 - ramp(cadence, 1.1, 1.35));
  const release = ramp(cadence, 1.1, 1.38) * (1 - ramp(cadence, 1.55, 2.15));
  let attack = time > 4.5 && time < 31 ? release - anticipation * 0.3 : 0;
  if (unit.side === "ivory" && unit.kind === 1) {
    attack = Math.max(0, ...volleys.map((launch) => {
      const at = launch + (Math.floor(n / 7) * 2 + col) * 0.055;
      return ramp(time, at - 1, at - 0.14) * (1 - ramp(time, at, at + 0.14));
    }));
  }
  const brace = ramp(time, 13.7, 15.2) * (1 - ramp(time, 17.8, 19.2));
  const arrowReaction = unit.side === "tide" ? Math.max(0, ...arrowHits[n]!.map((at) => ramp(time, at, at + 0.1) * (1 - ramp(time, at + 0.25, at + 0.8)))) : 0;
  const recoil = unit.side === "tide" ? Math.max(arrowReaction, ramp(cadence, 1.38, 1.55) * (1 - ramp(cadence, 1.7, 2.1))) : breach;
  const press = ramp(time, 4.5, 6.5) * (1 - retreat);
  const x = unit.x + (unit.side === "ivory" ? advance * 205 + press * Math.max(0, col - 2) * 29 + charge * (col < 4 ? 160 : 215) - breach * (35 + col * 4) + attack * (col > 3 ? 15 : 4) : -advance * 134 - press * Math.max(0, 3 - col) * 7 + retreat * 165 + recoil * 22);
  const fallen = unit.side === "tide" && n % 3 !== 0 ? ramp(time, 27 + n * 0.12, 28 + n * 0.12) : unit.side === "ivory" && n === 27 ? ramp(time, 16.5, 17.3) : 0;
  const y = unit.y + Math.sin(n * 4) * press * 15 + charge * Math.sin(n * 3) * 31 - breach * Math.sin(n) * 16;
  return { x, y, attack, brace, recoil, fallen, advance, charge, retreat, cadence };
}
