import { useEffect, useRef, useState } from "react";

import { ACTIONS, type Action, type View } from "./motion.ts";
import { HEIGHT, paint, WIDTH } from "./painter.ts";
import "./style.css";

function initial() {
  const query = typeof location === "undefined" ? new URLSearchParams() : new URLSearchParams(location.search);
  const raw = Number(query.get("freeze") ?? 0);
  const action = query.get("anim");
  const view = query.get("view");
  return { seconds: Number.isFinite(raw) ? Math.max(0, raw / 1000) : 0, paused: query.has("freeze"), capture: query.get("capture") === "1", action: ACTIONS.includes(action as Action) ? action as Action : "attack" as Action, view: view === "crowd" || view === "lineup" ? view : "hero" as View };
}

export function PixelNoirPrototype() {
  const [options] = useState(initial);
  const [seconds, setSeconds] = useState(options.seconds);
  const [paused, setPaused] = useState(options.paused);
  const [view, setView] = useState<View>(options.view);
  const [action, setAction] = useState<Action>(options.action);
  const [rain, setRain] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (paused) { return; }
    let handle = 0;
    let last = performance.now();
    let accumulated = 0;
    const tick = (now: number) => {
      accumulated += Math.min((now - last) / 1000, 0.2);
      last = now;
      if (accumulated >= 1 / 12) {
        const advance = Math.floor(accumulated * 12) / 12;
        accumulated -= advance;
        setSeconds((s) => s + advance);
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(handle); };
  }, [paused]);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (context) { paint(context, seconds, view, action, rain); }
  }, [seconds, view, action, rain]);

  return (
    <main className={`pn-page ${options.capture ? "pn-capture" : ""}`}>
      <header className="pn-header">
        <a className="pn-wordmark" href="/">
          HAZARD
          <span>PAY</span>
          <i>ART DEPARTMENT</i>
        </a>
        <span className="pn-edition">INDEPENDENT PROTOTYPE / 03</span>
        <span className="pn-stamp">
          EXPERIMENTAL
          <br />
          SEPTEMBER 2026
        </span>
      </header>
      <section className="pn-workspace" aria-label="Pixel Noir interactive art and animation prototype">
        <div className="pn-title-row">
          <div>
            <p className="pn-eyebrow">AFTER HOURS IN SECTOR 09</p>
            <h1>
              PIXEL NOIR
              <span> / </span>
              <small>the night shift</small>
            </h1>
          </div>
          <p className="pn-title-note">
            Authored pixels. Hard silhouettes.
            <br />
            A little humanity in the machinery.
          </p>
        </div>
        <nav className="pn-views" aria-label="Scene views">
          {(["hero", "lineup", "crowd"] as View[]).map((item, index) => (
            <button key={item} type="button" aria-pressed={view === item} onClick={() => { setView(item); }}>
              {`0${index + 1}`}
              <strong>{item === "hero" ? "CHARACTER STUDY" : item === "lineup" ? "SILHOUETTE LINEUP" : "FORTY ON THE STREET"}</strong>
            </button>
          ))}
          <span className="pn-view-meta">
            NATIVE 1024 × 608
            <b>●</b>
            {" "}
            12 POSES / SEC
          </span>
        </nav>
        <div className="pn-stage">
          <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label={view === "crowd" ? "Forty animated pixel characters patrol and exchange fire on a rain-soaked dimetric clinic street" : "Original pixel field medic with hood, orange medical case, cybernetic forearm and injector carbine, with three annotated attack poses"} />
        </div>
        <div className="pn-console">
          <div className="pn-transport">
            <button type="button" className="pn-play" onClick={() => { setPaused((p) => !p); }} aria-label={paused ? "Play animation" : "Pause animation"}>{paused ? "▶ PLAY" : "Ⅱ PAUSE"}</button>
            <button type="button" onClick={() => { setPaused(true); setSeconds((s) => (Math.floor(s * 12 + 0.001) + 1) / 12); }} aria-label="Step one frame">STEP +1</button>
            <output aria-live="off">
              {seconds.toFixed(3)}
              {" "}
              s
              {" "}
              <span>
                F
                {Math.floor(seconds * 12 + 0.001).toString().padStart(4, "0")}
              </span>
            </output>
          </div>
          <div className="pn-actions" aria-label="Animation states">
            {ACTIONS.map((item) => <button type="button" key={item} disabled={view === "crowd"} aria-pressed={item === action} onClick={() => { setAction(item); setSeconds(0); }}>{item}</button>)}
          </div>
          <label className="pn-rain">
            <input type="checkbox" checked={rain} onChange={(event) => { setRain(event.target.checked); }} />
            RAIN
          </label>
          <label className="pn-scrub">
            TIMELINE
            <input aria-label="Animation timeline in seconds" type="range" min="0" max="12" step={1 / 12} value={seconds % 12} onChange={(event) => { setPaused(true); setSeconds(Number(event.target.value)); }} />
            <span>12 s LOOP</span>
          </label>
        </div>
        {!options.capture && (
          <footer className="pn-notes">
            <p>
              <b>01 / PIXEL DISCIPLINE</b>
              Integer contours, stepped motion, local material palettes. No bloom, imported art, or image-model assets.
            </p>
            <p>
              <b>02 / MOTION WITH WEIGHT</b>
              Coil → plant → contact hold → recovery. Coat lag, lifted feet, and a leg aperture that survives distance.
            </p>
            <p>
              <b>03 / HONEST SCOPE</b>
              Portrait is enlarged 3.2×. Crowd is 40 deterministic patrols, not the gameplay simulation. A direction to judge, not production assets.
            </p>
          </footer>
        )}
      </section>
    </main>
  );
}
