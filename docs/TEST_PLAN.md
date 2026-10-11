# Test Plan

## Domain unit tests
- Task validation and title normalization.
- Complete/reopen behavior and timestamps.
- Scheduled start/end invariants.
- Due date remains independent of schedule.
- Backup schema validation and unsupported versions.
- Scheduling determinism, ordering, boundaries, buffers, overlap avoidance, non-working days, deadlines, unschedulable reasons.

## Persistence tests
- Create/read/update/delete task through repository.
- Data survives app reload (browser integration).
- Schema migration behavior.
- Import is transactional; invalid import leaves existing data unchanged.
- Merge/replace conflict policy is consistent.

## UI/component tests
- Quick capture creates task and clears input on success.
- Task edit validation and cancel/save behavior.
- Complete/reopen updates view.
- Search/filter/sort.
- Calendar navigation and reschedule validation.
- Schedule preview does not persist until accepted.
- Backup export and import preview/confirmation.
- Loading, empty, and error states.

## Critical end-to-end flows
1. First launch → create task → refresh → task remains.
2. Edit task details → mark complete → reopen.
3. Navigate calendar → create/reschedule task → verify no overlap.
4. Generate schedule suggestions → reject one → accept another → verify only accepted placement saved.
5. Export backup → clear test data or use isolated browser context → import backup → verify records restored.
6. Try malformed backup → see error and verify current data unchanged.

## Release gates
Run and report:
- formatter/linter
- TypeScript typecheck
- unit/component tests
- production build
- E2E tests if supported

Do not claim a check passed if it was not executed. Document any unavailable tool or failing check.
