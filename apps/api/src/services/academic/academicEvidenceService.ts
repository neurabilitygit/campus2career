import type {
  AcademicDiscoveryStatus,
  AcademicDiscoverySource,
} from "../../../../../packages/shared/src/contracts/academic";
import { CatalogRepository } from "../../repositories/academic/catalogRepository";
import { AcademicEvidenceRepository } from "../../repositories/academic/academicEvidenceRepository";
import { buildCurriculumReviewPayload } from "./curriculumReview";
import {
  assignStudentCatalog,
  getPrimaryRequirementSetGraphForStudent,
  getPrimaryStudentCatalogContext,
  upsertAcademicCatalog,
  upsertConcentration,
  upsertDegreeProgram,
  upsertInstitution,
  upsertMajor,
  upsertMinor,
} from "./catalogService";
import { discoverInstitutionCatalog, discoverProgramRequirements } from "./catalogDiscoveryService";
import { inferAcademicOfferingsFromInstitutionKnowledge } from "../openai/responsesClient";
import { stableId } from "../market/idFactory";

const catalogRepo = new CatalogRepository();
const evidenceRepo = new AcademicEvidenceRepository();
const SCRAPE_TIMEOUT_MS = 10000;

function normalizeAcademicOfferingName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function dedupeOfferingNames(values: string[]) {
  const deduped = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeAcademicOfferingName(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, normalized);
    }
  }
  return Array.from(deduped.values());
}

export function evaluateOfferingsReasonableness(input: {
  institutionDisplayName: string;
  majors: string[];
  minors?: string[];
  concentrations?: string[];
  sourceUrl?: string | null;
  catalogYear?: string | null;
}) {
  const majors = dedupeOfferingNames(input.majors);
  const minors = dedupeOfferingNames(input.minors || []);
  const concentrations = dedupeOfferingNames(input.concentrations || []);
  const notes: string[] = [];

  if (!majors.length) {
    notes.push("At least one major must be present.");
  }
  const genericPattern = /^(academics|programs|degrees|undergraduate|graduate|major|minor)$/i;
  if (majors.some((name) => genericPattern.test(name)) || minors.some((name) => genericPattern.test(name))) {
    notes.push("One or more discovered offering names still look like generic navigation labels.");
  }
  if (majors.some((name) => name.length < 3 || name.length > 120)) {
    notes.push("One or more major names have implausible length.");
  }
  if (!input.sourceUrl) {
    notes.push("No source URL was captured for the discovered offering set.");
  }
  if (!input.catalogYear) {
    notes.push("Catalog year is unknown, so review is still required.");
  }

  const status: AcademicDiscoveryStatus =
    !majors.length
      ? "failed"
      : notes.length > 2
        ? "questionable"
        : notes.length > 0
          ? "needs_review"
          : "succeeded";

  return {
    status,
    normalized: {
      institutionDisplayName: input.institutionDisplayName,
      majors,
      minors,
      concentrations,
      catalogYear: input.catalogYear || null,
    },
    confidenceLabel: (!majors.length ? "low" : notes.length > 1 ? "low" : notes.length === 1 ? "medium" : "high") as
      | "low"
      | "medium"
      | "high",
    truthStatus: input.sourceUrl ? "direct" as const : "inferred" as const,
    notes,
  };
}

