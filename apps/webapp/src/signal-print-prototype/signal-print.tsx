import { useEffect, useRef, useState } from "react";

import { LOOP_MS, poseAt, type View } from "./motion.ts";
import { makeBackdrop, render } from "./renderer.ts";
import "./style.css";

export function SignalPrint() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>("hero");
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [capture, setCapture] = useState(false);
  const clock = useRef(0);
  const phase = poseAt(time, "medic").phase;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setView(params.get("view") === "crowd" ? "crowd" : "hero");
    setCapture(params.get("capture") === "1");
    const freeze = params.get("freeze");
    if (freeze !== null && Number.isFinite(Number(freeze))) {
      clock.current = ((Number(freeze) % LOOP_MS) + LOOP_MS) % LOOP_MS;
      setTime(clock.current);
      setPlaying(false);
    } else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const c = canvas.getContext("2d");
    if (!c) {
      return;
    }
    const backdrop = makeBackdrop(view);
    let frame = 0;
    let last = 0;
    let lastUi = 0;
    let lastPaint = -1;
    const paint = (now: number) => {
      if (playing && last) {
        clock.current = (clock.current + Math.min(now - last, 100)) % LOOP_MS;
      }
      last = now;
      const frameNumber = Math.floor((clock.current + 0.001) / (1000 / 12));
      if (frameNumber !== lastPaint) {
        render(c, backdrop, view, clock.current);
        lastPaint = frameNumber;
      }
      if (now - lastUi > 80) {
        setTime(clock.current);
        lastUi = now;
      }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [playing, view]);

  const seek = (value: number) => {
    clock.current = value % LOOP_MS;
    setTime(clock.current);
    setPlaying(false);
  };

  return (
    <main className={`signal-print ${capture ? "signal-print-capture" : ""}`}>
      <header className="signal-print-header">
        <div className="signal-print-wordmark">
          SIGNAL
          <span>/</span>
          PRINT
          <span className="signal-print-edition">ART EXPERIMENT 003</span>
        </div>
        <div className="signal-print-intro">
          A field report in three inks.
          <br />
          Hazard Pay · character & motion study
        </div>
      </header>
      <section className="signal-print-workspace" aria-label="Signal Print art prototype">
        <div className="signal-print-toolbar">
          <div className="signal-print-tabs" aria-label="Scene selection">
            <button type="button" aria-pressed={view === "hero"} onClick={() => setView("hero")}>01 — Personnel</button>
            <button type="button" aria-pressed={view === "crowd"} onClick={() => setView("crowd")}>02 — Forty bodies</button>
          </div>
          <span className="signal-print-material">PAPER / CHARCOAL / VERMILION / TEAL</span>
        </div>
        <canvas ref={canvasRef} width={1400} height={800} aria-label={view === "hero" ? "Three animated angular fighters: Morrow the medic, Rusk the veteran, Vesper the signal diviner" : "Forty animated fighters on an industrial dimetric battlefield"} />
        <div className="signal-print-controls">
          <button className="signal-print-play" type="button" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
          <button type="button" onClick={() => seek(clock.current + 1000 / 12)}>Step +1/12s</button>
          <label className="signal-print-scrub">
            Sequence
            <input type="range" min="0" max={LOOP_MS - 1} step="1" value={Math.round(time)} onChange={(e) => seek(Number(e.target.value))} />
          </label>
          <output>
            {(time / 1000).toFixed(2)}
            s / 6.40s
          </output>
          <span className="signal-print-phase">{phase}</span>
        </div>
      </section>
      <footer className="signal-print-footer">
        <p>
          <strong>POSE. HOLD. FOLLOW THROUGH.</strong>
          {" "}
          Twelve poses per second. Cut-paper silhouettes. Cloth resolves after the strike.
        </p>
        <span>PR90 × PR92 LINEAGE · NATIVE CANVAS · EXPLORATION ONLY</span>
      </footer>
    </main>
  );
}
