import Dexie, { type EntityTable } from "dexie";
import type { TaskItem } from "./TaskWorkspace";

export type PendingCreate = {
  clientMutationId: string;
  ownerId: string;
  taskId: string;
  title: string;
  createdAt: string;
  state: "pending" | "conflict";
  lastError?: string;
};
export type PendingChange = {
  clientMutationId: string;
  ownerId: string;
  taskId: string;
  type: "update" | "delete";
  expectedRevision: number;
  patch?: Record<string, unknown>;
  createdAt: string;
  state: "pending" | "conflict";
  lastError?: string;
};

type Snapshot = {
  ownerId: string;
  tasks: TaskItem[];
  cursor: number | null;
  savedAt: string;
};

const database = new Dexie("dayflow-v2-offline") as Dexie & {
  snapshots: EntityTable<Snapshot, "ownerId">;
  outbox: EntityTable<PendingCreate, "clientMutationId">;
  pendingChanges: EntityTable<PendingChange, "clientMutationId">;
};
database.version(1).stores({
  snapshots: "&ownerId",
  outbox: "&clientMutationId,ownerId,createdAt",
});
database.version(2).stores({
  snapshots: "&ownerId",
  outbox: "&clientMutationId,ownerId,createdAt",
  pendingChanges: "&clientMutationId,ownerId,taskId,createdAt",
});

export async function getOfflineSnapshot(ownerId: string): Promise<Snapshot | null> {
  return (await database.snapshots.get(ownerId)) ?? null;
}

export async function cacheOnlineSnapshot(
  ownerId: string,
  tasks: TaskItem[],
  cursor: number | null,
): Promise<void> {
  await database.snapshots.put({
    ownerId,
    tasks,
    cursor,
    savedAt: new Date().toISOString(),
  });
}

export async function cacheOnlineChanges(
  ownerId: string,
  changes: Array<{
    operation: "create" | "update" | "delete";
    entityId: string;
    payload: TaskItem | { id: string };
  }>,
  cursor: number,
): Promise<void> {
  await database.transaction("rw", database.snapshots, async () => {
    const snapshot = await database.snapshots.get(ownerId);
    if (!snapshot) return;
    const current = new Map(snapshot.tasks.map((task) => [task.id, task]));
    for (const change of changes) {
      if (change.operation === "delete") current.delete(change.entityId);
      else current.set(change.entityId, change.payload as TaskItem);
    }
    await database.snapshots.put({
      ...snapshot,
      tasks: [...current.values()],
      cursor,
      savedAt: new Date().toISOString(),
    });
  });
}

export async function getPendingCreates(ownerId: string): Promise<PendingCreate[]> {
  return (await database.outbox.where("ownerId").equals(ownerId).toArray()).sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      a.clientMutationId.localeCompare(b.clientMutationId),
  );
}

export async function pendingCreateCount(ownerId: string): Promise<number> {
  return database.outbox.where("ownerId").equals(ownerId).count();
}

/** Writes the immutable idempotency key and payload before acknowledging a task. */
export async function enqueueCreate(ownerId: string, title: string): Promise<PendingCreate> {
  const operation: PendingCreate = {
    clientMutationId: crypto.randomUUID(),
    ownerId,
    taskId: crypto.randomUUID(),
    title,
    createdAt: new Date().toISOString(),
    state: "pending",
  };
  await database.outbox.add(operation);
  return operation;
}

export function queuedTask(operation: PendingCreate): TaskItem {
  return {
    id: operation.taskId,
    title: operation.title,
    description: null,
    status: "inbox",
    priority: "medium",
    dueDate: null,
    estimatedMinutes: null,
    scheduledStart: null,
    scheduledEnd: null,
    tags: [],
    subtasks: [],
    revision: 0, // Local-only UI marker. Never send as expectedRevision.
    createdAt: operation.createdAt,
    updatedAt: operation.createdAt,
    completedAt: null,
  };
}

