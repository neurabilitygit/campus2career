# CODEBASE_REVIEW_REPORT

## 1. Executive summary

- Overall health: `moderate`
- Build status: `passed`
- Core test layers: `passed`
- CI-style synthetic regression: `failed`
- Confidence level: `high` for structure/test observations, `medium-high` for architectural risk assessment

The repository is organized and has a stronger-than-average test foundation for a product-stage app: there are unit, integration, and Playwright E2E suites, shared contracts, explicit SQL migrations, and role-aware UI coverage. The frontend builds successfully, typechecking passes, and the main test layers pass locally.

The highest-risk issue is that the repo’s own synthetic regression gate currently fails. `pnpm verify:ci` reported **9 failing synthetic scenarios out of 12**, all because readiness scores drifted above expected ranges. That means the app is buildable and testable, but the repo’s scoring contract is not currently stable enough to pass its own CI regression expectations.

The most important non-test findings are:
- overly permissive CORS that reflects any origin while allowing credentials
- missing transaction boundaries around multi-step writes
- upload validation that trusts extension/content-type without file-size or content sniffing
- context resolution that collapses multi-household / multi-role users to the earliest membership row

## 2. Repository map

### Main folders

- `/Users/ericbass/Projects/campus2career-v16-final/apps/web`
  - Next.js 14 app router frontend
- `/Users/ericbass/Projects/campus2career-v16-final/apps/api`
  - Node + TypeScript HTTP API
- `/Users/ericbass/Projects/campus2career-v16-final/apps/worker`
  - background/bootstrap worker
- `/Users/ericbass/Projects/campus2career-v16-final/packages/shared`
  - shared contracts, scoring types, market seeds
- `/Users/ericbass/Projects/campus2career-v16-final/packages/db/migrations`
  - SQL migration history
- `/Users/ericbass/Projects/campus2career-v16-final/packages/prompts`
  - prompt templates
- `/Users/ericbass/Projects/campus2career-v16-final/tests`
  - repo-level unit, integration, E2E, fixtures, synthetic data
- `/Users/ericbass/Projects/campus2career-v16-final/data/synthetic-fixtures`
  - scenario and manifest data for synthetic testing / academic discovery

### Frontend entry points

- `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/app/layout.tsx`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/app/page.tsx`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/app/student/page.tsx`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/app/parent/page.tsx`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/app/coach/page.tsx`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/components/layout/AppShell.tsx`

### Backend entry points

- `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/index.ts`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/server.ts`

### Database / schema locations

- `/Users/ericbass/Projects/campus2career-v16-final/packages/db/migrations`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/db/client.ts`
- repositories under:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/repositories`

### Test locations

- Unit:
  - `/Users/ericbass/Projects/campus2career-v16-final/tests/unit`
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/services/**/*.test.ts`
- Integration:
  - `/Users/ericbass/Projects/campus2career-v16-final/tests/integration`
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/routes/**/*.test.ts`
- E2E:
  - `/Users/ericbass/Projects/campus2career-v16-final/tests/e2e`
- Synthetic fixtures:
  - `/Users/ericbass/Projects/campus2career-v16-final/tests/synthetic`
  - `/Users/ericbass/Projects/campus2career-v16-final/tests/fixtures`

### Scripts / config locations

- root scripts:
  - `/Users/ericbass/Projects/campus2career-v16-final/package.json`
- app scripts:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/web/package.json`
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/package.json`
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/worker/package.json`
- CI:
  - `/Users/ericbass/Projects/campus2career-v16-final/.github/workflows/ci.yml`
- Playwright:
  - `/Users/ericbass/Projects/campus2career-v16-final/playwright.config.ts`
- docs:
  - `/Users/ericbass/Projects/campus2career-v16-final/README.md`
  - `/Users/ericbass/Projects/campus2career-v16-final/TESTING.md`

### Main runtime commands

- `pnpm dev:web`
- `pnpm dev:api`
- `pnpm dev:worker`
- `pnpm dev:all`
- `pnpm typecheck`
- `pnpm --dir apps/web build`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm test:api`
- `pnpm verify:ci`

### Environment variable documentation

