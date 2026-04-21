alter table requirement_sets
add column if not exists provenance_method text check (
    provenance_method in ('direct_scrape','artifact_pdf','manual','llm_assisted','synthetic_seed')
);

alter table requirement_sets
add column if not exists source_url text;

alter table requirement_sets
add column if not exists source_note text;
