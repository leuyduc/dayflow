import { randomUUID } from "node:crypto";
import { Algorithm, hash } from "@node-rs/argon2";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { AuthStore, OwnerRecord, SessionRecord } from "../auth/types.js";
import type { TaskCreate, TaskPatch, TaskStore, TaskView, ChangeResult } from "./types.js";

const ownerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const origin = "http://127.0.0.1:5173";
const secret = "test-secret-for-g4-api-longer-than-thirty-two";
const password = "TestOnly-Auth-Safe-Password";
let passwordHash = "";
beforeAll(async () => {
  passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
});

class MemoryStore implements AuthStore, TaskStore {
  sessions = new Map<string, SessionRecord>();
  tasks = new Map<string, TaskView & { userId: string; deleted: boolean }>();
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
  async listTasksForOwner(userId: string) {
    return await this.listTasks(userId);
  }
  async listTasks(userId: string) {
    return [...this.tasks.values()]
      .filter((item) => item.userId === userId && !item.deleted)
      .map(({ userId: _userId, deleted: _deleted, ...view }) => {
        void _userId;
        void _deleted;
        return view;
      });
  }
  async createTask(userId: string, input: TaskCreate) {
    const now = new Date().toISOString();
    const item: TaskView & { userId: string; deleted: boolean } = {
      id: randomUUID(),
      userId,
      deleted: false,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      status: "inbox",
      dueDate: input.dueDate ?? null,
      estimatedMinutes: input.estimatedMinutes ?? null,
      scheduledStart: null,
      scheduledEnd: null,
      tags: input.tags ?? [],
      subtasks: input.subtasks ?? [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.tasks.set(item.id, item);
    const { userId: _owner, deleted: _deleted, ...view } = item;
    void _owner;
    void _deleted;
    return view;
  }
  async updateTask(
    userId: string,
    id: string,
    revision: number,
    patch: TaskPatch,
  ): Promise<ChangeResult> {
    const row = this.tasks.get(id);
    if (!row || row.deleted || row.userId !== userId) return { kind: "not-found" };
    if (row.revision !== revision) return { kind: "conflict" };
    if (patch.scheduledStart) {
      const start = Date.parse(patch.scheduledStart);
      const end = Date.parse(patch.scheduledEnd ?? patch.scheduledStart);
      const clash = [...this.tasks.values()].some(
        (other) =>
          other.id !== id &&
          other.userId === userId &&
          !other.deleted &&
          other.scheduledStart !== null &&
          other.scheduledEnd !== null &&
          Date.parse(other.scheduledStart) < end &&
          Date.parse(other.scheduledEnd) > start,
      );
      if (clash) return { kind: "overlap" };
    }
    Object.assign(row, patch);
    if (patch.status !== undefined)
      row.completedAt = patch.status === "completed" ? new Date().toISOString() : null;
    else if (patch.scheduledStart !== undefined && row.status !== "completed")
      row.status = patch.scheduledStart ? "scheduled" : "inbox";
    row.revision++;
    row.updatedAt = new Date().toISOString();
    return { kind: "ok", task: (await this.listTasks(userId)).find((t) => t.id === id)! };
  }
  async deleteTask(userId: string, id: string, revision: number): Promise<ChangeResult> {
    const row = this.tasks.get(id);
    if (!row || row.deleted || row.userId !== userId) return { kind: "not-found" };
    if (row.revision !== revision) return { kind: "conflict" };
    row.deleted = true;
    row.revision++;
    row.updatedAt = new Date().toISOString();
    const { userId: _owner, deleted: _deleted, ...view } = row;
    void _owner;
    void _deleted;
    return { kind: "ok", task: view };
  }
}

const apps: ReturnType<typeof buildApp>[] = [];
async function fixture() {
  const store = new MemoryStore();
  const app = buildApp({
    auth: { store, tasks: store, csrfSecret: secret, allowedOrigin: origin },
  });
  apps.push(app);
  const auth = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: { email: "owner@example.test", password },
  });
  expect(auth.statusCode).toBe(200);
  const cookie = String(auth.headers["set-cookie"]).split(";")[0];
  const csrf = auth.json().csrfToken as string;
  async function request(
    method: "POST" | "PATCH" | "DELETE",
    url: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
  ) {
    return await app.inject({
      method,
      url,
      headers: {
        cookie,
        origin,
        "x-dayflow-csrf": csrf,
        ...headers,
      },
      payload: body,
    });
  }
  return { app, store, cookie, csrf, request };
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("G4 authorized task API", () => {
  it("blocks anonymous mutations and enforces origin + CSRF", async () => {
    const { app, cookie, request } = await fixture();
    expect(
      (await app.inject({ method: "POST", url: "/api/tasks", payload: { title: "unsafe" } }))
        .statusCode,
    ).toBe(401);
    expect(
      (await request("POST", "/api/tasks", { title: "unsafe" }, { origin: "https://bad.invalid" }))
        .statusCode,
    ).toBe(403);
    expect(
      (await request("POST", "/api/tasks", { title: "unsafe" }, { "x-dayflow-csrf": "incorrect" }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/tasks",
          headers: { cookie, origin },
          payload: { title: "unsafe" },
        })
      ).statusCode,
    ).toBe(403);
  });
  it("validates title/date/unknown fields and creates a task", async () => {
    const { request } = await fixture();
    for (const payload of [
      { title: " " },
      { title: "Bad", dueDate: "2026-02-30" },
      { title: "Bad", userId: otherId },
    ]) {
      expect((await request("POST", "/api/tasks", payload)).statusCode).toBe(400);
    }
    const ok = await request("POST", "/api/tasks", {
      title: "  Viết kế hoạch ",
      priority: "high",
      dueDate: "2026-10-25",
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().task.title).toBe("Viết kế hoạch");
    expect(ok.json().task.revision).toBe(1);
  });
  it("creates/edits/completes/reopens/deletes with revision check", async () => {
    const { app, cookie, request } = await fixture();
    const created = (await request("POST", "/api/tasks", { title: "Project" })).json()
      .task as TaskView;
    const patched = await request("PATCH", "/api/tasks/" + created.id, {
      expectedRevision: 1,
      title: "Updated",
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().task.revision).toBe(2);
    expect(
      (await request("PATCH", "/api/tasks/" + created.id, { expectedRevision: 1, title: "Stale" }))
        .statusCode,
    ).toBe(409);
    const completed = await request("PATCH", "/api/tasks/" + created.id, {
      expectedRevision: 2,
      status: "completed",
    });
    expect(completed.json().task.completedAt).toBeTruthy();
    const reopened = await request("PATCH", "/api/tasks/" + created.id, {
      expectedRevision: 3,
      status: "inbox",
    });
    expect(reopened.json().task.completedAt).toBeNull();
    expect(
      (await request("DELETE", "/api/tasks/" + created.id, { expectedRevision: 2 })).statusCode,
    ).toBe(409);
    expect(
      (await request("DELETE", "/api/tasks/" + created.id, { expectedRevision: 4 })).statusCode,
    ).toBe(200);
    const list = await app.inject({ method: "GET", url: "/api/tasks", headers: { cookie } });
    expect(list.json().tasks).toEqual([]);
    expect(
      (await request("DELETE", "/api/tasks/" + created.id, { expectedRevision: 5 })).statusCode,
    ).toBe(404);
  });
  it("persists an accepted schedule block and clears it on unschedule", async () => {
    const { request } = await fixture();
    const created = (await request("POST", "/api/tasks", { title: "Lập kế hoạch" })).json()
      .task as TaskView;
    const invalid = await request("PATCH", "/api/tasks/" + created.id, {
      expectedRevision: 1,
      scheduledStart: "2026-10-12T02:00:00.000Z",
    });
    expect(invalid.statusCode).toBe(400);
    const inverted = await request("PATCH", "/api/tasks/" + created.id, {
      expectedRevision: 1,
      scheduledStart: "2026-10-12T03:00:00.000Z",
      scheduledEnd: "2026-10-12T02:00:00.000Z",
    });
    expect(inverted.statusCode).toBe(400);
    const scheduled = await request("PATCH", "/api/tasks/" + created.id, {
      expectedRevision: 1,
      scheduledStart: "2026-10-12T02:00:00.000Z",
      scheduledEnd: "2026-10-12T03:00:00.000Z",
    });
    expect(scheduled.statusCode).toBe(200);
    expect(scheduled.json().task).toMatchObject({
      status: "scheduled",
      scheduledStart: "2026-10-12T02:00:00.000Z",
      scheduledEnd: "2026-10-12T03:00:00.000Z",
      revision: 2,
    });
    const cleared = await request("PATCH", "/api/tasks/" + created.id, {
      expectedRevision: 2,
      scheduledStart: null,
      scheduledEnd: null,
    });
    expect(cleared.json().task).toMatchObject({
      status: "inbox",
      scheduledStart: null,
      scheduledEnd: null,
    });
  });
  it("rejects an overlapping schedule block server-side without changing the task", async () => {
    const { request } = await fixture();
    const first = (await request("POST", "/api/tasks", { title: "Khối một" })).json()
      .task as TaskView;
    const second = (await request("POST", "/api/tasks", { title: "Khối hai" })).json()
      .task as TaskView;
    const booked = await request("PATCH", "/api/tasks/" + first.id, {
      expectedRevision: 1,
      scheduledStart: "2026-10-12T02:00:00.000Z",
      scheduledEnd: "2026-10-12T03:00:00.000Z",
    });
    expect(booked.statusCode).toBe(200);
    const clash = await request("PATCH", "/api/tasks/" + second.id, {
      expectedRevision: 1,
      scheduledStart: "2026-10-12T02:30:00.000Z",
      scheduledEnd: "2026-10-12T04:00:00.000Z",
    });
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toEqual({ error: "schedule-overlap" });
    const adjacent = await request("PATCH", "/api/tasks/" + second.id, {
      expectedRevision: 1,
      scheduledStart: "2026-10-12T03:00:00.000Z",
      scheduledEnd: "2026-10-12T04:00:00.000Z",
    });
    expect(adjacent.statusCode).toBe(200);
  });
  it("never exposes or mutates a different owner's item", async () => {
    const { app, store, cookie, request } = await fixture();
    const other = await store.createTask(otherId, { title: "Other private task" });
    const visible = await app.inject({ method: "GET", url: "/api/tasks", headers: { cookie } });
    expect(visible.json().tasks).toEqual([]);
    expect(
      (
        await request("PATCH", "/api/tasks/" + other.id, {
          expectedRevision: 1,
          title: "Unauthorized",
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await request("DELETE", "/api/tasks/" + other.id, { expectedRevision: 1 })).statusCode,
    ).toBe(404);
    expect(
      (await request("PATCH", "/api/tasks/not-uuid", { expectedRevision: 1, title: "Invalid" }))
        .statusCode,
    ).toBe(400);
  });
});
