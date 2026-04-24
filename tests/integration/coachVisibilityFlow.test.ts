import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import { CoachRepository } from "../../apps/api/src/repositories/coach/coachRepository";
import {
  coachActionItemCreateRoute,
  coachNoteCreateRoute,
  coachOutboundDraftSaveRoute,
  coachOutboundSendMockRoute,
  coachRecommendationCreateRoute,
  studentCoachFeedRoute,
} from "../../apps/api/src/routes/coach";
import { getVisibleCoachFeed } from "../../apps/api/src/services/coach/workspace";
import { createAuthedRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";
import { getSyntheticStudent } from "../synthetic/scenarios";

process.env.ALLOW_DEMO_AUTH = "true";

const coachRepo = new CoachRepository();

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("coach-created recommendation and action item become visible in student and parent feeds while private notes stay hidden", async () => {
  const student = getSyntheticStudent("maya");

  const noteResponse = createResponse();
  await coachNoteCreateRoute(
    createAuthedRequest(
      "coachTaylor",
      {
        studentProfileId: student.studentProfileId,
        noteType: "session_note",
        title: "Private session prep",
        body: "Keep this note private to the coach workspace.",
        visibility: "coach_private",
      },
      { method: "POST", url: "/coaches/me/notes" }
    ),
    noteResponse.res
  );
  assert.equal(noteResponse.statusCode, 200);

  const recommendationResponse = createResponse();
  await coachRecommendationCreateRoute(
    createAuthedRequest(
      "coachTaylor",
      {
        studentProfileId: student.studentProfileId,
        title: "Practice a concise networking script",
        recommendationCategory: "networking",
        rationale: "The student needs a cleaner outreach opening line.",
        recommendedNextStep: "Write and rehearse a 4-sentence intro message tonight.",
        priority: "high",
        visibility: "student_and_parent_visible",
        status: "active",
      },
      { method: "POST", url: "/coaches/me/recommendations" }
    ),
    recommendationResponse.res
  );
  assert.equal(recommendationResponse.statusCode, 200);

  const actionItemResponse = createResponse();
  await coachActionItemCreateRoute(
    createAuthedRequest(
      "coachTaylor",
      {
        studentProfileId: student.studentProfileId,
        title: "Send the revised outreach script",
        description: "Share the revised version with the coach after rehearsing.",
        priority: "medium",
        assignedTo: "student",
        visibleToStudent: true,
        visibleToParent: true,
        status: "not_started",
      },
      { method: "POST", url: "/coaches/me/action-items" }
    ),
    actionItemResponse.res
  );
  assert.equal(actionItemResponse.statusCode, 200);

  const studentFeed = createResponse();
  await studentCoachFeedRoute(
    createAuthedRequest("studentMaya", undefined, { method: "GET", url: "/students/me/coach-feed" }),
    studentFeed.res
  );

  assert.equal(studentFeed.statusCode, 200);
  assert.ok(
    studentFeed.json.feed.recommendations.some(
      (item: { title: string }) => item.title === "Practice a concise networking script"
    )
  );
  assert.ok(
    studentFeed.json.feed.actionItems.some(
      (item: { title: string }) => item.title === "Send the revised outreach script"
    )
  );
  assert.equal(
    studentFeed.json.feed.notes.some((item: { title: string }) => item.title === "Private session prep"),
    false
  );

  const parentFeed = await getVisibleCoachFeed(student.studentProfileId, "parent");
  assert.ok(
    parentFeed.recommendations.some(
      (item: { title: string }) => item.title === "Practice a concise networking script"
    )
  );
  assert.ok(
    parentFeed.actionItems.some(
      (item: { title: string }) => item.title === "Send the revised outreach script"
    )
  );
  assert.equal(
    parentFeed.notes.some((item: { title: string }) => item.title === "Private session prep"),
    false
  );
});

test("coach outbound messages can be saved as drafts and mock-sent without real delivery", async () => {
  const student = getSyntheticStudent("maya");

  const draftResponse = createResponse();
  await coachOutboundDraftSaveRoute(
    createAuthedRequest(
      "coachTaylor",
      {
        studentProfileId: student.studentProfileId,
        recipientType: "student",
        channel: "email",
        subject: "Synthetic follow-up",
        body: "Please send the revised resume draft before tomorrow.",
        status: "ready",
      },
      { method: "POST", url: "/coaches/me/outbound-messages/draft" }
    ),
    draftResponse.res
  );

  assert.equal(draftResponse.statusCode, 200);
  assert.equal(draftResponse.json.message, "Coach message marked ready");

  const drafts = await coachRepo.listOutboundMessagesForCoachStudent(
    "33333333-3333-4333-8333-111111111111",
    student.studentProfileId
  );
  const createdDraft = drafts.find((item) => item.subject === "Synthetic follow-up");
  assert.ok(createdDraft);
  assert.equal(createdDraft?.status, "ready");

  const sendResponse = createResponse();
  await coachOutboundSendMockRoute(
    createAuthedRequest(
      "coachTaylor",
      {
        studentProfileId: student.studentProfileId,
        coachOutboundMessageId: createdDraft?.coachOutboundMessageId,
      },
      { method: "POST", url: "/coaches/me/outbound-messages/send-mock" }
    ),
    sendResponse.res
  );

  assert.equal(sendResponse.statusCode, 200);
  assert.equal(sendResponse.json.status, "sent");
  assert.equal(sendResponse.json.providerMode, "mock");
});
