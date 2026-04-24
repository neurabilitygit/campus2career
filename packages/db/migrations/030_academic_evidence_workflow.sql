alter table if exists academic_catalogs
  add column if not exists discovery_status text not null default 'not_started'
    check (discovery_status in ('not_started','in_progress','succeeded','failed','questionable','needs_review')),
  add column if not exists discovery_started_at timestamptz,
  add column if not exists discovery_completed_at timestamptz,
  add column if not exists discovery_source text
    check (discovery_source in ('seeded_database','scrape','llm_training_data','manual_input','pdf_upload')),
  add column if not exists discovery_confidence_label text
    check (discovery_confidence_label in ('low','medium','high')),
  add column if not exists discovery_truth_status text not null default 'unresolved'
    check (discovery_truth_status in ('direct','inferred','placeholder','fallback','unresolved')),
  add column if not exists discovery_notes text;

alter table if exists majors
  add column if not exists provenance_method text
    check (provenance_method in ('direct_scrape','artifact_pdf','manual','llm_assisted','synthetic_seed')),
  add column if not exists source_url text,
  add column if not exists source_note text,
  add column if not exists confidence_label text
    check (confidence_label in ('low','medium','high')),
  add column if not exists truth_status text not null default 'unresolved'
    check (truth_status in ('direct','inferred','placeholder','fallback','unresolved')),
  add column if not exists discovered_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_user_id uuid;

alter table if exists minors
  add column if not exists provenance_method text
    check (provenance_method in ('direct_scrape','artifact_pdf','manual','llm_assisted','synthetic_seed')),
  add column if not exists source_url text,
  add column if not exists source_note text,
  add column if not exists confidence_label text
    check (confidence_label in ('low','medium','high')),
  add column if not exists truth_status text not null default 'unresolved'
    check (truth_status in ('direct','inferred','placeholder','fallback','unresolved')),
  add column if not exists discovered_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_user_id uuid;

alter table if exists concentrations
  add column if not exists provenance_method text
    check (provenance_method in ('direct_scrape','artifact_pdf','manual','llm_assisted','synthetic_seed')),
  add column if not exists source_url text,
  add column if not exists source_note text,
  add column if not exists confidence_label text
    check (confidence_label in ('low','medium','high')),
  add column if not exists truth_status text not null default 'unresolved'
    check (truth_status in ('direct','inferred','placeholder','fallback','unresolved')),
  add column if not exists discovered_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by_user_id uuid;

alter table if exists student_catalog_assignments
  add column if not exists selection_status text not null default 'selected'
    check (selection_status in ('not_started','selected','manual_entry','needs_review')),
  add column if not exists selected_by_user_id uuid,
  add column if not exists selected_at timestamptz,
  add column if not exists selection_notes text,
  add column if not exists degree_requirements_status text not null default 'not_started'
    check (degree_requirements_status in ('not_started','in_progress','succeeded','failed','questionable','needs_review','upload_required')),
  add column if not exists degree_requirements_source text
    check (degree_requirements_source in ('seeded_database','scrape','llm_training_data','manual_input','pdf_upload')),
  add column if not exists degree_requirements_confidence_label text
    check (degree_requirements_confidence_label in ('low','medium','high')),
  add column if not exists degree_requirements_truth_status text not null default 'unresolved'
    check (degree_requirements_truth_status in ('direct','inferred','placeholder','fallback','unresolved'));

update student_catalog_assignments
set
  selection_status = coalesce(selection_status, 'selected'),
  selected_at = coalesce(selected_at, created_at)
where true;

alter table if exists requirement_sets
  add column if not exists confidence_label text
    check (confidence_label in ('low','medium','high')),
  add column if not exists truth_status text not null default 'unresolved'
    check (truth_status in ('direct','inferred','placeholder','fallback','unresolved')),
  add column if not exists reasonableness_status text not null default 'needs_review'
    check (reasonableness_status in ('succeeded','questionable','failed','needs_review')),
  add column if not exists reasonableness_notes text,
  add column if not exists reviewed_by_user_id uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_status text not null default 'not_reviewed'
    check (review_status in ('not_reviewed','family_verified','coach_reviewed','admin_reviewed','needs_attention'));

update requirement_sets
set
  confidence_label = coalesce(
    confidence_label,
    case provenance_method
      when 'direct_scrape' then 'medium'
      when 'artifact_pdf' then 'high'
      when 'manual' then 'medium'
      when 'llm_assisted' then 'low'
      when 'synthetic_seed' then 'low'
      else 'low'
    end
  ),
  truth_status = case
    when truth_status is distinct from 'unresolved' then truth_status
    when provenance_method in ('artifact_pdf','manual') then 'direct'
    when provenance_method = 'direct_scrape' then 'direct'
    when provenance_method = 'llm_assisted' then 'inferred'
    when provenance_method = 'synthetic_seed' then 'fallback'
    else 'unresolved'
  end,
  reasonableness_status = coalesce(reasonableness_status, 'succeeded')
where true;

create table if not exists academic_discovery_attempts (
  academic_discovery_attempt_id uuid primary key,
  student_profile_id uuid not null references student_profiles(student_profile_id) on delete cascade,
  institution_id uuid references institutions(institution_id) on delete set null,
  academic_catalog_id uuid references academic_catalogs(academic_catalog_id) on delete set null,
  discovery_type text not null check (discovery_type in ('offerings','degree_requirements')),
  requested_entity_type text not null check (
    requested_entity_type in ('institution','major','minor','concentration','degree_core','general_education')
  ),
  requested_entity_name text,
  source_attempted text not null check (
    source_attempted in ('seeded_database','scrape','llm_training_data','manual_input','pdf_upload')
  ),
  status text not null check (
    status in ('not_started','in_progress','succeeded','failed','questionable','needs_review')
  ),
  confidence_label text check (confidence_label in ('low','medium','high')),
  truth_status text not null default 'unresolved'
    check (truth_status in ('direct','inferred','placeholder','fallback','unresolved')),
  source_url text,
  source_note text,
  reasonableness_notes text,
  raw_result_json jsonb,
  normalized_result_json jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  requested_by_user_id uuid
);

create index if not exists idx_academic_discovery_attempts_student
on academic_discovery_attempts (student_profile_id, discovery_type, created_at desc);
