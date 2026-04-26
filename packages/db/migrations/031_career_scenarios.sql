create table if not exists career_scenarios (
  career_scenario_id uuid primary key,
  student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
  linked_job_target_id uuid references job_targets(job_target_id) on delete set null,
  scenario_name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'needs_rerun', 'complete', 'error', 'archived')),
  is_active boolean not null default false,
  job_description_text text,
  target_role text,
  target_profession text,
  target_industry text,
  target_sector text,
  target_geography text,
  employer_name text,
  job_posting_url text,
  notes text,
  assumptions_json jsonb not null default '{}'::jsonb,
  extracted_requirements_json jsonb,
  analysis_result_json jsonb,
  readiness_score_snapshot_json jsonb,
  recommendations_snapshot_json jsonb,
  source_type text not null default 'manual_target'
    check (source_type in ('pasted_job_description', 'manual_target', 'imported', 'mixed')),
  created_by_user_id uuid,
  updated_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz,
  deleted_at timestamptz
);

create index if not exists idx_career_scenarios_student_updated
on career_scenarios (student_profile_id, updated_at desc)
where deleted_at is null;

create unique index if not exists idx_career_scenarios_unique_name_per_student
on career_scenarios (student_profile_id, lower(scenario_name))
where deleted_at is null;

create unique index if not exists idx_career_scenarios_one_active_per_student
on career_scenarios (student_profile_id)
where deleted_at is null and is_active = true;
