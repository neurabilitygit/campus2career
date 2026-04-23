import type { StudentScoringInput } from "../../../../packages/shared/src/scoring/types";

/**
 * Demo-only scoring payloads for `/v1/scoring/demo`, `/v1/briefs/demo`, `/v1/chat/scenario/demo`.
 * Two intentional scenarios—keep them here so drift is explicit, not copy-paste.
 */

/** Finance / financial analyst path — used by scoring demo and parent-brief demo. */
export const demoFinanceAnalystScoringInput: StudentScoringInput = {
  studentId: "demo-student",
  targetRoleFamily: "financial analyst",
  targetSectorCluster: "finance_financial_services",
  targetResolution: {
    truthStatus: "fallback",
    confidenceLabel: "low",
    resolutionKind: "selected_sector_mapping",
    sourceLabel: "demo fixture",
    note: "This is a demo-only target resolution bundled with the repository.",
  },
  preferredGeographies: ["New York", "Boston"],
  occupationSkillTruth: {
    truthStatus: "fallback",
    confidenceLabel: "low",
    sourceLabel: "demo fixture",
    note: "Occupation skills in this payload are static demo records.",
  },
  marketSignalTruth: {
    truthStatus: "fallback",
    confidenceLabel: "low",
    sourceLabel: "demo fixture",
    note: "Market signals in this payload are static demo records.",
  },
  dataQualityNotes: [
    "This scoring input is a demo fixture and does not represent a real student record.",
  ],
  occupationMetadata: { onetCode: "13-2031.00", jobZone: 4, description: "Budget and financial analysis surrogate" },
  occupationSkills: [
    { skillName: "excel_modeling", skillCategory: "technical", importanceScore: 90, requiredProficiencyBand: "intermediate" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 70, requiredProficiencyBand: "intermediate" },
    { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 50, requiredProficiencyBand: "basic" },
    { skillName: "finance_analysis", skillCategory: "analytical", importanceScore: 85, requiredProficiencyBand: "intermediate" },
  ],
  marketSignals: [
    {
      signalType: "unemployment_pressure",
      signalValue: 4.3,
      signalDirection: "stable",
      sourceName: "BLS:LNS14000000",
      effectiveDate: "2026-01-01",
      confidenceLevel: "high",
      scope: "macro",
    },
  ],
  courseCoverage: [
    { courseId: "c1", skillName: "finance_analysis", coverageStrength: "medium", confidenceScore: 0.7 },
    { courseId: "c2", skillName: "stakeholder_communication", coverageStrength: "low", confidenceScore: 0.5 },
  ],
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
    repeatedDeadlineMisses: 2,
  },
};

/** Data analyst path — used by scenario chat demo (SQL / visualization story). */
export const demoDataAnalystScoringInput: StudentScoringInput = {
  studentId: "demo-student",
  targetRoleFamily: "data analyst",
  targetSectorCluster: "data_analytics",
  targetResolution: {
    truthStatus: "fallback",
    confidenceLabel: "low",
    resolutionKind: "selected_sector_mapping",
    sourceLabel: "demo fixture",
    note: "This is a demo-only target resolution bundled with the repository.",
  },
  preferredGeographies: ["New York", "Boston"],
  occupationSkillTruth: {
    truthStatus: "fallback",
    confidenceLabel: "low",
    sourceLabel: "demo fixture",
    note: "Occupation skills in this payload are static demo records.",
  },
  marketSignalTruth: {
    truthStatus: "fallback",
    confidenceLabel: "low",
    sourceLabel: "demo fixture",
    note: "Market signals in this payload are static demo records.",
  },
  dataQualityNotes: [
    "This scoring input is a demo fixture and does not represent a real student record.",
  ],
  occupationMetadata: { onetCode: "15-2041.00", jobZone: 4, description: "Statistics-aligned data analyst surrogate" },
  occupationSkills: [
    { skillName: "sql", skillCategory: "technical", importanceScore: 85, requiredProficiencyBand: "intermediate" },
    { skillName: "data_visualization", skillCategory: "technical", importanceScore: 75, requiredProficiencyBand: "intermediate" },
    { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 55, requiredProficiencyBand: "basic" },
  ],
  marketSignals: [
    {
      signalType: "unemployment_pressure",
      signalValue: 4.3,
      signalDirection: "stable",
      sourceName: "BLS:LNS14000000",
      effectiveDate: "2026-01-01",
      confidenceLevel: "high",
      scope: "macro",
    },
  ],
  courseCoverage: [{ courseId: "c1", skillName: "data_visualization", coverageStrength: "low", confidenceScore: 0.4 }],
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
    repeatedDeadlineMisses: 1,
  },
};
