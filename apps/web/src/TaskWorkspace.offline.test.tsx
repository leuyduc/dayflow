// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskWorkspace, type TaskItem } from "./TaskWorkspace";
import { clearTestOfflineData, getPendingCreates, pendingCreateCount } from "./offline-store";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
let online = true;
let uuidCounter = 0;
let lostResponse = false;
const persisted: TaskItem[] = [];
const acceptedKeys = new Map<string, TaskItem>();
let requests: Array<{ clientMutationId: string; taskId: string; title: string }> = [];

function fakeResponse(payload: unknown) {
  return { ok: true, json: async () => payload };
}

function setupServer() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (!online) throw new TypeError("offline");
      if (url === "/api/sync/bootstrap") {
        return fakeResponse({ tasks: persisted.slice(), cursor: persisted.length });
      }
      if (url.startsWith("/api/sync/pull?")) {
        return fakeResponse({ changes: [], nextCursor: persisted.length, hasMore: false });
      }
      if (url === "/api/sync/push" && init?.method === "POST") {
        const operation = JSON.parse(String(init.body)).operations[0] as {
          type: string;
          clientMutationId: string;
          taskId: string;
          input: { title: string };
        };
        if (operation.type !== "create") throw new Error("Unexpected mutation");
        requests.push({
          clientMutationId: operation.clientMutationId,
          taskId: operation.taskId,
          title: operation.input.title,
        });
        let task = acceptedKeys.get(operation.clientMutationId);
        if (!task) {
          const timestamp = new Date().toISOString();
          task = {
            id: operation.taskId,
            title: operation.input.title,
            description: null,
            status: "inbox",
            priority: "medium",
            dueDate: null,
            estimatedMinutes: null,
            scheduledStart: null,
            scheduledEnd: null,
            tags: [],
            subtasks: [],
            revision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
            completedAt: null,
          };
          acceptedKeys.set(operation.clientMutationId, task);
          persisted.push(task);
        }
        if (lostResponse) {
          lostResponse = false;
          throw new TypeError("response lost after commit");
        }
        return fakeResponse({
          results: [{ clientMutationId: operation.clientMutationId, kind: "ok", task }],
        });
      }
      throw new Error("Unexpected request " + url);
    }),
  );
}

async function capture(title: string) {
  fireEvent.change(screen.getByLabelText("Ghi nhanh công việc"), { target: { value: title } });
  fireEvent.click(screen.getByRole("button", { name: "Thêm việc" }));
  await screen.findByText(title);
}

beforeEach(async () => {
  await clearTestOfflineData();
  online = true;
  uuidCounter = 0;
  lostResponse = false;
  persisted.splice(0);
  acceptedKeys.clear();
  requests = [];
  vi.stubGlobal("crypto", {
    randomUUID: () => "00000000-0000-4000-8000-" + String(++uuidCounter).padStart(12, "0"),
  });
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  setupServer();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("G7 offline capture and recovery", () => {
  it("keeps captured work through component restart, isolates account cache and flushes on reconnect", async () => {
    const first = render(<TaskWorkspace ownerId={owner} csrfToken="csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    online = false;
    await capture("Chỉ lưu ở máy A");
    await screen.findByText(/1 việc đã lưu trên thiết bị đang chờ đồng bộ/);
    expect(requests).toHaveLength(0);
    expect(await pendingCreateCount(owner)).toBe(1);
    first.unmount();

    const second = render(<TaskWorkspace ownerId={owner} csrfToken="csrf" page="inbox" />);
    await screen.findByText("Chỉ lưu ở máy A");
    expect(await pendingCreateCount(owner)).toBe(1);
    second.unmount();

    const otherView = render(<TaskWorkspace ownerId={other} csrfToken="csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    expect(screen.queryByText("Chỉ lưu ở máy A")).toBeNull();
    expect(await pendingCreateCount(other)).toBe(0);
    otherView.unmount();

    render(<TaskWorkspace ownerId={owner} csrfToken="csrf" page="inbox" />);
    await screen.findByText("Chỉ lưu ở máy A");
    online = true;
    fireEvent(window, new Event("online"));
    await waitFor(async () => expect(await pendingCreateCount(owner)).toBe(0));
    expect(persisted.map((task) => task.title)).toEqual(["Chỉ lưu ở máy A"]);
    expect(requests).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sửa" }).hasAttribute("disabled")).toBe(false),
    );
  });

  it("does not create duplicates when PostgreSQL committed but the response was lost", async () => {
    render(<TaskWorkspace ownerId={owner} csrfToken="csrf" page="inbox" />);
    await screen.findByText("Chưa có công việc phù hợp");
    lostResponse = true;
    await capture("Không được tạo đôi");
    await waitFor(async () => expect(await pendingCreateCount(owner)).toBe(1));
    expect(persisted).toHaveLength(1);
    expect(requests).toHaveLength(1);
    fireEvent(window, new Event("focus"));
    await waitFor(async () => expect(await pendingCreateCount(owner)).toBe(0));
    expect(persisted).toHaveLength(1);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(await getPendingCreates(owner)).toEqual([]);
  });
});
