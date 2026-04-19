create table if not exists student_transcripts (
    student_transcript_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    academic_artifact_id uuid references academic_artifacts(academic_artifact_id) on delete set null,
    institution_id uuid references institutions(institution_id) on delete set null,
    parsed_status text not null default 'pending' check (
        parsed_status in ('pending','parsed','matched','review_required','failed')
    ),
    transcript_summary text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists transcript_terms (
    transcript_term_id uuid primary key,
    student_transcript_id uuid not null references student_transcripts(student_transcript_id) on delete cascade,
    term_label text not null,
    term_start_date date,
    term_end_date date,
    display_order integer
);

create table if not exists transcript_courses (
    transcript_course_id uuid primary key,
    transcript_term_id uuid not null references transcript_terms(transcript_term_id) on delete cascade,
    raw_course_code text,
    raw_course_title text not null,
    credits_attempted numeric(5,2),
    credits_earned numeric(5,2),
    grade text,
    completion_status text not null check (
        completion_status in ('completed','in_progress','withdrawn','transfer','ap_ib','failed','repeated')
    ),
    raw_text_excerpt text,
    created_at timestamptz not null default now()
);

create table if not exists transcript_course_matches (
    transcript_course_match_id uuid primary key,
    transcript_course_id uuid not null references transcript_courses(transcript_course_id) on delete cascade,
    catalog_course_id uuid references catalog_courses(catalog_course_id) on delete set null,
    match_status text not null check (
        match_status in ('exact','fuzzy','manual','unmatched')
    ),
    confidence_score numeric(4,3),
    reviewer_note text,
    created_at timestamptz not null default now(),
    unique (transcript_course_id)
);

create index if not exists idx_student_transcripts_student
on student_transcripts (student_profile_id, created_at desc);

create index if not exists idx_transcript_terms_transcript
on transcript_terms (student_transcript_id, display_order);

create index if not exists idx_transcript_courses_term
on transcript_courses (transcript_term_id, raw_course_code);

create index if not exists idx_transcript_course_matches_catalog
on transcript_course_matches (catalog_course_id, match_status);
