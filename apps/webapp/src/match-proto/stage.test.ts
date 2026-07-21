// @vitest-environment jsdom
/**
 * Mount/unmount lifecycle proof for the imperative Pixi mount (#27).
 *
 * pixi.js is mocked: jsdom has no WebGL, and what needs proving here is
 * not Pixi's rendering but OUR contract — every mount attaches exactly
 * one canvas, every destroy detaches and destroys it (including when
 * destroy pre-empts the async init, StrictMode-style), and remounting
 * after a route change starts clean. Pixels are eyeballed in the browser
 * and captured on the PR; honest automation for real rendering would be
 * browser-mode screenshots (see the #26 research, §3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const state = {
    apps: [] as FakeApplication[],
    /** When set, init() parks until the test releases it. */
    gateInit: false,
    pendingInits: [] as (() => void)[],
  };

  class FakePoint {
    x = 0;
    y = 0;
    set(x: number, y = x) {
      this.x = x;
      this.y = y;
    }
  }

  class FakeSprite {
    y = 0;
    tint = 0;
    alpha = 1;
    animationSpeed = 0;
    anchor = new FakePoint();
    scale = new FakePoint();
    position = new FakePoint();
    get x() {
      return this.position.x;
    }

    setSize = vi.fn();
    play = vi.fn();
  }

  class FakeApplication {
    canvas: HTMLCanvasElement | undefined;
    initOptions: unknown;
    stage = { addChild: vi.fn() };
    ticker = { add: vi.fn() };
    destroy = vi.fn((rendererOptions?: { removeView?: boolean }) => {
      if (rendererOptions?.removeView === true) { this.canvas?.remove(); }
    });

    constructor() {
      state.apps.push(this);
    }

    async init(options: unknown) {
      this.initOptions = options;
      if (state.gateInit) {
        await new Promise<void>((resolve) => state.pendingInits.push(resolve));
      }
      this.canvas = document.createElement("canvas");
    }
  }

  class FakeTexture {
    static WHITE = Object.create(FakeTexture.prototype) as FakeTexture;
  }

  return {
    state,
    FakeApplication,
    FakeSprite,
    FakeTexture,
  };
});

vi.mock("pixi.js", () => ({
  Application: fake.FakeApplication,
  Sprite: fake.FakeSprite,
  AnimatedSprite: class extends fake.FakeSprite {},
  Texture: fake.FakeTexture,
  BufferImageSource: class {},
}));

// Import after the mock so stage.ts binds the fakes.
const { mountMatchStage } = await import("./stage.ts");

type FakeApplication = InstanceType<typeof fake.FakeApplication>;

function appAt(index: number): FakeApplication {
  const app = fake.state.apps[index];
  if (app === undefined) { throw new Error(`no Application instance ${String(index)}`); }
  return app;
}

let host: HTMLDivElement;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  host.remove();
  fake.state.apps.length = 0;
  fake.state.gateInit = false;
  fake.state.pendingInits.length = 0;
});

describe("mountMatchStage lifecycle", () => {
  it("attaches exactly one canvas to the host once ready", async () => {
    const stage = mountMatchStage(host);
    await stage.ready;
    expect(host.children).toHaveLength(1);
    expect(host.firstElementChild?.tagName).toBe("CANVAS");
    stage.destroy();
  });

  it("destroy detaches the canvas and destroys the application with full cleanup", async () => {
    const stage = mountMatchStage(host);
    await stage.ready;
    stage.destroy();

    expect(host.children).toHaveLength(0);
    expect(appAt(0).destroy).toHaveBeenCalledExactlyOnceWith(
      { removeView: true },
      { children: true, texture: true, textureSource: true },
    );
  });

  it("destroy is idempotent", async () => {
    const stage = mountMatchStage(host);
    await stage.ready;
    stage.destroy();
    stage.destroy();
    expect(appAt(0).destroy).toHaveBeenCalledTimes(1);
  });

  it("remount after unmount starts clean: one canvas, prior app destroyed", async () => {
    const first = mountMatchStage(host);
    await first.ready;
    first.destroy();

    const second = mountMatchStage(host);
    await second.ready;

    expect(host.children).toHaveLength(1);
    expect(fake.state.apps).toHaveLength(2);
    expect(appAt(0).destroy).toHaveBeenCalledTimes(1);
    expect(appAt(1).destroy).not.toHaveBeenCalled();
    second.destroy();
    expect(host.children).toHaveLength(0);
  });

  it("destroy that pre-empts init (StrictMode race) never attaches and still frees the app", async () => {
    fake.state.gateInit = true;
    const stage = mountMatchStage(host);
    stage.destroy(); // React cleanup fires before Application.init resolves

    expect(fake.state.pendingInits).toHaveLength(1);
    fake.state.pendingInits[0]?.();
    await stage.ready;

    expect(host.children).toHaveLength(0);
    expect(appAt(0).destroy).toHaveBeenCalledExactlyOnceWith(
      { removeView: true },
      { children: true, texture: true, textureSource: true },
    );
  });

  it("requests the crisp-pixel renderer contract from the research", async () => {
    const stage = mountMatchStage(host);
    await stage.ready;
    expect(appAt(0).initOptions).toMatchObject({
      autoDensity: true,
      roundPixels: true,
      antialias: false,
    });
    stage.destroy();
  });
});