type PushResult = {
  clientMutationId: string;
  kind: "ok" | "conflict" | "not-found" | "schedule-overlap" | "idempotency-key-reused";
  task?: TaskItem | null;
};

/**
 * Each retry sends the EXACT same mutation key and task id.
 * A lost response is safe to replay because the server records accepted keys.
 * Only an acknowledged, matched result may remove the durable outbox entry.
 */
export async function flushPendingCreates(
  ownerId: string,
  csrfToken: string,
): Promise<{ accepted: number; blocked: number }> {
  const pending = await getPendingCreates(ownerId);
  let accepted = 0;
  let blocked = 0;
  for (const item of pending) {
    if (item.state === "conflict") {
      blocked++;
      continue;
    }
    const response = await fetch("/api/sync/push", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Dayflow-CSRF": csrfToken,
        "X-Dayflow-Owner": ownerId,
      },
      body: JSON.stringify({
        operations: [
          {
            clientMutationId: item.clientMutationId,
            type: "create",
            taskId: item.taskId,
            input: { title: item.title },
          },
        ],
      }),
    });
    if (!response.ok) {
      // In particular, retain pending work on network, auth and CSRF failure.
      throw new Error(
        response.status === 401 || response.status === 403
          ? "Phiên đăng nhập đã hết hạn. Công việc đang chờ vẫn được lưu."
          : "Máy chủ chưa xác nhận. Công việc đang chờ vẫn được lưu.",
      );
    }
    const body = (await response.json()) as { results?: PushResult[] };
    const result = body.results?.[0];
    if (!result || result.clientMutationId !== item.clientMutationId) {
      throw new Error("Phản hồi đồng bộ không hợp lệ; công việc vẫn trong hàng chờ.");
    }
    if (result.kind === "ok" && result.task?.id === item.taskId) {
      // Transactional local acknowledgement: keep accepted task in offline cache.
      await database.transaction("rw", database.outbox, database.snapshots, async () => {
        const snapshot = await database.snapshots.get(ownerId);
        const tasks = new Map((snapshot?.tasks ?? []).map((task) => [task.id, task]));
        tasks.set(result.task!.id, result.task!);
        await database.snapshots.put({
          ownerId,
          tasks: [...tasks.values()],
          cursor: snapshot?.cursor ?? null,
          savedAt: new Date().toISOString(),
        });
        await database.outbox.delete(item.clientMutationId);
      });
      accepted++;
    } else {
      // Do not retry a semantic conflict forever; surface it for recovery.
      await database.outbox.update(item.clientMutationId, {
        state: "conflict",
        lastError: result.kind,
      });
      blocked++;
    }
  }
  return { accepted, blocked };
}

/** Scoped cleanup is for isolated unit tests only; never call on sign out. */
export async function clearTestOfflineData(): Promise<void> {
  await database.delete();
  await database.open();
}

export async function getPendingChanges(ownerId: string): Promise<PendingChange[]> {
  const records = await database.pendingChanges.where("ownerId").equals(ownerId).toArray();
  return records.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      a.clientMutationId.localeCompare(b.clientMutationId),
  );
}

export async function pendingOperationCount(ownerId: string): Promise<number> {
  const [creates, changes] = await Promise.all([
    pendingCreateCount(ownerId),
    database.pendingChanges.where("ownerId").equals(ownerId).count(),
  ]);
  return creates + changes;
}

/**
 * Queue one versioned change per server-persisted task. Disallow a second
 * unacknowledged write against the same revision instead of silently losing
 * either request. The original key/body is immutable for safe replay.
 */
