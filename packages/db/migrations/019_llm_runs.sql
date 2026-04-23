create table if not exists llm_runs (
    llm_run_id uuid primary key,
    student_profile_id uuid references student_profiles(student_profile_id) on delete set null,
    household_id uuid references households(household_id) on delete set null,
    run_type text not null check (
        run_type in (
            'scenario_chat',
            'parent_brief',
            'transcript_reconcile',
            'job_normalize',
            'score_explain',
            'requirements_repair'
        )
    ),
    model text not null,
    prompt_version text not null,
    status text not null check (
        status in ('started','succeeded','failed','timed_out')
    ),
    input_payload jsonb not null,
    output_payload jsonb,
    provider_error text,
    latency_ms integer,
    created_at timestamptz not null default now(),
    completed_at timestamptz
);

create index if not exists idx_llm_runs_student_created
on llm_runs (student_profile_id, created_at desc);

create index if not exists idx_llm_runs_type_created
on llm_runs (run_type, created_at desc);
