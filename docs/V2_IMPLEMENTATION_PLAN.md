> **WORKFLOW OVERRIDE 2026-10-12:** Direct ChatGPT implementation replaces OpenCode/Muse coding. The user requires a GitHub checkpoint update and re-read **after every logical step** (see `docs/CHATGPT_EXECUTION_PROTOCOL.md`). Historical agent references below are no longer executable instructions. G1 production security remains blocked.

# DayFlow V2 — Gate-by-Gate Execution and Acceptance

Status: V2 gated plan. G2–G5 development was separately authorized off-production. ChatGPT now codes directly. Production Linux G1 restrictions remain.
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
Implement restricted developer access, safe SSH credentials and isolation (NO OpenCode), distinct dev/prod boundaries, staging/test DB approach, repo checkout and least-privilege GitHub access. Host configuration changes must be individually approved and must avoid service disruption.
PASS: negative tests demonstrate developer cannot access prod files/secrets/db/deploy; SSH recovery verified and production access not exposed.

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
- Before EACH logical step: re-fetch latest GitHub STATE and source branch HEAD; inspect scope, current code and test baseline.
- Implement one coherent slice; use feature branch and meaningful commits.
- Run actual format check, lint, typecheck, tests, production build; use isolated test DB and Playwright when applicable.
- Include exact test logs PASS/FAIL/BLOCKED, final SHA and risks; after EACH logical step persist STATE/JOURNAL and re-fetch/read committed checkpoint + code HEAD.
- Gate is COMPLETE only after operator acceptance; ChatGPT stops at the human acceptance boundary.
- Never run production commands, modify firewall/SSH settings, generate live credentials, migrate production schema, force-push, merge to main or expose ports without explicit scoped approval.

## Current handoff (2026-10-12)
G0 has been audited. G1-B restricted-account SSH access partially passed, but overall G1 is NOT accepted: the exposed old root key is still authorized (G1-A deferred), and G1-C production isolation remains unverified. Next approved work is only the explicitly scoped G1-C isolation plan/checks, not OpenCode installation, autonomous Muse operation or application coding.

**Context discipline:** `.chatgpt/` is an operator-only recovery record for ChatGPT. ChatGPT is the sole implementer; re-fetch/commit/re-read the checkpoint after EVERY logical step. This does not relax normal project inspection or verification when actually needed.
