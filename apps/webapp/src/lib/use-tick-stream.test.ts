// @vitest-environment jsdom
/**
 * Reconnect-and-backoff proof for the client half of the transport seam
 * (#107). `EventSource` is faked globally: jsdom does not implement it, and
 * what needs proving here is not the browser's own automatic retry (that is
 * spec behavior, untouched) but OUR contract on top of it — a `CLOSED`
 * `readyState` (the WHATWG "fail the connection" case: non-200 status, wrong
 * `Content-Type`, e.g. a 502 mid-deploy) re-instantiates the `EventSource`
 * with backoff instead of leaving `status` parked at `"reconnecting"`
 * forever, while a `CONNECTING` `readyState` (a transient drop the UA is
 * already retrying on its own, with its own remembered `Last-Event-ID`) is
 * left alone.
 *
 * Written without JSX so it stays a `.test.ts` and needs no change to the
 * app-wide vitest include pattern (same reasoning as
 * combat-sandbox-prototype.test.ts, applied to a hook rather than a mounted
 * surface).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  reconnectBackoffMs,
  type TickStreamState,
  useTickStream,
} from "./use-tick-stream.ts";

/** A minimal, fully scriptable `EventSource` stand-in. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState: 0 | 1 | 2 = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly url: string;
  private readonly listeners = new Map<string, Set<(event: MessageEvent<string>) => void>>();

  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.readyState = FakeEventSource.CLOSED;
  }

  /** Test helper: the connection opens successfully. */
  open(): void {
    this.readyState = FakeEventSource.OPEN;
    this.onopen?.();
  }

  /** Test helper: a transient drop — the browser retries this instance on its own. */
  errorTransient(): void {
    this.readyState = FakeEventSource.CONNECTING;
    this.onerror?.();
  }

  /** Test helper: the WHATWG "fail the connection" case — the UA gives up for good. */
  errorFatal(): void {
    this.readyState = FakeEventSource.CLOSED;
    this.onerror?.();
  }
}

let instances: FakeEventSource[] = [];

(globalThis as { EventSource: unknown }).EventSource = FakeEventSource;

function TestHarness({ onState }: { onState: (state: TickStreamState) => void }): null {
  const state = useTickStream();
  useEffect(() => {
    onState(state);
  });
  return null;
}

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;
let latestState: TickStreamState | undefined;

function renderHarness(targetRoot: Root): void {
  act(() => {
    targetRoot.render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(TestHarness, {
          onState: (state: TickStreamState) => {
            latestState = state;
          },
        }),
      ),
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  instances = [];
  latestState = undefined;
  queryClient = new QueryClient();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  queryClient.clear();
  vi.useRealTimers();
});

describe("useTickStream reconnect (#107)", () => {
  it("starts connecting and goes live once the EventSource opens", () => {
    renderHarness(root);
    expect(latestState?.status).toBe("connecting");

    const source = instances[0];
    if (source === undefined) {
      throw new Error("no EventSource constructed");
    }
    act(() => {
      source.open();
    });
    expect(latestState?.status).toBe("live");
  });

  it("leaves a transient (CONNECTING) error to the browser's own retry", () => {
    renderHarness(root);
    const source = instances[0];
    if (source === undefined) {
      throw new Error("no EventSource constructed");
    }
    act(() => {
      source.open();
    });

    act(() => {
      source.errorTransient();
    });
    expect(latestState?.status).toBe("reconnecting");
    // No app-level re-instantiation: the browser is already retrying this
    // exact connection with its own remembered Last-Event-ID.
    expect(instances).toHaveLength(1);

    act(() => {
      source.open();
    });
    expect(latestState?.status).toBe("live");
    expect(instances).toHaveLength(1);
  });

  it("re-instantiates with backoff on a fatal (CLOSED) error, and cannot get stuck in reconnecting", () => {
    renderHarness(root);
    const first = instances[0];
    if (first === undefined) {
      throw new Error("no EventSource constructed");
    }
    act(() => {
      first.open();
    });

    act(() => {
      first.errorFatal();
    });
    expect(latestState?.status).toBe("reconnecting");
    expect(instances).toHaveLength(1); // waiting out the backoff, not stuck yet

    // This is exactly the bug being fixed: without a timer driving recovery,
    // status would sit at "reconnecting" forever. Advancing less than the
    // backoff must not (yet) produce a new connection...
    act(() => {
      vi.advanceTimersByTime(RECONNECT_BASE_MS - 1);
    });
    expect(instances).toHaveLength(1);
    expect(latestState?.status).toBe("reconnecting");

    // ...but the moment the backoff elapses, a fresh EventSource appears.
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(instances).toHaveLength(2);
    expect(latestState?.status).toBe("reconnecting");

    const second = instances[1];
    if (second === undefined) {
      throw new Error("no second EventSource constructed");
    }
    act(() => {
      second.open();
    });
    expect(latestState?.status).toBe("live");
  });

  it("backs off exponentially across consecutive fatal errors, capped at RECONNECT_MAX_MS", () => {
    expect(reconnectBackoffMs(0)).toBe(RECONNECT_BASE_MS);
    expect(reconnectBackoffMs(1)).toBe(RECONNECT_BASE_MS * 2);
    expect(reconnectBackoffMs(2)).toBe(RECONNECT_BASE_MS * 4);
    expect(reconnectBackoffMs(10)).toBe(RECONNECT_MAX_MS);

    renderHarness(root);
    act(() => {
      instances[0]?.errorFatal();
    });
    act(() => {
      vi.advanceTimersByTime(reconnectBackoffMs(0));
    });
    expect(instances).toHaveLength(2);

    act(() => {
      instances[1]?.errorFatal();
    });
    act(() => {
      vi.advanceTimersByTime(reconnectBackoffMs(1) - 1);
    });
    expect(instances).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(instances).toHaveLength(3);
  });

  it("a successful reconnect resets the backoff for the next failure", () => {
    renderHarness(root);
    act(() => {
      instances[0]?.errorFatal();
    });
    act(() => {
      vi.advanceTimersByTime(reconnectBackoffMs(0));
    });
    expect(instances).toHaveLength(2);

    act(() => {
      instances[1]?.open();
    });
    expect(latestState?.status).toBe("live");

    act(() => {
      instances[1]?.errorFatal();
    });
    // If the attempt counter had not reset, this would still be waiting on
    // the second-attempt delay (RECONNECT_BASE_MS * 2).
    act(() => {
      vi.advanceTimersByTime(reconnectBackoffMs(0));
    });
    expect(instances).toHaveLength(3);
  });

  it("cleans up: unmounting cancels a pending reconnect", () => {
    const localContainer = document.createElement("div");
    document.body.append(localContainer);
    const localRoot = createRoot(localContainer);
    renderHarness(localRoot);

    act(() => {
      instances[0]?.errorFatal();
    });
    act(() => {
      localRoot.unmount();
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(instances).toHaveLength(1);

    localContainer.remove();
  });
});
