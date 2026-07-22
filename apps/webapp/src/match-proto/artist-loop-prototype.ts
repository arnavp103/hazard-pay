/**
 * THROWAWAY PROTOTYPE (#67): five planted art-direction variants for the
 * render -> screenshot -> cold-critique loop. The neutral names deliberately
 * hide which variants are controls and which carry planted direction faults.
 *
 * The scene is authored as deterministic pixels, then uploaded to Pixi as one
 * nearest-neighbour texture. That keeps the critic experiment about the art,
 * while the mount proves the same WebGL/SwiftShader capture path the eventual
 * asset harness can use.
 */

import { Application, BufferImageSource, Sprite, Texture } from "pixi.js";

export const ARTIST_LOOP_STAGE_WIDTH = 480;
export const ARTIST_LOOP_STAGE_HEIGHT = 270;

const ART_WIDTH = 160;
const ART_HEIGHT = 90;
const ART_SCALE = 3;

export const artistLoopVariants = [
  { key: "A", name: "Plum Relay" },
  { key: "B", name: "Rust Circuit" },
  { key: "C", name: "Ultraviolet Rain" },
  { key: "D", name: "Soft Signal" },
  { key: "E", name: "Hex Exchange" },
] as const;

export type ArtistLoopVariantKey = (typeof artistLoopVariants)[number]["key"];

interface ScenePalette {
  sky: string;
  far: string;
  middle: string;
  near: string;
  street: string;
  ink: string;
  light: string;
  accentA: string;
  accentB: string;
  skinA: string;
  skinB: string;
}

