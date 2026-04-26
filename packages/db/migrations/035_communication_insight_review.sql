create table if not exists communication_inferred_insights (
  communication_inferred_insight_id uuid primary key,
  communication_profile_id uuid not null references communication_profiles(communication_profile_id) on delete cascade,
  insight_key text not null,
  insight_type text not null,
  title text not null,
  summary_text text not null,
  evidence_json jsonb,
  confidence_label text not null default 'medium',
  status text not null default 'pending_review',
  reviewed_by_user_id uuid references users(user_id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  last_derived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (communication_profile_id, insight_key)
);

create index if not exists idx_communication_inferred_insights_profile
  on communication_inferred_insights (communication_profile_id, updated_at desc);
