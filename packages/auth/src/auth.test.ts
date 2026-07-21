import { randomUUID } from "node:crypto";

import { player, user } from "@hazard-pay/db";
import { createTestDatabase } from "@hazard-pay/db/testing";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

import { createAuth, createPlayerForUser, defaultHandle, relinkPlayer } from "./auth.ts";

async function insertUser(db: Awaited<ReturnType<typeof createTestDatabase>>["db"], id: string) {
  const now = new Date();
  await db.insert(user).values({
    id,
    name: "Dev Player",
    email: `${id}@stub.hazard-pay.dev`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
}

test("createPlayerForUser inserts a player row 1:1 on the user id", async () => {
  const testDb = await createTestDatabase();
  try {
    const userId = randomUUID();
    await insertUser(testDb.db, userId);

    await createPlayerForUser(testDb.db, { id: userId });

    const rows = await testDb.db.select().from(player).where(eq(player.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.handle).toBe(defaultHandle(userId));
  } finally {
    await testDb.drop();
  }
});

test("relinkPlayer re-points player.userId from an anonymous user to a real one", async () => {
  const testDb = await createTestDatabase();
  try {
    const anonymousUserId = randomUUID();
    const realUserId = randomUUID();
    await insertUser(testDb.db, anonymousUserId);
    await insertUser(testDb.db, realUserId);
    await createPlayerForUser(testDb.db, { id: anonymousUserId });

    await relinkPlayer(testDb.db, { anonymousUserId, newUserId: realUserId });

    const stillAnonymous = await testDb.db.select().from(player).where(eq(player.userId, anonymousUserId));
    const relinked = await testDb.db.select().from(player).where(eq(player.userId, realUserId));
    expect(stillAnonymous).toHaveLength(0);
    expect(relinked).toHaveLength(1);
  } finally {
    await testDb.drop();
  }
});

test("createAuth wires databaseHooks so a real anonymous sign-in creates a player row", async () => {
  const testDb = await createTestDatabase();
  try {
    const auth = createAuth(testDb.db, { baseURL: "http://localhost:3000" });

    const result = await auth.api.signInAnonymous();
    expect(result?.user.id).toBeTruthy();

    const userId = result?.user.id;
    if (userId === undefined) {
      throw new Error("anonymous sign-in did not return a user");
    }
    const rows = await testDb.db.select().from(player).where(eq(player.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.handle).toBe(defaultHandle(userId));
  } finally {
    await testDb.drop();
  }
});
