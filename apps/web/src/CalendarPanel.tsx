import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  suggestSchedule,
  zonedWallClockToUtc,
  type ScheduleSettings,
  type SuggestResult,
} from "@dayflow/domain";
import { addDays, localDate, monthCells, shiftMonth, weekStart } from "./dates";
import type { PlannerSettings } from "./SettingsPanel";
import type { TaskItem } from "./TaskWorkspace";

const WINDOW_DAYS = 7;
const PUSH_BATCH = 25;
const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const planningSettings: ScheduleSettings = {
  timeZone: browserZone,
  workingDays: [1, 2, 3, 4, 5],
  workingDayStart: "09:00",
  workingDayEnd: "17:00",
  defaultTaskDurationMinutes: 30,
  bufferMinutes: 10,
};
const initialPlanner: PlannerSettings = {
  ...planningSettings,
  weekStartsOn: 1,
  theme: "system",
  revision: 0,
};
const reasonText = {
  "no-working-time": "Không có giờ làm việc trong khoảng này",
  "duration-too-long": "Thời lượng dài hơn một khối làm việc",
  "window-ended": "Hết khoảng thời gian để xếp lịch",
} as const;

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(date + "T12:00:00Z"));
}
function timeRange(start: string, end: string, timeZone: string): string {
  const format = new Intl.DateTimeFormat("vi-VN", { timeZone, hour: "2-digit", minute: "2-digit" });
  return format.format(new Date(start)) + " – " + format.format(new Date(end));
}
function overlaps(
  a: { start: string; end: string },
  blocks: Array<{ start: string; end: string }>,
) {
  return blocks.some(
    (block) =>
      Date.parse(a.start) < Date.parse(block.end) && Date.parse(block.start) < Date.parse(a.end),
  );
}
function blockOf(task: TaskItem) {
  return task.scheduledStart && task.scheduledEnd && task.status !== "completed"
    ? { start: task.scheduledStart, end: task.scheduledEnd }
    : null;
}

type PushResult = { kind: string };
type CalendarView = "day" | "week" | "month";

