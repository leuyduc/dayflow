// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskWorkspace, type TaskItem } from "./TaskWorkspace";

function fakeServer() {
  let tasks: TaskItem[] = [];
  let mutationNumber = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => "00000000-0000-4000-8000-" + String(++mutationNumber).padStart(12, "0"),
  });
  const calls: Array<{ method: string; path: string }> = [];
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, path });
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    let response: unknown;
    if (method === "GET") response = { tasks: tasks.slice() };
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
      response = { task: tasks[0] };
    }
    if (method === "DELETE") {
      tasks = [];
      response = { deleted: true };
    }
    return { ok: true, status: 200, json: async () => response };
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    fetchMock,
    updateRemoteTask(title: string) {
      tasks = tasks.map((task) => ({ ...task, title, revision: task.revision + 1 }));
    },
    addRemoteTask(title: string) {
      const timestamp = new Date().toISOString();
      tasks.push({
        id: "22222222-2222-4222-8222-222222222222",
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
      });
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
      server.calls.filter((call) => call.path === "/api/tasks" && call.method === "GET").length,
    ).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: "Đồng bộ ngay" }));
    await screen.findByText("Thay đổi từ thiết bị B");
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
