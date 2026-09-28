import { useEffect, useRef, useState } from "react";

import { CHAPTERS, DURATION, HEIGHT, paintBattle, WIDTH } from "./painting.ts";

export function VelvetSiegePrototype() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const position = useRef(0);
  const playing = useRef(true);
  const [time, setTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const playbackRate = useRef(1);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) {
      return;
    }
    let frame = 0;
    let previous = 0;
    let latestUpdate = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      playing.current = false;
      setPaused(true);
    }
    const animate = (now: number) => {
      if (previous && playing.current) {
        position.current = Math.min(DURATION, position.current + Math.min((now - previous) / 1000, 0.08) * playbackRate.current);
        if (position.current >= DURATION) {
          playing.current = false;
          setPaused(true);
        }
      }
      previous = now;
      paintBattle(context, position.current);
      if (now - latestUpdate > 80) {
        setTime(position.current);
        latestUpdate = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  function seek(value: number) {
    position.current = value;
    setTime(value);
  }
  function toggle() {
    if (position.current >= DURATION) {
      seek(0);
    }
    playing.current = !playing.current;
    setPaused(!playing.current);
  }
  return (
    <main className="min-h-screen bg-shell px-3 py-6 text-ink sm:px-8">
      <div className="mx-auto max-w-[1600px]">
        <canvas ref={canvas} width={WIDTH} height={HEIGHT} className="block h-auto w-full rounded-xl" aria-label="Velvet Siege: fifty sculptural war engines fight a 36 second battle on an eclipse causeway. Violet Vesper Court wins with seventeen survivors." />
        <div className="mt-4 flex flex-wrap items-center gap-3 font-data text-xs">
          <button type="button" onClick={toggle} className="rounded-full border border-line px-5 py-2 hover:bg-panel-2">{paused ? "Play" : "Pause"}</button>
          <button
            type="button"
            onClick={() => {
              seek(0);
              playing.current = true;
              setPaused(false);
            }}
            className="rounded-full border border-line px-5 py-2 hover:bg-panel-2"
          >
            Replay
          </button>
          <input aria-label="Battle time" type="range" min="0" max={DURATION} step="0.01" value={time} onChange={(event) => seek(Number(event.target.value))} className="min-w-40 flex-1 accent-current" />
          <span className="tabular-nums">
            {time.toFixed(1)}
            {" "}
            / 36s
          </span>
          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(event) => {
              const rate = Number(event.target.value);
              playbackRate.current = rate;
              setSpeed(rate);
            }}
            className="rounded-full border border-line bg-panel px-3 py-2"
          >
            <option value={0.5}>½ speed</option>
            <option value={1}>1× speed</option>
            <option value={1.5}>1½ speed</option>
          </select>
        </div>
        <nav aria-label="Battle chapters" className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 font-data text-xs text-ink-dim">
          {CHAPTERS.map((chapter, i) => (
            <button type="button" key={chapter.time} onClick={() => seek(chapter.time)} className="py-2 hover:text-ink">
              0
              {i + 1}
              {" "}
              ·
              {chapter.title}
            </button>
          ))}
        </nav>
        <p className="mt-3 text-center font-data text-xs text-ink-dim">Original vector art · 50 war engines · authored battle study · no live match data</p>
      </div>
    </main>
  );
}
