import fs from "node:fs";
import path from "node:path";
import { getDbPool } from "../db/client";
import { CatalogRepository } from "../repositories/academic/catalogRepository";
import { discoverInstitutionCatalog } from "../services/academic/catalogDiscoveryService";

interface AcademicDiscoverySeedFixture {
  schemaVersion: string;
  generatedAt: string;
  description: string;
  sourceNotes?: string[];
  schools: SeedSchoolCase[];
}

interface SeedSchoolCase {
  institutionQuery: string;
  queryAliases?: string[];
  websiteUrl?: string;
  tags?: string[];
}

interface ProgramOptionSummary {
  degreeType: string;
  programName: string;
  majors: string[];
  minors: string[];
}

const repo = new CatalogRepository();

function defaultFixturePath() {
  return path.resolve(process.cwd(), "../../data/synthetic-fixtures/academic-discovery-seed-ivy-suny.v1.json");
}

function loadFixture(fixtureFile: string): AcademicDiscoverySeedFixture {
  return JSON.parse(fs.readFileSync(fixtureFile, "utf8")) as AcademicDiscoverySeedFixture;
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith("--")) {
      continue;
    }

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
    tag: (args.get("tag") as string | undefined)?.trim() || null,
    offset: Math.max(0, Number(args.get("offset") || 0) || 0),
    limit: Math.max(0, Number(args.get("limit") || 0) || 0),
    force: Boolean(args.get("force")),
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveInstitution(queryText: string) {
  const matches = await repo.searchInstitutions({
    query: queryText,
    limit: 10,
  });

  const exact =
    matches.find((match) => normalize(match.display_name) === normalize(queryText)) ||
    matches.find((match) => normalize(match.canonical_name) === normalize(queryText));

  return exact || matches[0] || null;
}

async function resolveInstitutionWithAliases(school: SeedSchoolCase) {
  const queries = [school.institutionQuery, ...(school.queryAliases || [])];
  for (const queryText of queries) {
    const institution = await resolveInstitution(queryText);
    if (institution) {
      return institution;
    }
  }
  return null;
}

async function loadProgramSummaries(catalogId: string): Promise<ProgramOptionSummary[]> {
  const degreePrograms = await repo.listDegreeProgramsForCatalog(catalogId);
  const summaries: ProgramOptionSummary[] = [];

  for (const program of degreePrograms) {
    const [majors, minors] = await Promise.all([
      repo.listMajorsForDegreeProgram(program.degree_program_id),
      repo.listMinorsForDegreeProgram(program.degree_program_id),
    ]);

    summaries.push({
      degreeType: program.degree_type,
      programName: program.program_name,
      majors: majors.map((major) => major.display_name),
      minors: minors.map((minor) => minor.display_name),
    });
  }

  return summaries;
}

async function runSchoolCase(school: SeedSchoolCase, options: { forceRefresh?: boolean }) {
  const resolvedInstitution = await resolveInstitutionWithAliases(school);
  if (!resolvedInstitution) {
    return {
      institutionQuery: school.institutionQuery,
      tags: school.tags || [],
      ok: false,
      reason: "institution_not_found",
    };
  }

  if (school.websiteUrl && resolvedInstitution.website_url !== school.websiteUrl) {
    await repo.upsertInstitution({
      institutionId: resolvedInstitution.institution_id,
      canonicalName: resolvedInstitution.canonical_name,
      displayName: resolvedInstitution.display_name,
      countryCode: resolvedInstitution.country_code,
      stateRegion: resolvedInstitution.state_region,
      city: resolvedInstitution.city,
      websiteUrl: school.websiteUrl,
    });
  }

  const institution =
    (await repo.getInstitutionByCanonicalName(resolvedInstitution.canonical_name)) || resolvedInstitution;

  const discovery = await discoverInstitutionCatalog({
    institutionCanonicalName: institution.canonical_name,
    forceRefresh: options.forceRefresh,
  });

  const catalogs = await repo.listAcademicCatalogsForInstitution(institution.institution_id);
  const catalog =
    (discovery.catalogLabel
      ? catalogs.find((entry) => entry.catalog_label === discovery.catalogLabel)
      : null) ||
    catalogs[0] ||
    null;

  const programSummaries = catalog
    ? await loadProgramSummaries(catalog.academic_catalog_id)
    : [];
  const majorCount = programSummaries.reduce((total, program) => total + program.majors.length, 0);
  const minorCount = programSummaries.reduce((total, program) => total + program.minors.length, 0);

  return {
    institutionQuery: school.institutionQuery,
    tags: school.tags || [],
    institutionDisplayName: institution.display_name,
    canonicalName: institution.canonical_name,
    discoveryStatus: discovery.status,
    catalogLabel: catalog?.catalog_label || discovery.catalogLabel || null,
    degreeProgramCount: programSummaries.length,
    majorCount,
    minorCount,
    sourcePages: discovery.sourcePages.slice(0, 6),
    uploadRecommended: discovery.uploadRecommended,
    ok: discovery.status !== "upload_required" && !!catalog && programSummaries.length > 0 && majorCount > 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = loadFixture(args.fixture);
  let schools = fixture.schools;
  if (args.tag) {
    schools = schools.filter((school) => (school.tags || []).includes(args.tag!));
  }
  if (args.school) {
    schools = schools.filter((school) => normalize(school.institutionQuery).includes(normalize(args.school!)));
  }
  if (args.offset > 0) {
    schools = schools.slice(args.offset);
  }
  if (args.limit > 0) {
    schools = schools.slice(0, args.limit);
  }

  const results = [];
  for (const school of schools) {
    console.log(`Running academic discovery seed for ${school.institutionQuery}...`);
    try {
      const result = await runSchoolCase(school, {
        forceRefresh: args.force,
      });
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      const result = {
        institutionQuery: school.institutionQuery,
        tags: school.tags || [],
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    }
  }

  const failures = results.filter((result) => !result.ok);
  const summary = {
    schemaVersion: fixture.schemaVersion,
    generatedAt: fixture.generatedAt,
    sourceNotes: fixture.sourceNotes || [],
    schoolCount: schools.length,
    passed: results.length - failures.length,
    failed: failures.length,
    failures: failures.map((failure) => ({
      institutionQuery: failure.institutionQuery,
      institutionDisplayName: "institutionDisplayName" in failure ? failure.institutionDisplayName : null,
      reason: "reason" in failure ? failure.reason : "seed_validation_failed",
      discoveryStatus: "discoveryStatus" in failure ? failure.discoveryStatus : null,
      majorCount: "majorCount" in failure ? failure.majorCount : null,
      minorCount: "minorCount" in failure ? failure.minorCount : null,
      uploadRecommended: "uploadRecommended" in failure ? failure.uploadRecommended : null,
      tags: "tags" in failure ? failure.tags : [],
    })),
  };

  console.log("Academic discovery seed summary:");
  console.log(JSON.stringify(summary, null, 2));

  await getDbPool().end();

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error("Academic discovery seed failed:");
  console.error(error);
  await getDbPool().end().catch(() => undefined);
  process.exitCode = 1;
});
