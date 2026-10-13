// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CalendarPanel } from "./CalendarPanel";
import type { TaskItem } from "./TaskWorkspace";

function task(id: string, title: string, revision = 1): TaskItem {
  return {
    id,
    title,
    description: null,
    status: "inbox",
    priority: "medium",
    dueDate: null,
    estimatedMinutes: 30,
    scheduledStart: null,
    scheduledEnd: null,
    tags: [],
    revision,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
  };
}

function fakeServer(initial: TaskItem[], conflictIds: string[] = []) {
  let tasks = initial.map((item) => ({ ...item }));
  const pushes: Array<{ operations: Array<Record<string, unknown>> }> = [];
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/sync/bootstrap") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ tasks: tasks.map((item) => ({ ...item })), cursor: 0 }),
      };
    }
    if (path === "/api/sync/push") {
      const body = JSON.parse(init!.body as string) as {
        operations: Array<Record<string, unknown>>;
      };
      pushes.push(body);
      const results = body.operations.map((operation) => {
        const taskId = operation.taskId as string;
        if (conflictIds.includes(taskId)) return { kind: "conflict", current: null };
        const patch = operation.patch as {
          scheduledStart: string | null;
          scheduledEnd: string | null;
        };
        tasks = tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                scheduledStart: patch.scheduledStart,
                scheduledEnd: patch.scheduledEnd,
                status: patch.scheduledStart ? "scheduled" : "inbox",
                revision: item.revision + 1,
              }
            : item,
        );
        return { kind: "ok", taskId, revision: 2 };
      });
      return { ok: true, status: 200, json: async () => ({ results }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, pushes };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("calendar scheduling", () => {
  it("previews a deterministic suggestion and saves accepted blocks with server revisions", async () => {
    const { pushes } = fakeServer([task("a", "Viết báo cáo"), task("b", "Gọi khách", 3)]);
    render(<CalendarPanel csrfToken="test-only-csrf" />);
    await screen.findByRole("heading", { name: /Chưa xếp lịch \(2\)/ });

    fireEvent.click(screen.getByRole("button", { name: "Gợi ý lịch 7 ngày" }));
    const preview = screen.getByRole("list", { name: "Gợi ý lịch" });
    expect(within(preview).getByText("Viết báo cáo")).toBeTruthy();
    expect(within(preview).getByText("Gọi khách")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Chấp nhận 2 khối" }));
    await screen.findByText("Đã lưu 2 khối lịch.");
    expect(pushes).toHaveLength(1);
    const operations = pushes[0]!.operations;
    expect(operations.map((operation) => operation.expectedRevision)).toEqual([1, 3]);
    for (const operation of operations) {
      const patch = operation.patch as { scheduledStart: string; scheduledEnd: string };
      expect(Date.parse(patch.scheduledEnd)).toBeGreaterThan(Date.parse(patch.scheduledStart));
    }
    expect(screen.queryByRole("list", { name: "Gợi ý lịch" })).toBeNull();
  });

  it("reports a server revision conflict instead of overwriting the task", async () => {
    fakeServer([task("a", "Việc một"), task("b", "Việc hai")], ["b"]);
    render(<CalendarPanel csrfToken="test-only-csrf" />);
    await screen.findByRole("heading", { name: /Chưa xếp lịch \(2\)/ });
    fireEvent.click(screen.getByRole("button", { name: "Gợi ý lịch 7 ngày" }));
    fireEvent.click(screen.getByRole("button", { name: "Chấp nhận 2 khối" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Đã lưu 1 khối lịch."),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "1 mục bị bỏ qua vì đã thay đổi trên thiết bị khác hoặc trùng lịch.",
    );
    expect(screen.getByRole("heading", { name: /Chưa xếp lịch \(1\)/ })).toBeTruthy();
  });
});
