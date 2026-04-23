import test from "node:test";
import assert from "node:assert/strict";
import { runScoring } from "./index";
import type { StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";

function baseInput(overrides: Partial<StudentScoringInput> = {}): StudentScoringInput {
  return {
    studentId: "student-1",
    targetRoleFamily: "data analyst",
    targetSectorCluster: "data_analytics",
    targetResolution: {
      truthStatus: "direct",
      confidenceLabel: "high",
      resolutionKind: "user_override",
      sourceLabel: "test",
    },
    occupationSkillTruth: {
      truthStatus: "direct",
      confidenceLabel: "high",
      sourceLabel: "test",
    },
    marketSignalTruth: {
      truthStatus: "direct",
      confidenceLabel: "high",
      sourceLabel: "test",
    },
    occupationSkills: [
      {
        skillName: "sql",
        skillCategory: "technical",
        importanceScore: 88,
        requiredProficiencyBand: "advanced",
      },
      {
        skillName: "data_visualization",
        skillCategory: "technical",
        importanceScore: 72,
        requiredProficiencyBand: "intermediate",
      },
    ],
    marketSignals: [],
    courseCoverage: [],
    experiences: [],
    artifacts: [],
    contacts: [],
    outreach: [],
    deadlines: [],
    signals: {
      currentAcademicYear: "junior",
      hasInternshipByJuniorYear: false,
      hasIndependentProjectBySeniorYear: false,
      hasFirstOrSecondDegreeProfessionalNetwork: false,
      hasCarefullyCultivatedMentors: false,
      aiToolComfortLevel: "medium",
      repeatedDeadlineMisses: 0,
    },
    ...overrides,
  };
}

test("runScoring marks thin evidence as provisional instead of treating defaults as firm truth", () => {
  const scoring = runScoring(baseInput());

  assert.equal(scoring.evidenceQuality.assessmentMode, "provisional");
  assert.equal(scoring.evidenceQuality.overallEvidenceLevel, "missing");
  assert.equal(scoring.subScores.marketDemand, 55);
  assert.equal(scoring.subScores.executionMomentum, 50);
  assert.match(scoring.topRisks[0] || "", /provisional/i);
  assert.ok(
    scoring.evidenceQuality.missingEvidence.some((item) => /role-specific labor market signals/i.test(item))
  );
});

test("runScoring distinguishes low readiness from low evidence when evidence is present", () => {
  const scoring = runScoring(
    baseInput({
      transcript: {
        parsedStatus: "matched",
        transcriptSummary: "Loaded transcript.",
        termCount: 4,
        courseCount: 16,
        completedCourseCount: 16,
        matchedCatalogCourseCount: 12,
        unmatchedCourseCount: 4,
        creditsEarned: 48,
        truthStatus: "inferred",
        extractionMethod: "pdf_text",
        extractionConfidenceLabel: "medium",
        institutionResolutionTruthStatus: "inferred",
        institutionResolutionNote: "Matched by school name.",
      },
      requirementProgress: {
        boundToCatalog: true,
        institutionDisplayName: "Test University",
        catalogLabel: "2026-2027",
        majorDisplayName: "Economics",
        totalRequirementItems: 12,
        satisfiedRequirementItems: 8,
        totalRequirementGroups: 4,
        satisfiedRequirementGroups: 3,
        creditsApplied: 24,
        completionPercent: 67,
        missingRequiredCourses: [],
        inferredConfidence: "medium",
        truthStatus: "direct",
        manualRequirementItemCount: 0,
        nonCourseRequirementItemCount: 0,
        excludedRequirementGroupCount: 0,
        coverageNotes: [],
      },
      courseCoverage: [
        {
          courseId: "course-1",
          skillName: "sql",
          coverageStrength: "low",
          confidenceScore: 0.2,
        },
      ],
      experiences: [
        {
          experienceId: "exp-1",
          title: "Campus Operations Intern",
          deliverablesSummary: "Coordinated logistics and reporting.",
          relevanceRating: 3,
          toolsUsed: ["excel"],
        },
      ],
      artifacts: [
        {
          artifactId: "artifact-1",
          artifactType: "presentation",
          extractedSummary: "Operations summary deck.",
          parseTruthStatus: "inferred",
          parseConfidenceLabel: "medium",
        },
      ],
      contacts: [{ contactId: "contact-1", warmthLevel: "warm" }],
      outreach: [{ interactionId: "outreach-1", interactionType: "email" }],
      deadlines: [{ deadlineType: "application", dueDate: "2026-05-01", completed: true }],
      marketSignals: [
        {
          signalType: "demand_growth",
          signalValue: 6.2,
          signalDirection: "rising",
          sourceName: "bls",
          effectiveDate: "2026-01-01",
          confidenceLevel: "high",
          scope: "role",
        },
      ],
    })
  );

  assert.equal(scoring.evidenceQuality.assessmentMode, "measured");
  assert.ok(scoring.subScoreDetails.roleAlignment.evidenceLevel !== "missing");
  assert.equal(scoring.subScoreDetails.roleAlignment.status, "weak");
  assert.match(scoring.subScoreDetails.roleAlignment.interpretation, /role alignment/i);
});

test("runScoring dampens role certainty when targeting and skill maps rely on fallback assumptions", () => {
  const scoring = runScoring(
    baseInput({
      targetResolution: {
        truthStatus: "fallback",
        confidenceLabel: "low",
        resolutionKind: "selected_sector_mapping",
        sourceLabel: "seed mapping",
        note: "Mapped from sector.",
      },
      occupationSkillTruth: {
        truthStatus: "fallback",
        confidenceLabel: "low",
        sourceLabel: "fallback",
      },
      courseCoverage: [
        {
          courseId: "course-1",
          skillName: "sql",
          coverageStrength: "high",
          confidenceScore: 0.9,
        },
      ],
    })
  );

  assert.equal(scoring.subScoreDetails.roleAlignment.evidenceLevel, "thin");
  assert.equal(scoring.subScoreDetails.roleAlignment.confidenceLabel, "low");
  assert.ok(scoring.subScores.roleAlignment <= 70);
});