Documented examples exist in:
- `/Users/ericbass/Projects/campus2career-v16-final/.env.example`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/api/.env.example`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/web/.env.example`
- `/Users/ericbass/Projects/campus2career-v16-final/apps/worker/.env.example`

Documentation quality is generally good. The main missing piece is a clearer matrix of which commands require only `DATABASE_URL` versus which require full Supabase/OpenAI credentials for non-test local usage.

### Confusing or duplicated architecture

- The API uses a long manual `if`/`else` router in `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/server.ts` instead of a route registry or framework router.
- There is intentional overlap between root-level test scripts and app-level test scripts. This is workable, but it makes it easy to run duplicates and harder to know which script is the true CI contract.

## 3. Commands run

| Command | Result | Summary |
|---|---|---|
| `pnpm typecheck` | passed | All workspace typechecks passed for `apps/api`, `apps/web`, and `apps/worker`. |
| `pnpm --dir apps/web build` | passed | Next.js production build succeeded; all app routes were generated successfully. |
| `pnpm test:unit` | passed | Repo-level unit tests plus API service tests passed. |
| `pnpm test:integration` | passed | Migrations, E2E seed, repo integration tests, and API route integration tests all passed. |
| `pnpm test:e2e` | passed | Playwright suite passed: `21 passed (2.4m)`. |
| `pnpm test:api` | passed | API-local test suite passed: `79` tests. |
| `pnpm verify:ci` | failed | Typecheck + migrations + CI seed passed, but synthetic regression failed: `3 passed, 9 failed, 12 total`. |
| `pnpm lint` | skipped | No lint script exists in root or app package files. |
| `pnpm test:all` | skipped | Not run because equivalent component suites were executed individually; this wrapper would have duplicated `test:unit`, `test:integration`, and `test:e2e`. |
| `npx playwright test` | skipped | Covered by `pnpm test:e2e`. |

### Relevant output summary for failed command

`pnpm verify:ci` failed in the synthetic scenario regression:

- `S02`: expected score range `48-68`, got `73`
- `S03`: expected `28-48`, got `56`
- `S04`: expected `44-62`, got `68`
- `S05`: expected `44-62`, got `64`
- `S06`: expected `28-45`, got `54`
- `S07`: expected `30-48`, got `56`
- `S10`: expected `36-54`, got `58`
- `S11`: expected `44-60`, got `66`
- `S12`: expected `44-60`, got `66`

Likely cause:
- scoring behavior has drifted upward relative to the current synthetic expectations, probably due to recent evidence/curriculum/scoring changes rather than a total runtime failure.

## 4. Findings by severity

### Critical

#### 1. Synthetic regression contract is broken
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/scripts/runSyntheticScenarios.ts`
  - scoring pipeline centered around `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/services/scoring`
  - student scoring input assembly in `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/services/student/aggregateStudentContext.ts`
- Evidence:
  - `pnpm verify:ci` failed with `9` scenario score-range mismatches out of `12`.
- Impact:
  - The repository’s own CI-style regression gate is red, which undermines trust in score stability and makes release safety ambiguous.
- Recommended remedy:
  - Triage whether the synthetic assertions are stale or the scoring model has unintentionally drifted.
  - Re-baseline only after reviewing changed evidence inputs and verifying expected business behavior.
  - Add per-subscore diff output in the synthetic runner so drift is easier to diagnose.
- Estimated effort: `medium`

### High

#### 2. CORS policy reflects arbitrary origins while allowing credentials
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/server.ts:4-13`
- Evidence:
  - `access-control-allow-origin` is set to `req.headers.origin || "*"`.
  - `access-control-allow-credentials` is always `"true"`.
- Impact:
  - Any requesting origin can be reflected as allowed, which is risky for credentialed browser calls and makes the API too permissive by default.
- Recommended remedy:
  - Replace reflection with an allowlist from env, e.g. `APP_BASE_URL`, `NEXT_PUBLIC_APP_URL`, and explicit local dev URLs.
  - Reject unknown origins instead of echoing them.
- Estimated effort: `small`

