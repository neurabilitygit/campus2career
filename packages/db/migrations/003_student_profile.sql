create table if not exists student_profiles (
    student_profile_id uuid primary key,
    user_id uuid not null unique references users(user_id) on delete cascade,
    household_id uuid references households(household_id) on delete set null,
    school_name text,
    degree_program text,
    expected_graduation_date date,
    major_primary text,
    major_secondary text,
    minors text[],
    gpa_band text,
    target_salary_floor numeric(12,2),
    preferred_geographies text[],
    relocation_willingness text check (relocation_willingness in ('none','limited','open')),
    graduate_school_interest boolean not null default false,
    ai_tool_comfort_level text check (ai_tool_comfort_level in ('low','medium','high')),
    career_goal_summary text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists academic_terms (
    academic_term_id uuid primary key,
    student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
    institution_term_name text not null,
    term_type text not null check (term_type in ('semester','quarter','summer','other')),
    start_date date,
    end_date date,
    status text not null check (status in ('planned','active','completed','withdrawn'))
);

create table if not exists courses (
    course_id uuid primary key,
    academic_term_id uuid not null references academic_terms(academic_term_id) on delete cascade,
    course_code text,
    course_title text not null,
    department text,
    credits numeric(5,2),
    instructor_name text,
    final_grade text,
    grade_type text,
    student_interest_rating integer check (student_interest_rating between 1 and 5),
    student_confidence_rating integer check (student_confidence_rating between 1 and 5),
    student_perceived_relevance_rating integer check (student_perceived_relevance_rating between 1 and 5),
    notes text
);
