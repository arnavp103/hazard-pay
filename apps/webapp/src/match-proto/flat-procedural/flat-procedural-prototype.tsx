/**
 * THROWAWAY PROTOTYPE (#89): the flat low-poly + procedural animation lane.
 *
 * Query parameters (all optional):
 *   view=hero|crowd|lineup   one unit, the seeded battle, or the roster
 *   anim=idle|attack|walk|march|turn   hero view only
 *   base=none|stance|pair|quad   authored-key rung (the experiment)
 *   layers=all|none|a,b,c    procedural layer ablation
 *                            (phase,stride,aim,ik,lean,react)
 *   zoom=<0.2..4>            world units per 40 px
 *   scale=<1..3>             canvas multiplier; framing unchanged
 *   freeze=<ms>              render exactly one deterministic frame
 *   fodder=<n> heroes=<n>    crowd composition per side
 *   motion=1                 translation-only camera pan
 *   strip=<n>&fps=&from=&cols=  tile n deterministic frames into a filmstrip
 *   capture=1                hide dev chrome
 *
 * Run at `/flat-proto`.
 */

import { useEffect, useRef, useState } from "react";

import { StatusChip } from "@hazard-pay/ui";

import { BASE_DENSITIES, BASE_KEY_COUNT, type BaseDensity } from "./authored.ts";
import { ALL_LAYERS, type LayerFlags, NO_LAYERS } from "./animator.ts";
import {
  COMBAT_ZOOM,
  type CostReport,
  CROWD_ZOOM,
  type FlatSceneHandle,
  type HeroAnim,
  mountFlatScene,
  type SceneView,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "./scene.ts";

export const heroAnimations = [
  {
    key: "idle",
    name: "Idle",
    law: "Breath and weight shift are procedural; the authored rung supplies posture and the hold. Gaze drifts between two points of interest.",
  },
  {
    key: "attack",
    name: "Injector strike",
    law: "Authored coil/strike/impact/recover, with reach solved by IK against the real target distance and a recoil spring on release.",
  },
  {
    key: "walk",
    name: "Walk circuit",
    law: "Stride frequency and amplitude are computed from speed; the unit banks into the turn while torso and head stay aimed at a fixed point.",
  },
  {
    key: "march",
    name: "March in place",
    law: "Locomotion held in frame: stride frequency is computed from a fixed speed so one cycle takes exactly one second and the loop closes.",
  },
  {
    key: "turn",
    name: "Character turn",
    law: "Eight facings on uneven dwells. The head leads via the aim layer, the body banks via the lean layer — no per-facing authoring exists.",
  },
] as const;

const LAYER_KEYS = ["phase", "stride", "aim", "ik", "lean", "react"] as const;

function params(): URLSearchParams {
  if (globalThis.location === undefined) { return new URLSearchParams(); }
  return new URLSearchParams(globalThis.location.search);
}

function readView(): SceneView {
  const raw = params().get("view");
  return raw === "crowd" || raw === "lineup" ? raw : "hero";
}

function readAnim(): HeroAnim {
  const candidate = params().get("anim");
  return heroAnimations.some((item) => item.key === candidate)
    ? candidate as HeroAnim
    : "idle";
}

function readBase(): BaseDensity {
  const candidate = params().get("base");
  return BASE_DENSITIES.includes(candidate as BaseDensity)
    ? candidate as BaseDensity
    : "quad";
}

function readLayers(): LayerFlags {
  const raw = params().get("layers");
  if (raw === null || raw === "all") { return { ...ALL_LAYERS }; }
  if (raw === "none") { return { ...NO_LAYERS }; }
  const wanted = new Set(raw.split(",").map((part) => part.trim()));
  const flags = { ...NO_LAYERS };
  for (const key of LAYER_KEYS) {
    if (wanted.has(key)) { flags[key] = true; }
  }
  return flags;
}

function readNumber(name: string, fallback: number, low: number, high: number): number {
  const raw = params().get(name);
  if (raw === null) { return fallback; }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= low && parsed <= high ? parsed : fallback;
}

function readFreeze(): number | undefined {
  const raw = params().get("freeze");
  if (raw === null) { return undefined; }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isCapture(): boolean {
  return params().get("capture") === "1";
}

export function FlatProceduralPrototype() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<FlatSceneHandle | null>(null);
  const [cost, setCost] = useState<CostReport | null>(null);
  const [view] = useState<SceneView>(readView);
  const [anim] = useState<HeroAnim>(readAnim);
  const [base] = useState<BaseDensity>(readBase);
  const capture = isCapture();
  const animInfo = heroAnimations.find((item) => item.key === anim) ?? heroAnimations[0];

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) { return; }
    const currentView = readView();
    const handle = mountFlatScene(host, {
      anim: readAnim(),
      base: readBase(),
      fodderPerSide: readNumber("fodder", 18, 0, 40),
      freezeMs: readFreeze(),
      heroesPerSide: readNumber("heroes", 2, 0, 6),
      layers: readLayers(),
      motion: params().get("motion") === "1",
      scale: readNumber("scale", 1, 1, 3),
      ...(readNumber("strip", 0, 0, 80) > 0
        ? {
            strip: {
              columns: readNumber("cols", 6, 1, 12),
              fps: readNumber("fps", 15, 2, 60),
              frames: readNumber("strip", 0, 0, 80),
              from: readNumber("from", 0, 0, 60000),
            },
          }
        : {}),
      view: currentView,
      zoom: readNumber(
        "zoom",
        currentView === "crowd" ? CROWD_ZOOM : (currentView === "lineup" ? 0.95 : COMBAT_ZOOM),
        0.2,
        4,
      ),
    });
    handleRef.current = handle;
    const timer = globalThis.setInterval(() => { setCost(handle.cost()); }, 500);
    setCost(handle.cost());
    return () => {
      globalThis.clearInterval(timer);
      handleRef.current = null;
      handle.destroy();
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {!capture && (
        <header className="flex flex-wrap items-center gap-3 font-data text-[10px] uppercase">
          <StatusChip tone="neutral">
            {view === "crowd" ? "crowd" : animInfo.name}
          </StatusChip>
          <StatusChip tone="acid">
            {`base=${base} · ${BASE_KEY_COUNT[base]} keys/clip`}
          </StatusChip>
        </header>
      )}

      <div
        ref={hostRef}
        data-testid="flat-stage"
        className="self-start border-2 border-line shadow-hard-lg"
        style={{ minHeight: STAGE_HEIGHT, minWidth: STAGE_WIDTH }}
      />

      {!capture && (
        <div className="flex flex-col gap-2">
          <p className="max-w-2xl text-sm text-ink-dim">{animInfo.law}</p>
          {cost !== null && (
            <dl className="grid max-w-md grid-cols-2 gap-x-6 font-data text-[10px] text-ink-dim uppercase">
              <dt>units</dt>
              <dd>{`${cost.units} — ${cost.heroes} hero / ${cost.fodder} fodder`}</dd>
              <dt>draw calls</dt>
              <dd>{cost.drawCalls}</dd>
              <dt>triangles</dt>
              <dd>{cost.triangles}</dd>
              <dt>frame ms mean / p95</dt>
              <dd>{`${cost.frameMs.mean} / ${cost.frameMs.p95}`}</dd>
              <dt>authored keys total</dt>
              <dd>{cost.authoredKeysTotal}</dd>
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
