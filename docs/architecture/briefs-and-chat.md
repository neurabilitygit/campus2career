# Parent Briefs and Scenario Chat

## Parent brief generator
Inputs:
- live scoring output
- accomplishments
- target goal
- upcoming deadlines
- parent-visible insights

Outputs:
- persisted monthly parent brief for the resolved household student
- current-month regenerate flow through `POST /v1/briefs/generate`
- latest persisted-brief read through `GET /v1/parents/me/briefs/latest`

## Scenario chat
Inputs:
- live scoring output
- resolved target role family
- resolved sector cluster
- communication style
- scenario question
- parent-visible insights

Outputs:
- structured student guidance with:
  - headline
  - summary
  - why-this-matters explanation
  - recommended actions
  - risks to watch
  - encouragement
  - supporting basis
- persisted AI document row for the student-facing scenario guidance

## Fallback behavior
- Scenario chat may still return a fallback structured response when the provider times out or fails.
- Fallback responses are explicitly labeled with `mode: "fallback"` and carry provider error detail when available.
- This fallback is user-visible and should be treated as degraded guidance rather than primary LLM output.

## Current repo endpoints
- `GET /v1/briefs/demo`
- `GET /v1/briefs/live`
- `POST /v1/briefs/generate`
- `GET /v1/parents/me/briefs/latest`
- `GET /v1/chat/scenario/demo`
- `POST /v1/chat/scenario/live`
