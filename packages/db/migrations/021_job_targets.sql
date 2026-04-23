create table if not exists job_targets (
    job_target_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    title text not null,
    employer text,
    location text,
    source_type text not null check (
        source_type in ('manual','job_posting','partner_feed')
    ),
    source_url text,
    job_description_text text,
    normalized_role_family text,
    normalized_sector_cluster text,
    onet_code text,
    normalization_confidence numeric(4,3),
    is_primary boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_job_targets_student_updated
on job_targets (student_profile_id, updated_at desc);

create index if not exists idx_job_targets_student_primary
on job_targets (student_profile_id, is_primary, updated_at desc);
