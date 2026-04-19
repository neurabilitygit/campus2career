create table if not exists contacts (
    contact_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    contact_name text not null check (char_length(btrim(contact_name)) > 0),
    relationship_type text,
    warmth_level text check (warmth_level in ('cold','warm','strong')),
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (student_profile_id, contact_name)
);

create index if not exists idx_contacts_student_profile
on contacts (student_profile_id, created_at);

create index if not exists idx_contacts_student_profile_warmth
on contacts (student_profile_id, warmth_level);
