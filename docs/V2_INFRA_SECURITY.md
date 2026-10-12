> **WORKFLOW OVERRIDE 2026-10-12:** Direct ChatGPT implementation replaces OpenCode/Muse coding. The user requires a GitHub checkpoint update and re-read **after every logical step** (see `docs/CHATGPT_EXECUTION_PROTOCOL.md`). Historical agent references below are no longer executable instructions. G1 production security remains blocked.

# DayFlow V2 — Linux Operations, Security and Deploy Plan

## G0 first: read-only Linux audit, no changes
Collect distro/kernel, vCPU/RAM/free disk, existing workloads, ports, DNS/domain readiness, SSH access method, OS updates, node/npm, git, OpenCode exact version, available model/provider, container/runtime availability, GitHub auth, resource headroom and backups. Do not collect/print passwords, private keys, tokens, .env contents or personal data. No package installs, sudo, firewall edits or production changes before approval.

## Separate identities and trust zones
- A restricted 'developer' identity runs agent in /srv/dayflow/dev or user home; no sudo, no Docker daemon socket/group, no access to production home, env, databases, backups or deployment keys.
- Production runtime identity and production DB are isolated; operator controls deployment credentials.
- CI builds reviewed commits with limited permissions; production deploy requires explicit human approval.
- If strong isolation cannot be achieved on one VPS, recommend a separate VM/host or stop automatic command execution. Rootless development containers may be used when audited; do not weaken isolation merely for convenience.
- Limit agent tools via OpenCode permissions; destructive shell, privileged commands, network publishing and infra mutations require explicit approval.

## RETIRED HISTORICAL REFERENCE — Remote OpenCode access (DO NOT EXECUTE)
OpenCode runs on Linux, bound ONLY to 127.0.0.1. The Windows operator connects using an SSH tunnel (illustrative, after G0):
  ssh -N -L 14096:127.0.0.1:4096 dev@YOUR_SERVER
Then visit http://127.0.0.1:14096 if OpenCode web runs on Linux localhost port 4096.
Set the OpenCode server password using an approved secret mechanism, never commit it. Verify installed version/commands; the official tooling has version-specific interfaces. Do NOT publish port 4096 to the Internet.

## Host and network
SSH key-based login; never disable current access until replacement works. Restrict administration network where possible. Firewall expose only necessary SSH, TCP 80/443; DB, dev frontend and agent access stay private. Apply OS security updates through controlled maintenance. Monitoring for disk, memory, service health, TLS, failed login, DB and backups.
Caddy handles TLS, security headers and reverse proxy. Same origin recommended for web/API to simplify sessions/CSRF.
Compose may orchestrate separate staging/production projects, networks, volumes and secret mounts; avoid bind-mounting editable source into production. Use secrets management rather than committing secrets.
Never give agent credentials that can touch production.

## Release pipeline
feature branch -> PR -> CI lint/type/test/build/security scan -> review -> staging test -> approval -> encrypted DB backup + tested restore path -> migration compatibility review -> immutable image deploy -> smoke test -> monitor -> rollback procedure.
DB schema migrations may not be safely reversible: take backup, prefer backwards-compatible expand/contract and write a recovery runbook. Rollback a binary does NOT automatically roll back data.

## Backup and disaster recovery
Automated PostgreSQL backups (encrypted and stored off-host), retention policy, access control and tested restore to a separate environment. Capture deployment manifests/migration version (not raw secrets). JSON user export/import is portability, not a replacement for server backups. Agree RPO/RTO targets after G0; no unverified uptime guarantees.

## Operational red flags — stop
Agent has sudo/root, Docker group/socket, prod .env, DB password, deploy SSH keys, broad GitHub admin/token, public OpenCode UI, staging and prod sharing a DB/volume, no verified backups, or server too small for concurrent dev and production.
