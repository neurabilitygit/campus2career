import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDbPool, query } from "../db/client";
import { CatalogRepository } from "../repositories/academic/catalogRepository";
import { discoverInstitutionCatalog, discoverProgramRequirements } from "../services/academic/catalogDiscoveryService";

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
  status?: "pending_review" | "ready" | "defer";
}

type RequirementsScope = "best" | "safe-subset" | "all";

interface RequirementTarget {
  degreeType: string;
  programName: string;
  majorCanonicalName: string;
  majorDisplayName: string;
  sourceUrl: string | null;
  confidenceLabel: "low" | "medium" | "high" | null;
  truthStatus: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";
}

interface BestProgramSummary {
  degreeType: string;
  programName: string;
  majorCount: number;
  minorCount: number;
  majorCanonicalName: string | null;
  majorDisplayName: string | null;
}

const repo = new CatalogRepository();

function defaultFixturePath() {
  return path.resolve(process.cwd(), "../../data/synthetic-fixtures/academic-discovery-top50-manifest.v1.json");
}

function loadFixture(fixtureFile: string): Top50Manifest {
  return JSON.parse(fs.readFileSync(fixtureFile, "utf8")) as Top50Manifest;
}

export function parseArgs(argv: string[]) {
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

  const rawRequirementsScope = ((args.get("requirements-scope") as string | undefined)?.trim() ||
    "best") as string;
  const requirementsScope: RequirementsScope =
    rawRequirementsScope === "safe-subset" || rawRequirementsScope === "all" || rawRequirementsScope === "best"
      ? rawRequirementsScope
      : "best";

  return {
    fixture: (args.get("fixture") as string | undefined)?.trim() || defaultFixturePath(),
    school: (args.get("school") as string | undefined)?.trim() || null,
    rank: Number(args.get("rank") || 0) || null,
    tag: (args.get("tag") as string | undefined)?.trim() || null,
    offset: Math.max(0, Number(args.get("offset") || 0) || 0),
    limit: Math.max(0, Number(args.get("limit") || 0) || 0),
    dryRun: !Boolean(args.get("apply")),
    force: Boolean(args.get("force")),
    includeRequirements: Boolean(args.get("include-requirements")),
    requirementsScope,
    requirementsLimit: Math.max(0, Number(args.get("requirements-limit") || 0) || 0),
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
      country_code: string | null;
      state_region: string | null;
      city: string | null;
    }>(
      `
      select institution_id, canonical_name, display_name, website_url, country_code, state_region, city
      from institutions
      where lower(display_name) = lower($1)
         or lower(canonical_name) = lower($1)
      limit 1
      `,
      [alias]
    );
    if (result.rows[0]) {
      return {
        institution: result.rows[0],
        matchedBy: alias === school.institutionDisplayName ? "display_name" : "alias",
      };
    }
  }

  if (websiteHost) {
    const result = await query<{
      institution_id: string;
      canonical_name: string;
      display_name: string;
      website_url: string | null;
      country_code: string | null;
      state_region: string | null;
      city: string | null;
    }>(
      `
      select institution_id, canonical_name, display_name, website_url, country_code, state_region, city
      from institutions
      where lower(regexp_replace(coalesce(website_url, ''), '^https?://(www\\.)?', '')) like lower($1 || '%')
      limit 1
      `,
      [websiteHost]
    );
    if (result.rows[0]) {
      return {
        institution: result.rows[0],
        matchedBy: "website_host",
      };
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

async function pickBestProgram(catalogId: string): Promise<BestProgramSummary | null> {
  const degreePrograms = await repo.listDegreeProgramsForCatalog(catalogId);
  let best:
    | {
        degreeType: string;
        programName: string;
        majorCount: number;
        minorCount: number;
        majorCanonicalName: string | null;
        majorDisplayName: string | null;
      }
    | null = null;

  for (const degreeProgram of degreePrograms) {
    const [majors, minors] = await Promise.all([
      repo.listMajorsForDegreeProgram(degreeProgram.degree_program_id),
      repo.listMinorsForDegreeProgram(degreeProgram.degree_program_id),
    ]);
    const score = majors.length * 2 + minors.length;
    if (!best || score > best.majorCount * 2 + best.minorCount) {
      best = {
        degreeType: degreeProgram.degree_type,
        programName: degreeProgram.program_name,
        majorCount: majors.length,
        minorCount: minors.length,
        majorCanonicalName: majors[0]?.canonical_name || null,
        majorDisplayName: majors[0]?.display_name || null,
      };
    }
  }

  return best;
}

function isLikelySafeRequirementMajor(name: string) {
  const normalized = name.trim().toLowerCase();
  return !/\b(accelerated|combined|online|certificate|teacher certification|self-designed|individualized|prelaw|premed|pre-med)\b/i.test(
    normalized
  );
}

function rankRequirementTarget(target: RequirementTarget) {
  let score = 0;
  if (target.truthStatus === "direct") score += 40;
  if (target.truthStatus === "inferred") score += 10;
  if (target.confidenceLabel === "high") score += 20;
  if (target.confidenceLabel === "medium") score += 12;
  if (target.sourceUrl) score += 10;
  if (isLikelySafeRequirementMajor(target.majorDisplayName)) score += 10;
  if (/^b[a-z]{1,3}$/i.test(target.degreeType)) score += 5;
  if (/\b(and|&)\b/.test(target.majorDisplayName)) score -= 1;
  if (/\(/.test(target.majorDisplayName)) score -= 2;
  return score;
}

export function selectRequirementTargets(input: {
  scope: RequirementsScope;
  limit: number;
  targets: RequirementTarget[];
  bestProgram: BestProgramSummary | null;
}) {
  if (input.scope === "best") {
    if (!input.bestProgram?.majorCanonicalName || !input.bestProgram.majorDisplayName) {
      return [] as RequirementTarget[];
    }

    return [
      {
        degreeType: input.bestProgram.degreeType,
        programName: input.bestProgram.programName,
        majorCanonicalName: input.bestProgram.majorCanonicalName,
        majorDisplayName: input.bestProgram.majorDisplayName,
        sourceUrl: null,
        confidenceLabel: null,
        truthStatus: "direct" as const,
      },
    ];
  }

  const ranked = [...input.targets].sort((a, b) => {
    const scoreDiff = rankRequirementTarget(b) - rankRequirementTarget(a);
    if (scoreDiff !== 0) return scoreDiff;
    const degreeDiff = a.degreeType.localeCompare(b.degreeType);
    if (degreeDiff !== 0) return degreeDiff;
    return a.majorDisplayName.localeCompare(b.majorDisplayName);
  });

  if (input.scope === "all") {
    return input.limit > 0 ? ranked.slice(0, input.limit) : ranked;
  }

  const safeSubset = ranked.filter((target) => isLikelySafeRequirementMajor(target.majorDisplayName));
  const fallback = safeSubset.length > 0 ? safeSubset : ranked;
  const limit = input.limit > 0 ? input.limit : 10;
  return fallback.slice(0, limit);
}

async function listRequirementTargetsForCatalog(catalogId: string): Promise<RequirementTarget[]> {
  const degreePrograms = await repo.listDegreeProgramsForCatalog(catalogId);
  const targets: RequirementTarget[] = [];

  for (const degreeProgram of degreePrograms) {
    const majors = await repo.listMajorsForDegreeProgram(degreeProgram.degree_program_id);
    for (const major of majors) {
      targets.push({
        degreeType: degreeProgram.degree_type,
        programName: degreeProgram.program_name,
        majorCanonicalName: major.canonical_name,
        majorDisplayName: major.display_name,
        sourceUrl: major.source_url,
        confidenceLabel: major.confidence_label,
        truthStatus: major.truth_status,
      });
    }
  }

  return targets;
}

async function discoverRequirementsForTargets(input: {
  institutionCanonicalName: string;
  catalogLabel: string;
  scope: RequirementsScope;
  targets: RequirementTarget[];
}) {
  const programResults = [];

  for (const target of input.targets) {
    const result = await discoverProgramRequirements({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel: input.catalogLabel,
      degreeType: target.degreeType,
      programName: target.programName,
      majorCanonicalName: target.majorCanonicalName,
    });

    programResults.push({
      degreeType: target.degreeType,
      programName: target.programName,
      majorCanonicalName: target.majorCanonicalName,
      majorDisplayName: target.majorDisplayName,
      status: result.status,
      uploadRecommended: result.uploadRecommended,
      usedLlmAssistance: result.usedLlmAssistance,
      diagnostics: result.diagnostics?.slice(0, 6) || [],
      major: result.major
        ? {
            status: result.major.status,
            discoveredCourseCount: result.major.discoveredCourseCount,
            sourcePage: result.major.sourcePage,
            provenanceMethod: result.major.provenanceMethod || null,
          }
        : null,
    });
  }

  return {
    scope: input.scope,
    attemptedCount: programResults.length,
    successfulCount: programResults.filter((result) => result.status === "requirements_discovered").length,
    uploadRecommendedCount: programResults.filter((result) => result.uploadRecommended).length,
    usedLlmAssistanceCount: programResults.filter((result) => result.usedLlmAssistance).length,
    programs: programResults,
  };
}

async function runSchoolCase(
  school: Top50SchoolCase,
  options: {
    dryRun: boolean;
    forceRefresh: boolean;
    includeRequirements: boolean;
    requirementsScope: RequirementsScope;
    requirementsLimit: number;
  }
) {
  const resolution = await resolveInstitutionExact(school);
  if (!resolution) {
    return {
      institutionDisplayName: school.institutionDisplayName,
      usNewsRank: school.usNewsRank,
      ok: false,
      reason: "institution_not_found_exact",
    };
  }

  const institution = resolution.institution;
  if (!options.dryRun && school.websiteUrl && institution.website_url !== school.websiteUrl) {
    await repo.upsertInstitution({
      institutionId: institution.institution_id,
      canonicalName: institution.canonical_name,
      displayName: institution.display_name,
      countryCode: institution.country_code,
      stateRegion: institution.state_region,
      city: institution.city,
      websiteUrl: school.websiteUrl,
    });
  }

  const before = await summarizeInstitution(institution.institution_id);

  if (options.dryRun) {
    return {
      institutionDisplayName: school.institutionDisplayName,
      resolvedDisplayName: institution.display_name,
      canonicalName: institution.canonical_name,
      usNewsRank: school.usNewsRank,
      matchedBy: resolution.matchedBy,
      officialProgramsUrl: school.officialProgramsUrl || null,
      officialCatalogUrl: school.officialCatalogUrl || null,
      status: school.status || "pending_review",
      countsBefore: before,
      ok: true,
    };
  }

  const discovery = await discoverInstitutionCatalog({
    institutionCanonicalName: institution.canonical_name,
    forceRefresh: options.forceRefresh,
    preferredSeedUrls: [school.officialProgramsUrl, school.officialCatalogUrl].filter(
      (value): value is string => !!value && !!value.trim()
    ),
  });

  const after = await summarizeInstitution(institution.institution_id);
  const catalogs = await repo.listAcademicCatalogsForInstitution(institution.institution_id);
  const catalog =
    (discovery.catalogLabel
      ? catalogs.find((entry) => entry.catalog_label === discovery.catalogLabel)
      : null) ||
    catalogs[0] ||
    null;

  const bestProgram = catalog ? await pickBestProgram(catalog.academic_catalog_id) : null;
  const catalogRequirementTargets = catalog ? await listRequirementTargetsForCatalog(catalog.academic_catalog_id) : [];
  const selectedRequirementTargets =
    options.includeRequirements && catalog
      ? selectRequirementTargets({
          scope: options.requirementsScope,
          limit: options.requirementsLimit,
          targets: catalogRequirementTargets,
          bestProgram,
        })
      : [];

  const requirements =
    options.includeRequirements && catalog && selectedRequirementTargets.length > 0
      ? await discoverRequirementsForTargets({
          institutionCanonicalName: institution.canonical_name,
          catalogLabel: catalog.catalog_label,
          scope: options.requirementsScope,
          targets: selectedRequirementTargets,
        })
      : null;

  return {
    institutionDisplayName: school.institutionDisplayName,
    resolvedDisplayName: institution.display_name,
    canonicalName: institution.canonical_name,
    usNewsRank: school.usNewsRank,
    matchedBy: resolution.matchedBy,
    officialProgramsUrl: school.officialProgramsUrl || null,
    officialCatalogUrl: school.officialCatalogUrl || null,
    status: school.status || "pending_review",
    countsBefore: before,
    offerings: {
      status: discovery.status,
      uploadRecommended: discovery.uploadRecommended,
      catalogLabel: discovery.catalogLabel,
      discoveredDegreeProgramCount: discovery.discoveredDegreeProgramCount,
      discoveredMajorCount: discovery.discoveredMajorCount,
      discoveredMinorCount: discovery.discoveredMinorCount,
      sourcePages: discovery.sourcePages.slice(0, 6),
      message: discovery.message,
    },
    bestProgram,
    requirements,
    countsAfter: await summarizeInstitution(institution.institution_id),
    ok: true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = loadFixture(args.fixture);
  let schools = fixture.schools;

  if (args.rank) {
    schools = schools.filter((school) => school.usNewsRank === args.rank);
  }
  if (args.tag) {
    schools = schools.filter((school) => (school.tags || []).includes(args.tag!));
  }
  if (args.school) {
    schools = schools.filter((school) => normalize(school.institutionDisplayName).includes(normalize(args.school!)));
  }
  if (args.offset > 0) schools = schools.slice(args.offset);
  if (args.limit > 0) schools = schools.slice(0, args.limit);

  const results = [];
  for (const school of schools) {
    console.log(
      `Running top-50 academic discovery ${args.dryRun ? "dry run" : "apply"} for #${school.usNewsRank} ${school.institutionDisplayName}...`
    );
    try {
      const result = await runSchoolCase(school, {
        dryRun: args.dryRun,
        forceRefresh: args.force,
        includeRequirements: args.includeRequirements,
        requirementsScope: args.requirementsScope,
        requirementsLimit: args.requirementsLimit,
      });
      results.push(result);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const result = {
        institutionDisplayName: school.institutionDisplayName,
        usNewsRank: school.usNewsRank,
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
    dryRun: args.dryRun,
    includeRequirements: args.includeRequirements,
    requirementsScope: args.requirementsScope,
    requirementsLimit: args.requirementsLimit,
    schoolCount: schools.length,
    passed: results.length - failures.length,
    failed: failures.length,
    failures,
  };

  console.log("Top-50 academic discovery summary:");
  console.log(JSON.stringify(summary, null, 2));

  await getDbPool().end();
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function isDirectExecution() {
  const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
  const modulePath = fileURLToPath(import.meta.url);
  return !!executedPath && path.resolve(modulePath) === executedPath;
}

if (isDirectExecution()) {
  main().catch(async (error) => {
    console.error("Top-50 academic discovery run failed:");
    console.error(error);
    await getDbPool().end().catch(() => undefined);
    process.exitCode = 1;
  });
}
