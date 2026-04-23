# Authenticated User Resolution

## Current sources of identity
1. Verified Supabase JWTs sent as `Authorization: Bearer <token>`
2. Demo headers only when `ALLOW_DEMO_AUTH=true`

Demo headers are not part of the normal production path and should remain off by default.

## Resolution flow
1. The API verifies the incoming auth token or gated demo-header identity.
2. `syncAuthenticatedUser()` upserts the authenticated user into the local `users` table.
3. `resolveRequestContext()` resolves:
   - authenticated user id
   - resolved application role
   - household id
   - student profile id
   - student user id
4. Student users may have a student profile created automatically if they authenticate before finishing onboarding.
5. Parent and coach users resolve through household wiring to the primary student profile.

## Hardening changes now in place
- Unknown or invalid resolved roles no longer silently fall back to `student`.
- If the role wiring is inconsistent, the API now fails explicitly with `auth_role_resolution_failed`.
- Test context switching is separately gated by `ALLOW_TEST_CONTEXT_SWITCHING=true` plus `TEST_SUPERUSER_EMAILS`.

## Current endpoints using request context
- `/auth/me`
- `GET /students/me/profile`
- `POST /students/me/profile`
- `GET /students/me/scoring`
- `POST /students/me/scoring/preview`
- `POST /students/me/scoring/explain`
- `POST /v1/chat/scenario/live`
- `GET /v1/briefs/live`
- `POST /v1/briefs/generate`
- `GET /v1/parents/me/briefs/latest`
- academic assignment, upload, and onboarding routes under `/students/me/...`
