create table if not exists communication_profiles (
    communication_profile_id uuid primary key,
    household_id uuid references households(household_id) on delete set null,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_profile_id)
);

create index if not exists idx_communication_profiles_household
on communication_profiles (household_id, student_profile_id);

create table if not exists parent_communication_inputs (
    parent_communication_input_id uuid primary key,
    communication_profile_id uuid not null references communication_profiles(communication_profile_id) on delete cascade,
    parent_user_id uuid not null references users(user_id) on delete cascade,
    category text not null,
    prompt_key text not null,
    question_text text not null,
    response_text text not null,
    sensitivity_level text not null check (sensitivity_level in ('low','medium','high')),
    visibility_scope text not null check (
        visibility_scope in (
            'private_to_user',
            'visible_to_household_admin',
            'visible_to_student',
            'visible_to_parent',
            'visible_to_coach',
            'visible_to_system_only',
            'shared_summary_only'
        )
    ),
    confidence_level text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (communication_profile_id, parent_user_id, prompt_key)
);

create index if not exists idx_parent_communication_inputs_scope
on parent_communication_inputs (communication_profile_id, parent_user_id, updated_at desc);

create table if not exists student_communication_inputs (
    student_communication_input_id uuid primary key,
    communication_profile_id uuid not null references communication_profiles(communication_profile_id) on delete cascade,
    student_user_id uuid not null references users(user_id) on delete cascade,
    category text not null,
    prompt_key text not null,
    question_text text not null,
    response_text text not null,
    sensitivity_level text not null check (sensitivity_level in ('low','medium','high')),
    visibility_scope text not null check (
        visibility_scope in (
            'private_to_user',
            'visible_to_household_admin',
            'visible_to_student',
            'visible_to_parent',
            'visible_to_coach',
            'visible_to_system_only',
            'shared_summary_only'
        )
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (communication_profile_id, student_user_id, prompt_key)
);

create index if not exists idx_student_communication_inputs_scope
on student_communication_inputs (communication_profile_id, student_user_id, updated_at desc);

create table if not exists communication_translation_events (
    communication_translation_event_id uuid primary key,
    communication_profile_id uuid not null references communication_profiles(communication_profile_id) on delete cascade,
    source_role text not null check (source_role in ('parent','student','coach')),
    target_role text not null check (target_role in ('parent','student','coach')),
    original_text text not null,
    translated_text text not null,
    translation_goal text not null check (
        translation_goal in (
            'clarify',
            'reduce_friction',
            'reminder',
            'check_in',
            'boundary_setting',
            'status_update',
            'encouragement'
        )
    ),
    tone text check (
        tone in ('gentle','neutral','direct','encouraging','question_led','summary_first')
    ),
    context_used_json jsonb,
    structured_result_json jsonb,
    feedback_rating text check (
        feedback_rating in (
            'helpful',
            'not_helpful',
            'too_direct',
            'too_soft',
            'missed_the_point',
            'made_it_worse',
            'other'
        )
    ),
    feedback_notes text,
    created_by_user_id uuid not null references users(user_id) on delete cascade,
    created_at timestamptz not null default now()
);

create index if not exists idx_communication_translation_events_scope
on communication_translation_events (communication_profile_id, created_at desc);

create table if not exists communication_prompt_progress (
    communication_prompt_progress_id uuid primary key,
    communication_profile_id uuid not null references communication_profiles(communication_profile_id) on delete cascade,
    user_id uuid not null references users(user_id) on delete cascade,
    role text not null check (role in ('parent','student')),
    prompt_key text not null,
    status text not null check (status in ('unanswered','answered','skipped','revisit_later')),
    last_prompted_at timestamptz,
    answered_at timestamptz,
    updated_at timestamptz not null default now(),
    unique (communication_profile_id, user_id, prompt_key)
);

create index if not exists idx_communication_prompt_progress_scope
on communication_prompt_progress (communication_profile_id, user_id, role, updated_at desc);

create table if not exists communication_learning_events (
    communication_learning_event_id uuid primary key,
    communication_profile_id uuid not null references communication_profiles(communication_profile_id) on delete cascade,
    event_type text not null check (
        event_type in (
            'translation_feedback',
            'prompt_answered',
            'prompt_skipped',
            'prompt_revisit_requested',
            'summary_generated'
        )
    ),
    source_role text not null check (source_role in ('student','parent','coach','admin','system')),
    signal_json jsonb,
    interpretation_json jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_communication_learning_events_scope
on communication_learning_events (communication_profile_id, created_at desc);
