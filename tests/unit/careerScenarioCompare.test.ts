import test from "node:test";
import assert from "node:assert/strict";
import { compareCareerScenarios } from "../../apps/web/src/lib/careerScenarioCompare";
import type { CareerScenarioRecord } from "../../packages/shared/src/contracts/careerScenario";

function scenario(overrides: Partial<CareerScenarioRecord>): CareerScenarioRecord {
  return {
    careerScenarioId: "scenario-1",
    studentProfileId: "student-1",
    scenarioName: "Scenario A",
    status: "active",
    isActive: true,
    assumptions: {},
    sourceType: "manual_target",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

test("compareCareerScenarios builds a side-by-side summary with deltas and distinct gaps", () => {
  const left = scenario({
    scenarioName: "Consulting path",
    readinessScoreSnapshot: { overallScore: 58 } as any,
    analysisResult: {
      analysisMode: "rule_based",
      confidenceLabel: "medium",
      summary: "Left",
      qualificationLabel: "developing",
      matchedStrengths: [],
      likelyGaps: ["Case interview prep", "Networking"],
      missingEvidence: [],
      scenarioSpecificActions: ["Build case interview reps"],
      recommendedActions: ["General action"],
      academicImplications: [],
      skillsImplications: [],
      experienceImplications: [],
      curriculumImplications: [],
      warnings: [],
      assumptionsUsed: [],
    },
  });
  const right = scenario({
    careerScenarioId: "scenario-2",
    scenarioName: "Analytics path",
    readinessScoreSnapshot: { overallScore: 71 } as any,
    analysisResult: {
      analysisMode: "rule_based",
      confidenceLabel: "high",
      summary: "Right",
      qualificationLabel: "strong",
      matchedStrengths: [],
      likelyGaps: ["SQL proof", "Networking"],
      missingEvidence: [],
      scenarioSpecificActions: ["Build SQL proof"],
      recommendedActions: ["General action"],
      academicImplications: [],
      skillsImplications: [],
      experienceImplications: [],
      curriculumImplications: [],
      warnings: [],
      assumptionsUsed: [],
    },
  });

  const comparison = compareCareerScenarios(left, right);
  assert.ok(comparison);
  assert.equal(comparison?.overallScoreDelta, 13);
  assert.equal(comparison?.qualificationShift, "developing -> strong");
  assert.deepEqual(comparison?.distinctLeftGaps, ["Case interview prep"]);
  assert.deepEqual(comparison?.distinctRightGaps, ["SQL proof"]);
});

test("compareCareerScenarios prefers persisted action items when present", () => {
  const left = scenario({
    actionItems: [
      {
        careerScenarioActionItemId: "item-1",
        careerScenarioId: "scenario-1",
        studentProfileId: "student-1",
        title: "Build visible SQL proof",
        priority: "high",
        sourceKind: "scenario_specific",
        status: "active",
        sortOrder: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
  });
  const right = scenario({
    careerScenarioId: "scenario-2",
    actionItems: [
      {
        careerScenarioActionItemId: "item-2",
        careerScenarioId: "scenario-2",
        studentProfileId: "student-1",
        title: "Add a healthcare operations project",
        priority: "medium",
        sourceKind: "recommendation",
        status: "active",
        sortOrder: 0,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
      },
    ],
  });

  const comparison = compareCareerScenarios(left, right);
  assert.deepEqual(comparison?.leftActions, ["Build visible SQL proof"]);
  assert.deepEqual(comparison?.rightActions, ["Add a healthcare operations project"]);
});
