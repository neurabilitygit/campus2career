import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import {
  coachEditableProfileReadRoute,
  coachEditableProfileUpsertRoute,
  parentEditableProfileReadRoute,
  parentEditableProfileUpsertRoute,
  studentEditableProfileReadRoute,
  studentEditableProfileUpsertRoute,
} from "../../apps/api/src/routes/profiles";
import {
  parentCommunicationHistoryRoute,
  studentCommunicationMessagesRoute,
} from "../../apps/api/src/routes/communication";
import { coachWorkspaceRoute } from "../../apps/api/src/routes/coach";
import { createAuthedRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";
import {
  makeCoachEditableProfileInput,
  makeParentEditableProfileInput,
  makeStudentEditableProfileInput,
} from "../synthetic/factories";
import { SYNTHETIC_STUDENTS } from "../synthetic/scenarios";

process.env.ALLOW_DEMO_AUTH = "true";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("student profile updates persist and can be read back through the profile API", async () => {
  const updateResponse = createResponse();
  await studentEditableProfileUpsertRoute(
    createAuthedRequest(
      "studentMaya",
      makeStudentEditableProfileInput("studentMaya", {
        fullName: "Maya Jordan Rivera",
        preferredName: "MJ",
        age: 21,
        housingStatus: "Living on campus",
        knownNeurodivergentCategories: ["ADHD", "Prefer not to say"],
        personalChoices: "Prefers internship roles with structured mentorship.",
      }),
      { method: "POST", url: "/students/me/account-profile" }
    ),
    updateResponse.res
  );

  assert.equal(updateResponse.statusCode, 200);

  const readResponse = createResponse();
  await studentEditableProfileReadRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/students/me/account-profile",
    }),
    readResponse.res
  );

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json.profile.fullName, "Maya Jordan Rivera");
  assert.equal(readResponse.json.profile.preferredName, "MJ");
  assert.equal(readResponse.json.profile.age, 21);
  assert.equal(readResponse.json.profile.housingStatus, "Living on campus");
  assert.deepEqual(readResponse.json.profile.knownNeurodivergentCategories, ["ADHD", "Prefer not to say"]);
});

test("parent profile updates persist and student role cannot access the parent profile route", async () => {
  const blockedResponse = createResponse();
  await parentEditableProfileReadRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/parents/me/profile",
    }),
    blockedResponse.res
  );

  assert.equal(blockedResponse.statusCode, 401);

  const updateResponse = createResponse();
  await parentEditableProfileUpsertRoute(
    createAuthedRequest(
      "parentMaya",
      makeParentEditableProfileInput("parentMaya", {
        familyUnitName: "Rivera household",
        relationshipToStudent: "Mother",
        householdMembers: [
          { name: "Elena Rivera", relationship: "Parent" },
          { name: "Maya Rivera", relationship: "Student" },
        ],
        parentGoalsOrConcerns: "Keep support calm while internship activity picks up.",
      }),
      { method: "POST", url: "/parents/me/profile" }
    ),
    updateResponse.res
  );

  assert.equal(updateResponse.statusCode, 200);

  const readResponse = createResponse();
  await parentEditableProfileReadRoute(
    createAuthedRequest("parentMaya", undefined, {
      method: "GET",
      url: "/parents/me/profile",
    }),
    readResponse.res
  );

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json.profile.familyUnitName, "Rivera household");
  assert.equal(readResponse.json.profile.relationshipToStudent, "Mother");
  assert.equal(readResponse.json.profile.householdMembers.length, 2);
  assert.match(readResponse.json.profile.parentGoalsOrConcerns, /internship activity/i);
});

test("coach profile updates persist and can be read back through the profile API", async () => {
  const updateResponse = createResponse();
  await coachEditableProfileUpsertRoute(
    createAuthedRequest(
      "coachTaylor",
      makeCoachEditableProfileInput("coachTaylor", {
        professionalTitle: "Senior Career Coach",
        organizationName: "North Star Advising",
        coachingSpecialties: ["Networking", "Career direction"],
      }),
      { method: "POST", url: "/coaches/me/profile" }
    ),
    updateResponse.res
  );

  assert.equal(updateResponse.statusCode, 200);

  const readResponse = createResponse();
  await coachEditableProfileReadRoute(
    createAuthedRequest("coachTaylor", undefined, {
      method: "GET",
      url: "/coaches/me/profile",
    }),
    readResponse.res
  );

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json.profile.professionalTitle, "Senior Career Coach");
  assert.equal(readResponse.json.profile.organizationName, "North Star Advising");
  assert.deepEqual(readResponse.json.profile.coachingSpecialties, ["Networking", "Career direction"]);
});

test("communication routes enforce role-based access", async () => {
  const studentBlocked = createResponse();
  await parentCommunicationHistoryRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/parents/me/communication-history",
    }),
    studentBlocked.res
  );
  assert.equal(studentBlocked.statusCode, 403);

  const parentBlocked = createResponse();
  await studentCommunicationMessagesRoute(
    createAuthedRequest("parentMaya", undefined, {
      method: "GET",
      url: "/students/me/communication-messages",
    }),
    parentBlocked.res
  );
  assert.equal(parentBlocked.statusCode, 403);
});

test("coach workspace honors selected-student context and returns the selected student name", async () => {
  const mayaResponse = createResponse();
  await coachWorkspaceRoute(
    createAuthedRequest("coachTaylor", undefined, {
      method: "GET",
      url: `/coaches/me/workspace?studentProfileId=${encodeURIComponent(SYNTHETIC_STUDENTS.maya.studentProfileId)}`,
    }),
    mayaResponse.res
  );

  const leoResponse = createResponse();
  await coachWorkspaceRoute(
    createAuthedRequest("coachTaylor", undefined, {
      method: "GET",
      url: `/coaches/me/workspace?studentProfileId=${encodeURIComponent(SYNTHETIC_STUDENTS.leo.studentProfileId)}`,
    }),
    leoResponse.res
  );

  assert.equal(mayaResponse.statusCode, 200);
  assert.equal(leoResponse.statusCode, 200);
  assert.match(mayaResponse.json.workspace.summary.studentDisplayName, /Maya/);
  assert.match(leoResponse.json.workspace.summary.studentDisplayName, /Leo/);
  assert.notEqual(
    mayaResponse.json.workspace.summary.studentDisplayName,
    leoResponse.json.workspace.summary.studentDisplayName
  );
});
