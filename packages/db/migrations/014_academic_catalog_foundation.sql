create table if not exists institutions (
    institution_id uuid primary key,
    canonical_name text not null unique,
    display_name text not null,
    country_code text,
    state_region text,
    city text,
    website_url text,
    created_at timestamptz not null default now()
);

create table if not exists academic_catalogs (
    academic_catalog_id uuid primary key,
    institution_id uuid not null references institutions(institution_id) on delete cascade,
    catalog_label text not null,
    start_year integer not null,
    end_year integer not null,
    source_url text,
    source_format text check (source_format in ('html','pdf','api','manual')),
    extraction_status text not null default 'draft' check (
        extraction_status in ('draft','parsed','reviewed','published','deprecated')
    ),
    published_at timestamptz,
    created_at timestamptz not null default now(),
    unique (institution_id, catalog_label)
);

create table if not exists degree_programs (
    degree_program_id uuid primary key,
    academic_catalog_id uuid not null references academic_catalogs(academic_catalog_id) on delete cascade,
    degree_type text not null,
    program_name text not null,
    school_name text,
    total_credits_required numeric(6,2),
    residency_credits_required numeric(6,2),
    minimum_gpa_required numeric(4,2),
    created_at timestamptz not null default now(),
    unique (academic_catalog_id, degree_type, program_name)
);

create table if not exists majors (
    major_id uuid primary key,
    degree_program_id uuid not null references degree_programs(degree_program_id) on delete cascade,
    canonical_name text not null,
    display_name text not null,
    cip_code text,
    department_name text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (degree_program_id, canonical_name)
);

create table if not exists minors (
    minor_id uuid primary key,
    degree_program_id uuid not null references degree_programs(degree_program_id) on delete cascade,
    canonical_name text not null,
    display_name text not null,
    department_name text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    unique (degree_program_id, canonical_name)
);

create table if not exists concentrations (
    concentration_id uuid primary key,
    major_id uuid not null references majors(major_id) on delete cascade,
    canonical_name text not null,
    display_name text not null,
    created_at timestamptz not null default now(),
    unique (major_id, canonical_name)
);

create table if not exists catalog_courses (
    catalog_course_id uuid primary key,
    academic_catalog_id uuid not null references academic_catalogs(academic_catalog_id) on delete cascade,
    course_code text not null,
    course_title text not null,
    department text,
    credits_min numeric(5,2),
    credits_max numeric(5,2),
    description text,
    level_hint text check (level_hint in ('introductory','intermediate','advanced','graduate','mixed')),
    created_at timestamptz not null default now(),
    unique (academic_catalog_id, course_code)
);

create table if not exists catalog_course_aliases (
    catalog_course_alias_id uuid primary key,
    catalog_course_id uuid not null references catalog_courses(catalog_course_id) on delete cascade,
    alias_code text,
    alias_title text,
    source_type text check (source_type in ('catalog','transfer-guide','manual','transcript-observed'))
);

create table if not exists course_prerequisites (
    course_prerequisite_id uuid primary key,
    catalog_course_id uuid not null references catalog_courses(catalog_course_id) on delete cascade,
    prerequisite_course_id uuid references catalog_courses(catalog_course_id) on delete cascade,
    logic_group text,
    relationship_type text not null check (
        relationship_type in ('prerequisite','corequisite','recommended')
    )
);

create table if not exists requirement_sets (
    requirement_set_id uuid primary key,
    major_id uuid references majors(major_id) on delete cascade,
    minor_id uuid references minors(minor_id) on delete cascade,
    concentration_id uuid references concentrations(concentration_id) on delete cascade,
    set_type text not null check (
        set_type in ('major','minor','concentration','degree_core','general_education')
    ),
    display_name text not null,
    total_credits_required numeric(6,2),
    created_at timestamptz not null default now(),
    check (
        (major_id is not null)::integer +
        (minor_id is not null)::integer +
        (concentration_id is not null)::integer <= 1
    )
);

create table if not exists requirement_groups (
    requirement_group_id uuid primary key,
    requirement_set_id uuid not null references requirement_sets(requirement_set_id) on delete cascade,
    group_name text not null,
    group_type text not null check (
        group_type in ('all_of','choose_n','credits_bucket','one_of','capstone','gpa_rule')
    ),
    min_courses_required integer,
    min_credits_required numeric(6,2),
    display_order integer,
    notes text
);

create table if not exists requirement_items (
    requirement_item_id uuid primary key,
    requirement_group_id uuid not null references requirement_groups(requirement_group_id) on delete cascade,
    catalog_course_id uuid references catalog_courses(catalog_course_id) on delete cascade,
    item_label text,
    item_type text not null check (
        item_type in ('course','course_pattern','free_elective','department_elective','manual_rule')
    ),
    course_prefix text,
    min_level integer,
    credits_if_used numeric(6,2),
    display_order integer
);

create table if not exists student_catalog_assignments (
    student_catalog_assignment_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    institution_id uuid not null references institutions(institution_id) on delete cascade,
    academic_catalog_id uuid not null references academic_catalogs(academic_catalog_id) on delete cascade,
    degree_program_id uuid references degree_programs(degree_program_id) on delete set null,
    major_id uuid references majors(major_id) on delete set null,
    minor_id uuid references minors(minor_id) on delete set null,
    concentration_id uuid references concentrations(concentration_id) on delete set null,
    assignment_source text not null check (
        assignment_source in ('student_selected','transcript_inferred','advisor_confirmed','system_inferred')
    ),
    is_primary boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists idx_student_catalog_assignments_primary
on student_catalog_assignments (student_profile_id)
where is_primary = true;

create index if not exists idx_catalog_courses_catalog
on catalog_courses (academic_catalog_id, course_code);

create index if not exists idx_requirement_groups_set
on requirement_groups (requirement_set_id, display_order);

create index if not exists idx_requirement_items_group
on requirement_items (requirement_group_id, display_order);
