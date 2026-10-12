> **WORKFLOW OVERRIDE 2026-10-12:** Direct ChatGPT implementation replaces OpenCode/Muse coding. The user requires a GitHub checkpoint update and re-read **after every logical step** (see `docs/CHATGPT_EXECUTION_PROTOCOL.md`). Historical agent references below are no longer executable instructions. G1 production security remains blocked.

# DayFlow V2 — Windows-to-Linux Bootstrap Before Agent Installation

## Purpose
G0 is a read-only audit of the Linux host, not a coding gate. The Linux server may NOT have OpenCode installed yet. This is normal: do not pretend the agent can run remotely until it is confirmed installed and running under a restricted developer identity.

## On Windows (PowerShell)
1. Ensure you have the server provider's SSH host/IP, a non-root SSH user, and a working SSH private key controlled by the operator. Never paste a private key, password, tokens or .env contents into chat or agent prompts.
2. Check SSH client: `ssh -V`.
3. Connect using `ssh USER@SERVER_IP` (or `ssh -i PATH_TO_KEY USER@SERVER_IP`). Confirm the host key fingerprint with a trusted source on first connection.
4. Once connected, execute *read-only* Linux commands listed below one at a time. Do not install anything. Commands with missing executables may report 'command not found' — this is useful evidence.

## Linux G0 commands (read only)
```bash
whoami
id -nG
uname -srm
cat /etc/os-release
nproc
free -h
df -h
ss -lnt
git --version
node --version
npm --version
opencode --version
docker --version
podman --version
```
Some commands may be missing; that is NOT permission to install them. Avoid `sudo`, reading secrets, `docker ps` with privileged access or inspecting running production data. If service or port information is sensitive, redact host/IP and internal mount paths before sharing results.

## Audit report to deliver
OS/distro version, approximate CPU/RAM/disk headroom, existing services/port conflicts, SSH identity privileges, whether OpenCode/Node/Git/rootless runtime exist, whether this machine already hosts other production workloads, and security blockers. Include unknowns explicitly.

## Next step, after G0 approval
Only after operator approval, configure restricted development user, isolation and OpenCode for Linux. Keep OpenCode bound to 127.0.0.1, use password/session protection appropriate to the installed version, then from Windows establish an SSH tunnel:
`ssh -N -L 14096:127.0.0.1:4096 USER@SERVER_IP`
Visit `http://127.0.0.1:14096` after confirming OpenCode actually listens at remote port 4096. Do not publish the OpenCode port on a public interface.

## If SSH is not ready
Ask the server provider for host, SSH account and verified host key fingerprint through its secure console. Do not invent server credentials or bypass host verification.
