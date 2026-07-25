/**
 * THROWAWAY PROTOTYPE (#82), round 4: the crowd on the real runtime.
 *
 * Same PixiJS v8 stage, same board, same single art-pixel grid as the hero
 * capture — the only difference is that thirty-six sprites are pulling cells
 * out of one indexed atlas instead of one sprite pulling from another. That is
 * the entire pitch of a baked lane at army scale: a crowd costs one texture
 * and one draw batch, and the units are literally the same pixels the board
 * is quantized onto.
 */

import { Application, Assets, Container, Sprite, Spritesheet, type Texture } from "pixi.js";

import {
  buildRoster,
  type CrowdUnit,
  crowdCueAt,
  type MarkMode,
  markedUnitId,
  type Treatment,
} from "./crowd.ts";
import {
  ART_SCALE,
  ATLAS_PUBLIC_DIR,
  BOARD_HEIGHT,
  BOARD_OFFSET,
  BOARD_WIDTH,
  type ClipSpec,
  configByKey,
  type CrowdConfig,
  type StagePreset,
  STAGE_PRESETS,
  stageByKey,
} from "./framing.ts";
import { INK } from "./palette.ts";
import { loadBoardTexture, shadowTexture } from "./scene.ts";

const base = `/${ATLAS_PUBLIC_DIR}`;

export interface CrowdMountOptions {
  config: CrowdConfig;
  treatment: Treatment;
  /** Draw the approved hero marking ring (#69), and how. */
  marking: MarkMode;
  /** Deterministic capture: render exactly this clock value and hold. */
  freezeMs?: number;
  /**
   * Measurement hook, round 5. `board` draws the environment and nothing else,
   * so a capture pair differs by exactly the roster. Subtracting the two gives
   * an exact unit mask AND the background every contour pixel is standing
   * against, which is the only way to measure how much of an outline is
   * actually visible without reconstructing sprite placement by hand.
   */
  layers?: "all" | "board" | "noshadow";
  /**
   * `norim` loads the control atlas: identical renders, round-4's plum-black
   * contour instead of round-5's value-lifted one. Same cells, same schedule,
   * one image pass apart.
   */
  atlasVariant?: "norim" | "shipped";
  /**
   * Which aperture to draw. Round 6's cost question — thinner, taller, higher
   * resolution units mean fewer units on the board, and the premise is large
   * battles — has exactly one lever that is not "make them smaller again", and
   * this is it.
   */
  stage?: StagePreset;
}

export interface CrowdStageHandle {
  ready: Promise<void>;
  destroy: () => void;
}

interface SheetUnitMeta {
  cell: { w: number; h: number };
  anchor: { x: number; y: number };
  clips: ClipSpec[];
  tier: string;
}

async function loadCrowdSheet(atlas: string): Promise<{
  sheet: Spritesheet;
  units: Record<string, SheetUnitMeta>;
}> {
  const texture: Texture = await Assets.load({
    data: { scaleMode: "nearest" },
    src: `${base}/${atlas}.png`,
  });
  texture.source.scaleMode = "nearest";
  const response = await fetch(`${base}/${atlas}.json`);
  const json = await response.json() as {
    meta: { units: Record<string, SheetUnitMeta> };
  };
  const sheet = new Spritesheet(texture, json as never);
  await sheet.parse();
  return { sheet, units: json.meta.units };
}

