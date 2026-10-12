import { useEffect, useMemo, useState, type FormEvent } from "react";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: "inbox" | "scheduled" | "completed";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  estimatedMinutes: number | null;
  tags: string[];
  revision: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
export type Page = "today" | "inbox" | "calendar" | "settings";

type SyncEditResult =
  | { kind: "ok"; task: TaskItem | null }
  | { kind: "conflict"; current: TaskItem | null }
  | { kind: "not-found" }
  | { kind: "idempotency-key-reused" };

type SyncPushResponse = { results: SyncEditResult[] };

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 409) throw new Error("Dữ liệu đã được thay đổi. Đã tải lại danh sách.");
    if (response.status === 401) throw new Error("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");
    throw new Error("Không thể lưu dữ liệu. Vui lòng thử lại.");
  }
  return (await response.json()) as T;
}

export function TaskWorkspace({ csrfToken, page }: { csrfToken: string; page: Page }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "inbox" | "completed">("all");
  const [editing, setEditing] = useState<TaskItem | null>(null);
  const [editConflict, setEditConflict] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<TaskItem["priority"]>("medium");

  async function reload() {
    const response = await fetch("/api/tasks", { credentials: "same-origin", cache: "no-store" });
    const result = await responseJson<{ tasks: TaskItem[] }>(response);
    setTasks(result.tasks);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/tasks", { credentials: "same-origin", cache: "no-store" })
      .then(responseJson<{ tasks: TaskItem[] }>)
      .then((result) => {
        if (active) {
          setTasks(result.tasks);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Không tải được danh sách. Hãy kiểm tra kết nối.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // G5 online-only convergence: refresh server-authoritative state on focus,
  // reconnect and a light interval. This does NOT claim a durable offline outbox.
  useEffect(() => {
    let active = true;
    async function syncVisible() {
      if (!active || document.visibilityState === "hidden" || !navigator.onLine) return;
      try {
        const response = await fetch("/api/tasks", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const result = await responseJson<{ tasks: TaskItem[] }>(response);
        if (active) setTasks(result.tasks);
      } catch {
        // Keep last visible data; a failed refresh must not destroy local UI state.
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

  async function mutate(method: "POST" | "PATCH" | "DELETE", endpoint: string, payload: object) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await responseJson(
        await fetch(endpoint, {
          method,
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", "X-Dayflow-CSRF": csrfToken },
          body: JSON.stringify(payload),
        }),
      );
      await reload();
      return true;
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Đã xảy ra lỗi.");
      await reload().catch(() => {});
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const ok = await mutate("POST", "/api/tasks", { title: trimmed });
    if (ok) setTitle("");
  }

  function startEdit(item: TaskItem) {
    setEditing(item);
    setEditConflict(null);
    setEditTitle(item.title);
    setEditDescription(item.description ?? "");
    setEditDueDate(item.dueDate ?? "");
    setEditPriority(item.priority);
  }
  async function submitEdit(expectedRevision: number) {
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/sync/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Dayflow-CSRF": csrfToken },
        body: JSON.stringify({
          operations: [
            {
              clientMutationId: crypto.randomUUID(),
              type: "update",
              taskId: editing.id,
              expectedRevision,
              patch: {
                title: editTitle.trim(),
                description: editDescription.trim() || null,
                dueDate: editDueDate || null,
                priority: editPriority,
              },
            },
          ],
        }),
      });
      const result = (await responseJson<SyncPushResponse>(response)).results[0];
      if (!result) throw new Error("Không nhận được kết quả đồng bộ.");
      if (result.kind === "conflict" && result.current) {
        setEditConflict(result.current);
        setError("Công việc đã được sửa trên thiết bị khác. Hãy so sánh hai phiên bản.");
        await reload();
        return;
      }
      if (result.kind === "not-found" || result.kind === "conflict") {
        setEditConflict(null);
        setError(
          "Công việc không còn tồn tại trên máy chủ. Nội dung bạn đang sửa vẫn được giữ trong biểu mẫu.",
        );
        await reload();
        return;
      }
      if (result.kind !== "ok") throw new Error("Yêu cầu chỉnh sửa không hợp lệ. Hãy thử lại.");
      setEditing(null);
      setEditConflict(null);
      await reload();
    } catch (issue) {
      // Do not silently discard the user's draft or auto-retry an ambiguous write.
      setError(issue instanceof Error ? issue.message : "Không thể đồng bộ chỉnh sửa.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editConflict) return;
    await submitEdit(editing?.revision ?? 0);
  }
  const shown = useMemo(
    () =>
      tasks.filter((item) => {
        const matchText = (item.title + " " + (item.description ?? ""))
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase());
        const matchFilter =
          filter === "all" ||
          (filter === "completed" ? item.status === "completed" : item.status !== "completed");
        const matchPage = page !== "today" || item.status !== "completed";
        return matchText && matchFilter && matchPage;
      }),
    [tasks, search, filter, page],
  );

  if (page === "calendar" || page === "settings") {
    return (
      <div className="message-card">
        <div>
          <h2>{page === "calendar" ? "Lịch đang được phát triển" : "Cài đặt sẽ có sau"}</h2>
          <p>
            {page === "calendar"
              ? "G6 sẽ bổ sung lịch ngày, tuần và tháng."
              : "Phần cài đặt tài khoản và lập kế hoạch sẽ được triển khai sau."}
          </p>
        </div>
      </div>
    );
  }

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
            placeholder="Tiêu đề, mô tả..."
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
            <option value="completed">Đã hoàn thành</option>
          </select>
        </label>
        <button
          type="button"
          className="task-action"
          disabled={busy || loading}
          onClick={() =>
            void reload()
              .then(() => setError(""))
              .catch(() =>
                setError("Không thể tải thay đổi từ thiết bị khác. Thử lại khi có mạng."),
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
      {loading ? (
        <p role="status">Đang tải công việc...</p>
      ) : shown.length === 0 ? (
        <div className="message-card">
          <div>
            <h2>Chưa có công việc phù hợp</h2>
            <p>Em có thể ghi nhanh việc đầu tiên vào ô phía trên.</p>
          </div>
        </div>
      ) : (
        <ul className="task-list">
          {shown.map((task) => (
            <li key={task.id} className="task-item">
              <button
                type="button"
                aria-label={
                  task.status === "completed" ? "Mở lại " + task.title : "Hoàn thành " + task.title
                }
                className={"completion " + (task.status === "completed" ? "done" : "")}
                disabled={busy}
                onClick={() =>
                  void mutate("PATCH", "/api/tasks/" + task.id, {
                    expectedRevision: task.revision,
                    status: task.status === "completed" ? "inbox" : "completed",
                  })
                }
              >
                {task.status === "completed" ? "✓" : "○"}
              </button>
              <div className="task-details">
                <strong className={task.status === "completed" ? "completed-text" : ""}>
                  {task.title}
                </strong>
                <span>
                  {task.dueDate ? "Hạn " + task.dueDate : "Chưa có hạn"} · {task.priority} · phiên
                  bản {task.revision}
                </span>
              </div>
              <button
                type="button"
                className="task-action"
                disabled={busy}
                onClick={() => startEdit(task)}
              >
                Sửa
              </button>
              <button
                type="button"
                className="task-action danger"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Xóa công việc này?"))
                    void mutate("DELETE", "/api/tasks/" + task.id, {
                      expectedRevision: task.revision,
                    });
                }}
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
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
                    onClick={() => {
                      setEditing(null);
                      setEditConflict(null);
                      setError("");
                    }}
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
