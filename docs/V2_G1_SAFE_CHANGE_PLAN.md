# DayFlow V2 — G1 Safe Change Plan (NOT EXECUTION APPROVAL)
Status: plan only. Linux server unchanged by creation of this document.
Reviewed: 2026-10-12. Based on read-only SSH observations from the Windows Desktop Commander device.

## 0. Verified baseline
- Ubuntu 22.04.5 LTS, 4 vCPU, 15 GiB RAM (~10 GiB available at audit), 232 GiB root filesystem (~101 GiB available), swap notably used.
- Host already runs Nginx, Docker, SSH, UFW, Cloudflare tunnel and numerous other workloads. DO NOT stop or reconfigure them for DayFlow.
- SSH bound to 192.168.100.165:22022; verified ED25519 server host fingerprint with operator; password and keyboard-interactive authentication off, public key authentication enabled, effective `AllowUsers root`, `X11Forwarding yes`, `AllowTcpForwarding yes`.
- `/root/.ssh/authorized_keys`: exactly two non-empty lines, one containing the old compromised public key and one containing the newly issued DayFlow key. New key was tested from Windows and returned uid root successfully.
- `/root/.ssh/authorized_keys2`, `/etc/ssh/authorized_keys`, `/etc/ssh/authorized_keys/root`: absent. `AuthorizedKeysCommand none` from effective SSH config.
- `dayflow-dev` does not exist. Docker socket owned by root:docker with mode 660. OpenCode absent from root PATH; /usr/local/bin/node v26.7.0, npm v11.19.0, Git v2.34.1, Docker v29.5.2, Compose v5.1.4.
- Public port 5433 appears published by docker-proxy on all interfaces; its access policy needs a separate risk review. Several other ports/services are in use.
- The Windows MCP process has access to the operator's Windows SSH private key files, including the newly created root-authorized key. Separation of agent permissions is incomplete until root administration credentials are kept outside the automation channel.

## Guiding rules
1. Gate G1 is executed only in explicitly approved substeps; every substep must include a rollback and evidence.
2. Keep at least one verified independent operator console/session during SSH policy changes. Never remove last known access path.
3. Do not use legacy/disclosed private key. Do not output keys, passwords, token strings, .env contents or DB data.
4. No changes to Nginx, Cloudflare, Docker, DB, production services, port mappings, UFW or applications during G1 unless separately scoped and approved.
5. Do not install OpenCode under root or give it sudo, docker-group membership, docker socket, host root credentials, production files or deployment secrets.
6. Linux Unix-user permissions alone are not a strong sandbox for arbitrary agent commands on a host with live production workloads; prefer a separate VM/host or stronger independently reviewed isolation for substantial autonomous coding.

## G1-A — Revoke the compromised SSH public key (first execution substep)
Preconditions:
- Confirm the current root session and a *fresh* new-key connection succeed; host fingerprint matches trusted record.
- Verify exactly one old-key and one new-key entry in expected authorized_keys file; abort if state differs.
- Arrange a provider console or confirmed alternate recovery channel.
Execution after explicit approval:
- Make restricted, recoverable backup of authorized_keys; use atomic temp-file update that removes *only* the exact old-key entry and preserves all other entries/mode/owner.
- Do not reload/restart sshd for authorized_keys changes.
Validation:
- Fresh SSH connection with new key succeeds, authorized_keys old-key count=0 and new-key count=1; syntax/service checks still pass.
- Do not exercise the exposed old private key even for a negative test.
Rollback:
- If new-key login fails, restore from the operator console/active privileged session and diagnose; avoid exposing backup outside root-protected area.
- Remove obsolete temporary copies only after validation.
STOP after evidence and await G1-B authorization.

