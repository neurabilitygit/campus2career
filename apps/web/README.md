# Campus2Career Web App

Required environment variables:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_API_BASE_URL

Current behavior:
- uses Supabase session from the browser
- attaches `Authorization: Bearer <token>` to API requests
- protects dashboards behind a session gate
- performs signed uploads through Supabase Storage using:
  - backend `createSignedUploadUrl`
  - frontend `uploadToSignedUrl`
