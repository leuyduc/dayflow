// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheOnlineSnapshot,
  clearTestOfflineData,
  enqueueCreate,
  flushPendingCreates,
  getOfflineSnapshot,
  getPendingCreates,
  pendingCreateCount,
  queuedTask,
  enqueueTaskChange,
  getPendingChanges,
  flushPendingChanges,
  overlayPendingChanges,
  retryConflictedChange,
  discardPendingChange,
  pendingOperationCount,
  retryConflictedCreate,
  discardPendingCreate,
} from "./offline-store";

const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
let n = 0;

beforeEach(async () => {
  n = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => "00000000-0000-4000-8000-" + String(++n).padStart(12, "0"),
  });
  await clearTestOfflineData();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("durable account-scoped offline creates", () => {
  it("records immutable IDs before sending, retaining account-scoped cached tasks", async () => {
    await cacheOnlineSnapshot(ownerA, [], 5);
    const created = await enqueueCreate(ownerA, "Việc offline");
    expect(created.clientMutationId).not.toBe(created.taskId);
    expect(queuedTask(created)).toMatchObject({
      id: created.taskId,
      title: "Việc offline",
      revision: 0,
    });
    expect(await pendingCreateCount(ownerA)).toBe(1);
    expect(await pendingCreateCount(ownerB)).toBe(0);
    expect(await getPendingCreates(ownerA)).toEqual([created]);
    expect((await getOfflineSnapshot(ownerA))?.cursor).toBe(5);
    expect(await getOfflineSnapshot(ownerB)).toBeNull();
  });

  it("replays an ambiguous successful create with the SAME key and no duplicate task", async () => {
    const item = await enqueueCreate(ownerA, "Một lần duy nhất");
    const serverTasks = new Map<string, object>();
    const payloads: Array<{ clientMutationId: string; taskId: string }> = [];
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_path: string, init: RequestInit) => {
        const operation = JSON.parse(String(init.body)).operations[0] as {
          clientMutationId: string;
          taskId: string;
          input: { title: string };
        };
        payloads.push(operation);
        if (!serverTasks.has(operation.taskId)) {
          serverTasks.set(operation.taskId, {
            ...queuedTask(item),
            revision: 1,
          });
        }
        if (first) {
          first = false;
          // Simulated dropped response AFTER PostgreSQL accepted the create.
          throw new TypeError("Network response lost");
        }
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                kind: "ok",
                clientMutationId: operation.clientMutationId,
                task: serverTasks.get(operation.taskId),
              },
            ],
          }),
        };
      }),
    );
    await expect(flushPendingCreates(ownerA, "csrf")).rejects.toThrow("Network response lost");
    expect(await pendingCreateCount(ownerA)).toBe(1);
    expect(await flushPendingCreates(ownerA, "csrf")).toEqual({ accepted: 1, blocked: 0 });
    expect(await pendingCreateCount(ownerA)).toBe(0);
    expect(serverTasks.size).toBe(1);
    expect(payloads).toHaveLength(2);
    expect(payloads[1]).toEqual(payloads[0]);
    expect((await getOfflineSnapshot(ownerA))?.tasks).toHaveLength(1);
  });

  it("keeps queued records on unauthorized requests, including after another owner logs in", async () => {
    await enqueueCreate(ownerA, "Việc A");
    await enqueueCreate(ownerB, "Việc B");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401 })),
    );
    await expect(flushPendingCreates(ownerA, "expired")).rejects.toThrow(/hết hạn/);
    expect(await pendingCreateCount(ownerA)).toBe(1);
    expect(await pendingCreateCount(ownerB)).toBe(1);
  });

  it("surfaces semantic conflicts without deleting the original operation or looping", async () => {
    const item = await enqueueCreate(ownerA, "ID đã chiếm");
    const mock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [{ clientMutationId: item.clientMutationId, kind: "conflict", current: null }],
      }),
    }));
    vi.stubGlobal("fetch", mock);
    expect(await flushPendingCreates(ownerA, "csrf")).toEqual({ accepted: 0, blocked: 1 });
    expect((await getPendingCreates(ownerA))[0]).toMatchObject({
      state: "conflict",
      lastError: "conflict",
    });
    expect(await flushPendingCreates(ownerA, "csrf")).toEqual({ accepted: 0, blocked: 1 });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("does not acknowledge mismatched IDs or malformed server success responses", async () => {
    await enqueueCreate(ownerA, "Kiểm tra phản hồi");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ results: [{ kind: "ok", clientMutationId: ownerB }] }),
      })),
    );
    await expect(flushPendingCreates(ownerA, "csrf")).rejects.toThrow(/không hợp lệ/);
    expect(await pendingCreateCount(ownerA)).toBe(1);
  });
});

