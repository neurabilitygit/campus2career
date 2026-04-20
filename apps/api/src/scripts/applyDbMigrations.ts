import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDbPool } from "../db/client";

function migrationsDir() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "../../../../packages/db/migrations");
}

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
      .sort((left, right) => left.localeCompare(right));

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
