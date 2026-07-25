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

import { buildRoster, type CrowdUnit, crowdCueAt, type Treatment } from "./crowd.ts";
import {
  ART_SCALE,
  ATLAS_PUBLIC_DIR,
  BOARD_OFFSET,
  type ClipSpec,
  configByKey,
  type CrowdConfig,
  STAGE_HEIGHT,
  STAGE_WIDTH,
} from "./framing.ts";
import { INK } from "./palette.ts";
import { loadBoardTexture, shadowTexture } from "./scene.ts";

const base = `/${ATLAS_PUBLIC_DIR}`;

export interface CrowdMountOptions {
  config: CrowdConfig;
  treatment: Treatment;
  /** Deterministic capture: render exactly this clock value and hold. */
  freezeMs?: number;
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
    const candidate = new Application();
    await candidate.init({
      antialias: false,
      autoDensity: true,
      background: INK,
      height: STAGE_HEIGHT,
      resolution: globalThis.devicePixelRatio || 1,
      roundPixels: true,
      width: STAGE_WIDTH,
    });
    const [{ sheet, units }, board] = await Promise.all([
      loadCrowdSheet(options.config.atlas),
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

    const boardSprite = new Sprite(board);
    boardSprite.position.set(BOARD_OFFSET.x, BOARD_OFFSET.y);
    world.addChild(boardSprite);

    const roster = buildRoster(options.config);
    // Shadows all go down first so no unit's shadow lands on top of the unit
    // in front of it — at 22 px that misreads as a hole in the ground.
    const shadowLayer = new Container();
    const unitLayer = new Container();
    world.addChild(shadowLayer);
    world.addChild(unitLayer);

    const drawables: { unit: CrowdUnit; sprite: Sprite; clips: readonly ClipSpec[] }[] = [];
    for (const unit of roster) {
      const meta = units[unit.unit];
      if (meta === undefined) { throw new Error(`atlas has no unit ${unit.unit}`); }

      const shadowWidth = Math.max(5, Math.round(meta.cell.w * 0.42));
      const shadow = new Sprite(shadowTexture(shadowWidth, Math.max(3, Math.round(shadowWidth * 0.4))));
      shadow.anchor.set(0.5, 0.5);
      shadow.position.set(Math.round(unit.x), Math.round(unit.y) + 1);
      shadowLayer.addChild(shadow);

      const sprite = new Sprite();
      sprite.anchor.set(meta.anchor.x / meta.cell.w, meta.anchor.y / meta.cell.h);
      sprite.position.set(Math.round(unit.x), Math.round(unit.y));
      unitLayer.addChild(sprite);
      drawables.push({ clips: meta.clips, sprite, unit });
    }

    const draw = (elapsedMs: number): void => {
      for (const drawable of drawables) {
        const cue = crowdCueAt(drawable.unit, drawable.clips, elapsedMs, options.treatment);
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

export { configByKey };
