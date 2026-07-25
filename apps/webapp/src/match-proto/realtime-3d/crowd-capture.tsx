/**
 * THROWAWAY PROTOTYPE (#81): the round-3 capture surface.
 *
 * Every artifact this round ships is produced here, in one page load, and
 * parked on `window.__cap` as a name -> canvas map for the capture driver to
 * pull with `toDataURL`. That shape is deliberate:
 *
 *   - WebGL clears its drawing buffer on composite, so element screenshots of
 *     a live canvas come back blank; `preserveDrawingBuffer` plus
 *     `toDataURL` is the only reliable path.
 *   - Building every frame of every filmstrip in ONE page load, rather than
 *     reloading the route per frame, is the difference between a capture run
 *     that takes seconds and one that takes many minutes.
 *   - Grayscale conversions and 4x loupes are done here rather than in an
 *     external image tool so the pixels that get judged are exactly the
 *     pixels the renderer produced, with no resampling in between.
 *
 * Reached at `/match-proto?view=capture`.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import {
  type CrowdOptions,
  FODDER_SCREEN_HEIGHT,
  MASK_KEY,
  mountCrowd3d,
  type Register,
  REGISTER_PX,
} from "./crowd3d.ts";
import { mountRealtime3d, STAGE_HEIGHT, STAGE_WIDTH } from "./scene3d.ts";

const W = STAGE_WIDTH;
const H = STAGE_HEIGHT;

/**
 * Where the medic stands in the 0.82-zoom aperture, as [x, y, w, h]. Sized to
 * hold the attack's 9 px lunge and the turn's hop without clipping.
 */
const HERO_CROP: [number, number, number, number] = [186, 96, 118, 142];

declare global {
  var __cap: Record<string, HTMLCanvasElement> | undefined;
  var __meta: Record<string, unknown> | undefined;
}

function blank(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx === null) { throw new Error("no 2d context"); }
  return ctx;
}

/** Copy a live WebGL canvas into a plain 2D one that survives the teardown. */
function freeze(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = blank(source.width, source.height);
  context(out).drawImage(source, 0, 0);
  return out;
}

