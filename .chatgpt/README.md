# ChatGPT-only Continuity Protocol — DayFlow

**Applies only to ChatGPT acting as operator/coordinator. It is NOT an instruction to Muse/OpenCode.**

OpenCode/Muse independently manages its context, cache, and agent sessions. **Do not** make Muse re-read plans, logs, lessons, or all specs after every step merely to compensate for ChatGPT's context limits. Do not inject this directory into Muse prompts or treat its files as Muse-required input.

## Mandatory ChatGPT workflow
At the start of every new/resumed ChatGPT session, or after context becomes uncertain:
1. Read `.chatgpt/STATE.md` FIRST (compact authoritative checkpoint of all G0–G9).
2. Validate its current branch/commit and the relevant current reality in GitHub and via connected Windows/Linux tooling when available. Do not assume that an old log proves present-day system state.
3. Read only the latest/relevant entries from `.chatgpt/JOURNAL.md` and `.chatgpt/LESSONS.md`, plus specific relevant product/spec docs as needed. Avoid reading entire history unnecessarily.
4. Distinguish **observed evidence**, **user approvals**, **pending approvals**, **hypotheses**, and **blocked tests**.
5. Before operations with side effects, check scope, source-of-truth branch, permissions, backups/rollback, security issues, and whether the action was specifically approved.
6. After each meaningful action or gate substep, update: (a) snapshot of complete project milestones G0–G9 in STATE; (b) concise dated journal entry with action, verification, failures, rollback, next step; (c) LESSONS only when a real new lesson was learned.
7. Verify the files were actually committed/readable on the intended branch. If persistence fails, state that clearly to the user and provide the necessary recovery text instead of claiming it was saved.

## Durability rules
- These are ChatGPT's operator notes, **not Muse memory**.
- Logs are append-only; do not rewrite past facts. Correct mistakes by a new entry and adjust STATE.
- State is an up-to-date summary, not a substitute for verifying live GitHub/Linux facts.
- Always record the current step, known outcomes, open blockers, next safe action and any explicitly forbidden actions.
- Keep private keys, secrets, raw auth tokens, private host details, production contents, user data and internal LAN IPs OUT OF THIS PUBLIC REPOSITORY. Sanitize filenames and hostnames as necessary.
- Never make a step 'PASS' without actual evidence. Use PASS/PARTIAL/BLOCKED/DEFERRED/NOT STARTED with scope.
- Never transfer root credentials or unreviewed autonomous execution privileges to Muse.
- GitHub branch `main` is not to be altered without separate approval.
- ChatGPT should read this short protocol on recovery, but **Muse has no new repeated-read requirement**.

## Truth priority
Live host/tool verification > current Git commit and files > recorded evidence/journal > assistant recollection.
User approval sets scope; logs never imply new approval.
