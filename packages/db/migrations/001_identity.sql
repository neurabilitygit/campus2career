create table if not exists users (
    user_id uuid primary key,
    role_type text not null check (role_type in ('student','parent','coach','admin')),
    first_name text not null,
    last_name text not null,
    email text not null unique,
    phone text,
    timezone text default 'America/New_York',
    preferred_language text default 'en',
    account_status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists households (
    household_id uuid primary key,
    household_name text,
    primary_student_user_id uuid references users(user_id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists user_household_roles (
    user_household_role_id uuid primary key,
    household_id uuid not null references households(household_id) on delete cascade,
    user_id uuid not null references users(user_id) on delete cascade,
    role_in_household text not null check (role_in_household in ('student','parent','guardian','coach')),
    is_primary boolean not null default false,
    created_at timestamptz not null default now(),
    unique (household_id, user_id, role_in_household)
);
