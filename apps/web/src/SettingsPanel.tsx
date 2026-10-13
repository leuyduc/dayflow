import { useEffect, useState } from "react";

export type PlannerSettings = {
  timeZone: string;
  workingDays: number[];
  workingDayStart: string;
  workingDayEnd: string;
  defaultTaskDurationMinutes: number;
  bufferMinutes: number;
  weekStartsOn: number;
  theme: "system" | "light" | "dark";
  revision: number;
};

const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function applyTheme(theme: PlannerSettings["theme"]) {
  document.documentElement.dataset.theme = theme;
}

export function SettingsPanel({ csrfToken }: { csrfToken: string }) {
  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/settings", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không tải được cài đặt.");
        const body = (await response.json()) as { settings: PlannerSettings };
        if (!active) return;
        setSettings(body.settings);
        applyTheme(body.settings.theme);
      })
      .catch(() => {
        if (active) setError("Không tải được cài đặt. Hãy kiểm tra kết nối.");
      });
    return () => {
      active = false;
    };
  }, []);

  function update(patch: Partial<PlannerSettings>) {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  }

  async function save() {
    if (!settings || busy) return;
    if (settings.workingDays.length === 0) {
      setError("Chọn ít nhất một ngày làm việc.");
      return;
    }
    if (settings.workingDayStart >= settings.workingDayEnd) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Dayflow-CSRF": csrfToken },
        body: JSON.stringify({
          expectedRevision: settings.revision,
          timeZone: settings.timeZone.trim(),
          workingDays: settings.workingDays,
          workingDayStart: settings.workingDayStart,
          workingDayEnd: settings.workingDayEnd,
          defaultTaskDurationMinutes: settings.defaultTaskDurationMinutes,
          bufferMinutes: settings.bufferMinutes,
          weekStartsOn: settings.weekStartsOn,
          theme: settings.theme,
        }),
      });
      const body = (await response.json()) as { settings?: PlannerSettings; error?: string };
      if (response.status === 409 && body.settings) {
        setSettings(body.settings);
        applyTheme(body.settings.theme);
        throw new Error("Cài đặt vừa được sửa ở nơi khác. Biểu mẫu đã được tải lại.");
      }
      if (!response.ok || !body.settings) throw new Error("Không lưu được cài đặt.");
      setSettings(body.settings);
      applyTheme(body.settings.theme);
      setNotice("Đã lưu cài đặt.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không lưu được cài đặt.");
    } finally {
      setBusy(false);
    }
  }

  if (!settings) return <p role="status">{error || "Đang tải cài đặt..."}</p>;

  return (
    <form
      className="edit-panel"
      aria-label="Cài đặt lịch"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <h2>Lịch làm việc</h2>
      <label htmlFor="settings-zone">Múi giờ</label>
      <input
        id="settings-zone"
        value={settings.timeZone}
        onChange={(event) => update({ timeZone: event.target.value })}
        required
      />
      <fieldset className="day-picks">
        <legend>Ngày làm việc</legend>
        {dayNames.map((name, index) => (
          <label key={name}>
            <input
              type="checkbox"
              checked={settings.workingDays.includes(index)}
              onChange={(event) => {
                const workingDays = event.target.checked
                  ? [...settings.workingDays, index].sort((a, b) => a - b)
                  : settings.workingDays.filter((day) => day !== index);
                update({ workingDays });
              }}
            />
            {name}
          </label>
        ))}
      </fieldset>
      <label htmlFor="settings-start">Giờ bắt đầu</label>
      <input
        id="settings-start"
        type="time"
        value={settings.workingDayStart}
        onChange={(event) => update({ workingDayStart: event.target.value })}
        required
      />
      <label htmlFor="settings-end">Giờ kết thúc</label>
      <input
        id="settings-end"
        type="time"
        value={settings.workingDayEnd}
        onChange={(event) => update({ workingDayEnd: event.target.value })}
        required
      />
      <label htmlFor="settings-duration">Thời lượng mặc định (phút)</label>
      <input
        id="settings-duration"
        type="number"
        min={1}
        max={1440}
        value={settings.defaultTaskDurationMinutes}
        onChange={(event) => update({ defaultTaskDurationMinutes: Number(event.target.value) })}
        required
      />
      <label htmlFor="settings-buffer">Nghỉ giữa các khối (phút)</label>
      <input
        id="settings-buffer"
        type="number"
        min={0}
        max={1440}
        value={settings.bufferMinutes}
        onChange={(event) => update({ bufferMinutes: Number(event.target.value) })}
        required
      />
      <label htmlFor="settings-week">Tuần bắt đầu vào</label>
      <select
        id="settings-week"
        value={settings.weekStartsOn}
        onChange={(event) => update({ weekStartsOn: Number(event.target.value) })}
      >
        {dayNames.map((name, index) => (
          <option key={name} value={index}>
            {name}
          </option>
        ))}
      </select>
      <label htmlFor="settings-theme">Giao diện</label>
      <select
        id="settings-theme"
        value={settings.theme}
        onChange={(event) => update({ theme: event.target.value as PlannerSettings["theme"] })}
      >
        <option value="system">Theo hệ thống</option>
        <option value="light">Sáng</option>
        <option value="dark">Tối</option>
      </select>
      {error && (
        <p role="alert" className="task-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="edit-actions">
        <button type="submit" disabled={busy}>
          Lưu cài đặt
        </button>
      </div>
    </form>
  );
}
