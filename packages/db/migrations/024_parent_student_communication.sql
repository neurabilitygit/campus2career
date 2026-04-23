alter table if exists llm_runs
  drop constraint if exists llm_runs_run_type_check;

alter table if exists llm_runs
  add constraint llm_runs_run_type_check check (
    run_type in (
      'scenario_chat',
      'parent_brief',
      'transcript_reconcile',
      'job_normalize',
      'score_explain',
      'requirements_repair',
      'communication_translation'
    )
  );

create table if not exists student_communication_preferences (
    student_communication_preference_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    preferred_channels text[] not null default '{}'::text[],
    disliked_channels text[] not null default '{}'::text[],
    preferred_tone text check (
        preferred_tone in ('gentle','neutral','direct','encouraging','question_led','summary_first')
    ),
    sensitive_topics text[] not null default '{}'::text[],
    preferred_frequency text check (
        preferred_frequency in ('as_needed','weekly','biweekly','monthly')
    ),
    best_time_of_day text check (
        best_time_of_day in ('morning','afternoon','evening','late_night','weekend','variable')
    ),
    preferred_guidance_formats text[] not null default '{}'::text[],
    identify_parent_origin boolean not null default true,
    allow_parent_concern_rephrasing boolean not null default false,
    consent_parent_translated_messages boolean not null default false,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_profile_id)
);

create table if not exists parent_communication_profiles (
    parent_communication_profile_id uuid primary key,
    parent_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    main_worries text,
    usual_approach text,
    what_does_not_work text,
    wants_to_improve text,
    send_preference text check (
        send_preference in ('review_before_send','send_direct_if_allowed')
    ),
    preferred_communication_style text,
    consent_acknowledged boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (parent_user_id, student_profile_id)
);

create table if not exists parent_communication_entries (
    parent_communication_entry_id uuid primary key,
    parent_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    category text not null check (
        category in (
            'career_concern',
            'academic_concern',
            'internship_job_search_concern',
            'financial_tuition_concern',
            'independence_life_skills_concern',
            'emotional_motivational_concern',
            'logistical_question',
            'other'
        )
    ),
    status text not null check (
        status in (
            'draft',
            'saved_as_context',
            'ready_for_translation',
            'translated',
            'queued_for_delivery',
            'delivered',
            'student_responded',
            'archived'
        )
    ),
    urgency text not null check (
        urgency in ('low','medium','high','urgent')
    ),
    delivery_intent text not null check (
        delivery_intent in ('context_only','direct','indirect','delayed')
    ),
    facts_student_should_know text,
    questions_parent_wants_answered text,
    parent_concerns text,
    recurring_communication_failures text,
    defensive_topics text,
    prior_attempts_that_did_not_work text,
    preferred_outcome text,
    freeform_context text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz
);

create index if not exists idx_parent_communication_entries_scope
on parent_communication_entries (student_profile_id, parent_user_id, created_at desc);

create table if not exists communication_translation_strategies (
    communication_strategy_id uuid primary key,
    parent_communication_entry_id uuid not null references parent_communication_entries(parent_communication_entry_id) on delete cascade,
    parent_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    source_llm_run_id uuid references llm_runs(llm_run_id) on delete set null,
    generation_mode text not null check (generation_mode in ('llm','fallback')),
    consent_state text not null check (consent_state in ('granted','withheld','unknown')),
    status text not null check (
        status in ('generated','review_required','withheld','approved','queued','delivered','archived')
    ),
    recommended_channel text check (recommended_channel in ('email','sms','whatsapp')),
    recommended_tone text check (
        recommended_tone in ('gentle','neutral','direct','encouraging','question_led','summary_first')
    ),
    recommended_timing text,
    recommended_frequency text check (
        recommended_frequency in ('as_needed','weekly','biweekly','monthly')
    ),
    defensiveness_risk text not null check (defensiveness_risk in ('low','medium','high')),
    reason_for_recommendation text not null,
    student_facing_message_draft text not null,
    parent_facing_explanation text not null,
    what_not_to_say text not null,
    human_review_recommended boolean not null default false,
    withhold_delivery boolean not null default false,
    withhold_reason text,
    structured_payload jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_communication_translation_scope
on communication_translation_strategies (student_profile_id, parent_user_id, created_at desc);

create table if not exists communication_message_drafts (
    communication_message_draft_id uuid primary key,
    communication_strategy_id uuid not null references communication_translation_strategies(communication_strategy_id) on delete cascade,
    parent_communication_entry_id uuid not null references parent_communication_entries(parent_communication_entry_id) on delete cascade,
    parent_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    selected_channel text not null check (selected_channel in ('email','sms','whatsapp')),
    provider_mode text not null check (provider_mode in ('mock','provider_disabled','not_sent')),
    status text not null check (
        status in ('generated','review_required','withheld','approved','queued','delivered','archived')
    ),
    message_body text not null,
    review_required boolean not null default false,
    approved_for_delivery boolean not null default false,
    approved_at timestamptz,
    delivered_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_communication_message_drafts_scope
on communication_message_drafts (student_profile_id, parent_user_id, created_at desc);

create table if not exists communication_audit_logs (
    communication_audit_log_id uuid primary key,
    parent_communication_entry_id uuid references parent_communication_entries(parent_communication_entry_id) on delete set null,
    communication_strategy_id uuid references communication_translation_strategies(communication_strategy_id) on delete set null,
    communication_message_draft_id uuid references communication_message_drafts(communication_message_draft_id) on delete set null,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    actor_user_id uuid references users(user_id) on delete set null,
    actor_role text not null check (actor_role in ('student','parent','coach','admin','system')),
    event_type text not null check (
        event_type in (
            'student_preferences_updated',
            'parent_profile_updated',
            'entry_created',
            'entry_updated',
            'entry_status_changed',
            'strategy_generated',
            'strategy_withheld',
            'draft_saved',
            'delivery_requested',
            'delivery_blocked',
            'delivery_mocked'
        )
    ),
    event_summary text not null,
    event_payload jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_communication_audit_scope
on communication_audit_logs (student_profile_id, created_at desc);
