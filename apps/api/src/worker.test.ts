import { expect, test } from "vitest";

import { tickCron } from "./worker.ts";

test("tickCron maps TICK_INTERVAL to whole-minute cron, clamped to 1..59", () => {
  expect(tickCron(300_000)).toBe("*/5 * * * *");
  expect(tickCron(10_000)).toBe("*/1 * * * *");
  expect(tickCron(2 * 60 * 60 * 1000)).toBe("*/59 * * * *");
});
