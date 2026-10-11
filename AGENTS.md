# DayFlow Agent Instructions

## Mission
Build DayFlow, a polished personal planning web app, from the specifications in `docs/`. Work autonomously from the current repository state. Do not stop for routine product or implementation questions; make sensible, documented decisions consistent with the specs.

## Required workflow
1. Read `START_HERE.md` and every file in `docs/` before coding.
2. Inspect the repository and current branch. Preserve existing work; do not reset or overwrite user changes.
3. Implement in the order in `docs/IMPLEMENTATION_PLAN.md`, keeping the app runnable after each milestone.
4. Install dependencies using the repository's package manager. Do not silently switch stacks.
5. Run formatting/linting, type checks, unit tests, and production build. Fix failures caused by your changes.
6. Add or update tests for meaningful behavior. If browser tooling is available, run the critical Playwright flows.
7. Update README with setup, scripts, architecture overview, and known limitations.
8. Finish with a concise report: what shipped, key files, commands/tests and outcomes, remaining issues.

## Product constraints
- MVP is local-first. Persist user data in IndexedDB; the app must work without an account or backend.
- Do not add AI features, cloud sync, authentication, collaboration, billing, or analytics to the MVP.
- Include backup export and restore/import with validation and safe failure behavior.
- Avoid data loss: destructive actions require confirmation or a reversible path where practical.
- Use accessible semantic controls, keyboard support, clear empty/loading/error states, and responsive layouts.
- Keep domain logic independent from UI and storage adapters. Use small modules and explicit types.

## Engineering standards
- TypeScript strict mode; avoid `any` unless justified at a boundary.
- Store timestamps as ISO strings and represent date-only values explicitly; do not mix local dates with UTC dates carelessly.
- Keep scheduling logic deterministic and independently unit tested.
- Do not invent features outside the specs when they add complexity. Record any necessary deviation in README.
- Never commit secrets, tokens, personal data, or generated local database contents.
- Do not merge this branch into `main`. Work only on the current feature branch unless the user explicitly instructs otherwise.

## Definition of done
- The app starts using documented commands.
- Core task CRUD, calendar views, schedule suggestions/editing, local persistence, and backup/restore work.
- Tests, typecheck, and production build pass, or any environment-blocked check is clearly documented.
- No dead primary controls, placeholder-only core screens, or unexplained console errors.
