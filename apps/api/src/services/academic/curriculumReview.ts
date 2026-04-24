import type {
  CurriculumVerificationRecord,
  CurriculumVerificationStatus,
  RequirementSetProvenanceMethod,
} from "../../../../../packages/shared/src/contracts/academic";
import { CatalogRepository } from "../../repositories/academic/catalogRepository";
import { CurriculumVerificationRepository } from "../../repositories/academic/curriculumVerificationRepository";
import { buildAcademicScoringEvidence } from "./scoringEvidence";
import { getPrimaryRequirementSetGraphForStudent, getPrimaryStudentCatalogContext } from "./catalogService";
import type { RequestContext } from "../auth/resolveRequestContext";

const catalogRepo = new CatalogRepository();
const reviewRepo = new CurriculumVerificationRepository();

export interface CurriculumRequirementGroupDetail {
  requirementGroupId: string;
  groupName: string;
  groupType: string;
  minCoursesRequired?: number | null;
  minCreditsRequired?: number | null;
  notes?: string | null;
  items: Array<{
    requirementItemId: string;
    itemType: string;
    label: string;
    creditsIfUsed?: number | null;
    uncertain: boolean;
  }>;
}

export interface CurriculumReviewPayload {
  verification: CurriculumVerificationRecord & {
    effectiveStatus: CurriculumVerificationStatus;
    canVerify: boolean;
    canRequestPopulation: boolean;
    canUploadPdf: boolean;
    canCoachReview: boolean;
  };
  summary: {
    institutionName?: string | null;
    degreeProgram?: string | null;
    major?: string | null;
    catalogYear?: string | null;
    requirementSetSummary?: string | null;
    completionPercent?: number | null;
    completenessIndicator: "missing" | "partial" | "good";
    sourceProvenance: RequirementSetProvenanceMethod | "unknown";
    sourceLabel: string;
    sourceUrl?: string | null;
    sourceNote?: string | null;
    totalRequirementGroups: number;
    totalRequirementItems: number;
  };
  details: {
    creditRequirements?: number | null;
    requirementGroups: CurriculumRequirementGroupDetail[];
    missingOrUncertainFields: string[];
    parsingNotes: string[];
    latestPdfUploadId?: string | null;
  };
  alerts: Array<{
    level: "high" | "info";
    code: "missing_curriculum" | "unverified_curriculum" | "verified_curriculum";
    message: string;
  }>;
}

function sourceLabelForProvenance(provenance: RequirementSetProvenanceMethod | "unknown" | null | undefined): string {
  switch (provenance) {
    case "direct_scrape":
      return "Direct scrape";
    case "artifact_pdf":
      return "Uploaded PDF";
    case "manual":
      return "Manual entry";
    case "llm_assisted":
      return "LLM-assisted";
    case "synthetic_seed":
      return "Seeded fallback";
    default:
      return "Unknown";
  }
}

export function canVerifyCurriculum(role: RequestContext["authenticatedRoleType"]): boolean {
  return role === "student" || role === "parent" || role === "admin";
}

export function canCoachReviewCurriculum(role: RequestContext["authenticatedRoleType"]): boolean {
  return role === "coach" || role === "admin";
}

export function canUploadCurriculumPdf(role: RequestContext["authenticatedRoleType"]): boolean {
  return role === "student" || role === "parent" || role === "admin";
}

export function computeEffectiveCurriculumStatus(input: {
  hasCurriculum: boolean;
  storedStatus?: CurriculumVerificationStatus | null;
}): CurriculumVerificationStatus {
  if (!input.hasCurriculum) {
    return "missing";
  }
  if (input.storedStatus === "verified") {
    return "verified";
  }
  if (input.storedStatus === "needs_attention") {
    return "needs_attention";
  }
  return "present_unverified";
}

