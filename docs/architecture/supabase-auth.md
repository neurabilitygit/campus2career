# Supabase Auth Integration

## Frontend
The web app now includes:
- `supabaseClient.ts`
- Google OAuth sign-in button
- auth callback page

## API
The API now supports:
- Authorization Bearer token handling
- Supabase JWT verification via `jose`
- fallback demo headers for local testing

## Current verification model
The API verifies Supabase JWTs using `SUPABASE_JWT_SECRET`.

## Next step
Replace the current callback placeholder with a session-aware frontend shell and attach the bearer token to API requests.
