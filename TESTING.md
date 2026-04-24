# Testing

This repo now uses three testing layers:

- Unit tests: fast, isolated checks for pure logic, validation, scoring helpers, access rules, and synthetic-data helpers.
- Integration tests: route, service, repository, auth-context, and database-backed flows using seeded synthetic data.
- End-to-end tests: Playwright browser scenarios that use synthetic users and exercise the live web and API stack.

## Where the test data lives

- Shared synthetic users, students, and scenarios: [tests/synthetic/scenarios.ts](/Users/ericbass/Projects/campus2career-v16-final/tests/synthetic/scenarios.ts)
- Reusable factories: [tests/synthetic/factories.ts](/Users/ericbass/Projects/campus2career-v16-final/tests/synthetic/factories.ts)
- Shared DB seed helper: [tests/fixtures/seedSyntheticData.ts](/Users/ericbass/Projects/campus2career-v16-final/tests/fixtures/seedSyntheticData.ts)
- Shared HTTP helpers for route tests: [tests/fixtures/http.ts](/Users/ericbass/Projects/campus2career-v16-final/tests/fixtures/http.ts)

## Test layout

- Unit tests: [tests/unit](/Users/ericbass/Projects/campus2career-v16-final/tests/unit) plus existing API service tests in [apps/api/src/services](/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/services)
- Integration tests: [tests/integration](/Users/ericbass/Projects/campus2career-v16-final/tests/integration) plus existing API route tests in [apps/api/src/routes](/Users/ericbass/Projects/campus2career-v16-final/apps/api/src/routes)
- E2E tests: [tests/e2e](/Users/ericbass/Projects/campus2career-v16-final/tests/e2e)

## Running the suites

- Unit only: `pnpm test:unit`
- Integration only: `pnpm test:integration`
- E2E only: `pnpm test:e2e`
- E2E headed: `pnpm test:e2e:headed`
- E2E debug: `pnpm test:e2e:debug`
- All tests: `pnpm test:all`

## E2E setup notes

Playwright runs against:

- API test server: `pnpm --dir apps/api dev:test`
- Web test server: `pnpm --dir apps/web dev:test`

Those commands enable a narrow test-only demo-auth bridge. It is only active when:

- API: `ALLOW_DEMO_AUTH=true`
- Web: `NEXT_PUBLIC_ENABLE_TEST_DEMO_AUTH=true`

The browser tests do not send real messages. They seed fake users and use the existing mock communication paths.

## Adding a new synthetic user scenario

1. Add or update the fake user, student, household, or scenario in [tests/synthetic/scenarios.ts](/Users/ericbass/Projects/campus2career-v16-final/tests/synthetic/scenarios.ts).
2. Add a factory in [tests/synthetic/factories.ts](/Users/ericbass/Projects/campus2career-v16-final/tests/synthetic/factories.ts) if the new scenario needs reusable form payloads.
3. Extend [tests/fixtures/seedSyntheticData.ts](/Users/ericbass/Projects/campus2career-v16-final/tests/fixtures/seedSyntheticData.ts) if the scenario needs persisted baseline records.
4. Reuse the seeded user through Playwright helpers in [tests/e2e/fixtures.ts](/Users/ericbass/Projects/campus2career-v16-final/tests/e2e/fixtures.ts).

## Debugging Playwright failures

- Run `pnpm test:e2e:headed` to watch the flow in a visible browser.
- Run `pnpm test:e2e:debug` to step through actions interactively.
- Failure traces, screenshots, and videos are retained by Playwright on failure.
- If the browser tests start failing after DB changes, reseed the synthetic world with `pnpm test:e2e:seed`.
