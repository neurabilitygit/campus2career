create table if not exists target_paths (
    target_path_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    occupation_cluster_id uuid references occupation_clusters(occupation_cluster_id) on delete set null,
    priority_level integer not null check (priority_level between 1 and 5),
    status text not null check (status in ('active','exploratory','deprioritized','archived')),
    rationale text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists skill_gap_assessments (
    skill_gap_assessment_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    target_path_id uuid references target_paths(target_path_id) on delete set null,
    assessment_date timestamptz not null default now(),
    overall_gap_level text not null check (overall_gap_level in ('low','medium','high')),
    summary text,
    created_by text not null check (created_by in ('system','coach'))
);

create table if not exists skill_gap_items (
    skill_gap_item_id uuid primary key,
    skill_gap_assessment_id uuid not null references skill_gap_assessments(skill_gap_assessment_id) on delete cascade,
    skill_name text not null,
    required_level text not null check (required_level in ('basic','intermediate','advanced')),
    estimated_current_level text not null check (estimated_current_level in ('none','basic','intermediate','advanced')),
    gap_severity text not null check (gap_severity in ('low','medium','high')),
    evidence_summary text,
    recommendation_priority integer not null check (recommendation_priority between 1 and 5)
);

create table if not exists gap_closure_recommendations (
    gap_closure_recommendation_id uuid primary key,
    skill_gap_item_id uuid not null references skill_gap_items(skill_gap_item_id) on delete cascade,
    recommendation_type text not null check (
        recommendation_type in (
            'course','project','internship','research','volunteer',
            'certification','networking','ai_project','portfolio_piece'
        )
    ),
    recommendation_title text not null,
    description text not null,
    estimated_time_to_complete text,
    estimated_signal_strength text check (estimated_signal_strength in ('low','medium','high')),
    effort_level text check (effort_level in ('low','medium','high')),
    deadline_sensitivity text check (deadline_sensitivity in ('low','medium','high')),
    why_this_matches_student text,
    status text not null default 'proposed' check (status in ('proposed','accepted','deferred','completed','dismissed'))
);

create table if not exists action_plans (
    action_plan_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    planning_period_start date not null,
    planning_period_end date not null,
    plan_status text not null check (plan_status in ('draft','active','completed','archived')),
    generated_at timestamptz not null default now()
);

create table if not exists action_items (
    action_item_id uuid primary key,
    action_plan_id uuid not null references action_plans(action_plan_id) on delete cascade,
    title text not null,
    description text,
    action_category text,
    due_date date,
    priority_level integer check (priority_level between 1 and 5),
    linked_gap_item_id uuid references skill_gap_items(skill_gap_item_id) on delete set null,
    linked_target_path_id uuid references target_paths(target_path_id) on delete set null,
    status text not null check (status in ('pending','in_progress','completed','skipped')),
    completion_date timestamptz
);
