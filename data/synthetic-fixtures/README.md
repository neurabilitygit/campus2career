# Synthetic Scenario Fixtures

This folder contains lightweight synthetic student scenarios for early-stage
product and scoring validation.

Design goals:

- Use fictional students only
- Anchor institutions, majors, and target jobs in publicly available sources
- Stay small enough for manual review and golden-scenario regression testing
- Match the current Campus2Career data model closely enough to seed later

## File layout

- `scenario-matrix.v1.json` - 12 scenario cards in a single repo-ready payload

## Intended use

Each scenario is shaped so a future seed harness can map it onto current API
flows:

- `profile` -> `POST /students/me/profile`
- `sectorSelection` -> `POST /students/me/onboarding/cluster-selection`
- `catalogAssignment` -> `POST /students/me/academic/catalog-assignment`
- `transcript` -> structured transcript seed or transcript extraction input
- `contacts`, `outreach`, `deadlines`, `experiences`, `artifacts` -> seed inputs
- `expectedAssertions` -> golden checks for scoring, curriculum binding, and guidance

## Important note

These are behavior fixtures, not private or real student records. Institution
names, majors, and target roles are grounded in public information, but the
student identities, transcripts, artifacts, and relationship data are entirely
synthetic.
