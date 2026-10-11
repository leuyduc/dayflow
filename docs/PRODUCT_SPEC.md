# DayFlow — Product Specification

## Vision
A personal planner that makes it easy to get tasks out of one's head, understand what needs attention, and arrange work realistically without requiring an account or AI.

## Target user and core jobs
- Capture a task in seconds.
- Add context, due date, priority, estimate, notes, and optional subtasks.
- See commitments by day/week/month and in a simple task list.
- Turn unscheduled tasks into a proposed plan, then edit that plan manually.
- Keep data private and portable through local storage and backup files.

## MVP scope
1. **Task capture and management**: create, view, edit, complete/reopen, delete with confirmation, search, and filter.
2. **Task properties**: title (required), description/notes, status, priority, due date, estimated duration, tags, optional scheduled start/end, created/updated timestamps.
3. **Organization**: Inbox/unscheduled tasks, Today, upcoming, completed, and all tasks; sort and filter by status, priority, date, and tag.
4. **Calendar**: day, week, and month views; navigate dates; show scheduled tasks; create or reschedule by selecting a slot or editing details. Month view should remain readable and allow opening a day.
5. **Schedule suggestions**: propose placements for eligible unscheduled tasks inside a user-selected planning window, respecting duration, working hours, existing scheduled items, priority, due dates, and buffers. Suggestions are previews until accepted. User can adjust or reject each placement.
6. **Local persistence**: IndexedDB, schema versioning, robust empty/error states.
7. **Backup/restore**: export a versioned JSON file; import with validation, preview/confirmation, and clear conflict strategy. Invalid files must not damage existing data.
8. **Settings**: working hours, default task duration, scheduling buffer, week start, theme if feasible.
9. **Responsive and accessible UI**: desktop-first but usable on mobile; keyboard-operable controls and visible focus.

## Explicitly out of scope
Accounts, server/cloud sync, multi-user collaboration, AI assistants, billing, notifications requiring a backend, team/project management, external integrations, and complex recurrence rules.

## UX principles
- Fast capture is the primary action and must be reachable from every main view.
- Prefer calm visual hierarchy, generous spacing, readable typography, restrained color, and low visual noise.
- Do not hide important task information behind excessive clicks.
- Distinguish due date (deadline) from scheduled time (planned work block).
- Always communicate whether a schedule is a suggestion or an accepted commitment.
- Use undo or confirmation for destructive operations where practical.

## Main navigation
- Today
- Inbox / Tasks
- Calendar
- Settings

## Success criteria
- A user can create and complete a task without leaving the current view.
- Refreshing/reopening the app preserves data.
- Calendar navigation and task rescheduling behave predictably across time zones.
- Suggested placements are deterministic, explainable, editable, and never silently overwrite existing scheduled blocks.
- Backup can be exported and restored without a network connection.
