create table if not exists coach_student_relationships (
    coach_student_relationship_id uuid primary key,
    coach_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    relationship_status text not null check (relationship_status in ('pending','active','paused','ended')),
    start_date date,
    end_date date,
    next_review_date date,
    created_by_user_id uuid references users(user_id) on delete set null,
    can_view_student_profile boolean not null default true,
    can_view_evidence boolean not null default true,
    can_create_notes boolean not null default true,
    can_create_recommendations boolean not null default true,
    can_create_action_items boolean not null default true,
    can_send_communications boolean not null default true,
    can_view_parent_facing_summaries boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (coach_user_id, student_profile_id)
);

create index if not exists idx_coach_student_relationships_coach_status
on coach_student_relationships (coach_user_id, relationship_status, updated_at desc);

create table if not exists coach_notes (
    coach_note_id uuid primary key,
    coach_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    note_type text not null check (note_type in ('session_note','observation','risk_note','strength_note','parent_context_note','follow_up_note','other')),
    title text not null,
    body text not null,
    tags text[] not null default '{}',
    visibility text not null check (visibility in ('coach_private','student_visible','parent_visible','student_and_parent_visible','internal_system_context')),
    session_date date,
    linked_evidence_ids text[] not null default '{}',
    linked_action_item_ids text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz
);

create index if not exists idx_coach_notes_student_created
on coach_notes (student_profile_id, created_at desc);

create table if not exists coach_findings (
    coach_finding_id uuid primary key,
    coach_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    title text not null,
    finding_category text not null check (finding_category in ('academic_gap','career_direction','execution_risk','communication_issue','motivation_or_confidence','experience_gap','network_gap','application_strategy','strength','other')),
    severity text not null check (severity in ('low','medium','high','urgent')),
    evidence_basis text,
    explanation text not null,
    visibility text not null check (visibility in ('coach_private','student_visible','parent_visible','student_and_parent_visible','internal_system_context')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz
);

create index if not exists idx_coach_findings_student_created
on coach_findings (student_profile_id, created_at desc);

create table if not exists coach_recommendations (
    coach_recommendation_id uuid primary key,
    coach_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    title text not null,
    recommendation_category text not null check (recommendation_category in ('academic','career_target','resume','internship_search','networking','interview_prep','project_or_portfolio','communication','outcome_tracking','other')),
    rationale text not null,
    recommended_next_step text not null,
    expected_benefit text,
    priority text not null check (priority in ('low','medium','high','urgent')),
    due_date date,
    visibility text not null check (visibility in ('coach_private','student_visible','parent_visible','student_and_parent_visible','internal_system_context')),
    status text not null check (status in ('draft','active','accepted','declined','completed','archived')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz
);

create index if not exists idx_coach_recommendations_student_status
on coach_recommendations (student_profile_id, status, updated_at desc);

create table if not exists coach_action_items (
    coach_action_item_id uuid primary key,
    coach_user_id uuid not null references users(user_id) on delete cascade,
    coach_recommendation_id uuid references coach_recommendations(coach_recommendation_id) on delete set null,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    title text not null,
    description text,
    priority text not null check (priority in ('low','medium','high','urgent')),
    due_date date,
    status text not null check (status in ('not_started','in_progress','blocked','completed','deferred','archived')),
    assigned_to text not null check (assigned_to in ('student','parent','coach','shared')),
    visible_to_student boolean not null default false,
    visible_to_parent boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz
);

create index if not exists idx_coach_action_items_student_status
on coach_action_items (student_profile_id, status, updated_at desc);

create table if not exists coach_flags (
    coach_flag_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    created_by_user_id uuid references users(user_id) on delete set null,
    created_by_role text not null check (created_by_role in ('coach','admin','system')),
    flag_type text not null check (flag_type in ('missing_evidence','academic_risk','application_stall','communication_breakdown','missed_deadline','no_outcome_activity','high_parent_concern','coach_attention_needed','other')),
    severity text not null check (severity in ('info','warning','high','urgent')),
    title text not null,
    description text not null,
    status text not null check (status in ('open','acknowledged','resolved','archived')),
    visibility text not null check (visibility in ('coach_private','student_visible','parent_visible','student_and_parent_visible','internal_system_context')),
    linked_evidence_ids text[] not null default '{}',
    created_at timestamptz not null default now(),
    resolved_at timestamptz,
    archived_at timestamptz
);

create index if not exists idx_coach_flags_student_status
on coach_flags (student_profile_id, status, created_at desc);

create table if not exists coach_outbound_messages (
    coach_outbound_message_id uuid primary key,
    coach_user_id uuid not null references users(user_id) on delete cascade,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    recipient_type text not null check (recipient_type in ('student','parent')),
    recipient_user_id uuid references users(user_id) on delete set null,
    channel text not null check (channel in ('email','sms','whatsapp')),
    subject text,
    body text not null,
    status text not null check (status in ('draft','ready','sent','failed','archived')),
    provider_mode text not null check (provider_mode in ('mock','provider_disabled','not_sent')),
    external_message_id text,
    linked_coach_action_item_id uuid references coach_action_items(coach_action_item_id) on delete set null,
    linked_coach_recommendation_id uuid references coach_recommendations(coach_recommendation_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    sent_at timestamptz,
    archived_at timestamptz
);

create index if not exists idx_coach_outbound_messages_student_status
on coach_outbound_messages (student_profile_id, status, created_at desc);

insert into coach_student_relationships (
    coach_student_relationship_id,
    coach_user_id,
    student_profile_id,
    household_id,
    relationship_status,
    start_date,
    created_by_user_id,
    can_view_student_profile,
    can_view_evidence,
    can_create_notes,
    can_create_recommendations,
    can_create_action_items,
    can_send_communications,
    can_view_parent_facing_summaries,
    created_at,
    updated_at
)
select
    (
      substr(md5(uhr.user_id::text || ':' || sp.student_profile_id::text), 1, 8) || '-' ||
      substr(md5(uhr.user_id::text || ':' || sp.student_profile_id::text), 9, 4) || '-' ||
      substr(md5(uhr.user_id::text || ':' || sp.student_profile_id::text), 13, 4) || '-' ||
      substr(md5(uhr.user_id::text || ':' || sp.student_profile_id::text), 17, 4) || '-' ||
      substr(md5(uhr.user_id::text || ':' || sp.student_profile_id::text), 21, 12)
    )::uuid,
    uhr.user_id,
    sp.student_profile_id,
    uhr.household_id,
    'active',
    now()::date,
    uhr.user_id,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    now(),
    now()
from user_household_roles uhr
join households h on h.household_id = uhr.household_id
join student_profiles sp on sp.user_id = h.primary_student_user_id
where uhr.role_in_household = 'coach'
on conflict (coach_user_id, student_profile_id) do nothing;
