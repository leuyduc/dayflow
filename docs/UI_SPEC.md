# UI Specification

## Overall
Calm, modern productivity UI with clear typography, compact but comfortable spacing, restrained accent color, strong contrast, and responsive behavior. Avoid decorative dashboards that obscure tasks. Include a visible app title and a consistent primary “Add task” action.

## Today
- Date heading and clear navigation to previous/next day and today.
- List of scheduled tasks ordered by start time.
- Unscheduled/overdue tasks surfaced in a separate section.
- Quick-add field or modal that accepts a title immediately.
- Useful empty state with a direct create action.

## Tasks / Inbox
- Quick capture, searchable list, status/priority/date/tag filters, sort controls.
- Task row displays title, completion control, priority, due date, duration and scheduled time when relevant.
- Clicking a row opens an edit/detail panel without losing list context.
- Support keyboard submission and visible focus states.

## Task detail/form
- Title, description, priority, due date, estimated duration, tags, subtasks, scheduled start/end.
- Inline validation and clear save/cancel behavior.
- Distinguish deadline from planned time.
- Prevent accidental closing when there are unsaved changes, or make saving immediate and explicit.

## Calendar
- Day/week/month navigation and “Today” action.
- Show task title and readable time labels; provide accessible alternative to drag-and-drop.
- Selecting an empty slot can start task creation with the selected time prefilled.
- Rescheduling validates conflicts and gives visible feedback.
- Month view opens a selected day when space is constrained.

## Schedule preview
- Clearly label as suggestions, not saved schedule.
- Show proposed blocks and unplaced tasks/reasons.
- Allow accept/edit/reject before writing changes.

## Settings and backup
- Working days/hours, default duration, buffer, week start.
- Export backup action.
- Import file action with validation and preview before confirmation.

## Accessibility and responsive behavior
- Semantic headings, labels, buttons, dialog names, keyboard navigation, focus indicators, sufficient contrast.
- Never rely on color alone to convey priority/status.
- Mobile layout must preserve quick capture and basic task/calendar navigation; calendar can use a simplified agenda on narrow screens.
