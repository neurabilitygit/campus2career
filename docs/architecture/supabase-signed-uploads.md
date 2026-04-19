# Supabase Signed Upload Flow

The repo now uses the official signed-upload pattern:

1. Backend uses the Supabase service role client to call:
   `storage.from(bucket).createSignedUploadUrl(path, { upsert })`

2. Backend returns:
   - bucket
   - path
   - token

3. Frontend uses the browser Supabase client to call:
   `storage.from(bucket).uploadToSignedUrl(path, token, fileBody, { contentType })`

Why this pattern:
- the signed upload URL can be created server-side
- the actual file upload happens directly from the browser
- the token is short-lived
- this avoids exposing the service role key in the browser

Implementation note:
The bucket must already exist.
