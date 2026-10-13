import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  changeLog,
  processedMutations,
  sessions,
  settings,
  syncState,
  tasks,
  users,
} from "./schema.js";
import type { AuthStore } from "../auth/types.js";
import type { TaskCreate, TaskPatch, TaskStore, TaskView, ChangeResult } from "../tasks/types.js";
import type { SyncChange, SyncMutation, SyncResult, SyncStore } from "../sync/types.js";
import { planBackupImport, type BackupSettings, type BackupTask } from "@dayflow/domain";
import type { BackupStore } from "../backup/types.js";
import type { PlannerSettings, SettingsPatch, SettingsStore } from "../settings/types.js";

const visible = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  estimatedMinutes: tasks.estimatedMinutes,
  scheduledStart: tasks.scheduledStart,
  scheduledEnd: tasks.scheduledEnd,
  tags: tasks.tags,
  subtasks: tasks.subtasks,
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
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  tags: string[];
  subtasks: TaskView["subtasks"];
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
    scheduledStart: row.scheduledStart?.toISOString() ?? null,
    scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, val]) => [key, sorted(val)]),
    );
  }
  return value;
}
function requestHash(operation: SyncMutation): string {
  return createHash("sha256")
    .update(JSON.stringify(sorted(operation)))
    .digest("hex");
}
function serializeSettings(row: typeof settings.$inferSelect): PlannerSettings {
  return {
    timeZone: row.timeZone,
    workingDays: row.workingDays,
    workingDayStart: row.workingDayStart,
    workingDayEnd: row.workingDayEnd,
    defaultTaskDurationMinutes: row.defaultTaskDurationMinutes,
    bufferMinutes: row.bufferMinutes,
    weekStartsOn: row.weekStartsOn,
    theme: row.theme === "light" || row.theme === "dark" ? row.theme : "system",
    revision: row.revision,
  };
}
function payload(task: TaskView): Record<string, unknown> {
  return JSON.parse(JSON.stringify(task)) as Record<string, unknown>;
}

