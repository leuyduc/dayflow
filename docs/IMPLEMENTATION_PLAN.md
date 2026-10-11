# Implementation Plan

Work in small, verifiable milestones. Keep the app runnable after each milestone.

## Phase 1 — Foundation
- Scaffold Vite + React + TypeScript, strict mode, Tailwind, lint/format, Vitest.
- Add app shell, navigation, responsive layout, theme tokens and reusable primitives.
- Document package scripts and local setup.

## Phase 2 — Task vertical slice
- Domain types/validation and repository interface.
- Dexie database and repository implementation.
- Quick capture, task list, task detail/edit, complete/reopen/delete.
- Persist and test the complete create → reload → edit → complete flow.

## Phase 3 — Organization
- Today, Inbox/Tasks, search, filters, sorting, overdue indicators.
- Tags, subtasks, priority, due dates and estimates.
- Empty/error/loading states and keyboard interactions.

## Phase 4 — Calendar
- Day/week/month views and navigation.
- Render scheduled tasks, create from time slot, reschedule with validation.
- Accessible alternative to drag-and-drop; responsive agenda on narrow screens.

## Phase 5 — Schedule suggestions
- Pure deterministic scheduling function with comprehensive unit tests.
- Preview, unscheduled reasons, per-task accept/edit/reject.
- Revalidate conflicts before persisting accepted placements.

## Phase 6 — Settings and portability
- Working hours/days, duration, buffer and week start.
- Versioned JSON export; validated import preview; transactional merge/replace.

## Phase 7 — Quality and finish
- Polish visual hierarchy, responsiveness and accessibility.
- Add critical Playwright flows if available.
- Run lint, typecheck, tests, build; fix issues.
- Complete README with architecture, setup, scripts, limitations and data-privacy explanation.

## Prioritization rule
If time or environment limits arise, complete the core task vertical slice and local persistence first, then calendar, then scheduling and backup/restore. Never leave the repository in a non-building state knowingly; record any remaining limitation.
