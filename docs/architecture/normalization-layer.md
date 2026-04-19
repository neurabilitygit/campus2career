# Normalization Layer

The normalization layer converts raw external payloads into application-owned canonical objects.

## O*NET normalization
Raw search payload:
- occupation or occupations or results or row

Canonical occupation:
- canonicalName
- onetCode
- title
- description
- source

Raw details payload:
- skills or skill or nested worker requirement structures

Canonical skill requirement:
- occupationCanonicalName
- skillName
- skillCategory
- importanceScore
- requiredProficiencyBand
- evidenceSource

## BLS normalization
Raw BLS payload:
- Results.series[0].data[0]

Canonical market signal:
- occupationCanonicalName
- geographyCode
- signalType
- signalValue
- signalDirection
- sourceName
- effectiveDate
- confidenceLevel
