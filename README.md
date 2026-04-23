# Rising Senior Starter Repository

Parent-first career intelligence MVP for students, parents, and coaches.

## Prerequisites
- Node.js 22.x
- pnpm 10.x
- A reachable Postgres database
- A Supabase project for auth and storage
- An OpenAI API key for server-side LLM flows

## Setup From Source
1. Install dependencies:
   `pnpm install`
2. Create local env files from the tracked examples:
   `cp .env.example .env`
   `cp apps/api/.env.example apps/api/.env.local`
   `cp apps/web/.env.example apps/web/.env.local`
   `cp apps/worker/.env.example apps/worker/.env.local`
3. Fill in the copied env files with real local values.
   Root `.env.example` is the full reference list.
   App-specific `.env.example` files list the subset each app expects at startup.
4. Apply database migrations:
   `pnpm db:migrate`
5. Optional deterministic seed and regression pass:
   `pnpm db:seed:ci`
   `pnpm synthetic:run`

## Run Locally
- Start everything:
  `pnpm dev:all`
- Or start individual processes:
  `pnpm dev:api`
  `pnpm dev:web`
  `pnpm dev:worker`

Default local ports:
- Web: `http://localhost:3000`
- API: `http://localhost:8080`

## Deterministic Verification
- Typecheck:
  `pnpm typecheck`
- API unit tests:
  `pnpm test:api`
- Synthetic scoring regression:
  `pnpm synthetic:run`
- Combined CI-style local verification:
  `pnpm verify:ci`

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


## Key live endpoints
- `GET /v1/scoring/demo`
- `GET /v1/market/fixtures/validate`
- `GET /v1/briefs/demo`
- `GET /v1/chat/scenario/demo`

- `GET /v1/briefs/live` — persisted brief for the **current reporting month** (`BRIEF_MONTH_TZ` IANA zone, default `UTC`); parent / coach / admin
- `POST /v1/briefs/generate` — scoring + LLM + upsert for that same reporting month
- `GET /v1/parents/me/briefs/latest` — latest persisted `parent_monthly_briefs` row for the resolved household student (any month; parent / coach / admin)
- `POST /v1/chat/scenario/live` — JSON `{ "scenarioQuestion": string, "communicationStyle"?: string }` (style defaults to `"direct"`)


## Demo auth headers
Demo-header auth is no longer assumed to be available.

It is accepted only when:
- `ALLOW_DEMO_AUTH=true`

When enabled, current live-style routes may accept:
- `x-demo-user-id`
- `x-demo-role-type`
- optional `x-demo-email`


## Supabase auth scaffolding
The starter repo now includes:
- frontend Supabase client
- Google OAuth sign-in button
- auth callback page
- API-side Bearer token verification using `SUPABASE_JWT_SECRET`

### Auth modes
1. `Authorization: Bearer <supabase-jwt>` for real auth
2. `x-demo-user-id` and `x-demo-role-type` only when `ALLOW_DEMO_AUTH=true`


## Frontend authenticated flow
The web app now:
- initializes a shared Supabase browser session store once per page load
- attaches the bearer token to API requests
- protects dashboards behind a session gate with timeout/retry messaging for slow auth checks

Required frontend env:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- optional `NEXT_PUBLIC_APP_URL` (defaults to `APP_BASE_URL` or `http://localhost:3000`)


## Frontend product shell
Added:
- role-aware redirect page at `/app`
- desktop-style two-column shell with a fixed navigation pane and flexible detail pane
- parent, student, and coach dashboard shells
- onboarding pages
- upload flow pages


## UI forms wired to backend
Current live-wired flows:
- student profile save -> `POST /students/me/profile`
- student profile read -> `GET /students/me/profile`
- deadline creation -> `POST /students/me/deadlines`
- upload-target request -> `POST /students/me/uploads/presign`
- upload completion -> `POST /students/me/uploads/complete`
- student catalog assignment -> `GET|POST /students/me/academic/catalog-assignment`
- institution search -> `GET /v1/academic/institutions/search?q=...`
- institution directory options -> `GET /v1/academic/directory/options?...`
- institution catalog discovery -> `POST /students/me/academic/catalog-discovery`
- program requirement discovery -> `POST /students/me/academic/program-requirements/discover`

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
- upload completion verifies the stored object exists and belongs to the resolved student profile before persistence
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

## Hardening notes
- Unknown or invalid resolved auth roles now fail explicitly instead of silently defaulting to `student`.
- Transcript parse failures no longer create placeholder transcript graphs. Failed extraction leaves the artifact and parse job in a failed state.
- Scoring no longer fabricates a default `"financial analyst"` target when the student has neither an exact target job nor a sector-to-role mapping. In that case the API returns `target_role_unresolved`.
- Program requirement discovery now returns diagnostic notes when website lookup or LLM-assisted extraction cannot produce a trustworthy course list.

## App-Specific Notes
- [apps/api/README.md](/Users/ericbass/Projects/campus2career-v16-final/apps/api/README.md)
- [apps/web/README.md](/Users/ericbass/Projects/campus2career-v16-final/apps/web/README.md)
- [apps/worker/README.md](/Users/ericbass/Projects/campus2career-v16-final/apps/worker/README.md)
