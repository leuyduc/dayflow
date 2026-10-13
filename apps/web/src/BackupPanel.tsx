import { useState, type ChangeEvent } from "react";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  parseBackup,
  type BackupFile,
  type BackupSettings,
} from "@dayflow/domain";
import type { PlannerSettings } from "./SettingsPanel";
import type { TaskItem } from "./TaskWorkspace";

type Preview = { backup: BackupFile; existingIds: Set<string> };

async function fetchTasks(): Promise<TaskItem[]> {
  const response = await fetch("/api/sync/bootstrap", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Không tải được dữ liệu hiện tại. Hãy kiểm tra kết nối.");
  return ((await response.json()) as { tasks: TaskItem[] }).tasks;
}

async function fetchBackupSettings(): Promise<BackupSettings> {
  const response = await fetch("/api/settings", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Không tải được cài đặt đã lưu. Hãy kiểm tra kết nối.");
  const body = (await response.json()) as { settings?: PlannerSettings };
  const settings = body.settings;
  if (!settings) throw new Error("Máy chủ không trả về cài đặt lịch.");
  return {
    timeZone: settings.timeZone,
    workingDays: settings.workingDays,
    workingDayStart: settings.workingDayStart,
    workingDayEnd: settings.workingDayEnd,
    defaultTaskDurationMinutes: settings.defaultTaskDurationMinutes,
    bufferMinutes: settings.bufferMinutes,
    weekStartsOn: settings.weekStartsOn,
    theme: settings.theme,
  };
}

export function BackupPanel({
  csrfToken,
  onImported,
}: {
  csrfToken: string;
  onImported?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);

  async function exportBackup() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const [tasks, settings] = await Promise.all([fetchTasks(), fetchBackupSettings()]);
      const exportedAt = new Date().toISOString();
      const file: BackupFile = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt,
        settings,
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          estimatedMinutes: task.estimatedMinutes,
          scheduledStart: task.scheduledStart ?? null,
          scheduledEnd: task.scheduledEnd ?? null,
          tags: task.tags,
          subtasks: task.subtasks ?? [],
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          completedAt: task.completedAt,
        })),
      };
      const serialized = JSON.stringify(file, null, 2);
      const validation = parseBackup(serialized);
      if (!validation.ok) {
        throw new Error(
          "Không thể xuất bản sao lưu có thể nhập lại: " + validation.errors.join(" "),
        );
      }
      const url = URL.createObjectURL(new Blob([serialized], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `dayflow-backup-${exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(`Đã xuất ${file.tasks.length} công việc.`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể xuất sao lưu.");
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPreview(null);
    setError("");
    setNotice("");
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed.ok) {
      setError(parsed.errors.join(" "));
      return;
    }
    try {
      const existing = await fetchTasks();
      setPreview({
        backup: parsed.backup,
        existingIds: new Set(existing.map((task) => task.id)),
      });
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể kiểm tra dữ liệu hiện tại.");
    }
  }

  async function importPreview() {
    if (!preview || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/backup/import", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-Dayflow-CSRF": csrfToken },
        body: JSON.stringify(preview.backup),
      });
      if (response.status === 409) {
        throw new Error(
          "Không nhập được vì lịch trong tệp trùng với lịch đang có. Chưa ghi thay đổi nào.",
        );
      }
      if (!response.ok) throw new Error("Không thể nhập dữ liệu.");
      const result = (await response.json()) as { imported: number; skipped: number };
      setPreview(null);
      onImported?.();
      setNotice(
        `Đã nhập ${result.imported} công việc.` +
          (result.skipped > 0 ? ` Bỏ qua ${result.skipped} công việc đã tồn tại (trùng ID).` : "") +
          " Đã áp dụng cài đặt lịch trong tệp.",
      );
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Không thể nhập dữ liệu.");
    } finally {
      setBusy(false);
    }
  }

  const newCount = preview
    ? preview.backup.tasks.filter((task) => !preview.existingIds.has(task.id)).length
    : 0;

  return (
    <section aria-label="Sao lưu và nhập dữ liệu">
      <div className="message-card">
        <div>
          <h2>Xuất sao lưu</h2>
          <p>Tải về toàn bộ công việc đang có dưới dạng tệp JSON có phiên bản.</p>
          <button
            type="button"
            className="task-action"
            disabled={busy}
            onClick={() => void exportBackup()}
          >
            Xuất sao lưu JSON
          </button>
        </div>
      </div>

      <div className="message-card">
        <div>
          <h2>Nhập từ sao lưu</h2>
          <p>
            Công việc đã có cùng ID sẽ được bỏ qua, không bị ghi đè. Nhập là một giao dịch: nếu lịch
            bị trùng hoặc việc ghi lỗi, không có thay đổi nào được lưu. Cài đặt lịch trong tệp sẽ
            thay thế cài đặt lịch hiện tại (kể cả khi không có công việc mới).
          </p>
          <label htmlFor="backup-file">Chọn tệp sao lưu (.json)</label>
          <input
            id="backup-file"
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => void chooseFile(event)}
          />
          {preview && (
            <div className="edit-actions">
              <p>
                Tệp có {preview.backup.tasks.length} công việc: {newCount} mới,{" "}
                {preview.backup.tasks.length - newCount} đã tồn tại (sẽ bỏ qua).
              </p>
              <button
                type="button"
                className="task-action"
                disabled={busy}
                onClick={() => void importPreview()}
              >
                {newCount === 0 ? "Chỉ khôi phục cài đặt lịch" : `Nhập ${newCount} công việc`}
              </button>
              <button
                type="button"
                className="task-action"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="task-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
