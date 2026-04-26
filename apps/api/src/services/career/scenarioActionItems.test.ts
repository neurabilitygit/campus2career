import test from "node:test";
import assert from "node:assert/strict";
import { buildCareerScenarioActionItemDrafts } from "./scenarioActionItems";
import type { CareerScenarioRecord } from "../../../../../packages/shared/src/contracts/careerScenario";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

const scenario: CareerScenarioRecord = {
  careerScenarioId: "scenario-1",
  studentProfileId: "student-1",
  scenarioName: "Healthcare data analyst",
  status: "active",
  isActive: true,
  targetRole: "data analyst",
  targetSector: "healthcare",
  assumptions: {},
  sourceType: "pasted_job_description",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const analysis = {
  analysisMode: "rule_based" as const,
  confidenceLabel: "medium" as const,
  summary: "Scenario summary",
  qualificationLabel: "developing" as const,
  matchedStrengths: [],
  likelyGaps: ["Healthcare analytics proof"],
  missingEvidence: ["Verified degree requirements"],
  scenarioSpecificActions: [
    "For Healthcare data analyst, build visible evidence in healthcare analytics proof.",
    "Verify degree requirements before relying on Healthcare data analyst readiness as a confirmed read.",
  ],
  recommendedActions: ["General action"],
  academicImplications: [],
  skillsImplications: [],
  experienceImplications: [],
  curriculumImplications: [],
  warnings: ["Curriculum verification is still incomplete"],
  assumptionsUsed: [],
};

const scoring: ScoringOutput = {
  studentId: "student-1",
  targetRoleFamily: "data analyst",
  targetSectorCluster: "healthcare",
  trajectoryStatus: "watch",
  overallScore: 64,
  subScores: {
    roleAlignment: 60,
    marketDemand: 70,
    academicReadiness: 62,
    experienceStrength: 58,
    proofOfWorkStrength: 55,
    networkStrength: 48,
    executionMomentum: 66,
  },
  subScoreDetails: {} as any,
  evidenceQuality: {
    overallEvidenceLevel: "moderate",
    confidenceLabel: "medium",
    assessmentMode: "provisional",
    knownEvidence: [],
    weakEvidence: [],
    missingEvidence: ["Verified curriculum"],
    provisionalReasons: ["Curriculum verification incomplete"],
    recommendedEvidenceActions: ["Verify curriculum evidence"],
  },
  topStrengths: [],
  topRisks: [],
  heuristicFlags: [],
  skillGaps: [],
  recommendations: [
    {
      recommendationType: "project",
      title: "Build a healthcare dashboard project",
      description: "Show reporting and stakeholder insight work.",
      effortLevel: "medium",
      estimatedSignalStrength: "high",
      whyThisMatchesStudent: "It closes a visible portfolio gap.",
      linkedSkillName: "SQL",
    },
  ],
};

test("buildCareerScenarioActionItemDrafts creates deduplicated first-class items from scenario and scoring outputs", () => {
  const drafts = buildCareerScenarioActionItemDrafts({
    scenario,
    analysisResult: analysis,
    scoring,
  });

  assert.ok(drafts.some((item) => item.sourceKind === "scenario_specific"));
  assert.ok(drafts.some((item) => item.sourceKind === "recommendation"));
  assert.ok(drafts.some((item) => item.sourceKind === "evidence_gap"));
  assert.ok(drafts.some((item) => /healthcare dashboard project/i.test(item.title)));
  assert.ok(drafts.every((item) => item.status === "active"));
});
