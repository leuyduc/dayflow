// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestOfflineData, getPendingChanges } from "./offline-store";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskWorkspace, type TaskItem } from "./TaskWorkspace";

function fakeServer() {
  let tasks: TaskItem[] = [];
  let mutationNumber = 0;
  let remoteNumber = 0;
  let cursor = 0;
  let cursorAheadOnce = false;
  let patchConflictOnce = false;
  let loseAcceptedStatusResponseOnce = false;
  let loseAcceptedEditResponseOnce = false;
  const acceptedMutations = new Map<string, unknown>();
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
        type: "create" | "update" | "delete";
        taskId: string;
        input?: { title: string };
        expectedRevision?: number;
        patch?: Partial<TaskItem>;
      }>;
      const operation = operations[0]!;
      const replay = acceptedMutations.get(operation.clientMutationId);
      if (replay) return { ok: true, status: 200, json: async () => ({ results: [replay] }) };
      const current = tasks.find((task) => task.id === operation.taskId);
      const echo = {
        clientMutationId: operation.clientMutationId,
        taskId: operation.taskId,
      };
      if (operation.type === "create") {
        const created: TaskItem = current ?? {
          id: operation.taskId,
          title: operation.input!.title,
          description: null,
          status: "inbox",
          priority: "medium",
          dueDate: null,
          estimatedMinutes: null,
          tags: [],
          subtasks: [],
          scheduledStart: null,
          scheduledEnd: null,
          revision: 1,
          completedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (!current) {
          tasks = [...tasks, created];
          record("create", created);
        }
        response = { results: [{ ...echo, kind: "ok", task: created }] };
      } else if (!current) {
        response = { results: [{ ...echo, kind: "not-found" }] };
      } else if (patchConflictOnce && operation.type === "update" && operation.patch?.status) {
        patchConflictOnce = false;
        response = { results: [{ ...echo, kind: "conflict", current: { ...current } }] };
      } else if (current.revision !== operation.expectedRevision) {
        response = { results: [{ ...echo, kind: "conflict", current: { ...current } }] };
      } else if (operation.type === "delete") {
        record("delete", { ...current, revision: current.revision + 1 });
        tasks = tasks.filter((task) => task.id !== operation.taskId);
        response = { results: [{ ...echo, kind: "ok", task: null }] };
      } else {
        const updated: TaskItem = {
          ...current,
          ...operation.patch,
          revision: current.revision + 1,
          completedAt:
            operation.patch?.status === "completed"
              ? new Date().toISOString()
              : operation.patch?.status === "inbox"
                ? null
                : current.completedAt,
        };
        tasks = tasks.map((task) => (task.id === updated.id ? updated : task));
        record("update", updated);
        response = {
          results: [{ ...echo, kind: "ok", task: updated, revision: updated.revision }],
        };
      }
      const accepted = (response as { results: Array<{ kind: string }> }).results[0];
      if (accepted?.kind === "ok") acceptedMutations.set(operation.clientMutationId, accepted);
      if (
        loseAcceptedStatusResponseOnce &&
        operation.type === "update" &&
        operation.patch?.status === "completed"
      ) {
        loseAcceptedStatusResponseOnce = false;
        throw new TypeError("Network response lost after server committed status");
      }
      if (
        loseAcceptedEditResponseOnce &&
        operation.type === "update" &&
        operation.patch?.title === "Bản sửa đã được máy chủ nhận"
      ) {
        loseAcceptedEditResponseOnce = false;
        throw new TypeError("Network response lost after server committed edit");
      }
    }
    if (method === "PATCH" && patchConflictOnce) {
      patchConflictOnce = false;
      return { ok: false, status: 409, json: async () => ({ error: "revision-conflict" }) };
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
    simulateStatusConflictOnce() {
      patchConflictOnce = true;
    },
    simulateLostAcceptedStatusResponseOnce() {
      loseAcceptedStatusResponseOnce = true;
    },
    simulateLostAcceptedEditResponseOnce() {
      loseAcceptedEditResponseOnce = true;
    },
    getSavedTasks() {
      return tasks.slice();
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
beforeEach(async () => {
  await clearTestOfflineData();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function waitReadyCreate(title: string) {
  await screen.findByText(title);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sửa" }).hasAttribute("disabled")).toBe(false),
  );
}

describe("task workspace connected UI", () => {
  it("creates, edits, completes, reopens and deletes through authenticated API", async () => {
    const { calls, fetchMock } = fakeServer();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Viết báo cáo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await waitReadyCreate("Viết báo cáo");
    expect(calls.some(({ method, path }) => method === "POST" && path === "/api/sync/push")).toBe(
      true,
    );
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1];
    expect((postCall?.headers as Record<string, string>)["X-Dayflow-CSRF"]).toBe("test-only-csrf");

    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Báo cáo hoàn chỉnh" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText("Báo cáo hoàn chỉnh");
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Hoàn thành Báo cáo hoàn chỉnh" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành Báo cáo hoàn chỉnh" }));
    await screen.findByRole("button", { name: "Mở lại Báo cáo hoàn chỉnh" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Mở lại Báo cáo hoàn chỉnh" }).hasAttribute("disabled"),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mở lại Báo cáo hoàn chỉnh" }));
    await screen.findByRole("button", { name: "Hoàn thành Báo cáo hoàn chỉnh" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Xóa" }).hasAttribute("disabled")).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await screen.findByText("Chưa có công việc phù hợp");
    const syncDeletes = fetchMock.mock.calls.filter(
      ([path, init]) =>
        path === "/api/sync/push" && JSON.parse(String(init?.body)).operations[0].type === "delete",
    );
    expect(syncDeletes).toHaveLength(1);
    expect(calls.some((call) => call.method === "PATCH" || call.method === "DELETE")).toBe(false);
  });

  it("keeps local draft on conflict and only overwrites after explicit confirmation", async () => {
    const server = fakeServer();
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Bản đầu tiên" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await waitReadyCreate("Bản đầu tiên");
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
    expect(pushed).toHaveLength(2); // create then conflicting edit
    const first = JSON.parse(pushed[1]![1]!.body as string).operations[0];
    expect(first.expectedRevision).toBe(1);
    expect((pushed[0]![1]!.headers as Record<string, string>)["X-Dayflow-CSRF"]).toBe(
      "test-only-csrf",
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Ghi đè bằng bản của tôi" }).hasAttribute("disabled"),
      ).toBe(false),
    );
    fireEvent.change(screen.getByLabelText("Tiêu đề"), {
      target: { value: "Bản cuối sau khi xem xung đột" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ghi đè bằng bản của tôi" }));
    await screen.findByText("Bản cuối sau khi xem xung đột");
    const retried = server.fetchMock.mock.calls.filter(([path]) => path === "/api/sync/push");
    expect(retried).toHaveLength(3);
    const second = JSON.parse(retried[2]![1]!.body as string).operations[0];
    expect(second.expectedRevision).toBe(2);
    expect(second.clientMutationId).not.toBe(first.clientMutationId);
    expect(second.patch.title).toBe("Bản cuối sau khi xem xung đột");
    await waitFor(() => expect(screen.queryByText("Xung đột chỉnh sửa — cần lựa chọn")).toBeNull());
  });

  it("can keep the newer server version without applying stale local edits", async () => {
    const server = fakeServer();
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Công việc gốc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await waitReadyCreate("Công việc gốc");
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề"), { target: { value: "Bản chưa lưu" } });
    server.updateRemoteTask("Bản mới trên server");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText("Xung đột chỉnh sửa — cần lựa chọn");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Giữ bản trên máy chủ" }).hasAttribute("disabled"),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Giữ bản trên máy chủ" }));
    expect(screen.queryByRole("form", { name: "Chỉnh sửa công việc" })).toBeNull();
    await screen.findByText("Bản mới trên server");
    await waitFor(async () => expect(await getPendingChanges("test-owner-id")).toEqual([]));
    expect(server.calls.filter((call) => call.path === "/api/sync/push")).toHaveLength(2);
  });

  it("reports a revision conflict on complete without silently overwriting the server", async () => {
    const server = fakeServer();
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Việc chờ hoàn thành" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await waitReadyCreate("Việc chờ hoàn thành");
    server.simulateStatusConflictOnce();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành Việc chờ hoàn thành" }));
    await screen.findByRole("heading", { name: "Thay đổi offline cần xử lý" });
    expect(screen.getByText(/thao tác bị xung đột/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hoàn thành Việc chờ hoàn thành" })).toBeTruthy();
    const pushUpdates = server.fetchMock.mock.calls.filter(
      ([path, init]) =>
        path === "/api/sync/push" &&
        JSON.parse(String(init?.body)).operations[0].type === "update" &&
        JSON.parse(String(init?.body)).operations[0].patch?.status === "completed",
    );
    expect(pushUpdates).toHaveLength(1);
    expect(server.calls.filter((call) => call.method === "PATCH")).toHaveLength(0);
  });

  it("refreshes online task changes from another device on focus and manual sync", async () => {
    const server = fakeServer();
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
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
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
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
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Trước khi lệch cursor");
    server.addRemoteTask("Sau khi lệch cursor");
    server.simulateCursorAheadOnce();
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ ngay" }));
    await screen.findByText("Sau khi lệch cursor");
    expect(server.calls.filter((call) => call.path === "/api/sync/bootstrap")).toHaveLength(2);
  });

  it("saves subtasks from the edit form", async () => {
    const server = fakeServer();
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Chuẩn bị họp" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await waitReadyCreate("Chuẩn bị họp");
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc con" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề việc con 1"), {
      target: { value: "Soạn dàn ý" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText(/0\/1 việc con/);
    const pushed = server.fetchMock.mock.calls.filter(([path]) => path === "/api/sync/push");
    const patch = JSON.parse(pushed[1]![1]!.body as string).operations[0].patch;
    expect(patch.subtasks).toEqual([
      expect.objectContaining({ title: "Soạn dàn ý", completed: false }),
    ]);
  });

  it("shows filtered search results without exposing placeholder tasks", async () => {
    fakeServer();
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Đọc sách" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await waitReadyCreate("Đọc sách");
    fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "không tồn tại" } });
    await screen.findByText("Chưa có công việc phù hợp");
  });
});

