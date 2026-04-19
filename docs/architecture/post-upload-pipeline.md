# Post-Upload Pipeline

The repo now supports:

1. browser upload to signed Supabase Storage target
2. upload completion callback to the backend
3. academic artifact persistence
4. artifact parse job queue creation
5. worker-side parse job processing stub
6. onboarding upload flag updates
7. first diagnostic generation with onboarding completion evaluation

## New endpoints
- POST /students/me/onboarding/cluster-selection
- POST /students/me/uploads/complete
- GET /students/me/diagnostic/first
