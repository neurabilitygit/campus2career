# Form and Upload Wiring

The repo now wires key frontend forms to real backend endpoints.

## Live-wired frontend screens
- /onboarding/profile -> POST /students/me/profile
- /onboarding/deadlines -> POST /students/me/deadlines
- /uploads/* -> POST /students/me/uploads/presign

## Backend routes
- POST /students/me/profile
- POST /students/me/deadlines
- POST /students/me/uploads/presign

## Current scope
- profile data persists to `student_profiles`
- deadlines persist to `deadlines`
- upload target generation is still a stub and must be replaced with Supabase signed upload URL generation
