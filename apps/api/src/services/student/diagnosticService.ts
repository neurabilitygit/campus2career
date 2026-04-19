import { OnboardingRepository } from "../../repositories/student/onboardingRepository";
import { StudentReadRepository } from "../../repositories/student/studentReadRepository";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

const onboardingRepo = new OnboardingRepository();
const studentReadRepo = new StudentReadRepository();

export interface FirstDiagnosticResult {
  onboardingCompleted: boolean;
  firstDiagnosticGenerated: boolean;
  trajectoryStatus: string;
  overallScore: number;
  topRisks: string[];
  nextActions: string[];
}

export async function finalizeOnboardingAndDiagnostic(input: {
  studentProfileId: string;
  scoring: ScoringOutput;
}) : Promise<FirstDiagnosticResult> {
  const [profile, sectors, contacts, deadlines, artifacts] = await Promise.all([
    studentReadRepo.getStudentProfile(input.studentProfileId),
    studentReadRepo.getSelectedSectors(input.studentProfileId),
    studentReadRepo.getContacts(input.studentProfileId),
    studentReadRepo.getUpcomingDeadlines(input.studentProfileId),
    studentReadRepo.getArtifacts(input.studentProfileId),
  ]);

  const profileDone = !!profile?.major_primary && !!profile?.school_name;
  const sectorsDone = sectors.length > 0;
  const uploadsDone = artifacts.length > 0;
  const networkDone = contacts.length > 0;
  const deadlinesDone = deadlines.length > 0;

  const onboardingCompleted = profileDone && sectorsDone && uploadsDone && networkDone && deadlinesDone;

  await onboardingRepo.updateFlags(input.studentProfileId, {
    profile_completed: profileDone,
    sectors_completed: sectorsDone,
    uploads_completed: uploadsDone,
    network_completed: networkDone,
    deadlines_completed: deadlinesDone,
    onboarding_completed: onboardingCompleted,
    first_diagnostic_generated: true,
  });

  return {
    onboardingCompleted,
    firstDiagnosticGenerated: true,
    trajectoryStatus: input.scoring.trajectoryStatus,
    overallScore: input.scoring.overallScore,
    topRisks: input.scoring.topRisks,
    nextActions: input.scoring.recommendations.slice(0, 3).map((r) => r.title),
  };
}
