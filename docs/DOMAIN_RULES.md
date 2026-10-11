# Domain Rules

## Task
Required: stable ID, non-empty trimmed title, status, priority, createdAt, updatedAt.
Optional: description, dueDate, estimatedMinutes, scheduledStart, scheduledEnd, tags, subtasks, completedAt.

Suggested types:
- Status: `inbox | scheduled | completed`
- Priority: `low | medium | high | urgent`
- estimatedMinutes: positive integer, bounded to a sensible maximum (e.g. 24 hours).
- dueDate: date-only value (`YYYY-MM-DD`) because it represents a calendar date, not an instant.
- scheduledStart/scheduledEnd: ISO instants or consistently modeled local date-time values; use one strategy throughout and document it.
- Tags are trimmed, normalized, unique strings.
- Completed tasks retain their details and can be reopened.

## Invariants
- Title cannot be empty after trimming.
- End must be after start.
- Scheduled tasks require both start and end; duration must be positive.
- If estimated duration exists, it must be positive.
- Completing a task records completedAt; reopening clears completedAt.
- Updating a task refreshes updatedAt.
- A task deadline does not automatically create a calendar block.
- Rescheduling must not silently overwrite another task's block.
- Deleting a task requires confirmation or a reversible undo.

## Date/time handling
- Store instants in ISO format and date-only fields separately.
- Render in the user's local time zone.
- Avoid parsing `YYYY-MM-DD` as UTC and then rendering it as local time.
- Cover daylight-saving transitions where relevant.
- Inject a clock into logic that needs “now” so tests are deterministic.

## Validation and errors
Return actionable validation errors for invalid forms/imports. Keep validation reusable outside React components. Treat imported content as untrusted input and cap unreasonable lengths/counts.
