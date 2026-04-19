create table if not exists academic_artifacts (
    academic_artifact_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    artifact_type text not null check (
        artifact_type in (
            'resume','transcript','other',
            'project','portfolio','presentation','certification'
        )
    ),
    file_uri text not null,
    source_label text,
    uploaded_at timestamptz not null default now(),
    parsed_status text not null default 'pending' check (parsed_status in ('pending','parsed','failed')),
    extracted_summary text
);

create index if not exists idx_academic_artifacts_student_uploaded
on academic_artifacts (student_profile_id, uploaded_at desc);

create table if not exists outreach_interactions (
    outreach_interaction_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    contact_id uuid references contacts(contact_id) on delete set null,
    interaction_type text not null check (
        interaction_type in (
            'intro_request','informational_interview','coffee_chat',
            'follow_up','application_referral','mentor_meeting','other'
        )
    ),
    outcome text,
    notes text,
    interaction_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_outreach_interactions_student_time
on outreach_interactions (student_profile_id, interaction_at desc);
