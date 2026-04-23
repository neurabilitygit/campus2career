# Frontend Session Flow

## Current implementation
1. The browser initializes a shared Supabase client from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. `apps/web/src/lib/sessionStore.ts` performs a one-time session bootstrap for the page load and subscribes to Supabase auth state changes.
3. `useSession()` reads that shared store through `useSyncExternalStore` instead of triggering a fresh auth check from every consumer.
4. `apiFetch()` reads the current Supabase access token and attaches `Authorization: Bearer <token>` to API requests.
5. The API verifies the JWT, resolves the authenticated user, and builds request context with the resolved student profile and household wiring.
6. Protected screens render through `SessionGate` and `RequireRole`, which show explicit loading, retry, and sign-in UI when auth is unresolved.

## Hardening changes now in place
- The session bootstrap runs once per page load instead of once per component mount.
- Slow session checks surface timeout/retry messaging rather than hanging indefinitely.
- Unknown auth roles are no longer silently coerced into a student context on the backend.
- Demo-header auth is gated by `ALLOW_DEMO_AUTH=true` and is not part of the normal web flow.

## Current dashboard pages
- `/app`
- `/student`
- `/parent`
- `/coach`
- `/onboarding`
- `/uploads`

## Operational notes
- A missing Supabase browser configuration disables real sign-in and upload behavior.
- `NEXT_PUBLIC_API_BASE_URL` must point to the API origin for authenticated requests to work.
- The current shell uses a desktop-style two-column layout with a fixed navigation pane and a flexible detail pane.