/** Rec.709 luma. The grayscale check every capture has to survive. */
function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function grayscale(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = blank(source.width, source.height);
  const ctx = context(out);
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const value = luma(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

/** Nearest-neighbour magnification — a loupe must not invent pixels. */
function loupe(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
  scale: number,
): HTMLCanvasElement {
  const out = blank(width * scale, height * scale);
  const ctx = context(out);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, x, y, width, height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Crop a frame. The hero clips are captured at the ratified 0.82 framing,
 * where the medic is ~28 px in a 480x270 aperture — correct for judging the
 * still, useless in a filmstrip, where every frame is then 94% board. The
 * filmstrips crop to the subject; the controlled still keeps the full frame.
 */
function crop(source: HTMLCanvasElement, x: number, y: number, width: number, height: number): HTMLCanvasElement {
  const out = blank(width, height);
  const ctx = context(out);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
  return out;
}

/** Lay frames out as a grid sheet; the GIF is cut back out of it downstream. */
function sheet(frames: HTMLCanvasElement[], cols: number): HTMLCanvasElement {
  const first = frames[0];
  if (first === undefined) { return blank(1, 1); }
  const rows = Math.ceil(frames.length / cols);
  const out = blank(first.width * cols, first.height * rows);
  const ctx = context(out);
  frames.forEach((frame, i) => {
    ctx.drawImage(frame, (i % cols) * first.width, Math.floor(i / cols) * first.height);
  });
  return out;
}

function crowdOptions(register: Register, mark: boolean, extra: Partial<CrowdOptions> = {}): CrowdOptions {
  return { height: H, mark, motion: false, register, width: W, ...extra };
}

/** One still, rendered off-DOM and frozen. */
function still(options: CrowdOptions, t: number): HTMLCanvasElement {
  const handle = mountCrowd3d(null, { ...options, freezeMs: t * 1000 });
  handle.renderAt(t);
  const out = freeze(handle.canvas);
  handle.destroy();
  return out;
}

/**
 * The board-contrast measurement escalated on #69: the Blender lane found
 * 53% of silhouette-edge pixels sitting inside the floor's luminance band,
 * i.e. units drawn at 22 px but reading at ~16 px because half the contour
 * dissolves into the ground. This computes the same figure for this lane.
 *
 * The board is NOT changed. It is the control all four lanes are judged
 * against and moving it is a decision above this ticket.
 */
function measureBoardContrast(register: Register): {
  measurement: Record<string, number>;
  overlay: HTMLCanvasElement;
} {
  const composited = still(crowdOptions(register, false), 0);
  const keyed = still(crowdOptions(register, false, { maskMode: true }), 0);
  const board = still(crowdOptions(register, false, { boardOnly: true }), 0);

  const comp = context(composited).getImageData(0, 0, W, H).data;
  const mask = context(keyed).getImageData(0, 0, W, H).data;
  const floor = context(board).getImageData(0, 0, W, H).data;

  const isKey = (data: Uint8ClampedArray, o: number): boolean =>
    data[o] === MASK_KEY[0] && data[o + 1] === MASK_KEY[1] && data[o + 2] === MASK_KEY[2];

  const isUnit = new Uint8Array(W * H);
  const isBoard = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i += 1) {
    const o = i * 4;
    if (!isKey(mask, o)) { isUnit[i] = 1; }
    if (!isKey(floor, o)) { isBoard[i] = 1; }
  }

  // The floor's luminance band, sampled from the ground the crowd is actually
  // standing against — a 14 px collar around the units, on board pixels only.
  //
  // Sampling the whole frame instead is wrong twice over: it averages in the
  // roofs and walls, which the contour is never drawn against, and once the
  // capture clears to the floor tone it averages in a large block of a single
  // constant value that collapses the band to a couple of luma steps and
  // reports a fake 4%. What a contour has to survive is the ground beside it.
  const COLLAR = 14;
  const floorLuma: number[] = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (isUnit[i] === 1 || isBoard[i] !== 1) { continue; }
      let near = false;
      for (let dy = -COLLAR; dy <= COLLAR && !near; dy += COLLAR) {
        for (let dx = -COLLAR; dx <= COLLAR && !near; dx += COLLAR) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) { continue; }
          if (isUnit[ny * W + nx] === 1) { near = true; }
        }
      }
      if (!near) { continue; }
      const o = i * 4;
      floorLuma.push(luma(floor[o] ?? 0, floor[o + 1] ?? 0, floor[o + 2] ?? 0));
    }
  }
  floorLuma.sort((a, b) => a - b);
  const lo = floorLuma[Math.floor(floorLuma.length * 0.1)] ?? 0;
  const hi = floorLuma[Math.floor(floorLuma.length * 0.9)] ?? 255;

  // Silhouette edge: a unit pixel with at least one non-unit 4-neighbour.
  let edges = 0;
  let inBand = 0;
  const edgeFlags: Array<[number, boolean]> = [];
  const deltas: number[] = [];
  for (let y = 1; y < H - 1; y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      const i = y * W + x;
      if (isUnit[i] !== 1) { continue; }
      const open = isUnit[i - 1] !== 1 || isUnit[i + 1] !== 1
        || isUnit[i - W] !== 1 || isUnit[i + W] !== 1;
      if (!open) { continue; }
      edges += 1;
      const o = i * 4;
      const value = luma(comp[o] ?? 0, comp[o + 1] ?? 0, comp[o + 2] ?? 0);
      const dissolved = value >= lo && value <= hi;
      if (dissolved) { inBand += 1; }
      edgeFlags.push([i, dissolved]);
      // Second, simpler read on the same pixels: how far the contour's own
      // value sits from the board value directly underneath it.
      deltas.push(Math.abs(value - luma(floor[o] ?? 0, floor[o + 1] ?? 0, floor[o + 2] ?? 0)));
    }
  }

  // Overlay: dissolved contour in red, surviving contour in green, over a
  // dimmed frame — so the number has a picture and can be sanity-checked.
  const overlay = blank(W, H);
  const octx = context(overlay);
  octx.drawImage(composited, 0, 0);
  const shown = octx.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i += 1) {
    const o = i * 4;
    shown.data[o] = (shown.data[o] ?? 0) * 0.35;
    shown.data[o + 1] = (shown.data[o + 1] ?? 0) * 0.35;
    shown.data[o + 2] = (shown.data[o + 2] ?? 0) * 0.35;
  }
  for (const [i, dissolved] of edgeFlags) {
    const o = i * 4;
    shown.data[o] = dissolved ? 255 : 40;
    shown.data[o + 1] = dissolved ? 40 : 255;
    shown.data[o + 2] = 60;
  }
  octx.putImageData(shown, 0, 0);

  return {
    measurement: {
      dissolvedPct: edges === 0 ? 0 : (inBand / edges) * 100,
      edgePixels: edges,
      floorBandHi: hi,
      floorBandLo: lo,
      inBandPixels: inBand,
      lowContrastPct: deltas.length === 0
        ? 0
        : (deltas.filter((d) => d < 8).length / deltas.length) * 100,
      medianDeltaLuma: deltas.length === 0
        ? 0
        : (deltas.sort((a, b) => a - b)[Math.floor(deltas.length / 2)] ?? 0),
    },
    overlay,
  };
}

