import { expect, test } from "vitest";

import { tick } from "./schema.ts";
import { createTestDatabase } from "./testing/index.ts";

test("a tick round-trips through a cloned test database", async () => {
  const testDb = await createTestDatabase();
  try {
    const inserted = await testDb.db.insert(tick).values({ completedAt: new Date() }).returning();
    expect(inserted).toHaveLength(1);
    const rows = await testDb.db.select().from(tick);
    expect(rows.map((row) => row.id)).toEqual([inserted[0]?.id]);
  } finally {
    await testDb.drop();
  }
});
