create table if not exists student_outcomes (
    student_outcome_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    job_target_id uuid references job_targets(job_target_id) on delete set null,
    target_role_family text,
    target_sector_cluster text,
    outcome_type text not null check (
        outcome_type in ('internship_application','interview','offer','accepted_role')
    ),
    status text not null check (
        status in ('not_started','in_progress','applied','interviewing','offer','accepted')
    ),
    employer_name text,
    role_title text,
    source_type text not null check (
        source_type in ('student_report','parent_report','coach_report','admin_report')
    ),
    reported_by_user_id uuid references users(user_id) on delete set null,
    reported_by_role text not null check (
        reported_by_role in ('student','parent','coach','admin')
    ),
    verification_status text not null check (
        verification_status in ('self_reported','coach_reviewed','parent_reported','verified','disputed')
    ),
    action_date date not null,
    action_date_label text not null check (
        action_date_label in ('applied_date','interview_date','offer_date','accepted_date')
    ),
    notes text,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_student_outcomes_student_timeline
on student_outcomes (student_profile_id, action_date desc, created_at desc);

create index if not exists idx_student_outcomes_student_status
on student_outcomes (student_profile_id, status, archived_at);

create index if not exists idx_student_outcomes_student_verification
on student_outcomes (student_profile_id, verification_status, archived_at);
