create table if not exists onboarding_states (
    onboarding_state_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    profile_completed boolean not null default false,
    sectors_completed boolean not null default false,
    uploads_completed boolean not null default false,
    network_completed boolean not null default false,
    deadlines_completed boolean not null default false,
    onboarding_completed boolean not null default false,
    first_diagnostic_generated boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_profile_id)
);

create table if not exists artifact_parse_jobs (
    artifact_parse_job_id uuid primary key,
    academic_artifact_id uuid not null references academic_artifacts(academic_artifact_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    artifact_type text not null,
    status text not null check (status in ('queued','processing','completed','failed')),
    parser_type text not null,
    result_summary text,
    error_message text,
    queued_at timestamptz not null default now(),
    started_at timestamptz,
    completed_at timestamptz
);

create table if not exists student_sector_selections (
    student_sector_selection_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    sector_cluster text not null,
    created_at timestamptz not null default now(),
    unique (student_profile_id, sector_cluster)
);

create index if not exists idx_artifact_parse_jobs_status
on artifact_parse_jobs (status, queued_at);