#### 3. Multi-step writes are not wrapped in transactions
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/db/client.ts`
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/routes/profiles.ts:79-98, 143-173, 214-231`
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/services/student/artifactIntake.ts:57-79`
- Evidence:
  - The DB client exposes only `query(...)`; no transaction helper is present.
  - Profile upserts update user identity and role-specific profile rows in separate statements.
  - Artifact intake creates an artifact row, parse job, and onboarding flags as separate writes.
  - Search for transaction usage returned no application-level transaction handling.
- Impact:
  - Partial writes can leave user identity and profile records out of sync, or create orphaned/half-complete artifact state if one statement fails after earlier ones succeed.
- Recommended remedy:
  - Add a small `withTransaction(...)` helper at the DB layer.
  - Use it first on the highest-risk multi-step flows:
    - profile updates
    - artifact intake
    - curriculum verification/upload linkage
    - coach note/recommendation/action creation chains
- Estimated effort: `medium`

#### 4. Upload validation trusts extension and content-type only, with no file-size guard
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/routes/studentWrite.ts:166-220, 501-565, 631-647`
- Evidence:
  - Validation checks extension/content-type allowlists only.
  - No file-size limit, magic-byte/content sniffing, or parser preflight is enforced.
  - Search for size enforcement returned no relevant code.
- Impact:
  - Users can upload oversized or mislabeled files more easily, which creates abuse, cost, parser failure, and storage risks.
- Recommended remedy:
  - Add max-size validation at presign time and completion time.
  - Store expected size and content-type metadata in upload targets.
  - Add basic server-side MIME sniffing for sensitive document classes, especially curriculum PDFs and transcripts.
- Estimated effort: `medium`

#### 5. Role and student context resolution collapses users to the earliest household membership
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/repositories/auth/userContextRepository.ts:21-50, 67-90`
- Evidence:
  - `resolveHouseholdStudentContextForUser(...)` and `resolveApplicationRoleForUser(...)` both `order by created_at asc limit 1`.
- Impact:
  - Users with multiple household memberships or role relationships can be resolved to the wrong student/role context, which is an authorization and data-visibility risk.
- Recommended remedy:
  - Model active context explicitly instead of implicitly choosing the oldest role.
  - At minimum, prefer active/non-ended relationship rows and fail loudly when multiple valid contexts exist without an explicit selector.
- Estimated effort: `medium`

### Medium

#### 6. CI does not exercise build, integration, or E2E workflows
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/.github/workflows/ci.yml:51-61`
- Evidence:
  - CI currently runs only:
    - typecheck
    - db:migrate
    - db:seed:ci
    - synthetic:run
  - It does not run:
    - web build
    - integration suites
    - Playwright E2E
- Impact:
  - Browser regressions, route wiring issues, and app build failures can land without being caught by GitHub Actions.
- Recommended remedy:
  - Add at least:
    - `pnpm --dir apps/web build`
    - `pnpm test:integration`
    - a smaller smoke Playwright job for PRs
  - Keep full E2E on push or nightly if runtime cost is a concern.
- Estimated effort: `small`

#### 7. Save-return route memory ignores query-only navigation changes
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/components/layout/AppShell.tsx:148-154`
- Evidence:
  - The effect stores `${pathname}${window.location.search}` but depends only on `[pathname]`.
  - Query-string transitions like `/student?section=evidence` -> `/student?section=guidance` will not update remembered navigation if the path segment stays the same.
- Impact:
  - Save-and-return UX can return users to an older or wrong subsection, especially in dashboard section flows that rely on query parameters.
- Recommended remedy:
  - Include search params in the effect dependency, or derive the full current URL via a hook that tracks query changes.
- Estimated effort: `small`

#### 8. Sensitive student identifiers are emitted in server logs on expected AppErrors
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/services/student/aggregateStudentContext.ts:303-314`
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/index.ts:10-15`
- Evidence:
  - `AppError.details` includes `studentProfileId`.
  - The server logs the full error object with `console.error("Unhandled API error", error)`.
  - During E2E, these logs surfaced specific `studentProfileId` values for `target_role_unresolved`.
- Impact:
  - Sensitive internal identifiers and contextual details end up in console logs for expected client-facing validation flows.
- Recommended remedy:
  - Distinguish expected operational AppErrors from unexpected exceptions.
  - Log only code/status for expected user-correctable errors, or redact identifiers before logging.
- Estimated effort: `small`

#### 9. Academic evidence audit columns are missing foreign keys
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/packages/db/migrations/030_academic_evidence_workflow.sql:14-25, 27-38, 40-51, 53-66, 74-85, 111-138`
- Evidence:
  - `reviewed_by_user_id`, `selected_by_user_id`, and `requested_by_user_id` are plain `uuid` columns with no `references users(user_id)`.
