import test from "node:test";
import assert from "node:assert/strict";
import { generateCommunicationTranslation } from "./translator";
import { getCommunicationProvider } from "./provider";
import { summarizeCommunicationPreferences } from "./preferences";
import type {
  ParentCommunicationEntryRecord,
  ParentCommunicationProfileRecord,
  StudentCommunicationPreferencesRecord,
} from "../../../../../packages/shared/src/contracts/communication";
import type { ScoringOutput } from "../../../../../packages/shared/src/scoring/types";

function baseEntry(overrides: Partial<ParentCommunicationEntryRecord> = {}): ParentCommunicationEntryRecord {
  return {
    parentCommunicationEntryId: "entry-1",
    parentUserId: "parent-1",
    studentProfileId: "student-1",
    householdId: "household-1",
    category: "career_concern",
    status: "ready_for_translation",
    urgency: "medium",
    deliveryIntent: "direct",
    factsStudentShouldKnow: "The internship search window is narrowing.",
    questionsParentWantsAnswered: "What is your plan for applications?",
    parentConcerns: "Nothing visible is moving yet.",
    recurringCommunicationFailures: "The student hears this as pressure.",
    defensiveTopics: "Deadlines and urgency",
    priorAttemptsThatDidNotWork: "Repeating the same reminder.",
    preferredOutcome: "A calmer conversation about the next step.",
    freeformContext: "The parent wants to support, not control.",
    ...overrides,
  };
}

function basePreferences(
  overrides: Partial<StudentCommunicationPreferencesRecord> = {}
): StudentCommunicationPreferencesRecord {
  return {
    studentProfileId: "student-1",
    preferredChannels: ["sms"],
    dislikedChannels: ["email"],
    preferredTone: "gentle",
    sensitiveTopics: ["money"],
    preferredFrequency: "as_needed",
    bestTimeOfDay: "evening",
    preferredGuidanceFormats: ["choices", "summaries"],
    identifyParentOrigin: true,
    allowParentConcernRephrasing: true,
    consentParentTranslatedMessages: true,
    notes: "Shorter messages land better.",
    ...overrides,
  };
}

function baseParentProfile(
  overrides: Partial<ParentCommunicationProfileRecord> = {}
): ParentCommunicationProfileRecord {
  return {
    parentUserId: "parent-1",
    studentProfileId: "student-1",
    householdId: "household-1",
    mainWorries: "The student is drifting.",
    usualApproach: "Direct reminders",
    whatDoesNotWork: "Pressure and repeated checking in",
    wantsToImprove: "Calmer, more constructive conversations",
    sendPreference: "review_before_send",
    preferredCommunicationStyle: "Calm and short",
    consentAcknowledged: true,
    ...overrides,
  };
}

