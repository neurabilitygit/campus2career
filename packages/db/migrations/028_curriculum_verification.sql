create table if not exists student_curriculum_reviews (
  student_profile_id uuid primary key references student_profiles(student_profile_id) on delete cascade,
  curriculum_verification_status text not null default 'missing'
    check (curriculum_verification_status in ('missing', 'present_unverified', 'verified', 'needs_attention')),
  curriculum_verified_at timestamptz null,
  curriculum_verified_by_user_id uuid null references users(user_id),
  curriculum_verification_notes text null,
  curriculum_source text null
    check (curriculum_source in ('direct_scrape', 'artifact_pdf', 'manual', 'llm_assisted', 'synthetic_seed', 'unknown')),
  curriculum_requested_at timestamptz null,
  curriculum_requested_by_user_id uuid null references users(user_id),
  curriculum_pdf_upload_id uuid null references academic_artifacts(academic_artifact_id),
  coach_reviewed_at timestamptz null,
  coach_reviewed_by_user_id uuid null references users(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_curriculum_reviews_verified_by
  on student_curriculum_reviews (curriculum_verified_by_user_id);

create index if not exists idx_student_curriculum_reviews_requested_by
  on student_curriculum_reviews (curriculum_requested_by_user_id);
