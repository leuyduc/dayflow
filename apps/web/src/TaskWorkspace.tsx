import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { zonedWallClockToUtc } from "@dayflow/domain";
import { addDays, localDate, wallClockToInput } from "./dates";
import {
  cacheOnlineChanges,
  cacheOnlineSnapshot,
  enqueueCreate,
  flushPendingCreates,
  getOfflineSnapshot,
  getPendingCreates,
  queuedTask,
  getPendingChanges,
  enqueueTaskChange,
  flushPendingChanges,
  overlayPendingChanges,
  discardPendingChange,
  retryConflictedChange,
  retryConflictedCreate,
  discardPendingCreate,
  type PendingCreate,
  type PendingChange,
  type ChangePushResult,
} from "./offline-store";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "inbox" | "scheduled" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  estimatedMinutes: number | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  tags: string[];
  subtasks?: Array<{ id: string; title: string; completed: boolean }>;
  revision: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
export type Page = "today" | "inbox" | "calendar" | "settings";

const priorityRank: Record<TaskItem["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function parseWallInput(value: string): { date: string; minutes: number } | null {
  const [date, clock] = value.split("T");
  if (!date || !clock) return null;
  const [hourText, minuteText] = clock.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return { date, minutes: hour * 60 + minute };
}

function dayHeading(date: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date + "T12:00:00Z"));
}

function formatSchedule(task: TaskItem, zone: string): string {
  if (!task.scheduledStart || !task.scheduledEnd) return "";
  const format = new Intl.DateTimeFormat("vi-VN", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    " · " +
    localDate(new Date(task.scheduledStart), zone) +
    " " +
    format.format(new Date(task.scheduledStart)) +
    "–" +
    format.format(new Date(task.scheduledEnd))
  );
}

type SyncChange = {
  cursor: number;
  entityId: string;
  operation: "create" | "update" | "delete";
  payload: TaskItem | { id: string; revision: number; deletedAt: string };
};
type SyncPullResponse = {
  changes: SyncChange[];
  nextCursor: number;
  hasMore: boolean;
};
type SyncBootstrapResponse = { tasks: TaskItem[]; cursor: number };

function applyServerChanges(current: TaskItem[], changes: SyncChange[]): TaskItem[] {
  const next = new Map(current.map((task) => [task.id, task]));
  for (const change of changes) {
    if (change.operation === "delete") {
      next.delete(change.entityId);
    } else {
      const task = change.payload as TaskItem;
      if (
        task.id !== change.entityId ||
        typeof task.title !== "string" ||
        !Number.isSafeInteger(task.revision)
      ) {
        throw new Error("Dữ liệu đồng bộ không hợp lệ.");
      }
      next.set(change.entityId, task);
    }
  }
  return [...next.values()].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
  );
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 409)
      throw new Error(
        "Công việc đã được thay đổi trên thiết bị khác. Thao tác của bạn chưa được áp dụng; danh sách đã được tải lại.",
      );
    if (response.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
    throw new Error("Không thể lưu dữ liệu. Vui lòng thử lại.");
  }
  return (await response.json()) as T;
}

