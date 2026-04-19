# Market Persistence Layer

This layer bridges normalization and storage.

## Responsibilities
- generate stable IDs for occupations, skills, and market signals
- upsert normalized occupations into `occupation_clusters`
- upsert normalized skill requirements into `occupation_skill_requirements`
- upsert normalized market signals into `market_signals`

## Design choice
The source-of-truth remains the application database, not raw model output and not raw API payloads.
