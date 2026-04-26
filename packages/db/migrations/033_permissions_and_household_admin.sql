alter table users
add column if not exists auth_provider text not null default 'supabase_google';

alter table users
add column if not exists is_super_admin boolean not null default false;

alter table households
add column if not exists created_by_parent_user_id uuid references users(user_id) on delete set null;

alter table user_household_roles
add column if not exists membership_status text not null default 'active'
check (membership_status in ('pending','active','suspended','removed'));

alter table user_household_roles
add column if not exists invited_by_user_id uuid references users(user_id) on delete set null;

alter table user_household_roles
add column if not exists approved_by_user_id uuid references users(user_id) on delete set null;

alter table user_household_roles
add column if not exists approved_at timestamptz;

alter table user_household_roles
add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_user_household_roles_user_status
on user_household_roles (user_id, membership_status, is_primary desc, created_at asc);

create index if not exists idx_user_household_roles_household_status
on user_household_roles (household_id, membership_status, role_in_household, created_at asc);

create table if not exists capabilities (
    capability_key text primary key,
    label text not null,
    description text not null,
    applicable_personas text[] not null default '{}',
    dependency_keys text[] not null default '{}',
    system_critical boolean not null default false,
    admin_changeable boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists persona_capability_defaults (
    persona_capability_default_id uuid primary key,
    persona text not null check (persona in ('student','parent','coach','admin')),
    capability_key text not null references capabilities(capability_key) on delete cascade,
    is_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (persona, capability_key)
);

create table if not exists user_capability_overrides (
    user_capability_override_id uuid primary key,
    user_id uuid not null references users(user_id) on delete cascade,
    household_id uuid references households(household_id) on delete cascade,
    capability_key text not null references capabilities(capability_key) on delete cascade,
    effect text not null check (effect in ('grant','deny')),
    created_by_user_id uuid references users(user_id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique nulls not distinct (user_id, household_id, capability_key)
);

create index if not exists idx_user_capability_overrides_user_household
on user_capability_overrides (user_id, household_id);

create table if not exists household_invitations (
    household_invitation_id uuid primary key,
    household_id uuid not null references households(household_id) on delete cascade,
    invited_email text not null,
    invited_persona text not null check (invited_persona in ('student','parent','coach','admin')),
    invited_by_user_id uuid not null references users(user_id) on delete cascade,
    invitation_token_hash text not null,
    status text not null default 'pending'
    check (status in ('pending','accepted','expired','revoked')),
    expires_at timestamptz not null,
    accepted_by_user_id uuid references users(user_id) on delete set null,
    accepted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists idx_household_invitations_token_hash
on household_invitations (invitation_token_hash);

create index if not exists idx_household_invitations_household_status
on household_invitations (household_id, status, invited_persona);

create table if not exists household_join_requests (
    household_join_request_id uuid primary key,
    household_id uuid references households(household_id) on delete cascade,
    requesting_user_id uuid not null references users(user_id) on delete cascade,
    requested_persona text not null check (requested_persona in ('student','parent','coach','admin')),
    requested_parent_email text,
    request_message text,
    status text not null default 'pending'
    check (status in ('pending','approved','denied','cancelled')),
    reviewed_by_user_id uuid references users(user_id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists idx_household_join_requests_pending_unique
on household_join_requests (requesting_user_id, requested_persona)
where status = 'pending';

create index if not exists idx_household_join_requests_household_status
on household_join_requests (household_id, status, requested_persona);

update users
set
    is_super_admin = true,
    role_type = 'admin',
    auth_provider = coalesce(auth_provider, 'supabase_google'),
    updated_at = now()
where lower(email) = 'eric.bassman@gmail.com'
   or (lower(first_name) = 'eric' and lower(last_name) = 'bass');
