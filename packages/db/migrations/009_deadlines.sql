create table if not exists deadlines (
    deadline_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    title text not null,
    due_date date not null,
    deadline_type text not null,
    notes text,
    completed boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_deadlines_student_due_date
on deadlines (student_profile_id, due_date);
