with ranked_primaries as (
    select
        job_target_id,
        row_number() over (
            partition by student_profile_id
            order by updated_at desc, created_at desc, job_target_id desc
        ) as row_number_within_student
    from job_targets
    where is_primary = true
)
update job_targets
set is_primary = false,
    updated_at = now()
from ranked_primaries
where job_targets.job_target_id = ranked_primaries.job_target_id
  and ranked_primaries.row_number_within_student > 1;

create unique index if not exists idx_job_targets_one_primary_per_student
on job_targets (student_profile_id)
where is_primary = true;