## G1-B — Create restricted account dayflow-dev
Preconditions: G1-A accepted. Review users/groups and paths for collisions; choose dedicated dev SSH key distinct from root administrator key.
Execution after explicit approval:
- Create dayflow-dev with private home and user-owned development workspace, locked password; no sudo, wheel, docker, admin group, root SSH key or production permissions.
- Set ~/.ssh 0700, authorized_keys 0600; permit dedicated dev public key only.
- Back up SSH drop-in, add dayflow-dev to effective AllowUsers (currently root-only) without disabling root prematurely.
- Add user-specific SSH constraints, e.g. X11Forwarding no, AllowTcpForwarding local (to reach loopback OpenCode), restrict PermitOpen to intended loopback endpoint once known.
- Validate candidate config with sshd -t and sshd -T -C user=dayflow-dev,... before any reload; perform controlled reload, not restart, only when safe.
Validation:
- Fresh SSH with dev key succeeds; root login with new root key still works while transitioning.
- dayflow-dev cannot sudo, cannot read /root or protected production env/backup, cannot connect to Docker socket, cannot enter docker group or invoke privileged commands.
- Verify current public services are healthy and listener/port state unchanged.
Rollback: restore prior config and reload after syntax validation, or use operator console; do not lock out access.
STOP for acceptance.

## G1-C — Separate agent workspace and resources
- Keep source in dedicated dev workspace owned by dayflow-dev; dedicated cache/config. Never bind mount production folders.
- Apply per-user/process resource and storage limits following measured headroom; avoid assigning arbitrary limits without testing.
- Review local network access: loopback services can be reachable to unprivileged users; permissions without network namespace segmentation do NOT guarantee production isolation.
- Strongly prefer isolated VM/container infrastructure without privileged Docker access when allowing untrusted autonomous code; if none is available, keep a strict command allowlist and human approvals, and mark risk explicitly.
PASS: negative tests show no access to production assets and no disturbance to services.

## G1-D — Install and expose OpenCode safely (only after authorization)
- Check official current install compatibility and inspect the intended installation method. Install only for dayflow-dev, not root/system-wide.
- Start OpenCode web/serve bound to 127.0.0.1 on a checked free port (e.g. 4096); provide authentication using a securely provisioned OPENCODE_SERVER_PASSWORD that is never printed or committed.
- Operator Windows accesses the loopback service over SSH local forwarding (example: Windows 14096 -> Linux 127.0.0.1:4096). Do not expose 4096 in UFW, Nginx, Cloudflare or 0.0.0.0.
- Verify both Web UI and selected model/provider work using non-sensitive sample prompts. Keep restricted service logs.
- Permission policy forbids sudo/root, touching prod, deployment, secret discovery, arbitrary networking and destructive commands without operator approval.
PASS: Windows tunnel works, direct LAN access to 4096 fails, dayflow-dev runs OpenCode, no production access.

## G1-E — Administrative credential boundary and sign-off
- The Windows MCP presently can use the root-authorized SSH key. Before delegating autonomous development, remove root access from the automation identity or relocate the operator key into independently controlled administration (hardware-backed/passphrase/manual-only is preferable). Keep a verified emergency console/admin route.
- Consider prohibiting root SSH after a tested alternative administration path exists and confirming other workflows don't rely on it. Never disable it as a surprise.
- Record exact before/after service ports, uptime-sensitive services, SSH effective policy, directory ACLs, negative privilege checks, and Git branch.
- Do not begin G2 until operator accepts G1 report.

## Execution approval checklist
[ ] Operator approves G1-A (old key revocation) separately.
[ ] G1-A new-key fresh SSH PASS and old-key entry absent.
[ ] Operator approves G1-B (restricted user, SSH policy) separately.
[ ] G1-B fresh dev-key login and negative permission tests PASS.
[ ] Agent isolated from production storage, sockets, secrets and network endpoints or the remaining risks are accepted/documented.
[ ] OpenCode bound to localhost only, protected and accessible via SSH tunnel.
[ ] Operator-controlled root credentials isolated from MCP/agent identity.
[ ] No service interruption or unexpected listener change.
[ ] Operator explicitly approves G2 afterward.
