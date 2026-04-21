create table if not exists upload_targets (
    upload_target_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    artifact_type text not null check (
        artifact_type in (
            'resume','transcript','other',
            'project','portfolio','presentation','certification'
        )
    ),
    bucket text not null,
    object_path text not null unique,
    token_hash text,
    issued_at timestamptz not null default now(),
    expires_at timestamptz not null,
    consumed_at timestamptz
);

create index if not exists idx_upload_targets_student_object
on upload_targets (student_profile_id, object_path);

create index if not exists idx_upload_targets_expiry
on upload_targets (expires_at);
