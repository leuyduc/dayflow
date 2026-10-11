# DayFlow V2 — Gate G1-B execution report (2026-10-12)
Status: **PARTIAL PASS — account and SSH login verified; full isolation acceptance pending**.
G1-A: **DEFERRED BY OPERATOR**. The old compromised root public key is still present in root's authorized_keys and must be revoked separately. Do not claim host is secure.

## Actions performed
1. Windows: generated a new, separate Ed25519 key under `C:\Users\ABC\.ssh\dayflow_dev_20261012_ed25519`; owner-only private-key NTFS ACL verified. Public fingerprint SHA256:JoaIO/RJ0i3HqOEk5Vsrb/r3Jp78lei5GbTWQANv0l0. Private key never printed or committed. It has no passphrase to permit automated login; consider an SSH agent/passphrase boundary later.
2. Linux: created `dayflow-dev` uid/gid 1001 with `/home/dayflow-dev`, mode 0700, shell /bin/bash, and locked password. User has only its own primary group.
3. Linux: provisioned the new public key in `/home/dayflow-dev/.ssh/authorized_keys` (user-owned, mode 0600); private ssh directory mode 0700.
4. SSH drop-in `/etc/ssh/sshd_config.d/99-hermes.conf`: changed only `AllowUsers root` to `AllowUsers root dayflow-dev`. A root-only backup copy was made before changing this file. A first candidate verification required automatic rollback because the checker expected an incorrect single-line format for `sshd -T`; no reload occurred. The corrected check explicitly accepted both separate `allowusers` records. The resulting configuration passed `sshd -t`, and `sshd -T` showed `allowusers root` and `allowusers dayflow-dev`.
5. Applied `systemctl reload ssh` (no restart). Fresh SSH sessions tested separately.

## Evidence
- Root SSH using new verified root admin key: `whoami -> root`, exit 0.
- Dev SSH using separate dev private key: `whoami -> dayflow-dev`, `id -> uid=1001 gid=1001 groups=1001`, `pwd -> /home/dayflow-dev`, exit 0.
- Post-change SSH, Nginx, Docker, UFW and cloudflared services all `active`. Other application services were not edited or restarted.
- Full negative privilege test requested by the agent was blocked by MCP command policy; do **not** claim all negative access checks have passed.

## Outstanding security and G1-C prerequisites
- Old compromised root key not revoked (G1-A deferred).
- Windows Desktop Commander automation still holds a root-authorized private key, so root/admin control is not separated from automation.
- Dev account is not a strong code-execution sandbox. Verify no access to production files, sockets, service credentials or production network endpoints before allowing Muse autonomous commands; use stronger VM/container isolation or separate host if necessary.
- No OpenCode installation, no repository checkout on Linux, no Docker configuration, no code change, no application deployment.
- User-specific SSH forwarding/X11 restrictions not yet applied.
- Gate G1-B account setup and remote login are complete; **overall G1 security gate is NOT passed**.

## Next gate
G1-C: design and test isolated development workspace and networking without production access; stop before installing/running OpenCode or giving automated developer agents production credentials.
