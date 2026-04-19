import { StudentReadRepository } from "../../repositories/student/studentReadRepository";
import type { StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";

export interface AggregatedStudentContext {
  studentProfileId: string;
  studentName: string;
  targetGoal: string;
  accomplishments: string[];
  upcomingDeadlines: string[];
  parentVisibleInsights: string[];
}

const repo = new StudentReadRepository();

const sectorToRole: Record<string, { role: string; sector: string }> = {
  "technology & startups": { role: "software developer", sector: "technology_startups" },
  "fintech": { role: "business analyst", sector: "fintech" },
  "management consulting": { role: "management consulting analyst", sector: "management_consulting" },
  "finance & financial services": { role: "financial analyst", sector: "finance_financial_services" },
  "accounting, audit & risk": { role: "staff accountant", sector: "accounting_audit_risk" },
  "data & analytics": { role: "data analyst", sector: "data_analytics" },
  "healthcare": { role: "healthcare analyst", sector: "healthcare" },
  "pharmaceutical, biotech & clinical research": { role: "clinical research coordinator", sector: "pharma_biotech_clinical_research" },
  "operations & strategy": { role: "operations analyst", sector: "operations_strategy" },
};

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
  const [profile, insights, deadlines, accomplishments] = await Promise.all([
    repo.getStudentProfile(studentProfileId),
    repo.getParentVisibleInsights(studentProfileId),
    repo.getUpcomingDeadlines(studentProfileId),
    repo.getRecentAccomplishments(studentProfileId),
  ]);

  if (!profile) {
    throw new Error(`Student profile not found for ${studentProfileId}`);
  }

  const targetGoal =
    profile.career_goal_summary ||
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

export async function buildStudentScoringInput(studentProfileId: string): Promise<StudentScoringInput> {
  const profile = await repo.getStudentProfile(studentProfileId);
  if (!profile) throw new Error(`Student profile not found for ${studentProfileId}`);

  const sectors = await repo.getSelectedSectors(studentProfileId);
  const selectedSector = sectors[0]?.sector_cluster;
  const mapped = selectedSector ? sectorToRole[selectedSector.toLowerCase()] : undefined;
  const targetRoleFamily = mapped?.role || "financial analyst";
  const targetSectorCluster = mapped?.sector || "finance_financial_services";

  const [occupationSkillRows, courseCoverageRows, experiences, artifacts, contacts, outreach, deadlines] = await Promise.all([
    repo.getOccupationSkillsForCanonicalRole(targetRoleFamily),
    repo.getCourseCoverage(studentProfileId),
    repo.getRecentAccomplishments(studentProfileId),
    repo.getArtifacts(studentProfileId),
    repo.getContacts(studentProfileId),
    repo.getOutreach(studentProfileId),
    repo.getUpcomingDeadlines(studentProfileId),
  ]);

  const completedDeadlines = deadlines.filter((d) => d.completed).length;
  const overdueOpenDeadlines = deadlines.filter((d) => !d.completed && new Date(d.due_date) < new Date()).length;

  return {
    studentId: studentProfileId,
    targetRoleFamily,
    targetSectorCluster,
    preferredGeographies: profile.preferred_geographies || [],
    occupationSkills: occupationSkillRows.length ? occupationSkillRows.map((r) => ({
      skillName: r.skill_name,
      skillCategory: r.skill_category,
      importanceScore: Number(r.importance_score),
      requiredProficiencyBand: r.required_proficiency_band,
    })) : [
      { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 70, requiredProficiencyBand: "intermediate" },
      { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 50, requiredProficiencyBand: "basic" },
    ],
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
