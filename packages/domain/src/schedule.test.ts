import { describe, expect, it } from "vitest";
import {
  suggestSchedule,
  zonedWallClockToUtc,
  type ScheduleSettings,
  type SchedulableTask,
  type SuggestInput,
} from "./schedule.js";

const hcm: ScheduleSettings = {
  timeZone: "Asia/Ho_Chi_Minh",
  workingDays: [1, 2, 3, 4, 5],
  workingDayStart: "09:00",
  workingDayEnd: "12:00",
  defaultTaskDurationMinutes: 30,
  bufferMinutes: 0,
};

function task(id: string, overrides: Partial<SchedulableTask> = {}): SchedulableTask {
  return {
    id,
    status: "inbox",
    priority: "medium",
    dueDate: null,
    estimatedMinutes: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function input(overrides: Partial<SuggestInput> = {}): SuggestInput {
  return {
    now: "2026-10-12T00:00:00.000Z", // Monday 07:00 in Asia/Ho_Chi_Minh
    windowStartDate: "2026-10-12",
    windowDays: 1,
    tasks: [],
    obstacles: [],
    settings: hcm,
    ...overrides,
  };
}

describe("zonedWallClockToUtc", () => {
  it("maps local wall clock to UTC for a fixed-offset zone", () => {
    expect(
      new Date(zonedWallClockToUtc("2026-10-12", 9 * 60, "Asia/Ho_Chi_Minh")).toISOString(),
    ).toBe("2026-10-12T02:00:00.000Z");
  });

  it("uses the offset in force on that date across a DST change", () => {
    // New York moved from EST (-5) to EDT (-4) on 2026-03-08.
    expect(
      new Date(zonedWallClockToUtc("2026-03-07", 9 * 60, "America/New_York")).toISOString(),
    ).toBe("2026-03-07T14:00:00.000Z");
    expect(
      new Date(zonedWallClockToUtc("2026-03-09", 9 * 60, "America/New_York")).toISOString(),
    ).toBe("2026-03-09T13:00:00.000Z");
  });
});

describe("suggestSchedule", () => {
  it("returns an empty plan for empty input", () => {
    expect(suggestSchedule(input())).toEqual({ placements: [], unscheduled: [] });
  });

  it("places the earliest feasible slot inside working hours", () => {
    const result = suggestSchedule(
      input({
        now: "2026-10-11T00:00:00.000Z",
        tasks: [task("a", { estimatedMinutes: 60 })],
      }),
    );
    expect(result.placements).toEqual([
      { taskId: "a", start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T03:00:00.000Z" },
    ]);
  });

  it("never places a block in the past relative to the injected clock", () => {
    const result = suggestSchedule(
      input({ now: "2026-10-12T04:00:00.000Z", tasks: [task("a", { estimatedMinutes: 30 })] }),
    );
    expect(result.placements[0]!.start).toBe("2026-10-12T04:00:00.000Z");
  });

  it("skips non-working days and reports no-working-time when none exist", () => {
    const weekend = suggestSchedule(
      input({
        windowStartDate: "2026-10-17", // Saturday
        windowDays: 2,
        tasks: [task("a")],
      }),
    );
    expect(weekend.placements).toEqual([]);
    expect(weekend.unscheduled).toEqual([{ taskId: "a", reason: "no-working-time" }]);
  });

  it("orders by priority, then due date, then createdAt, then id", () => {
    const result = suggestSchedule(
      input({
        windowDays: 5,
        now: "2026-10-11T00:00:00.000Z",
        tasks: [
          task("low", { priority: "low", estimatedMinutes: 30 }),
          task("urgent-late", { priority: "urgent", dueDate: "2026-10-16", estimatedMinutes: 30 }),
          task("urgent-early", { priority: "urgent", dueDate: "2026-10-13", estimatedMinutes: 30 }),
          task("high-b", {
            priority: "high",
            estimatedMinutes: 30,
            createdAt: "2026-10-02T00:00:00.000Z",
          }),
          task("high-a", {
            priority: "high",
            estimatedMinutes: 30,
            createdAt: "2026-10-02T00:00:00.000Z",
          }),
        ],
      }),
    );
    expect(result.placements.map((p) => p.taskId)).toEqual([
      "urgent-early",
      "urgent-late",
      "high-a",
      "high-b",
      "low",
    ]);
  });

  it("keeps blocks non-overlapping and separated by the buffer", () => {
    const result = suggestSchedule(
      input({
        settings: { ...hcm, bufferMinutes: 10 },
        tasks: [task("a", { estimatedMinutes: 60 }), task("b", { estimatedMinutes: 60 })],
      }),
    );
    const [first, second] = result.placements;
    expect(first!.end).toBe("2026-10-12T03:00:00.000Z");
    expect(second!.start).toBe("2026-10-12T03:10:00.000Z");
  });

  it("avoids existing obstacles including the buffer around them", () => {
    const result = suggestSchedule(
      input({
        settings: { ...hcm, bufferMinutes: 15 },
        obstacles: [{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T02:30:00.000Z" }],
        tasks: [task("a", { estimatedMinutes: 30 })],
      }),
    );
    expect(result.placements[0]).toEqual({
      taskId: "a",
      start: "2026-10-12T02:45:00.000Z",
      end: "2026-10-12T03:15:00.000Z",
    });
  });

  it("fits exactly into an available slot", () => {
    const result = suggestSchedule(
      input({
        now: "2026-10-11T00:00:00.000Z",
        obstacles: [{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T03:00:00.000Z" }],
        tasks: [task("exact", { estimatedMinutes: 120 })],
      }),
    );
    expect(result.placements).toEqual([
      { taskId: "exact", start: "2026-10-12T03:00:00.000Z", end: "2026-10-12T05:00:00.000Z" },
    ]);
  });

  it("reports duration-too-long for a task longer than any working block", () => {
    const result = suggestSchedule(input({ tasks: [task("big", { estimatedMinutes: 181 })] }));
    expect(result.unscheduled).toEqual([{ taskId: "big", reason: "duration-too-long" }]);
  });

  it("reports window-ended when obstacles fill the window", () => {
    const result = suggestSchedule(
      input({
        now: "2026-10-11T00:00:00.000Z",
        obstacles: [{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T05:00:00.000Z" }],
        tasks: [task("a", { estimatedMinutes: 60 })],
      }),
    );
    expect(result.unscheduled).toEqual([{ taskId: "a", reason: "window-ended" }]);
  });

  it("prefers a slot on or before the due date and warns when impossible", () => {
    const result = suggestSchedule(
      input({
        windowStartDate: "2026-10-12",
        windowDays: 2,
        now: "2026-10-11T00:00:00.000Z",
        obstacles: [{ start: "2026-10-12T02:00:00.000Z", end: "2026-10-12T05:00:00.000Z" }],
        tasks: [task("due-today", { estimatedMinutes: 60, dueDate: "2026-10-12" })],
      }),
    );
    expect(result.placements).toEqual([
      {
        taskId: "due-today",
        start: "2026-10-13T02:00:00.000Z",
        end: "2026-10-13T03:00:00.000Z",
        warning: "deadline-conflict",
      },
    ]);

    const movedEarlier = suggestSchedule(
      input({
        windowStartDate: "2026-10-12",
        windowDays: 2,
        now: "2026-10-11T00:00:00.000Z",
        tasks: [task("x", { estimatedMinutes: 60, dueDate: "2026-10-13" })],
      }),
    );
    expect(movedEarlier.placements[0]!.start).toBe("2026-10-12T02:00:00.000Z");
    expect(movedEarlier.placements[0]).not.toHaveProperty("warning");
  });

  it("ignores completed tasks", () => {
    const result = suggestSchedule(input({ tasks: [task("done", { status: "completed" })] }));
    expect(result).toEqual({ placements: [], unscheduled: [] });
  });

  it("uses the default duration when a task has no estimate", () => {
    const result = suggestSchedule(input({ now: "2026-10-11T00:00:00.000Z", tasks: [task("a")] }));
    expect(result.placements[0]!.end).toBe("2026-10-12T02:30:00.000Z");
  });

  it("is deterministic and does not mutate its input", () => {
    const tasks = [task("b", { estimatedMinutes: 30 }), task("a", { estimatedMinutes: 30 })];
    const snapshot = JSON.stringify(tasks);
    const first = suggestSchedule(input({ tasks, now: "2026-10-11T00:00:00.000Z" }));
    const second = suggestSchedule(input({ tasks, now: "2026-10-11T00:00:00.000Z" }));
    expect(first).toEqual(second);
    expect(JSON.stringify(tasks)).toBe(snapshot);
  });

  it("places blocks at correct local times across a DST transition", () => {
    const result = suggestSchedule({
      now: "2026-03-06T00:00:00.000Z",
      windowStartDate: "2026-03-09",
      windowDays: 1,
      tasks: [task("dst", { estimatedMinutes: 30 })],
      obstacles: [],
      settings: { ...hcm, timeZone: "America/New_York" },
    });
    expect(result.placements[0]!.start).toBe("2026-03-09T13:00:00.000Z");
  });
});