function baseScoring(overrides: Partial<ScoringOutput> = {}): ScoringOutput {
  return {
    studentId: "student-1",
    targetRoleFamily: "data analyst",
    targetSectorCluster: "data_analytics",
    trajectoryStatus: "watch",
    overallScore: 48,
    subScores: {
      roleAlignment: 42,
      marketDemand: 75,
      academicReadiness: 38,
      experienceStrength: 28,
      proofOfWorkStrength: 20,
      networkStrength: 30,
      executionMomentum: 55,
    },
    subScoreDetails: {
      roleAlignment: {
        score: 42,
        status: "weak",
        evidenceLevel: "thin",
        confidenceLabel: "medium",
        interpretation: "Thin evidence for alignment.",
        knownSignals: [],
        missingSignals: [],
      },
      marketDemand: {
        score: 75,
        status: "strong",
        evidenceLevel: "moderate",
        confidenceLabel: "medium",
        interpretation: "Demand looks favorable.",
        knownSignals: [],
        missingSignals: [],
      },
      academicReadiness: {
        score: 38,
        status: "weak",
        evidenceLevel: "thin",
        confidenceLabel: "medium",
        interpretation: "Academic support is still limited.",
        knownSignals: [],
        missingSignals: [],
      },
      experienceStrength: {
        score: 28,
        status: "weak",
        evidenceLevel: "thin",
        confidenceLabel: "medium",
        interpretation: "Experience remains limited.",
        knownSignals: [],
        missingSignals: [],
      },
      proofOfWorkStrength: {
        score: 20,
        status: "weak",
        evidenceLevel: "thin",
        confidenceLabel: "medium",
        interpretation: "Proof of work remains limited.",
        knownSignals: [],
        missingSignals: [],
      },
      networkStrength: {
        score: 30,
        status: "weak",
        evidenceLevel: "thin",
        confidenceLabel: "medium",
        interpretation: "Network remains limited.",
        knownSignals: [],
        missingSignals: [],
      },
      executionMomentum: {
        score: 55,
        status: "developing",
        evidenceLevel: "moderate",
        confidenceLabel: "medium",
        interpretation: "Some execution momentum exists.",
        knownSignals: [],
        missingSignals: [],
      },
    },
    topStrengths: [],
    topRisks: ["Applications are not moving yet."],
    heuristicFlags: [],
    skillGaps: [],
    recommendations: [
      {
        recommendationType: "networking",
        title: "Clarify the next application step",
        description: "Focus on one concrete next move.",
        effortLevel: "low",
        estimatedSignalStrength: "medium",
        whyThisMatchesStudent: "Low-friction next step.",
      },
    ],
    evidenceQuality: {
      overallEvidenceLevel: "thin",
      confidenceLabel: "medium",
      assessmentMode: "provisional",
      knownEvidence: [],
      weakEvidence: [],
      missingEvidence: [],
      provisionalReasons: [],
    },
    ...overrides,
  };
}

test("generateCommunicationTranslation withholds delivery when student consent is absent", async () => {
  delete process.env.OPENAI_API_KEY;

  const result = await generateCommunicationTranslation({
    studentProfileId: "student-1",
    householdId: "household-1",
    parentUserId: "parent-1",
    studentName: "Test Student",
    studentGoal: "Break into analytics",
    parentEntry: baseEntry(),
    parentProfile: baseParentProfile(),
    studentPreferences: basePreferences({ consentParentTranslatedMessages: false }),
    scoring: baseScoring(),
  });

  assert.equal(result.strategy.consentState, "withheld");
  assert.equal(result.strategy.withholdDelivery, true);
  assert.match(result.strategy.withholdReason || "", /consent/i);
});

test("generateCommunicationTranslation marks sensitive emotional entries for review", async () => {
  delete process.env.OPENAI_API_KEY;

  const result = await generateCommunicationTranslation({
    studentProfileId: "student-1",
    householdId: "household-1",
    parentUserId: "parent-1",
    studentName: "Test Student",
    studentGoal: "Break into analytics",
    parentEntry: baseEntry({
      category: "emotional_motivational_concern",
      urgency: "urgent",
    }),
    parentProfile: baseParentProfile(),
    studentPreferences: basePreferences(),
    scoring: baseScoring(),
  });

  assert.equal(result.strategy.humanReviewRecommended, true);
  assert.equal(result.strategy.defensivenessRisk, "high");
});

test("summarizeCommunicationPreferences returns reusable prompt guidance", () => {
  const summary = summarizeCommunicationPreferences(basePreferences());
  assert.equal(summary.deliveryConsentState, "granted");
  assert.equal(summary.preferredStyleLabel, "gentle");
  assert.ok(summary.studentPromptNotes.some((note) => /Preferred channels/i.test(note)));
  assert.ok(summary.parentPromptNotes.some((note) => /rephrased/i.test(note)));
});

test("mock communication provider records a local mock send instead of a real outbound message", async () => {
  process.env.COMMUNICATION_DELIVERY_MODE = "mock";

  const result = await getCommunicationProvider().send({
    channel: "sms",
    messageBody: "Hello",
    studentProfileId: "student-1",
    strategyId: "strategy-1",
  });

  assert.equal(result.ok, true);
  assert.equal(result.providerMode, "mock");
  assert.equal(result.status, "delivered");
  assert.match(result.note, /No real message was sent/i);
});
