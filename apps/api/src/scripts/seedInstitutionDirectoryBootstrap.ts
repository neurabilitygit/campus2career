import fs from "node:fs";
import path from "node:path";
import { CatalogRepository } from "../repositories/academic/catalogRepository";
import { upsertInstitution } from "../services/academic/catalogService";

interface SeedSchool {
  institutionQuery: string;
  websiteUrl?: string;
}

interface SeedFixture {
  schools: SeedSchool[];
}

const repo = new CatalogRepository();

function fixturePaths() {
  const root = path.resolve(process.cwd(), "../../data/synthetic-fixtures");
  return [
    path.join(root, "academic-discovery-smoke.v1.json"),
    path.join(root, "academic-discovery-seed-ivy-suny.v1.json"),
  ];
}

function loadSchools(): SeedSchool[] {
  const schools = new Map<string, SeedSchool>();

  for (const file of fixturePaths()) {
    const fixture = JSON.parse(fs.readFileSync(file, "utf8")) as SeedFixture;
    for (const school of fixture.schools || []) {
      const key = school.institutionQuery.trim().toLowerCase();
      if (!key) {
        continue;
      }

      const existing = schools.get(key);
      schools.set(key, {
        institutionQuery: school.institutionQuery.trim(),
        websiteUrl: school.websiteUrl || existing?.websiteUrl,
      });
    }
  }

  return Array.from(schools.values()).sort((a, b) =>
    a.institutionQuery.localeCompare(b.institutionQuery)
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function findExistingInstitution(displayName: string) {
  const matches = await repo.searchInstitutions({
    query: displayName,
    limit: 10,
  });

  const normalized = displayName.trim().toLowerCase();
  return (
    matches.find((match) => match.display_name.trim().toLowerCase() === normalized) ||
    matches.find((match) => match.canonical_name.trim().toLowerCase() === normalized) ||
    null
  );
}

async function main() {
  const schools = loadSchools();
  let inserted = 0;
  let updated = 0;

  for (const school of schools) {
    const existing = await findExistingInstitution(school.institutionQuery);
    if (existing) {
      if (school.websiteUrl && existing.website_url !== school.websiteUrl) {
        await repo.upsertInstitution({
          institutionId: existing.institution_id,
          canonicalName: existing.canonical_name,
          displayName: existing.display_name,
          countryCode: existing.country_code,
          stateRegion: existing.state_region,
          city: existing.city,
          websiteUrl: school.websiteUrl,
        });
        updated += 1;
      }
      continue;
    }

    await upsertInstitution({
      canonicalName: slugify(school.institutionQuery),
      displayName: school.institutionQuery,
      websiteUrl: school.websiteUrl,
    });
    inserted += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalSchools: schools.length,
        inserted,
        updated,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("Institution directory bootstrap seed failed:");
  console.error(error);
  process.exit(1);
});