export function mountCrowdStage(host: HTMLElement, options: CrowdMountOptions): CrowdStageHandle {
  let destroyed = false;
  let app: Application | undefined;

  const ready = (async () => {
    const stage = options.stage ?? (STAGE_PRESETS[0] as StagePreset);
    const candidate = new Application();
    await candidate.init({
      antialias: false,
      autoDensity: true,
      background: INK,
      height: stage.height,
      resolution: globalThis.devicePixelRatio || 1,
      roundPixels: true,
      width: stage.width,
    });
    const atlasName = options.atlasVariant === "norim"
      ? `${options.config.atlas}-norim`
      : options.config.atlas;
    const [{ sheet, units }, board] = await Promise.all([
      loadCrowdSheet(atlasName),
      loadBoardTexture(),
    ]);
    if (destroyed) {
      candidate.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
      return;
    }
    app = candidate;

    const world = new Container();
    world.scale.set(ART_SCALE);
    app.stage.addChild(world);

    // The board art is 336x144 art pixels — it was authored for the 240x135
    // aperture and there is no wider version of it, because it is shared art
    // from #74/#79 and not this lane's to redraw. On the wide stage it is TILED
    // so the units have ground under them. Stated plainly because it is visible:
    // the seams in the 960x540 captures are this, not a rendering bug, and a
    // real wide board would be one drawing rather than four. What the tiling
    // does preserve is the only property under test — the board and the units
    // stay on the same art pixel at the same size.
    const tilesX = Math.ceil((stage.artWidth - BOARD_OFFSET.x) / BOARD_WIDTH);
    const tilesY = Math.ceil((stage.artHeight - BOARD_OFFSET.y) / BOARD_HEIGHT);
    for (let ty = 0; ty < Math.max(1, tilesY); ty += 1) {
      for (let tx = 0; tx < Math.max(1, tilesX); tx += 1) {
        const boardSprite = new Sprite(board);
        boardSprite.position.set(BOARD_OFFSET.x + tx * BOARD_WIDTH, BOARD_OFFSET.y + ty * BOARD_HEIGHT);
        world.addChild(boardSprite);
      }
    }

    const aperture = { artHeight: stage.artHeight, artWidth: stage.artWidth };
    const roster = options.layers === "board" ? [] : buildRoster(options.config, 0x5a17, aperture);
    // Shadows all go down first so no unit's shadow lands on top of the unit
    // in front of it — at 22 px that misreads as a hole in the ground.
    const shadowLayer = new Container();
    const unitLayer = new Container();
    world.addChild(shadowLayer);
    world.addChild(unitLayer);

    const drawables: { unit: CrowdUnit; sprite: Sprite; clips: readonly ClipSpec[] }[] = [];
    for (const unit of roster) {
      const key = markedUnitId(unit, options.marking);
      const meta = units[key];
      if (meta === undefined) { throw new Error(`atlas has no unit ${key}`); }

      const shadowWidth = Math.max(5, Math.round(meta.cell.w * 0.42));
      if (options.layers !== "noshadow") {
        const shadow = new Sprite(shadowTexture(shadowWidth, Math.max(3, Math.round(shadowWidth * 0.4))));
        shadow.anchor.set(0.5, 0.5);
        shadow.position.set(Math.round(unit.x), Math.round(unit.y) + 1);
        shadowLayer.addChild(shadow);
      }

      const sprite = new Sprite();
      sprite.anchor.set(meta.anchor.x / meta.cell.w, meta.anchor.y / meta.cell.h);
      sprite.position.set(Math.round(unit.x), Math.round(unit.y));
      unitLayer.addChild(sprite);
      drawables.push({ clips: meta.clips, sprite, unit });
    }

    const draw = (elapsedMs: number): void => {
      for (const drawable of drawables) {
        const cue = crowdCueAt(
          drawable.unit, drawable.clips, elapsedMs, options.treatment, options.marking,
        );
        const texture = sheet.animations[cue.track]?.[cue.frame];
        if (texture !== undefined) { drawable.sprite.texture = texture; }
      }
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
      const stage = app;
      Object.assign(globalThis, {
        __crowdInfo: {
          config: options.config.key,
          marking: options.marking,
          treatment: options.treatment,
          units: roster.length,
        },
        __crowdStep: (ms: number) => {
          draw(ms);
          stage.render();
        },
      });
    }

    host.appendChild(app.canvas);
    host.setAttribute("data-crowd-stage", "ready");
  })();

  return {
    destroy: () => {
      if (destroyed) { return; }
      destroyed = true;
      if (app !== undefined) {
        app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
        app = undefined;
      }
    },
    ready,
  };
}

export { configByKey, stageByKey };