describe("G7 durable quick actions even while online", () => {
  it("recovers a lost successful complete response with the SAME mutation ID, never double-commits", async () => {
    const server = fakeServer();
    render(<TaskWorkspace ownerId="test-owner-id" csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Giữ trạng thái qua lỗi mạng" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await waitReadyCreate("Giữ trạng thái qua lỗi mạng");

    server.simulateLostAcceptedStatusResponseOnce();
    fireEvent.click(screen.getByRole("button", { name: "Hoàn thành Giữ trạng thái qua lỗi mạng" }));
    await screen.findByText(/Network response lost after server committed status/);
    expect(server.getSavedTasks()).toHaveLength(1);
    expect(server.getSavedTasks()[0]).toMatchObject({ status: "completed", revision: 2 });

    const allUpdates = () =>
      server.fetchMock.mock.calls
        .filter(([path, init]) => path === "/api/sync/push" && init?.method === "POST")
        .map(([, init]) => JSON.parse(String(init?.body)).operations[0])
        .filter(
          (operation) => operation.type === "update" && operation.patch?.status === "completed",
        );
    expect(allUpdates()).toHaveLength(1);
    const first = allUpdates()[0];

    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(allUpdates()).toHaveLength(2));
    expect(allUpdates()[1]).toEqual(first);
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Mở lại Giữ trạng thái qua lỗi mạng" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(server.getSavedTasks()).toHaveLength(1);
    expect(server.getSavedTasks()[0]).toMatchObject({ status: "completed", revision: 2 });
    expect(server.calls.some((call) => call.method === "PATCH")).toBe(false);
  });
});

