# DayFlow V2 — ChatGPT Lessons Learned (append only)

**Applies only to ChatGPT's coordination and recovery, not Muse/OpenCode context or cache management.**
Capture concrete mistakes/causes/preventive checks; no need to invent a lesson if none arose.

## 2026-10-12 — Never trust plan status without live verification
Observed: Linux carried many existing services, open listening ports and container workloads. It was not an empty VPS.
Lesson: Audit real service/port/resource state before proposing any installs or port allocations; never treat documentation as live evidence.

## 2026-10-12 — SSH host identity before enabling automation
Observed: SSH host fingerprint was checked against a trusted Linux console before strict host-key login.
Lesson: Never use `StrictHostKeyChecking=no` or blindly add unknown host keys. Separate operator SSH root key from developer SSH key.

## 2026-10-12 — Avoid brittle shell transport and validator assumptions
Observed: PowerShell-to-SSH quoting/CRLF and interpretation of `sshd -T` multi-value `allowusers` caused aborted checks/rollback despite a valid proposed SSH configuration.
Lesson: Prefer minimal, inspectable scripts with explicit exit codes; parse tool output semantically rather than relying on a single exact string; verify effective policy and service health before/after every modification. Errors must be reported; rollback should preserve access.

## 2026-10-12 — Partial gates are not full security acceptance
Observed: Account creation and fresh SSH login succeeded, but negative privilege tests were blocked and an exposed old root key remains authorized.
Lesson: Mark G1-B PARTIAL, G1 overall NOT PASSED, and prevent autonomous Muse from accessing production even if developer account login works.

## 2026-10-12 — Distinguish ChatGPT context from Muse context
Observed: ChatGPT conversation/runtime context can be lost or compacted; Muse runs in OpenCode, which manages its own session/context.
Lesson: Store checkpoint, journal and lessons in `.chatgpt/`; each ChatGPT session rereads the concise state and verifies live progress. **Do not impose repeated full-document reads or external cache synchronization on Muse**, and do not spend Muse tokens on ChatGPT recovery.
