import { describe, expect, it } from "vitest";
import {
  MAX_BACKUP_BYTES,
  MAX_BACKUP_TASKS,
  parseBackup,
  planBackupImport,
  type BackupTask,
} from "./backup.js";

const id1 = "11111111-1111-4111-8111-111111111111";
const id2 = "22222222-2222-4222-8222-222222222222";
const settings = {
  timeZone: "Asia/Ho_Chi_Minh",
  workingDays: [1, 2, 3, 4, 5],
  workingDayStart: "09:00",
  workingDayEnd: "17:00",
  defaultTaskDurationMinutes: 30,
  bufferMinutes: 10,
};

function task(overrides: Record<string, unknown> = {}) {
  return {
    id: id1,
    title: "  Viết báo cáo  ",
    description: null,
    status: "inbox",
    priority: "medium",
    dueDate: "2026-10-20",
    estimatedMinutes: 60,
    scheduledStart: null,
    scheduledEnd: null,
    tags: [" work "],
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function file(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: "dayflow-backup",
    version: 1,
    exportedAt: "2026-10-13T00:00:00.000Z",
    tasks: [task()],
    settings,
    ...overrides,
  });
}

function errorsOf(text: string): string[] {
  const result = parseBackup(text);
  if (result.ok) throw new Error("expected invalid backup");
  return result.errors;
}

describe("parseBackup", () => {
  it("accepts a valid v1 backup and normalizes text fields", () => {
    const result = parseBackup(file());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.tasks[0]!.title).toBe("Viết báo cáo");
    expect(result.backup.tasks[0]!.tags).toEqual(["work"]);
    expect(result.backup.tasks[0]!.subtasks).toEqual([]);
  });

  it("rejects non-JSON, non-DayFlow and unsupported-version files", () => {
    expect(errorsOf("{not json")[0]).toMatch(/không phải JSON/);
    expect(errorsOf(file({ format: "other" }))[0]).toMatch(/không phải DayFlow/);
    expect(errorsOf(file({ version: 2 }))[0]).toMatch(/chưa được hỗ trợ/);
  });

  it("rejects oversized files and too many tasks before accepting anything", () => {
    expect(errorsOf("x".repeat(MAX_BACKUP_BYTES + 1))[0]).toMatch(/quá lớn/);
    const many = Array.from({ length: MAX_BACKUP_TASKS + 1 }, () => task());
    expect(errorsOf(file({ tasks: many }))[0]).toMatch(/Tối đa/);
  });

  it("rejects invalid task fields with actionable messages", () => {
    const errors = errorsOf(
      file({
        tasks: [
          task({ title: "   " }),
          task({ id: "not-a-uuid" }),
          task({ dueDate: "2026-02-30" }),
          task({ priority: "critical" }),
          task({ estimatedMinutes: 0 }),
        ],
      }),
    );
    expect(errors.join("\n")).toMatch(/tasks\[0\]\.title/);
    expect(errors.join("\n")).toMatch(/tasks\[1\]\.id/);
    expect(errors.join("\n")).toMatch(/tasks\[2\]\.dueDate/);
    expect(errors.join("\n")).toMatch(/tasks\[3\]\.priority/);
    expect(errors.join("\n")).toMatch(/tasks\[4\]\.estimatedMinutes/);
  });

  it("rejects invalid schedule ranges and half-set schedules", () => {
    const errors = errorsOf(
      file({
        tasks: [
          task({
            scheduledStart: "2026-10-12T03:00:00.000Z",
            scheduledEnd: "2026-10-12T02:00:00.000Z",
          }),
          task({ id: id2, scheduledStart: "2026-10-12T03:00:00.000Z", scheduledEnd: null }),
        ],
      }),
    );
    expect(errors.join("\n")).toMatch(/tasks\[0\]: giờ kết thúc/);
    expect(errors.join("\n")).toMatch(/tasks\[1\]: lịch phải có cả/);
  });

  it("rejects a subtask without a title", () => {
    expect(
      errorsOf(
        file({
          tasks: [task({ subtasks: [{ id: id2, title: " ", completed: false }] })],
        }),
      )[0],
    ).toMatch(/subtasks/);
  });

  it("rejects duplicate IDs inside the file", () => {
    const errors = errorsOf(file({ tasks: [task(), task({ title: "Khác" })] }));
    expect(errors.join("\n")).toMatch(/tasks\[1\]\.id: bị trùng/);
  });

  it("rejects invalid settings", () => {
    expect(errorsOf(file({ settings: { ...settings, workingDays: [9] } }))[0]).toMatch(/settings/);
    expect(errorsOf(file({ settings: { ...settings, timeZone: "Not/AZone" } }))[0]).toMatch(
      /settings/,
    );
    expect(errorsOf(file({ settings: undefined }))[0]).toMatch(/settings/);
  });

  it("supports older v1 files and optionally restores week start and theme", () => {
    const legacy = parseBackup(file());
    expect(legacy.ok).toBe(true);
    if (!legacy.ok) return;
    expect(legacy.backup.settings.weekStartsOn).toBeUndefined();
    expect(legacy.backup.settings.theme).toBeUndefined();

    const extended = parseBackup(
      file({ settings: { ...settings, weekStartsOn: 0, theme: "dark" } }),
    );
    expect(extended.ok).toBe(true);
    if (!extended.ok) return;
    expect(extended.backup.settings.weekStartsOn).toBe(0);
    expect(extended.backup.settings.theme).toBe("dark");
  });

  it("rejects invalid optional settings instead of silently ignoring them", () => {
    expect(errorsOf(file({ settings: { ...settings, weekStartsOn: 8 } }))[0]).toMatch(/settings/);
    expect(errorsOf(file({ settings: { ...settings, theme: "unknown" } }))[0]).toMatch(/settings/);
  });

  it("is pure: the same input always gives the same output", () => {
    expect(parseBackup(file())).toEqual(parseBackup(file()));
  });
});