describe("G7 durable form edit while online", () => {
  it("keeps a committed edit through a lost HTTP response and retries with the same mutation", async () => {
    const server = fakeServer();
    const owner = "test-owner-id";
    render(<TaskWorkspace ownerId={owner} csrfToken="test-only-csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), {
      target: { value: "Bản ban đầu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
    await waitReadyCreate("Bản ban đầu");
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Tiêu đề"), {
      target: { value: "Bản sửa đã được máy chủ nhận" },
    });
    server.simulateLostAcceptedEditResponseOnce();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await screen.findByText(/Network response lost after server committed edit/);
    expect(server.getSavedTasks()[0]).toMatchObject({
      title: "Bản sửa đã được máy chủ nhận",
      revision: 2,
    });
    const editPushes = () =>
      server.fetchMock.mock.calls
        .filter(([path, init]) => path === "/api/sync/push" && init?.method === "POST")
        .map(([, init]) => JSON.parse(String(init?.body)).operations[0])
        .filter(
          (operation) =>
            operation.type === "update" &&
            operation.patch?.title === "Bản sửa đã được máy chủ nhận",
        );
    expect(editPushes()).toHaveLength(1);
    const first = editPushes()[0];
    expect(await getPendingChanges(owner)).toEqual([
      expect.objectContaining({
        clientMutationId: first.clientMutationId,
        type: "update",
        state: "pending",
      }),
    ]);

    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(editPushes()).toHaveLength(2));
    expect(editPushes()[1]).toEqual(first);
    await waitFor(async () => expect(await getPendingChanges(owner)).toEqual([]));
    expect(server.getSavedTasks()[0]).toMatchObject({
      title: "Bản sửa đã được máy chủ nhận",
      revision: 2,
    });
  });
});
