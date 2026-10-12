> **WORKFLOW OVERRIDE 2026-10-12:** Direct ChatGPT implementation replaces OpenCode/Muse coding. The user requires a GitHub checkpoint update and re-read **after every logical step** (see `docs/CHATGPT_EXECUTION_PROTOCOL.md`). Historical agent references below are no longer executable instructions. G1 production security remains blocked.

# DayFlow V2 — Approved Product and Architecture Decisions
Status: DESIGN APPROVED IN PRINCIPLE; IMPLEMENTATION NOT AUTHORIZED until Gate G0 review.
Authority: This document, V2_ARCHITECTURE.md, V2_SYNC_PROTOCOL.md, V2_INFRA_SECURITY.md and V2_IMPLEMENTATION_PLAN.md take precedence over V1 docs whenever inconsistent. Preserve V1 task UX, scheduling domain rules, accessibility and testing goals where not superseded.

## New deployment model
- Windows is a development/operator workstation. ChatGPT codes directly through approved tools; Muse/OpenCode is retired.
- A Linux host serves the DayFlow website and backend. The production database is PostgreSQL.
- A single owner account can sign in on multiple devices and sync tasks/settings. Do NOT provide public self-registration in MVP.
- The server is authoritative for persisted synchronized records. Browser Dexie/IndexedDB is a local cache and, at the appropriate gate, a durable outbox for offline changes.
- Production and ChatGPT development tools remain separate trust zones. Coding execution MUST NOT have access to production secrets/database, deployment credentials, privileged container daemon or Docker socket.

## Preserved product functionality
Quick capture, task CRUD, Today/Inbox/Upcoming/Completed/All, search/filter/sort, due dates, priority, subtasks, tags, estimated duration, calendar day/week/month, deterministic schedule proposals with explicit acceptance, settings, JSON export/import and accessible responsive UI.

## Changes from V1
- V1 local-only and 'no account/backend/cloud sync' restrictions are superseded.
- Login/security, API, PostgreSQL, server-side authorization, sync and migrations are in scope.
- No AI assistant is embedded in the DayFlow product. Muse is only a development agent.
- No billing, team collaboration, public signup, external calendar integrations, complex recurrence or multi-user collaboration in MVP.
- Do not claim full offline support until tested PWA/cache and mutation outbox are implemented.
- Do not claim backups work solely because PostgreSQL has a volume; off-host encrypted backups and restoration drills are required before launch.

## Time and business rules
- Persist instants in UTC ISO 8601; dueDate remains YYYY-MM-DD and is not converted into an instant.
- Persist an IANA planning timezone on owner settings; day boundaries, working hours and deadline rules are interpreted in that zone across devices.
- Inject clock into deterministic domain logic. DST transitions and timezone-change scenarios need explicit tests.
- scheduled task requires both start/end and no overlap unless an explicit user-approved exceptional flow exists.
- In automatic suggestions, if placement cannot meet the dueDate, report deadline-conflict rather than silently placing after the deadline. A deliberate manual override may be supported with a clear warning.
- Existing V1 scheduling priorities/order apply unless an explicit V2 test changes them.

## Release posture
Plan/design branch is documentation only. No server commands, installation, production changes or code implementation as part of the design deliverable. G0 audits the Linux environment before choosing exact versions and deployment tooling.
