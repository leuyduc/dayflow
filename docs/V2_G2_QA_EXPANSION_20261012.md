# G2 — Expanded verification checkpoint (2026-10-12)

Branch: `feat/fullstack-foundation`. Scope: non-production Windows workstation; Linux server not modified.
Result: **development checks PASS; G2 not formally accepted**.

## Implementation
- Fastify app factory `apps/api/src/app.ts` separated from the network listener, enabling `app.inject()` tests without starting a port.
- Added 3 API tests: health payload, nonexistent task route is 404, unsupported POST /health is 404.
- Added 4 React component tests: desktop selection, mobile selection, offline API feedback, and explicit unfinished-feature messaging.
- Kept existing 3 domain tests. Total **10/10 passing**.
- Added reproducible Playwright Core browser smoke with preinstalled Chrome to avoid browser download; screenshots saved locally to ignored `.artifacts/`.
- Added testing dependencies to lockfile and `npm run test:browser`.

## Actual verification (Windows development)
- `npm run typecheck` — PASS, exit 0
- `npm run lint` — PASS, exit 0
- `npm run test` — PASS, 10/10 Vitest tests, exit 0
- `npm run build` — PASS, exit 0
- `npm run format:check` — PASS, exit 0
- `npm run test:browser` — PASS, exit 0; actual Chrome browser: desktop navigation and API online status, mobile navigation and no horizontal overflow, no JS page errors. API and web development services were running on Windows localhost.
- Browser screenshot artifacts produced locally, not committed to public GitHub.
- Independent GitHub Actions result not yet verified (do not infer success from local tests).

## Limits and risks
- G1-A exposed prior root key remains unresolved and G1-C Linux agent network isolation has not passed. No Linux deployment, database operations or services changed.
- Muse is managed by OpenCode's own session/cache; ChatGPT's `.chatgpt/` state and journal are not a required Muse input.
- This gate is a foundation-only milestone. Task persistence, authentication, sync, calendar and backups remain unimplemented.

## Next action
Review the G2 scaffold and CI, then design/implement G3 isolated authentication + DB (only in non-production, separate from any existing server DB) after operator approval. Maintain G1 security as a parallel blocking path for any Linux autonomous code execution or production deployment.
