import type {
  RequirementGroupGraphNode,
  RequirementItemGraphNode,
} from "../../../../../packages/shared/src/contracts/academic";
import type {
  RequirementProgressSummary,
  TranscriptEvidenceSummary,
} from "../../../../../packages/shared/src/scoring/types";
import { CatalogRepository } from "../../repositories/academic/catalogRepository";
import { CurriculumVerificationRepository } from "../../repositories/academic/curriculumVerificationRepository";
import { getPrimaryRequirementSetGraphForStudent } from "./catalogService";
import { getLatestStudentTranscriptGraphForStudent } from "./transcriptService";

const catalogRepo = new CatalogRepository();
const curriculumReviewRepo = new CurriculumVerificationRepository();

type CompletedMatchedCourse = {
  catalogCourseId: string;
  courseCode: string | null;
  creditsEarned: number;
};

function parseCourseLevel(courseCode: string | null | undefined): number | null {
  if (!courseCode) return null;
  const match = courseCode.match(/(\d{3,4})/);
  return match ? Number(match[1]) : null;
}

function isCompletedStatus(status: string): boolean {
  return status === "completed" || status === "transfer" || status === "ap_ib";
}

function buildRequirementItemLabel(
  item: RequirementItemGraphNode,
  catalogCodeById: Map<string, string>
): string {
  if (item.catalogCourseId && catalogCodeById.has(item.catalogCourseId)) {
    return catalogCodeById.get(item.catalogCourseId) || "Unnamed course";
  }
  if (item.courseCode) return item.courseCode;
  if (item.coursePrefix && item.minLevel) return `${item.coursePrefix} ${item.minLevel}+`;
  if (item.coursePrefix) return `${item.coursePrefix} elective`;
  return item.itemLabel || "Requirement item";
}

function doesPatternMatchCourse(
  item: RequirementItemGraphNode,
  course: CompletedMatchedCourse
): boolean {
  if (!item.coursePrefix || !course.courseCode) return false;
  const normalizedCode = course.courseCode.toLowerCase().replace(/\s+/g, "");
  const normalizedPrefix = item.coursePrefix.toLowerCase().replace(/\s+/g, "");
  if (!normalizedCode.startsWith(normalizedPrefix)) {
    return false;
  }

  if (!item.minLevel) {
    return true;
  }

  const level = parseCourseLevel(course.courseCode);
  return level != null && level >= item.minLevel;
}

function evaluateRequirementGroup(input: {
  group: RequirementGroupGraphNode;
  completedCatalogCourseIds: Set<string>;
  completedMatchedCourses: CompletedMatchedCourse[];
  catalogCodeById: Map<string, string>;
}) {
  const inferableItems = input.group.items.filter(
    (item) => item.itemType === "course" || item.itemType === "course_pattern"
  );

  if (!inferableItems.length) {
    return {
      inferableItemCount: 0,
      nonCourseItemCount: input.group.items.length,
      manualRequirementItemCount: input.group.items.filter((item) => item.itemType === "manual_rule").length,
      satisfiedItemCount: 0,
      creditsApplied: 0,
      groupSatisfied: false,
      missingLabels: [] as string[],
    };
  }

  const satisfiedItems = inferableItems.filter((item) => {
    if (item.itemType === "course") {
      return !!item.catalogCourseId && input.completedCatalogCourseIds.has(item.catalogCourseId);
    }

    return input.completedMatchedCourses.some((course) => doesPatternMatchCourse(item, course));
  });

  const satisfiedItemCount = satisfiedItems.length;
  const creditsApplied = satisfiedItems.reduce(
    (sum, item) => sum + Number(item.creditsIfUsed || 0),
    0
  );
  const minCourseThreshold =
    input.group.groupType === "one_of"
      ? 1
      : input.group.minCoursesRequired || (input.group.groupType === "all_of" || input.group.groupType === "capstone"
          ? inferableItems.length
          : 0);
  const minCreditThreshold = input.group.minCreditsRequired || 0;

  let groupSatisfied = false;
  if (input.group.groupType === "all_of" || input.group.groupType === "capstone") {
    groupSatisfied = satisfiedItemCount >= inferableItems.length;
  } else if (input.group.groupType === "choose_n" || input.group.groupType === "one_of") {
    groupSatisfied = satisfiedItemCount >= Math.max(minCourseThreshold, 1);
  } else if (input.group.groupType === "credits_bucket") {
    groupSatisfied = creditsApplied >= Math.max(minCreditThreshold, 1);
  } else {
    groupSatisfied = satisfiedItemCount > 0;
  }

  const missingLabels = inferableItems
    .filter((item) => !satisfiedItems.includes(item))
    .map((item) => buildRequirementItemLabel(item, input.catalogCodeById));

  return {
    inferableItemCount: inferableItems.length,
    nonCourseItemCount: input.group.items.length - inferableItems.length,
    manualRequirementItemCount: input.group.items.filter((item) => item.itemType === "manual_rule").length,
    satisfiedItemCount,
    creditsApplied,
    groupSatisfied,
    missingLabels,
  };
}