- Impact:
  - Audit metadata can drift into orphaned values and cannot be enforced by the database.
- Recommended remedy:
  - Add FKs where safe:
    - `majors.reviewed_by_user_id`
    - `minors.reviewed_by_user_id`
    - `concentrations.reviewed_by_user_id`
    - `student_catalog_assignments.selected_by_user_id`
    - `requirement_sets.reviewed_by_user_id`
    - `academic_discovery_attempts.requested_by_user_id`
- Estimated effort: `small`

#### 10. API response shapes are inconsistent across routes
- Location/file:
  - Examples:
    - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/routes/scoring.ts`
    - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/routes/profiles.ts`
    - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/utils/http.ts`
- Evidence:
  - Some responses include `ok: true`.
  - Others return direct payloads without `ok`.
  - Error shapes vary between `bad_request`, `unauthorized`, `service_unavailable`, and `AppError` responses.
- Impact:
  - Frontend hooks and future external clients need more route-specific handling and cannot depend on a stable envelope.
- Recommended remedy:
  - Standardize on a small response contract:
    - success envelope
    - error envelope
    - optional metadata block
- Estimated effort: `medium`

### Low

#### 11. No lint script or static style guard is configured
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/package.json`
  - app package files under `apps/*/package.json`
- Evidence:
  - No `lint` script exists.
- Impact:
  - Formatting drift, unused code, and unsafe patterns are less likely to be caught early.
- Recommended remedy:
  - Add a lightweight lint phase, ideally starting with TypeScript/React linting for touched files only if repo-wide adoption is too large initially.
- Estimated effort: `small`

#### 12. Manual monolithic HTTP router will become harder to maintain
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/server.ts`
- Evidence:
  - The server dispatches routes through a long `if`/`else` chain.
- Impact:
  - Route discovery, ownership, and permission review become more error-prone as the app grows.
- Recommended remedy:
  - Move toward a small route table or grouped registries, even without adopting a framework.
- Estimated effort: `medium`

#### 13. Browser and test logs are noisy
- Location/file:
  - Playwright/webserver output during `pnpm test:e2e`
  - repeated warnings from `NO_COLOR` / `FORCE_COLOR`
  - repeated `target_role_unresolved` AppErrors
- Evidence:
  - E2E logs showed repeated warning noise and expected-error noise even though tests passed.
- Impact:
  - Real failures become harder to spot during review.
- Recommended remedy:
  - Suppress expected warnings in test mode where appropriate and downgrade expected scoring precondition failures from noisy “Unhandled API error” logs.
- Estimated effort: `small`

### Observations

#### 14. The test foundation is strong for this stage of product maturity
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/tests`
  - `/Users/ericbass/Projects/campus2career-v16-final/playwright.config.ts`
  - `/Users/ericbass/Projects/campus2career-v16-final/TESTING.md`
- Evidence:
  - There are real unit, integration, E2E, and synthetic suites with seeded personas and role-aware scenarios.
- Impact:
  - This makes future refactors safer once the failing synthetic regression is stabilized.
- Recommended remedy:
  - Preserve this structure and extend it where gaps are listed below.
- Estimated effort: `n/a`

#### 15. Role-aware navigation centralization is a positive architecture choice
- Location/file:
  - `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/components/layout/navigation.ts`
- Evidence:
  - Student, parent, coach, and shared navigation items are filtered through a central config.
- Impact:
  - This is easier to reason about than scattered conditional nav rendering.
- Recommended remedy:
  - Keep extending from this config instead of reintroducing hardcoded nav checks.
- Estimated effort: `n/a`

## 5. Testing gaps

The current test suite is solid, but the following coverage is still weak or missing:

