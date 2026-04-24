import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import {
  studentOutcomesCreateRoute,
  studentOutcomesListRoute,
  studentOutcomesSummaryRoute,
} from "../../apps/api/src/routes/outcomes";
import { createAuthedRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";
import { getSyntheticStudent } from "../synthetic/scenarios";

process.env.ALLOW_DEMO_AUTH = "true";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("student outcome creation persists and appears in timeline order and summary counts", async () => {
  const student = getSyntheticStudent("maya");

  const createResult = createResponse();
  await studentOutcomesCreateRoute(
    createAuthedRequest(
      "studentMaya",
      {
        outcomeType: "offer",
        status: "offer",
        employerName: "Brightpath Capital",
        roleTitle: "Strategy Intern",
        actionDate: "2026-04-22",
        notes: "Offer received after the final round.",
      },
      { method: "POST", url: "/students/me/outcomes" }
    ),
    createResult.res
  );

  assert.equal(createResult.statusCode, 200);

  const listResponse = createResponse();
  await studentOutcomesListRoute(
    createAuthedRequest("studentMaya", undefined, { method: "GET", url: "/students/me/outcomes" }),
    listResponse.res
  );

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json.count, 3);
  assert.equal(listResponse.json.outcomes[0].employerName, "Brightpath Capital");
  assert.equal(listResponse.json.outcomes[0].status, "offer");

  const summaryResponse = createResponse();
  await studentOutcomesSummaryRoute(
    createAuthedRequest("studentMaya", undefined, { method: "GET", url: "/students/me/outcomes/summary" }),
    summaryResponse.res
  );

  assert.equal(summaryResponse.statusCode, 200);
  assert.equal(summaryResponse.json.summary.totalActive, 3);
  assert.equal(summaryResponse.json.summary.countsByType.offer, 1);
  assert.match(summaryResponse.json.summary.latestActionDate, /^2026-04-22/);
  assert.equal(summaryResponse.json.summary.countsByVerification.self_reported, 3);
});
