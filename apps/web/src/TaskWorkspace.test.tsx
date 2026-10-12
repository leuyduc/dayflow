// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskWorkspace, type TaskItem } from "./TaskWorkspace";

function fakeServer() {
  let tasks: TaskItem[] = [];
  const calls: Array<{ method: string; path: string }> = [];
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, path });
    const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
    let response: unknown;
    if (method === "GET") response = { tasks: tasks.slice() };
    if (method === "POST") {
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
