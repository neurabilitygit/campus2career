create table if not exists insight_objects (
    insight_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    insight_category text not null check (
        insight_category in (
            'motivation','blocker','strength','communication_style',
            'work_preference','risk_pattern','value_system',
            'developmental_pattern','unresolved_tension'
        )
    ),
    insight_statement text not null,
    confidence_score numeric(4,3) not null check (confidence_score >= 0 and confidence_score <= 1),
    status text not null check (status in ('active','tentative','deprecated','contradicted')),
    visibility_level text not null check (
        visibility_level in ('student_only','coach_only','parent_summary_eligible','shared')
    ),
    first_created_at timestamptz not null default now(),
    last_updated_at timestamptz not null default now(),
    created_by_source text not null check (
        created_by_source in ('system_inference','coach_confirmed','student_confirmed','parent_observation')
    ),
    evidence_count integer not null default 0,
    parent_safe_summary text
);

create table if not exists insight_evidence (
    insight_evidence_id uuid primary key,
    insight_id uuid not null references insight_objects(insight_id) on delete cascade,
    source_type text not null check (
        source_type in ('chat','reflection','academic_pattern','coach_note','action_pattern','parent_feedback')
    ),
    source_record_id uuid,
    evidence_excerpt text,
    evidence_weight numeric(4,3) not null,
    created_at timestamptz not null default now()
);

create table if not exists parent_monthly_briefs (
    parent_monthly_brief_id uuid primary key,
    household_id uuid references households(household_id) on delete set null,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    month_label text not null,
    trajectory_status text not null check (trajectory_status in ('on_track','watch','at_risk')),
    key_market_changes text,
    progress_summary text,
    top_risks text,
    recommended_parent_questions text,
    recommended_parent_actions text,
    generated_at timestamptz not null default now(),
    delivered_at timestamptz
);
