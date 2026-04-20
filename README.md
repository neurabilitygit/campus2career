# Campus2Career Starter Repository

Parent-first MVP starter for Campus2Career.

## Stack
- Frontend: Vercel-ready Next.js app in `apps/web`
- Backend API: Railway-ready Node/TypeScript app in `apps/api`
- Workers: Railway-ready Node/TypeScript worker app in `apps/worker`
- Database: Neon Postgres via SQL migrations in `packages/db/migrations`
- Storage/Auth: Supabase
- LLM orchestration: OpenAI API from server-side backend only

## Layout
- `apps/web` - frontend
- `apps/api` - backend API
- `apps/worker` - scheduled jobs and async processing
- `packages/shared` - shared types and contracts
- `packages/db` - migrations
- `packages/prompts` - prompt templates
- `docs/api/openapi.yaml` - OpenAPI-style API contract


## Demo endpoints
- `GET /v1/scoring/demo`
- `GET /v1/market/fixtures/validate`
- `GET /v1/briefs/demo`
- `GET /v1/chat/scenario/demo`

- `GET /v1/briefs/live` — persisted brief for the **current reporting month** (`BRIEF_MONTH_TZ` IANA zone, default `UTC`); parent / coach / admin
- `POST /v1/briefs/generate` — scoring + LLM + upsert for that same reporting month
- `GET /v1/parents/me/briefs/latest` — latest persisted `parent_monthly_briefs` row for the resolved household student (any month; parent / coach / admin)
- `POST /v1/chat/scenario/live` — JSON `{ "scenarioQuestion": string, "communicationStyle"?: string }` (style defaults to `"direct"`)


## Authenticated demo headers
For current live-style routes, send:
- `x-demo-user-id`
- `x-demo-role-type`
- optional `x-demo-email`

Example:
- parent user id: `11111111-1111-1111-1111-111111111111`
- student user id: `22222222-2222-2222-2222-222222222222`


## Supabase auth scaffolding
The starter repo now includes:
- frontend Supabase client
- Google OAuth sign-in button
- auth callback page
- API-side Bearer token verification using `SUPABASE_JWT_SECRET`

### Auth modes
1. `Authorization: Bearer <supabase-jwt>` for real auth
2. `x-demo-user-id` and `x-demo-role-type` for local fallback


## Frontend authenticated flow
The web app now:
- reads the Supabase browser session
- attaches the bearer token to API requests
- protects dashboards behind a session gate

Required frontend env:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`


## Frontend product shell
Added:
- role-aware redirect page at `/app`
- parent, student, and coach dashboard shells
- onboarding pages
- upload flow pages


## UI forms wired to backend
Current live-wired flows:
- student profile save -> `POST /students/me/profile`
- student profile read -> `GET /students/me/profile`
- deadline creation -> `POST /students/me/deadlines`
- upload-target request -> `POST /students/me/uploads/presign`

## Institution directory
Added:
- authenticated institution search -> `GET /v1/academic/institutions/search?q=...`
- directory options lookup -> `GET /v1/academic/directory/options?institutionCanonicalName=...`
- student catalog assignment read/write -> `GET|POST /students/me/academic/catalog-assignment`
- worker job `sync-college-scorecard` to populate `institutions` from the official College Scorecard API

Required worker env for the institution import:
- `COLLEGE_SCORECARD_API_KEY`
- optional `COLLEGE_SCORECARD_PER_PAGE` default `100`
- optional `COLLEGE_SCORECARD_MAX_PAGES` for test-sized imports


## Real signed upload flow
The upload screens now use a Supabase-style signed upload flow:
- backend mints signed upload targets
- frontend uploads file bodies with `uploadToSignedUrl`
- set `SUPABASE_STORAGE_BUCKET` to your bucket name


## Post-upload and diagnostic flows
Added live endpoints:
- `POST /students/me/onboarding/cluster-selection`
- `POST /students/me/uploads/complete`
- `GET /students/me/diagnostic/first`

Added frontend page:
- `/diagnostic`

## Synthetic Regression CI
The repo now includes a deterministic regression path for scoring and curriculum
logic that does not depend on Neon, Supabase, O*NET downloads, or BLS API
availability.

Local verification flow:
- `pnpm typecheck`
- `pnpm db:migrate`
- `pnpm db:seed:ci`
- `pnpm synthetic:run`

Convenience command:
- `pnpm verify:ci`

GitHub Actions runs the same sequence against a fresh local Postgres service in
`.github/workflows/ci.yml`.
