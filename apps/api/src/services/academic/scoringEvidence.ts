import type {
  RequirementGroupGraphNode,
  RequirementItemGraphNode,
} from "../../../../../packages/shared/src/contracts/academic";
import type {
  RequirementProgressSummary,
  TranscriptEvidenceSummary,
} from "../../../../../packages/shared/src/scoring/types";
import { CatalogRepository } from "../../repositories/academic/catalogRepository";
import { getPrimaryRequirementSetGraphForStudent } from "./catalogService";
import { getLatestStudentTranscriptGraphForStudent } from "./transcriptService";

const catalogRepo = new CatalogRepository();

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
  const [assignment, transcriptGraph, requirementGraph] = await Promise.all([
    catalogRepo.getPrimaryStudentCatalogContext(studentProfileId),
    getLatestStudentTranscriptGraphForStudent(studentProfileId),
    getPrimaryRequirementSetGraphForStudent(studentProfileId),
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
      }
    : undefined;

  if (!assignment || !requirementGraph) {
    return {
      transcript: transcriptSummary,
      requirementProgress: {
        boundToCatalog: false,
        totalRequirementItems: 0,
        satisfiedRequirementItems: 0,
        totalRequirementGroups: 0,
        satisfiedRequirementGroups: 0,
        creditsApplied: 0,
        totalCreditsRequired: undefined,
        completionPercent: 0,
        missingRequiredCourses: [],
        inferredConfidence: transcriptSummary ? "low" : "low",
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
  const satisfiedRequirementItems = evaluations.reduce((sum, evaluation) => sum + evaluation.satisfiedItemCount, 0);
  const inferableGroups = evaluations.filter((evaluation) => evaluation.inferableItemCount > 0);
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
    },
  };
}