/**
 * Yield to the event loop. The build creates ~12 full scenes and renders
 * several hundred frames; done synchronously it pins the main thread hard
 * enough that CDP's `Runtime.evaluate` times out and the page cannot even be
 * asked whether it is finished. Chunking it keeps the surface interrogable
 * and lets the heading report progress as it goes.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

async function build(
  onProgress: (step: string, done: number, total: number) => void,
): Promise<{ captures: Record<string, HTMLCanvasElement>; meta: Record<string, unknown> }> {
  const captures: Record<string, HTMLCanvasElement> = {};
  const meta: Record<string, unknown> = {};
  const registers: Register[] = ["far", "near"];
  const TOTAL = 14;
  let step = 0;
  const advance = async (label: string): Promise<void> => {
    step += 1;
    onProgress(label, step, TOTAL);
    await tick();
  };

  // One handle per (register x marking). Building a 40-unit scene is the
  // expensive part, so every artifact that can be derived from a given scene
  // is derived from the SAME handle rather than remounting it.
  for (const register of registers) {
    for (const mark of [true, false]) {
      const suffix = `${register}-${mark ? "marked" : "unmarked"}`;
      const handle = mountCrowd3d(null, { ...crowdOptions(register, mark), freezeMs: 0 });

      handle.renderAt(0);
      const rest = freeze(handle.canvas);
      captures[`crowd-${suffix}`] = rest;
      captures[`gray-crowd-${suffix}`] = grayscale(rest);
      await advance(`crowd ${suffix}`);

      // 4x loupe, targeted by projecting a known hero rather than by eye.
      const hero = handle.slots.find((slot) => slot.hero && slot.faction === "crew");
      const centre = hero === undefined
        ? [W / 2, H / 2]
        : handle.project(hero.position.clone().setY(0.8));
      const cropW = 132;
      const cropH = 84;
      const cx = Math.max(0, Math.min(W - cropW, Math.round((centre[0] ?? 0) - cropW / 2)));
      const cy = Math.max(0, Math.min(H - cropH, Math.round((centre[1] ?? 0) - cropH / 2)));
      captures[`loupe-${suffix}`] = loupe(rest, cx, cy, cropW, cropH, 4);

      // Motion sheet: only the marked variant, which is the shipping config.
      if (mark) {
        const frames: HTMLCanvasElement[] = [];
        for (let i = 0; i < 24; i += 1) {
          handle.renderAt(i / 8);
          frames.push(freeze(handle.canvas));
        }
        captures[`motion-${register}`] = sheet(frames, 6);
      }

      handle.renderAt(0);
      meta[`cost-${suffix}`] = { ...handle.stats(), ...handle.measure(60) };
      handle.destroy();
      await advance(`cost ${suffix}`);
    }
  }

  // --- un-crowded lineup ---------------------------------------------------
  // Rendered as its own view because it has now caught rigging bugs the
  // single-subject loupe hid on two separate lanes.
  for (const register of registers) {
    const canvas = still(crowdOptions(register, true, { lineup: true }), 0);
    captures[`lineup-${register}`] = canvas;
    captures[`gray-lineup-${register}`] = grayscale(canvas);
    await advance(`lineup ${register}`);
  }

  // --- hero: refreshed controlled still + acted clips on the FIXED rig -----
  const heroHost = document.createElement("div");
  for (const [name, anim, period, frames] of [
    ["idle", "idle", 4.8, 12],
    ["attack", "attack", 1.8, 12],
    ["turn", "turn", 3.7, 16],
  ] as const) {
    const handle = mountRealtime3d(heroHost, null, { anim, freezeMs: 0, motion: false, zoom: 0.82 });
    const shots: HTMLCanvasElement[] = [];
    for (let i = 0; i < frames; i += 1) {
      handle.renderAt((i / frames) * period);
      shots.push(freeze(handle.canvas));
    }
    const first = shots[0];
    if (name === "idle" && first !== undefined) {
      captures["hero-still"] = first;
      captures["gray-hero-still"] = grayscale(first);
      captures["hero-loupe"] = loupe(first, HERO_CROP[0], HERO_CROP[1], HERO_CROP[2], HERO_CROP[3], 4);
    }
    const cropped = shots.map((shot) => crop(shot, HERO_CROP[0], HERO_CROP[1], HERO_CROP[2], HERO_CROP[3]));
    captures[`filmstrip-${name}`] = sheet(cropped, name === "turn" ? 8 : 6);
    captures[`gray-filmstrip-${name}`] = grayscale(sheet(cropped, name === "turn" ? 8 : 6));
    handle.destroy();
    await advance(`hero ${name}`);
  }
  heroHost.remove();

  // --- board contrast, measured and NOT fixed ------------------------------
  for (const register of registers) {
    const { measurement, overlay } = measureBoardContrast(register);
    meta[`boardContrast-${register}`] = measurement;
    captures[`contrast-${register}`] = overlay;
    await advance(`board contrast ${register}`);
  }

  meta.registerPx = REGISTER_PX;
  meta.fodderScreenHeight = FODDER_SCREEN_HEIGHT;
  return { captures, meta };
}

export function CrowdCapture() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [progress, setProgress] = useState("starting");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null || startedRef.current) { return; }
    startedRef.current = true;
    const run = async (): Promise<void> => {
      const { captures, meta } = await build((step, done, total) => {
        setProgress(`${done}/${total} ${step}`);
      });
      globalThis.__cap = captures;
      globalThis.__meta = meta;
      for (const [name, canvas] of Object.entries(captures)) {
        const cell = document.createElement("figure");
        cell.style.margin = "0 0 12px";
        const label = document.createElement("figcaption");
        label.textContent = `${name} — ${canvas.width}x${canvas.height}`;
        label.style.cssText = "font:10px monospace;color:#c9aec0;padding:2px 0";
        canvas.style.cssText = "max-width:100%;image-rendering:pixelated;border:1px solid #3b2936";
        cell.append(label, canvas);
        host.append(cell);
      }
      setNames(Object.keys(captures));
    };
    run().catch((cause: unknown) => {
      setError(cause instanceof Error ? `${cause.message}\n${cause.stack ?? ""}` : String(cause));
    });
  }, []);

  return (
    <main style={{ background: "#120b10", color: "#cfc3b0", minHeight: "100vh", padding: 16 }}>
      <h1 style={{ font: "bold 14px monospace" }} data-capture-ready={error === null ? names.length : 0}>
        {`round-3 captures — ${names.length} artifacts · ${progress}${error === null ? "" : " — FAILED"}`}
      </h1>
      {error === null ? null : <pre style={{ color: "#ff8080", font: "10px monospace", whiteSpace: "pre-wrap" }}>{error}</pre>}
      <div ref={hostRef} />
    </main>
  );
}

export const __keepThree = THREE.REVISION;
