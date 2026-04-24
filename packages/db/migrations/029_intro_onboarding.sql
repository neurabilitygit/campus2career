alter table users
  add column if not exists has_completed_intro_onboarding boolean not null default false,
  add column if not exists intro_onboarding_completed_at timestamptz,
  add column if not exists intro_onboarding_version integer not null default 1,
  add column if not exists intro_onboarding_skipped_at timestamptz,
  add column if not exists intro_onboarding_status text not null default 'not_started';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_intro_onboarding_status_check'
  ) then
    alter table users
      add constraint users_intro_onboarding_status_check
      check (intro_onboarding_status in ('not_started', 'completed', 'skipped'));
  end if;
end $$;

update users
set
  has_completed_intro_onboarding = true,
  intro_onboarding_completed_at = coalesce(intro_onboarding_completed_at, now()),
  intro_onboarding_version = 1,
  intro_onboarding_status = 'completed'
where intro_onboarding_status = 'not_started'
  and created_at < now();
