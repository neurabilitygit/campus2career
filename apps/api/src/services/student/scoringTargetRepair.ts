import type { StudentReadRepository } from "../../repositories/student/studentReadRepository";
import type { JobTargetRepository } from "../../repositories/career/jobTargetRepository";
import type { CareerScenarioRepository } from "../../repositories/career/careerScenarioRepository";
import { syncPrimaryJobTargetFromStudentIntent } from "../career/primaryJobTargetSync";

function normalizeIntentText(value: string | null | undefined, maxLength: number = 240): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export async function ensurePersistedPrimaryJobTarget(input: {
  studentProfileId: string;
  profile: Awaited<ReturnType<StudentReadRepository["getStudentProfile"]>>;
  primaryJobTarget: Awaited<ReturnType<JobTargetRepository["getPrimaryForStudent"]>>;
  activeScenario: Awaited<ReturnType<CareerScenarioRepository["getActiveForStudent"]>>;
}) {
  const { studentProfileId, profile, primaryJobTarget, activeScenario } = input;

  if (primaryJobTarget?.normalizedRoleFamily) {
    return primaryJobTarget;
  }

  const inferredTitle =
    normalizeIntentText(primaryJobTarget?.title) ||
    normalizeIntentText(activeScenario?.targetRole) ||
    normalizeIntentText(activeScenario?.targetProfession) ||
    normalizeIntentText(activeScenario?.scenarioName) ||
    normalizeIntentText(profile?.career_goal_summary);

  if (!inferredTitle) {
    return primaryJobTarget;
  }

  return await syncPrimaryJobTargetFromStudentIntent({
    studentProfileId,
    title: inferredTitle,
    employer: activeScenario?.employerName || primaryJobTarget?.employer || null,
    location:
      activeScenario?.targetGeography ||
      primaryJobTarget?.location ||
      profile?.preferred_geographies?.[0] ||
      null,
    sourceType: activeScenario?.jobDescriptionText ? "job_posting" : "manual",
    sourceUrl: activeScenario?.jobPostingUrl || null,
    jobDescriptionText: activeScenario?.jobDescriptionText || primaryJobTarget?.jobDescriptionText || null,
    allowOverwriteExistingPrimary: true,
  });
}