const palettes: Record<ArtistLoopVariantKey, ScenePalette> = {
  A: {
    sky: "#120b10",
    far: "#20131f",
    middle: "#301b2d",
    near: "#44233c",
    street: "#211820",
    ink: "#09070a",
    light: "#f2d8c9",
    accentA: "#ff2e6c",
    accentB: "#c8f031",
    skinA: "#d99e6a",
    skinB: "#85503d",
  },
  B: {
    sky: "#101419",
    far: "#1c2630",
    middle: "#303b40",
    near: "#56433b",
    street: "#24282b",
    ink: "#090b0d",
    light: "#f3dfbd",
    accentA: "#ef713e",
    accentB: "#45d6bd",
    skinA: "#c98f68",
    skinB: "#6f4939",
  },
  C: {
    sky: "#221b5e",
    far: "#3f2d89",
    middle: "#6744ad",
    near: "#8b4fc0",
    street: "#273d8c",
    ink: "#251c62",
    light: "#bffcff",
    accentA: "#ff4fe1",
    accentB: "#35f6ff",
    skinA: "#dd91c6",
    skinB: "#8655a7",
  },
  D: {
    sky: "#1b1822",
    far: "#2d2934",
    middle: "#49414e",
    near: "#665b67",
    street: "#514b54",
    ink: "#514b54",
    light: "#d6ced3",
    accentA: "#cc7b96",
    accentB: "#aebb86",
    skinA: "#caa38d",
    skinB: "#96776c",
  },
  E: {
    sky: "#120b10",
    far: "#20131f",
    middle: "#301b2d",
    near: "#44233c",
    street: "#211820",
    ink: "#09070a",
    light: "#f2d8c9",
    accentA: "#ff2e6c",
    accentB: "#c8f031",
    skinA: "#d99e6a",
    skinB: "#85503d",
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

class PixelCanvas {
  readonly pixels = new Uint8Array(ART_WIDTH * ART_HEIGHT * 4);

  set(x: number, y: number, color: string): void {
    if (x < 0 || y < 0 || x >= ART_WIDTH || y >= ART_HEIGHT) { return; }
    const [r, g, b] = hexToRgb(color);
    const offset = (y * ART_WIDTH + x) * 4;
    this.pixels[offset] = r;
    this.pixels[offset + 1] = g;
    this.pixels[offset + 2] = b;
    this.pixels[offset + 3] = 0xff;
  }

  rect(x: number, y: number, width: number, height: number, color: string): void {
    for (let drawY = y; drawY < y + height; drawY += 1) {
      for (let drawX = x; drawX < x + width; drawX += 1) {
        this.set(drawX, drawY, color);
      }
    }
  }

  outlineRect(x: number, y: number, width: number, height: number, color: string): void {
    this.rect(x, y, width, 1, color);
    this.rect(x, y + height - 1, width, 1, color);
    this.rect(x, y, 1, height, color);
    this.rect(x + width - 1, y, 1, height, color);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, width = 1): void {
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    let x = x0;
    let y = y0;

    while (true) {
      this.rect(x, y, width, width, color);
      if (x === x1 && y === y1) { break; }
      const doubled = 2 * error;
      if (doubled >= dy) {
        error += dy;
        x += sx;
      }
      if (doubled <= dx) {
        error += dx;
        y += sy;
      }
    }
  }
}

function drawWindows(canvas: PixelCanvas, palette: ScenePalette): void {
  for (let x = 4; x < ART_WIDTH; x += 13) {
    const height = 14 + (x % 19);
    canvas.rect(x, 31 - height, 9, height, palette.far);
    canvas.rect(x + 2, 34 - height, 2, 1, x % 2 === 0 ? palette.accentA : palette.light);
  }
}

function drawStreet(canvas: PixelCanvas, palette: ScenePalette, variant: ArtistLoopVariantKey): void {
  canvas.rect(0, 0, ART_WIDTH, ART_HEIGHT, palette.sky);
  drawWindows(canvas, palette);
  canvas.rect(0, 30, ART_WIDTH, 39, palette.middle);
  canvas.rect(0, 55, ART_WIDTH, 15, palette.near);
  canvas.rect(0, 70, ART_WIDTH, 20, palette.street);
  canvas.rect(0, 69, ART_WIDTH, 2, palette.ink);

  canvas.rect(4, 39, 37, 25, palette.near);
  canvas.outlineRect(4, 39, 37, 25, palette.ink);
  canvas.rect(8, 43, 29, 7, palette.ink);
  canvas.rect(10, 45, 18, 2, palette.accentA);
  canvas.rect(31, 44, 3, 4, palette.accentB);
  canvas.rect(8, 54, 7, 9, palette.middle);
  canvas.rect(18, 54, 19, 9, palette.middle);
  canvas.outlineRect(18, 54, 19, 9, palette.ink);

  canvas.rect(121, 34, 35, 31, palette.near);
  canvas.outlineRect(121, 34, 35, 31, palette.ink);
  canvas.rect(126, 39, 25, 12, palette.ink);
  canvas.rect(129, 42, 19, 2, palette.accentB);
  canvas.rect(129, 46, 12, 2, palette.accentA);
  canvas.rect(126, 55, 10, 9, palette.middle);
  canvas.rect(140, 55, 11, 9, palette.middle);

  canvas.line(0, 25, 56, 35, palette.ink);
  canvas.line(56, 35, 118, 21, palette.ink);
  canvas.line(118, 21, 159, 28, palette.ink);
  for (let x = 3; x < 158; x += 19) {
    canvas.rect(x, 76, 11, 2, palette.near);
  }
  for (let x = 7; x < 156; x += 11) {
    canvas.set(x, 61 - (x % 7), palette.ink);
    if (x % 3 === 0) { canvas.set(x + 2, 62 - (x % 5), palette.ink); }
  }
  canvas.line(24, 65, 31, 61, palette.ink);
  canvas.line(31, 61, 34, 64, palette.ink);
  canvas.line(145, 66, 151, 60, palette.ink);

  if (variant === "A" || variant === "B") {
    for (let x = 68; x < 94; x += 4) {
      canvas.line(x, 70, x + 5, 75, x % 8 === 0 ? palette.accentB : palette.ink);
    }
    for (let y = 36; y < 62; y += 5) {
      canvas.set(44 + (y % 3), y, palette.accentA);
      canvas.set(116 - (y % 4), y, palette.accentB);
    }
  }

  if (variant === "C") {
    for (let x = 46; x < 116; x += 8) {
      canvas.rect(x, 57 + (x % 3), 3, 1, x % 16 === 0 ? palette.accentA : palette.accentB);
    }
  }

  if (variant === "E") {
    drawFantasyIntrusions(canvas, palette);
  }
}

function drawFantasyIntrusions(canvas: PixelCanvas, palette: ScenePalette): void {
  canvas.line(63, 41, 80, 31, palette.ink, 2);
  canvas.line(80, 31, 97, 41, palette.ink, 2);
  canvas.rect(66, 41, 29, 3, palette.accentA);
  canvas.rect(69, 44, 23, 10, palette.ink);
  canvas.line(71, 46, 74, 52, palette.accentB);
  canvas.line(74, 52, 78, 46, palette.accentB);
  canvas.line(82, 46, 82, 52, palette.accentB);
  canvas.line(89, 46, 85, 52, palette.accentB);

  canvas.line(10, 38, 18, 23, palette.light, 2);
  canvas.line(9, 28, 20, 34, palette.light);
  canvas.rect(132, 23, 12, 2, palette.ink);
  canvas.rect(133, 25, 10, 10, palette.ink);
  canvas.rect(135, 26, 6, 7, palette.accentA);
  canvas.line(138, 26, 138, 32, palette.light);
  canvas.line(135, 29, 141, 29, palette.light);
}

interface CharacterOptions {
  x: number;
  baseline: number;
  palette: ScenePalette;
  accent: string;
  skin: string;
  outlined: boolean;
  armored?: boolean;
  sword?: boolean;
}

function drawCharacter(canvas: PixelCanvas, options: CharacterOptions): void {
  const { x, baseline, palette, accent, skin, outlined, armored = false, sword = false } = options;
  const edge = outlined ? palette.ink : palette.near;
  const detail = outlined ? palette.ink : palette.middle;
  const shadow = outlined ? palette.ink : palette.street;

  if (armored) {
    canvas.rect(x - 12, baseline + 1, 25, 3, shadow);
    canvas.rect(x - 8, baseline - 11, 6, 11, edge);
    canvas.rect(x + 3, baseline - 11, 6, 11, edge);
    canvas.rect(x - 6, baseline - 9, 3, 8, palette.near);
    canvas.rect(x + 4, baseline - 9, 3, 8, palette.near);
    canvas.rect(x - 13, baseline - 27, 27, 5, edge);
    canvas.rect(x - 10, baseline - 29, 21, 20, edge);
    canvas.rect(x - 8, baseline - 26, 17, 14, palette.middle);
    canvas.rect(x - 11, baseline - 25, 6, 7, accent);
    canvas.rect(x + 6, baseline - 25, 6, 7, accent);
    canvas.rect(x - 4, baseline - 23, 9, 8, palette.near);
    canvas.rect(x - 2, baseline - 21, 5, 3, palette.light);
    canvas.rect(x - 7, baseline - 36, 15, 9, edge);
    canvas.rect(x - 5, baseline - 34, 11, 6, palette.near);
    canvas.rect(x - 3, baseline - 32, 7, 2, accent);
    canvas.rect(x - 1, baseline - 32, 3, 1, palette.light);
    canvas.line(x + 11, baseline - 18, x + 19, baseline - 23, edge, 2);
    canvas.rect(x + 17, baseline - 25, 8, 4, accent);
    canvas.rect(x + 23, baseline - 24, 4, 1, palette.light);
    return;
  }

  canvas.rect(x - 10, baseline + 1, 22, 3, shadow);
  canvas.rect(x - 5, baseline - 11, 4, 11, edge);
  canvas.rect(x + 3, baseline - 10, 4, 10, edge);
  canvas.rect(x - 3, baseline - 9, 2, 8, palette.near);
  canvas.rect(x + 4, baseline - 8, 2, 7, palette.near);
  canvas.rect(x - 8, baseline - 25, 17, 16, edge);
  canvas.rect(x - 6, baseline - 23, 13, 11, accent);
  canvas.rect(x - 7, baseline - 13, 5, 6, edge);
  canvas.rect(x + 1, baseline - 12, 8, 5, edge);
  canvas.rect(x - 11, baseline - 22, 4, 12, edge);
  canvas.rect(x - 10, baseline - 20, 2, 8, skin);
  canvas.rect(x + 8, baseline - 21, 3, 10, edge);
  canvas.rect(x + 9, baseline - 19, 2, 7, skin);
  canvas.rect(x - 7, baseline - 34, 12, 10, edge);
  canvas.rect(x - 5, baseline - 32, 8, 7, skin);
  canvas.rect(x - 8, baseline - 36, 10, 4, edge);
  canvas.rect(x - 8, baseline - 33, 3, 5, edge);
  canvas.rect(x - 3, baseline - 31, 6, 2, accent);
  canvas.rect(x - 1, baseline - 30, 3, 1, palette.light);
  canvas.line(x - 6, baseline - 20, x + 6, baseline - 14, detail, 2);
  canvas.rect(x - 11, baseline - 17, 6, 7, edge);
  canvas.rect(x - 9, baseline - 15, 3, 3, palette.near);

  if (sword) {
    canvas.line(x + 11, baseline - 13, x + 17, baseline - 29, palette.light, 2);
    canvas.line(x + 10, baseline - 17, x + 16, baseline - 15, accent);
    canvas.rect(x - 14, baseline - 22, 6, 9, edge);
    canvas.rect(x - 12, baseline - 20, 3, 5, accent);
    canvas.line(x - 12, baseline - 18, x - 9, baseline - 18, palette.light);
  } else {
    canvas.line(x + 10, baseline - 15, x + 17, baseline - 19, edge, 2);
    canvas.rect(x + 15, baseline - 21, 7, 3, accent);
    canvas.rect(x + 20, baseline - 20, 4, 1, palette.light);
  }
}

function buildScene(variant: ArtistLoopVariantKey): Uint8Array {
  const canvas = new PixelCanvas();
  const palette = palettes[variant];
  drawStreet(canvas, palette, variant);
  const outlined = variant !== "D";
  drawCharacter(canvas, {
    x: 57,
    baseline: 73,
    palette,
    accent: palette.accentA,
    skin: palette.skinA,
    outlined,
    sword: variant === "E",
  });
  drawCharacter(canvas, {
    x: 104,
    baseline: 73,
    palette,
    accent: palette.accentB,
    skin: palette.skinB,
    outlined,
    armored: true,
  });
  return canvas.pixels;
}

function destroyApplication(app: Application): void {
  app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
}

export interface ArtistLoopStageHandle {
  ready: Promise<void>;
  destroy: () => void;
}

export function mountArtistLoopStage(
  host: HTMLElement,
  variant: ArtistLoopVariantKey,
): ArtistLoopStageHandle {
  let destroyed = false;
  let app: Application | undefined;

  const ready = (async () => {
    const candidate = new Application();
    await candidate.init({
      width: ARTIST_LOOP_STAGE_WIDTH,
      height: ARTIST_LOOP_STAGE_HEIGHT,
      background: palettes[variant].sky,
      resolution: 1,
      autoDensity: false,
      roundPixels: true,
      antialias: false,
      preference: "webgl",
    });
    if (destroyed) {
      destroyApplication(candidate);
      return;
    }
    app = candidate;

    const texture = new Texture({
      source: new BufferImageSource({
        resource: buildScene(variant),
        width: ART_WIDTH,
        height: ART_HEIGHT,
        scaleMode: "nearest",
      }),
    });
    const scene = new Sprite(texture);
    scene.scale.set(ART_SCALE);
    app.stage.addChild(scene);
    host.appendChild(app.canvas);
  })();

  return {
    ready,
    destroy: () => {
      if (destroyed) { return; }
      destroyed = true;
      if (app !== undefined) {
        destroyApplication(app);
        app = undefined;
      }
    },
  };
}
