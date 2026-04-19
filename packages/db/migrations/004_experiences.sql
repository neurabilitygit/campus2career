create table if not exists experiences (
    experience_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    experience_type text not null check (
        experience_type in (
            'internship','micro_internship','research','volunteer',
            'campus_job','leadership','freelance_project','personal_project'
        )
    ),
    title text not null,
    organization text,
    paid_status text check (paid_status in ('paid','unpaid','stipend','unknown')),
    start_date date,
    end_date date,
    weekly_hours numeric(5,2),
    description text,
    deliverables_summary text,
    tools_used text[],
    supervisor_name text,
    reference_available boolean not null default false,
    relevance_rating integer check (relevance_rating between 1 and 5),
    evidence_file_uri text
);
