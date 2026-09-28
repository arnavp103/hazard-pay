import { useEffect, useRef, useState } from "react";

import { CLIPS, type Clip, parseFreeze } from "./motion.ts";
import { mountFoundry, type SceneOptions, type SceneStats, type View } from "./scene.ts";
import "./style.css";

function query() {
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const rawView = q.get("view");
  const rawClip = q.get("clip");
  return {
    view: (rawView === "crowd" || rawView === "lineup" ? rawView : "hero") as View,
    clip: (CLIPS.includes(rawClip as Clip) ? rawClip : "idle") as Clip,
    frozen: parseFreeze(q.get("freeze")),
    capture: q.get("capture") === "1",
  };
}

export function InkFoundryPrototype() {
  const [initial] = useState(query);
  const [view, setView] = useState<View>(initial.view);
  const [clip, setClip] = useState<Clip>(initial.clip);
  const [frozen, setFrozen] = useState<number | null>(initial.frozen);
  const [stepped, setStepped] = useState(true);
  const [stats, setStats] = useState<SceneStats>({ seconds: 0, calls: 0, triangles: 0, bodies: 1 });
  const [error, setError] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const handle = useRef<ReturnType<typeof mountFoundry> | null>(null);
  const latest = useRef<SceneOptions>({ view, clip, frozen, stepped });
  useEffect(() => {
    latest.current = { view, clip, frozen, stepped };
    handle.current?.update(latest.current);
  }, [view, clip, frozen, stepped]);
  useEffect(() => {
    if (!host.current) { return; }
    try {
      handle.current = mountFoundry(host.current, { ...latest.current, view }, setStats);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "WebGL could not start"); }
    return () => {
      handle.current?.dispose();
      handle.current = null;
    };
  }, [view]);
  const changeView = (next: View) => { setView(next); };
  return (
    <main className={`ink-foundry ${initial.capture ? "ink-capture" : ""}`}>
      <header className="ink-masthead">
        <a className="ink-back" href="/">HP / ART LAB</a>
        <div className="ink-edition">
          DIRECTION STUDY 01
          <span>28 SEP 2026</span>
        </div>
        <div className="ink-live">
          <i />
          {" "}
          REALTIME / THREE.JS
        </div>
      </header>
      <section className="ink-title">
        <div>
          <p className="ink-eyebrow">HAZARD PAY · CEL / INK / INDUSTRIAL</p>
          <h1>
            INK
            <span>FOUNDRY</span>
            <sup>®</sup>
          </h1>
        </div>
        <p className="ink-deck">
          Good people.
          <br />
          Bad contracts.
          <br />
          <strong>Weathered beyond warranty.</strong>
        </p>
      </section>
      <section className="ink-workbench">
        <div className="ink-stage-column">
          <div className="ink-stage-top">
            <span>
              PLATE
              {view === "hero" ? "01 / CHARACTER" : view === "crowd" ? "02 / 20 × 20" : "03 / CAST"}
            </span>
            <span>ORTHOGRAPHIC · 2:1 DIMETRIC</span>
          </div>
          <div className="ink-stage" ref={host} aria-label="Animated Ink Foundry art prototype">
            {error ? <p role="alert">{error}</p> : null}
            <div className="ink-stage-label">
              <span>{view === "hero" ? "MARA / FIELD MEDIC" : view === "crowd" ? "THE SHIFT CHANGE" : "SIX BAD CONTRACTS"}</span>
              <small>{view === "hero" ? "UNIT 041 · SALVAGE DIVISION" : "CHOREOGRAPHED ART STUDY · NO BATTLE SIMULATION"}</small>
            </div>
            <div className="ink-register">
              +
              <br />
              <br />
              <br />
              +
            </div>
          </div>
          <div className="ink-transport">
            <button onClick={() => setFrozen(frozen === null ? stats.seconds : null)}>{frozen === null ? "Ⅱ PAUSE" : "▶ PLAY"}</button>
            <button onClick={() => setFrozen((frozen ?? stats.seconds) + 1 / 12)}>STEP +1F</button>
            <input aria-label="Animation time" type="range" min="0" max="12000" step="83.333" value={(frozen ?? stats.seconds) * 1000 % 12000} onChange={(event) => setFrozen(Number(event.target.value) / 1000)} />
            <output>
              {stats.seconds.toFixed(3)}
              s
            </output>
          </div>
        </div>
        <aside className="ink-sidebar">
          <span className="ink-section-number">01—03 / VIEWFINDER</span>
          <nav aria-label="Scene view">
            {(["hero", "crowd", "lineup"] as const).map((item, index) => (
              <button key={item} className={view === item ? "active" : ""} onClick={() => changeView(item)}>
                <span>
                  0
                  {index + 1}
                </span>
                {item === "hero" ? "Hero study" : item === "crowd" ? "Forty bodies" : "Faction lineup"}
                <b>↗</b>
              </button>
            ))}
          </nav>
          <div className="ink-sidebar-body">
            <p className="ink-eyebrow">MOTION LANGUAGE</p>
            <div className="ink-clips">{CLIPS.map((item) => <button className={clip === item ? "active" : ""} disabled={view === "crowd"} onClick={() => { setClip(item); setFrozen(frozen === null ? null : 0); }} key={item}>{item}</button>)}</div>
            <label className="ink-toggle">
              <input type="checkbox" checked={stepped} onChange={(event) => setStepped(event.target.checked)} />
              {" "}
              Held poses / 12 fps
            </label>
            <div className="ink-rule" />
            <h2>{view === "hero" ? "A medic with mileage." : view === "crowd" ? "Read the room." : "Belonging, at a glance."}</h2>
            <p className="ink-description">{view === "hero" ? "Ivory field plates over an oil-dark split coat. Repaired boots, an old respirator and a salvage injector. The silhouette carries the job." : view === "crowd" ? "Two crews, twenty bodies each. Low cover, staggered volleys and independent motion phases test whether the design survives a crowded field." : "Medic, breacher, ranger. Teal salvage crews meet rust security. Shared construction, different equipment and unmistakable local color."}</p>
            <div className="ink-swatches">
              <i />
              <i />
              <i />
              <i />
              <span>
                LOCAL COLOR
                <br />
                GLOBAL GRIME
              </span>
            </div>
            <dl className="ink-metrics">
              <div>
                <dt>BODIES</dt>
                <dd>{stats.bodies.toString().padStart(2, "0")}</dd>
              </div>
              <div>
                <dt>DRAW CALLS</dt>
                <dd>{stats.calls}</dd>
              </div>
              <div>
                <dt>TRIANGLES</dt>
                <dd>
                  {(stats.triangles / 1000).toFixed(1)}
                  k
                </dd>
              </div>
            </dl>
            <p className="ink-note">
              Authored geometry + procedural joints.
              <br />
              Original experiment in the lineage of PR #85.
              <br />
              No downloaded or generated art assets.
            </p>
          </div>
        </aside>
      </section>
      <footer className="ink-footer">
        <span>PROTOTYPE / NOT A PRODUCTION ART COMMITMENT</span>
        <span>ANTICIPATION → IMPACT → RECOVERY</span>
        <span>HP—IF / 001</span>
      </footer>
    </main>
  );
}
