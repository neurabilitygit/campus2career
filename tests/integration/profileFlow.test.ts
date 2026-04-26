import crypto from "node:crypto";
import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool, query } from "../../apps/api/src/db/client";
import {
  coachEditableProfileReadRoute,
  coachEditableProfileUpsertRoute,
  parentEditableProfileReadRoute,
  parentEditableProfileUpsertRoute,
  profileRouteDeps,
  studentEditableProfileReadRoute,
  studentEditableProfileUpsertRoute,
} from "../../apps/api/src/routes/profiles";
import { studentWriteRouteDeps, uploadCompleteRoute } from "../../apps/api/src/routes/studentWrite";
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

function stableId(namespace: string, key: string) {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
}

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

test("student editable profile update rolls back identity changes when the profile write fails", async () => {
  const originalUpdateStudentEditableProfile = profileRouteDeps.repo.updateStudentEditableProfile.bind(
    profileRouteDeps.repo
  );

  profileRouteDeps.repo.updateStudentEditableProfile = async () => {
    throw new Error("SIMULATED_PROFILE_WRITE_FAILURE");
  };

  await assert.rejects(
    () =>
      studentEditableProfileUpsertRoute(
        createAuthedRequest(
          "studentMaya",
          makeStudentEditableProfileInput("studentMaya", {
            fullName: "Maya Transaction Failure",
            preferredName: "Rollback Test",
          }),
          { method: "POST", url: "/students/me/account-profile" }
        ),
        createResponse().res
      ),
    /SIMULATED_PROFILE_WRITE_FAILURE/
  );

  profileRouteDeps.repo.updateStudentEditableProfile = originalUpdateStudentEditableProfile;

  const readResponse = createResponse();
  await studentEditableProfileReadRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/students/me/account-profile",
    }),
    readResponse.res
  );

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json.profile.fullName, "Maya Rivera");
  assert.notEqual(readResponse.json.profile.preferredName, "Rollback Test");
});

test("parent editable profile update rolls back identity changes when the parent profile write fails", async () => {
  const originalUpsertParentEditableProfile = profileRouteDeps.repo.upsertParentEditableProfile.bind(
    profileRouteDeps.repo
  );

  profileRouteDeps.repo.upsertParentEditableProfile = async () => {
    throw new Error("SIMULATED_PARENT_PROFILE_WRITE_FAILURE");
  };

  await assert.rejects(
    () =>
      parentEditableProfileUpsertRoute(
        createAuthedRequest(
          "parentMaya",
          makeParentEditableProfileInput("parentMaya", {
            fullName: "Elena Transaction Failure",
          }),
          { method: "POST", url: "/parents/me/profile" }
        ),
        createResponse().res
      ),
    /SIMULATED_PARENT_PROFILE_WRITE_FAILURE/
  );

  profileRouteDeps.repo.upsertParentEditableProfile = originalUpsertParentEditableProfile;

  const readResponse = createResponse();
  await parentEditableProfileReadRoute(
    createAuthedRequest("parentMaya", undefined, {
      method: "GET",
      url: "/parents/me/profile",
    }),
    readResponse.res
  );

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json.profile.fullName, "Elena Rivera");
});

test("coach editable profile update rolls back identity changes when the coach profile write fails", async () => {
  const originalUpsertCoachEditableProfile = profileRouteDeps.repo.upsertCoachEditableProfile.bind(
    profileRouteDeps.repo
  );

  profileRouteDeps.repo.upsertCoachEditableProfile = async () => {
    throw new Error("SIMULATED_COACH_PROFILE_WRITE_FAILURE");
  };

  await assert.rejects(
    () =>
      coachEditableProfileUpsertRoute(
        createAuthedRequest(
          "coachTaylor",
          makeCoachEditableProfileInput("coachTaylor", {
            fullName: "Taylor Transaction Failure",
          }),
          { method: "POST", url: "/coaches/me/profile" }
        ),
        createResponse().res
      ),
    /SIMULATED_COACH_PROFILE_WRITE_FAILURE/
  );

  profileRouteDeps.repo.upsertCoachEditableProfile = originalUpsertCoachEditableProfile;

  const readResponse = createResponse();
  await coachEditableProfileReadRoute(
    createAuthedRequest("coachTaylor", undefined, {
      method: "GET",
      url: "/coaches/me/profile",
    }),
    readResponse.res
  );

  assert.equal(readResponse.statusCode, 200);
  assert.equal(readResponse.json.profile.fullName, "Taylor Brooks");
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

test("upload completion rolls back artifact intake state when persistence fails mid-transaction", async () => {
  const objectPath = `${SYNTHETIC_STUDENTS.maya.studentProfileId}/resume/transactional-rollback.pdf`;
  const uploadTargetId = stableId("upload_target", `${SYNTHETIC_STUDENTS.maya.studentProfileId}:${objectPath}`);
  const expectedArtifactId = stableId(
    "academic_artifact",
    `${SYNTHETIC_STUDENTS.maya.studentProfileId}:resume:${objectPath}`
  );
  const expectedParseJobId = stableId(
    "artifact_parse_job",
    `${expectedArtifactId}:resume_parser`
  );

  await studentWriteRouteDeps.artifactRepo.upsertUploadTarget({
    uploadTargetId,
    studentProfileId: SYNTHETIC_STUDENTS.maya.studentProfileId,
    artifactType: "resume",
    bucket: "rising-senior",
    objectPath,
    tokenHash: "synthetic-hash",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });

  const originalVerifyStorageObjectExists = studentWriteRouteDeps.verifyStorageObjectExists;
  const originalPersistArtifactAndQueueParse = studentWriteRouteDeps.persistArtifactAndQueueParse;

  studentWriteRouteDeps.verifyStorageObjectExists = async () => true;
  studentWriteRouteDeps.persistArtifactAndQueueParse = async (input, tx) => {
    await studentWriteRouteDeps.artifactRepo.createAcademicArtifact(
      {
        academicArtifactId: expectedArtifactId,
        studentProfileId: input.studentProfileId,
        artifactType: input.artifactType,
        fileUri: input.objectPath,
        sourceLabel: "synthetic_failure_test",
        parsedStatus: "pending",
        parseTruthStatus: "unresolved",
      },
      tx as any
    );
    throw new Error("SIMULATED_PARSE_JOB_FAILURE");
  };

  await assert.rejects(
    () =>
      uploadCompleteRoute(
        createAuthedRequest(
          "studentMaya",
          {
            artifactType: "resume",
            objectPath,
          },
          { method: "POST", url: "/students/me/uploads/complete" }
        ),
        createResponse().res
      ),
    /SIMULATED_PARSE_JOB_FAILURE/
  );

  studentWriteRouteDeps.verifyStorageObjectExists = originalVerifyStorageObjectExists;
  studentWriteRouteDeps.persistArtifactAndQueueParse = originalPersistArtifactAndQueueParse;

  const artifactResult = await query<{ count: string }>(
    `select count(*)::text as count from academic_artifacts where academic_artifact_id = $1`,
    [expectedArtifactId]
  );
  const parseJobResult = await query<{ count: string }>(
    `select count(*)::text as count from artifact_parse_jobs where artifact_parse_job_id = $1`,
    [expectedParseJobId]
  );
  const uploadTargetResult = await query<{ consumed_at: string | null }>(
    `select consumed_at::text from upload_targets where upload_target_id = $1`,
    [uploadTargetId]
  );

  assert.equal(artifactResult.rows[0]?.count, "0");
  assert.equal(parseJobResult.rows[0]?.count, "0");
  assert.equal(uploadTargetResult.rows[0]?.consumed_at ?? null, null);
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
