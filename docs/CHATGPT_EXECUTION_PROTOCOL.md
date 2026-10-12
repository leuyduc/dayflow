# DayFlow V2 — ChatGPT Direct Execution & Durable Context Protocol

Effective: 2026-10-12. **Direct user decision:** ChatGPT takes over ALL planning, programming, testing, QA, GitHub operations and project coordination. **Muse/OpenCode is removed from the active workflow**: do not delegate coding, run/install Muse, or manage a separate agent cache. Historical mentions remain evidence only.

## Authority and responsibilities
- Owner: approves scope/Gates, merges to main, infrastructure/security changes and production releases.
- ChatGPT: single implementer using directly available GitHub/local development tools; verifies its own work independently through tests/CI.
- GitHub: durable code, documents, checkpoint, SHA/PR/CI evidence; conversation memory is NOT an authoritative source.
- Active V2 product, architecture, synchronization and security rules remain intact. Explicit user decisions supersede older documentation.

## Mandatory context loop BEFORE and AFTER *each logical step*
A **step** is one bounded verifiable code slice, bug fix, migration, related QA, PR operation, planning milestone or Gate substep — not each terminal command.

1. **BEFORE:** fetch `.chatgpt/STATE.md` from `design/linux-fullstack-v2`, target feature branch HEAD/PR/CI, relevant latest `.chatgpt/JOURNAL.md` and `.chatgpt/LESSONS.md` excerpts and task-specific V2 docs/source. Check human approval, current Gate, exact SHA, risks and rollback.
2. **IN_PROGRESS if long/risky:** record active step, expected baseline SHA, constraints and recovery action in STATE before substantive work.
3. **IMPLEMENT DIRECTLY:** ChatGPT changes code/docs itself. Keep feature branches, preserve unrelated changes and existing user work. No Muse/OpenCode coding handoff.
4. **VERIFY:** review diff; actually run format/lint/typecheck/tests/build/isolated PostgreSQL and real browser E2E where relevant. Confirm GitHub Actions run `head_sha` equals FINAL source SHA, verify jobs. Green tests ≠ human Gate sign-off.
5. **AFTER EACH STEP:** update `.chatgpt/STATE.md` with current Gate/step/status, full G0–G9 snapshot, verified branch SHA, test evidence, human acceptance, blockers and exact next safe step. Append dated, sanitized facts to `.chatgpt/JOURNAL.md`; add to LESSONS only for real new lessons. Commit the checkpoint.
6. **MANDATORY READ-BACK:** RE-FETCH and READ committed STATE and code branch HEAD on GitHub before starting another step. If read-back/persistence fails, STOP and report an honest recovery record, rather than proceeding from transient chat cache.
7. **NEW CHAT / CONTEXT LOSS:** restart from step 1. Never rely solely on earlier assistant messages. Validate live state because other sessions may advance branches concurrently.

Suggested STATE fields: `protocol=chatgpt-direct-v1`, `active_gate`, `active_step`, `step_status`, `source_branch`, `expected_head`, `verified_head`, `evidence`, `human_acceptance`, `open_blockers`, `next_step`.

## Safety and concurrency
- Never merge to `main`, force-push, deploy, access production data/secrets, change SSH/firewall/Docker/root privileges or migrate production without explicit operator approval.
- G1-A exposed root SSH key and G1-C inadequate production isolation remain open. Removing Muse does NOT automatically pass G1 or authorize Linux production-host development commands. Former G1-D OpenCode installation task is **RETIRED**, not PASS.
- Development coding/tests may run in approved isolated Windows/GitHub CI scope.
- Concurrent sessions: always refetch HEAD immediately before a write, update by expected blob/branch SHA, and re-evaluate conflicts. Do not overwrite another session's newer Gate acceptance or code.
- No credentials, private keys, internal host details or production data in this public repository.

## Snapshot at adoption (verify live)
G0 audited; G1 security incomplete; G2 QA verified, formal Gate pending; G3 accepted technically; **G4 accepted technically**; G5 `feat/g5-online-sync` `4f75f7a` has verified CI, formal acceptance pending; G6–G9 not started. The authoritative latest state is GitHub STATE, not this snapshot.
