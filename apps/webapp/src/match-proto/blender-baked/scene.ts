/**
 * THROWAWAY PROTOTYPE (#82): the lane's actual pitch — baked sprites running
 * in the REAL 2D runtime. PixiJS v8, mounted imperatively from a React effect
 * exactly like `../stage.ts` (the #26/#27 pattern); nothing here is a 3D
 * renderer. The only thing that changed versus a hand-authored pixel lane is
 * where the frames came from.
 *
 * Everything lives inside one container scaled by ART_SCALE, so the whole
 * frame — board, shadow, unit — sits on a single art-pixel grid and gets one
 * nearest-neighbour blow-up. The board is rasterised at art resolution and
 * pushed through the SAME `image-q` palette call as the sprites, so character
 * and environment cannot end up on different colour systems.
 */

import { Application, Assets, Container, Sprite, Spritesheet, Texture } from "pixi.js";

import { cueAt, type Mode, trackKey, TURN_CYCLE_MS } from "./cues.ts";
import {
  ANCHOR,
  ART_SCALE,
  ATLAS_BASENAME,
  ATLAS_PUBLIC_DIR,
  BOARD_HEIGHT,
  BOARD_OFFSET,
  BOARD_WIDTH,
  CELL,
  FEET,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "./framing.ts";
import { hexToRgb, INK, quantizeToPalette } from "./palette.ts";

export { STAGE_HEIGHT, STAGE_WIDTH, TURN_CYCLE_MS };
export type { Mode };

export interface MountOptions {
  mode: Mode;
  facing: number;
  zoom?: number;
  /** Deterministic capture: render exactly this clock value and hold. */
  freezeMs?: number;
}

export interface BakedStageHandle {
  ready: Promise<void>;
  setMode: (mode: Mode) => void;
  setFacing: (facing: number) => void;
  destroy: () => void;
}

const base = `/${ATLAS_PUBLIC_DIR}`;

/**
 * Rasterise the shared grime-market SVG straight to art resolution — the
 * vector is re-rendered at 336x144, not downsampled from 840x360 — then force
 * it onto the Direction B palette.
 */
async function loadBoardTexture(): Promise<Texture> {
  const image = new Image();
  image.src = `${base}/grime-market-board.svg`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = BOARD_WIDTH;
  canvas.height = BOARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (context === null) { throw new Error("no 2d context for the board raster"); }
  context.drawImage(image, 0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const pixels = context.getImageData(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  quantizeToPalette(pixels.data, BOARD_WIDTH, BOARD_HEIGHT);
  context.putImageData(pixels, 0, 0);

  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}

/** Hard-edged contact shadow, built on the art grid so it never gets a soft edge. */
function shadowTexture(): Texture {
  const width = 15;
  const height = 6;
  const [r, g, b] = hexToRgb(INK);
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x - (width - 1) / 2) / (width / 2);
      const ny = (y - (height - 1) / 2) / (height / 2);
      if (nx * nx + ny * ny > 1) { continue; }
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 0x8c;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) { throw new Error("no 2d context for the shadow"); }
  context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
}

async function loadSheet(): Promise<Spritesheet> {
  const texture: Texture = await Assets.load({
    src: `${base}/${ATLAS_BASENAME}.png`,
    data: { scaleMode: "nearest" },
  });
  texture.source.scaleMode = "nearest";
  const response = await fetch(`${base}/${ATLAS_BASENAME}.json`);
  const sheet = new Spritesheet(texture, await response.json());
  await sheet.parse();
  return sheet;
}

export function mountBakedStage(host: HTMLElement, options: MountOptions): BakedStageHandle {
  let destroyed = false;
  let app: Application | undefined;
  let mode = options.mode;
  let facing = options.facing;
  const zoom = options.zoom ?? 1;

  const ready = (async () => {
    const candidate = new Application();
    await candidate.init({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      background: INK,
      resolution: globalThis.devicePixelRatio || 1,
      autoDensity: true,
      roundPixels: true,
      antialias: false,
    });
    const [sheet, board] = await Promise.all([loadSheet(), loadBoardTexture()]);
    if (destroyed) {
      candidate.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
      return;
    }
    app = candidate;

    // One container, one integer scale: board and unit share a pixel grid.
    const world = new Container();
    world.scale.set(ART_SCALE * zoom);
    app.stage.addChild(world);

    const boardSprite = new Sprite(board);
    boardSprite.position.set(BOARD_OFFSET.x, BOARD_OFFSET.y);
    world.addChild(boardSprite);

    const shadow = new Sprite(shadowTexture());
    shadow.anchor.set(0.5, 0.5);
    shadow.position.set(FEET.x, FEET.y + 1);
    world.addChild(shadow);

    const medic = new Sprite();
    medic.anchor.set(ANCHOR.x / CELL.width, ANCHOR.y / CELL.height);
    medic.position.set(FEET.x, FEET.y);
    world.addChild(medic);

    // Keep the framing steady while zoomed: pin the unit's feet in place.
    if (zoom !== 1) {
      world.position.set(
        FEET.x * ART_SCALE - FEET.x * ART_SCALE * zoom,
        FEET.y * ART_SCALE - FEET.y * ART_SCALE * zoom,
      );
    }

    const draw = (elapsedMs: number): void => {
      const cue = cueAt(mode, elapsedMs, facing);
      const track = sheet.animations[trackKey(cue)];
      const texture = track?.[cue.frame];
      if (texture !== undefined) { medic.texture = texture; }
    };

    const { freezeMs } = options;
    if (freezeMs === undefined) {
      let elapsedMs = 0;
      app.ticker.add((ticker) => {
        elapsedMs += ticker.deltaMS;
        draw(elapsedMs);
      });
    } else {
      app.ticker.stop();
      draw(freezeMs);
      app.render();
    }

    host.appendChild(app.canvas);
    // A capture hook: the harness waits for this instead of a fixed sleep.
    host.setAttribute("data-baked-stage", "ready");
  })();

  return {
    ready,
    destroy: () => {
      if (destroyed) { return; }
      destroyed = true;
      if (app !== undefined) {
        app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
        app = undefined;
      }
    },
    setFacing: (next) => { facing = ((next % 8) + 8) % 8; },
    setMode: (next) => { mode = next; },
  };
}

/** Every art pixel this lane can put on screen comes from these two files. */
export const RUNTIME_ASSETS = [`${base}/${ATLAS_BASENAME}.png`, `${base}/${ATLAS_BASENAME}.json`] as const;

/** Where the quantization-comparison strips live, for the route's panel. */
export const COMPARISON_STRIPS = [
  { key: "shrunk", label: "8x render, box-downsampled", note: "the naive shrink" },
  { key: "native", label: "1x render, no filter", note: "straight out of Cycles" },
  { key: "quantized", label: "+ Direction B palette", note: "33 entries, CIEDE2000" },
  { key: "inked", label: "+ 1px contour & seams", note: "what ships in the atlas" },
] as const;

export function stripUrl(key: string): string {
  return `${base}/compare-${key}.png`;
}
