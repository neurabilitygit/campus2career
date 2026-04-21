import fs from "node:fs";
import path from "node:path";
import { getDbPool } from "../db/client";
import { CatalogRepository } from "../repositories/academic/catalogRepository";
import { discoverInstitutionCatalog } from "../services/academic/catalogDiscoveryService";

interface AcademicDiscoverySmokeFixture {
  schemaVersion: string;
  generatedAt: string;
  description: string;
  schools: SmokeSchoolCase[];
}

interface SmokeSchoolCase {
  institutionQuery: string;
  expectedMajorSearch?: string;
  expectedMinorSearch?: string;
}

interface ProgramOptionSummary {
  degreeType: string;
  programName: string;
  majors: string[];
  minors: string[];
}

const repo = new CatalogRepository();

function fixturePath() {
  return path.resolve(process.cwd(), "../../data/synthetic-fixtures/academic-discovery-smoke.v1.json");
}

function loadFixture(): AcademicDiscoverySmokeFixture {
  return JSON.parse(fs.readFileSync(fixturePath(), "utf8")) as AcademicDiscoverySmokeFixture;
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
    school: (args.get("school") as string | undefined)?.trim() || null,
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesSearch(values: string[], search?: string): boolean {
  if (!search) {
    return true;
  }

  const normalizedSearch = normalize(search);
  return values.some((value) => normalize(value).includes(normalizedSearch));
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

function pickBestProgram(programs: ProgramOptionSummary[]): ProgramOptionSummary | null {
  return (
    [...programs].sort((a, b) => {
      const aScore = a.majors.length * 2 + a.minors.length;
      const bScore = b.majors.length * 2 + b.minors.length;
      return bScore - aScore;
    })[0] || null
  );
}

function summarizeProgram(program: ProgramOptionSummary | null) {
  if (!program) {
    return null;
  }

  return {
    degreeType: program.degreeType,
    programName: program.programName,
    majorCount: program.majors.length,
    minorCount: program.minors.length,
    sampleMajors: program.majors.slice(0, 8),
    sampleMinors: program.minors.slice(0, 8),
  };
}

async function runSchoolCase(school: SmokeSchoolCase) {
  const institution = await resolveInstitution(school.institutionQuery);
  if (!institution) {
    return {
      institutionQuery: school.institutionQuery,
      ok: false,
      reason: "institution_not_found",
    };
  }

  const discovery = await discoverInstitutionCatalog({
    institutionCanonicalName: institution.canonical_name,
  });

  const catalogs = await repo.listAcademicCatalogsForInstitution(institution.institution_id);
  const catalog =
    (discovery.catalogLabel
      ? catalogs.find((entry) => entry.catalog_label === discovery.catalogLabel)
      : null) ||
    catalogs[0] ||
    null;

  if (!catalog) {
    return {
      institutionQuery: school.institutionQuery,
      institutionDisplayName: institution.display_name,
      canonicalName: institution.canonical_name,
      discoveryStatus: discovery.status,
      ok: false,
      reason: "catalog_not_found_after_discovery",
    };
  }

  const programSummaries = await loadProgramSummaries(catalog.academic_catalog_id);
  const bestProgram = pickBestProgram(programSummaries);
  const allMajors = programSummaries.flatMap((program) => program.majors);
  const allMinors = programSummaries.flatMap((program) => program.minors);
  const expectedMajorFound = includesSearch(allMajors, school.expectedMajorSearch);
  const expectedMinorFound = includesSearch(allMinors, school.expectedMinorSearch);
  const suspiciousProgramVolume = allMajors.length > 250 || allMinors.length > 250;

  const ok =
    discovery.status !== "upload_required" &&
    programSummaries.length > 0 &&
    allMajors.length > 0 &&
    !suspiciousProgramVolume &&
    expectedMajorFound &&
    expectedMinorFound;

  return {
    institutionQuery: school.institutionQuery,
    institutionDisplayName: institution.display_name,
    canonicalName: institution.canonical_name,
    discoveryStatus: discovery.status,
    catalogLabel: catalog.catalog_label,
    degreeProgramCount: programSummaries.length,
    majorCount: allMajors.length,
    minorCount: allMinors.length,
    expectedMajorSearch: school.expectedMajorSearch || null,
    expectedMajorFound,
    expectedMinorSearch: school.expectedMinorSearch || null,
    expectedMinorFound,
    suspiciousProgramVolume,
    bestProgram: summarizeProgram(bestProgram),
    sourcePages: discovery.sourcePages.slice(0, 6),
    ok,
  };
}

async function main() {
  const fixture = loadFixture();
  const args = parseArgs(process.argv.slice(2));
  const schools = args.school
    ? fixture.schools.filter((school) => normalize(school.institutionQuery).includes(normalize(args.school!)))
    : fixture.schools;
  const results = [];

  for (const school of schools) {
    console.log(`Running academic discovery smoke test for ${school.institutionQuery}...`);
    const result = await runSchoolCase(school);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }

  const failures = results.filter((result) => !result.ok);
  const summary = {
    schemaVersion: fixture.schemaVersion,
    generatedAt: fixture.generatedAt,
    schoolCount: schools.length,
    passed: results.length - failures.length,
    failed: failures.length,
    failures: failures.map((failure) => ({
      institutionQuery: failure.institutionQuery,
      institutionDisplayName: "institutionDisplayName" in failure ? failure.institutionDisplayName : null,
      reason: "reason" in failure ? failure.reason : "lookup_validation_failed",
      discoveryStatus: "discoveryStatus" in failure ? failure.discoveryStatus : null,
      expectedMajorSearch: "expectedMajorSearch" in failure ? failure.expectedMajorSearch : null,
      expectedMinorSearch: "expectedMinorSearch" in failure ? failure.expectedMinorSearch : null,
      majorCount: "majorCount" in failure ? failure.majorCount : null,
      minorCount: "minorCount" in failure ? failure.minorCount : null,
      suspiciousProgramVolume: "suspiciousProgramVolume" in failure ? failure.suspiciousProgramVolume : null,
    })),
  };

  console.log("Academic discovery smoke summary:");
  console.log(JSON.stringify(summary, null, 2));

  await getDbPool().end();

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error("Academic discovery smoke failed:");
  console.error(error);
  await getDbPool().end().catch(() => undefined);
  process.exitCode = 1;
});