export async function enqueueTaskChange(
  ownerId: string,
  task: TaskItem,
  type: "update" | "delete",
  patch?: Record<string, unknown>,
): Promise<PendingChange> {
  if (!Number.isSafeInteger(task.revision) || task.revision < 1)
    throw new Error("Cần đồng bộ công việc mới trước khi tiếp tục chỉnh sửa.");
  if (type === "update" && (!patch || Object.keys(patch).length === 0))
    throw new Error("Không có thay đổi hợp lệ để lưu.");
  const record: PendingChange = {
    clientMutationId: crypto.randomUUID(),
    ownerId,
    taskId: task.id,
    type,
    expectedRevision: task.revision,
    ...(type === "update" ? { patch } : {}),
    createdAt: new Date().toISOString(),
    state: "pending",
  };
  await database.transaction("rw", database.pendingChanges, database.outbox, async () => {
    const other = await database.pendingChanges
      .where("taskId")
      .equals(task.id)
      .filter((value) => value.ownerId === ownerId)
      .first();
    const localCreate = await database.outbox
      .where("ownerId")
      .equals(ownerId)
      .filter((value) => value.taskId === task.id)
      .first();
    if (other || localCreate)
      throw new Error("Công việc đang có thay đổi chờ đồng bộ. Không ghi đè dữ liệu đang chờ.");
    await database.pendingChanges.add(record);
  });
  return record;
}

export function overlayPendingChanges(tasks: TaskItem[], operations: PendingChange[]): TaskItem[] {
  const merged = new Map(tasks.map((task) => [task.id, task]));
  for (const record of operations) {
    // On conflict, prefer showing the server version; keep local intent in
    // the separate conflict panel until the user explicitly resolves it.
    if (record.state !== "pending") continue;
    const current = merged.get(record.taskId);
    if (!current) continue;
    if (record.type === "delete") {
      merged.delete(record.taskId);
    } else {
      merged.set(record.taskId, {
        ...current,
        ...(record.patch as Partial<TaskItem>),
        revision: 0, // Pending UI marker; never use as expectedRevision.
        updatedAt: record.createdAt,
      });
    }
  }
  return [...merged.values()];
}

export type ChangePushResult = {
  clientMutationId: string;
  kind: "ok" | "conflict" | "not-found" | "schedule-overlap" | "idempotency-key-reused";
  taskId?: string;
  task?: TaskItem | null;
  current?: TaskItem | null;
};

/** Process durable update/delete operations using server idempotency keys. */
export async function flushPendingChanges(
  ownerId: string,
  csrfToken: string,
  onResult?: (item: PendingChange, result: ChangePushResult) => void,
): Promise<{ accepted: number; blocked: number }> {
  let accepted = 0;
  let blocked = 0;
  for (const item of await getPendingChanges(ownerId)) {
    if (item.state === "conflict") {
      blocked++;
      continue;
    }
    const operation =
      item.type === "update"
        ? {
            clientMutationId: item.clientMutationId,
            taskId: item.taskId,
            type: "update" as const,
            expectedRevision: item.expectedRevision,
            patch: item.patch,
          }
        : {
            clientMutationId: item.clientMutationId,
            taskId: item.taskId,
            type: "delete" as const,
            expectedRevision: item.expectedRevision,
          };
    const response = await fetch("/api/sync/push", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Dayflow-CSRF": csrfToken,
        "X-Dayflow-Owner": ownerId,
      },
      body: JSON.stringify({ operations: [operation] }),
    });
    if (response.status === 400) {
      await database.pendingChanges.update(item.clientMutationId, {
        state: "conflict",
        lastError: "invalid-mutations",
      });
      blocked++;
      continue;
    }
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? "Phiên đăng nhập không còn hiệu lực. Các thay đổi vẫn được giữ trên thiết bị."
          : "Máy chủ chưa xác nhận. Các thay đổi đang chờ vẫn được giữ.",
      );
    }
    const body = (await response.json()) as { results?: ChangePushResult[] };
    const result = body.results?.[0];
    if (!result || result.clientMutationId !== item.clientMutationId)
      throw new Error("Phản hồi đồng bộ không khớp. Thay đổi vẫn được giữ để kiểm tra.");
    onResult?.(item, result);
    const validAck =
      result.kind === "ok" &&
      result.taskId === item.taskId &&
      (item.type === "delete" ? result.task === null : result.task?.id === item.taskId);
    if (validAck) {
      await database.transaction("rw", database.pendingChanges, database.snapshots, async () => {
        const snapshot = await database.snapshots.get(ownerId);
        if (snapshot) {
          const current = new Map(snapshot.tasks.map((task) => [task.id, task]));
          if (item.type === "delete") current.delete(item.taskId);
          else current.set(item.taskId, result.task!);
          await database.snapshots.put({
            ...snapshot,
            tasks: [...current.values()],
            savedAt: new Date().toISOString(),
          });
        }
        await database.pendingChanges.delete(item.clientMutationId);
      });
      accepted++;
    } else if (result.kind === "ok") {
      // A success without a matching task is not reliable evidence of commit.
      throw new Error("Máy chủ xác nhận thiếu dữ liệu; thay đổi vẫn được giữ.");
    } else {
      await database.pendingChanges.update(item.clientMutationId, {
        state: "conflict",
        lastError: result.kind,
      });
      blocked++;
    }
  }
  return { accepted, blocked };
}

