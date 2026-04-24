export type SyntheticRole = "student" | "parent" | "coach" | "admin";

export type SyntheticUser = {
  key: string;
  userId: string;
  roleType: SyntheticRole;
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  seed?: boolean;
};

export type SyntheticStudentRecord = {
  key: string;
  studentProfileId: string;
  householdId: string;
  householdName: string;
  studentUserKey: string;
  parentUserKey: string;
  schoolName: string;
  expectedGraduationDate: string;
  majorPrimary: string;
  careerGoalSummary: string;
  sectorCluster: string;
  targetRoleFamily: string;
};

export type SyntheticCoachRelationship = {
  key: string;
  relationshipId: string;
  coachUserKey: string;
  studentKey: string;
  relationshipStatus: "pending" | "active" | "paused" | "ended";
  startDate: string;
  nextReviewDate: string;
};

export const SYNTHETIC_USERS: Record<string, SyntheticUser> = {
  studentMaya: {
    key: "studentMaya",
    userId: "11111111-1111-4111-8111-111111111111",
    roleType: "student",
    firstName: "Maya",
    lastName: "Rivera",
    preferredName: "Maya",
    email: "maya.rivera@synthetic.rising-senior.local",
  },
  parentMaya: {
    key: "parentMaya",
    userId: "11111111-1111-4111-8111-222222222222",
    roleType: "parent",
    firstName: "Elena",
    lastName: "Rivera",
    preferredName: "Elena",
    email: "elena.rivera@synthetic.rising-senior.local",
  },
  studentLeo: {
    key: "studentLeo",
    userId: "22222222-2222-4222-8222-111111111111",
    roleType: "student",
    firstName: "Leo",
    lastName: "Carter",
    preferredName: "Leo",
    email: "leo.carter@synthetic.rising-senior.local",
  },
  parentLeo: {
    key: "parentLeo",
    userId: "22222222-2222-4222-8222-222222222222",
    roleType: "parent",
    firstName: "Jordan",
    lastName: "Carter",
    preferredName: "Jordan",
    email: "jordan.carter@synthetic.rising-senior.local",
  },
  coachTaylor: {
    key: "coachTaylor",
    userId: "33333333-3333-4333-8333-111111111111",
    roleType: "coach",
    firstName: "Taylor",
    lastName: "Brooks",
    preferredName: "Taylor",
    email: "taylor.brooks@synthetic.rising-senior.local",
  },
  studentNova: {
    key: "studentNova",
    userId: "44444444-4444-4444-8444-444444444444",
    roleType: "student",
    firstName: "Nova",
    lastName: "Lane",
    preferredName: "Nova",
    email: "nova.lane@synthetic.rising-senior.local",
    seed: false,
  },
} as const;

export const SYNTHETIC_STUDENTS: Record<string, SyntheticStudentRecord> = {
  maya: {
    key: "maya",
    studentProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    householdId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    householdName: "Rivera household",
    studentUserKey: "studentMaya",
    parentUserKey: "parentMaya",
    schoolName: "Synthetic State University",
    expectedGraduationDate: "2027-05-15",
    majorPrimary: "Economics",
    careerGoalSummary: "I want to break into business analysis and fintech internships.",
    sectorCluster: "fintech",
    targetRoleFamily: "business analyst",
  },
  leo: {
    key: "leo",
    studentProfileId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    householdId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    householdName: "Carter household",
    studentUserKey: "studentLeo",
    parentUserKey: "parentLeo",
    schoolName: "Northeast Technical College",
    expectedGraduationDate: "2028-05-15",
    majorPrimary: "Computer Science",
    careerGoalSummary: "I want to work toward software development roles.",
    sectorCluster: "technology_startups",
    targetRoleFamily: "software developer",
  },
} as const;

export const SYNTHETIC_COACH_RELATIONSHIPS: SyntheticCoachRelationship[] = [
  {
    key: "coachTaylor-maya",
    relationshipId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    coachUserKey: "coachTaylor",
    studentKey: "maya",
    relationshipStatus: "active",
    startDate: "2026-01-10",
    nextReviewDate: "2026-05-01",
  },
  {
    key: "coachTaylor-leo",
    relationshipId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    coachUserKey: "coachTaylor",
    studentKey: "leo",
    relationshipStatus: "active",
    startDate: "2026-01-12",
    nextReviewDate: "2026-05-03",
  },
];

export const SYNTHETIC_SCENARIOS = {
  intakeHappyPath: {
    key: "intakeHappyPath",
    actorUserKey: "studentMaya",
    studentKey: "maya",
    sectors: ["fintech"],
    networkingNotes: "Professor Lin, alum in consulting, and a data club lead.",
    deadline: {
      title: "Summer internship application",
      deadlineType: "application",
      dueDate: "2026-05-12",
      notes: "Submit the first round to three target employers.",
    },
    expectedDashboardText: ["Business Analyst", "Fintech"],
  },
  parentProgressView: {
    key: "parentProgressView",
    actorUserKey: "parentMaya",
    studentKey: "maya",
    expectedAction: "Finish resume revision",
  },
  coachReviewFlow: {
    key: "coachReviewFlow",
    actorUserKey: "coachTaylor",
    studentKey: "maya",
    recommendationTitle: "Start weekly alumni outreach",
    recommendationStep: "Send three alumni outreach messages by Thursday.",
  },
  multiStudentSwitch: {
    key: "multiStudentSwitch",
    actorUserKey: "coachTaylor",
    studentKey: "maya",
    secondStudentKey: "leo",
  },
  validationFailure: {
    key: "validationFailure",
    actorUserKey: "coachTaylor",
    studentKey: "maya",
  },
} as const;

export function getSyntheticUser(key: keyof typeof SYNTHETIC_USERS) {
  return SYNTHETIC_USERS[key];
}

export function getSyntheticStudent(key: keyof typeof SYNTHETIC_STUDENTS) {
  return SYNTHETIC_STUDENTS[key];
}

export function listSyntheticUsers() {
  return Object.values(SYNTHETIC_USERS);
}

export function listSeededSyntheticUsers() {
  return Object.values(SYNTHETIC_USERS).filter((user) => user.seed !== false);
}

export function listSyntheticStudents() {
  return Object.values(SYNTHETIC_STUDENTS);
}

export function listSyntheticCoachRelationships() {
  return SYNTHETIC_COACH_RELATIONSHIPS;
}
