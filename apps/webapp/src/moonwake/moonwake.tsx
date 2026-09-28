import { useEffect, useRef, useState } from "react";
import { paintMoonwake } from "./painter.ts";
import { chapterAt, chapters, DURATION } from "./timeline.ts";
import "./moonwake.css";
export function MoonwakePrototype() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef(0);
  const running = useRef(true);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { running.current = false; setPlaying(false); }
    let frame = 0;
    let last = 0;
    let update = 0;
    let paintedTime = -1;
    let paintedAt = 0;
    const draw = (now: number) => {
      if (running.current && last) { clock.current = Math.min(DURATION, clock.current + Math.min((now - last) / 1000, 0.1)); }
      last = now;
      const context = canvas.current?.getContext("2d");
      if (context && paintedTime !== clock.current && (now - paintedAt > 1000 / 30 || !running.current)) {
        paintMoonwake(context, clock.current); paintedTime = clock.current; paintedAt = now;
      }
      if (now - update > 80) { setTime(clock.current); update = now; }
      if (clock.current === DURATION && running.current) { running.current = false; setPlaying(false); }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  function seek(value: number) { clock.current = value; setTime(value); }
  function toggle() { if (clock.current >= DURATION) { seek(0); } running.current = !running.current; setPlaying(running.current); }
  const active = chapterAt(time);
  return (
    <main className="moonwake-page">
      <div className="moonwake-top"><a href="/">HAZARD PAY</a><span>MOONWAKE · ORIGINAL ILLUSTRATED DIRECTION</span><span>PROTOTYPE / 01</span></div>
      <section className="moonwake-theater" aria-label="Moonwake cinematic encounter"><canvas ref={canvas} width={1600} height={900} role="img" aria-label="Fifty-six mercenaries and tidal creatures fight on a moonlit drowned causeway. Ivory shields, lantern archers and harpoon companies support Captain Vey against the giant bell-keeper." /></section>
      <div className="moonwake-transport">
        <button onClick={toggle} aria-label={playing ? "Pause encounter" : "Play encounter"}>{playing ? "Ⅱ Pause" : "▶ Play"}</button>
        <button onClick={() => { seek(0); running.current = true; setPlaying(true); }}>↺ Replay</button>
        <input type="range" min={0} max={36} step={0.01} value={time} onChange={(e) => seek(Number(e.target.value))} aria-label="Encounter time" />
        <output>{time.toFixed(1)} / 36.0s</output>
      </div>
      <nav className="moonwake-chapters" aria-label="Encounter chapters">{chapters.map((chapter, index) => <button key={chapter.at} onClick={() => seek(chapter.at)} aria-current={active.at === chapter.at ? "step" : undefined}><small>0{index + 1} / {chapter.at.toString().padStart(2, "0")}s</small><span>{chapter.name}</span></button>)}</nav>
      <footer className="moonwake-notes"><p><strong>THE IVORY COMPANY</strong> Shieldbearers · Lantern bows · Harpooners · Captain Vey</p><p>36-second authored encounter · 56 troops + captain + bell-keeper · Original Canvas illustration · Soundless study</p></footer>
    </main>
  );
}
