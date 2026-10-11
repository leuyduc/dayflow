# DayFlow V2 — Gate G1-C read-only isolation assessment
Date: 2026-10-12 (Asia/Bangkok)
Status: **AUDITED — NOT PASSED**. No server, account, firewall, Docker, production services or application settings were changed as part of this assessment.

## Scope
Evaluate `dayflow-dev` permissions, sensitive resource boundaries, Docker socket metadata, host/internal service reachability, and resource constraints. Operate as `dayflow-dev` over verified SSH through Windows Desktop Commander; do not log or retrieve secret contents, database records, or privileged credentials.

## Evidence (sanitized for PUBLIC repository)
- Fresh SSH as `dayflow-dev` succeeded, `uid=1001`, `gid=1001`, only own group according to `id`, working directory `/home/dayflow-dev`; existing home mode `0700`.
- OS user/metadata: `/root` owned root mode `0700`, `/etc/shadow` root:shadow mode `0640`, Docker Unix socket root:docker mode `0660`, `/var/lib/docker` root:root mode `0710`. Since dev is not in root/shadow/docker groups, ordinary DAC would deny these sensitive accesses; **explicit negative access tests were blocked**, so do not report a verified denial.
- Some ordinary host folders are world-readable by default (e.g. `/srv`, `/opt` top-level mode `0755`). No private files or contents beneath them were opened. Application-level file isolation remains unverified.
- Passive network inventory as `dayflow-dev` listed multiple loopback-only and all-interface listening sockets, including database-like endpoints.
- A non-authenticating, no-payload TCP connect test executed as `dayflow-dev` succeeded to THREE pre-existing loopback services (one database-like endpoint and two application endpoints). No protocol commands, credentials or business records were read. TCP service reachability is proven; authorization/data access is NOT tested and NOT asserted.
- Namespace check for the current process returned a network namespace identifier; PID1 comparison was inconclusive (no value returned). Do not claim namespace isolation from this test.
- Host resource snapshot: 4 logical CPUs (prior G0), 15 GiB RAM with about 10 GiB available, 232 GiB root volume with about 101 GiB available, 1.9 GiB swap with about 1.4 GiB used. Existing services must not be disrupted.
- All sensitive data and exact private LAN addresses were intentionally omitted from this public report.

## Conclusions
1. **G1-C FAIL / NOT PASSED for strong isolation**: a non-privileged account is not a sufficiently isolated arbitrary-code-execution environment on this host. TCP access to local services exists.
2. Successful TCP handshake does not imply database auth bypass or data compromise; it establishes network reachability, which is unacceptable to ignore for an autonomous code agent.
3. Root/Docker filesystem permissions suggest restricted access under normal DAC but negative access tests remain **BLOCKED**, not PASS. No evidence justifies declaring dev unable to access every production secret or deployment asset.
4. The user previously deferred revocation of an exposed old root SSH key (G1-A); it remains a separate critical security blocker. Automation on Windows can still use a root-authorized key.
5. No OpenCode/Muse is installed/configured for Linux by this gate. No implementation code, network policy change or service change authorized or performed.

## Recommended safe isolation design
**Preferred:** a separate development VM/host or an independent namespace/sandbox with a well-defined threat boundary, dedicated filesystem/volumes, non-root identity and no production credential mounts. Ensure outbound network controls **deny host loopback, host LAN/private ranges and production service addresses/ports**, while allowing only necessary GitHub/package registry/model provider traffic through vetted policy. Merely creating a VM does not block reachability to host/LAN interfaces; test and enforce network policy explicitly.

**Fallback if separate VM/host unavailable:** evaluated rootless container + user/mount/PID/network namespace isolation, strict seccomp/AppArmor and cgroup limits, managed by a trusted operator outside Muse. No privileged container flags, host network, Docker socket, or production bind mounts. Validate that the chosen runtime actually enforces egress filtering; do not assume default rootless networking blocks host services.

Resource limits must be measured for current host load; avoid speculative caps that starve existing production services. Reserve CPU/memory/disk for production first, benchmark the isolated dev environment. Avoid exposing OpenCode web port anywhere except authenticated SSH tunnel to loopback.

## G1-C acceptance tests required BEFORE deploying Muse
- Isolated workspace and process identity verified.
- Dev/agent cannot access host admin keys or production env/backups, nor privileged container socket; tests are executed with proof, not inferred from file mode alone.
- Dev/agent cannot make TCP connections to production host loopback, LAN/private endpoints or privileged APIs. Test allowlisted developer internet dependencies work.
- No production volumes, mount points or secrets are present in isolated environment.
- Recheck host service health and resource headroom; no service changes/disruptions.
- Verify logging, cleanup, explicit approval, rollback and operator-controlled recovery path.
- Remediate/accept separate G1-A compromised-key blocker, with a clear decision before closing G1.
- Only after sign-off: G1-D installation and safe OpenCode/Muse smoke test.

## Next step
Present isolation options to the operator and obtain **separate approval for G1-C remediation**. Do not install OpenCode, start Muse on Linux, change firewall/Docker or modify production services under this audit-only permission.
