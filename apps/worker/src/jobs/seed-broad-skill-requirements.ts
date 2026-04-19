import { persistNormalizedSkill } from "../../../api/src/services/market/persistence";

/**
 * Temporary broad seed requirements to support development before exact O*NET fetches
 * are fully wired. These can be overwritten by source-driven syncs.
 */
const BROAD_SKILL_SEEDS = [
  { occupationCanonicalName: "financial analyst", skillName: "excel_modeling", importanceScore: 90 },
  { occupationCanonicalName: "financial analyst", skillName: "finance_analysis", importanceScore: 85 },
  { occupationCanonicalName: "financial analyst", skillName: "stakeholder_communication", importanceScore: 70 },
  { occupationCanonicalName: "data analyst", skillName: "sql", importanceScore: 85 },
  { occupationCanonicalName: "data analyst", skillName: "data_visualization", importanceScore: 75 },
  { occupationCanonicalName: "data analyst", skillName: "ai_fluency", importanceScore: 55 },
  { occupationCanonicalName: "management consulting analyst", skillName: "consulting_problem_solving", importanceScore: 90 },
  { occupationCanonicalName: "management consulting analyst", skillName: "presentation", importanceScore: 80 },
  { occupationCanonicalName: "software developer", skillName: "python", importanceScore: 70 },
  { occupationCanonicalName: "software developer", skillName: "project_execution", importanceScore: 75 },
];

export async function seedBroadSkillRequirements() {
  console.log("Seeding broad skill requirements...");
  for (const row of BROAD_SKILL_SEEDS) {
    await persistNormalizedSkill({
      occupationCanonicalName: row.occupationCanonicalName,
      skillName: row.skillName,
      skillCategory: row.skillName === "ai_fluency" ? "ai_fluency" : "technical",
      importanceScore: row.importanceScore,
      requiredProficiencyBand: row.importanceScore >= 80 ? "advanced" : "intermediate",
      evidenceSource: "development_seed",
    });
  }
  console.log(`Seeded ${BROAD_SKILL_SEEDS.length} broad skill requirements.`);
}