function syncedTask(id: string, title: string) {
  const base = queuedTask({
    clientMutationId: id,
    ownerId: ownerA,
    taskId: id,
    title,
    createdAt: "2026-10-13T00:00:00.000Z",
    state: "pending",
  });
  return { ...base, revision: 2 };
}

describe("durable offline update/delete outbox", () => {
  it("persists one versioned change per task and overlays without mutating server cache", async () => {
    const task = syncedTask("44444444-4444-4444-8444-444444444444", "Bản máy chủ");
    await cacheOnlineSnapshot(ownerA, [task], 8);
    const change = await enqueueTaskChange(ownerA, task, "update", { title: "Bản offline" });
    expect(await pendingOperationCount(ownerA)).toBe(1);
    expect(await getPendingChanges(ownerB)).toEqual([]);
    await expect(enqueueTaskChange(ownerA, task, "delete")).rejects.toThrow(
      /đang có thay đổi chờ đồng bộ/,
    );
    expect(overlayPendingChanges([task], [change])).toMatchObject([
      { title: "Bản offline", revision: 0 },
    ]);
    expect((await getOfflineSnapshot(ownerA))?.tasks).toMatchObject([
      { title: "Bản máy chủ", revision: 2 },
    ]);
  });

  it("retries an ambiguous accepted update with an identical key and no second write", async () => {
    const task = syncedTask("44444444-4444-4444-8444-444444444444", "Ban đầu");
    await cacheOnlineSnapshot(ownerA, [task], 8);
    const change = await enqueueTaskChange(ownerA, task, "update", { title: "Sửa offline" });
    const sent: object[] = [];
    let attempts = 0;
    let writes = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const op = JSON.parse(String(init.body)).operations[0];
        sent.push(op);
        attempts++;
        if (writes === 0) writes++;
        if (attempts === 1) throw new TypeError("response lost");
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                clientMutationId: op.clientMutationId,
                taskId: op.taskId,
                kind: "ok",
                task: { ...task, title: "Sửa offline", revision: 3 },
              },
            ],
          }),
        };
      }),
    );
    await expect(flushPendingChanges(ownerA, "csrf")).rejects.toThrow(/response lost/);
    expect((await getPendingChanges(ownerA))[0]).toEqual(change);
    expect(await flushPendingChanges(ownerA, "csrf")).toEqual({ accepted: 1, blocked: 0 });
    expect(writes).toBe(1);
    expect(sent[1]).toEqual(sent[0]);
    expect(await pendingOperationCount(ownerA)).toBe(0);
    expect((await getOfflineSnapshot(ownerA))?.tasks).toMatchObject([
      { title: "Sửa offline", revision: 3 },
    ]);
  });

  it("retains conflicts until user creates a new key with a fresh server revision", async () => {
    const task = syncedTask("44444444-4444-4444-8444-444444444444", "Gốc");
    const previous = await enqueueTaskChange(ownerA, task, "update", { title: "Ý định của tôi" });
    const requests: Array<{ clientMutationId: string; expectedRevision: number }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const op = JSON.parse(String(init.body)).operations[0];
        requests.push(op);
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                clientMutationId: op.clientMutationId,
                kind: requests.length === 1 ? "conflict" : "ok",
                taskId: op.taskId,
                current: { ...task, revision: 3, title: "Thay đổi từ máy B" },
                task:
                  requests.length === 1
                    ? undefined
                    : {
                        ...task,
                        title: "Ý định của tôi",
                        revision: 4,
                      },
              },
            ],
          }),
        };
      }),
    );
    expect(await flushPendingChanges(ownerA, "csrf")).toEqual({ accepted: 0, blocked: 1 });
    expect((await getPendingChanges(ownerA))[0]).toMatchObject({
      state: "conflict",
      lastError: "conflict",
    });
    expect(await flushPendingChanges(ownerA, "csrf")).toEqual({ accepted: 0, blocked: 1 });
    expect(requests).toHaveLength(1);
    const fresh = await retryConflictedChange(ownerA, previous.clientMutationId, 3);
    expect(fresh.expectedRevision).toBe(3);
    expect(fresh.clientMutationId).not.toBe(previous.clientMutationId);
    expect(await flushPendingChanges(ownerA, "csrf")).toEqual({ accepted: 1, blocked: 0 });
    expect(requests[1]).toMatchObject({
      clientMutationId: fresh.clientMutationId,
      expectedRevision: 3,
    });
    expect(await getPendingChanges(ownerA)).toEqual([]);
  });

  it("acknowledges a matching delete, keeps cross-owner pending data untouched", async () => {
    const task = syncedTask("44444444-4444-4444-8444-444444444444", "Xóa sau");
    await cacheOnlineSnapshot(ownerA, [task], 5);
    const change = await enqueueTaskChange(ownerA, task, "delete");
    const other = syncedTask("55555555-5555-4555-8555-555555555555", "Tài khoản khác");
    await enqueueTaskChange(ownerB, other, "delete");
    expect(overlayPendingChanges([task], [change])).toEqual([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const op = JSON.parse(String(init.body)).operations[0];
        return {
          ok: true,
          json: async () => ({
            results: [
              { clientMutationId: op.clientMutationId, taskId: op.taskId, kind: "ok", task: null },
            ],
          }),
        };
      }),
    );
    expect(await flushPendingChanges(ownerA, "csrf")).toEqual({ accepted: 1, blocked: 0 });
    expect((await getOfflineSnapshot(ownerA))?.tasks).toEqual([]);
    expect(await pendingOperationCount(ownerB)).toBe(1);
    expect(await getPendingChanges(ownerB)).toHaveLength(1);
  });

  it("rejects a mismatched success and supports owner-scoped explicit discard", async () => {
    const task = syncedTask("44444444-4444-4444-8444-444444444444", "Cần bảo toàn");
    const change = await enqueueTaskChange(ownerA, task, "delete");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              kind: "ok",
              clientMutationId: change.clientMutationId,
              taskId: ownerB,
              task: null,
            },
          ],
        }),
      })),
    );
    await expect(flushPendingChanges(ownerA, "csrf")).rejects.toThrow(/thiếu dữ liệu/);
    expect(await pendingOperationCount(ownerA)).toBe(1);
    await expect(discardPendingChange(ownerB, change.clientMutationId)).rejects.toThrow(
      /không tồn tại/,
    );
    await discardPendingChange(ownerA, change.clientMutationId);
    expect(await getPendingChanges(ownerA)).toEqual([]);
  });
});

