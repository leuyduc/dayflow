// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BackupPanel } from "./BackupPanel";

const existingId = "33333333-3333-4333-8333-333333333333";
const newId = "11111111-1111-4111-8111-111111111111";
const scheduledId = "22222222-2222-4222-8222-222222222222";

function backupText(tasks: Array<Record<string, unknown>>) {
  return JSON.stringify({
    format: "dayflow-backup",
    version: 1,
    exportedAt: "2026-10-13T00:00:00.000Z",
    settings: {
      timeZone: "Asia/Ho_Chi_Minh",
      workingDays: [1, 2, 3, 4, 5],
      workingDayStart: "09:00",
      workingDayEnd: "17:00",
      defaultTaskDurationMinutes: 30,
      bufferMinutes: 10,
    },
    tasks,
  });
}

function backupTask(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: "Việc " + id.slice(0, 4),
    description: null,
    status: "inbox",
    priority: "medium",
    dueDate: null,
    estimatedMinutes: 30,
    scheduledStart: null,
    scheduledEnd: null,
    tags: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function fakeFile(text: string) {
  const file = new File([text], "dayflow-backup.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => text });
  return file;
}

function fakeServer(existing: Array<{ id: string }>, status = 200) {
  const imports: Array<{ tasks: Array<{ id: string; scheduledStart: string | null }> }> = [];
  const fetchMock = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/sync/bootstrap") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          tasks: existing.map((item) => ({ ...item, title: "x", revision: 1 })),
          cursor: 0,
        }),
      };
    }
    if (path === "/api/backup/import") {
      const body = JSON.parse(init!.body as string) as {
        tasks: Array<{ id: string; scheduledStart: string | null }>;
      };
      imports.push(body);
      if (status === 409) {
        return { ok: false, status: 409, json: async () => ({ error: "schedule-overlap" }) };
      }
      const fresh = body.tasks.filter((task) => !existing.some((item) => item.id === task.id));
      return {
        ok: true,
        status: 200,
        json: async () => ({ imported: fresh.length, skipped: body.tasks.length - fresh.length }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { imports };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("backup import", () => {
  it("imports only new tasks, skips existing IDs and restores scheduled state", async () => {
    const { imports } = fakeServer([{ id: existingId }]);
    const { container } = render(<BackupPanel csrfToken="test-only-csrf" />);
    const input = container.querySelector<HTMLInputElement>("#backup-file")!;
    const text = backupText([
      backupTask(newId),
      backupTask(scheduledId, {
        status: "scheduled",
        scheduledStart: "2026-10-12T02:00:00.000Z",
        scheduledEnd: "2026-10-12T03:00:00.000Z",
      }),
      backupTask(existingId),
    ]);
    fireEvent.change(input, { target: { files: [fakeFile(text)] } });
    await screen.findByText(/Tệp có 3 công việc: 2 mới, 1 đã tồn tại/);

    fireEvent.click(screen.getByRole("button", { name: "Nhập 2 công việc" }));
    await screen.findByText(/Đã nhập 2 công việc\. Bỏ qua 1 công việc đã tồn tại/);

    expect(imports).toHaveLength(1);
    expect(imports[0]!.tasks.map((task) => task.id)).toEqual([newId, scheduledId, existingId]);
    expect(imports[0]!.tasks.find((task) => task.id === scheduledId)).toMatchObject({
      status: "scheduled",
      scheduledStart: "2026-10-12T02:00:00.000Z",
      scheduledEnd: "2026-10-12T03:00:00.000Z",
    });
  });

  it("restores schedule settings even when all task IDs already exist", async () => {
    const { imports } = fakeServer([{ id: existingId }]);
    const onImported = vi.fn();
    const { container } = render(
      <BackupPanel csrfToken="test-only-csrf" onImported={onImported} />,
    );
    const input = container.querySelector<HTMLInputElement>("#backup-file")!;
    fireEvent.change(input, {
      target: { files: [fakeFile(backupText([backupTask(existingId)]))] },
    });
    await screen.findByText(/Tệp có 1 công việc: 0 mới, 1 đã tồn tại/);

    const button = screen.getByRole("button", { name: "Chỉ khôi phục cài đặt lịch" });
    expect(button.hasAttribute("disabled")).toBe(false);
    fireEvent.click(button);
    await screen.findByText(/Đã nhập 0 công việc\. Bỏ qua 1 công việc đã tồn tại/);
    expect(imports).toHaveLength(1);
    expect(onImported).toHaveBeenCalledOnce();
  });

  it("exports the actual saved settings and a re-importable backup", async () => {
    const savedSettings = {
      timeZone: "Asia/Ho_Chi_Minh",
      workingDays: [1, 3, 5],
      workingDayStart: "08:15",
      workingDayEnd: "16:45",
      defaultTaskDurationMinutes: 45,
      bufferMinutes: 5,
      weekStartsOn: 0,
      theme: "dark",
      revision: 7,
    };
    const fetchMock = vi.fn(async (path: string) => {
      if (path === "/api/sync/bootstrap") {
        return { ok: true, json: async () => ({ tasks: [backupTask(newId)], cursor: 0 }) };
      }
      if (path === "/api/settings") {
        return { ok: true, json: async () => ({ settings: savedSettings }) };
      }
      throw new Error("Unexpected fetch: " + path);
    });
    vi.stubGlobal("fetch", fetchMock);
    let exportedBlob: Blob | null = null;
    const NativeURL = URL;
    class MockURL extends NativeURL {
      static createObjectURL(blob: Blob) {
        exportedBlob = blob;
        return "blob:dayflow-test";
      }
      static revokeObjectURL() {}
    }
    vi.stubGlobal("URL", MockURL);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<BackupPanel csrfToken="test-only-csrf" />);
    fireEvent.click(screen.getByRole("button", { name: "Xuất sao lưu JSON" }));
    await screen.findByText("Đã xuất 1 công việc.");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(exportedBlob).not.toBeNull();
    const reader = new FileReader();
    const backupJson = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(exportedBlob!);
    });
    const exported = JSON.parse(backupJson);
    expect(exported.settings).toMatchObject({
      timeZone: "Asia/Ho_Chi_Minh",
      workingDays: [1, 3, 5],
      workingDayStart: "08:15",
      weekStartsOn: 0,
      theme: "dark",
    });
    expect(exported.settings.revision).toBeUndefined();
    expect(exported.tasks).toHaveLength(1);
  });

  it("rejects an invalid file without writing anything", async () => {
    const { imports } = fakeServer([]);
    const { container } = render(<BackupPanel csrfToken="test-only-csrf" />);
    const input = container.querySelector<HTMLInputElement>("#backup-file")!;
    fireEvent.change(input, { target: { files: [fakeFile('{"format":"other"}')] } });
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toMatch(/không phải DayFlow/);
    await waitFor(() => expect(imports).toHaveLength(0));
    expect(screen.queryByRole("button", { name: /Nhập \d+ công việc/ })).toBeNull();
  });

  it("shows an overlap error and keeps the preview when the server writes nothing", async () => {
    fakeServer([], 409);
    const { container } = render(<BackupPanel csrfToken="test-only-csrf" />);
    const input = container.querySelector<HTMLInputElement>("#backup-file")!;
    fireEvent.change(input, { target: { files: [fakeFile(backupText([backupTask(newId)]))] } });
    fireEvent.click(await screen.findByRole("button", { name: "Nhập 1 công việc" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Chưa ghi thay đổi nào/);
    expect(screen.getByRole("button", { name: "Nhập 1 công việc" })).toBeTruthy();
  });
});
