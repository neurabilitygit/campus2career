import test from "node:test";
import assert from "node:assert/strict";
import { runScenarioChat } from "./scenarioChat";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

function baseScoring(): ScoringOutput {
  return {
    studentId: "student-1",
    targetRoleFamily: "data analyst",
    targetSectorCluster: "data_analytics",
    trajectoryStatus: "watch",
    overallScore: 42,
    subScores: {
      roleAlignment: 40,
      marketDemand: 70,
      academicReadiness: 35,
      experienceStrength: 20,
      proofOfWorkStrength: 18,
      networkStrength: 22,
      executionMomentum: 50,
    },
    subScoreDetails: {
      roleAlignment: {
        score: 40,
        status: "weak",
        evidenceLevel: "weak",
        confidenceLabel: "medium",
        interpretation: "Weak role alignment",
        knownSignals: [],
        missingSignals: [],
      },
      marketDemand: {
        score: 70,
        status: "strong",
        evidenceLevel: "moderate",
        confidenceLabel: "medium",
        interpretation: "Healthy market demand",
        knownSignals: [],
        missingSignals: [],
      },
      academicReadiness: {
        score: 35,
        status: "weak",
        evidenceLevel: "weak",
        confidenceLabel: "medium",
        interpretation: "Academic evidence is still limited",
        knownSignals: [],
        missingSignals: [],
      },
      experienceStrength: {
        score: 20,
        status: "weak",
        evidenceLevel: "weak",
        confidenceLabel: "medium",
        interpretation: "Experience is light",
        knownSignals: [],
        missingSignals: [],
      },
      proofOfWorkStrength: {
        score: 18,
        status: "weak",
        evidenceLevel: "weak",
        confidenceLabel: "medium",
        interpretation: "Proof of work is light",
        knownSignals: [],
        missingSignals: [],
      },
      networkStrength: {
        score: 22,
        status: "weak",
        evidenceLevel: "weak",
        confidenceLabel: "medium",
        interpretation: "Network is light",
        knownSignals: [],
        missingSignals: [],
      },
      executionMomentum: {
        score: 50,
        status: "developing",
        evidenceLevel: "weak",
        confidenceLabel: "medium",
        interpretation: "Execution is mixed",
        knownSignals: [],
        missingSignals: [],
      },
    },
    topStrengths: [],
    topRisks: ["Transcript and role evidence are still thin."],
    heuristicFlags: [],
    skillGaps: [
      {
        skillName: "sql",
        requiredLevel: "intermediate",
        estimatedCurrentLevel: "none",
        gapSeverity: "high",
        evidenceSummary: "No visible SQL evidence yet.",
        recommendationPriority: 5,
      },
    ],
    recommendations: [
      {
        recommendationType: "project",
        title: "Build one SQL project",
        description: "Show applied evidence quickly.",
        effortLevel: "medium",
        estimatedSignalStrength: "high",
        whyThisMatchesStudent: "Fastest gap-closure move.",
      },
    ],
    evidenceQuality: {
      overallEvidenceLevel: "weak",
      confidenceLabel: "medium",
      assessmentMode: "provisional",
      knownEvidence: [],
      weakEvidence: [],
      missingEvidence: [],
      provisionalReasons: [],
    },
  };
}

test("runScenarioChat fallback carries communication preference notes into the explanation basis", async () => {
  delete process.env.OPENAI_API_KEY;

  const result = await runScenarioChat({
    studentName: "Test Student",
    targetRoleFamily: "data analyst",
    targetSectorCluster: "data_analytics",
    scenarioQuestion: "How should I spend the next two weeks?",
    communicationStyle: "direct",
    communicationPreferenceNotes: [
      "Preferred channels: SMS.",
      "Formats that tend to land well: Choices.",
    ],
    scoring: baseScoring(),
    truthNotes: [],
  });

  assert.equal(result.deliveryMode, "fallback");
  assert.ok(
    result.response.basedOn.some((item) => /Preferred channels: SMS/i.test(item))
  );
});
