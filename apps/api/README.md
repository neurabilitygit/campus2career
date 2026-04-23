# Rising Senior API

Environment file:
- copy `apps/api/.env.example` to `apps/api/.env.local`

Startup assumptions:
- reachable Postgres database in `DATABASE_URL`
- Supabase server-side credentials for auth and storage verification
- OpenAI API key for LLM-backed routes

Run commands:
- from repo root: `pnpm dev:api`
- from this directory: `pnpm dev`

Verification commands:
- `pnpm typecheck`
- `pnpm test`
- `pnpm db:migrate`
- `pnpm synthetic:run`
