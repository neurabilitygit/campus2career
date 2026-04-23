# Scoring Engine

## Current inputs
The live scoring path builds a `StudentScoringInput` from:

- exact target job normalization when the student has saved a specific target
- sector-to-role mapping when no exact target exists but a selected sector can still resolve a seeded role family
- occupation metadata and imported market signals
- occupation skill requirements
- transcript evidence and transcript-to-catalog matching results
- requirement-set progress for the student’s bound catalog and major
- experiences, uploaded artifacts, contacts, outreach history, and deadlines
- student-level signals such as academic year, project evidence, mentor depth, and deadline misses

## Guardrails now in place
- Scoring no longer fabricates a default `"financial analyst"` role when the student has neither an exact target job nor a valid sector-to-role mapping.
- If no target can be resolved, the API now returns `target_role_unresolved` and the student must choose a target or sector before scoring continues.
- Transcript parse failures no longer create placeholder transcript records that could inflate or distort readiness.

## Current subscores
- `roleAlignment`
- `marketDemand`
- `academicReadiness`
- `experienceStrength`
- `proofOfWorkStrength`
- `networkStrength`
- `executionMomentum`

## Current scoring logic
- `roleAlignment` compares role-skill requirements against evidence from course coverage, experiences, artifacts, and AI/tool signals.
- `marketDemand` is derived from imported market signals such as demand growth, unemployment pressure, internship availability, wage, and AI disruption.
- `academicReadiness` combines transcript evidence, transcript-to-catalog match rate, requirement completion, requirement-group completion, and confidence in the academic mapping.
- `experienceStrength` weights the number and role-relevance of experiences.
- `proofOfWorkStrength` looks at visible artifacts and independent project evidence.
- `networkStrength` uses contacts, outreach, and mentor strength.
- `executionMomentum` reflects deadline misses plus a small boost when transcript matching is complete.

## Output
The engine returns:

- overall score
- trajectory status
- subscores
- heuristic flags
- top strengths
- top risks
- skill gaps
- prioritized recommendations

## Trajectory status
Trajectory status is derived from:

- weighted subscore mix
- critical heuristic flags
- academic-readiness weakness
- milestone failures such as no internship by junior year
- network weakness and repeated execution misses
