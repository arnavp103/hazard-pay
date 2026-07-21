/**
 * Imperative PixiJS v8 stage for the match-proto hello render (#27).
 *
 * This is the reference mount pattern for the real match view, per the
 * rendering research (#26, docs/research/match-view-rendering.md): Pixi
 * mounted imperatively from a React effect — NO @pixi/react. React owns
 * routing and the HUD chrome; this module owns the canvas, the scene
 * graph, and the frame loop. The only contract between the two worlds is
 * `MatchStageHandle`.
 *
 * Lifecycle hazard this module absorbs: `Application.init()` is async,
 * but React (especially StrictMode's mount→unmount→mount in dev) may call
 * the effect cleanup before init resolves. `mountMatchStage` therefore
 * returns synchronously and internally races init against `destroy()`:
 * a destroy that lands first prevents the canvas from ever attaching and
 * still tears the renderer down once init settles. Nothing leaks on
 * route change or remount.
 */

import { AnimatedSprite, Application, BufferImageSource, Sprite, Texture } from "pixi.js";

import {
  buildCharacterFrames,
  characters,
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
  type CharacterSpriteSpec,
} from "./sprites.ts";

/** Logical canvas size; DPR is handled by resolution+autoDensity. */
export const STAGE_WIDTH = 480;
export const STAGE_HEIGHT = 270;
/** Integer art-pixel scale — keep it whole for crisp nearest-neighbor. */
const SCALE = 6;
const FLOOR_Y = 240;

export interface MatchStageHandle {
  /**
   * Settles once the canvas is attached and animating — or once a
   * pre-empting destroy() has been honored. Never rejects on the destroy
   * race; genuine init failures do reject so callers can surface them.
   */
  ready: Promise<void>;
  /** Idempotent. Detaches the canvas and destroys the renderer, scene and textures. */
  destroy: () => void;
}

function buildTextures(spec: CharacterSpriteSpec): Texture[] {
  return buildCharacterFrames(spec).map(
    (pixels) =>
      new Texture({
        source: new BufferImageSource({
          resource: pixels,
          width: SPRITE_WIDTH,
          height: SPRITE_HEIGHT,
          // Nearest-neighbor at the texture source — the research's crisp
          // pixel-art requirement — instead of mutating
          // TextureStyle.defaultOptions globally.
          scaleMode: "nearest",
        }),
      }),
  );
}

/**
 * Mount the prototype stage into `host`. Synchronous by design — see the
 * module docs for the init/destroy race it manages.
 *
 * SEAM (real match view): this signature grows into
 * `mountMatchStage(host, matchEventSource)` — resolutions arrive as
 * ordered match-event batches and the ticker callback below becomes the
 * presentation-pace animator that drains them. The handle stays the sole
 * React↔renderer boundary.
 */
export function mountMatchStage(host: HTMLElement): MatchStageHandle {
  let destroyed = false;
  let app: Application | undefined;

  const ready = (async () => {
    const candidate = new Application();
    await candidate.init({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      background: "#120b10", // --hp-shell
      // The research-mandated DPR trio: backing store scaled by DPR,
      // CSS size kept logical, positions snapped to device pixels.
      resolution: globalThis.devicePixelRatio || 1,
      autoDensity: true,
      roundPixels: true,
      antialias: false,
    });

    if (destroyed) {
      // React cleanup won the race (StrictMode dev double-mount, or a
      // fast route change): never attach, free the GPU context.
      candidate.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
      return;
    }
    app = candidate;

    // --- scene ------------------------------------------------------
    // SEAM (real match view): everything below is throwaway staging. The
    // real scene is built from match participants and updated by match
    // events; only the mount/teardown shell around it carries over.
    const floor = new Sprite(Texture.WHITE);
    floor.tint = 0x251826; // --hp-panel-2
    floor.position.set(0, FLOOR_Y);
    floor.setSize(STAGE_WIDTH, STAGE_HEIGHT - FLOOR_Y);
    app.stage.addChild(floor);

    const floorEdge = new Sprite(Texture.WHITE);
    floorEdge.tint = 0x3d2939; // --hp-line
    floorEdge.position.set(0, FLOOR_Y);
    floorEdge.setSize(STAGE_WIDTH, 2);
    app.stage.addChild(floorEdge);

    const fighters = characters.map((spec, i) => {
      const shadow = new Sprite(Texture.WHITE);
      shadow.tint = 0x000000;
      shadow.alpha = 0.4;
      shadow.anchor.set(0.5, 0.5);
      shadow.position.set(STAGE_WIDTH * (i === 0 ? 0.33 : 0.67), FLOOR_Y + 5);
      shadow.setSize((SPRITE_WIDTH - 4) * SCALE, SCALE);

      const sprite = new AnimatedSprite(buildTextures(spec));
      sprite.anchor.set(0.5, 1); // feet on the floor line
      sprite.scale.set(SCALE);
      sprite.position.set(shadow.x, FLOOR_Y);
      // Slow two-frame idle flicker; slightly desynced per fighter.
      sprite.animationSpeed = i === 0 ? 0.03 : 0.045;
      sprite.play();

      if (app !== undefined) { app.stage.addChild(shadow, sprite); }
      return { sprite, baseY: FLOOR_Y, phase: i * Math.PI };
    });

    // --- frame loop -------------------------------------------------
    // SEAM (real match view): this callback is where presentation-pace
    // animation of resolution batches happens (CONTEXT.md: clients
    // animate match events at their own pace). Simulation state never
    // lives here — the loop only projects it.
    let elapsedMS = 0;
    app.ticker.add((ticker) => {
      elapsedMS += ticker.deltaMS;
      for (const f of fighters) {
        // One-art-pixel breathing bob, quantized to the integer scale so
        // sprites never land between device pixels.
        const bob = Math.round(Math.sin(elapsedMS / 480 + f.phase) * 1.2) * SCALE;
        f.sprite.y = f.baseY + bob;
      }
    });

    host.appendChild(app.canvas);
  })();

  return {
    ready,
    destroy: () => {
      if (destroyed) { return; }
      destroyed = true;
      if (app !== undefined) {
        // removeView detaches the canvas from `host`; children+texture(+
        // Source) free the scene graph and the GPU-side sprite frames.
        app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
        app = undefined;
      }
      // If init is still in flight, the race check above finishes the job.
    },
  };
}