/** Human-selected discard affects only this owner's unsent operation. */
export async function discardPendingChange(ownerId: string, mutationId: string): Promise<void> {
  await database.transaction("rw", database.pendingChanges, async () => {
    const record = await database.pendingChanges.get(mutationId);
    if (!record || record.ownerId !== ownerId) throw new Error("Thao tác không tồn tại.");
    await database.pendingChanges.delete(mutationId);
  });
}

/**
 * Explicit conflict override creates a NEW idempotency key and current
 * server revision. Never mutate the payload associated with an old key.
 */
export async function retryConflictedChange(
  ownerId: string,
  mutationId: string,
  serverRevision: number,
  amendedPatch?: Record<string, unknown>,
): Promise<PendingChange> {
  if (!Number.isSafeInteger(serverRevision) || serverRevision < 1)
    throw new Error("Phiên bản máy chủ không hợp lệ.");
  return database.transaction("rw", database.pendingChanges, async () => {
    const record = await database.pendingChanges.get(mutationId);
    if (!record || record.ownerId !== ownerId || record.state !== "conflict")
      throw new Error("Không tìm thấy thay đổi cần xử lý.");
    const next: PendingChange = {
      ...record,
      clientMutationId: crypto.randomUUID(),
      expectedRevision: serverRevision,
      createdAt: new Date().toISOString(),
      state: "pending",
      ...(amendedPatch && record.type === "update" ? { patch: amendedPatch } : {}),
    };
    delete next.lastError;
    await database.pendingChanges.delete(mutationId);
    await database.pendingChanges.add(next);
    return next;
  });
}

/** Human-chosen deletion of a stuck offline create; never automatic. */
export async function discardPendingCreate(ownerId: string, mutationId: string): Promise<void> {
  await database.transaction("rw", database.outbox, async () => {
    const record = await database.outbox.get(mutationId);
    if (!record || record.ownerId !== ownerId || record.state !== "conflict")
      throw new Error("Không tìm thấy thao tác tạo đang xung đột.");
    await database.outbox.delete(mutationId);
  });
}

/** Explicit retry of a rejected create with BOTH a new task ID and mutation ID. */
export async function retryConflictedCreate(
  ownerId: string,
  mutationId: string,
): Promise<PendingCreate> {
  return database.transaction("rw", database.outbox, async () => {
    const original = await database.outbox.get(mutationId);
    if (!original || original.ownerId !== ownerId || original.state !== "conflict")
      throw new Error("Không tìm thấy thao tác tạo đang xung đột.");
    const next: PendingCreate = {
      ...original,
      clientMutationId: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      state: "pending",
    };
    delete next.lastError;
    await database.outbox.delete(mutationId);
    await database.outbox.add(next);
    return next;
  });
}
