import { describe, expect, it } from "vitest";

import { describeLoginPhase } from "./login-phase.ts";

describe("describeLoginPhase", () => {
  it("is checking-session while the session query is still pending, regardless of the rest", () => {
    expect(describeLoginPhase({ sessionPending: true, hasSession: false, hasPlayer: false })).toBe(
      "checking-session",
    );
    expect(describeLoginPhase({ sessionPending: true, hasSession: true, hasPlayer: true })).toBe(
      "checking-session",
    );
  });

  it("is signed-out once the session check settles with no session", () => {
    expect(describeLoginPhase({ sessionPending: false, hasSession: false, hasPlayer: false })).toBe(
      "signed-out",
    );
  });

  it("is loading-player when a session exists but the player fetch hasn't landed yet", () => {
    expect(describeLoginPhase({ sessionPending: false, hasSession: true, hasPlayer: false })).toBe(
      "loading-player",
    );
  });

  it("is signed-in only once both the session and the player are present", () => {
    expect(describeLoginPhase({ sessionPending: false, hasSession: true, hasPlayer: true })).toBe(
      "signed-in",
    );
  });
});
