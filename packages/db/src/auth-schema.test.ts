import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { expect, test } from "vitest";

import { account, player, session, user, verification } from "./auth-schema.ts";
import { createTestDatabase } from "./testing/index.ts";

/**
 * Proves the better-auth core schema (user/session/account/verification) and
 * the separate player table round-trip through a cloned test database with
 * the FK/unique constraints @better-auth/drizzle-adapter and createAuth
 * (packages/auth) rely on. This package never talks to better-auth directly
 * (ADR 0001) — that's packages/auth's job.
 */
test("better-auth core tables and player round-trip with their constraints", async () => {
  const testDb = await createTestDatabase();
  try {
    const now = new Date();
    const userId = randomUUID();

    const [insertedUser] = await testDb.db
      .insert(user)
      .values({
        id: userId,
        name: "Dev Player",
        email: `${userId}@stub.hazard-pay.dev`,
        emailVerified: false,
        isAnonymous: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    expect(insertedUser?.id).toBe(userId);

    await testDb.db.insert(session).values({
      id: randomUUID(),
      userId,
      token: randomUUID(),
      expiresAt: new Date(now.getTime() + 86_400_000),
      createdAt: now,
      updatedAt: now,
    });

    await testDb.db.insert(account).values({
      id: randomUUID(),
      userId,
      accountId: userId,
      providerId: "anonymous",
      createdAt: now,
      updatedAt: now,
    });

    await testDb.db.insert(verification).values({
      id: randomUUID(),
      identifier: userId,
      value: "stub",
      expiresAt: new Date(now.getTime() + 3_600_000),
      createdAt: now,
      updatedAt: now,
    });

    const [insertedPlayer] = await testDb.db
      .insert(player)
      .values({ id: randomUUID(), userId, handle: "dev-player" })
      .returning();
    expect(insertedPlayer?.userId).toBe(userId);

    // player is 1:1 on user.id — a second player row for the same user
    // violates the unique constraint.
    await expect(
      testDb.db.insert(player).values({ id: randomUUID(), userId, handle: "another-handle" }),
    ).rejects.toThrow();

    // Deleting the user cascades to session/account/player (auth churn never
    // needs a separate cleanup pass over game tables).
    await testDb.db.delete(user).where(eq(user.id, userId));
    const remainingSessions = await testDb.db.select().from(session).where(eq(session.userId, userId));
    const remainingPlayers = await testDb.db.select().from(player).where(eq(player.userId, userId));
    expect(remainingSessions).toHaveLength(0);
    expect(remainingPlayers).toHaveLength(0);
  } finally {
    await testDb.drop();
  }
});
