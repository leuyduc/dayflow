# ChatGPT Direct Execution — Persistent GitHub Context

**Active since 2026-10-12:** ChatGPT is the sole DayFlow implementer. No Muse/OpenCode coding handoff or external agent memory/caches.

## Before and after EACH logical step
1. BEFORE: re-fetch `.chatgpt/STATE.md` from the design branch, source branch HEAD and the relevant V2 code/specs plus latest JOURNAL/LESSONS. Check scope, blockers, Gate acceptance and live CI.
2. For risky/long tasks, save an `IN_PROGRESS` checkpoint with expected SHA and recovery path before acting.
3. ChatGPT directly performs the approved task using available tools, without delegating to another agent.
4. AFTER: commit an updated STATE covering all G0–G9, step status, SHA, evidence, risks, next step; append JOURNAL. LESSONS only for real new findings.
5. **RE-FETCH and READ GitHub STATE and source HEAD before the next step**. If persistence/readback fails, STOP; never rely solely on conversation cache.
6. Recovery/new chat starts at step 1. Never overwrite concurrent updates or infer user approval.

Full protocol: `docs/CHATGPT_EXECUTION_PROTOCOL.md`.

**Safety:** Public repo: no secrets, keys, production data or internal network topology. No unauthorized merge/force-push/deploy, SSH/firewall/root work, production DB changes or Gate acceptance. G1 remains incomplete.
