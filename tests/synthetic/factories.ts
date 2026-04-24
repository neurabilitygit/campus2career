import {
  type SyntheticStudentRecord,
  type SyntheticUser,
  getSyntheticStudent,
  getSyntheticUser,
} from "./scenarios";

export function makeDemoAuthState(userKey: Parameters<typeof getSyntheticUser>[0]) {
  const user = getSyntheticUser(userKey);
  return {
    userId: user.userId,
    roleType: user.roleType,
    email: user.email,
  };
}

export function makeStudentEditableProfileInput(
  userKey: Parameters<typeof getSyntheticUser>[0],
  overrides: Partial<{
    fullName: string;
    preferredName: string | null;
    age: number | null;
    gender: string | null;
    housingStatus: string | null;
    knownNeurodivergentCategories: string[];
    otherNeurodivergentDescription: string | null;
    communicationPreferences: string | null;
    personalChoices: string | null;
  }> = {}
) {
  const user = getSyntheticUser(userKey);
  return {
    fullName: overrides.fullName ?? `${user.firstName} ${user.lastName}`,
    preferredName: overrides.preferredName ?? user.preferredName ?? user.firstName,
    age: overrides.age ?? 20,
    gender: overrides.gender ?? "Prefer not to say",
    housingStatus: overrides.housingStatus ?? "On campus during the semester",
    knownNeurodivergentCategories: overrides.knownNeurodivergentCategories ?? ["ADHD"],
    otherNeurodivergentDescription: overrides.otherNeurodivergentDescription ?? null,
    communicationPreferences:
      overrides.communicationPreferences ?? "Short, calm guidance is easiest to use.",
    personalChoices:
      overrides.personalChoices ?? "Prefers internships within commuting distance during the semester.",
  };
}

export function makeParentEditableProfileInput(
  userKey: Parameters<typeof getSyntheticUser>[0],
  overrides: Partial<{
    fullName: string;
    preferredName: string | null;
    familyUnitName: string | null;
    relationshipToStudent: string | null;
    householdMembers: Array<{ name: string; relationship?: string }>;
    familyStructure: string | null;
    partnershipStructure: string | null;
    knownNeurodivergentCategories: string[];
    demographicInformation: string | null;
    communicationPreferences: string | null;
    parentGoalsOrConcerns: string | null;
  }> = {}
) {
  const user = getSyntheticUser(userKey);
  return {
    fullName: overrides.fullName ?? `${user.firstName} ${user.lastName}`,
    preferredName: overrides.preferredName ?? user.preferredName ?? user.firstName,
    familyUnitName: overrides.familyUnitName ?? "Synthetic family",
    relationshipToStudent: overrides.relationshipToStudent ?? "Parent",
    householdMembers: overrides.householdMembers ?? [{ name: "Synthetic Student", relationship: "Student" }],
    familyStructure: overrides.familyStructure ?? "Two-household family",
    partnershipStructure: overrides.partnershipStructure ?? "Married",
    knownNeurodivergentCategories: overrides.knownNeurodivergentCategories ?? [],
    demographicInformation:
      overrides.demographicInformation ?? "Optional demographic information for testing only.",
    communicationPreferences:
      overrides.communicationPreferences ?? "Prefers concise weekly family summaries.",
    parentGoalsOrConcerns:
      overrides.parentGoalsOrConcerns ?? "Keep support calm and consistent without increasing pressure.",
  };
}

export function makeCoachEditableProfileInput(
  userKey: Parameters<typeof getSyntheticUser>[0],
  overrides: Partial<{
    fullName: string;
    preferredName: string | null;
    professionalTitle: string | null;
    organizationName: string | null;
    coachingSpecialties: string[];
    communicationPreferences: string | null;
  }> = {}
) {
  const user = getSyntheticUser(userKey);
  return {
    fullName: overrides.fullName ?? `${user.firstName} ${user.lastName}`,
    preferredName: overrides.preferredName ?? user.preferredName ?? user.firstName,
    professionalTitle: overrides.professionalTitle ?? "Career Coach",
    organizationName: overrides.organizationName ?? "Synthetic Career Lab",
    coachingSpecialties: overrides.coachingSpecialties ?? ["Networking", "Internship search"],
    communicationPreferences:
      overrides.communicationPreferences ?? "Prefers clear follow-up notes after each coaching session.",
  };
}