describe("explicit recovery of rejected offline creates", () => {
  it("preserves a rejected create until a human requests a new task/mutation ID", async () => {
    const old = await enqueueCreate(ownerA, "Việc bị trùng mã");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [{ clientMutationId: old.clientMutationId, kind: "conflict", current: null }],
        }),
      })),
    );
    expect(await flushPendingCreates(ownerA, "csrf")).toEqual({ accepted: 0, blocked: 1 });
    const queued = (await getPendingCreates(ownerA))[0]!;
    expect(queued).toMatchObject({ state: "conflict", lastError: "conflict" });
    expect(await flushPendingCreates(ownerA, "csrf")).toEqual({ accepted: 0, blocked: 1 });
    const fresh = await retryConflictedCreate(ownerA, old.clientMutationId);
    expect(fresh.title).toBe(old.title);
    expect(fresh.clientMutationId).not.toBe(old.clientMutationId);
    expect(fresh.taskId).not.toBe(old.taskId);
    expect(fresh.state).toBe("pending");
    expect(await pendingOperationCount(ownerA)).toBe(1);
    expect(await getPendingCreates(ownerB)).toEqual([]);
  });

  it("allows discarding a conflicting create only with the matching owner", async () => {
    const old = await enqueueCreate(ownerA, "Cần xác nhận");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [{ clientMutationId: old.clientMutationId, kind: "not-found" }],
        }),
      })),
    );
    await flushPendingCreates(ownerA, "csrf");
    await expect(discardPendingCreate(ownerB, old.clientMutationId)).rejects.toThrow();
    await discardPendingCreate(ownerA, old.clientMutationId);
    expect(await getPendingCreates(ownerA)).toEqual([]);
  });
});

describe("G7 replay owner-bound request headers", () => {
  it("sends the durable owner identity for both create and update", async () => {
    const created = await enqueueCreate(ownerA, "Owner-bound create");
    const existing = syncedTask("44444444-4444-4444-8444-444444444444", "Original");
    await enqueueTaskChange(ownerA, existing, "update", { title: "Owner-bound update" });
    const headers: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_path: string, init: RequestInit) => {
        headers.push((init.headers as Record<string, string>)["X-Dayflow-Owner"]!);
        const op = JSON.parse(String(init.body)).operations[0];
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                clientMutationId: op.clientMutationId,
                taskId: op.taskId,
                kind: "ok",
                task:
                  op.type === "create"
                    ? { ...queuedTask(created), revision: 1 }
                    : { ...existing, title: "Owner-bound update", revision: 3 },
              },
            ],
          }),
        };
      }),
    );
    expect(await flushPendingCreates(ownerA, "csrf")).toEqual({ accepted: 1, blocked: 0 });
    expect(await flushPendingChanges(ownerA, "csrf")).toEqual({ accepted: 1, blocked: 0 });
    expect(headers).toEqual([ownerA, ownerA]);
  });
});
