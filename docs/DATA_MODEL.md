# Data Model and Backup Format

## Entities

### Task
- id: string (UUID)
- title: string
- description?: string
- status: `inbox | scheduled | completed`
- priority: `low | medium | high | urgent`
- dueDate?: `YYYY-MM-DD`
- estimatedMinutes?: number
- scheduledStart?: ISO string
- scheduledEnd?: ISO string
- tags: string[]
- subtasks: { id: string; title: string; completed: boolean }[]
- createdAt: ISO string
- updatedAt: ISO string
- completedAt?: ISO string

### Settings
- workingDays: weekday numbers
- workingDayStart: local time `HH:mm`
- workingDayEnd: local time `HH:mm`
- defaultTaskDurationMinutes: positive integer
- bufferMinutes: non-negative integer
- weekStartsOn: weekday number
- theme: `system | light | dark` (optional if theme support is implemented)

Keep the persisted schema normalized enough to migrate, but do not create unnecessary tables for an MVP.

## Backup JSON
Use a documented envelope:
```json
{
  "format": "dayflow-backup",
  "version": 1,
  "exportedAt": "ISO timestamp",
  "tasks": [],
  "settings": {}
}
```

## Import rules
- Parse and validate the whole file before writing.
- Reject unsupported format/version, malformed fields, duplicate IDs where unsafe, oversized files, invalid dates, and invalid schedule ranges.
- Present a preview with counts (tasks/settings) and ask the user to confirm.
- Offer a clear default strategy, preferably merge by ID with an explicit duplicate policy; provide replace-all only with a strong confirmation.
- Apply mutations transactionally so partial imports do not leave the database corrupted.
- On failure, preserve the previous data and explain the error.
- Never import executable content or trust file-provided HTML.
