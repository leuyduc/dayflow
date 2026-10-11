# Architecture

## Stack
- React + TypeScript + Vite
- Tailwind CSS with accessible reusable UI primitives
- Dexie over IndexedDB for local persistence
- FullCalendar or an equivalent calendar library with day/week/month support; evaluate mobile usability before committing
- date-fns (or an equivalent small date utility) with explicit local-time handling
- Vitest and React Testing Library; Playwright for critical browser flows when available

Use current stable compatible versions and commit the lockfile.

## Architectural shape
Keep a modular monolith in the frontend, with clear boundaries:

- `src/app/`: app bootstrap, routes/layout, global providers.
- `src/features/tasks/`: task UI, forms, list/filter behavior.
- `src/features/calendar/`: calendar views and drag/reschedule interactions.
- `src/features/scheduling/`: scheduling preview and controls.
- `src/features/backup/`: export/import UI and validation.
- `src/features/settings/`: preferences.
- `src/domain/`: entities, value types, validation, scheduling algorithm, pure rules.
- `src/application/`: use cases/orchestration and ports.
- `src/infrastructure/db/`: Dexie schema and repositories.
- `src/shared/`: reusable UI, date helpers, error handling.

Adapt names to the framework conventions, but preserve dependency direction.

## Dependency rules
- Domain code must not import React, Dexie, browser UI, or calendar library modules.
- UI calls application use cases; it should not directly manipulate IndexedDB tables.
- Repositories implement interfaces defined at the application/domain boundary.
- Scheduling algorithm is a pure deterministic function given tasks, calendar blocks, settings, and a planning window.
- Validate imported JSON at the boundary before any database mutation.

## Persistence
Use a versioned Dexie database. Define migrations when the schema changes. Keep repository operations typed. Use transactions for multi-record operations and import replacement/merge. Handle database errors visibly; do not silently pretend a write succeeded.

## Quality
TypeScript strict mode, ESLint, formatter, unit tests for domain rules, component tests for important interactions, and browser tests for core flows. Avoid overengineering: no backend, state-management framework, or dependency injection container unless the codebase demonstrates a concrete need.