export function buildCurriculumAlerts(input: {
  effectiveStatus: CurriculumVerificationStatus;
}): CurriculumReviewPayload["alerts"] {
  if (input.effectiveStatus === "missing") {
    return [
      {
        level: "high",
        code: "missing_curriculum",
        message:
          "Degree requirements must be reviewed before scoring because the readiness score depends on accurate curriculum information.",
      },
    ];
  }
  if (input.effectiveStatus === "verified") {
    return [
      {
        level: "info",
        code: "verified_curriculum",
        message: "Degree requirements have been visually reviewed and can be used as verified curriculum context.",
      },
    ];
  }
  return [
    {
      level: "high",
      code: "unverified_curriculum",
      message:
        "Degree requirements are present but still need visual review before scoring should be treated as authoritative.",
    },
  ];
}

export async function buildCurriculumReviewPayload(
  studentProfileId: string,
  role: RequestContext["authenticatedRoleType"]
): Promise<CurriculumReviewPayload> {
  const [assignment, requirementGraph, academicEvidence, reviewRecord] = await Promise.all([
    getPrimaryStudentCatalogContext(studentProfileId),
    getPrimaryRequirementSetGraphForStudent(studentProfileId),
    buildAcademicScoringEvidence(studentProfileId),
    reviewRepo.getForStudent(studentProfileId),
  ]);

  const hasCurriculum = !!assignment && !!requirementGraph;
  const effectiveStatus = computeEffectiveCurriculumStatus({
    hasCurriculum,
    storedStatus: reviewRecord?.curriculumVerificationStatus ?? null,
  });

  const catalogCourses =
    assignment?.academic_catalog_id
      ? await catalogRepo.listCatalogCourses(assignment.academic_catalog_id)
      : [];
  const catalogCourseById = new Map(
    catalogCourses.map((course) => [course.catalog_course_id, course] as const)
  );

  const requirementGroups: CurriculumRequirementGroupDetail[] = (requirementGraph?.groups || []).map((group) => ({
    requirementGroupId: group.requirementGroupId,
    groupName: group.groupName,
    groupType: group.groupType,
    minCoursesRequired: group.minCoursesRequired,
    minCreditsRequired: group.minCreditsRequired,
    notes: group.notes,
    items: group.items.map((item) => {
      const catalogCourse = item.catalogCourseId ? catalogCourseById.get(item.catalogCourseId) : null;
      const label =
        item.itemLabel ||
        (catalogCourse
          ? `${catalogCourse.course_code}${catalogCourse.course_title ? ` — ${catalogCourse.course_title}` : ""}`
          : item.courseCode ||
            (item.coursePrefix && item.minLevel
              ? `${item.coursePrefix} ${item.minLevel}+`
              : item.coursePrefix
                ? `${item.coursePrefix} elective`
                : "Requirement item"));
      const uncertain = !item.itemLabel && !catalogCourse && !item.courseCode && !item.coursePrefix;
      return {
        requirementItemId: item.requirementItemId,
        itemType: item.itemType,
        label,
        creditsIfUsed: item.creditsIfUsed,
        uncertain,
      };
    }),
  }));

  const missingOrUncertainFields: string[] = [];
  if (!assignment?.institution_display_name) missingOrUncertainFields.push("Institution name");
  if (!assignment?.program_name) missingOrUncertainFields.push("Degree program");
  if (!assignment?.major_display_name) missingOrUncertainFields.push("Major");
  if (!assignment?.catalog_label) missingOrUncertainFields.push("Catalog year");
  if (!requirementGraph?.displayName) missingOrUncertainFields.push("Requirement set summary");
  if (requirementGroups.some((group) => group.items.some((item) => item.uncertain))) {
    missingOrUncertainFields.push("One or more requirement items still lack a clear course or category label");
  }

  const parsingNotes = [
    ...(academicEvidence.requirementProgress?.coverageNotes || []),
    ...(requirementGraph?.sourceNote ? [requirementGraph.sourceNote] : []),
  ];

  const sourceProvenance = requirementGraph?.provenanceMethod || reviewRecord?.curriculumSource || "unknown";
  const totalRequirementItems = requirementGroups.reduce((sum, group) => sum + group.items.length, 0);
  const completenessIndicator =
    !hasCurriculum
      ? "missing"
      : totalRequirementItems >= 6 && requirementGroups.length >= 2
        ? "good"
        : "partial";

  return {
    verification: {
      curriculumVerificationStatus: reviewRecord?.curriculumVerificationStatus || effectiveStatus,
      curriculumVerifiedAt: reviewRecord?.curriculumVerifiedAt ?? null,
      curriculumVerifiedByUserId: reviewRecord?.curriculumVerifiedByUserId ?? null,
      curriculumVerificationNotes: reviewRecord?.curriculumVerificationNotes ?? null,
      curriculumRequestedAt: reviewRecord?.curriculumRequestedAt ?? null,
      curriculumRequestedByUserId: reviewRecord?.curriculumRequestedByUserId ?? null,
      curriculumPdfUploadId: reviewRecord?.curriculumPdfUploadId ?? null,
      curriculumSource: reviewRecord?.curriculumSource || sourceProvenance,
      coachReviewedAt: reviewRecord?.coachReviewedAt ?? null,
      coachReviewedByUserId: reviewRecord?.coachReviewedByUserId ?? null,
      effectiveStatus,
      canVerify: canVerifyCurriculum(role),
      canRequestPopulation: true,
      canUploadPdf: canUploadCurriculumPdf(role),
      canCoachReview: canCoachReviewCurriculum(role),
    },
    summary: {
      institutionName: assignment?.institution_display_name || null,
      degreeProgram: assignment?.program_name || null,
      major: assignment?.major_display_name || null,
      catalogYear: assignment?.catalog_label || null,
      requirementSetSummary: requirementGraph?.displayName || null,
      completionPercent: academicEvidence.requirementProgress?.completionPercent ?? null,
      completenessIndicator,
      sourceProvenance,
      sourceLabel: sourceLabelForProvenance(sourceProvenance),
      sourceUrl: requirementGraph?.sourceUrl || null,
      sourceNote: requirementGraph?.sourceNote || null,
      totalRequirementGroups: requirementGroups.length,
      totalRequirementItems,
    },
    details: {
      creditRequirements: requirementGraph?.totalCreditsRequired ?? null,
      requirementGroups,
      missingOrUncertainFields,
      parsingNotes: Array.from(new Set(parsingNotes.filter(Boolean))),
      latestPdfUploadId: reviewRecord?.curriculumPdfUploadId ?? null,
    },
    alerts: buildCurriculumAlerts({ effectiveStatus }),
  };
}

