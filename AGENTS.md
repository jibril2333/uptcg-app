# Repository development rules

## Task scope

- Treat the linked Linear issue and its acceptance criteria as the task scope.
  If the issue is ambiguous, report the ambiguity instead of expanding scope.
- Develop on a task branch. Open a pull request for review when requested, but
  never merge it and never deploy from a task.
- Preserve backward compatibility unless the issue explicitly requires a
  breaking change and describes the migration.

## Data and deployment safety

- Production deploys only through `.github/workflows/deploy.yml` after an
  owner-approved push to `main`, or through its manual dispatch.
- Never add `pull_request` or `pull_request_target` triggers to a workflow that
  runs on the self-hosted runner labeled `uptcg`.
- Never read, copy, delete, reset, migrate, or otherwise modify production data
  under `/Users/rei/Library/Application Support/UPTCG/data`.
- Do not run `npm run sync:all` or production card-data synchronization in a
  Codex task unless the issue explicitly targets the sync pipeline and the run
  uses disposable test directories.
- Do not commit `.env` files, secrets, tokens, SQLite databases, card-data
  caches, downloaded card images, or other production/user data.
- Tests must use fixtures or disposable temporary data. Never point tests at
  `.wrangler`, `data/cards`, `public/cards`, or production bind mounts.

## Verification and handoff

- Before handoff, run `npm run lint` and `npm test`. `npm test` includes the
  production build. The repository currently has pre-existing lint failures;
  report the exact result and do not introduce additional lint errors.
- Report the commands and results in the pull request.
- PR descriptions must summarize the change, map results to the acceptance
  criteria, describe compatibility and data impact, and state that no deploy,
  production sync, or production-data operation was performed.
