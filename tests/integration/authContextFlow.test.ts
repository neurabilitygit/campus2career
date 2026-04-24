import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import { resolveRequestContext } from "../../apps/api/src/services/auth/resolveRequestContext";
import { createAuthedRequest } from "../fixtures/http";
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

test("resolveRequestContext maps demo-auth student, parent, and coach requests into the correct scoped context", async () => {
  const studentCtx = await resolveRequestContext(
    createAuthedRequest("studentMaya", undefined, { method: "GET", url: "/auth/me" })
  );
  const parentCtx = await resolveRequestContext(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/auth/me" })
  );
  const coachCtx = await resolveRequestContext(
    createAuthedRequest("coachTaylor", undefined, { method: "GET", url: "/auth/me" })
  );

  assert.equal(studentCtx.authenticatedRoleType, "student");
  assert.equal(studentCtx.studentProfileId, SYNTHETIC_STUDENTS.maya.studentProfileId);

  assert.equal(parentCtx.authenticatedRoleType, "parent");

  assert.equal(coachCtx.authenticatedRoleType, "coach");
});
