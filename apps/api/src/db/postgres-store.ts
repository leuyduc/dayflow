import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sessions, tasks, users } from "./schema.js";
import type { AuthStore } from "../auth/types.js";
import type { TaskCreate, TaskPatch, TaskStore, TaskView, ChangeResult } from "../tasks/types.js";

const visible = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  estimatedMinutes: tasks.estimatedMinutes,
  tags: tasks.tags,
  revision: tasks.revision,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  completedAt: tasks.completedAt,
};

type DbRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  tags: string[];
  revision: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};
function serialize(row: DbRow): TaskView {
  return {
    ...row,
    status: row.status as TaskView["status"],
    priority: row.priority as TaskView["priority"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export function createPostgresStore(url: string): {
  store: AuthStore & TaskStore;
  close: () => Promise<void>;
} {
  if (!url) throw new Error("DATABASE_URL required for PostgreSQL-backed auth");
  const pool = new Pool({
    connectionString: url,
    max: 5,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30_000,
    application_name: "dayflow-development-api",
  });
  const db = drizzle(pool);

  async function missingOrConflict(userId: string, id: string): Promise<ChangeResult> {
    const [row] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);
    return row ? { kind: "conflict" } : { kind: "not-found" };
  }

  const store: AuthStore & TaskStore = {
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
    async listTasks(userId) {
      const rows = await db
        .select(visible)
        .from(tasks)
        .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)))
        .orderBy(desc(tasks.updatedAt), desc(tasks.id));
      return rows.map((row) => serialize(row));
    },
    async createTask(userId, input: TaskCreate) {
      const [created] = await db
        .insert(tasks)
        .values({
          userId,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority ?? "medium",
          dueDate: input.dueDate ?? null,
          estimatedMinutes: input.estimatedMinutes ?? null,
          tags: input.tags ?? [],
          status: "inbox",
        })
        .returning(visible);
      if (!created) throw new Error("Task creation returned no record");
      return serialize(created);
    },
    async updateTask(userId, id, revision, patch: TaskPatch) {
      const [existing] = await db
        .select({ status: tasks.status, completedAt: tasks.completedAt })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
        .limit(1);
      if (!existing) return { kind: "not-found" };
      const now = new Date();
      const data: Partial<typeof tasks.$inferInsert> = { updatedAt: now, revision: revision + 1 };
      if (patch.title !== undefined) data.title = patch.title;
      if (patch.description !== undefined) data.description = patch.description;
      if (patch.priority !== undefined) data.priority = patch.priority;
      if (patch.dueDate !== undefined) data.dueDate = patch.dueDate;
      if (patch.estimatedMinutes !== undefined) data.estimatedMinutes = patch.estimatedMinutes;
      if (patch.tags !== undefined) data.tags = patch.tags;
      if (patch.status !== undefined) {
        data.status = patch.status;
        data.completedAt = patch.status === "completed" ? (existing.completedAt ?? now) : null;
      }
      const [updated] = await db
        .update(tasks)
        .set(data)
        .where(
          and(
            eq(tasks.id, id),
            eq(tasks.userId, userId),
            eq(tasks.revision, revision),
            isNull(tasks.deletedAt),
          ),
        )
        .returning(visible);
      if (!updated) return missingOrConflict(userId, id);
      return { kind: "ok", task: serialize(updated) };
    },
    async deleteTask(userId, id, revision) {
      const now = new Date();
      const [deleted] = await db
        .update(tasks)
        .set({
          deletedAt: now,
          updatedAt: now,
          revision: revision + 1,
        })
        .where(
          and(
            eq(tasks.id, id),
            eq(tasks.userId, userId),
            eq(tasks.revision, revision),
            isNull(tasks.deletedAt),
          ),
        )
        .returning(visible);
      if (!deleted) return missingOrConflict(userId, id);
      return { kind: "ok", task: serialize(deleted) };
    },
    async checkReady() {
      const result = await pool.query("select 1 as health");
      return result.rowCount === 1;
    },
  };
  return { store, close: () => pool.end() };
}
