create table if not exists occupation_clusters (
    occupation_cluster_id uuid primary key,
    canonical_name text not null,
    onet_code text,
    description text,
    job_zone integer,
    typical_entry_titles text[],
    geography_sensitivity text check (geography_sensitivity in ('low','medium','high')),
    ai_exposure_level text check (ai_exposure_level in ('low','medium','high')),
    underemployment_risk_level text check (underemployment_risk_level in ('low','medium','high')),
    overall_market_temperature text check (overall_market_temperature in ('cool','mixed','warm','hot')),
    updated_at timestamptz not null default now()
);

create table if not exists occupation_skill_requirements (
    occupation_skill_requirement_id uuid primary key,
    occupation_cluster_id uuid not null references occupation_clusters(occupation_cluster_id) on delete cascade,
    skill_name text not null,
    skill_category text not null check (
        skill_category in (
            'technical','analytical','communication','operational',
            'interpersonal','creative','managerial','ai_fluency'
        )
    ),
    importance_score numeric(5,2) not null,
    required_proficiency_band text not null check (required_proficiency_band in ('basic','intermediate','advanced')),
    evidence_source text,
    updated_at timestamptz not null default now(),
    unique (occupation_cluster_id, skill_name)
);

create table if not exists market_signals (
    market_signal_id uuid primary key,
    occupation_cluster_id uuid references occupation_clusters(occupation_cluster_id) on delete cascade,
    geography_code text,
    signal_type text not null check (
        signal_type in (
            'wage','demand_growth','unemployment_pressure',
            'openings_trend','internship_availability',
            'ai_disruption_signal','hiring_slowdown'
        )
    ),
    signal_value numeric(14,4),
    signal_direction text check (signal_direction in ('rising','falling','stable')),
    source_name text not null,
    effective_date date not null,
    confidence_level text check (confidence_level in ('low','medium','high'))
);

create table if not exists course_skill_coverage (
    course_skill_coverage_id uuid primary key,
    course_id uuid not null references courses(course_id) on delete cascade,
    skill_name text not null,
    coverage_strength text not null check (coverage_strength in ('low','medium','high')),
    confidence_score numeric(4,3) not null,
    derived_from text not null check (
        derived_from in ('syllabus_parse','course_catalog','manual_tagging','coach_review')
    ),
    unique (course_id, skill_name)
);
