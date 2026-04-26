import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCareerScenario,
  buildScenarioStatusAfterAnalysis,
  extractJobDescriptionRequirements,
  markScenarioNeedsRerun,
} from "./scenarioAnalysis";
import type { CareerScenarioRecord } from "../../../../../packages/shared/src/contracts/careerScenario";
import type { StudentScoringInput } from "../../../../../packages/shared/src/scoring/types";

function baseScenario(): CareerScenarioRecord {
  return {
    careerScenarioId: "scenario-1",
    studentProfileId: "student-1",
    scenarioName: "Fintech analyst",
    status: "active",
    isActive: true,
    jobDescriptionText:
      "We are looking for a data analyst with SQL, Excel, and stakeholder communication. 2+ years of experience preferred. Bachelor's degree required.",
    targetRole: "business analyst",
    targetProfession: "analyst",
    targetIndustry: "finance",
    targetSector: "fintech",
    targetGeography: "New York",
    employerName: "Brightpath",
    jobPostingUrl: null,
    notes: null,
    assumptions: { preferredGeographies: ["New York"] },
    extractedRequirements: null,
    analysisResult: null,
    readinessScoreSnapshot: null,
    recommendationsSnapshot: null,
    sourceType: "pasted_job_description",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function baseScoringInput(): StudentScoringInput {
  return {
    studentId: "student-1",
    targetRoleFamily: "business analyst",
    targetSectorCluster: "fintech",
    preferredGeographies: ["New York"],
    occupationSkills: [
      { skillName: "sql", skillCategory: "technical", importanceScore: 80, requiredProficiencyBand: "intermediate" },
    ],
    courseCoverage: [{ courseId: "course-1", skillName: "sql", coverageStrength: "high", confidenceScore: 0.9 }],
    experiences: [
      { experienceId: "exp-1", title: "Analytics intern", toolsUsed: ["Excel", "SQL"], relevanceRating: 4 },
    ],
    artifacts: [{ artifactId: "artifact-1", artifactType: "project", tags: ["portfolio"], parseTruthStatus: "direct" }],
    contacts: [],
    outreach: [],
    signals: {
      currentAcademicYear: "senior",
      hasInternshipByJuniorYear: true,
      hasIndependentProjectBySeniorYear: true,
      hasFirstOrSecondDegreeProfessionalNetwork: false,
      hasCarefullyCultivatedMentors: false,
      aiToolComfortLevel: "medium",
      repeatedDeadlineMisses: 0,
    },
    requirementProgress: {
      boundToCatalog: true,
      totalRequirementItems: 10,
      satisfiedRequirementItems: 8,
      totalRequirementGroups: 3,
      satisfiedRequirementGroups: 2,
      manualRequirementItemCount: 0,
      nonCourseRequirementItemCount: 0,
      excludedRequirementGroupCount: 0,
      creditsApplied: 90,
      completionPercent: 80,
      missingRequiredCourses: ["FIN 401"],
      inferredConfidence: "high",
      curriculumVerificationStatus: "present_unverified",
      truthStatus: "direct",
    },
  };
}

test("extractJobDescriptionRequirements pulls deterministic signals from pasted text", () => {
  const extracted = extractJobDescriptionRequirements({
    jobDescriptionText:
      "Required: SQL, Excel, Tableau, communication, and 2+ years of experience. Bachelor's degree required.",
    targetRole: "data analyst",
    targetSector: "fintech",
  });

  assert.ok(extracted.requiredSkills.includes("sql"));
  assert.ok(extracted.toolsAndTechnologies.includes("tableau"));
  assert.ok(extracted.educationRequirements.some((item) => /Bachelor/i.test(item)));
  assert.ok(extracted.experienceRequirements.some((item) => /2\+ years/i.test(item)));
});

test("buildScenarioStatusAfterAnalysis respects active and error outcomes", () => {
  assert.equal(buildScenarioStatusAfterAnalysis({ isActive: true }), "active");
  assert.equal(buildScenarioStatusAfterAnalysis({ isActive: false }), "complete");
  assert.equal(buildScenarioStatusAfterAnalysis({ isActive: true, hadErrors: true }), "error");
});

test("markScenarioNeedsRerun only upgrades active or complete scenarios", () => {
  assert.equal(markScenarioNeedsRerun("active"), "needs_rerun");
  assert.equal(markScenarioNeedsRerun("complete"), "needs_rerun");
  assert.equal(markScenarioNeedsRerun("draft"), "draft");
});

test("analyzeCareerScenario returns structured strengths, gaps, and warnings", () => {
  const analysis = analyzeCareerScenario({
    scenario: baseScenario(),
    extractedRequirements: extractJobDescriptionRequirements({
      jobDescriptionText: baseScenario().jobDescriptionText,
      targetRole: baseScenario().targetRole,
      targetSector: baseScenario().targetSector,
    }),
    scoringInput: baseScoringInput(),
    scoring: {
      overallScore: 68,
      trajectoryStatus: "watch",
      topStrengths: ["Strong coursework signal"],
      topRisks: ["Need more internship evidence"],
      recommendations: [{ title: "Add one more analytics project" }],
      evidenceQuality: {
        confidenceLabel: "medium",
        missingEvidence: ["Verified degree requirements"],
        weakEvidence: ["Curriculum verification is missing"],
        recommendedEvidenceActions: ["Verify the curriculum"],
      },
    },
  });

  assert.equal(analysis.analysisMode, "rule_based");
  assert.ok(analysis.matchedStrengths.length > 0);
  assert.ok(analysis.likelyGaps.length > 0);
  assert.ok(analysis.scenarioSpecificActions.some((item) => /Fintech analyst|business analyst/i.test(item)));
  assert.ok(analysis.recommendedActions.some((item) => /verify degree requirements|curriculum/i.test(item)));
  assert.ok(analysis.warnings.some((item) => /curriculum/i.test(item)));
});
