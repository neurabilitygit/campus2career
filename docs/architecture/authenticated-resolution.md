# Authenticated User Resolution

The repo now resolves request context from an authenticated user abstraction.

## Current MVP stub
Headers:
- x-demo-user-id
- x-demo-role-type
- x-demo-email

## Resolution logic
- student users resolve directly to their own student profile
- parent / coach users resolve to the household and primary student profile

## Current endpoints using request context
- /auth/me
- `GET /v1/briefs/live` (read persisted brief for current reporting month)
- `POST /v1/briefs/generate` (create or refresh brief for that month)
- `POST /v1/chat/scenario/live` (JSON body: `scenarioQuestion`, optional `communicationStyle`)

## Next replacement step
Replace the header-based auth stub with verified Supabase JWT or session-cookie resolution.
