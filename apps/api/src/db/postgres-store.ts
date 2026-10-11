import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sessions, tasks, users } from "./schema.js";
import type { AuthStore } from "../auth/types.js";

export function createPostgresStore(url: string): { store: AuthStore; close: () => Promise<void> } {
  if (!url) throw new Error("DATABASE_URL required for PostgreSQL-backed auth");
  const pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30_000,
    application_name: "dayflow-development-api",
  });
  const db = drizzle(pool);

  const store: AuthStore = {
    async getOwnerByEmail(email) {
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return user ?? null;
    },
    async insertSession(record) {
      await db.insert(sessions).values(record);
    },
    async getSessionByTokenHash(tokenHash) {
      const [found] = await db
        .select({
          tokenHash: sessions.tokenHash,
          userId: sessions.userId,
          email: users.email,
          expiresAt: sessions.expiresAt,
          revokedAt: sessions.revokedAt,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.tokenHash, tokenHash))
        .limit(1);
      return found ?? null;
    },
    async revokeSessionByTokenHash(tokenHash) {
      await db
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
    },
    async listTasksForOwner(userId) {
      return db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
        })
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)));
    },
    async checkReady() {
      const result = await pool.query("select 1 as health");
      return result.rowCount === 1;
    },
  };

  return { store, close: () => pool.end() };
}
