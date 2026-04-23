# Rising Senior Worker

Environment file:
- copy `apps/worker/.env.example` to `apps/worker/.env.local`

Startup assumptions:
- same Postgres and Supabase server-side credentials used by the API
- optional market-data credentials or files for bootstrap and import jobs
- default job is `process-parse-jobs`

Run commands:
- from repo root: `pnpm dev:worker`
- from this directory: `pnpm dev`

One-off commands:
- `pnpm bootstrap`
