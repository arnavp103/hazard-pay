import { useEffect, useRef, useState } from "react";
import { CHAPTERS, DURATION, chapterAt, renderBattle } from "./scene.ts";
import type { Assets } from "./scene.ts";
import "./style.css";
export function Emberwatch() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const clock = useRef(0);
  const running = useRef(true);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const box = container.current;
    if (!box) { return; }
    const resize = new ResizeObserver(([entry]) => setScale(Math.max(1, Math.floor(entry!.contentRect.width / 640))));
    resize.observe(box);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    let disposed = false;
    let animation = 0;
    let previous = 0;
    let lastUi = 0;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      running.current = false;
      setPlaying(false);
    }
    const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    void Promise.all([load("/emberwatch/aqueduct.png"), load("/emberwatch/units.png"), load("/emberwatch/brood.png")]).then(([field, units, brood]) => {
      if (disposed) { return; }
      const context = canvas.current?.getContext("2d");
      if (!context) {
        setError(true);
        return;
      }
      const assets: Assets = { field, units, brood };
      setReady(true);
      const tick = (now: number) => {
        if (disposed) { return; }
        const delta = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
        previous = now;
        if (running.current) { clock.current = Math.min(DURATION, clock.current + delta); }
        renderBattle(context, assets, clock.current);
        if (now - lastUi > 80) {
          setTime(clock.current);
          lastUi = now;
        }
        if (clock.current >= DURATION && running.current) {
          running.current = false;
          setPlaying(false);
        }
        animation = requestAnimationFrame(tick);
      };
      animation = requestAnimationFrame(tick);
    }).catch(() => {
      if (!disposed) { setError(true); }
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
    };
  }, []);
  function seek(value: number) {
    clock.current = value;
    setTime(value);
  }
  function toggle() {
    if (clock.current >= DURATION) { seek(0); }
    running.current = !running.current;
    setPlaying(running.current);
  }
  const chapter = chapterAt(time);
  return (
    <main className="emberwatch">
      <header className="emberwatch-masthead">
        <a href="/" className="emberwatch-mark">
          E
          <span>✳</span>
          W
        </a>
        <div>
          <p className="emberwatch-kicker">FIELD RECORDING 07 · THE COPPER GARDEN</p>
          <h1>Emberwatch</h1>
        </div>
        <div className="emberwatch-edition">
          NATIVE PIXEL EDITION
          <br />
          <span>48 combatants · 36 seconds</span>
        </div>
      </header>
      <section className="emberwatch-player" aria-label="Emberwatch battle recording">
        <div className="emberwatch-stage" ref={container}>
          <canvas ref={canvas} width={640} height={360} style={{ width: 640 * scale, height: 360 * scale }} aria-label="Sunlit aqueduct battle between a salvage crew and cobalt chitin creatures" />
          {!ready && <p className="emberwatch-loading">{error ? "The field artwork could not be loaded. Reload to try again." : "Opening the field journal…"}</p>}
        </div>
        <div className="emberwatch-transport">
          <button onClick={toggle} aria-label={playing ? "Pause battle" : "Play battle"}>{playing ? "Ⅱ Pause" : "▶ Play"}</button>
          <button onClick={() => {
            seek(0);
            running.current = true;
            setPlaying(true);
          }}
          >
            ↺ Replay
          </button>
          <input aria-label="Battle timeline" type="range" min={0} max={DURATION} step={0.05} value={time} onChange={(event) => seek(Number(event.target.value))} />
          <output>
            {time.toFixed(1).padStart(4, "0")}
            {" "}
            <span>/ 36.0</span>
          </output>
        </div>
      </section>
      <section className="emberwatch-journal" aria-label="Battle chapters">
        <div className="emberwatch-current">
          <p className="emberwatch-kicker">
            {String(CHAPTERS.indexOf(chapter) + 1).padStart(2, "0")}
            {" "}
            / FIELD NOTES
          </p>
          <h2>{chapter.title}</h2>
          <p>{chapter.note}</p>
        </div>
        <nav className="emberwatch-chapters" aria-label="Jump to chapter">
          {CHAPTERS.map((item, index) => (
            <button key={item.time} aria-current={chapter === item ? "step" : undefined} onClick={() => seek(item.time)}>
              <span>
                0
                {index + 1}
              </span>
              {item.title}
              <small>
                {String(item.time).padStart(2, "0")}
                s
              </small>
            </button>
          ))}
        </nav>
      </section>
      <footer className="emberwatch-footer">
        <span>An abandoned railway. One last salvage contract.</span>
        <a href="/emberwatch/units.png" target="_blank" rel="noreferrer">Inspect the sprite atlas ↗</a>
      </footer>
    </main>
  );
}
