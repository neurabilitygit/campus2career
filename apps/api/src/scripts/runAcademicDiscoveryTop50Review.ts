import fs from "node:fs";
import path from "node:path";
import { getDbPool, query } from "../db/client";
import { assessTop50SchoolReadiness } from "../services/academic/top50Review";

interface Top50Manifest {
  schemaVersion: string;
  generatedAt: string;
  description: string;
  sourceNotes?: string[];
  schools: Top50SchoolCase[];
}

interface Top50SchoolCase {
  usNewsRank: number;
  institutionDisplayName: string;
  institutionCanonicalName?: string;
  queryAliases?: string[];
  websiteUrl?: string;
  officialProgramsUrl?: string;
  officialCatalogUrl?: string;
  tags?: string[];
  status?: string;
}

function defaultFixturePath() {
  return path.resolve(process.cwd(), "../../data/synthetic-fixtures/academic-discovery-top50-manifest.v1.json");
}

function loadFixture(fixtureFile: string): Top50Manifest {
  return JSON.parse(fs.readFileSync(fixtureFile, "utf8")) as Top50Manifest;
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
    } else {
      args.set(key, next);
      index += 1;
    }
  }

  return {
    fixture: (args.get("fixture") as string | undefined)?.trim() || defaultFixturePath(),
    school: (args.get("school") as string | undefined)?.trim() || null,
    rank: Number(args.get("rank") || 0) || null,
    tag: (args.get("tag") as string | undefined)?.trim() || null,
    limit: Math.max(0, Number(args.get("limit") || 0) || 0),
  };
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function normalizeHost(urlText?: string | null) {
  if (!urlText) return null;
  try {
    return new URL(urlText).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

async function resolveInstitutionExact(school: Top50SchoolCase) {
  const aliases = Array.from(
    new Set(
      [
        school.institutionDisplayName,
        school.institutionCanonicalName,
        ...(school.queryAliases || []),
      ].filter((value): value is string => !!value && !!value.trim())
    )
  );
  const websiteHost = normalizeHost(school.websiteUrl);

  for (const alias of aliases) {
    const result = await query<{
      institution_id: string;
      canonical_name: string;
      display_name: string;
      website_url: string | null;
    }>(
      `
      select institution_id, canonical_name, display_name, website_url
      from institutions
      where lower(display_name) = lower($1)
         or lower(canonical_name) = lower($1)
      limit 1
      `,
      [alias]
    );
    if (result.rows[0]) {
      return { institution: result.rows[0], matchedBy: alias === school.institutionDisplayName ? "display_name" : "alias" };
    }
  }

  if (websiteHost) {
    const result = await query<{
      institution_id: string;
      canonical_name: string;
      display_name: string;
      website_url: string | null;
    }>(
      `
      select institution_id, canonical_name, display_name, website_url
      from institutions
      where lower(regexp_replace(coalesce(website_url, ''), '^https?://(www\\.)?', '')) like lower($1 || '%')
      limit 1
      `,
      [websiteHost]
    );
    if (result.rows[0]) {
      return { institution: result.rows[0], matchedBy: "website_host" };
    }
  }

  return null;
}

async function summarizeInstitution(institutionId: string) {
  const stats = await query<{
    catalogs: number;
    programs: number;
    majors: number;
    minors: number;
    concentrations: number;
    requirement_sets: number;
  }>(
    `
    with cats as (
      select academic_catalog_id from academic_catalogs where institution_id = $1
    ),
    progs as (
      select degree_program_id from degree_programs where academic_catalog_id in (select academic_catalog_id from cats)
    ),
    mj as (
      select major_id from majors where degree_program_id in (select degree_program_id from progs)
    ),
    mn as (
      select minor_id from minors where degree_program_id in (select degree_program_id from progs)
    ),
    cc as (
      select concentration_id from concentrations where major_id in (select major_id from mj)
    ),
    rs as (
      select requirement_set_id from requirement_sets
      where major_id in (select major_id from mj)
         or minor_id in (select minor_id from mn)
         or concentration_id in (select concentration_id from cc)
    )
    select
      (select count(*)::int from cats) as catalogs,
      (select count(*)::int from progs) as programs,
      (select count(*)::int from mj) as majors,
      (select count(*)::int from mn) as minors,
      (select count(*)::int from cc) as concentrations,
      (select count(*)::int from rs) as requirement_sets
    `,
    [institutionId]
  );
  return stats.rows[0];
}

async function sampleMajors(institutionId: string) {
  const result = await query<{ display_name: string }>(
    `
    select m.display_name
    from majors m
    join degree_programs dp on dp.degree_program_id = m.degree_program_id
    join academic_catalogs ac on ac.academic_catalog_id = dp.academic_catalog_id
    where ac.institution_id = $1
    order by m.display_name asc
    limit 8
    `,
    [institutionId]
  );
  return result.rows.map((row) => row.display_name);
}

async function latestAttemptStatus(institutionId: string, discoveryType: "offerings" | "degree_requirements") {
  const result = await query<{ status: string }>(
    `
    select status
    from academic_discovery_attempts
    where institution_id = $1 and discovery_type = $2
    order by created_at desc
    limit 1
    `,
    [institutionId, discoveryType]
  );
  return result.rows[0]?.status || null;
}

async function runSchoolCase(school: Top50SchoolCase) {
  const resolution = await resolveInstitutionExact(school);
  if (!resolution) {
    const assessment = assessTop50SchoolReadiness({
      exactMatch: false,
      websiteUrlPresent: !!school.websiteUrl,
      officialProgramsUrlPresent: !!school.officialProgramsUrl,
      officialCatalogUrlPresent: !!school.officialCatalogUrl,
      catalogs: 0,
      programs: 0,
      majors: 0,
      minors: 0,
      concentrations: 0,
      requirementSets: 0,
      sampleMajors: [],
      latestOfferingsStatus: null,
      latestRequirementsStatus: null,
    });
    return {
      institutionDisplayName: school.institutionDisplayName,
      usNewsRank: school.usNewsRank,
      resolvedDisplayName: null,
      canonicalName: null,
      matchedBy: null,
      ...assessment,
      counts: null,
      sampleMajors: [],
    };
  }

  const institution = resolution.institution;
  const [counts, majors, latestOfferings, latestRequirements] = await Promise.all([
    summarizeInstitution(institution.institution_id),
    sampleMajors(institution.institution_id),
    latestAttemptStatus(institution.institution_id, "offerings"),
    latestAttemptStatus(institution.institution_id, "degree_requirements"),
  ]);

  const assessment = assessTop50SchoolReadiness({
    exactMatch: true,
    websiteUrlPresent: !!institution.website_url,
    officialProgramsUrlPresent: !!school.officialProgramsUrl,
    officialCatalogUrlPresent: !!school.officialCatalogUrl,
    catalogs: counts.catalogs,
    programs: counts.programs,
    majors: counts.majors,
    minors: counts.minors,
    concentrations: counts.concentrations,
    requirementSets: counts.requirement_sets,
    sampleMajors: majors,
    latestOfferingsStatus: latestOfferings,
    latestRequirementsStatus: latestRequirements,
  });

  return {
    institutionDisplayName: school.institutionDisplayName,
    usNewsRank: school.usNewsRank,
    resolvedDisplayName: institution.display_name,
    canonicalName: institution.canonical_name,
    matchedBy: resolution.matchedBy,
    latestOfferingsStatus: latestOfferings,
    latestRequirementsStatus: latestRequirements,
    counts,
    sampleMajors: majors,
    ...assessment,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = loadFixture(args.fixture);
  let schools = fixture.schools;
  if (args.rank) schools = schools.filter((school) => school.usNewsRank === args.rank);
  if (args.tag) schools = schools.filter((school) => (school.tags || []).includes(args.tag!));
  if (args.school) schools = schools.filter((school) => normalize(school.institutionDisplayName).includes(normalize(args.school!)));
  if (args.limit > 0) schools = schools.slice(0, args.limit);

  const results = [];
  for (const school of schools) {
    console.log(`Reviewing top-50 academic discovery readiness for #${school.usNewsRank} ${school.institutionDisplayName}...`);
    const result = await runSchoolCase(school);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }

  const summary = {
    schemaVersion: fixture.schemaVersion,
    generatedAt: fixture.generatedAt,
    schoolCount: results.length,
    byPrimaryRecommendation: results.reduce<Record<string, number>>((acc, result) => {
      acc[result.primaryRecommendation] = (acc[result.primaryRecommendation] || 0) + 1;
      return acc;
    }, {}),
  };

  console.log("Top-50 academic review summary:");
  console.log(JSON.stringify(summary, null, 2));

  await getDbPool().end();
}

main().catch(async (error) => {
  console.error("Top-50 academic review failed:");
  console.error(error);
  await getDbPool().end().catch(() => undefined);
  process.exitCode = 1;
});
