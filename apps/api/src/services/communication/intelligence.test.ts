import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCommunicationAnalytics,
  buildCommunicationSummary,
  calculateCommunicationProfileCompletion,
  canViewCommunicationScope,
  deriveCommunicationInferredInsights,
  PARENT_COMMUNICATION_PROMPTS,
  selectNextCommunicationPrompt,
} from "./intelligence";

test("canViewCommunicationScope respects private visibility and role-specific scopes", () => {
  assert.equal(
    canViewCommunicationScope({
      viewerRole: "student",
      viewerUserId: "student-1",
      ownerUserId: "student-1",
      visibilityScope: "private_to_user",
    }),
    true
  );

  assert.equal(
    canViewCommunicationScope({
      viewerRole: "parent",
      viewerUserId: "parent-1",
      ownerUserId: "student-1",
      visibilityScope: "private_to_user",
    }),
    false
  );

  assert.equal(
    canViewCommunicationScope({
      viewerRole: "coach",
      viewerUserId: "coach-1",
      ownerUserId: "parent-1",
      visibilityScope: "visible_to_coach",
    }),
    true
  );

  assert.equal(
    canViewCommunicationScope({
      viewerRole: "student",
      viewerUserId: "student-1",
      ownerUserId: "parent-1",
      visibilityScope: "visible_to_system_only",
    }),
    false
  );
});

test("selectNextCommunicationPrompt prioritizes revisit-later prompts before untouched prompts", () => {
  const prompt = selectNextCommunicationPrompt({
    audience: "parent",
    progress: [
      {
        communicationPromptProgressId: "progress-1",
        communicationProfileId: "profile-1",
        userId: "parent-1",
        role: "parent",
        promptKey: PARENT_COMMUNICATION_PROMPTS[2].key,
        status: "revisit_later",
        lastPromptedAt: null,
        answeredAt: null,
      },
    ],
    answeredPromptKeys: [PARENT_COMMUNICATION_PROMPTS[0].key],
  });

  assert.equal(prompt?.key, PARENT_COMMUNICATION_PROMPTS[2].key);
});

test("calculateCommunicationProfileCompletion reports answered progress", () => {
  const completion = calculateCommunicationProfileCompletion({
    audience: "student",
    answeredPromptKeys: ["student_reminder_style", "student_shutdown_triggers"],
  });

  assert.equal(completion.answered, 2);
  assert.ok(completion.completionPercent > 0);
});

test("buildCommunicationSummary hides raw shared-summary-only notes from coach view while preserving themes", () => {
  const summary = buildCommunicationSummary({
    viewerRole: "coach",
    viewerUserId: "coach-1",
    parentProfile: null,
    studentPreferences: null,
    parentInputs: [
      {
        parentCommunicationInputId: "parent-input-1",
        communicationProfileId: "profile-1",
        parentUserId: "parent-1",
        category: "family_communication_patterns",
        promptKey: "family_pattern_parent",
        questionText: "What family pattern matters here?",
        responseText: "We jump into problem solving too fast.",
        sensitivityLevel: "medium",
        visibilityScope: "shared_summary_only",
        confidenceLevel: "user_reported",
      },
    ],
    studentInputs: [
      {
        studentCommunicationInputId: "student-input-1",
        communicationProfileId: "profile-1",
        studentUserId: "student-1",
        category: "stress_points",
        promptKey: "student_stress_worseners",
        questionText: "What makes stress worse?",
        responseText: "Pressure and too many steps at once.",
        sensitivityLevel: "high",
        visibilityScope: "visible_to_coach",
      },
    ],
    translationEvents: [],
  });

  assert.deepEqual(summary.parentVisibleDetails, []);
  assert.ok(summary.sharedThemes.includes("family communication patterns"));
  assert.ok(summary.frictionSignals.some((item) => /stress point/i.test(item)));
});

test("deriveCommunicationInferredInsights creates reviewable patterns from saved inputs and preferences", () => {
  const insights = deriveCommunicationInferredInsights({
    communicationProfileId: "profile-1",
    parentInputs: [
      {
        parentCommunicationInputId: "parent-input-1",
        communicationProfileId: "profile-1",
        parentUserId: "parent-1",
        category: "communication_style",
        promptKey: "helpful_reminders_parent",
        questionText: "What kinds of reminders tend to help?",
        responseText: "Short reminders with one next step help most.",
        sensitivityLevel: "low",
        visibilityScope: "shared_summary_only",
        confidenceLevel: "user_reported",
      },
    ],
    studentInputs: [
      {
        studentCommunicationInputId: "student-input-1",
        communicationProfileId: "profile-1",
        studentUserId: "student-1",
        category: "stress_points",
        promptKey: "student_stress_worseners",
        questionText: "What makes stress worse?",
        responseText: "Too much pressure all at once.",
        sensitivityLevel: "high",
        visibilityScope: "visible_to_system_only",
      },
    ],
    studentPreferences: {
      studentProfileId: "student-profile-1",
      preferredChannels: ["email"],
      dislikedChannels: ["sms"],
      preferredTone: "gentle",
      sensitiveTopics: [],
      preferredFrequency: "weekly",
      bestTimeOfDay: "evening",
      preferredGuidanceFormats: ["summaries"],
      identifyParentOrigin: true,
      allowParentConcernRephrasing: true,
      consentParentTranslatedMessages: true,
      notes: null,
    },
  });

  assert.ok(insights.some((item) => item.insightKey === "reminder-pattern"));
  assert.ok(insights.some((item) => item.insightKey === "tone-preference"));
  assert.ok(insights.some((item) => item.insightKey === "friction-pattern"));
});

test("buildCommunicationAnalytics summarizes prompt activity and translation feedback", () => {
  const analytics = buildCommunicationAnalytics({
    promptProgress: [
      {
        communicationPromptProgressId: "progress-1",
        communicationProfileId: "profile-1",
        userId: "parent-1",
        role: "parent",
        promptKey: "parent_motivation",
        status: "answered",
      },
      {
        communicationPromptProgressId: "progress-2",
        communicationProfileId: "profile-1",
        userId: "student-1",
        role: "student",
        promptKey: "student_reminder_style",
        status: "revisit_later",
      },
    ],
    translationEvents: [
      {
        communicationTranslationEventId: "event-1",
        communicationProfileId: "profile-1",
        sourceRole: "parent",
        targetRole: "student",
        originalText: "Please start sooner.",
        translatedText: "Let's find one small first step.",
        translationGoal: "reduce_friction",
        tone: "gentle",
        feedbackRating: "helpful",
        createdByUserId: "parent-1",
        createdAt: "2026-04-26T12:00:00.000Z",
      },
    ],
    learningEvents: [
      {
        communicationLearningEventId: "learn-1",
        communicationProfileId: "profile-1",
        eventType: "prompt_answered",
        sourceRole: "parent",
        signalJson: { promptKey: "parent_motivation", status: "answered" },
      },
    ],
  });

  assert.equal(analytics.promptStats.parent.answered, 1);
  assert.equal(analytics.promptStats.student.revisitLater, 1);
  assert.equal(analytics.translationStats.feedbackCount, 1);
  assert.equal(analytics.feedbackBreakdown.helpful, 1);
  assert.ok(analytics.topPromptSignals.some((item) => item.promptKey === "parent_motivation"));
});
