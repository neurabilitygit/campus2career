import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDbPool } from "../db/client";

function migrationsDir() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "../../../../packages/db/migrations");
}

const preferredMigrationOrder = [
  "001_identity.sql",
  "002_consent.sql",
  "003_student_profile.sql",
  "004_experiences.sql",
  "005_market_and_skills.sql",
  "006_paths_gaps_actions.sql",
  "007_insights_and_briefs.sql",
  "008_indexes_and_constraints.sql",
  "009_deadlines.sql",
  "010_sample_auth_seed.sql",
  "012_contacts.sql",
  "013_artifacts_and_outreach.sql",
  "011_onboarding_and_parse_jobs.sql",
  "014_academic_catalog_foundation.sql",
  "015_transcript_graph.sql",
  "016_student_profile_academic_notes.sql",
  "017_requirement_set_provenance.sql",
  "018_upload_targets.sql",
  "019_llm_runs.sql",
  "020_ai_documents.sql",
  "021_job_targets.sql",
  "022_job_targets_primary_unique.sql",
  "023_domain_truth_provenance.sql",
  "024_parent_student_communication.sql",
  "025_outcome_tracking.sql",
  "026_coach_module.sql",
];

const migrationOrderIndex = new Map(
  preferredMigrationOrder.map((filename, index) => [filename, index] as const)
);

async function main() {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const appliedResult = await client.query<{ filename: string }>(
      `select filename from schema_migrations`
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));

    const directory = migrationsDir();
    const files = fs
      .readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort((left, right) => {
        const leftIndex = migrationOrderIndex.get(left);
        const rightIndex = migrationOrderIndex.get(right);

        if (leftIndex != null && rightIndex != null) {
          return leftIndex - rightIndex;
        }
        if (leftIndex != null) {
          return -1;
        }
        if (rightIndex != null) {
          return 1;
        }
        return left.localeCompare(right);
      });

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping already applied migration ${file}`);
        continue;
      }

      const migrationPath = path.join(directory, file);
      const sql = fs.readFileSync(migrationPath, "utf8");

      console.log(`Applying migration ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(`insert into schema_migrations (filename) values ($1)`, [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }

    console.log(`Database migrations complete. Processed ${files.length} files.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