- Auth and role permissions
  - No dedicated tests for CORS behavior, origin allowlists, or JWT error redaction.
  - Admin-specific flows are lightly covered compared with student/parent/coach.

- Profile updates
  - Missing rollback/failure-path tests when identity update succeeds but profile update fails.

- Role-specific navigation
  - Good role-visibility coverage exists, but there is no regression test for query-only save-return behavior.

- Onboarding first-run behavior
  - Covered well in unit/integration/E2E.
  - Missing tests for version bumps across multiple stored historical versions.

- Communication/chatbot navigation
  - Covered at basic role level.
  - Missing end-to-end tests for real message-draft lifecycle from creation through visible history refresh.

- Academic evidence workflow
  - Good coverage exists, but not for broad school-specific batch discovery quality or adapter regressions.
  - Missing tests for school-specific adapter drift on TCNJ/Montclair.

- Curriculum verification
  - Covered for core flow.
  - Missing failure-path tests when verification save succeeds but reload/navigation fails.

- PDF upload
  - Missing tests for oversized uploads, spoofed MIME types, corrupt PDFs, and parser rejection UX.

- Scoring guardrails
  - Strong unit coverage exists, but synthetic regression is currently failing.
  - Missing per-subscore regression assertions that would pinpoint why drift occurred.

- Coach/student context switching
  - Covered for authorized switching.
  - Missing tests for users with more than one valid household/student relationship.

- Parent/student visibility boundaries
  - Covered for many coach artifacts.
  - Missing direct tests for sensitive optional profile fields never leaking into unauthorized contexts.

## 6. Security and privacy risks

| Risk | Affected data | Affected files | Recommended mitigation |
|---|---|---|---|
| Reflected credentialed CORS | bearer-authenticated API traffic, role-scoped student/parent/coach data | `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/server.ts` | Replace reflection with explicit allowed origins from env. |
| Identifier-rich error logging | student profile IDs, target-resolution state, JWT verification errors | `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/index.ts`, `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/services/student/aggregateStudentContext.ts`, `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/middleware/auth.ts` | Redact or downscope logs for expected AppErrors and auth failures. |
| Weak upload trust boundary | curriculum PDFs, resumes, transcripts, other artifacts | `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/routes/studentWrite.ts`, `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/services/storage/supabaseStorage.ts` | Add size limits, MIME sniffing, and stricter validation metadata. |
| Ambiguous multi-household role resolution | student/parent/coach scoped records and dashboards | `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/repositories/auth/userContextRepository.ts` | Introduce explicit active context selection instead of `created_at asc limit 1`. |
| Sensitive optional profile data stored in general-purpose profile tables | neurodivergence, demographic information, family structure, communication preferences | `/Users/ericbass/Projects/campus2career-v16-final/packages/db/migrations/027_role_profiles.sql`, `/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/repositories/profile/profileRepository.ts` | Preserve strict route-level access and consider audit logging or additional redaction rules for future exports/LLM prompts. |

## 7. UX and accessibility issues

| Issue | Affected screens/components | User impact | Recommended fix |
|---|---|---|---|
| Save-return memory ignores query-only section changes | `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/components/layout/AppShell.tsx` | Users can be returned to the wrong dashboard subsection after save. | Track search params as well as pathname. |
| Many forms and panels rely on large inline-style blocks | `/Users/ericbass/Projects/campus2career-v16-final/apps/web/src/app/profile/page.tsx`, dashboard components, communication page | UI consistency and accessibility improvements are harder to apply globally. | Continue extracting shared field/layout primitives instead of adding more inline styles. |
| Loading/error states are mostly plain text and not obviously announced | `SessionGate`, `RequireRole`, several dashboard sections | Screen-reader and focus-management quality is weaker than the rest of the UI structure. | Add `aria-live` for async status regions and clearer focus movement after state changes. |
| Raw backend error messages surface directly in some frontend views | `useApiData`, `apiFetch`, multiple pages | Users can see technical error strings instead of product-friendly messages. | Normalize frontend error mapping by route domain. |

## 8. Data model and integrity issues

