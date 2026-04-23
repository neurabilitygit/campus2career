import test from "node:test";
import assert from "node:assert/strict";
import { explainScore } from "./explain";
import type { ScoringOutput, StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";

function buildInput(overrides: Partial<StudentScoringInput> = {}): StudentScoringInput {
  return {
    studentId: "student-1",
    targetRoleFamily: "data analyst",
    targetSectorCluster: "data_analytics",
    occupationSkills: [
      {
        skillName: "sql",
        skillCategory: "technical",
        importanceScore: 88,
        requiredProficiencyBand: "advanced",
      },
    ],
    marketSignals: [
      {
        signalType: "demand_growth",
        signalValue: 6.2,
        signalDirection: "rising",
        sourceName: "ci_seed_baseline",
        effectiveDate: "2026-01-01",
        confidenceLevel: "high",
        scope: "role",
      },
    ],
    transcript: {
      parsedStatus: "parsed",
      transcriptSummary: "Parsed transcript.",
      termCount: 2,
      courseCount: 8,
      completedCourseCount: 8,
      matchedCatalogCourseCount: 4,
      unmatchedCourseCount: 4,
      creditsEarned: 24,
      truthStatus: "inferred",
      extractionMethod: "pdf_text",
      extractionConfidenceLabel: "medium",
      institutionResolutionTruthStatus: "inferred",
      institutionResolutionNote: "Matched by school name.",
    },
    requirementProgress: {
      boundToCatalog: true,
      institutionDisplayName: "Harvard University",
      catalogLabel: "2026-2027",
      degreeType: "Undergraduate",
      programName: "Concentrations",
      majorDisplayName: "Philosophy",
      requirementSetDisplayName: "Philosophy major requirements",
      provenanceMethod: "artifact_pdf",
      sourceUrl: null,
      sourceNote: "Uploaded pdf",
      totalRequirementItems: 10,
      satisfiedRequirementItems: 4,
      totalRequirementGroups: 3,
      satisfiedRequirementGroups: 1,
      creditsApplied: 12,
      completionPercent: 40,
      missingRequiredCourses: ["PHIL97", "PHIL98"],
      inferredConfidence: "medium",
      truthStatus: "direct",
      manualRequirementItemCount: 0,
      nonCourseRequirementItemCount: 0,
      excludedRequirementGroupCount: 0,
      coverageNotes: [],
    },
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

function buildScoring(overrides: Partial<ScoringOutput> = {}): ScoringOutput {
  return {
    studentId: "student-1",
    targetRoleFamily: "data analyst",
    targetSectorCluster: "data_analytics",
    trajectoryStatus: "at_risk",
    overallScore: 43,
    subScores: {
      roleAlignment: 0,
      marketDemand: 100,
      academicReadiness: 45,
      experienceStrength: 0,
      proofOfWorkStrength: 12,
      networkStrength: 0,
      executionMomentum: 80,
    },
    subScoreDetails: {
      roleAlignment: {
        score: 0,
        status: "weak",
        evidenceLevel: "thin",
        confidenceLabel: "low",
        interpretation: "Role alignment is directional only.",
        knownSignals: ["Target resolved"],
        missingSignals: ["More role-specific evidence"],
      },
      marketDemand: {
        score: 100,
        status: "strong",
        evidenceLevel: "moderate",
        confidenceLabel: "medium",
        interpretation: "Market demand reflects imported signals.",
        knownSignals: ["Demand growth"],
        missingSignals: [],
      },
      academicReadiness: {
        score: 45,
        status: "weak",
        evidenceLevel: "moderate",
        confidenceLabel: "medium",
        interpretation: "Academic readiness reflects partial evidence.",
        knownSignals: ["Parsed transcript"],
        missingSignals: [],
      },
      experienceStrength: {
        score: 0,
        status: "weak",
        evidenceLevel: "missing",
        confidenceLabel: "low",
        interpretation: "No experience records are stored yet.",
        knownSignals: [],
        missingSignals: ["Experience records"],
      },
      proofOfWorkStrength: {
        score: 12,
        status: "weak",
        evidenceLevel: "missing",
        confidenceLabel: "low",
        interpretation: "No portfolio evidence is stored yet.",
        knownSignals: [],
        missingSignals: ["Artifacts"],
      },
      networkStrength: {
        score: 0,
        status: "weak",
        evidenceLevel: "missing",
        confidenceLabel: "low",
        interpretation: "No networking evidence is stored yet.",
        knownSignals: [],
        missingSignals: ["Contacts"],
      },
      executionMomentum: {
        score: 80,
        status: "strong",
        evidenceLevel: "thin",
        confidenceLabel: "low",
        interpretation: "Execution is provisional.",
        knownSignals: [],
        missingSignals: ["Deadlines"],
      },
    },
    evidenceQuality: {
      overallEvidenceLevel: "thin",
      confidenceLabel: "low",
      assessmentMode: "provisional",
      knownEvidence: ["Parsed transcript"],
      weakEvidence: ["roleAlignment: Role alignment is directional only."],
      missingEvidence: ["networkStrength: Contacts"],
      provisionalReasons: ["Evidence is thin."],
    },
    topStrengths: [],
    topRisks: ["Transcript and degree progress are not yet strongly supporting the stated target"],
    heuristicFlags: [],
    skillGaps: [
      {
        skillName: "sql",
        requiredLevel: "advanced",
        estimatedCurrentLevel: "none",
        gapSeverity: "high",
        evidenceSummary: "No SQL evidence.",
        recommendationPriority: 5,
      },
    ],
    recommendations: [
      {
        recommendationType: "course",
        title: "Complete an introductory SQL course",
        description: "Build baseline SQL fluency.",
        effortLevel: "medium",
        estimatedSignalStrength: "high",
        whyThisMatchesStudent: "SQL is a primary missing skill.",
        linkedSkillName: "sql",
      },
    ],
    ...overrides,
  };
}

test("explainScore returns a readable explanation with counterfactuals", () => {
  const selectedInput = buildInput();
  const selectedScoring = buildScoring();
  const comparisonInput = buildInput({ targetRoleFamily: "clinical research coordinator" });
  const comparisonScoring = buildScoring({
    targetRoleFamily: "clinical research coordinator",
    overallScore: 41,
    subScores: {
      ...buildScoring().subScores,
      marketDemand: 92,
    },
  });

  const explanation = explainScore({
    selectedInput,
    selectedScoring,
    comparisonInput,
    comparisonScoring,
  });

  assert.match(explanation.summaryHeadline, /Data Analyst is currently At Risk at 43\/100/);
  assert.match(explanation.summaryText, /Complete an introductory SQL course/);
  assert.equal(explanation.strongestDrivers[0]?.key, "marketDemand");
  assert.equal(explanation.biggestGaps[0]?.key, "roleAlignment");
  assert.deepEqual(explanation.immediateActions.slice(0, 3), [
    "Complete an introductory SQL course",
    "Transcript and degree progress are not yet strongly supporting the stated target",
    "Review requirement coverage for PHIL97",
  ]);
  assert.equal(explanation.counterfactual?.deltaOverallScore, -2);
  assert.match(explanation.counterfactual?.summaryText || "", /scores 2 points lower/);
});

test("explainScore surfaces data quality alerts when major evidence is missing", () => {
  const explanation = explainScore({
    selectedInput: buildInput({
      transcript: undefined,
      requirementProgress: undefined,
      experiences: [],
      artifacts: [],
      contacts: [],
      outreach: [],
    }),
    selectedScoring: buildScoring(),
  });

  assert.deepEqual(explanation.dataQualityAlerts, [
    "No parsed transcript is loaded yet, so coursework progress is still estimated conservatively.",
    "The student is not fully bound to a structured degree requirement set yet.",
    "No experience records are stored yet.",
    "No portfolio or artifact evidence is stored yet.",
    "No networking history is stored yet.",
  ]);
});
