create table if not exists consent_scopes (
    consent_scope_id uuid primary key,
    student_user_id uuid not null references users(user_id) on delete cascade,
    grantee_user_id uuid not null references users(user_id) on delete cascade,
    scope_type text not null check (
        scope_type in (
            'parent_summary',
            'alerts',
            'deadlines',
            'academic_overview',
            'action_progress',
            'coach_notes',
            'insight_summary',
            'chat_summary'
        )
    ),
    access_level text not null check (access_level in ('none','limited','full')),
    granted_at timestamptz not null default now(),
    revoked_at timestamptz,
    expires_at timestamptz,
    notes text
);
