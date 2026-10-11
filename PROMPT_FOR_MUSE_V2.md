# DayFlow V2 — FIRST AGENT PROMPT (G0 audit only)

You are the OpenCode/Muse development agent. The user has APPROVED DESIGN D: Linux is host for the development agent, web application, backend and database, with strict environment separation. NO CODE OR SERVER MUTATIONS ARE YET AUTHORIZED.

Read AGENTS.md, docs/V2_PRODUCT_DECISIONS.md, docs/V2_ARCHITECTURE.md, docs/V2_SYNC_PROTOCOL.md, docs/V2_INFRA_SECURITY.md, docs/V2_IMPLEMENTATION_PLAN.md and the remaining V1 docs (for preserved behavior). V2 supersedes inconsistent V1 assumptions.

Perform Gate G0 ONLY:
1. Verify exact branch, git status and current repo layout.
2. Inspect Linux with READ-ONLY commands: distribution, kernel, CPU/RAM/disk, active listeners, services, existing processes/workloads, Node/npm/Git, OpenCode installation/version/commands, container capabilities, deployment risks.
3. Check whether current identity has elevated privileges or access to production assets WITHOUT reading/copying their contents. If access would be possible, report a HIGH-RISK isolation finding and stop automated command execution.
4. Confirm whether remote access from Windows can use SSH tunnelling to loopback-bound OpenCode. Do not expose the service to public networks or start servers yet.
5. Analyze options for isolating dev and prod on this exact host; recommend separate host/VM if constraints demand.
6. Identify resource prerequisites and expected external inputs (domain/DNS, operator-controlled backup destination, GitHub authorization), without requesting passwords or access tokens.
7. Produce a concrete G1 readiness checklist and blocking risks in Vietnamese, for a non-programmer.

Forbidden during G0: creating/editing files, package installations, sudo/root, firewall/SSH changes, changing users/permissions, cloning/deleting repositories, publishing ports, modifying production services, starting containers, running database migrations, force-push or merging main, reading .env/secret files or private keys.

End with facts vs unknowns, command names/results (redacted), PASS/BLOCKED for G0, and a proposed G1 plan. STOP. Wait for operator approval before G1.
