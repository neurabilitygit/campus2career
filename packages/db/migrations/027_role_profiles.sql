alter table users
add column if not exists preferred_name text;

alter table student_profiles
add column if not exists age integer check (age between 0 and 130);

alter table student_profiles
add column if not exists gender text;

alter table student_profiles
add column if not exists housing_status text;

alter table student_profiles
add column if not exists known_neurodivergent_categories text[];

alter table student_profiles
add column if not exists other_neurodivergent_description text;

alter table student_profiles
add column if not exists communication_preferences text;

alter table student_profiles
add column if not exists personal_choices text;

create table if not exists parent_profiles (
    parent_profile_id uuid primary key,
    parent_user_id uuid not null unique references users(user_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    family_unit_name text,
    relationship_to_student text,
    household_members jsonb not null default '[]'::jsonb,
    family_structure text,
    partnership_structure text,
    known_neurodivergent_categories text[] not null default '{}',
    demographic_information text,
    communication_preferences text,
    parent_goals_or_concerns text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_parent_profiles_household
on parent_profiles (household_id, updated_at desc);

create table if not exists coach_profiles (
    coach_profile_id uuid primary key,
    coach_user_id uuid not null unique references users(user_id) on delete cascade,
    professional_title text,
    organization_name text,
    coaching_specialties text[] not null default '{}',
    communication_preferences text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_coach_profiles_updated
on coach_profiles (updated_at desc);