| Concern | Affected table/model | Risk | Recommended fix |
|---|---|---|---|
| Missing FK constraints on audit columns | `majors`, `minors`, `concentrations`, `student_catalog_assignments`, `requirement_sets`, `academic_discovery_attempts` | audit/user references can drift into orphaned UUIDs | add foreign keys to `users(user_id)` where safe |
| Multi-step writes not atomic | profile rows, artifact rows, parse jobs, onboarding flags | partial persistence and cross-table inconsistency | add transaction helper and use it on multi-write flows |
| Context resolution picks one household role by oldest row | `user_household_roles` lookup logic | wrong student/role context for multi-membership users | add explicit active-context selection or fail on ambiguity |
| Synthetic scoring expectations out of sync | synthetic scenario matrix vs scoring engine | CI contract is currently unreliable | re-baseline or fix scoring drift after root-cause review |

## 9. Recommended remediation roadmap

### Immediate fixes

1. Fix the failing synthetic regression suite.
2. Lock down CORS to explicit allowed origins.
3. Add transaction handling for profile updates and artifact intake.
4. Reduce sensitive identifier leakage in expected-error logs.

### Next sprint

1. Add upload size and MIME sniffing safeguards.
2. Expand CI to run web build, integration tests, and at least a Playwright smoke suite.
3. Replace oldest-membership auth resolution with explicit active context selection.
4. Add foreign keys for academic evidence audit columns.

### Later improvements

1. Normalize API response envelopes.
2. Refactor the manual router into a small route registry.
3. Continue extracting shared UI primitives from inline-styled pages.
4. Add school-adapter regression tests for academic discovery quality.

## 10. Suggested test plan

### Unit tests to add

- transaction rollback helpers once introduced
- CORS origin allowlist behavior
- upload size / MIME sniffing validation
- multi-household active-context resolution rules
- save-navigation query-string tracking
- synthetic scoring per-subscore drift assertions

### Integration tests to add

- profile update rollback on mid-flight failure
- artifact intake rollback when parse-job creation fails
- auth context resolution for users with multiple memberships
- API error-redaction behavior for expected AppErrors
- admin-role access and visibility boundaries

### E2E tests to add

- real query-section save-return behavior
- large/invalid upload rejection UX
- curriculum/academic evidence flows with parser failure states
- multi-household / multi-student coach selection UX
- direct origin / auth failure handling if browser-side mocks are expanded

### Synthetic data fixtures needed

- multi-household users
- dual-role or ambiguous-role users
- oversized / corrupted PDF fixtures
- additional academic-discovery edge schools
- scoring comparison fixtures with explicit expected subscore deltas

## 11. Appendix

### Raw failed command excerpts

From `pnpm verify:ci`:

```text
[FAIL] S02 ... Expected overall score in range 48-68, got 73.
[FAIL] S03 ... Expected overall score in range 28-48, got 56.
[FAIL] S04 ... Expected overall score in range 44-62, got 68.
[FAIL] S05 ... Expected overall score in range 44-62, got 64.
[FAIL] S06 ... Expected overall score in range 28-45, got 54.
[FAIL] S07 ... Expected overall score in range 30-48, got 56.
[FAIL] S10 ... Expected overall score in range 36-54, got 58.
[FAIL] S11 ... Expected overall score in range 44-60, got 66.
[FAIL] S12 ... Expected overall score in range 44-60, got 66.
Synthetic scenario summary: 3 passed, 9 failed, 12 total.
```

### Unresolved setup questions

- Which synthetic score ranges are authoritative: the current matrix or the latest scoring behavior?
- Should admin have full E2E coverage parity with student/parent/coach?
- Should curriculum/academic discovery batch scripts be part of formal CI or remain operational scripts only?

### Environment variables needed

Core documented variables include:
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `ALLOW_DEMO_AUTH`
- `ALLOW_TEST_CONTEXT_SWITCHING`
- `TEST_SUPERUSER_EMAILS`
- `COMMUNICATION_DELIVERY_MODE`
- optional provider keys like SendGrid/Twilio

### Assumptions made

- Local env files were already present and valid enough to run the checked commands.
- No repo-wide lint command exists because none is declared in the visible package manifests.
- I treated aggregate wrapper scripts such as `pnpm test:all` as optional duplicates once the underlying suites were already run individually.
