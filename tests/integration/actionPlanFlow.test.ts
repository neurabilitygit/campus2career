import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool, query } from "../../apps/api/src/db/client";
import { studentActionPlanRoute, studentActionPlanSaveRoute } from "../../apps/api/src/routes/actionPlan";
import { createAuthedRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";
import { SYNTHETIC_STUDENTS } from "../synthetic/scenarios";

process.env.ALLOW_DEMO_AUTH = "true";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("student can persist action-plan choices from current next-step recommendations and parent can read them", async () => {
  const initial = createResponse();
  await studentActionPlanRoute(
    createAuthedRequest("studentLeo", undefined, {
      method: "GET",
      url: "/students/me/action-plan",
    }),
    initial.res
  );

  assert.equal(initial.statusCode, 200);
  const chosenOption = initial.json.plan.options[0];
  assert.ok(chosenOption);
  const chosenTitle = chosenOption.title as string;

  const save = createResponse();
  await studentActionPlanSaveRoute(
    createAuthedRequest(
      "studentLeo",
      {
        title: chosenTitle,
        decision: "explore",
        planningNotes: "Identify one workflow from class or work that could be improved with AI, then document the before-and-after process.",
        nextStepDate: "2026-05-15",
        actionCategory: chosenOption.actionCategory,
        priorityLevel: chosenOption.priorityLevel,
      },
      { method: "POST", url: "/students/me/action-plan" }
    ),
    save.res
  );

  assert.equal(save.statusCode, 200);
  assert.equal(save.json.plan.summary.exploredCount >= 1, true);

  const parentRead = createResponse();
  await studentActionPlanRoute(
    createAuthedRequest("parentLeo", undefined, {
      method: "GET",
      url: "/students/me/action-plan",
    }),
    parentRead.res
  );

  assert.equal(parentRead.statusCode, 200);
  const savedOption = parentRead.json.plan.options.find(
    (item: { title: string }) => item.title === chosenTitle
  );
  assert.ok(savedOption);
  assert.equal(savedOption.decision, "explore");
  assert.equal(savedOption.nextStepDate, "2026-05-15");
  assert.match(savedOption.planningNotes, /workflow/i);
  assert.equal(parentRead.json.plan.summary.primaryTitle, chosenTitle);

  const persistedCount = await query<{ count: string }>(
    `
    select count(*)::text as count
    from action_items ai
    join action_plans ap on ap.action_plan_id = ai.action_plan_id
    where ap.student_profile_id = $1
      and ai.title = $2
    `,
    [SYNTHETIC_STUDENTS.leo.studentProfileId, chosenTitle]
  );
  assert.equal(persistedCount.rows[0].count, "1");
});

test("explore and accept decisions require a next-step date", async () => {
  const response = createResponse();
  await studentActionPlanSaveRoute(
    createAuthedRequest(
      "studentLeo",
      {
        title: "Run three informational interviews with a structured question set",
        decision: "accept",
        planningNotes: "Draft the question set first.",
      },
      { method: "POST", url: "/students/me/action-plan" }
    ),
    response.res
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.json.message, /next-step date/i);
});
