import { getDbPool } from "../db/client";
import { TARGET_ROLE_SEEDS } from "../../../../packages/shared/src/market/targetRoleSeeds";
import {
  persistNormalizedMarketSignal,
  persistNormalizedOccupation,
  replaceNormalizedSkillsForOccupation,
} from "../services/market/persistence";

type SkillSeed = {
  skillName: string;
  skillCategory:
    | "technical"
    | "analytical"
    | "communication"
    | "operational"
    | "interpersonal"
    | "creative"
    | "managerial"
    | "ai_fluency";
  importanceScore: number;
  requiredProficiencyBand: "basic" | "intermediate" | "advanced";
};

const ROLE_JOB_ZONES: Record<string, number> = {
  "software developer": 4,
  "product operations associate": 3,
  "business analyst": 3,
  "management consulting analyst": 4,
  "financial analyst": 4,
  "staff accountant": 4,
  "data analyst": 4,
  "data scientist": 5,
  "information security analyst": 4,
  "actuary": 5,
  "marketing manager": 4,
  "attorney": 5,
  "healthcare analyst": 3,
  "physician": 5,
  "registered nurse": 4,
  "nurse practitioner": 5,
  "physician assistant": 5,
  "pharmacist": 4,
  "physical therapist": 5,
  "clinical research coordinator": 3,
  "operations analyst": 3,
};

