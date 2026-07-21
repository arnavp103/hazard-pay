import { useEffect, useState } from "react";

export interface CommsMessage {
  from: string;
  text: string;
}

export interface HudSim {
  /** Seconds elapsed since mount. */
  t: number;
  credits: number;
  creditsDelta: number;
  heat: number;
  crew: number;
  /** Decision-window countdown, mm:ss. */
  window: string;
  movesIn: number;
  messages: CommsMessage[];
}

const ALL_MESSAGES: CommsMessage[] = [
  { from: "VEX-7", text: "Route secured through the interchange. Holding for your move." },
  { from: "MOTH", text: "Fence is asking questions. Heat is climbing — advise." },
  { from: "VEX-7", text: "Window closes at phase 08. Two patrols rerouted." },
];

/**
 * Deterministic-enough live drift for HUD capture: countdown ticks, heat
 * breathes, credits land in bursts, comms messages arrive over time.
 */
export function useHudSim(): HudSim {
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = 19 - (t % 20);
  const creditBursts = Math.floor(t / 5);

  return {
    t,
    credits: 12480 + creditBursts * 160,
    creditsDelta: 340 + creditBursts * 160,
    heat: Math.round(62 + 6 * Math.sin(t / 2.6) + (t % 7 === 0 ? 3 : 0)),
    crew: 4,
    window: `00:${String(secondsLeft).padStart(2, "0")}`,
    movesIn: secondsLeft > 12 ? 1 : secondsLeft > 6 ? 2 : 3,
    messages: ALL_MESSAGES.slice(0, Math.min(1 + Math.floor(t / 4), ALL_MESSAGES.length)),
  };
}
