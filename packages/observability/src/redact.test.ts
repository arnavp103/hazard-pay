import { describe, expect, it } from "vitest";

import { isSecretKey, REDACTED, redactDeep } from "./redact.ts";

describe("isSecretKey", () => {
  it.each([
    "password",
    "PASSWORD",
    "dbPassword",
    "passwd",
    "secret",
    "clientSecret",
    "client_secret",
    "stripeSecretKey",
    "token",
    "authToken",
    "access_token",
    "refreshToken",
    "apiKey",
    "api_key",
    "x-api-key",
    "authorization",
    "Authorization",
    "cookie",
    "set-cookie",
    "sessionId",
    "session_id",
    "credentials",
    "privateKey",
    "private_key",
  ])("matches %s", (key) => {
    expect(isSecretKey(key)).toBe(true);
  });

  it.each(["level", "msg", "trace_id", "span_id", "userId", "email", "matchId", "duration_ms"])(
    "passes %s",
    (key) => {
      expect(isSecretKey(key)).toBe(false);
    },
  );
});

describe("redactDeep", () => {
  it("redacts secret-shaped keys at any depth", () => {
    const input = {
      msg: "login",
      password: "hunter2",
      user: { name: "neo", authToken: "abc" },
      headers: { authorization: "Bearer xyz", cookie: "sid=1", accept: "json" },
      deeply: { nested: { list: [{ apiKey: "k" }] } },
    };
    const out = redactDeep(input);
    expect(out.password).toBe(REDACTED);
    expect(out.user.authToken).toBe(REDACTED);
    expect(out.user.name).toBe("neo");
    expect(out.headers.authorization).toBe(REDACTED);
    expect(out.headers.cookie).toBe(REDACTED);
    expect(out.headers.accept).toBe("json");
    expect(out.deeply.nested.list[0]?.apiKey).toBe(REDACTED);
    expect(JSON.stringify(out)).not.toContain("hunter2");
  });

  it("does not mutate the input", () => {
    const input = { password: "hunter2" };
    redactDeep(input);
    expect(input.password).toBe("hunter2");
  });

  it("passes primitives through", () => {
    expect(redactDeep("password")).toBe("password");
    expect(redactDeep(42)).toBe(42);
    expect(redactDeep(null)).toBeNull();
    expect(redactDeep(undefined)).toBeUndefined();
  });

  it("leaves non-plain objects untouched", () => {
    const date = new Date();
    const error = new Error("boom");
    const out = redactDeep({ date, error });
    expect(out.date).toBe(date);
    expect(out.error).toBe(error);
  });

  it("collapses circular references instead of recursing forever", () => {
    const input: Record<string, unknown> = { safe: 1 };
    input.self = input;
    const out = redactDeep(input);
    expect(out.self).toBe("[Circular]");
    expect(out.safe).toBe(1);
  });
});
