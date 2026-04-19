# Market Ingestion Architecture

## O*NET
Use O*NET Web Services as the occupation-and-skills source of truth.

Planned flow:
1. Seed target role families and search terms
2. Search O*NET occupations for the best matches
3. Persist canonical O*NET mappings in `occupation_clusters`
4. Pull skills and requirement detail
5. Normalize into `occupation_skill_requirements`

## BLS
Use the BLS Public Data API for market and economic signals.

Planned flow:
1. Curate a small set of BLS series IDs relevant to target sectors and geographies
2. Fetch data through the public API
3. Normalize into `market_signals`
4. Aggregate those signals into marketDemand and supporting explanations

## Why split sources
- O*NET is best for occupations and skills
- BLS is best for labor-market conditions, wages, and trend signals