export function CalendarPanel({ csrfToken }: { csrfToken: string }) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [planner, setPlanner] = useState(initialPlanner);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<SuggestResult | null>(null);
  const [view, setView] = useState<CalendarView>("week");
  const today = localDate(new Date(), planner.timeZone);
  const [anchor, setAnchor] = useState(today);

  async function load(): Promise<TaskItem[]> {
    const response = await fetch("/api/sync/bootstrap", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Không tải được lịch. Hãy kiểm tra kết nối.");
    const body = (await response.json()) as { tasks: TaskItem[] };
    setTasks(body.tasks);
    const settingsResponse = await fetch("/api/settings", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (settingsResponse.ok) {
      const settingsBody = (await settingsResponse.json()) as { settings?: PlannerSettings } | null;
      if (settingsBody?.settings?.timeZone) setPlanner(settingsBody.settings);
    }
    return body.tasks;
  }

  useEffect(() => {
    load()
      .catch(() => setError("Không tải được lịch. Hãy kiểm tra kết nối."))
      .finally(() => setLoading(false));
  }, []);

  const open = useMemo(() => tasks.filter((task) => task.status !== "completed"), [tasks]);
  const scheduled = useMemo(
    () =>
      open
        .filter((task) => blockOf(task) !== null)
        .sort((a, b) => a.scheduledStart!.localeCompare(b.scheduledStart!)),
    [open],
  );
  const unscheduled = open.filter((task) => blockOf(task) === null);
  const visibleDays =
    view === "day"
      ? [anchor]
      : Array.from({ length: 7 }, (_, index) =>
          addDays(weekStart(anchor, planner.weekStartsOn), index),
        );
  const cells = view === "month" ? monthCells(anchor, planner.weekStartsOn) : [];
  const titleOf = (taskId: string) =>
    tasks.find((task) => task.id === taskId)?.title ?? "Công việc";

  function suggest() {
    setError("");
    setNotice("");
    setProposal(
      suggestSchedule({
        now: new Date().toISOString(),
        windowStartDate: today,
        windowDays: WINDOW_DAYS,
        tasks: unscheduled,
        obstacles: scheduled.map((task) => blockOf(task)!),
        settings: planner,
      }),
    );
  }

  async function pushUpdates(
    updates: Array<{ taskId: string; expectedRevision: number; patch: object }>,
  ): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let index = 0; index < updates.length; index += PUSH_BATCH) {
      const batch = updates.slice(index, index + PUSH_BATCH).map((update) => ({
        clientMutationId: crypto.randomUUID(),
        type: "update",
        ...update,
      }));
      const response = await fetch("/api/sync/push", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Dayflow-CSRF": csrfToken },
        body: JSON.stringify({ operations: batch }),
      });
      if (!response.ok) throw new Error("Không thể lưu lịch. Vui lòng thử lại.");
      results.push(...((await response.json()) as { results: PushResult[] }).results);
    }
    return results;
  }

  async function acceptProposal() {
    if (!proposal || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const fresh = await load();
      const byId = new Map(fresh.map((task) => [task.id, task]));
      const freshBlocks = fresh.map(blockOf).filter((block) => block !== null);
      const updates: Array<{ taskId: string; expectedRevision: number; patch: object }> = [];
      let skipped = 0;
      for (const placement of proposal.placements) {
        const current = byId.get(placement.taskId);
        if (!current || current.status === "completed" || overlaps(placement, freshBlocks)) {
          skipped++;
          continue;
        }
        freshBlocks.push({ start: placement.start, end: placement.end });
        updates.push({
          taskId: placement.taskId,
          expectedRevision: current.revision,
          patch: { scheduledStart: placement.start, scheduledEnd: placement.end },
        });
      }
      const results = await pushUpdates(updates);
      const saved = results.filter((result) => result.kind === "ok").length;
      const conflicts = results.length - saved;
      await load();
      setProposal(null);
      setNotice(
        `Đã lưu ${saved} khối lịch.` +
          (conflicts + skipped > 0
            ? ` ${conflicts + skipped} mục bị bỏ qua vì đã thay đổi trên thiết bị khác hoặc trùng lịch.`
            : ""),
      );
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể lưu lịch.");
    } finally {
      setBusy(false);
    }
  }

  async function unschedule(task: TaskItem) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const results = await pushUpdates([
        {
          taskId: task.id,
          expectedRevision: task.revision,
          patch: { scheduledStart: null, scheduledEnd: null },
        },
      ]);
      await load();
      if (results[0]?.kind !== "ok") {
        setError("Công việc đã thay đổi trên thiết bị khác. Danh sách đã được tải lại.");
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể bỏ lịch.");
    } finally {
      setBusy(false);
    }
  }

  async function placeManually(task: TaskItem, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const startLocal = String(data.get("start") ?? "");
    const minutes = Number(data.get("minutes"));
    const [date, clock] = startLocal.split("T");
    const [hour, minute] = (clock ?? "").split(":").map(Number);
    if (
      !date ||
      !clock ||
      hour === undefined ||
      minute === undefined ||
      !Number.isInteger(hour) ||
      !Number.isInteger(minute)
    ) {
      setError("Chọn giờ bắt đầu.");
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      setError("Thời lượng phải từ 1 đến 1440 phút.");
      return;
    }
    const startMs = zonedWallClockToUtc(date, hour * 60 + minute, planner.timeZone);
    const start = new Date(startMs).toISOString();
    const end = new Date(startMs + minutes * 60_000).toISOString();
    if (
      overlaps(
        { start, end },
        scheduled.flatMap((item) => {
          const block = blockOf(item);
          return block ? [block] : [];
        }),
      )
    ) {
      setError("Khung giờ này trùng một khối lịch đã có.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const results = await pushUpdates([
        {
          taskId: task.id,
          expectedRevision: task.revision,
          patch: { scheduledStart: start, scheduledEnd: end },
        },
      ]);
      await load();
      if (results[0]?.kind === "schedule-overlap") {
        setError("Khung giờ này trùng một khối lịch đã có.");
      } else if (results[0]?.kind !== "ok") {
        setError("Không xếp được vì công việc đã thay đổi.");
      } else setNotice("Đã xếp " + task.title + ".");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể xếp lịch.");
    } finally {
      setBusy(false);
    }
  }

  function dropPlacement(taskId: string) {
    setProposal((current) =>
      current
        ? { ...current, placements: current.placements.filter((item) => item.taskId !== taskId) }
        : current,
    );
  }

  async function createOnDay(day: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const clock = String(data.get("start") ?? "");
    const minutes = Number(data.get("minutes"));
    const [hourText, minuteText] = clock.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (!title || !Number.isInteger(hour) || !Number.isInteger(minute)) {
      setError("Nhập tiêu đề và giờ bắt đầu.");
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
      setError("Thời lượng phải từ 1 đến 1440 phút.");
      return;
    }
    const startMs = zonedWallClockToUtc(day, hour * 60 + minute, planner.timeZone);
    const start = new Date(startMs).toISOString();
    const end = new Date(startMs + minutes * 60_000).toISOString();
    const blocks = scheduled.flatMap((item) => {
      const block = blockOf(item);
      return block ? [block] : [];
    });
    if (overlaps({ start, end }, blocks)) {
      setError("Khung giờ này trùng một khối lịch đã có.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Dayflow-CSRF": csrfToken },
        body: JSON.stringify({ title, estimatedMinutes: minutes }),
      });
      if (!response.ok) throw new Error("Không tạo được công việc.");
      const created = (await response.json()) as { task?: TaskItem } | null;
      if (!created?.task) throw new Error("Không tạo được công việc.");
      const results = await pushUpdates([
        {
          taskId: created.task.id,
          expectedRevision: created.task.revision,
          patch: { scheduledStart: start, scheduledEnd: end },
        },
      ]);
      await load();
      if (results[0]?.kind !== "ok") {
        setError("Đã tạo việc nhưng chưa xếp được giờ. Việc nằm ở mục chưa xếp lịch.");
      } else {
        setNotice("Đã thêm " + title + ".");
        form.reset();
      }
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể thêm việc vào ngày này.");
    } finally {
      setBusy(false);
    }
  }

  function shift(direction: -1 | 1) {
    setAnchor((current) =>
      view === "month"
        ? shiftMonth(current, direction)
        : addDays(current, view === "week" ? direction * 7 : direction),
    );
  }

  if (loading) return <p role="status">Đang tải lịch...</p>;

  return (
    <section aria-label="Lịch công việc">
      <p className="subtitle">
        Múi giờ {planner.timeZone} · Giờ làm {planner.workingDayStart}–{planner.workingDayEnd}.
      </p>
      <div className="task-toolbar view-switch">
        {(
          [
            ["day", "Ngày"],
            ["week", "Tuần"],
            ["month", "Tháng"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="task-action"
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="task-action" onClick={() => shift(-1)}>
          Trước
        </button>
        <button type="button" className="task-action" onClick={() => setAnchor(today)}>
          Về hôm nay
        </button>
        <button type="button" className="task-action" onClick={() => shift(1)}>
          Sau
        </button>
      </div>
      <div className="task-toolbar">
        <button type="button" className="task-action" disabled={busy} onClick={suggest}>
          Gợi ý lịch {WINDOW_DAYS} ngày
        </button>
        {proposal && (
          <>
            <button
              type="button"
              className="task-action"
              disabled={busy || proposal.placements.length === 0}
              onClick={() => void acceptProposal()}
            >
              Chấp nhận {proposal.placements.length} khối
            </button>
            <button
              type="button"
              className="task-action"
              disabled={busy}
              onClick={() => setProposal(null)}
            >
              Hủy gợi ý
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="task-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}

      {proposal && (
        <div className="message-card">
          <div>
            <h2>Xem trước gợi ý</h2>
            {proposal.placements.length === 0 ? (
              <p>Chưa có khối nào phù hợp để xếp.</p>
            ) : (
              <ul aria-label="Gợi ý lịch">
                {proposal.placements.map((placement) => (
                  <li key={placement.taskId}>
                    <strong>{titleOf(placement.taskId)}</strong> ·{" "}
                    {dayLabel(localDate(new Date(placement.start), planner.timeZone))} ·{" "}
                    {timeRange(placement.start, placement.end, planner.timeZone)}
                    {placement.warning === "deadline-conflict" && " · Vượt hạn hoàn thành"}{" "}
                    <button
                      type="button"
                      className="task-action"
                      disabled={busy}
                      onClick={() => dropPlacement(placement.taskId)}
                    >
                      Bỏ khối này
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {proposal.unscheduled.length > 0 && (
              <>
                <p>Chưa xếp được:</p>
                <ul>
                  {proposal.unscheduled.map((item) => (
                    <li key={item.taskId}>
                      {titleOf(item.taskId)} — {reasonText[item.reason]}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {view === "month" ? (
        <div className="month-grid" aria-label="Tháng">
          {cells.map((day) => {
            const count = scheduled.filter(
              (task) => localDate(new Date(task.scheduledStart!), planner.timeZone) === day,
            ).length;
            return (
              <button
                key={day}
                type="button"
                className={
                  "month-cell" + (day.slice(0, 7) === anchor.slice(0, 7) ? "" : " outside")
                }
                onClick={() => {
                  setAnchor(day);
                  setView("day");
                }}
              >
                {day.slice(8)}
                {count > 0 && <small>{count} việc</small>}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {view === "day" && (
            <form
              className="place-form"
              aria-label="Thêm việc vào ngày đang xem"
              onSubmit={(event) => void createOnDay(anchor, event)}
            >
              <input
                name="title"
                aria-label="Tiêu đề việc mới"
                maxLength={240}
                placeholder="Việc mới trong ngày này"
                required
              />
              <input
                name="start"
                type="time"
                aria-label="Giờ bắt đầu việc mới"
                defaultValue={planner.workingDayStart}
                required
              />
              <input
                name="minutes"
                type="number"
                aria-label="Số phút việc mới"
                min={1}
                max={1440}
                defaultValue={planner.defaultTaskDurationMinutes}
                required
              />
              <button type="submit" className="task-action" disabled={busy}>
                Thêm vào ngày này
              </button>
            </form>
          )}
          {visibleDays.map((day) => {
            const items = scheduled.filter(
              (task) => localDate(new Date(task.scheduledStart!), planner.timeZone) === day,
            );
            return (
              <section key={day} aria-label={dayLabel(day)} className="calendar-day">
                <h2>{dayLabel(day)}</h2>
                {items.length === 0 ? (
                  <p className="subtitle">Không có khối lịch.</p>
                ) : (
                  <ul className="task-list">
                    {items.map((task) => (
                      <li key={task.id} className="task-item">
                        <div className="task-details">
                          <strong>{task.title}</strong>
                          <span>
                            {timeRange(task.scheduledStart!, task.scheduledEnd!, planner.timeZone)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="task-action"
                          disabled={busy}
                          onClick={() => void unschedule(task)}
                        >
                          Bỏ lịch
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </>
      )}

      <section aria-label="Chưa xếp lịch">
        <h2>Chưa xếp lịch ({unscheduled.length})</h2>
        {unscheduled.length === 0 ? (
          <p className="subtitle">Mọi công việc đang mở đã có lịch.</p>
        ) : (
          <ul className="task-list">
            {unscheduled.map((task) => (
              <li key={task.id} className="task-item">
                <div className="task-details">
                  <strong>{task.title}</strong>
                  <form
                    className="place-form"
                    onSubmit={(event) => void placeManually(task, event)}
                  >
                    <input
                      aria-label={"Giờ bắt đầu " + task.title}
                      name="start"
                      type="datetime-local"
                      required
                    />
                    <input
                      aria-label={"Số phút " + task.title}
                      name="minutes"
                      type="number"
                      min={1}
                      max={1440}
                      defaultValue={task.estimatedMinutes ?? planner.defaultTaskDurationMinutes}
                      required
                    />
                    <button type="submit" className="task-action" disabled={busy}>
                      Xếp giờ
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