export function evaluateDegreeRequirementsReasonableness(input: {
  requirementGroupCount: number;
  requirementItemCount: number;
  totalCreditsRequired?: number | null;
  sourceUrl?: string | null;
  catalogYear?: string | null;
}) {
  const notes: string[] = [];
  if (input.requirementGroupCount < 1) {
    notes.push("At least one requirement group must be present.");
  }
  if (input.requirementItemCount < 1) {
    notes.push("Requirement items are missing.");
  }
  if (input.totalCreditsRequired != null && (input.totalCreditsRequired <= 0 || input.totalCreditsRequired > 220)) {
    notes.push("The total credit requirement is outside the plausible range.");
  }
  if (!input.sourceUrl) {
    notes.push("No source URL or artifact source was captured.");
  }
  if (!input.catalogYear) {
    notes.push("Catalog year is unknown, so review is still required.");
  }

  const status: AcademicDiscoveryStatus =
    input.requirementGroupCount < 1 || input.requirementItemCount < 1
      ? "failed"
      : notes.length > 2
        ? "questionable"
        : notes.length > 0
          ? "needs_review"
          : "succeeded";

  return {
    status,
    confidenceLabel: (
      input.requirementItemCount < 1 ? "low" : notes.length > 1 ? "low" : notes.length === 1 ? "medium" : "high"
    ) as "low" | "medium" | "high",
    truthStatus: input.sourceUrl ? "direct" as const : "inferred" as const,
    notes,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function recordAttempt(input: {
  studentProfileId: string;
  institutionId?: string | null;
  academicCatalogId?: string | null;
  discoveryType: "offerings" | "degree_requirements";
  requestedEntityType: "institution" | "major" | "minor" | "concentration" | "degree_core" | "general_education";
  requestedEntityName?: string | null;
  sourceAttempted: AcademicDiscoverySource;
  status: AcademicDiscoveryStatus;
  confidenceLabel?: "low" | "medium" | "high";
  truthStatus?: "direct" | "inferred" | "placeholder" | "fallback" | "unresolved";
  sourceUrl?: string | null;
  sourceNote?: string | null;
  reasonablenessNotes?: string | null;
  rawResultJson?: unknown;
  normalizedResultJson?: unknown;
  requestedByUserId?: string | null;
}) {
  await evidenceRepo.insertDiscoveryAttempt({
    academicDiscoveryAttemptId: stableId(
      "academic_discovery_attempt",
      `${input.studentProfileId}:${input.discoveryType}:${input.sourceAttempted}:${Date.now()}:${input.requestedEntityName || "root"}`
    ),
    ...input,
    completedAt: new Date().toISOString(),
  });
}

async function persistLlmOfferings(input: {
  institutionCanonicalName: string;
  institutionDisplayName: string;
  institutionId: string;
  requestedByUserId: string;
  studentProfileId: string;
  offerings: {
    majors: string[];
    minors: string[];
    concentrations: string[];
    catalogYear?: string | null;
    sourceConfidence: "low" | "medium" | "high";
    uncertaintyNotes: string[];
  };
}) {
  const startYear = new Date().getFullYear();
  const catalogLabel = input.offerings.catalogYear || `LLM-assisted ${startYear}-${startYear + 1}`;

  await upsertInstitution({
    canonicalName: input.institutionCanonicalName,
    displayName: input.institutionDisplayName,
  });
  const academicCatalogId = await upsertAcademicCatalog({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    startYear,
    endYear: startYear + 1,
    sourceFormat: "manual",
    extractionStatus: "draft",
  });
  await upsertDegreeProgram({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    degreeType: "Undergraduate",
    programName: "LLM-assisted undergraduate programs",
    schoolName: input.institutionDisplayName,
  });

  for (const major of dedupeOfferingNames(input.offerings.majors)) {
    await upsertMajor({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel,
      degreeType: "Undergraduate",
      programName: "LLM-assisted undergraduate programs",
      canonicalName: major.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      displayName: major,
      provenanceMethod: "llm_assisted",
      sourceNote: input.offerings.uncertaintyNotes.join(" ") || "Populated with LLM assistance when seeded and scrape discovery were incomplete.",
      confidenceLabel: input.offerings.sourceConfidence,
      truthStatus: "inferred",
      discoveredAt: new Date().toISOString(),
    });
  }

  for (const minor of dedupeOfferingNames(input.offerings.minors)) {
    await upsertMinor({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel,
      degreeType: "Undergraduate",
      programName: "LLM-assisted undergraduate programs",
      canonicalName: minor.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      displayName: minor,
      provenanceMethod: "llm_assisted",
      sourceNote: input.offerings.uncertaintyNotes.join(" ") || "Populated with LLM assistance when seeded and scrape discovery were incomplete.",
      confidenceLabel: input.offerings.sourceConfidence,
      truthStatus: "inferred",
      discoveredAt: new Date().toISOString(),
    });
  }

  await evidenceRepo.updateCatalogDiscoveryMetadata({
    academicCatalogId,
    discoveryStatus: "needs_review",
    discoveryStartedAt: new Date().toISOString(),
    discoveryCompletedAt: new Date().toISOString(),
    discoverySource: "llm_training_data",
    discoveryConfidenceLabel: input.offerings.sourceConfidence,
    discoveryTruthStatus: "inferred",
    discoveryNotes:
      input.offerings.uncertaintyNotes.join(" ") ||
      "Offerings were populated with LLM assistance because the structured directory and scrape paths were incomplete.",
  });

  await recordAttempt({
    studentProfileId: input.studentProfileId,
    institutionId: input.institutionId,
    academicCatalogId,
    discoveryType: "offerings",
    requestedEntityType: "institution",
    requestedEntityName: input.institutionDisplayName,
    sourceAttempted: "llm_training_data",
    status: "needs_review",
    confidenceLabel: input.offerings.sourceConfidence,
    truthStatus: "inferred",
    sourceNote: "Offerings populated with LLM assistance",
    normalizedResultJson: input.offerings,
    requestedByUserId: input.requestedByUserId,
  });

  return { academicCatalogId, catalogLabel };
}

export async function discoverOfferingsForInstitution(input: {
  studentProfileId: string;
  userId: string;
  institutionCanonicalName: string;
}) {
  const institution = await catalogRepo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalogs = await catalogRepo.listAcademicCatalogsForInstitution(institution.institution_id);
  let seededMajorCount = 0;
  let seededMinorCount = 0;
  for (const catalog of catalogs) {
    const degreePrograms = await catalogRepo.listDegreeProgramsForCatalog(catalog.academic_catalog_id);
    for (const program of degreePrograms) {
      const [majors, minors] = await Promise.all([
        catalogRepo.listMajorsForDegreeProgram(program.degree_program_id),
        catalogRepo.listMinorsForDegreeProgram(program.degree_program_id),
      ]);
      seededMajorCount += majors.length;
      seededMinorCount += minors.length;
    }
  }

  if (seededMajorCount > 0) {
    await recordAttempt({
      studentProfileId: input.studentProfileId,
      institutionId: institution.institution_id,
      discoveryType: "offerings",
      requestedEntityType: "institution",
      requestedEntityName: institution.display_name,
      sourceAttempted: "seeded_database",
      status: "succeeded",
      confidenceLabel: "high",
      truthStatus: "direct",
      sourceNote: "Structured offerings were already present in the seeded academic directory.",
      requestedByUserId: input.userId,
      normalizedResultJson: {
        seededMajorCount,
        seededMinorCount,
      },
    });
    return {
      status: "succeeded" as const,
      sourceUsed: "seeded_database" as const,
      manualInputRequired: false,
      uploadRecommended: false,
      message: "Structured majors and minors were found in the seeded academic directory.",
    };
  }

  try {
    const scrapeResult = await withTimeout(
      discoverInstitutionCatalog({
        institutionCanonicalName: input.institutionCanonicalName,
        forceRefresh: true,
      }),
      SCRAPE_TIMEOUT_MS,
      "ACADEMIC_OFFERINGS_SCRAPE_TIMEOUT"
    );

    const refreshedCatalogs = await catalogRepo.listAcademicCatalogsForInstitution(institution.institution_id);
    let refreshedMajors = 0;
    let refreshedMinors = 0;
    for (const catalog of refreshedCatalogs) {
      const degreePrograms = await catalogRepo.listDegreeProgramsForCatalog(catalog.academic_catalog_id);
      for (const program of degreePrograms) {
        const [majors, minors] = await Promise.all([
          catalogRepo.listMajorsForDegreeProgram(program.degree_program_id),
          catalogRepo.listMinorsForDegreeProgram(program.degree_program_id),
        ]);
        refreshedMajors += majors.length;
        refreshedMinors += minors.length;
      }
    }

    const assessment = evaluateOfferingsReasonableness({
      institutionDisplayName: institution.display_name,
      majors: Array.from({ length: refreshedMajors }, (_, index) => `major-${index}`),
      minors: Array.from({ length: refreshedMinors }, (_, index) => `minor-${index}`),
      sourceUrl: scrapeResult.websiteUrl || scrapeResult.sourcePages?.[0] || institution.website_url,
      catalogYear: scrapeResult.catalogLabel || null,
    });

    if (refreshedMajors > 0) {
      await recordAttempt({
        studentProfileId: input.studentProfileId,
        institutionId: institution.institution_id,
        discoveryType: "offerings",
        requestedEntityType: "institution",
        requestedEntityName: institution.display_name,
        sourceAttempted: "scrape",
        status: assessment.status,
        confidenceLabel: assessment.confidenceLabel,
        truthStatus: assessment.truthStatus,
        sourceUrl: scrapeResult.websiteUrl || scrapeResult.sourcePages?.[0] || institution.website_url,
        sourceNote: scrapeResult.message,
        reasonablenessNotes: assessment.notes.join(" "),
        rawResultJson: scrapeResult,
        normalizedResultJson: assessment.normalized,
        requestedByUserId: input.userId,
      });
      return {
        status: assessment.status,
        sourceUsed: "scrape" as const,
        manualInputRequired: false,
        uploadRecommended: scrapeResult.uploadRecommended,
        message: scrapeResult.message,
      };
    }
  } catch (error) {
    await recordAttempt({
      studentProfileId: input.studentProfileId,
      institutionId: institution.institution_id,
      discoveryType: "offerings",
      requestedEntityType: "institution",
      requestedEntityName: institution.display_name,
      sourceAttempted: "scrape",
      status: "failed",
      confidenceLabel: "low",
      truthStatus: "unresolved",
      sourceUrl: institution.website_url,
      sourceNote: error instanceof Error ? error.message : String(error),
      requestedByUserId: input.userId,
    });
  }

  const llmResult = await inferAcademicOfferingsFromInstitutionKnowledge({
    institutionDisplayName: institution.display_name,
    institutionWebsiteUrl: institution.website_url,
    telemetry: {
      runType: "requirements_repair",
      promptVersion: "academic-offerings-v1",
      inputPayload: {
        institutionDisplayName: institution.display_name,
        institutionWebsiteUrl: institution.website_url,
      },
      studentProfileId: input.studentProfileId,
    },
  });

  const llmAssessment = evaluateOfferingsReasonableness({
    institutionDisplayName: institution.display_name,
    majors: llmResult?.majors || [],
    minors: llmResult?.minors || [],
    concentrations: llmResult?.concentrations || [],
    sourceUrl: null,
    catalogYear: llmResult?.catalogYear || null,
  });

  if (llmResult && llmAssessment.normalized.majors.length > 0) {
    await persistLlmOfferings({
      institutionCanonicalName: input.institutionCanonicalName,
      institutionDisplayName: institution.display_name,
      institutionId: institution.institution_id,
      requestedByUserId: input.userId,
      studentProfileId: input.studentProfileId,
      offerings: {
        majors: llmAssessment.normalized.majors,
        minors: llmAssessment.normalized.minors,
        concentrations: llmAssessment.normalized.concentrations,
        catalogYear: llmResult.catalogYear || null,
        sourceConfidence: llmResult.sourceConfidence,
        uncertaintyNotes: llmResult.uncertaintyNotes,
      },
    });
    return {
      status: llmAssessment.status,
      sourceUsed: "llm_training_data" as const,
      manualInputRequired: false,
      uploadRecommended: false,
      message:
        "The seeded directory and school-site discovery did not return a reliable offering list, so the system populated majors and minors with LLM assistance. Review is still required.",
    };
  }

  await recordAttempt({
    studentProfileId: input.studentProfileId,
    institutionId: institution.institution_id,
    discoveryType: "offerings",
    requestedEntityType: "institution",
    requestedEntityName: institution.display_name,
    sourceAttempted: "manual_input",
    status: "needs_review",
    confidenceLabel: "low",
    truthStatus: "unresolved",
    sourceNote: "Automated offering discovery could not produce a reliable result. Manual entry is required.",
    requestedByUserId: input.userId,
  });

  return {
    status: "needs_review" as const,
    sourceUsed: "manual_input" as const,
    manualInputRequired: true,
    uploadRecommended: false,
    message:
      "Automated major and minor discovery did not produce a reliable result. Enter the program manually and review it before using it for scoring.",
  };
}

export async function saveManualOfferingInput(input: {
  studentProfileId: string;
  userId: string;
  institutionCanonicalName: string;
  institutionDisplayName?: string | null;
  catalogLabel?: string | null;
  degreeType: string;
  programName: string;
  majorDisplayName: string;
  minorDisplayName?: string | null;
  concentrationDisplayName?: string | null;
}) {
  const institution = await catalogRepo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const startYear = new Date().getFullYear();
  const catalogLabel = input.catalogLabel || `Manual ${startYear}-${startYear + 1}`;

  await upsertInstitution({
    canonicalName: input.institutionCanonicalName,
    displayName: input.institutionDisplayName || institution.display_name,
    websiteUrl: institution.website_url || undefined,
    city: institution.city || undefined,
    stateRegion: institution.state_region || undefined,
    countryCode: institution.country_code || undefined,
  });
  await upsertAcademicCatalog({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    startYear,
    endYear: startYear + 1,
    sourceFormat: "manual",
    extractionStatus: "draft",
  });
  await upsertDegreeProgram({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    degreeType: input.degreeType,
    programName: input.programName,
    schoolName: input.institutionDisplayName || institution.display_name,
  });
  const majorCanonicalName = normalizeAcademicOfferingName(input.majorDisplayName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  await upsertMajor({
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    degreeType: input.degreeType,
    programName: input.programName,
    canonicalName: majorCanonicalName,
    displayName: normalizeAcademicOfferingName(input.majorDisplayName),
    provenanceMethod: "manual",
    truthStatus: "direct",
    confidenceLabel: "medium",
    discoveredAt: new Date().toISOString(),
    sourceNote: "Entered manually by the user after automated discovery was insufficient.",
  });

  let minorCanonicalName: string | undefined;
  if (input.minorDisplayName) {
    minorCanonicalName = normalizeAcademicOfferingName(input.minorDisplayName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    await upsertMinor({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel,
      degreeType: input.degreeType,
      programName: input.programName,
      canonicalName: minorCanonicalName,
      displayName: normalizeAcademicOfferingName(input.minorDisplayName),
      provenanceMethod: "manual",
      truthStatus: "direct",
      confidenceLabel: "medium",
      discoveredAt: new Date().toISOString(),
      sourceNote: "Entered manually by the user after automated discovery was insufficient.",
    });
  }

  let concentrationCanonicalName: string | undefined;
  if (input.concentrationDisplayName) {
    concentrationCanonicalName = normalizeAcademicOfferingName(input.concentrationDisplayName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    await upsertConcentration({
      institutionCanonicalName: input.institutionCanonicalName,
      catalogLabel,
      degreeType: input.degreeType,
      programName: input.programName,
      majorCanonicalName,
      canonicalName: concentrationCanonicalName,
      displayName: normalizeAcademicOfferingName(input.concentrationDisplayName),
    });
  }

  await assignStudentCatalog({
    studentProfileId: input.studentProfileId,
    institutionCanonicalName: input.institutionCanonicalName,
    catalogLabel,
    degreeType: input.degreeType,
    programName: input.programName,
    majorCanonicalName,
    minorCanonicalName,
    concentrationCanonicalName,
    assignmentSource: "student_selected",
  });

  await recordAttempt({
    studentProfileId: input.studentProfileId,
    institutionId: institution.institution_id,
    discoveryType: "offerings",
    requestedEntityType: "institution",
    requestedEntityName: input.institutionDisplayName || institution.display_name,
    sourceAttempted: "manual_input",
    status: "succeeded",
    confidenceLabel: "medium",
    truthStatus: "direct",
    sourceNote: "Manual academic path entry saved.",
    requestedByUserId: input.userId,
    normalizedResultJson: {
      catalogLabel,
      degreeType: input.degreeType,
      programName: input.programName,
      majorDisplayName: input.majorDisplayName,
      minorDisplayName: input.minorDisplayName || null,
      concentrationDisplayName: input.concentrationDisplayName || null,
    },
  });
}

export async function discoverDegreeRequirementsForSelection(input: {
  studentProfileId: string;
  userId: string;
}) {
  const assignment = await getPrimaryStudentCatalogContext(input.studentProfileId);
  if (!assignment?.institution_canonical_name || !assignment.catalog_label || !assignment.degree_type || !assignment.program_name) {
    throw new Error("Academic path is incomplete. Save the institution, catalog, program, and major first.");
  }

  const existingRequirementGraph = await getPrimaryRequirementSetGraphForStudent(input.studentProfileId);
  if (existingRequirementGraph?.groups?.length) {
    const requirementItemCount = existingRequirementGraph.groups.reduce((sum, group) => sum + group.items.length, 0);
    const seededAssessment = evaluateDegreeRequirementsReasonableness({
      requirementGroupCount: existingRequirementGraph.groups.length,
      requirementItemCount,
      totalCreditsRequired: existingRequirementGraph.totalCreditsRequired,
      sourceUrl: existingRequirementGraph.sourceUrl,
      catalogYear: assignment.catalog_label,
    });
    await recordAttempt({
      studentProfileId: input.studentProfileId,
      institutionId: assignment.institution_id,
      academicCatalogId: assignment.academic_catalog_id,
      discoveryType: "degree_requirements",
      requestedEntityType: assignment.minor_canonical_name ? "minor" : "major",
      requestedEntityName: assignment.major_display_name || assignment.minor_display_name || assignment.program_name,
      sourceAttempted: "seeded_database",
      status: seededAssessment.status,
      confidenceLabel: seededAssessment.confidenceLabel,
      truthStatus: seededAssessment.truthStatus,
      sourceUrl: existingRequirementGraph.sourceUrl,
      sourceNote: existingRequirementGraph.sourceNote,
      reasonablenessNotes: seededAssessment.notes.join(" "),
      requestedByUserId: input.userId,
    });
    return {
      status: seededAssessment.status,
      sourceUsed: "seeded_database" as const,
      uploadRequired: false,
      message: "Structured degree requirements were already present for this academic path.",
    };
  }

  const result = await withTimeout(
    discoverProgramRequirements({
      institutionCanonicalName: assignment.institution_canonical_name,
      catalogLabel: assignment.catalog_label,
      degreeType: assignment.degree_type,
      programName: assignment.program_name,
      majorCanonicalName: assignment.major_canonical_name || undefined,
      minorCanonicalName: assignment.minor_canonical_name || undefined,
    }),
    SCRAPE_TIMEOUT_MS,
    "ACADEMIC_REQUIREMENTS_DISCOVERY_TIMEOUT"
  );

  const requirementGraph = await getPrimaryRequirementSetGraphForStudent(input.studentProfileId);
  const requirementItemCount = requirementGraph?.groups?.reduce((sum, group) => sum + group.items.length, 0) || 0;
  const assessment = evaluateDegreeRequirementsReasonableness({
    requirementGroupCount: requirementGraph?.groups.length || 0,
    requirementItemCount,
    totalCreditsRequired: requirementGraph?.totalCreditsRequired,
    sourceUrl: requirementGraph?.sourceUrl || null,
    catalogYear: assignment.catalog_label,
  });
  const sourceUsed: AcademicDiscoverySource =
    result.usedLlmAssistance ? "llm_training_data" : result.uploadRecommended ? "scrape" : "scrape";

  await recordAttempt({
    studentProfileId: input.studentProfileId,
    institutionId: assignment.institution_id,
    academicCatalogId: assignment.academic_catalog_id,
    discoveryType: "degree_requirements",
    requestedEntityType: assignment.minor_canonical_name ? "minor" : "major",
    requestedEntityName: assignment.major_display_name || assignment.minor_display_name || assignment.program_name,
    sourceAttempted: sourceUsed,
    status: result.uploadRecommended ? "needs_review" : assessment.status,
    confidenceLabel: assessment.confidenceLabel,
    truthStatus: result.usedLlmAssistance ? "inferred" : assessment.truthStatus,
    sourceUrl: requirementGraph?.sourceUrl || null,
    sourceNote: result.message,
    reasonablenessNotes: assessment.notes.join(" "),
    rawResultJson: result,
    requestedByUserId: input.userId,
  });

  return {
    status: result.uploadRecommended ? "needs_review" : assessment.status,
    sourceUsed,
    uploadRequired: result.uploadRecommended,
    message: result.message,
    diagnostics: result.diagnostics || [],
  };
}

export async function getAcademicEvidenceState(input: {
  studentProfileId: string;
  role: "student" | "parent" | "coach" | "admin";
}) {
  const [assignment, curriculum, recentAttempts, institution] = await Promise.all([
    getPrimaryStudentCatalogContext(input.studentProfileId),
    buildCurriculumReviewPayload(input.studentProfileId, input.role),
    evidenceRepo.listRecentDiscoveryAttempts(input.studentProfileId, 8),
    (async () => {
      const currentAssignment = await getPrimaryStudentCatalogContext(input.studentProfileId);
      return currentAssignment?.institution_canonical_name
        ? catalogRepo.getInstitutionByCanonicalName(currentAssignment.institution_canonical_name)
        : null;
    })(),
  ]);

  let directoryOptionCounts = {
    catalogs: 0,
    degreePrograms: 0,
    majors: 0,
    minors: 0,
    concentrations: 0,
  };

  if (assignment?.institution_id) {
    const catalogs = await catalogRepo.listAcademicCatalogsForInstitution(assignment.institution_id);
    directoryOptionCounts.catalogs = catalogs.length;
    for (const catalog of catalogs) {
      const degreePrograms = await catalogRepo.listDegreeProgramsForCatalog(catalog.academic_catalog_id);
      directoryOptionCounts.degreePrograms += degreePrograms.length;
      for (const degreeProgram of degreePrograms) {
        const majors = await catalogRepo.listMajorsForDegreeProgram(degreeProgram.degree_program_id);
        const minors = await catalogRepo.listMinorsForDegreeProgram(degreeProgram.degree_program_id);
        directoryOptionCounts.majors += majors.length;
        directoryOptionCounts.minors += minors.length;
        for (const major of majors) {
          const concentrations = await catalogRepo.listConcentrationsForMajor(major.major_id);
          directoryOptionCounts.concentrations += concentrations.length;
        }
      }
    }
  }

  const latestOfferingAttempt = recentAttempts.find((item) => item.discovery_type === "offerings") || null;
  const latestRequirementAttempt = recentAttempts.find((item) => item.discovery_type === "degree_requirements") || null;

  return {
    assignment: assignment
      ? {
          institutionCanonicalName: assignment.institution_canonical_name,
          institutionDisplayName: assignment.institution_display_name,
          catalogLabel: assignment.catalog_label,
          degreeType: assignment.degree_type,
          programName: assignment.program_name,
          majorDisplayName: assignment.major_display_name,
          minorDisplayName: assignment.minor_display_name,
          concentrationDisplayName: assignment.concentration_display_name,
        }
      : null,
    offerings: {
      counts: directoryOptionCounts,
      latestAttempt: latestOfferingAttempt,
      sourceLabel:
        latestOfferingAttempt?.source_attempted === "seeded_database"
          ? "Seeded database"
          : latestOfferingAttempt?.source_attempted === "scrape"
            ? "Scraped school website"
            : latestOfferingAttempt?.source_attempted === "llm_training_data"
              ? "LLM-assisted"
              : latestOfferingAttempt?.source_attempted === "manual_input"
                ? "Manual entry"
                : "Unknown",
      status: latestOfferingAttempt?.status || (directoryOptionCounts.majors > 0 ? "succeeded" : "not_started"),
    },
    degreeRequirements: {
      latestAttempt: latestRequirementAttempt,
      status:
        curriculum.verification.effectiveStatus === "missing"
          ? latestRequirementAttempt?.status || "not_started"
          : curriculum.verification.effectiveStatus === "verified"
            ? "succeeded"
            : "needs_review",
      sourceLabel: curriculum.summary.sourceLabel,
    },
    curriculum,
    institutionWebsiteUrl: institution?.website_url || null,
    recentAttempts,
  };
}