const ROLE_SKILL_BASELINES: Record<string, SkillSeed[]> = {
  "software developer": [
    { skillName: "python", skillCategory: "technical", importanceScore: 82, requiredProficiencyBand: "advanced" },
    { skillName: "project_execution", skillCategory: "operational", importanceScore: 76, requiredProficiencyBand: "intermediate" },
    { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 60, requiredProficiencyBand: "intermediate" },
  ],
  "product operations associate": [
    { skillName: "consulting_problem_solving", skillCategory: "analytical", importanceScore: 76, requiredProficiencyBand: "intermediate" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 72, requiredProficiencyBand: "intermediate" },
    { skillName: "project_execution", skillCategory: "operational", importanceScore: 68, requiredProficiencyBand: "intermediate" },
  ],
  "business analyst": [
    { skillName: "sql", skillCategory: "technical", importanceScore: 72, requiredProficiencyBand: "intermediate" },
    { skillName: "consulting_problem_solving", skillCategory: "analytical", importanceScore: 74, requiredProficiencyBand: "intermediate" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 72, requiredProficiencyBand: "intermediate" },
  ],
  "management consulting analyst": [
    { skillName: "consulting_problem_solving", skillCategory: "analytical", importanceScore: 88, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 80, requiredProficiencyBand: "advanced" },
    { skillName: "presentation", skillCategory: "communication", importanceScore: 76, requiredProficiencyBand: "intermediate" },
  ],
  "financial analyst": [
    { skillName: "finance_analysis", skillCategory: "analytical", importanceScore: 86, requiredProficiencyBand: "advanced" },
    { skillName: "excel_modeling", skillCategory: "analytical", importanceScore: 82, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 68, requiredProficiencyBand: "intermediate" },
    { skillName: "sql", skillCategory: "technical", importanceScore: 56, requiredProficiencyBand: "basic" },
  ],
  "staff accountant": [
    { skillName: "accounting_controls", skillCategory: "operational", importanceScore: 88, requiredProficiencyBand: "advanced" },
    { skillName: "excel_modeling", skillCategory: "analytical", importanceScore: 72, requiredProficiencyBand: "intermediate" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 62, requiredProficiencyBand: "intermediate" },
  ],
  "data analyst": [
    { skillName: "sql", skillCategory: "technical", importanceScore: 88, requiredProficiencyBand: "advanced" },
    { skillName: "data_visualization", skillCategory: "technical", importanceScore: 78, requiredProficiencyBand: "intermediate" },
    { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 60, requiredProficiencyBand: "intermediate" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 66, requiredProficiencyBand: "intermediate" },
  ],
  "data scientist": [
    { skillName: "python", skillCategory: "technical", importanceScore: 84, requiredProficiencyBand: "advanced" },
    { skillName: "sql", skillCategory: "technical", importanceScore: 74, requiredProficiencyBand: "intermediate" },
    { skillName: "research", skillCategory: "analytical", importanceScore: 82, requiredProficiencyBand: "advanced" },
    { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 70, requiredProficiencyBand: "advanced" },
  ],
  "information security analyst": [
    { skillName: "information_security", skillCategory: "technical", importanceScore: 86, requiredProficiencyBand: "advanced" },
    { skillName: "risk_assessment", skillCategory: "analytical", importanceScore: 78, requiredProficiencyBand: "intermediate" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 68, requiredProficiencyBand: "intermediate" },
  ],
  "actuary": [
    { skillName: "statistics", skillCategory: "analytical", importanceScore: 88, requiredProficiencyBand: "advanced" },
    { skillName: "excel_modeling", skillCategory: "analytical", importanceScore: 78, requiredProficiencyBand: "advanced" },
    { skillName: "risk_modeling", skillCategory: "analytical", importanceScore: 82, requiredProficiencyBand: "advanced" },
  ],
  "marketing manager": [
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 82, requiredProficiencyBand: "advanced" },
    { skillName: "project_execution", skillCategory: "operational", importanceScore: 74, requiredProficiencyBand: "intermediate" },
    { skillName: "data_visualization", skillCategory: "technical", importanceScore: 60, requiredProficiencyBand: "basic" },
    { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 58, requiredProficiencyBand: "basic" },
  ],
  "attorney": [
    { skillName: "legal_research", skillCategory: "analytical", importanceScore: 88, requiredProficiencyBand: "advanced" },
    { skillName: "writing", skillCategory: "communication", importanceScore: 84, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 76, requiredProficiencyBand: "advanced" },
  ],
  "healthcare analyst": [
    { skillName: "research", skillCategory: "analytical", importanceScore: 80, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 72, requiredProficiencyBand: "intermediate" },
    { skillName: "sql", skillCategory: "technical", importanceScore: 58, requiredProficiencyBand: "basic" },
  ],
  "physician": [
    { skillName: "clinical_reasoning", skillCategory: "analytical", importanceScore: 90, requiredProficiencyBand: "advanced" },
    { skillName: "patient_care", skillCategory: "interpersonal", importanceScore: 88, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 76, requiredProficiencyBand: "advanced" },
  ],
  "registered nurse": [
    { skillName: "patient_care", skillCategory: "interpersonal", importanceScore: 86, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 74, requiredProficiencyBand: "intermediate" },
    { skillName: "project_execution", skillCategory: "operational", importanceScore: 66, requiredProficiencyBand: "intermediate" },
  ],
  "nurse practitioner": [
    { skillName: "clinical_reasoning", skillCategory: "analytical", importanceScore: 88, requiredProficiencyBand: "advanced" },
    { skillName: "patient_care", skillCategory: "interpersonal", importanceScore: 86, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 74, requiredProficiencyBand: "advanced" },
  ],
  "physician assistant": [
    { skillName: "clinical_reasoning", skillCategory: "analytical", importanceScore: 84, requiredProficiencyBand: "advanced" },
    { skillName: "patient_care", skillCategory: "interpersonal", importanceScore: 84, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 72, requiredProficiencyBand: "intermediate" },
  ],
  "pharmacist": [
    { skillName: "medication_management", skillCategory: "technical", importanceScore: 88, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 74, requiredProficiencyBand: "intermediate" },
    { skillName: "project_execution", skillCategory: "operational", importanceScore: 58, requiredProficiencyBand: "basic" },
  ],
  "physical therapist": [
    { skillName: "rehabilitation_planning", skillCategory: "operational", importanceScore: 86, requiredProficiencyBand: "advanced" },
    { skillName: "patient_care", skillCategory: "interpersonal", importanceScore: 84, requiredProficiencyBand: "advanced" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 70, requiredProficiencyBand: "intermediate" },
  ],
  "clinical research coordinator": [
    { skillName: "research", skillCategory: "analytical", importanceScore: 86, requiredProficiencyBand: "advanced" },
    { skillName: "project_execution", skillCategory: "operational", importanceScore: 72, requiredProficiencyBand: "intermediate" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 68, requiredProficiencyBand: "intermediate" },
  ],
  "operations analyst": [
    { skillName: "consulting_problem_solving", skillCategory: "analytical", importanceScore: 82, requiredProficiencyBand: "advanced" },
    { skillName: "project_execution", skillCategory: "operational", importanceScore: 76, requiredProficiencyBand: "intermediate" },
    { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 70, requiredProficiencyBand: "intermediate" },
    { skillName: "sql", skillCategory: "technical", importanceScore: 60, requiredProficiencyBand: "intermediate" },
  ],
};

const ROLE_MARKET_SIGNALS: Record<
  string,
  Array<{
    signalType:
      | "wage"
      | "demand_growth"
      | "unemployment_pressure"
      | "openings_trend"
      | "internship_availability"
      | "ai_disruption_signal"
      | "hiring_slowdown";
    signalValue: number;
    signalDirection: "rising" | "falling" | "stable";
    confidenceLevel: "low" | "medium" | "high";
  }>
