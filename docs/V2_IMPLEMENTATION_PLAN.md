# DayFlow V2 — Gate-by-Gate Execution and Acceptance

Status: specification only. No code/installation/deployment until G0 accepted.
Never mark gates PASS without actual commands/logs/screenshots. No self-merging to main.

## Branching and change controls
- V1 specifications are retained on prompt/agent-bootstrap.
- Design branch: design/linux-fullstack-v2 (this branch), based on prompt/agent-bootstrap.
- After design acceptance, a dedicated feat/fullstack-foundation branch should be created from the approved V2 spec base; no agent writes to main.
- Future work goes through small PRs; protect main (reviews, required CI). Only human/operator approves deployment.
- All files reviewed before commit, never commit keys, passwords, .env, DB dumps or secrets.

## Gates
G0 — Linux environment and access AUDIT ONLY
Deliver: versioned OS/resource/port/workload inventory, existing access, exact OpenCode command available, resource risk, isolation feasibility, deployment recommendation and list of blockers; no changes.
PASS: audited facts, secrets redacted, operator accepts the plan.

G1 — Hardening and workspace separation
Implement restricted developer, SSH-key access/tunnel, safe OpenCode, distinct dev/prod boundaries, staging/test DB approach, repo checkout and least-privilege GitHub access. Host configuration changes must be individually approved and must avoid service disruption.
PASS: negative tests demonstrate developer cannot access prod files/secrets/db/deploy; OpenCode port not public; SSH recovery verified.

G2 — Full-stack foundation
Monorepo apps/web, apps/api, packages/domain, contracts, infra and tests. Versioned config, lint/format/type/test/build, DB migration tooling, API health endpoint and basic shell. Separate dev/test Compose only after security checks.
PASS: all reproducible commands pass, browser UI and API health work in dev.

G3 — Identity + authoritative persistence
Single-owner bootstrap, Argon2id password, session cookie security, ownership checks, Postgres migrations, server-side CRUD/validation and settings. No public signup.
PASS: auth/CSRF/rate-limit/authorization tests, database transaction tests, login/logout flows, API integration tests.

G4 — Task domain and web UX
Quick capture, complete/reopen/delete, details, Today/Inbox/Upcoming/Completed/All, filters/search/tags/subtasks, optimistic UX with server persistence.
PASS: create/edit/reload from server, validation, keyboard and mobile flows.

G5 — Two-device ONLINE sync
Shared revision semantics, mutation IDs, cursor change log, delete tombstones, conflict response, initial bootstrap and A/B device reconciliation.
PASS: simulate A/B edits, retry, conflict, deletion, reconnect, cross-account isolation; no data loss.

G6 — Calendar and deterministic schedule suggestions
Day/week/month, reschedule with conflict checks, deterministic pure scheduling, dueDate versus scheduled time, timezone/DST tests, preview/accept/reject.
PASS: full domain and UI tests, no silent overlap or write prior to acceptance.

G7 — Reliable offline-first behavior
Dexie cache/outbox, PWA/service worker only if appropriate, offline edits, retry/idempotency, explicit conflict UI, logout safeguards.
PASS: airplane mode edit, restart, reconnect, simultaneous device edits and error recovery with no silent data loss.

G8 — Settings, import/export and data safety
User settings/timezone, JSON backup validation + preview + merge/replace confirmation, transactional import, DB encrypted offsite backups and restore verification.
PASS: invalid import does not alter data, successful import syncs, restore drill produces verified records.

G9 — Release readiness and controlled deploy
Security checklist, full E2E, accessibility, responsive screenshots, monitoring/alerts, TLS, staging acceptance, approved migration, rollback/runbook, CI, production deploy with human approval.
PASS: documented evidence links, reviewed production release, health checks and backup/restore readiness; no critical known defects.

## Engineering and reporting rules for every gate
- Before modifications: git branch/status, inspect existing code, reproduce baseline.
- Implement one coherent slice; use feature branch and meaningful commits.
- Run actual format check, lint, typecheck, tests, production build; use isolated test DB and Playwright when applicable.
- Include exact commands, logs PASS/FAIL/BLOCKED, screenshots where relevant, commit SHA, files changed, remaining risks.
- Gate is COMPLETE only after operator acceptance; Muse must stop at gate boundary.
- Never run production commands, modify firewall/SSH settings, generate live credentials, migrate production schema, force-push, merge to main or expose ports without explicit scoped approval.

## Current handoff (2026-10-13)
**Active consolidated roadmap:** `docs/V2_ACTIVE_MASTER_PLAN_20261013.md`. Use it and `.chatgpt/STATE.md` for actual Gate statuses and the order of remaining work; older handoff snippets and OpenCode/Muse references are historical.

The live checkpoint is `.chatgpt/STATE.md`, with the 2026-10-13 journal entry. Read that file before this section.

Short version: active Windows checkout `D:\projects\dayflow`, branch `feat/g5-online-sync` at `2cae801`, dirty and uncommitted. G0 audited; G1 NOT PASSED (G1-A and G1-C). G2–G6 and JSON/settings part of G8 are coded. ESLint, TypeScript, 103 unit tests and build PASS; G6/G8 and extended G7 offline CRUD + conflict Chrome→Fastify→isolated PostgreSQL E2E PASS. G7 production PWA static-shell offline navigation/reload PASS without private API caching (see `docs/V2_G7_EXPANDED_OFFLINE_PWA_QA_20261013.md`; earlier create-only evidence is historical). Full-repo Prettier PASS. G8 offsite DB backup/restore not drilled. G7 remains partial because secure owner reauthentication after cold offline reload and further multi-tab/eviction/security tests remain; G9 not started. Full npm audit still flags 7 development-tool advisories, production-only audit PASS. Do not commit, push, merge, deploy or touch Linux production without separate approval. OpenCode/Muse is not the coder.

The 2026-10-12 handoff below is historical and is not the next action:

G0 has been audited. G1-B restricted-account SSH access partially passed, but overall G1 is NOT accepted: the exposed old root key is still authorized (G1-A deferred), and G1-C production isolation remains unverified. At that date the next approved work was only the G1-C isolation plan, not application coding.

**Context discipline:** `.chatgpt/` is an operator recovery record. Do not treat a green unit test as gate acceptance.
