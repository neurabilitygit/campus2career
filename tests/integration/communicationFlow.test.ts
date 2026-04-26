import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import { router } from "../../apps/api/src/server";
import { householdPermissionUpdateRoute } from "../../apps/api/src/routes/householdAdmin";
import { createAuthedRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";

process.env.ALLOW_DEMO_AUTH = "true";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("parent can save a communication insight and see it in the shared communication profile", async () => {
  const saveResponse = createResponse();
  await router(
    createAuthedRequest(
      "parentMaya",
      {
        promptKey: "parent_motivation",
        category: "parent_motivation",
        questionText: "What are you most hoping this system helps your child achieve?",
        responseText: "I want college planning and career launch conversations to feel calmer.",
        visibilityScope: "shared_summary_only",
        sensitivityLevel: "medium",
        confidenceLevel: "user_reported",
      },
      { method: "POST", url: "/communication/parent-inputs" }
    ),
    saveResponse.res
  );

  assert.equal(saveResponse.statusCode, 200);

  const profileResponse = createResponse();
  await router(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/communication/profile" }),
    profileResponse.res
  );

  assert.equal(profileResponse.statusCode, 200);
  assert.ok(
    profileResponse.json.parentInputs.some(
      (item: { promptKey: string; responseText: string }) =>
        item.promptKey === "parent_motivation" &&
        /career launch conversations/i.test(item.responseText)
    )
  );
});

test("saved communication inputs can be updated and deleted explicitly", async () => {
  const saveResponse = createResponse();
  await router(
    createAuthedRequest(
      "studentLeo",
      {
        promptKey: "student_useful_system",
        category: "goals_in_own_words",
        questionText: "What would make this system feel useful instead of annoying?",
        responseText: "Keep it short and practical.",
        visibilityScope: "shared_summary_only",
        sensitivityLevel: "medium",
      },
      { method: "POST", url: "/communication/student-inputs" }
    ),
    saveResponse.res
  );
  assert.equal(saveResponse.statusCode, 200);

  const updateResponse = createResponse();
  await router(
    createAuthedRequest(
      "studentLeo",
      {
        promptKey: "student_useful_system",
        category: "goals_in_own_words",
        questionText: "What would make this system feel useful instead of annoying?",
        responseText: "Keep it short, practical, and tied to one next step.",
        visibilityScope: "shared_summary_only",
        sensitivityLevel: "medium",
      },
      {
        method: "PATCH",
        url: `/communication/student-inputs/${saveResponse.json.input.studentCommunicationInputId}`,
      }
    ),
    updateResponse.res
  );
  assert.equal(updateResponse.statusCode, 200);

  const profileResponse = createResponse();
  await router(
    createAuthedRequest("studentLeo", undefined, { method: "GET", url: "/communication/profile" }),
    profileResponse.res
  );
  assert.equal(profileResponse.statusCode, 200);
  assert.ok(
    profileResponse.json.studentInputs.some(
      (item: { responseText: string }) => /one next step/i.test(item.responseText)
    )
  );

  const deleteResponse = createResponse();
  await router(
    createAuthedRequest("studentLeo", undefined, {
      method: "DELETE",
      url: `/communication/student-inputs/${saveResponse.json.input.studentCommunicationInputId}`,
    }),
    deleteResponse.res
  );
  assert.equal(deleteResponse.statusCode, 200);

  const afterDeleteProfile = createResponse();
  await router(
    createAuthedRequest("studentLeo", undefined, { method: "GET", url: "/communication/profile" }),
    afterDeleteProfile.res
  );
  assert.equal(
    afterDeleteProfile.json.studentInputs.some(
      (item: { promptKey: string }) => item.promptKey === "student_useful_system"
    ),
    false
  );
});

test("student private communication input does not appear in parent-visible communication profile data", async () => {
  const saveResponse = createResponse();
  await router(
    createAuthedRequest(
      "studentLeo",
      {
        promptKey: "student_parent_misunderstanding",
        category: "parent_communication_friction",
        questionText: "What do adults sometimes misunderstand about you?",
        responseText: "They think I am avoiding things when I am actually overwhelmed.",
        visibilityScope: "private_to_user",
        sensitivityLevel: "high",
      },
      { method: "POST", url: "/communication/student-inputs" }
    ),
    saveResponse.res
  );

  assert.equal(saveResponse.statusCode, 200);

  const parentProfileResponse = createResponse();
  await router(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/communication/profile" }),
    parentProfileResponse.res
  );

  assert.equal(parentProfileResponse.statusCode, 200);
  assert.equal(
    parentProfileResponse.json.studentInputs.some(
      (item: { promptKey: string }) => item.promptKey === "student_parent_misunderstanding"
    ),
    false
  );
});

test("translation events and feedback persist through the shared communication endpoints", async () => {
  const translateResponse = createResponse();
  await router(
    createAuthedRequest(
      "studentLeo",
      {
        sourceRole: "student",
        targetRole: "parent",
        originalText: "I want help, but long messages and pressure make it harder to respond.",
        translationGoal: "clarify",
        tone: "gentle",
      },
      { method: "POST", url: "/communication/translate" }
    ),
    translateResponse.res
  );

  assert.equal(translateResponse.statusCode, 200);
  assert.ok(translateResponse.json.communicationTranslationEventId);
  assert.ok(translateResponse.json.output.rewrittenMessage);

  const feedbackResponse = createResponse();
  await router(
    createAuthedRequest(
      "studentLeo",
      {
        communicationTranslationEventId: translateResponse.json.communicationTranslationEventId,
        feedbackRating: "helpful",
      },
      { method: "POST", url: "/communication/feedback" }
    ),
    feedbackResponse.res
  );

  assert.equal(feedbackResponse.statusCode, 200);

  const profileResponse = createResponse();
  await router(
    createAuthedRequest("studentLeo", undefined, { method: "GET", url: "/communication/profile" }),
    profileResponse.res
  );

  assert.equal(profileResponse.statusCode, 200);
  assert.ok(
    profileResponse.json.translationEvents.some(
      (item: { communicationTranslationEventId: string; feedbackRating?: string | null }) =>
        item.communicationTranslationEventId === translateResponse.json.communicationTranslationEventId &&
        item.feedbackRating === "helpful"
    )
  );
});

test("coach summary route returns limited communication context for the selected student", async () => {
  const response = createResponse();
  await router(
    createAuthedRequest("coachTaylor", undefined, {
      method: "GET",
      url: "/communication/summary?studentProfileId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.ok(response.json.summary);
  assert.ok(Array.isArray(response.json.summary.coachSuggestions));
  assert.ok(Array.isArray(response.json.inferredInsights));
  assert.ok(response.json.analytics);
});

test("parent can review inferred communication patterns from the shared summary", async () => {
  const saveResponse = createResponse();
  await router(
    createAuthedRequest(
      "parentMaya",
      {
        promptKey: "helpful_reminders_parent",
        category: "communication_style",
        questionText: "What kinds of reminders tend to help?",
        responseText: "Short reminders with one next step help most.",
        visibilityScope: "shared_summary_only",
        sensitivityLevel: "low",
        confidenceLevel: "user_reported",
      },
      { method: "POST", url: "/communication/parent-inputs" }
    ),
    saveResponse.res
  );
  assert.equal(saveResponse.statusCode, 200);

  const summaryResponse = createResponse();
  await router(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/communication/summary" }),
    summaryResponse.res
  );
  assert.equal(summaryResponse.statusCode, 200);
  const insight = summaryResponse.json.inferredInsights.find(
    (item: { insightKey: string }) => item.insightKey === "reminder-pattern"
  );
  assert.ok(insight);

  const reviewResponse = createResponse();
  await router(
    createAuthedRequest(
      "parentMaya",
      { status: "confirmed" },
      {
        method: "POST",
        url: `/communication/insights/${insight.communicationInferredInsightId}/review`,
      }
    ),
    reviewResponse.res
  );
  assert.equal(reviewResponse.statusCode, 200);

  const afterReview = createResponse();
  await router(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/communication/summary" }),
    afterReview.res
  );
  const reviewed = afterReview.json.inferredInsights.find(
    (item: { communicationInferredInsightId: string }) =>
      item.communicationInferredInsightId === insight.communicationInferredInsightId
  );
  assert.equal(reviewed.status, "confirmed");
});

test("denied communication capability blocks the shared communication route at the API layer", async () => {
  const permissionResponse = createResponse();
  await householdPermissionUpdateRoute(
    createAuthedRequest(
      "parentMaya",
      {
        userId: "11111111-1111-4111-8111-222222222222",
        persona: "parent",
        grants: [],
        denies: ["view_communication"],
      },
      { method: "POST", url: "/households/me/permissions" }
    ),
    permissionResponse.res
  );

  assert.equal(permissionResponse.statusCode, 200);

  const blocked = createResponse();
  await router(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/communication/profile" }),
    blocked.res
  );

  assert.equal(blocked.statusCode, 403);
});