export async function buildAcademicScoringEvidence(studentProfileId: string): Promise<{
  transcript?: TranscriptEvidenceSummary;
  requirementProgress?: RequirementProgressSummary;
}> {
  const [assignment, transcriptGraph, requirementGraph, curriculumReview] = await Promise.all([
    catalogRepo.getPrimaryStudentCatalogContext(studentProfileId),
    getLatestStudentTranscriptGraphForStudent(studentProfileId),
    getPrimaryRequirementSetGraphForStudent(studentProfileId),
    curriculumReviewRepo.getForStudent(studentProfileId),
  ]);

  const transcriptCourses =
    transcriptGraph?.terms.flatMap((term) => term.courses) || [];
  const completedTranscriptCourses = transcriptCourses.filter((course) =>
    isCompletedStatus(course.completionStatus)
  );

  const matchedCompletedCourses: CompletedMatchedCourse[] = completedTranscriptCourses
    .filter((course) => !!course.match?.catalogCourseId)
    .map((course) => ({
      catalogCourseId: course.match?.catalogCourseId || "",
      courseCode: course.rawCourseCode || null,
      creditsEarned: Number(course.creditsEarned || 0),
    }));

  const transcriptSummary: TranscriptEvidenceSummary | undefined = transcriptGraph
    ? {
        parsedStatus: transcriptGraph.parsedStatus,
        transcriptSummary: transcriptGraph.transcriptSummary || undefined,
        termCount: transcriptGraph.terms.length,
        courseCount: transcriptCourses.length,
        completedCourseCount: completedTranscriptCourses.length,
        matchedCatalogCourseCount: matchedCompletedCourses.length,
        unmatchedCourseCount: Math.max(completedTranscriptCourses.length - matchedCompletedCourses.length, 0),
        creditsEarned: Number(
          completedTranscriptCourses.reduce((sum, course) => sum + Number(course.creditsEarned || 0), 0).toFixed(1)
        ),
        truthStatus: transcriptGraph.parsedStatus === "failed" ? "unresolved" : "inferred",
        extractionMethod: transcriptGraph.extractionMethod || null,
        extractionConfidenceLabel: transcriptGraph.extractionConfidenceLabel || null,
        institutionResolutionTruthStatus: transcriptGraph.institutionResolutionTruthStatus || "unresolved",
        institutionResolutionNote: transcriptGraph.institutionResolutionNote || null,
      }
    : undefined;

  if (!assignment || !requirementGraph) {
    const coverageNotes: string[] = [];
    if (!assignment) {
      coverageNotes.push("No primary catalog assignment is set for this student yet.");
    }
    if (!requirementGraph) {
      coverageNotes.push("No structured requirement set is loaded for the current academic path.");
    }
    return {
      transcript: transcriptSummary,
      requirementProgress: {
        boundToCatalog: false,
        institutionDisplayName: assignment?.institution_display_name || undefined,
        catalogLabel: assignment?.catalog_label || undefined,
        degreeType: assignment?.degree_type || undefined,
        programName: assignment?.program_name || undefined,
        majorDisplayName: assignment?.major_display_name || undefined,
        provenanceMethod: requirementGraph?.provenanceMethod ?? null,
        sourceUrl: requirementGraph?.sourceUrl ?? null,
        sourceNote: requirementGraph?.sourceNote ?? null,
        totalRequirementItems: 0,
        satisfiedRequirementItems: 0,
        totalRequirementGroups: 0,
        satisfiedRequirementGroups: 0,
        creditsApplied: 0,
        totalCreditsRequired: undefined,
        completionPercent: 0,
        missingRequiredCourses: [],
        inferredConfidence: transcriptSummary ? "low" : "low",
        truthStatus: "unresolved",
        manualRequirementItemCount: 0,
        nonCourseRequirementItemCount: 0,
        excludedRequirementGroupCount: 0,
        coverageNotes,
        curriculumVerificationStatus: "missing",
        curriculumVerifiedAt: curriculumReview?.curriculumVerifiedAt ?? null,
        curriculumVerifiedByUserId: curriculumReview?.curriculumVerifiedByUserId ?? null,
        curriculumVerificationNotes: curriculumReview?.curriculumVerificationNotes ?? null,
        curriculumRequestedAt: curriculumReview?.curriculumRequestedAt ?? null,
        curriculumRequestedByUserId: curriculumReview?.curriculumRequestedByUserId ?? null,
        curriculumPdfUploadId: curriculumReview?.curriculumPdfUploadId ?? null,
        coachReviewedAt: curriculumReview?.coachReviewedAt ?? null,
        coachReviewedByUserId: curriculumReview?.coachReviewedByUserId ?? null,
      },
    };
  }

  const catalogCourses = await catalogRepo.listCatalogCourses(assignment.academic_catalog_id);
  const catalogCodeById = new Map(
    catalogCourses.map((course) => [course.catalog_course_id, course.course_code] as const)
  );
  const completedCatalogCourseIds = new Set(
    matchedCompletedCourses.map((course) => course.catalogCourseId)
  );

  const evaluations = requirementGraph.groups.map((group) =>
    evaluateRequirementGroup({
      group,
      completedCatalogCourseIds,
      completedMatchedCourses: matchedCompletedCourses,
      catalogCodeById,
    })
  );

  const totalRequirementItems = evaluations.reduce((sum, evaluation) => sum + evaluation.inferableItemCount, 0);
  const nonCourseRequirementItemCount = evaluations.reduce((sum, evaluation) => sum + evaluation.nonCourseItemCount, 0);
  const manualRequirementItemCount = evaluations.reduce((sum, evaluation) => sum + evaluation.manualRequirementItemCount, 0);
  const satisfiedRequirementItems = evaluations.reduce((sum, evaluation) => sum + evaluation.satisfiedItemCount, 0);
  const inferableGroups = evaluations.filter((evaluation) => evaluation.inferableItemCount > 0);
  const excludedRequirementGroupCount = Math.max(requirementGraph.groups.length - inferableGroups.length, 0);
  const satisfiedRequirementGroups = inferableGroups.filter((evaluation) => evaluation.groupSatisfied).length;
  const creditsApplied = Number(
    evaluations.reduce((sum, evaluation) => sum + Number(evaluation.creditsApplied || 0), 0).toFixed(1)
  );
  const completionPercent =
    totalRequirementItems > 0 ? Math.round((satisfiedRequirementItems / totalRequirementItems) * 100) : 0;
  const missingRequiredCourses = evaluations
    .flatMap((evaluation) => evaluation.missingLabels)
    .filter(Boolean)
    .slice(0, 8);
  const coverageNotes: string[] = [];
  if (excludedRequirementGroupCount > 0) {
    coverageNotes.push(
      `${excludedRequirementGroupCount} requirement group${excludedRequirementGroupCount === 1 ? "" : "s"} include only manual or non-course rules and are excluded from automatic completion math.`
    );
  }
  if (transcriptSummary?.unmatchedCourseCount) {
    coverageNotes.push(
      `${transcriptSummary.unmatchedCourseCount} completed transcript course${transcriptSummary.unmatchedCourseCount === 1 ? "" : "s"} are still unmatched to the current catalog.`
    );
  }
  if (requirementGraph.provenanceMethod === "synthetic_seed") {
    coverageNotes.push("The requirement graph is currently seeded rather than confirmed from the institution's official source.");
  }
  if (requirementGraph.provenanceMethod === "llm_assisted") {
    coverageNotes.push("The requirement graph includes LLM-assisted extraction and should be reviewed against the source catalog.");
  }

  return {
    transcript: transcriptSummary,
    requirementProgress: {
      boundToCatalog: true,
      institutionDisplayName: assignment.institution_display_name,
      catalogLabel: assignment.catalog_label,
      degreeType: assignment.degree_type || undefined,
      programName: assignment.program_name || undefined,
      majorDisplayName: assignment.major_display_name || undefined,
      requirementSetDisplayName: requirementGraph.displayName,
      provenanceMethod: requirementGraph.provenanceMethod ?? null,
      sourceUrl: requirementGraph.sourceUrl ?? null,
      sourceNote: requirementGraph.sourceNote ?? null,
      totalRequirementItems,
      satisfiedRequirementItems,
      totalRequirementGroups: inferableGroups.length,
      satisfiedRequirementGroups,
      creditsApplied,
      totalCreditsRequired: requirementGraph.totalCreditsRequired || undefined,
      completionPercent,
      missingRequiredCourses,
      inferredConfidence:
        transcriptSummary && transcriptSummary.matchedCatalogCourseCount > 0
          ? transcriptSummary.unmatchedCourseCount === 0
          ? "high"
          : "medium"
        : "low",
      truthStatus:
        requirementGraph.provenanceMethod === "synthetic_seed"
          ? "fallback"
          : requirementGraph.provenanceMethod === "llm_assisted"
            ? "inferred"
            : "direct",
      manualRequirementItemCount,
      nonCourseRequirementItemCount,
      excludedRequirementGroupCount,
      coverageNotes,
      curriculumVerificationStatus:
        curriculumReview?.curriculumVerificationStatus === "verified"
          ? "verified"
          : "present_unverified",
      curriculumVerifiedAt: curriculumReview?.curriculumVerifiedAt ?? null,
      curriculumVerifiedByUserId: curriculumReview?.curriculumVerifiedByUserId ?? null,
      curriculumVerificationNotes: curriculumReview?.curriculumVerificationNotes ?? null,
      curriculumRequestedAt: curriculumReview?.curriculumRequestedAt ?? null,
      curriculumRequestedByUserId: curriculumReview?.curriculumRequestedByUserId ?? null,
      curriculumPdfUploadId: curriculumReview?.curriculumPdfUploadId ?? null,
      coachReviewedAt: curriculumReview?.coachReviewedAt ?? null,
      coachReviewedByUserId: curriculumReview?.coachReviewedByUserId ?? null,
    },
  };
}