export function makeStudentProfilePatch(
  studentKey: Parameters<typeof getSyntheticStudent>[0],
  overrides: Partial<{
    schoolName: string;
    expectedGraduationDate: string;
    majorPrimary: string;
    majorSecondary: string;
    preferredGeographies: string;
    careerGoalSummary: string;
    academicNotes: string;
  }> = {}
) {
  const student = getSyntheticStudent(studentKey);
  return {
    schoolName: overrides.schoolName ?? student.schoolName,
    expectedGraduationDate: overrides.expectedGraduationDate ?? student.expectedGraduationDate,
    majorPrimary: overrides.majorPrimary ?? student.majorPrimary,
    majorSecondary: overrides.majorSecondary ?? "",
    preferredGeographies: overrides.preferredGeographies ?? "New York, Boston",
    careerGoalSummary: overrides.careerGoalSummary ?? student.careerGoalSummary,
    academicNotes: overrides.academicNotes ?? "Synthetic student profile for automated testing.",
  };
}

export function makeCoachRecommendationInput(
  student: SyntheticStudentRecord,
  overrides: Partial<{
    title: string;
    recommendationCategory: string;
    rationale: string;
    recommendedNextStep: string;
    priority: string;
    visibility: string;
    dueDate: string;
  }> = {}
) {
  return {
    studentProfileId: student.studentProfileId,
    title: overrides.title ?? "Start weekly alumni outreach",
    recommendationCategory: overrides.recommendationCategory ?? "networking",
    rationale: overrides.rationale ?? "The student needs warmer leads before the next application push.",
    recommendedNextStep:
      overrides.recommendedNextStep ?? "Send three alumni outreach messages by Thursday.",
    priority: overrides.priority ?? "high",
    visibility: overrides.visibility ?? "student_visible",
    dueDate: overrides.dueDate ?? "2026-05-02",
    status: "active",
  };
}

export function makeCoachActionItemInput(
  student: SyntheticStudentRecord,
  overrides: Partial<{
    title: string;
    description: string;
    priority: string;
    assignedTo: string;
    dueDate: string;
    visibleToStudent: boolean;
    visibleToParent: boolean;
  }> = {}
) {
  return {
    studentProfileId: student.studentProfileId,
    title: overrides.title ?? "Finish resume revision",
    description:
      overrides.description ??
      "Update the resume bullets for the research assistant role and send the draft back to the coach.",
    priority: overrides.priority ?? "high",
    assignedTo: overrides.assignedTo ?? "student",
    dueDate: overrides.dueDate ?? "2026-05-03",
    visibleToStudent: overrides.visibleToStudent ?? true,
    visibleToParent: overrides.visibleToParent ?? true,
    status: "not_started",
  };
}

export function makeCoachFlagInput(
  student: SyntheticStudentRecord,
  overrides: Partial<{
    title: string;
    flagType: string;
    severity: string;
    description: string;
    visibility: string;
  }> = {}
) {
  return {
    studentProfileId: student.studentProfileId,
    title: overrides.title ?? "Outcome activity is missing",
    flagType: overrides.flagType ?? "no_outcome_activity",
    severity: overrides.severity ?? "warning",
    description:
      overrides.description ?? "No new application, interview, or offer activity has been recorded this month.",
    visibility: overrides.visibility ?? "student_visible",
    status: "open",
  };
}

export function makeOutcomeInput(
  student: SyntheticStudentRecord,
  overrides: Partial<{
    outcomeType: "internship_application" | "interview" | "offer" | "accepted_role";
    status: "not_started" | "in_progress" | "applied" | "interviewing" | "offer" | "accepted";
    employerName: string;
    roleTitle: string;
    actionDate: string;
    notes: string;
  }> = {}
) {
  return {
    studentProfileId: student.studentProfileId,
    outcomeType: overrides.outcomeType ?? "internship_application",
    status: overrides.status ?? "applied",
    employerName: overrides.employerName ?? "Atlas Advisory",
    roleTitle: overrides.roleTitle ?? "Business Analyst Intern",
    actionDate: overrides.actionDate ?? "2026-04-20",
    notes: overrides.notes ?? "Applied through the company internship portal.",
  };
}

export function makeSyntheticIdentitySummary(user: SyntheticUser, student?: SyntheticStudentRecord) {
  return {
    displayName: `${user.firstName} ${user.lastName}`,
    email: user.email,
    roleType: user.roleType,
    studentProfileId: student?.studentProfileId ?? null,
    householdId: student?.householdId ?? null,
  };
}
