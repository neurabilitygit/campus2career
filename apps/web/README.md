# Rising Senior Web App

Environment file:
- copy `apps/web/.env.example` to `apps/web/.env.local`

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

Optional environment variables:
- `NEXT_PUBLIC_APP_URL`

Startup:
- install from repo root with `pnpm install`
- run from repo root with `pnpm dev:web`
- or from this directory with `pnpm dev`

Current behavior:
- uses a shared Supabase session store from the browser
- attaches `Authorization: Bearer <token>` to API requests
- protects dashboards behind a session gate
- shows retry messaging when auth checks stall instead of hanging indefinitely
- performs signed uploads through Supabase Storage using:
  - backend `createSignedUploadUrl`
  - frontend `uploadToSignedUrl`
- renders the product inside a two-column desktop-style shell with a fixed navigation pane
