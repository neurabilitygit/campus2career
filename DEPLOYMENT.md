# Deployment Guide

This repository is organized as a monorepo with three deployable apps:

- `apps/web` - Next.js frontend
- `apps/api` - Node/TypeScript API
- `apps/worker` - background jobs and polling worker

It also depends on:

- `packages/db/migrations` - SQL schema migrations
- Supabase - browser auth and file storage
- Neon Postgres - primary relational database
- OpenAI - brief/chat generation

## Recommended order

1. Create Neon Postgres
2. Apply database migrations
3. Create Supabase project and storage bucket
4. Deploy API
5. Deploy Web
6. Deploy Worker
7. Run hosted smoke tests

## 1. Create Neon Postgres

Create a database and copy the `DATABASE_URL`.

Use that URL for:

- `apps/api`
- `apps/worker`

## 2. Apply database migrations

Run the SQL files in this order:

- `001_identity.sql`
- `002_consent.sql`
- `003_student_profile.sql`
- `004_experiences.sql`
- `005_market_and_skills.sql`
- `006_paths_gaps_actions.sql`
- `007_insights_and_briefs.sql`
- `008_indexes_and_constraints.sql`
- `009_deadlines.sql`
- `010_sample_auth_seed.sql`
- `012_contacts.sql`
- `013_artifacts_and_outreach.sql`
- `011_onboarding_and_parse_jobs.sql`
- `014_academic_catalog_foundation.sql`
- `015_transcript_graph.sql`

Minimum tables to verify after migration:

- `users`
- `households`
- `student_profiles`
- `contacts`
- `deadlines`
- `academic_artifacts`
- `artifact_parse_jobs`
- `outreach_interactions`
- `parent_monthly_briefs`
- `occupation_clusters`
- `occupation_skill_requirements`
- `institutions`
- `academic_catalogs`
- `degree_programs`
- `majors`
- `catalog_courses`
- `requirement_sets`
- `student_catalog_assignments`
- `student_transcripts`
- `transcript_terms`
- `transcript_courses`
- `transcript_course_matches`

## 3. Create Supabase

Create a Supabase project and capture:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then:

1. Enable Google auth if you want the current sign-in flow.
2. Create the storage bucket named by `SUPABASE_STORAGE_BUCKET`.

Recommended default:

- `SUPABASE_STORAGE_BUCKET=campus2career`

## 4. Deploy API

Recommended platform:

- Railway

Target app:

- `apps/api`

Required environment variables:

```env
PORT=8080
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=campus2career

APP_BASE_URL=
BRIEF_MONTH_TZ=UTC

ONET_USERNAME=
ONET_PASSWORD=
BLS_API_KEY=
ALLOW_DEMO_AUTH=false
```

Post-deploy checks:

1. Verify `/health` returns `{"ok":true,"service":"api"}`.
2. Verify the service can connect to Postgres.
3. Verify the service starts with no missing env errors.
4. Verify demo auth headers are rejected unless `ALLOW_DEMO_AUTH=true`.

## 5. Deploy Web

Recommended platform:

- Vercel

Target app:

- `apps/web`

Required environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Notes:

- The frontend now degrades safely if Supabase env vars are missing, but real auth and uploads require them.
- Point `NEXT_PUBLIC_API_BASE_URL` at the deployed API origin.

Post-deploy checks:

1. Homepage loads
2. `/app` loads
3. `/student` loads
4. `/parent` loads
5. `/auth/callback` renders without crashing

## 6. Deploy Worker

Recommended platform:

- Railway

Target app:

- `apps/worker`

Required environment variables:

```env
DATABASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
SUPABASE_STORAGE_BUCKET=campus2career

WORKER_JOB=process-parse-jobs
WORKER_POLL_INTERVAL_MS=30000

ONET_USERNAME=
ONET_PASSWORD=
BLS_API_KEY=
```

### Worker modes

The worker entrypoint now supports explicit job selection.

Use one of these values for `WORKER_JOB`:

- `process-parse-jobs`
- `seed-target-role-families`
- `seed-broad-skill-requirements`
- `sync-onet`
- `sync-bls`
- `recompute-scores`
- `generate-parent-briefs`
- `generate-alerts`
- `refresh-insights`

Behavior:

- Default job is `process-parse-jobs`
- If `WORKER_POLL_INTERVAL_MS` is set to a positive integer and `WORKER_JOB=process-parse-jobs`, the worker will poll continuously
- If `WORKER_JOB=list`, the worker will print available jobs and exit

Recommended first deployed worker mode:

```env
WORKER_JOB=process-parse-jobs
WORKER_POLL_INTERVAL_MS=30000
```

## 7. Hosted smoke test

After all three apps are deployed, run this end-to-end check:

1. Sign in with Google
2. Save student profile
3. Save sector selection
4. Save network baseline
5. Create one deadline
6. Upload one resume or transcript
7. Confirm API writes an `academic_artifacts` row
8. Confirm API writes an `artifact_parse_jobs` row
9. Confirm worker processes the parse job
10. Open `/diagnostic`
11. Open `/student`
12. Open `/parent`
13. Generate a parent brief
14. Trigger scenario chat

## Common failure cases

### Web build or pages fail around Supabase

Check:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Authenticated API routes return unauthorized

Check:

- `SUPABASE_JWT_SECRET`
- frontend is sending bearer tokens
- Supabase auth is enabled

### Upload succeeds but parse never happens

Check:

- `SUPABASE_STORAGE_BUCKET`
- worker is deployed
- worker is running `WORKER_JOB=process-parse-jobs`
- `WORKER_POLL_INTERVAL_MS` is positive

### Worker starts but market sync jobs fail

Check:

- `ONET_USERNAME`
- `ONET_PASSWORD`
- `BLS_API_KEY`

### Briefs or chat fail

Check:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

## Local environment

Use `.env.example` as the source of truth for local setup.

Suggested local defaults:

```env
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
PORT=8080
BRIEF_MONTH_TZ=UTC
WORKER_JOB=process-parse-jobs
WORKER_POLL_INTERVAL_MS=30000
SUPABASE_STORAGE_BUCKET=campus2career
```
