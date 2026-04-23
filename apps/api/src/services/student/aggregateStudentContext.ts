import { StudentReadRepository } from "../../repositories/student/studentReadRepository";
import { JobTargetRepository } from "../../repositories/career/jobTargetRepository";
import type { StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";
import {
  TARGET_ROLE_SEEDS,
  getTargetRoleSeedByCanonicalName,
} from "../../../../../packages/shared/src/market/targetRoleSeeds";
import { buildAcademicScoringEvidence } from "../academic/scoringEvidence";
import { AppError } from "../../utils/appError";

export interface AggregatedStudentContext {
  studentProfileId: string;
  studentName: string;
  targetGoal: string;
  accomplishments: string[];
  upcomingDeadlines: string[];
  parentVisibleInsights: string[];
}

const repo = new StudentReadRepository();
const jobTargetRepo = new JobTargetRepository();

const sectorToRole = new Map(
  TARGET_ROLE_SEEDS.map((seed) => [seed.sectorCluster, { role: seed.canonicalName, sector: seed.sectorCluster }] as const)
);

function normalizeSectorCluster(value: string | undefined | null): string | null {
  if (!value) return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, "_")
    .replace(/,\s*/g, "_")
    .replace(/\s*\/\s*/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function resolveTargetRole(input: {
  selectedSector?: string | null;
  primaryJobTarget?: {
    normalizedRoleFamily?: string | null;
    normalizedSectorCluster?: string | null;
  } | null;
  overrideTargetRoleFamily?: string;
  overrideTargetSectorCluster?: string;
}) {
  if (input.overrideTargetRoleFamily) {
    const seed = getTargetRoleSeedByCanonicalName(input.overrideTargetRoleFamily);
    return {
      targetRoleFamily: seed?.canonicalName || input.overrideTargetRoleFamily,
      targetSectorCluster: input.overrideTargetSectorCluster || seed?.sectorCluster || "finance_financial_services",
    };
  }

  if (input.primaryJobTarget?.normalizedRoleFamily) {
    const seed = getTargetRoleSeedByCanonicalName(input.primaryJobTarget.normalizedRoleFamily);
    return {
      targetRoleFamily: seed?.canonicalName || input.primaryJobTarget.normalizedRoleFamily,
      targetSectorCluster:
        input.primaryJobTarget.normalizedSectorCluster ||
        seed?.sectorCluster ||
        "finance_financial_services",
    };
  }

  const normalizedSector = normalizeSectorCluster(input.selectedSector);
  const mapped = normalizedSector ? sectorToRole.get(normalizedSector) : undefined;
  if (!mapped) {
    return null;
  }

  return {
    targetRoleFamily: mapped.role,
    targetSectorCluster: mapped.sector,
  };
}

function deriveAcademicYear(expectedGraduationDate?: string | null): "freshman" | "sophomore" | "junior" | "senior" | "other" {
  if (!expectedGraduationDate) return "other";
  const grad = new Date(expectedGraduationDate);
  const now = new Date();
  const months = (grad.getFullYear() - now.getFullYear()) * 12 + (grad.getMonth() - now.getMonth());
  if (months > 36) return "freshman";
  if (months > 24) return "sophomore";
  if (months > 12) return "junior";
  if (months >= -3) return "senior";
  return "other";
}

export async function aggregateStudentContext(studentProfileId: string): Promise<AggregatedStudentContext> {
  const [profile, insights, deadlines, accomplishments, primaryJobTarget] = await Promise.all([
    repo.getStudentProfile(studentProfileId),
    repo.getParentVisibleInsights(studentProfileId),
    repo.getUpcomingDeadlines(studentProfileId),
    repo.getRecentAccomplishments(studentProfileId),
    jobTargetRepo.getPrimaryForStudent(studentProfileId),
  ]);

  if (!profile) {
    throw new Error(`Student profile not found for ${studentProfileId}`);
  }

  const targetGoal =
    profile.career_goal_summary ||
    primaryJobTarget?.title ||
    [profile.major_primary, profile.major_secondary].filter(Boolean).join(" / ") ||
    "Career target not yet defined";

  return {
    studentProfileId,
    studentName: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Student",
    targetGoal,
    accomplishments: accomplishments.map((a) =>
      [a.title, a.organization, a.deliverables_summary].filter(Boolean).join(" - ")
    ),
    upcomingDeadlines: deadlines.map((d) =>
      `${d.title} (${d.deadline_type}) due ${d.due_date}`
    ),
    parentVisibleInsights: insights.map((i) => i.parent_safe_summary || i.insight_statement),
  };
}

export async function buildStudentScoringInput(
  studentProfileId: string,
  options?: {
    targetRoleFamily?: string;
    targetSectorCluster?: string;
  }
): Promise<StudentScoringInput> {
  const profile = await repo.getStudentProfile(studentProfileId);
  if (!profile) throw new Error(`Student profile not found for ${studentProfileId}`);

  const [sectors, primaryJobTarget] = await Promise.all([
    repo.getSelectedSectors(studentProfileId),
    jobTargetRepo.getPrimaryForStudent(studentProfileId),
  ]);
  const selectedSector = sectors[0]?.sector_cluster;
  const resolvedTarget = resolveTargetRole({
    selectedSector,
    primaryJobTarget,
    overrideTargetRoleFamily: options?.targetRoleFamily,
    overrideTargetSectorCluster: options?.targetSectorCluster,
  });
  if (!resolvedTarget) {
    throw new AppError({
      status: 400,
      code: "target_role_unresolved",
      message:
        "A target role could not be resolved. Save an exact target job or select at least one sector before scoring.",
      details: {
        studentProfileId,
        selectedSector: selectedSector || null,
        hasPrimaryJobTarget: !!primaryJobTarget,
      },
    });
  }
  const { targetRoleFamily, targetSectorCluster } = resolvedTarget;

  const [
    occupationMetadata,
    occupationSkillRows,
    marketSignals,
    courseCoverageRows,
    experiences,
    artifacts,
    contacts,
    outreach,
    deadlines,
    academicEvidence,
  ] = await Promise.all([
    repo.getOccupationMetadataForCanonicalRole(targetRoleFamily),
    repo.getOccupationSkillsForCanonicalRole(targetRoleFamily),
    repo.getMarketSignalsForCanonicalRole(targetRoleFamily),
    repo.getCourseCoverage(studentProfileId),
    repo.getRecentAccomplishments(studentProfileId),
    repo.getArtifacts(studentProfileId),
    repo.getContacts(studentProfileId),
    repo.getOutreach(studentProfileId),
    repo.getUpcomingDeadlines(studentProfileId),
    buildAcademicScoringEvidence(studentProfileId),
  ] as const);

  const completedDeadlines = deadlines.filter((d) => d.completed).length;
  const overdueOpenDeadlines = deadlines.filter((d) => !d.completed && new Date(d.due_date) < new Date()).length;

  return {
    studentId: studentProfileId,
    targetRoleFamily,
    targetSectorCluster,
    preferredGeographies: profile.preferred_geographies || [],
    occupationMetadata: occupationMetadata
      ? {
          onetCode: occupationMetadata.onet_code || undefined,
          jobZone: occupationMetadata.job_zone ?? undefined,
          description: occupationMetadata.description || undefined,
        }
      : undefined,
    transcript: academicEvidence.transcript,
    requirementProgress: academicEvidence.requirementProgress,
    occupationSkills: occupationSkillRows.length ? occupationSkillRows.map((r) => ({
      skillName: r.skill_name,
      skillCategory: r.skill_category,
      importanceScore: Number(r.importance_score),
      requiredProficiencyBand: r.required_proficiency_band,
    })) : [
      { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 70, requiredProficiencyBand: "intermediate" },
      { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 50, requiredProficiencyBand: "basic" },
    ],
    marketSignals: marketSignals.map((signal) => ({
      signalType: signal.signal_type,
      signalValue: signal.signal_value == null ? undefined : Number(signal.signal_value),
      signalDirection: signal.signal_direction || undefined,
      sourceName: signal.source_name,
      effectiveDate: signal.effective_date,
      confidenceLevel: signal.confidence_level || undefined,
      scope: signal.scope,
    })),
    courseCoverage: courseCoverageRows.map((r) => ({
      courseId: r.course_id,
      skillName: r.skill_name,
      coverageStrength: r.coverage_strength,
      confidenceScore: Number(r.confidence_score),
    })),
    experiences: experiences.map((e) => ({
      experienceId: e.experience_id,
      title: e.title,
      toolsUsed: e.tools_used || [],
      deliverablesSummary: e.deliverables_summary || undefined,
      relevanceRating: e.relevance_rating || undefined,
    })),
    artifacts: artifacts.map((a) => ({
      artifactId: a.academic_artifact_id,
      artifactType: a.artifact_type,
      extractedSummary: a.extracted_summary || undefined,
      tags: [a.parsed_status],
    })),
    contacts: contacts.map((c) => ({
      contactId: c.contact_id,
      warmthLevel: c.warmth_level || undefined,
      relationshipType: c.relationship_type || undefined,
    })),
    outreach: outreach.map((o) => ({
      interactionId: o.outreach_interaction_id,
      interactionType: o.interaction_type,
      outcome: o.outcome || undefined,
    })),
    deadlines: deadlines.map((d) => ({
      deadlineType: d.deadline_type,
      dueDate: d.due_date,
      completed: !!d.completed,
    })),
    signals: {
      currentAcademicYear: deriveAcademicYear(profile.expected_graduation_date),
      hasInternshipByJuniorYear: experiences.some((e) => /intern/i.test(e.title)),
      hasIndependentProjectBySeniorYear: artifacts.some((a) => ["project", "portfolio", "presentation", "resume"].includes(a.artifact_type)),
      hasFirstOrSecondDegreeProfessionalNetwork: contacts.length > 0,
      hasCarefullyCultivatedMentors: contacts.some((c) => c.warmth_level === "strong"),
      aiToolComfortLevel: "medium",
      repeatedDeadlineMisses: overdueOpenDeadlines + Math.max(0, deadlines.length - completedDeadlines - 2),
    },
  };
}
