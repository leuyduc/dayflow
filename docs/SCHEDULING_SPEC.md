# Schedule Suggestion Rules

## Purpose
Offer a transparent draft schedule for eligible unscheduled tasks. The algorithm is deterministic and has no AI or network dependency. Suggestions never change persisted tasks until the user accepts them.

## Inputs
- eligible incomplete tasks
- existing scheduled blocks
- planning window (local start/end)
- working days and daily working hours
- default duration and per-task estimated duration
- buffer minutes between blocks
- current time for same-day planning

## Eligibility
Exclude completed tasks and tasks outside the chosen scope. Tasks with no estimate use the configured default. Tasks already scheduled are treated as fixed obstacles unless the user explicitly chooses to reschedule them.

## Ordering
Use a deterministic priority order:
1. urgent before high, medium, low;
2. earlier due date before later/no due date;
3. stable tie-break by createdAt then ID.
Do not claim this ordering is globally optimal.

## Placement
- Only place blocks within working hours and working days.
- Do not overlap existing blocks or already proposed blocks.
- Respect configured buffer between blocks.
- Do not place a new block in the past.
- Prefer earlier feasible slots; allow a task to move to a later day if no slot fits today.
- A task must fit as one contiguous block in MVP. If it cannot fit in the planning window, report it as unscheduled with a reason.
- Do not schedule beyond a task's due date when an earlier feasible placement exists; if impossible, still provide a visible conflict/warning rather than hiding the task.
- Use local calendar boundaries and convert to the chosen persisted instant representation consistently.

## Output
Return proposed placements plus unscheduled tasks and reason codes such as `no-working-time`, `duration-too-long`, `deadline-conflict`, or `window-ended`. Keep the function pure and deterministic.

## UI flow
1. User chooses a planning date/window and invokes “Suggest schedule”.
2. Show a preview of proposed blocks and tasks that could not be placed.
3. User may accept all or accept/edit/reject individual placements.
4. Validate conflicts again before persisting.
5. Never overwrite existing blocks without explicit user action.

## Tests
Cover ordering, working hours, weekends/non-working days, buffers, overlaps, past time, due dates, long tasks, empty input, exact-fit slots, daylight-saving/local-date boundaries, and deterministic tie-breaking.