export async function saveCurriculumVerification(input: {
  studentProfileId: string;
  userId: string;
  status: CurriculumVerificationStatus;
  verificationNotes?: string | null;
  curriculumSource?: RequirementSetProvenanceMethod | "unknown" | null;
}) {
  const verifiedAt = new Date().toISOString();
  await reviewRepo.saveVerification({
    studentProfileId: input.studentProfileId,
    status: input.status,
    verifiedByUserId: input.userId,
    verifiedAt,
    verificationNotes: input.verificationNotes,
    curriculumSource: input.curriculumSource,
  });
  return verifiedAt;
}

export async function saveCurriculumPopulationRequest(input: {
  studentProfileId: string;
  userId: string;
  curriculumSource?: RequirementSetProvenanceMethod | "unknown" | null;
  status: CurriculumVerificationStatus;
}) {
  const requestedAt = new Date().toISOString();
  await reviewRepo.savePopulationRequest({
    studentProfileId: input.studentProfileId,
    requestedByUserId: input.userId,
    requestedAt,
    status: input.status,
    curriculumSource: input.curriculumSource,
  });
  return requestedAt;
}

export async function linkCurriculumPdfUpload(input: {
  studentProfileId: string;
  academicArtifactId: string;
  curriculumSource?: RequirementSetProvenanceMethod | "unknown" | null;
}) {
  await reviewRepo.linkPdfUpload(input);
}

export async function saveCoachCurriculumReview(input: {
  studentProfileId: string;
  userId: string;
  curriculumSource?: RequirementSetProvenanceMethod | "unknown" | null;
}) {
  const reviewedAt = new Date().toISOString();
  await reviewRepo.saveCoachReview({
    studentProfileId: input.studentProfileId,
    coachReviewedAt: reviewedAt,
    coachReviewedByUserId: input.userId,
    curriculumSource: input.curriculumSource,
  });
  return reviewedAt;
}