> = {
  "software developer": [
    { signalType: "demand_growth", signalValue: 5.4, signalDirection: "stable", confidenceLevel: "medium" },
    { signalType: "ai_disruption_signal", signalValue: 4.2, signalDirection: "rising", confidenceLevel: "medium" },
  ],
  "product operations associate": [
    { signalType: "openings_trend", signalValue: 5.1, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "business analyst": [
    { signalType: "demand_growth", signalValue: 5.3, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "management consulting analyst": [
    { signalType: "openings_trend", signalValue: 5.0, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "financial analyst": [
    { signalType: "wage", signalValue: 6.1, signalDirection: "stable", confidenceLevel: "medium" },
    { signalType: "internship_availability", signalValue: 4.7, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "staff accountant": [
    { signalType: "wage", signalValue: 5.6, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "data analyst": [
    { signalType: "demand_growth", signalValue: 6.2, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "internship_availability", signalValue: 5.0, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "data scientist": [
    { signalType: "demand_growth", signalValue: 6.8, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "ai_disruption_signal", signalValue: 6.4, signalDirection: "rising", confidenceLevel: "high" },
  ],
  "information security analyst": [
    { signalType: "demand_growth", signalValue: 6.7, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "openings_trend", signalValue: 5.8, signalDirection: "rising", confidenceLevel: "medium" },
  ],
  "actuary": [
    { signalType: "demand_growth", signalValue: 6.1, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "wage", signalValue: 6.4, signalDirection: "stable", confidenceLevel: "high" },
  ],
  "marketing manager": [
    { signalType: "openings_trend", signalValue: 5.1, signalDirection: "stable", confidenceLevel: "medium" },
    { signalType: "ai_disruption_signal", signalValue: 4.9, signalDirection: "rising", confidenceLevel: "medium" },
  ],
  "attorney": [
    { signalType: "wage", signalValue: 6.3, signalDirection: "stable", confidenceLevel: "high" },
    { signalType: "openings_trend", signalValue: 4.6, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "healthcare analyst": [
    { signalType: "demand_growth", signalValue: 6.6, signalDirection: "rising", confidenceLevel: "high" },
  ],
  "physician": [
    { signalType: "demand_growth", signalValue: 6.3, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "wage", signalValue: 7.0, signalDirection: "stable", confidenceLevel: "high" },
  ],
  "registered nurse": [
    { signalType: "demand_growth", signalValue: 6.1, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "openings_trend", signalValue: 6.0, signalDirection: "rising", confidenceLevel: "high" },
  ],
  "nurse practitioner": [
    { signalType: "demand_growth", signalValue: 7.0, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "wage", signalValue: 6.6, signalDirection: "stable", confidenceLevel: "high" },
  ],
  "physician assistant": [
    { signalType: "demand_growth", signalValue: 6.7, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "wage", signalValue: 6.5, signalDirection: "stable", confidenceLevel: "high" },
  ],
  "pharmacist": [
    { signalType: "wage", signalValue: 6.4, signalDirection: "stable", confidenceLevel: "high" },
    { signalType: "hiring_slowdown", signalValue: 4.3, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "physical therapist": [
    { signalType: "demand_growth", signalValue: 6.4, signalDirection: "rising", confidenceLevel: "high" },
    { signalType: "wage", signalValue: 6.0, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "clinical research coordinator": [
    { signalType: "openings_trend", signalValue: 5.4, signalDirection: "stable", confidenceLevel: "medium" },
  ],
  "operations analyst": [
    { signalType: "demand_growth", signalValue: 5.5, signalDirection: "stable", confidenceLevel: "medium" },
    { signalType: "internship_availability", signalValue: 4.8, signalDirection: "stable", confidenceLevel: "medium" },
  ],
};

function defaultSkillsForRole(roleName: string): SkillSeed[] {
  return (
    ROLE_SKILL_BASELINES[roleName] || [
      { skillName: "stakeholder_communication", skillCategory: "communication", importanceScore: 70, requiredProficiencyBand: "intermediate" },
      { skillName: "project_execution", skillCategory: "operational", importanceScore: 68, requiredProficiencyBand: "intermediate" },
      { skillName: "ai_fluency", skillCategory: "ai_fluency", importanceScore: 50, requiredProficiencyBand: "basic" },
    ]
  );
}

async function main() {
  try {
    for (const seed of TARGET_ROLE_SEEDS) {
      await persistNormalizedOccupation({
        canonicalName: seed.canonicalName,
        onetCode: seed.overrideOnetSocCode,
        title: seed.canonicalName,
        description: `Deterministic CI seed for ${seed.canonicalName}`,
        jobZone: ROLE_JOB_ZONES[seed.canonicalName] || 3,
        source: "onet",
      });

      await replaceNormalizedSkillsForOccupation(
        seed.canonicalName,
        defaultSkillsForRole(seed.canonicalName).map((skill) => ({
          occupationCanonicalName: seed.canonicalName,
          skillName: skill.skillName,
          skillCategory: skill.skillCategory,
          importanceScore: skill.importanceScore,
          requiredProficiencyBand: skill.requiredProficiencyBand,
          evidenceSource: "ci_seed",
        }))
      );

      for (const signal of ROLE_MARKET_SIGNALS[seed.canonicalName] || []) {
        await persistNormalizedMarketSignal({
          occupationCanonicalName: seed.canonicalName,
          geographyCode: "us",
          signalType: signal.signalType,
          signalValue: signal.signalValue,
          signalDirection: signal.signalDirection,
          sourceName: "ci_seed_baseline",
          effectiveDate: "2026-01-01",
          confidenceLevel: signal.confidenceLevel,
        });
      }
    }

    console.log(`Seeded deterministic CI baseline for ${TARGET_ROLE_SEEDS.length} target role families.`);
  } finally {
    await getDbPool().end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