function parsedTask(overrides: Record<string, unknown> = {}): BackupTask {
  const result = parseBackup(file({ tasks: [task(overrides)] }));
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.backup.tasks[0]!;
}

describe("planBackupImport", () => {
  it("skips existing ids and keeps new tasks, including an adjacent block", () => {
    const fresh = parsedTask({ id: id2 });
    const adjacent = parsedTask({
      id: id1,
      status: "scheduled",
      scheduledStart: "2026-10-12T03:00:00.000Z",
      scheduledEnd: "2026-10-12T04:00:00.000Z",
    });
    const plan = planBackupImport(
      new Set([id2]),
      [{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T03:00:00.000Z" }],
      [fresh, adjacent],
    );
    expect(plan).toEqual({ ok: true, insert: [adjacent], skipped: 1 });
  });

  it("rejects the whole file when a new block overlaps occupied time", () => {
    const clashing = parsedTask({
      status: "scheduled",
      scheduledStart: "2026-10-12T02:30:00.000Z",
      scheduledEnd: "2026-10-12T03:30:00.000Z",
    });
    const plan = planBackupImport(
      new Set(),
      [{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T03:00:00.000Z" }],
      [clashing, parsedTask({ id: id2 })],
    );
    expect(plan).toEqual({ ok: false, error: "schedule-overlap" });
  });

  it("rejects when two new blocks overlap each other", () => {
    const first = parsedTask({
      status: "scheduled",
      scheduledStart: "2026-10-12T02:00:00.000Z",
      scheduledEnd: "2026-10-12T03:00:00.000Z",
    });
    const second = parsedTask({
      id: id2,
      status: "scheduled",
      scheduledStart: "2026-10-12T02:30:00.000Z",
      scheduledEnd: "2026-10-12T04:00:00.000Z",
    });
    expect(planBackupImport(new Set(), [], [first, second])).toEqual({
      ok: false,
      error: "schedule-overlap",
    });
  });
});
