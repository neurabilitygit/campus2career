# Day 1 Market Bootstrap

1. Apply database migrations.
2. Set DATABASE_URL, ONET_DATABASE_DIR, BLS_API_KEY if needed, and OPENAI_API_KEY.
3. Run the worker bootstrap:
   - seed target role families
   - seed broad skill requirements
   - sync O*NET
   - sync BLS
4. Verify rows in:
   - occupation_clusters
   - occupation_skill_requirements
   - market_signals
5. Hit `/v1/scoring/demo` to verify the scoring path still works.
