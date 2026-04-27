import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool, query } from "../../apps/api/src/db/client";
import { AuthUserRepository } from "../../apps/api/src/repositories/auth/authUserRepository";
import { resolveRequestContext } from "../../apps/api/src/services/auth/resolveRequestContext";
import { createAuthedRequest, createJsonRequest } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";
import { SYNTHETIC_STUDENTS, SYNTHETIC_USERS } from "../synthetic/scenarios";

process.env.ALLOW_DEMO_AUTH = "true";
process.env.ALLOW_TEST_CONTEXT_SWITCHING = "true";
process.env.TEST_SUPERUSER_EMAILS = "eric.bassman@gmail.com";
process.env.TEST_DEFAULT_PREVIEW_STUDENT_PROFILE_ID = SYNTHETIC_STUDENTS.maya.studentProfileId;

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

test("resolveRequestContext maps Eric student preview into a real seeded student context", async () => {
  const ctx = await resolveRequestContext(
    createAuthedRequest("adminEric", undefined, {
      method: "GET",
      url: "/auth/me",
      headers: {
        "x-test-context-role": "student",
      },
    })
  );

  assert.equal(ctx.authenticatedRoleType, "student");
  assert.ok(ctx.studentProfileId);
  assert.ok(ctx.householdId);
  assert.ok(ctx.studentUserId);
  assert.notEqual(ctx.studentUserId, "99999999-9999-4999-8999-999999999999");
  assert.ok(ctx.studentFirstName);
  assert.notEqual(ctx.studentFirstName, "Eric");
  assert.ok((ctx.testContextPreviewStudents || []).length >= 2);
});

test("resolveRequestContext prefers an explicit preview studentProfileId over the configured default", async () => {
  const ctx = await resolveRequestContext(
    createAuthedRequest("adminEric", undefined, {
      method: "GET",
      url: `/auth/me?studentProfileId=${encodeURIComponent(SYNTHETIC_STUDENTS.leo.studentProfileId)}`,
      headers: {
        "x-test-context-role": "parent",
      },
    })
  );

  assert.equal(ctx.authenticatedRoleType, "parent");
  assert.equal(ctx.studentProfileId, SYNTHETIC_STUDENTS.leo.studentProfileId);
  assert.equal(ctx.studentUserId, SYNTHETIC_USERS.studentLeo.userId);
  assert.equal(ctx.studentFirstName, "Leo");
});

test("auth user sync does not grant super-admin based on matching display names alone", async () => {
  const repo = new AuthUserRepository();
  const userId = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

  try {
    await repo.upsertUserFromAuth({
      userId,
      email: "ordinary.user@example.com",
      firstName: "Eric",
      lastName: "Bass",
      preferredName: "Eric",
      roleType: "student",
    });

    const result = await query<{ role_type: string; is_super_admin: boolean }>(
      `
      select role_type, is_super_admin
      from users
      where user_id = $1
      `,
      [userId]
    );

    assert.equal(result.rows[0]?.role_type, "student");
    assert.equal(result.rows[0]?.is_super_admin, false);
  } finally {
    await query(`delete from users where user_id = $1`, [userId]);
  }
});

test("resolveRequestContext does not create a student profile during read-only auth lookup", async () => {
  const repo = new AuthUserRepository();
  const userId = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";

  try {
    await repo.upsertUserFromAuth({
      userId,
      email: "student.without.profile@example.com",
      firstName: "Casey",
      lastName: "Nguyen",
      preferredName: "Casey",
      roleType: "student",
    });

    const before = await query<{ count: string }>(
      `select count(*)::text as count from student_profiles where user_id = $1`,
      [userId]
    );
    assert.equal(before.rows[0]?.count, "0");

    const ctx = await resolveRequestContext(
      createJsonRequest(undefined, {
        method: "GET",
        url: "/auth/me",
        headers: {
          "x-demo-user-id": userId,
          "x-demo-role-type": "student",
          "x-demo-email": "student.without.profile@example.com",
        },
      })
    );

    assert.equal(ctx.authenticatedRoleType, "student");
    assert.equal(ctx.studentProfileId, null);
    assert.equal(ctx.studentUserId, userId);

    const after = await query<{ count: string }>(
      `select count(*)::text as count from student_profiles where user_id = $1`,
      [userId]
    );
    assert.equal(after.rows[0]?.count, "0");
  } finally {
    await query(`delete from users where user_id = $1`, [userId]);
  }
});