export function TaskWorkspace({
  csrfToken,
  page,
  ownerId,
}: {
  csrfToken: string;
  page: Page;
  ownerId: string;
}) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingCreates, setPendingCreates] = useState<PendingCreate[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "inbox" | "completed" | "upcoming">("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskItem["priority"]>("all");
  const [sort, setSort] = useState<"updated" | "due" | "priority">("updated");
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [editConflict, setEditConflict] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<TaskItem["priority"]>("medium");
  const [editMinutes, setEditMinutes] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editSubtasks, setEditSubtasks] = useState<
    Array<{ id: string; title: string; completed: boolean }>
  >([]);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayDate = localDate(new Date(), zone);
  const [dayAnchor, setDayAnchor] = useState(todayDate);
  const cursorRef = useRef<number | null>(null);
  const snapshotVersion = useRef(0);
  const pullingRef = useRef(false);
  const flushingRef = useRef(false);

  async function refreshPending() {
    const [creates, changes] = await Promise.all([
      getPendingCreates(ownerId),
      getPendingChanges(ownerId),
    ]);
    setPendingCreates(creates);
    setPendingChanges(changes);
  }

  async function flushOutbox(
    onChangeResult?: (item: PendingChange, result: ChangePushResult) => void,
  ): Promise<boolean> {
    if (flushingRef.current || !navigator.onLine) return false;
    flushingRef.current = true;
    try {
      const creates = await flushPendingCreates(ownerId, csrfToken);
      const changes = await flushPendingChanges(ownerId, csrfToken, onChangeResult);
      await refreshPending();
      const accepted = creates.accepted + changes.accepted;
      const blocked = creates.blocked + changes.blocked;
      if (accepted > 0) setNotice("Đã đồng bộ " + accepted + " thao tác đang chờ.");
      if (blocked > 0)
        setError(
          "Có " +
            blocked +
            " thao tác bị xung đột. Dữ liệu vẫn được giữ trên thiết bị để bạn xử lý.",
        );
      return accepted > 0;
    } finally {
      flushingRef.current = false;
    }
  }

  async function reload() {
    const version = ++snapshotVersion.current;
    const response = await fetch("/api/sync/bootstrap", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Dayflow-Owner": ownerId },
    });
    const result = await responseJson<SyncBootstrapResponse>(response);
    if (version !== snapshotVersion.current) return;
    cursorRef.current = result.cursor;
    setTasks(result.tasks);
    await cacheOnlineSnapshot(ownerId, result.tasks, result.cursor).catch(() => {
      setError("Không lưu được bộ nhớ đệm offline. Hãy kiểm tra dung lượng thiết bị.");
    });
  }

  // Read the ordered online change feed. Never advance the cursor for a failed page.
  // A newer bootstrap invalidates an older in-flight pull.
  async function pullChanges() {
    const initial = cursorRef.current;
    if (initial === null || pullingRef.current) return;
    pullingRef.current = true;
    const version = snapshotVersion.current;
    let cursor = initial;
    const changes: SyncChange[] = [];
    try {
      for (let page = 0; page < 20; page++) {
        const response = await fetch(`/api/sync/pull?cursor=${cursor}&limit=100`, {
          credentials: "same-origin",
          cache: "no-store",
          headers: { "X-Dayflow-Owner": ownerId },
        });
        if (response.status === 409) {
          // Cursor expired/ahead: replace only with a consistent server snapshot.
          await reload();
          return;
        }
        const result = await responseJson<SyncPullResponse>(response);
        if (
          !Number.isSafeInteger(result.nextCursor) ||
          result.nextCursor < cursor ||
          (result.hasMore && result.nextCursor === cursor)
        ) {
          throw new Error("Dữ liệu đồng bộ không hợp lệ.");
        }
        changes.push(...result.changes);
        cursor = result.nextCursor;
        if (!result.hasMore) break;
      }
      if (snapshotVersion.current !== version) return;
      setTasks((current) => applyServerChanges(current, changes));
      cursorRef.current = cursor;
      await cacheOnlineChanges(ownerId, changes, cursor).catch(() => {
        setError("Không lưu được bộ nhớ đệm offline. Hãy kiểm tra dung lượng thiết bị.");
      });
    } finally {
      pullingRef.current = false;
    }
  }

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const [cached, queued, changes] = await Promise.all([
          getOfflineSnapshot(ownerId),
          getPendingCreates(ownerId),
          getPendingChanges(ownerId),
        ]);
        if (!active) return;
        if (cached) {
          setTasks(cached.tasks);
          cursorRef.current = cached.cursor;
        }
        setPendingCreates(queued);
        setPendingChanges(changes);
      } catch {
        if (active) setError("Không đọc được dữ liệu lưu offline trên thiết bị.");
      }
      if (active && navigator.onLine) {
        try {
          await flushOutbox();
          await reload();
        } catch {
          if (active) setError("Không kết nối được máy chủ. Dữ liệu đã lưu vẫn ở trên thiết bị.");
        }
      }
      if (active) setLoading(false);
    }
    void restore();
    return () => {
      active = false;
      snapshotVersion.current++;
    };
  }, [ownerId]);

  // Keep the durable create queue until each operation is acknowledged by the server.
  // Offline updates/deletes and complete PWA support remain separate G7 work.
  useEffect(() => {
    let active = true;
    async function syncVisible() {
      if (!active || document.visibilityState === "hidden" || !navigator.onLine) return;
      try {
        const accepted = await flushOutbox();
        if (accepted || cursorRef.current === null) await reload();
        else await pullChanges();
      } catch {
        // Keep cached state and immutable outbox operations for the next reconnect.
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncVisible();
    };
    window.addEventListener("focus", syncVisible);
    window.addEventListener("online", syncVisible);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void syncVisible(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", syncVisible);
      window.removeEventListener("online", syncVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function mutate(method: "PATCH" | "DELETE", endpoint: string, payload: object) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const taskId = endpoint.split("/").at(-1);
      const target = tasks.find((task) => task.id === taskId);
      if (!target) throw new Error("Không tìm thấy công việc để lưu thao tác.");
      const { expectedRevision, ...patch } = payload as Record<string, unknown>;
      if (expectedRevision !== target.revision)
        throw new Error("Công việc đã thay đổi. Hãy đồng bộ trước khi thao tác tiếp.");

      // Both online and offline mutations must be durably queued BEFORE HTTP.
      // A lost success response is replayed using the exact same mutation ID.
      await enqueueTaskChange(
        ownerId,
        target,
        method === "DELETE" ? "delete" : "update",
        method === "PATCH" ? patch : undefined,
      );
      await refreshPending();
      setNotice("Đã lưu thay đổi trên thiết bị. Sẽ đồng bộ khi có kết nối.");

      if (navigator.onLine) {
        try {
          await flushOutbox();
        } catch (issue) {
          // Never remove or regenerate the already persisted mutation.
          setError(
            issue instanceof Error
              ? issue.message
              : "Máy chủ chưa xác nhận. Thao tác vẫn được giữ trên thiết bị.",
          );
        }
        // Keep the latest server version alongside any remaining local intent.
        await reload().catch(() => {});
      }
      return true;
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể lưu thay đổi trên thiết bị.");
      await reload().catch(() => {});
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      // Durable write FIRST: retrying this request must never create a second task.
      await enqueueCreate(ownerId, trimmed);
      await refreshPending();
      setTitle("");
      setNotice("Đã lưu trên thiết bị. Công việc sẽ đồng bộ khi có kết nối.");
      if (navigator.onLine) {
        try {
          await flushOutbox();
          await reload();
        } catch {
          setNotice("Đã lưu trên thiết bị. Máy chủ chưa xác nhận; sẽ gửi lại cùng mã thao tác.");
        }
      }
    } catch {
      setError("Không thể lưu hàng chờ trên thiết bị. Nội dung vẫn ở ô nhập.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveCreateConflict(item: PendingCreate, retry: boolean) {
    if (
      !window.confirm(
        retry
          ? "Máy chủ từ chối yêu cầu cũ. Gửi lại như một việc MỚI với mã khác?"
          : "Bỏ việc tạo chưa được máy chủ chấp nhận? Nội dung cục bộ này sẽ bị xóa.",
      )
    )
      return;
    setBusy(true);
    try {
      if (retry) {
        await retryConflictedCreate(ownerId, item.clientMutationId);
      } else {
        await discardPendingCreate(ownerId, item.clientMutationId);
      }
      await refreshPending();
      if (retry && navigator.onLine) {
        await flushOutbox();
        await reload();
      }
      setNotice(
        retry
          ? "Đã tạo yêu cầu mới theo lựa chọn của bạn."
          : "Đã bỏ thao tác tạo bị xung đột theo lựa chọn của bạn.",
      );
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể xử lý thao tác tạo.");
    } finally {
      setBusy(false);
    }
  }

  async function discardConflict(change: PendingChange) {
    if (
      !window.confirm("Bỏ thay đổi chưa được máy chủ chấp nhận? Dữ liệu trên máy chủ sẽ được giữ.")
    )
      return;
    setBusy(true);
    try {
      await discardPendingChange(ownerId, change.clientMutationId);
      await refreshPending();
      if (navigator.onLine) await reload();
      setError("");
      setNotice("Đã bỏ thay đổi đang chờ theo lựa chọn của bạn.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể xử lý thay đổi.");
    } finally {
      setBusy(false);
    }
  }

  async function reapplyConflict(change: PendingChange) {
    if (!navigator.onLine) {
      setError("Cần có kết nối để kiểm tra phiên bản máy chủ trước khi áp dụng lại.");
      return;
    }
    if (!window.confirm("Dùng thay đổi đang chờ của bạn trên phiên bản mới nhất từ máy chủ?"))
      return;
    setBusy(true);
    try {
      const response = await fetch("/api/sync/bootstrap", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const snapshot = await responseJson<SyncBootstrapResponse>(response);
      const current = snapshot.tasks.find((task) => task.id === change.taskId);
      if (!current)
        throw new Error(
          "Công việc đã bị xóa trên máy chủ. Hãy giữ lại hoặc xuất dữ liệu chờ để xem xét.",
        );
      await retryConflictedChange(ownerId, change.clientMutationId, current.revision);
      await refreshPending();
      await flushOutbox();
      await reload();
      setNotice("Đã yêu cầu áp dụng lại thay đổi. Hãy kiểm tra trạng thái đồng bộ.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể giải quyết xung đột.");
    } finally {
      setBusy(false);
    }
  }

  async function keepServerEditConflict() {
    if (!editing) return;
    const taskId = editing.id;
    // The user explicitly chose the server version. Keep any durable record
    // until its owner-scoped discard transaction actually succeeds.
    setEditing(null);
    setEditConflict(null);
    setError("");
    try {
      const record = (await getPendingChanges(ownerId)).find(
        (item) => item.taskId === taskId && item.type === "update" && item.state === "conflict",
      );
      if (record) await discardPendingChange(ownerId, record.clientMutationId);
      await refreshPending();
      if (navigator.onLine) await reload();
    } catch {
      setError("Không thể bỏ thao tác đã xung đột. Bản lưu trên thiết bị vẫn được giữ để xử lý.");
    }
  }

  function startEdit(item: TaskItem) {
    if (item.revision < 1) {
      setError("Công việc đang chờ đồng bộ; cần xác nhận từ máy chủ trước khi chỉnh sửa thêm.");
      return;
    }
    setEditing(item);
    setEditConflict(null);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditDueDate(item.dueDate ?? "");
    setEditPriority(item.priority);
    setEditMinutes(item.estimatedMinutes === null ? "" : String(item.estimatedMinutes));
    setEditTags(item.tags.join(", "));
    setEditStart(item.scheduledStart ? wallClockToInput(item.scheduledStart, zone) : "");
    setEditEnd(item.scheduledEnd ? wallClockToInput(item.scheduledEnd, zone) : "");
    setEditSubtasks((item.subtasks ?? []).map((subtask) => ({ ...subtask })));
  }
  async function submitEdit(expectedRevision: number) {
    if (!editing || busy) return;
    const minutes = editMinutes.trim() === "" ? null : Number(editMinutes);
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) {
      setError("Thời lượng phải từ 1 đến 1440 phút.");
      return;
    }
    const tags = editTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (tags.length > 12 || tags.some((tag) => tag.length > 40)) {
      setError("Tối đa 12 thẻ, mỗi thẻ không quá 40 ký tự.");
      return;
    }
    const subtasks = editSubtasks.map((subtask) => ({
      ...subtask,
      title: subtask.title.trim().replace(/\s+/g, " "),
    }));
    if (
      subtasks.length > 30 ||
      subtasks.some((subtask) => !subtask.title || subtask.title.length > 240)
    ) {
      setError("Mỗi việc con cần tiêu đề từ 1 đến 240 ký tự, tối đa 30 việc con.");
      return;
    }
    const subtasksPatch =
      JSON.stringify(subtasks) === JSON.stringify(editing.subtasks ?? [])
        ? undefined
        : { subtasks };
    let schedulePatch: { scheduledStart: string | null; scheduledEnd: string | null } | undefined;
    if (editStart || editEnd) {
      const startParts = parseWallInput(editStart);
      const endParts = parseWallInput(editEnd);
      if (!startParts || !endParts) {
        setError("Đặt cả giờ bắt đầu và giờ kết thúc, hoặc để trống cả hai để bỏ lịch.");
        return;
      }
      const startMs = zonedWallClockToUtc(startParts.date, startParts.minutes, zone);
      const endMs = zonedWallClockToUtc(endParts.date, endParts.minutes, zone);
      if (!(endMs > startMs) || endMs - startMs > 1440 * 60_000) {
        setError("Khối lịch phải dài hơn 0 phút và không quá 24 giờ.");
        return;
      }
      const clash = tasks.some((item) => {
        if (item.id === editing.id || item.status === "completed") return false;
        if (!item.scheduledStart || !item.scheduledEnd) return false;
        return startMs < Date.parse(item.scheduledEnd) && Date.parse(item.scheduledStart) < endMs;
      });
      if (clash) {
        setError("Khung giờ này trùng một khối lịch đã có.");
        return;
      }
      schedulePatch = {
        scheduledStart: new Date(startMs).toISOString(),
        scheduledEnd: new Date(endMs).toISOString(),
      };
    } else if (editing.scheduledStart || editing.scheduledEnd) {
      schedulePatch = { scheduledStart: null, scheduledEnd: null };
    }
    const patch = {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      dueDate: editDueDate || null,
      priority: editPriority,
      estimatedMinutes: minutes,
      tags,
      ...schedulePatch,
      ...subtasksPatch,
    };
    setBusy(true);
    setError("");
    try {
      // Persist all full-form edits before HTTP, even when the browser is online.
      // If a response is lost after COMMIT, the same ID/body is safe to replay.
      let mutation: PendingChange;
      if (editConflict) {
        const conflicted = (await getPendingChanges(ownerId)).find(
          (item) =>
            item.taskId === editing.id && item.type === "update" && item.state === "conflict",
        );
        if (!conflicted)
          throw new Error("Không còn bản chỉnh sửa xung đột để áp dụng. Hãy tải lại công việc.");
        mutation = await retryConflictedChange(
          ownerId,
          conflicted.clientMutationId,
          expectedRevision,
          patch, // Include any changes the user made in the review form.
        );
      } else {
        mutation = await enqueueTaskChange(ownerId, editing, "update", patch);
      }
      await refreshPending();
      if (!navigator.onLine) {
        setEditing(null);
        setEditConflict(null);
        setNotice("Đã lưu chỉnh sửa trên thiết bị. Sẽ gửi khi có mạng.");
        return;
      }

      let acknowledged: ChangePushResult | undefined;
      try {
        await flushOutbox((item, result) => {
          if (item.clientMutationId === mutation.clientMutationId) acknowledged = result;
        });
      } catch (issue) {
        // Both the draft and immutable outbox mutation survive the failure.
        setNotice("Đã lưu bản chỉnh sửa trên thiết bị; sẽ gửi lại đúng mã thao tác.");
        setError(
          issue instanceof Error
            ? issue.message
            : "Máy chủ chưa xác nhận. Bản chỉnh sửa vẫn an toàn trên thiết bị.",
        );
        return;
      }

      if (acknowledged?.kind === "conflict" && acknowledged.current) {
        setEditConflict(acknowledged.current);
        setError("Công việc đã được sửa trên thiết bị khác. Hãy so sánh hai phiên bản.");
        await reload();
        return;
      }
      if (acknowledged?.kind === "schedule-overlap") {
        setError("Khung giờ này trùng một khối lịch đã có.");
        await reload();
        return;
      }
      if (
        acknowledged?.kind === "not-found" ||
        acknowledged?.kind === "conflict" ||
        acknowledged?.kind === "idempotency-key-reused"
      ) {
        setEditConflict(null);
        setError(
          "Máy chủ chưa chấp nhận bản chỉnh sửa. Nội dung vẫn được giữ trong biểu mẫu và hàng chờ.",
        );
        await reload();
        return;
      }

      // Another tab or background sync may have already replayed this same key.
      const outstanding = (await getPendingChanges(ownerId)).find(
        (item) => item.clientMutationId === mutation.clientMutationId,
      );
      if (outstanding?.state === "conflict") {
        const response = await fetch("/api/sync/bootstrap", {
          credentials: "same-origin",
          cache: "no-store",
          headers: { "X-Dayflow-Owner": ownerId },
        });
        const current = (await responseJson<SyncBootstrapResponse>(response)).tasks.find(
          (task) => task.id === editing.id,
        );
        if (current) setEditConflict(current);
        setError("Máy chủ đã thay đổi công việc. Bản của bạn được giữ để lựa chọn.");
        await reload();
        return;
      }
      setEditing(null);
      setEditConflict(null);
      if (outstanding) {
        setNotice("Đã lưu chỉnh sửa vào hàng chờ, sẽ gửi lại khi kết nối ổn định.");
      } else {
        await reload();
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể lưu chỉnh sửa trên thiết bị.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editConflict) return;
    await submitEdit(editing?.revision ?? 0);
  }
  const visibleTasks = useMemo(() => {
    const current = new Map(tasks.map((task) => [task.id, task]));
    for (const item of pendingCreates) {
      if (!current.has(item.taskId)) current.set(item.taskId, queuedTask(item));
    }
    return overlayPendingChanges([...current.values()], pendingChanges);
  }, [tasks, pendingCreates, pendingChanges]);

  const shown = useMemo(() => {
    const matchText = (item: TaskItem) =>
      (
        item.title +
        " " +
        (item.description ?? "") +
        " " +
        item.tags.join(" ") +
        " " +
        (item.subtasks ?? []).map((subtask) => subtask.title).join(" ")
      )
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase());
    const filtered = visibleTasks.filter((item) => {
      if (!matchText(item)) return false;
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      if (filter === "completed") return item.status === "completed";
      if (filter === "inbox") return item.status !== "completed";
      if (filter === "upcoming")
        return item.status !== "completed" && !!item.dueDate && item.dueDate >= todayDate;
      return true;
    });
    return filtered.slice().sort((a, b) => {
      if (sort === "priority")
        return (
          priorityRank[a.priority] - priorityRank[b.priority] ||
          b.updatedAt.localeCompare(a.updatedAt)
        );
      if (sort === "due") {
        if (a.dueDate === b.dueDate) return b.updatedAt.localeCompare(a.updatedAt);
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id);
    });
  }, [visibleTasks, search, filter, priorityFilter, sort, todayDate]);
  const todayPlan = useMemo(() => {
    const open = shown.filter((item) => item.status !== "completed");
    const scheduled = open
      .filter(
        (item) =>
          item.scheduledStart && localDate(new Date(item.scheduledStart), zone) === dayAnchor,
      )
      .sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!));
    const scheduledIds = new Set(scheduled.map((item) => item.id));
    const overdue = open.filter(
      (item) => item.dueDate && item.dueDate < todayDate && !scheduledIds.has(item.id),
    );
    const overdueIds = new Set(overdue.map((item) => item.id));
    const rest = open.filter((item) => !scheduledIds.has(item.id) && !overdueIds.has(item.id));
    return { scheduled, overdue, rest };
  }, [shown, dayAnchor, todayDate, zone]);

  return (
    <section aria-label="Quản lý công việc">
      <form className="capture-form" onSubmit={create}>
        <label htmlFor="quick-task">Ghi nhanh công việc</label>
        <div className="capture-row">
          <input
            id="quick-task"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={240}
            placeholder="Ví dụ: Hoàn thành kế hoạch tuần"
            required
          />
          <button type="submit" disabled={busy || !title.trim()}>
            Thêm việc
          </button>
        </div>
      </form>
      <div className="task-toolbar">
        <label className="search-label" htmlFor="task-search">
          Tìm kiếm
          <input
            id="task-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tiêu đề, mô tả, thẻ..."
          />
        </label>
        <label className="search-label" htmlFor="task-filter">
          Trạng thái
          <select
            id="task-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">Tất cả</option>
            <option value="inbox">Chưa hoàn thành</option>
            <option value="upcoming">Sắp tới</option>
            <option value="completed">Đã hoàn thành</option>
          </select>
        </label>
        <label className="search-label" htmlFor="task-priority">
          Ưu tiên
          <select
            id="task-priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
          >
            <option value="all">Mọi mức</option>
            <option value="urgent">Khẩn cấp</option>
            <option value="high">Cao</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </select>
        </label>
        <label className="search-label" htmlFor="task-sort">
          Sắp xếp
          <select
            id="task-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="updated">Mới cập nhật</option>
            <option value="due">Hạn gần nhất</option>
            <option value="priority">Độ ưu tiên</option>
          </select>
        </label>
        <button
          type="button"
          className="task-action"
          disabled={busy || loading}
          onClick={() =>
            void (async () => {
              const accepted = await flushOutbox();
              if (accepted || cursorRef.current === null) await reload();
              else await pullChanges();
              setError("");
            })().catch((issue: unknown) =>
              setError(
                issue instanceof Error
                  ? issue.message
                  : "Chưa kết nối được. Các việc chờ đồng bộ vẫn được giữ trên máy.",
              ),
            )
          }
        >
          Đồng bộ ngay
        </button>
      </div>
      {error && (
        <p role="alert" className="task-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {pendingCreates.length > 0 && (
        <p role="status">
          {pendingCreates.length} việc đã lưu trên thiết bị đang chờ đồng bộ.
          {pendingCreates.some((item) => item.state === "conflict") &&
            " Có thao tác tạo việc xung đột; dữ liệu chưa bị xóa."}
        </p>
      )}
      {pendingCreates.some((item) => item.state === "conflict") && (
        <section className="message-card" aria-label="Xử lý tạo offline bị xung đột">
          <div>
            <h2>Việc tạo offline bị từ chối</h2>
            <p>Nội dung được giữ trên thiết bị. Chỉ bạn mới quyết định gửi lại hoặc bỏ.</p>
            <ul>
              {pendingCreates
                .filter((item) => item.state === "conflict")
                .map((item) => (
                  <li key={item.clientMutationId}>
                    <strong>{item.title}</strong>
                    {" · "}
                    {item.lastError ?? "xung đột"}
                    <div className="edit-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resolveCreateConflict(item, true)}
                      >
                        Gửi lại như việc mới
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resolveCreateConflict(item, false)}
                      >
                        Bỏ việc tạo bị từ chối
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      )}
      {pendingChanges.length > 0 && (
        <p role="status">{pendingChanges.length} chỉnh sửa hoặc xóa đang chờ đồng bộ.</p>
      )}
      {pendingChanges.some((item) => item.state === "conflict") && (
        <section className="message-card" aria-label="Xử lý xung đột offline">
          <div>
            <h2>Thay đổi offline cần xử lý</h2>
            <p>
              Bản trên máy chủ được giữ nguyên cho đến khi bạn quyết định. Các thay đổi này chưa bị
              xóa.
            </p>
            <ul>
              {pendingChanges
                .filter((item) => item.state === "conflict")
                .map((item) => (
                  <li key={item.clientMutationId}>
                    <strong>
                      {tasks.find((task) => task.id === item.taskId)?.title ??
                        "Công việc không còn trên máy chủ"}
                    </strong>
                    {" · "}
                    {item.type === "delete" ? "Yêu cầu xóa" : "Yêu cầu chỉnh sửa"}
                    {" · "}
                    {item.lastError ?? "xung đột"}
                    <div className="edit-actions">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void discardConflict(item)}
                      >
                        Giữ bản máy chủ, bỏ thay đổi offline
                      </button>
                      {item.lastError === "conflict" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void reapplyConflict(item)}
                        >
                          Áp dụng lại theo lựa chọn của tôi
                        </button>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      )}
      {loading ? (
        <p role="status">Đang tải công việc...</p>
      ) : page === "today" ? (
        <>
          <div className="task-toolbar">
            <h2>{dayHeading(dayAnchor)}</h2>
            <button
              type="button"
              className="task-action"
              onClick={() => setDayAnchor(addDays(dayAnchor, -1))}
            >
              Hôm trước
            </button>
            <button
              type="button"
              className="task-action"
              disabled={dayAnchor === todayDate}
              onClick={() => setDayAnchor(todayDate)}
            >
              Về hôm nay
            </button>
            <button
              type="button"
              className="task-action"
              onClick={() => setDayAnchor(addDays(dayAnchor, 1))}
            >
              Hôm sau
            </button>
          </div>
          <TodayBoard
            plan={todayPlan}
            showBacklog={dayAnchor === todayDate}
            zone={zone}
            busy={busy}
            onToggle={(task) =>
              void mutate("PATCH", "/api/tasks/" + task.id, {
                expectedRevision: task.revision,
                status: task.status === "completed" ? "inbox" : "completed",
              })
            }
            onEdit={startEdit}
            onDelete={(task) => {
              if (window.confirm("Xóa công việc này?"))
                void mutate("DELETE", "/api/tasks/" + task.id, { expectedRevision: task.revision });
            }}
          />
        </>
      ) : shown.length === 0 ? (
        <div className="message-card">
          <div>
            <h2>Chưa có công việc phù hợp</h2>
            <p>Em có thể ghi nhanh việc đầu tiên vào ô phía trên.</p>
          </div>
        </div>
      ) : (
        <TaskRows
          tasks={shown}
          zone={zone}
          busy={busy}
          onToggle={(task) =>
            void mutate("PATCH", "/api/tasks/" + task.id, {
              expectedRevision: task.revision,
              status: task.status === "completed" ? "inbox" : "completed",
            })
          }
          onEdit={startEdit}
          onDelete={(task) => {
            if (window.confirm("Xóa công việc này?"))
              void mutate("DELETE", "/api/tasks/" + task.id, { expectedRevision: task.revision });
          }}
        />
      )}
      {editing && (
        <form className="edit-panel" onSubmit={saveEdit} aria-label="Chỉnh sửa công việc">
          <h2>Chỉnh sửa công việc</h2>
          <label htmlFor="edit-title">Tiêu đề</label>
          <input
            id="edit-title"
            required
            maxLength={240}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <label htmlFor="edit-description">Mô tả</label>
          <textarea
            id="edit-description"
            maxLength={5000}
            rows={3}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <label htmlFor="edit-date">Hạn hoàn thành</label>
          <input
            id="edit-date"
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
          />
          <label htmlFor="edit-minutes">Thời lượng (phút)</label>
          <input
            id="edit-minutes"
            type="number"
            min={1}
            max={1440}
            value={editMinutes}
            placeholder="Để trống nếu chưa ước lượng"
            onChange={(e) => setEditMinutes(e.target.value)}
          />
          <label htmlFor="edit-tags">Thẻ</label>
          <input
            id="edit-tags"
            value={editTags}
            placeholder="việc nhà, tuần này"
            onChange={(e) => setEditTags(e.target.value)}
          />
          <label htmlFor="edit-start">Giờ bắt đầu đã xếp</label>
          <input
            id="edit-start"
            type="datetime-local"
            value={editStart}
            onChange={(e) => setEditStart(e.target.value)}
          />
          <label htmlFor="edit-end">Giờ kết thúc đã xếp</label>
          <input
            id="edit-end"
            type="datetime-local"
            value={editEnd}
            onChange={(e) => setEditEnd(e.target.value)}
          />
          <p className="subtitle">
            Hạn hoàn thành là deadline. Giờ đã xếp là khối làm việc. Để trống cả hai ô giờ để bỏ
            lịch.
          </p>
          <fieldset className="day-picks">
            <legend>Việc con</legend>
            {editSubtasks.map((subtask, index) => (
              <div key={subtask.id} className="place-form">
                <input
                  type="checkbox"
                  aria-label={"Xong việc con " + (index + 1)}
                  checked={subtask.completed}
                  onChange={(event) =>
                    setEditSubtasks((current) =>
                      current.map((item) =>
                        item.id === subtask.id
                          ? { ...item, completed: event.target.checked }
                          : item,
                      ),
                    )
                  }
                />
                <input
                  aria-label={"Tiêu đề việc con " + (index + 1)}
                  value={subtask.title}
                  maxLength={240}
                  onChange={(event) =>
                    setEditSubtasks((current) =>
                      current.map((item) =>
                        item.id === subtask.id ? { ...item, title: event.target.value } : item,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="task-action"
                  onClick={() =>
                    setEditSubtasks((current) => current.filter((item) => item.id !== subtask.id))
                  }
                >
                  Bỏ việc con
                </button>
              </div>
            ))}
            <button
              type="button"
              className="task-action"
              onClick={() =>
                setEditSubtasks((current) => [
                  ...current,
                  { id: crypto.randomUUID(), title: "", completed: false },
                ])
              }
            >
              Thêm việc con
            </button>
          </fieldset>
          <label htmlFor="edit-priority">Độ ưu tiên</label>
          <select
            id="edit-priority"
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value as TaskItem["priority"])}
          >
            <option value="low">Thấp</option>
            <option value="medium">Trung bình</option>
            <option value="high">Cao</option>
            <option value="urgent">Khẩn cấp</option>
          </select>
          {editConflict && (
            <div className="message-card conflict-review" role="alert">
              <div>
                <h3>Xung đột chỉnh sửa — cần lựa chọn</h3>
                <p>Thiết bị khác đã lưu phiên bản {editConflict.revision}.</p>
                <p>
                  <strong>Bản trên máy chủ:</strong> {editConflict.title}
                </p>
                <p>
                  {editConflict.description ?? "Không có mô tả"} · Hạn{" "}
                  {editConflict.dueDate ?? "chưa đặt"} · Ưu tiên {editConflict.priority}
                </p>
                <p>Bản của bạn vẫn ở biểu mẫu phía trên và chưa được ghi đè lên máy chủ.</p>
                <div className="edit-actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void keepServerEditConflict()}
                  >
                    Giữ bản trên máy chủ
                  </button>
                  <button
                    type="button"
                    disabled={busy || !editTitle.trim()}
                    onClick={() => void submitEdit(editConflict.revision)}
                  >
                    Ghi đè bằng bản của tôi
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="edit-actions">
            <button type="submit" disabled={busy || !editTitle.trim() || !!editConflict}>
              Lưu thay đổi
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setEditConflict(null);
              }}
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function TaskRows({
  tasks,
  zone,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  tasks: TaskItem[];
  zone: string;
  busy: boolean;
  onToggle: (task: TaskItem) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
}) {
  if (tasks.length === 0) return <p className="subtitle">Không có việc trong mục này.</p>;
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <li key={task.id} className="task-item">
          <button
            type="button"
            aria-label={
              task.status === "completed" ? "Mở lại " + task.title : "Hoàn thành " + task.title
            }
            className={"completion " + (task.status === "completed" ? "done" : "")}
            disabled={busy || task.revision === 0}
            onClick={() => onToggle(task)}
          >
            {task.status === "completed" ? "✓" : "○"}
          </button>
          <div className="task-details">
            <strong className={task.status === "completed" ? "completed-text" : ""}>
              {task.title}
            </strong>
            <span>
              {task.revision === 0 ? "Đang chờ đồng bộ · " : ""}
              {task.dueDate ? "Hạn " + task.dueDate : "Chưa có hạn"}
              {task.estimatedMinutes ? " · " + task.estimatedMinutes + " phút" : ""}
              {formatSchedule(task, zone)}
              {task.tags.length > 0 ? " · " + task.tags.join(", ") : ""}
              {(task.subtasks?.length ?? 0) > 0
                ? " · " +
                  task.subtasks!.filter((subtask) => subtask.completed).length +
                  "/" +
                  task.subtasks!.length +
                  " việc con"
                : ""}{" "}
              · {task.priority}
            </span>
          </div>
          <button
            type="button"
            className="task-action"
            disabled={busy || task.revision === 0}
            onClick={() => onEdit(task)}
          >
            Sửa
          </button>
          <button
            type="button"
            className="task-action danger"
            disabled={busy || task.revision === 0}
            onClick={() => onDelete(task)}
          >
            Xóa
          </button>
        </li>
      ))}
    </ul>
  );
}

function TodayBoard({
  plan,
  showBacklog,
  zone,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  plan: { scheduled: TaskItem[]; overdue: TaskItem[]; rest: TaskItem[] };
  showBacklog: boolean;
  zone: string;
  busy: boolean;
  onToggle: (task: TaskItem) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
}) {
  const backlog = showBacklog ? plan.overdue.length + plan.rest.length : 0;
  if (plan.scheduled.length + backlog === 0) {
    return (
      <div className="message-card">
        <div>
          <h2>{showBacklog ? "Hôm nay đang trống" : "Ngày này chưa có việc đã xếp"}</h2>
          <p>Ghi nhanh một việc, hoặc mở Lịch để xếp giờ.</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <h2>Đã xếp trong ngày</h2>
      <TaskRows
        tasks={plan.scheduled}
        zone={zone}
        busy={busy}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      {showBacklog && (
        <>
          <h2>Quá hạn</h2>
          <TaskRows
            tasks={plan.overdue}
            zone={zone}
            busy={busy}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          <h2>Chưa xếp</h2>
          <TaskRows
            tasks={plan.rest}
            zone={zone}
            busy={busy}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </>
      )}
    </>
  );
}
