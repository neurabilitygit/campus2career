# Frontend Session Flow

## Current implementation
1. User signs in with Google through Supabase OAuth.
2. Supabase stores the browser session.
3. Frontend calls `supabase.auth.getSession()`.
4. API client attaches `Authorization: Bearer <access_token>`.
5. API verifies the Supabase JWT and resolves household/student context.
6. Dashboard pages fetch authenticated data from the API.

## Current dashboard pages
- /parent
- /student
- /coach

## Remaining work
- add role-aware redirects
- replace generic JSON cards with real UI components
- add session refresh / expired-session handling
