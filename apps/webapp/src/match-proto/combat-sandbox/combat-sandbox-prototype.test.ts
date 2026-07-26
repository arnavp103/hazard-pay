// @vitest-environment jsdom
/**
 * Mount/unmount lifecycle proof for the combat sandbox surface.
 *
 * `scene.ts` is mocked rather than three.js: jsdom has no WebGL, and what
 * needs proving is not Three's rendering but OUR contract — one mount per
 * surface, destroy on unmount, a clean remount after a route change, and no
 * `window.__combatSandbox` left behind for the next page's capture run to pick
 * up. The bridge is a global, so a leaked one is the failure mode that would
 * silently poison a capture.
 *
 * Pixels are eyeballed in the browser and captured on the PR via `capture.mjs`
 * — same reasoning as the Pixi lane's `stage.test.ts`.
 *
 * Written without JSX so it stays a `.test.ts` and needs no change to the
 * app-wide vitest include pattern.
 */
import { act, createElement, type ReactNode, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scene = vi.hoisted(() => {
  const handles: Array<{ destroyed: boolean }> = [];
  return { handles };
});

vi.mock("./scene.ts", () => {
  const makeHandle = (host: HTMLElement) => {
    const canvas = document.createElement("canvas");
    host.append(canvas);
    const handle = {
      canvas,
      cost: () => ({ authoredKeysTotal: 0, drawCalls: 0, fodder: 0, frameMs: { max: 0, mean: 0, p95: 0, samples: 0 }, heroes: 0, simTime: 0, triangles: 0, units: 0 }),
      destroy: () => {
        handle.destroyed = true;
        canvas.remove();
        delete (globalThis as { __combatSandbox?: unknown }).__combatSandbox;
      },
      destroyed: false,
      png: () => "data:image/png;base64,",
      renderAt: () => {},
    };
    scene.handles.push(handle);
    (globalThis as { __combatSandbox?: unknown }).__combatSandbox = handle;
    return handle;
  };
  return {
    COMBAT_ZOOM: 0.82,
    CROWD_ZOOM: 0.55,
    defaultZoom: () => 0.55,
    LINEUP_ZOOM: 0.7,
    mountCombatSandbox: vi.fn(makeHandle),
    STAGE_HEIGHT: 270,
    STAGE_WIDTH: 480,
  };
});

vi.mock("@hazard-pay/ui", () => ({
  StatusChip: ({ children }: { children?: ReactNode }) => children,
}));

const { CombatSandboxPrototype } = await import("./combat-sandbox-prototype.tsx");
const { mountCombatSandbox } = await import("./scene.ts");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  scene.handles.length = 0;
  vi.mocked(mountCombatSandbox).mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  delete (globalThis as { __combatSandbox?: unknown }).__combatSandbox;
});

function render(node: ReactNode): void {
  act(() => { root.render(node); });
}

const surface = (): ReactNode => createElement(CombatSandboxPrototype);

describe("combat sandbox surface lifecycle", () => {
  it("mounts exactly one scene and attaches one canvas", () => {
    render(surface());
    expect(mountCombatSandbox).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
  });

  it("destroys the scene and detaches the canvas on unmount", () => {
    render(surface());
    const handle = scene.handles[0];
    act(() => { root.render(null); });
    expect(handle?.destroyed).toBe(true);
    expect(container.querySelectorAll("canvas")).toHaveLength(0);
  });

  it("leaves no capture bridge behind for the next page", () => {
    render(surface());
    expect((globalThis as { __combatSandbox?: unknown }).__combatSandbox).toBeDefined();
    act(() => { root.render(null); });
    expect((globalThis as { __combatSandbox?: unknown }).__combatSandbox).toBeUndefined();
  });

  it("remounts clean after a route change", () => {
    render(surface());
    act(() => { root.render(null); });
    render(surface());
    expect(mountCombatSandbox).toHaveBeenCalledTimes(2);
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect(scene.handles[0]?.destroyed).toBe(true);
    expect(scene.handles[1]?.destroyed).toBe(false);
  });

  it("survives StrictMode's double effect without stacking canvases", () => {
    // StrictMode mounts, unmounts and remounts every effect in development.
    // A surface that appends on mount but only detaches on the LAST unmount
    // ends up with two canvases and two rAF loops fighting over one clock.
    render(createElement(StrictMode, null, surface()));
    expect(container.querySelectorAll("canvas")).toHaveLength(1);
    expect((globalThis as { __combatSandbox?: unknown }).__combatSandbox).toBeDefined();
  });
});