export function createPostgresStore(url: string): {
  store: AuthStore & TaskStore & SyncStore & BackupStore & SettingsStore;
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

  /** Lock an owner's sync row before ALL writes, until task+log+cursor commit. */
  async function applyMutation(userId: string, operation: SyncMutation): Promise<SyncResult> {
    return db.transaction(async (tx) => {
      await tx.insert(syncState).values({ userId, lastCursor: 0 }).onConflictDoNothing();
      const [locked] = await tx
        .select({ cursor: syncState.lastCursor })
        .from(syncState)
        .where(eq(syncState.userId, userId))
        .for("update");
      if (!locked) throw new Error("Could not lock owner sync cursor");

      const hash = requestHash(operation);
      const [old] = await tx
        .select({
          result: processedMutations.result,
          requestHash: processedMutations.requestHash,
        })
        .from(processedMutations)
        .where(
          and(
            eq(processedMutations.userId, userId),
            eq(processedMutations.clientMutationId, operation.clientMutationId),
          ),
        )
        .limit(1);
      if (old) {
        return old.requestHash === hash
          ? (old.result as unknown as SyncResult)
          : { clientMutationId: operation.clientMutationId, kind: "idempotency-key-reused" };
      }

      let task: TaskView | null = null;
      let deletedAt: string | undefined;
      if (operation.type === "create") {
        const [created] = await tx
          .insert(tasks)
          .values({
            id: operation.taskId,
            userId,
            title: operation.input.title,
            description: operation.input.description ?? null,
            priority: operation.input.priority ?? "medium",
            dueDate: operation.input.dueDate ?? null,
            estimatedMinutes: operation.input.estimatedMinutes ?? null,
            tags: operation.input.tags ?? [],
            subtasks: operation.input.subtasks ?? [],
            status: "inbox",
          })
          .onConflictDoNothing()
          .returning(visible);
        if (!created) {
          return { clientMutationId: operation.clientMutationId, kind: "conflict", current: null };
        }
        task = serialize(created);
      } else {
        const [current] = await tx
          .select({
            ...visible,
            deletedAt: tasks.deletedAt,
          })
          .from(tasks)
          .where(and(eq(tasks.id, operation.taskId), eq(tasks.userId, userId)))
          .limit(1);
        if (!current || current.deletedAt) {
          return { clientMutationId: operation.clientMutationId, kind: "not-found" };
        }
        if (current.revision !== operation.expectedRevision) {
          return {
            clientMutationId: operation.clientMutationId,
            kind: "conflict",
            current: serialize(current),
          };
        }
        if (operation.type === "update" && operation.patch.scheduledStart) {
          const start = new Date(operation.patch.scheduledStart);
          const end = new Date(operation.patch.scheduledEnd ?? operation.patch.scheduledStart);
          const [clash] = await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(
              and(
                eq(tasks.userId, userId),
                isNull(tasks.deletedAt),
                ne(tasks.id, operation.taskId),
                lt(tasks.scheduledStart, end),
                gt(tasks.scheduledEnd, start),
              ),
            )
            .limit(1);
          if (clash)
            return { clientMutationId: operation.clientMutationId, kind: "schedule-overlap" };
        }
        const now = new Date();
        const data: Partial<typeof tasks.$inferInsert> = {
          revision: current.revision + 1,
          updatedAt: now,
        };
        if (operation.type === "delete") {
          data.deletedAt = now;
          deletedAt = now.toISOString();
        } else {
          const patch = operation.patch;
          if (patch.title !== undefined) data.title = patch.title;
          if (patch.description !== undefined) data.description = patch.description;
          if (patch.priority !== undefined) data.priority = patch.priority;
          if (patch.dueDate !== undefined) data.dueDate = patch.dueDate;
          if (patch.estimatedMinutes !== undefined) data.estimatedMinutes = patch.estimatedMinutes;
          if (patch.tags !== undefined) data.tags = patch.tags;
          if (patch.subtasks !== undefined) data.subtasks = patch.subtasks;
          if (patch.scheduledStart !== undefined || patch.scheduledEnd !== undefined) {
            data.scheduledStart = patch.scheduledStart ? new Date(patch.scheduledStart) : null;
            data.scheduledEnd = patch.scheduledEnd ? new Date(patch.scheduledEnd) : null;
          }
          if (patch.status !== undefined) {
            data.status = patch.status;
            data.completedAt = patch.status === "completed" ? (current.completedAt ?? now) : null;
          } else if (patch.scheduledStart !== undefined && current.status !== "completed") {
            data.status = patch.scheduledStart ? "scheduled" : "inbox";
          }
        }
        const [updated] = await tx
          .update(tasks)
          .set(data)
          .where(
            and(
              eq(tasks.id, operation.taskId),
              eq(tasks.userId, userId),
              eq(tasks.revision, operation.expectedRevision),
              isNull(tasks.deletedAt),
            ),
          )
          .returning(visible);
        if (!updated) {
          return {
            clientMutationId: operation.clientMutationId,
            kind: "conflict",
            current: serialize(current),
          };
        }
        task = serialize(updated);
      }
      if (!task) throw new Error("Sync mutation did not produce task");
      const cursor = locked.cursor + 1;
      if (!Number.isSafeInteger(cursor)) throw new Error("Sync cursor exceeded safe range");
      const logPayload =
        operation.type === "delete"
          ? {
              id: task.id,
              revision: task.revision,
              deletedAt: deletedAt ?? new Date().toISOString(),
            }
          : payload(task);
      await tx.update(syncState).set({ lastCursor: cursor }).where(eq(syncState.userId, userId));
      await tx.insert(changeLog).values({
        userId,
        cursor,
        entityId: task.id,
        operation: operation.type,
        revision: task.revision,
        payload: logPayload,
      });
      const result: SyncResult = {
        clientMutationId: operation.clientMutationId,
        kind: "ok",
        cursor,
        task: operation.type === "delete" ? null : task,
        taskId: task.id,
        revision: task.revision,
      };
      await tx.insert(processedMutations).values({
        userId,
        clientMutationId: operation.clientMutationId,
        requestHash: hash,
        result: result as unknown as Record<string, unknown>,
      });
      return result;
    });
  }

  const store: AuthStore & TaskStore & SyncStore & BackupStore & SettingsStore = {
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
      const result = await applyMutation(userId, {
        clientMutationId: randomUUID(),
        type: "create",
        taskId: randomUUID(),
        input,
      });
      if (result.kind !== "ok" || !result.task) throw new Error("Task creation failed");
      return result.task;
    },
    async updateTask(userId, id, revision, patch: TaskPatch): Promise<ChangeResult> {
      const result = await applyMutation(userId, {
        clientMutationId: randomUUID(),
        type: "update",
        taskId: id,
        expectedRevision: revision,
        patch,
      });
      if (result.kind === "not-found") return { kind: "not-found" };
      if (result.kind === "schedule-overlap") return { kind: "overlap" };
      if (result.kind !== "ok" || !result.task) return { kind: "conflict" };
      return { kind: "ok", task: result.task };
    },
    async deleteTask(userId, id, revision): Promise<ChangeResult> {
      const result = await applyMutation(userId, {
        clientMutationId: randomUUID(),
        type: "delete",
        taskId: id,
        expectedRevision: revision,
      });
      if (result.kind === "not-found") return { kind: "not-found" };
      if (result.kind !== "ok") return { kind: "conflict" };
      // The G4 delete contract only uses revision of the result, not the full task.
      return {
        kind: "ok",
        task: {
          id,
          title: "",
          description: null,
          status: "inbox",
          priority: "medium",
          dueDate: null,
          estimatedMinutes: null,
          scheduledStart: null,
          scheduledEnd: null,
          tags: [],
          subtasks: [],
          revision: result.revision,
          createdAt: "",
          updatedAt: "",
          completedAt: null,
        },
      };
    },
    async push(userId, operations) {
      const results: SyncResult[] = [];
      for (const operation of operations) results.push(await applyMutation(userId, operation));
      return results;
    },
    async pull(userId, afterCursor, limit) {
      return db.transaction(async (tx) => {
        await tx.insert(syncState).values({ userId }).onConflictDoNothing();
        const [state] = await tx
          .select({ cursor: syncState.lastCursor })
          .from(syncState)
          .where(eq(syncState.userId, userId))
          .for("share");
        if (!state) throw new Error("Sync cursor state missing");
        if (afterCursor > state.cursor) throw new Error("sync-cursor-ahead");
        const rows = await tx
          .select({
            cursor: changeLog.cursor,
            entityId: changeLog.entityId,
            operation: changeLog.operation,
            revision: changeLog.revision,
            payload: changeLog.payload,
          })
          .from(changeLog)
          .where(and(eq(changeLog.userId, userId), gt(changeLog.cursor, afterCursor)))
          .orderBy(changeLog.cursor)
          .limit(limit + 1);
        const sliced = rows.slice(0, limit);
        const changes = sliced as SyncChange[];
        return {
          changes,
          nextCursor: sliced.at(-1)?.cursor ?? afterCursor,
          latestCursor: state.cursor,
          hasMore: rows.length > limit,
        };
      });
    },
    async bootstrap(userId) {
      return db.transaction(async (tx) => {
        await tx.insert(syncState).values({ userId }).onConflictDoNothing();
        const [state] = await tx
          .select({ cursor: syncState.lastCursor })
          .from(syncState)
          .where(eq(syncState.userId, userId))
          .for("share");
        if (!state) throw new Error("Missing sync state");
        const rows = await tx
          .select(visible)
          .from(tasks)
          .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)))
          .orderBy(desc(tasks.updatedAt));
        return { tasks: rows.map(serialize), cursor: state.cursor };
      });
    },
    async importTasks(userId, incoming: readonly BackupTask[], fileSettings: BackupSettings) {
      return db.transaction(async (tx) => {
        await tx.insert(syncState).values({ userId, lastCursor: 0 }).onConflictDoNothing();
        const [locked] = await tx
          .select({ cursor: syncState.lastCursor })
          .from(syncState)
          .where(eq(syncState.userId, userId))
          .for("update");
        if (!locked) throw new Error("Could not lock owner sync cursor");
        const rows = await tx
          .select({
            id: tasks.id,
            deletedAt: tasks.deletedAt,
            scheduledStart: tasks.scheduledStart,
            scheduledEnd: tasks.scheduledEnd,
          })
          .from(tasks)
          .where(eq(tasks.userId, userId));
        const plan = planBackupImport(
          new Set(rows.map((row) => row.id)),
          rows.flatMap((row) =>
            !row.deletedAt && row.scheduledStart && row.scheduledEnd
              ? [{ start: row.scheduledStart.toISOString(), end: row.scheduledEnd.toISOString() }]
              : [],
          ),
          incoming,
        );
        if (!plan.ok) return { kind: "overlap" as const };
        let cursor = locked.cursor;
        const now = new Date();
        await tx.insert(settings).values({ userId }).onConflictDoNothing();
        const [currentSettings] = await tx
          .select({
            revision: settings.revision,
            weekStartsOn: settings.weekStartsOn,
            theme: settings.theme,
          })
          .from(settings)
          .where(eq(settings.userId, userId))
          .limit(1);
        if (!currentSettings) throw new Error("Owner settings missing");
        await tx
          .update(settings)
          .set({
            timeZone: fileSettings.timeZone,
            workingDays: fileSettings.workingDays,
            workingDayStart: fileSettings.workingDayStart,
            workingDayEnd: fileSettings.workingDayEnd,
            defaultTaskDurationMinutes: fileSettings.defaultTaskDurationMinutes,
            bufferMinutes: fileSettings.bufferMinutes,
            weekStartsOn: fileSettings.weekStartsOn ?? currentSettings.weekStartsOn,
            theme: fileSettings.theme ?? currentSettings.theme,
            revision: currentSettings.revision + 1,
            updatedAt: now,
          })
          .where(eq(settings.userId, userId));
        for (const task of plan.insert) {
          cursor += 1;
          if (!Number.isSafeInteger(cursor)) throw new Error("Sync cursor exceeded safe range");
          const [created] = await tx
            .insert(tasks)
            .values({
              id: task.id,
              userId,
              title: task.title,
              description: task.description,
              priority: task.priority,
              dueDate: task.dueDate,
              estimatedMinutes: task.estimatedMinutes,
              tags: task.tags,
              subtasks: task.subtasks,
              status: task.status,
              scheduledStart: task.scheduledStart ? new Date(task.scheduledStart) : null,
              scheduledEnd: task.scheduledEnd ? new Date(task.scheduledEnd) : null,
              completedAt:
                task.status === "completed"
                  ? new Date(task.completedAt ?? now.toISOString())
                  : null,
              revision: 1,
              createdAt: new Date(task.createdAt),
              updatedAt: now,
            })
            .returning(visible);
          if (!created) throw new Error("Import insert failed");
          const view = serialize(created);
          await tx.insert(changeLog).values({
            userId,
            cursor,
            entityId: view.id,
            operation: "create",
            revision: view.revision,
            payload: payload(view),
          });
        }
        if (plan.insert.length > 0) {
          await tx
            .update(syncState)
            .set({ lastCursor: cursor })
            .where(eq(syncState.userId, userId));
        }
        return { kind: "ok" as const, imported: plan.insert.length, skipped: plan.skipped };
      });
    },
    async getSettings(userId): Promise<PlannerSettings> {
      return db.transaction(async (tx) => {
        await tx.insert(settings).values({ userId }).onConflictDoNothing();
        const [row] = await tx.select().from(settings).where(eq(settings.userId, userId)).limit(1);
        if (!row) throw new Error("Owner settings missing");
        return serializeSettings(row);
      });
    },
    async updateSettings(userId, revision, patch: SettingsPatch) {
      return db.transaction(async (tx) => {
        await tx.insert(settings).values({ userId }).onConflictDoNothing();
        const [current] = await tx
          .select()
          .from(settings)
          .where(eq(settings.userId, userId))
          .for("update");
        if (!current) throw new Error("Owner settings missing");
        const currentView = serializeSettings(current);
        if (current.revision !== revision)
          return { kind: "conflict" as const, settings: currentView };
        const next = { ...currentView, ...patch };
        if (next.workingDayStart >= next.workingDayEnd) return { kind: "invalid" as const };
        const [updated] = await tx
          .update(settings)
          .set({
            timeZone: next.timeZone,
            workingDays: next.workingDays,
            workingDayStart: next.workingDayStart,
            workingDayEnd: next.workingDayEnd,
            defaultTaskDurationMinutes: next.defaultTaskDurationMinutes,
            bufferMinutes: next.bufferMinutes,
            weekStartsOn: next.weekStartsOn,
            theme: next.theme,
            revision: current.revision + 1,
            updatedAt: new Date(),
          })
          .where(and(eq(settings.userId, userId), eq(settings.revision, revision)))
          .returning();
        if (!updated) return { kind: "conflict" as const, settings: currentView };
        return { kind: "ok" as const, settings: serializeSettings(updated) };
      });
    },
    async checkReady() {
      const result = await pool.query("select 1 as health");
      return result.rowCount === 1;
    },
  };
  return { store, close: () => pool.end() };
}
