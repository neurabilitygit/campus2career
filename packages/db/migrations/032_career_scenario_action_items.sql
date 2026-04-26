create table if not exists career_scenario_action_items (
  career_scenario_action_item_id uuid primary key,
  career_scenario_id uuid not null references career_scenarios(career_scenario_id) on delete cascade,
  student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
  title text not null,
  description text,
  rationale text,
  action_category text,
  priority text not null check (priority in ('high', 'medium', 'low')),
  timeframe text,
  source_kind text not null check (source_kind in ('scenario_specific', 'recommendation', 'evidence_gap')),
  status text not null default 'active' check (status in ('active', 'completed', 'dismissed')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_career_scenario_action_items_scenario_status
on career_scenario_action_items (career_scenario_id, status, sort_order, updated_at desc);

create index if not exists idx_career_scenario_action_items_student_status
on career_scenario_action_items (student_profile_id, status, updated_at desc);
