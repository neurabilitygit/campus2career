# Synthetic Scenario Fixtures

This folder contains lightweight synthetic student scenarios for early-stage
product and scoring validation.

Design goals:

- Use fictional students only
- Anchor institutions, majors, and target jobs in publicly available sources
- Stay small enough for manual review and golden-scenario regression testing
- Match the current Rising Senior data model closely enough to seed later

## File layout

- `scenario-matrix.v1.json` - 12 scenario cards in a single repo-ready payload
- `academic-discovery-seed-ivy-suny.v1.json` - legacy controlled catalog seed set
- `academic-discovery-smoke.v1.json` - smaller academic discovery smoke-test set
- `academic-discovery-top50-manifest.v1.json` - curated top-50 university expansion manifest with official program/catalog URL hints

## Intended use

Each scenario is shaped so a future seed harness can map it onto current API
flows:

- `profile` -> `POST /students/me/profile`
- `sectorSelection` -> `POST /students/me/onboarding/cluster-selection`
- `catalogAssignment` -> `POST /students/me/academic/catalog-assignment`
- `transcript` -> structured transcript seed or transcript extraction input
- `contacts`, `outreach`, `deadlines`, `experiences`, `artifacts` -> seed inputs
- `expectedAssertions` -> golden checks for scoring, curriculum binding, and guidance

The academic discovery manifests are intended for controlled expansion scripts:

- `pnpm academic:discover:seed:ivy-suny`
- `pnpm academic:discover:seed:top50`
- `pnpm academic:review:top50`

The top-50 runner defaults to a dry run. Use `-- --apply` to allow writes, and add
`-- --include-requirements` only when you want the runner to attempt requirement discovery
after offerings discovery.

The top-50 review runner is read-only. It classifies each school into operational buckets such as:

- `ready_to_seed`
- `offerings_noisy`
- `requirements_pdf_likely`
- `manual_adapter_recommended`

## Important note

These are behavior fixtures, not private or real student records. Institution
names, majors, and target roles are grounded in public information, but the
student identities, transcripts, artifacts, and relationship data are entirely
synthetic.
