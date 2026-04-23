alter table if exists job_targets
  add column if not exists normalization_confidence_label text,
  add column if not exists normalization_reasoning text,
  add column if not exists normalization_source text,
  add column if not exists normalization_truth_status text not null default 'unresolved';

alter table if exists academic_artifacts
  add column if not exists parse_truth_status text not null default 'unresolved',
  add column if not exists parse_confidence_label text,
  add column if not exists extraction_method text,
  add column if not exists parse_notes text;

alter table if exists artifact_parse_jobs
  add column if not exists result_truth_status text not null default 'unresolved',
  add column if not exists result_confidence_label text,
  add column if not exists result_notes text;

alter table if exists student_transcripts
  add column if not exists extraction_method text,
  add column if not exists extraction_confidence_label text,
  add column if not exists institution_resolution_truth_status text not null default 'unresolved',
  add column if not exists institution_resolution_note text;
