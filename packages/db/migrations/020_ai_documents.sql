create table if not exists ai_documents (
    ai_document_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    source_llm_run_id uuid references llm_runs(llm_run_id) on delete set null,
    document_type text not null check (
        document_type in ('parent_brief','scenario_guidance','score_explanation')
    ),
    title text,
    body_markdown text not null,
    structured_payload jsonb,
    visible_to text not null check (
        visible_to in ('student','parent','coach','shared')
    ),
    created_at timestamptz not null default now()
);

create index if not exists idx_ai_documents_student_type_created
on ai_documents (student_profile_id, document_type, created_at desc);
