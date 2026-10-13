import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Algorithm, hash } from "@node-rs/argon2";
import {
  parseBackup,
  planBackupImport,
  type BackupSettings,
  type BackupTask,
} from "@dayflow/domain";
import { buildApp } from "../app.js";
import type { AuthStore, OwnerRecord, SessionRecord } from "../auth/types.js";
import type { BackupStore } from "./types.js";

const origin = "http://127.0.0.1:5173";
const secret = "test-secret-for-backup-import-longer-than-32";
const ownerId = "11111111-1111-4111-8111-111111111111";
const password = "TestOnly-Auth-Safe-Password";
let passwordHash = "";

class MemoryStore implements AuthStore, BackupStore {
  sessions = new Map<string, SessionRecord>();
  existing = new Set<string>();
  occupied: Array<{ start: string; end: string }> = [];
  written: BackupTask[][] = [];
  applied: BackupSettings | null = null;
  async getOwnerByEmail(email: string): Promise<OwnerRecord | null> {
    return email === "owner@example.test" ? { id: ownerId, email, passwordHash } : null;
  }
  async insertSession(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.sessions.set(input.tokenHash, { ...input, email: "owner@example.test", revokedAt: null });
  }
  async getSessionByTokenHash(hashValue: string) {
    return this.sessions.get(hashValue) ?? null;
  }
  async revokeSessionByTokenHash(hashValue: string) {
    const session = this.sessions.get(hashValue);
    if (session) session.revokedAt = new Date();
  }
  async listTasksForOwner() {
    return [];
  }
  async importTasks(_userId: string, tasks: readonly BackupTask[], settings: BackupSettings) {
    this.applied = settings;
    const plan = planBackupImport(this.existing, this.occupied, tasks);
    if (!plan.ok) return { kind: "overlap" as const };
    this.written.push(plan.insert);
    return { kind: "ok" as const, imported: plan.insert.length, skipped: plan.skipped };
  }
}

const apps: ReturnType<typeof buildApp>[] = [];
beforeAll(async () => {
  passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
});
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

function backup(tasks: Array<Record<string, unknown>>) {
  return {
    format: "dayflow-backup",
    version: 1,
    exportedAt: "2026-10-13T00:00:00.000Z",
    settings: {
      timeZone: "Asia/Ho_Chi_Minh",
      workingDays: [1, 2, 3, 4, 5],
      workingDayStart: "09:00",
      workingDayEnd: "17:00",
      defaultTaskDurationMinutes: 30,
      bufferMinutes: 10,
    },
    tasks,
  };
}

function task(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: "Việc nhập",
    description: null,
    status: "inbox",
    priority: "medium",
    dueDate: null,
    estimatedMinutes: 30,
    scheduledStart: null,
    scheduledEnd: null,
    tags: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

async function authedApp() {
  const store = new MemoryStore();
  const app = buildApp({
    auth: { store, backup: store, csrfSecret: secret, allowedOrigin: origin },
  });
  apps.push(app);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: { email: "owner@example.test", password },
  });
  expect(login.statusCode).toBe(200);
  return {
    app,
    store,
    cookie: String(login.headers["set-cookie"]).split(";")[0] ?? "",
    csrf: login.json().csrfToken as string,
  };
}

describe("backup import route", () => {
  it("requires a session and a valid origin", async () => {
    const { app, cookie, csrf } = await authedApp();
    expect(
      (await app.inject({ method: "POST", url: "/api/backup/import", payload: {} })).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/backup/import",
          headers: { cookie, origin: "https://bad.invalid", "x-dayflow-csrf": csrf },
          payload: backup([]),
        })
      ).statusCode,
    ).toBe(403);
  });

  it("imports new tasks in one response and skips existing ids", async () => {
    const existing = "33333333-3333-4333-8333-333333333333";
    const fresh = "44444444-4444-4444-8444-444444444444";
    const { app, store, cookie, csrf } = await authedApp();
    store.existing.add(existing);
    const response = await app.inject({
      method: "POST",
      url: "/api/backup/import",
      headers: { cookie, origin, "x-dayflow-csrf": csrf },
      payload: backup([
        task(existing),
        task(fresh, {
          status: "scheduled",
          scheduledStart: "2026-10-12T02:00:00.000Z",
          scheduledEnd: "2026-10-12T03:00:00.000Z",
        }),
      ]),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ imported: 1, skipped: 1 });
    expect(store.written).toHaveLength(1);
    expect(store.applied?.timeZone).toBe("Asia/Ho_Chi_Minh");
    expect(store.written[0]![0]).toMatchObject({
      id: fresh,
      status: "scheduled",
      scheduledStart: "2026-10-12T02:00:00.000Z",
    });
  });

  it("accepts a settings-only restore when all task IDs already exist", async () => {
    const existing = "33333333-3333-4333-8333-333333333333";
    const { app, store, cookie, csrf } = await authedApp();
    store.existing.add(existing);
    const source = backup([task(existing)]);
    const response = await app.inject({
      method: "POST",
      url: "/api/backup/import",
      headers: { cookie, origin, "x-dayflow-csrf": csrf },
      payload: {
        ...source,
        settings: { ...source.settings, weekStartsOn: 0, theme: "dark" },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ imported: 0, skipped: 1 });
    expect(store.applied).toMatchObject({ weekStartsOn: 0, theme: "dark" });
    expect(store.written).toEqual([[]]);
  });

  it("rejects an overlapping file without recording any insert", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    const { app, store, cookie, csrf } = await authedApp();
    store.occupied.push({
      start: "2026-10-12T02:00:00.000Z",
      end: "2026-10-12T03:00:00.000Z",
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/backup/import",
      headers: { cookie, origin, "x-dayflow-csrf": csrf },
      payload: backup([
        task(id, {
          status: "scheduled",
          scheduledStart: "2026-10-12T02:30:00.000Z",
          scheduledEnd: "2026-10-12T04:00:00.000Z",
        }),
      ]),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "schedule-overlap" });
    expect(store.written).toEqual([]);
  });

  it("uses the backup route's 2 MB limit rather than Fastify's 1 MB default", async () => {
    const { app, store, cookie, csrf } = await authedApp();
    const oversizedDescription = "x".repeat(1_100_000);
    const response = await app.inject({
      method: "POST",
      url: "/api/backup/import",
      headers: { cookie, origin, "x-dayflow-csrf": csrf },
      payload: backup([
        task("44444444-4444-4444-8444-444444444444", {
          description: oversizedDescription,
        }),
      ]),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid-backup");
    expect(store.written).toEqual([]);
  });

  it("rejects a file the domain parser would reject", async () => {
    const { app, store, cookie, csrf } = await authedApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/backup/import",
      headers: { cookie, origin, "x-dayflow-csrf": csrf },
      payload: { format: "other" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid-backup");
    expect(store.written).toEqual([]);
    expect(parseBackup(JSON.stringify({ format: "other" })).ok).toBe(false);
  });
});
