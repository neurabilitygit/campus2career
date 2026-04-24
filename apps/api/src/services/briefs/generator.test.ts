import test from "node:test";
import assert from "node:assert/strict";
import { buildUserPrompt } from "./generator";
import type { ParentBriefInput } from "./generator";

const baseInput: ParentBriefInput = {
  studentProfileId: "student-1",
  householdId: "household-1",
  studentName: "Maya Chen",
  monthLabel: "2026-04",
  targetGoal: "Data analyst",
  accomplishments: ["Completed analytics project"],
  scoring: {
    studentId: "student-1",
    targetRoleFamily: "data analyst",
    targetSectorCluster: "data_analytics",
    trajectoryStatus: "watch",
    overallScore: 61,
    subScores: {
      roleAlignment: 58,
      marketDemand: 70,
      academicReadiness: 54,
      experienceStrength: 50,
      proofOfWorkStrength: 55,
      networkStrength: 52,
      executionMomentum: 63,
    },
    subScoreDetails: {
      roleAlignment: {
        score: 58,
        status: "developing",
        evidenceLevel: "moderate",
        confidenceLabel: "medium",
        interpretation: "Role evidence is partial.",
        knownSignals: [],
        missingSignals: [],
      },
      marketDemand: {
        score: 70,
        status: "developing",
        evidenceLevel: "moderate",
        confidenceLabel: "medium",
        interpretation: "Market evidence is present.",
        knownSignals: [],
        missingSignals: [],
      },
      academicReadiness: {
        score: 54,
        status: "weak",
        evidenceLevel: "missing",
        confidenceLabel: "low",
        interpretation: "Academic evidence is incomplete.",
        knownSignals: [],
        missingSignals: ["Transcript"],
      },
      experienceStrength: {
        score: 50,
        status: "weak",
        evidenceLevel: "missing",
        confidenceLabel: "low",
        interpretation: "Experience evidence is incomplete.",
        knownSignals: [],
        missingSignals: ["Resume"],
      },
      proofOfWorkStrength: {
        score: 55,
        status: "developing",
        evidenceLevel: "weak",
        confidenceLabel: "low",
        interpretation: "Artifact evidence is weak.",
        knownSignals: [],
        missingSignals: [],
      },
      networkStrength: {
        score: 52,
        status: "weak",
        evidenceLevel: "missing",
        confidenceLabel: "low",
        interpretation: "Network evidence is incomplete.",
        knownSignals: [],
        missingSignals: ["Contacts"],
      },
      executionMomentum: {
        score: 63,
        status: "developing",
        evidenceLevel: "moderate",
        confidenceLabel: "medium",
        interpretation: "Execution evidence is partial.",
        knownSignals: [],
        missingSignals: [],
      },
    },
    evidenceQuality: {
      overallEvidenceLevel: "weak",
      confidenceLabel: "low",
      assessmentMode: "provisional",
      knownEvidence: ["Market signals"],
      weakEvidence: ["proofOfWorkStrength: Artifact evidence is weak."],
      missingEvidence: ["academicReadiness: Transcript"],
      provisionalReasons: ["Transcript missing."],
      strongestEvidenceCategories: ["target_role"],
      weakestEvidenceCategories: ["resume", "transcript"],
      blockedByMissingEvidence: ["transcript", "academic_requirements"],
      recommendedEvidenceActions: ["Upload transcript", "Add resume"],
    },
    topStrengths: [],
    topRisks: ["Academic evidence is incomplete."],
    heuristicFlags: [],
    skillGaps: [],
    recommendations: [],
  },
  upcomingDeadlines: ["Summer internship deadline"],
  parentVisibleInsights: ["Needs stronger transcript evidence"],
  truthNotes: ["Transcript is missing."],
  evidenceSummary: {
    assessmentMode: "provisional",
    overallEvidenceLevel: "weak",
    strongestEvidenceCategories: ["target role"],
    weakestEvidenceCategories: ["resume", "transcript"],
    blockedByMissingEvidence: ["transcript", "academic requirements"],
    recommendedEvidenceActions: ["Upload transcript", "Add resume"],
  },
  coachSummary: {
    recommendationTitles: ["Reach out to three alumni"],
    actionTitles: ["Finish resume revision"],
    flagTitles: ["Application follow-through is stalled"],
  },
};

test("buildUserPrompt includes evidence integrity metadata for parent briefs", () => {
  const prompt = buildUserPrompt(baseInput);

  assert.match(prompt, /Evidence integrity:/);
  assert.match(prompt, /overall evidence weak/i);
  assert.match(prompt, /blocked by missing evidence transcript; academic requirements/i);
  assert.match(prompt, /recommended evidence actions Upload transcript; Add resume/i);
  assert.match(prompt, /Visible coach recommendations: Reach out to three alumni/i);
  assert.match(prompt, /Visible coach action items: Finish resume revision/i);
});
