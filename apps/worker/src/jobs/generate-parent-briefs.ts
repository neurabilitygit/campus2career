import { runScoring } from "../../../api/src/services/scoring";
import { generateAndPersistParentBrief } from "../../../api/src/services/briefs/orchestrator";

export async function generateParentBriefsJob() {
  console.log("Generating parent briefs...");

  // Demo placeholder until student selection query is implemented.
  const scoring = runScoring({
    studentId: "demo-student",
    targetRoleFamily: "financial analyst",
    targetSectorCluster: "finance_financial_services",
    preferredGeographies: ["New York", "Boston"],
    occupationSkills: [
      { skillName: "excel_modeling", skillCategory: "technical", importanceScore: 90, requiredProficiencyBand: "intermediate" },
      { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 70, requiredProficiencyBand: "intermediate" },
      { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 50, requiredProficiencyBand: "basic" },
      { skillName: "finance_analysis", skillCategory: "analytical", importanceScore: 85, requiredProficiencyBand: "intermediate" }
    ],
    courseCoverage: [],
    experiences: [],
    artifacts: [],
    contacts: [],
    outreach: [],
    signals: {
      currentAcademicYear: "junior",
      hasInternshipByJuniorYear: false,
      hasIndependentProjectBySeniorYear: false,
      hasFirstOrSecondDegreeProfessionalNetwork: false,
      hasCarefullyCultivatedMentors: false,
      aiToolComfortLevel: "medium",
      repeatedDeadlineMisses: 1
    }
  });

  try {
    await generateAndPersistParentBrief({
      studentProfileId: "demo-student-profile-id",
      householdId: null,
      monthLabel: new Date().toISOString().slice(0, 7),
      scoring,
    });
  } catch (error) {
    console.error("Parent brief generation failed", error);
  }
}
