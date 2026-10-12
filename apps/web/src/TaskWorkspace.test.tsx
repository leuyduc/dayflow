// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskWorkspace, type TaskItem } from "./TaskWorkspace";

function fakeServer() {
  let tasks: TaskItem[] = [];
  let mutationNumber = 0;
  let remoteNumber = 0;
  let cursor = 0;
  let cursorAheadOnce = false;
  const changes: Array<{
    cursor: number;
    entityId: string;
    operation: "create" | "update" | "delete";
    payload: TaskItem | { id: string; revision: number; deletedAt: string };
  }> = [];
  function record(operation: "create" | "update" | "delete", task: TaskItem) {
    changes.push({
      cursor: ++cursor,
      entityId: task.id,
      operation,
      payload:
        operation === "delete"
          ? { id: task.id, revision: task.revision, deletedAt: new Date().toISOString() }
          : { ...task },
    });
  }
  vi.stubGlobal("crypto", {
    randomUUID: () => "00000000-0000-4000-8000-" + String(++mutationNumber).padStart(12, "0"),
  });
  const calls: Array<{ method: string; path: string }> = [];
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, path });
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    let response: unknown;
    if (method === "GET" && path === "/api/sync/bootstrap") {
      response = { tasks: tasks.slice(), cursor };
    }
    if (method === "GET" && path.startsWith("/api/sync/pull?")) {
      if (cursorAheadOnce) {
        cursorAheadOnce = false;
        return { ok: false, status: 409, json: async () => ({ error: "cursor-ahead" }) };
      }
      const after = Number(new URL(path, "http://local.test").searchParams.get("cursor"));
      const batch = changes.filter((change) => change.cursor > after).slice(0, 100);
      response = {
        changes: batch,
        nextCursor: batch.at(-1)?.cursor ?? after,
        latestCursor: cursor,
        hasMore: changes.filter((change) => change.cursor > after).length > batch.length,
      };
    }
    if (method === "POST" && path === "/api/tasks") {
      const item: TaskItem = {
        id: "11111111-1111-4111-8111-111111111111",
        title: String(body.title),
        description: null,
        status: "inbox",
        priority: "medium",
        dueDate: null,
        tags: [],
        estimatedMinutes: null,
        revision: 1,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tasks = [...tasks, item];
      record("create", item);
      response = { task: item };
    }
    if (method === "POST" && path === "/api/sync/push") {
      const operations = body.operations as Array<{
        clientMutationId: string;
        taskId: string;
        expectedRevision: number;
        patch: Partial<TaskItem>;
      }>;
      const operation = operations[0]!;
      const current = tasks.find((task) => task.id === operation.taskId);
      if (!current) {
        response = { results: [{ kind: "not-found" }] };
      } else if (current.revision !== operation.expectedRevision) {
        response = { results: [{ kind: "conflict", current: { ...current } }] };
      } else {
        const updated: TaskItem = {
          ...current,
          ...operation.patch,
          revision: current.revision + 1,
        };
        tasks = tasks.map((task) => (task.id === updated.id ? updated : task));
        record("update", updated);
        response = { results: [{ kind: "ok", task: updated, revision: updated.revision }] };
      }
    }
    if (method === "PATCH") {
      tasks = tasks.map((task) => ({
        ...task,
        ...body,
        revision: task.revision + 1,
        completedAt:
          body.status === "completed"
            ? new Date().toISOString()
            : body.status === "inbox"
              ? null
              : task.completedAt,
      }));
      if (tasks[0]) record("update", tasks[0]);
      response = { task: tasks[0] };
    }
    if (method === "DELETE") {
      if (tasks[0]) record("delete", { ...tasks[0], revision: tasks[0].revision + 1 });
      tasks = [];
      response = { deleted: true };
    }
    return { ok: true, status: 200, json: async () => response };
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    fetchMock,
    simulateCursorAheadOnce() {
      cursorAheadOnce = true;
    },
    updateRemoteTask(title: string) {
      tasks = tasks.map((task) => {
        const updated = { ...task, title, revision: task.revision + 1 };
        record("update", updated);
        return updated;
      });
    },
    addRemoteTask(title: string) {
      const timestamp = new Date().toISOString();
      const task: TaskItem = {
        id: "22222222-2222-4222-8222-" + String(++remoteNumber).padStart(12, "0"),
        title,
        description: null,
        status: "inbox",
        priority: "medium",
        dueDate: null,
        tags: [],
        estimatedMinutes: null,
        revision: 1,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tasks.push(task);
      record("create", task);
    },
    deleteRemoteTask(title: string) {
      const task = tasks.find((item) => item.title === title);
      if (!task) throw new Error("Missing fake remote task");
      record("delete", { ...task, revision: task.revision + 1 });
      tasks = tasks.filter((item) => item.id !== task.id);
    },
  };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("task workspace connected UI", () => {
  it("creates, edits, completes, reopens and deletes through authenticated API", async () => {
    const { calls, fetchMock } = fakeServer();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TaskWorkspace csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Viết báo cáo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await screen.findByText("Viết báo cáo");
    expect(calls.some(({ method, path }) => method === "POST" && path === "/api/tasks")).toBe(true);
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1];
    expect((postCall?.headers as Record<string, string>)["X-Dayflow-CSRF"]).toBe("test-only-csrf");

    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Báo cáo hoàn chỉnh" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText("Báo cáo hoàn chỉnh");
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành Báo cáo hoàn chỉnh" }));
    await screen.findByRole("button", { name: "Mở lại Báo cáo hoàn chỉnh" });
    fireEvent.click(screen.getByRole("button", { name: "Mở lại Báo cáo hoàn chỉnh" }));
    await screen.findByRole("button", { name: "Hoàn thành Báo cáo hoàn chỉnh" });
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await screen.findByText("Chưa có công việc phù hợp");
    expect(calls.some((call) => call.method === "DELETE")).toBe(true);
  });

  it("keeps local draft on conflict and only overwrites after explicit confirmation", async () => {
    const server = fakeServer();
    render(<TaskWorkspace csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Bản đầu tiên" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await screen.findByText("Bản đầu tiên");
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Bản của tôi" } });
    server.updateRemoteTask("Thiết bị B đã sửa");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText("Xung đột chỉnh sửa — cần lựa chọn");
    expect(screen.getByLabelText("Tiêu đề")).toHaveProperty("value", "Bản của tôi");
    expect(screen.getAllByText("Thiết bị B đã sửa").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Lưu thay đổi" }).hasAttribute("disabled")).toBe(
      true,
    );

    const pushed = server.fetchMock.mock.calls.filter(([path]) => path === "/api/sync/push");
    expect(pushed).toHaveLength(1);
    const first = JSON.parse(pushed[0]![1]!.body as string).operations[0];
    expect(first.expectedRevision).toBe(1);
    expect((pushed[0]![1]!.headers as Record<string, string>)["X-Dayflow-CSRF"]).toBe(
      "test-only-csrf",
    );

    fireEvent.click(screen.getByRole("button", { name: "Ghi đè bằng bản của tôi" }));
    await screen.findByText("Bản của tôi");
    const retried = server.fetchMock.mock.calls.filter(([path]) => path === "/api/sync/push");
    expect(retried).toHaveLength(2);
    const second = JSON.parse(retried[1]![1]!.body as string).operations[0];
    expect(second.expectedRevision).toBe(2);
    expect(second.clientMutationId).not.toBe(first.clientMutationId);
    expect(screen.queryByText("Xung đột chỉnh sửa — cần lựa chọn")).toBeNull();
  });

  it("can keep the newer server version without applying stale local edits", async () => {
    const server = fakeServer();
    render(<TaskWorkspace csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Công việc gốc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await screen.findByText("Công việc gốc");
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Bản chưa lưu" } });
    server.updateRemoteTask("Bản mới trên server");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText("Xung đột chỉnh sửa — cần lựa chọn");
    fireEvent.click(screen.getByRole("button", { name: "Giữ bản trên máy chủ" }));
    expect(screen.queryByRole("form", { name: "Chỉnh sửa công việc" })).toBeNull();
    await screen.findByText("Bản mới trên server");
    expect(server.calls.filter((call) => call.path === "/api/sync/push")).toHaveLength(1);
  });

  it("refreshes online task changes from another device on focus and manual sync", async () => {
    const server = fakeServer();
    render(<TaskWorkspace csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    server.addRemoteTask("Thay đổi từ thiết bị B");
    fireEvent(window, new Event("focus"));
    await screen.findByText("Thay đổi từ thiết bị B");
    expect(
      server.calls.filter((call) => call.path.startsWith("/api/sync/pull?")).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ ngay" }));
    await screen.findByText("Thay đổi từ thiết bị B");
  });
  it("bootstraps owner tasks and applies paginated online changes and tombstones", async () => {
    const server = fakeServer();
    server.addRemoteTask("Có từ trước");
    render(<TaskWorkspace csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Có từ trước");
    expect(server.calls.some((call) => call.path === "/api/sync/bootstrap")).toBe(true);
    expect(server.calls.some((call) => call.path === "/api/tasks" && call.method === "GET")).toBe(
      false,
    );

    for (let i = 1; i <= 105; i++) server.addRemoteTask("Việc mới từ máy B " + i);
    fireEvent(window, new Event("focus"));
    await screen.findByText("Việc mới từ máy B 105");
    expect(
      server.calls.filter((call) => call.path.startsWith("/api/sync/pull?")).length,
    ).toBeGreaterThanOrEqual(2);
    server.deleteRemoteTask("Việc mới từ máy B 105");
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ ngay" }));
    await waitFor(() => expect(screen.queryByText("Việc mới từ máy B 105")).toBeNull());
    expect(screen.getByText("Có từ trước")).toBeTruthy();
  });

  it("rebuilds a safe snapshot if the server rejects a stale or future cursor", async () => {
    const server = fakeServer();
    server.addRemoteTask("Trước khi lệch cursor");
    render(<TaskWorkspace csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Trước khi lệch cursor");
    server.addRemoteTask("Sau khi lệch cursor");
    server.simulateCursorAheadOnce();
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ ngay" }));
    await screen.findByText("Sau khi lệch cursor");
    expect(server.calls.filter((call) => call.path === "/api/sync/bootstrap")).toHaveLength(2);
  });

  it("shows filtered search results without exposing placeholder tasks", async () => {
    fakeServer();
    render(<TaskWorkspace csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Đọc sách" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await screen.findByText("Đọc sách");
    fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "không tồn tại" } });
    await screen.findByText("Chưa có công việc phù hợp");
  });
});
