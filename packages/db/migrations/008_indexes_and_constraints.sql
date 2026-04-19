create unique index if not exists idx_market_signals_unique_signal
on market_signals (
  coalesce(occupation_cluster_id::text, 'none'),
  coalesce(geography_code, 'none'),
  signal_type,
  effective_date,
  source_name
);
