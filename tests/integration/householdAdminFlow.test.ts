import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import { permissionRepository } from "../../apps/api/src/repositories/auth/permissionRepository";
import {
  householdAdminOverviewRoute,
  householdInvitationCreateRoute,
  householdJoinRequestApproveRoute,
  householdPermissionUpdateRoute,
  invitationAcceptRoute,
  invitationPreviewRoute,
  signupCreateHouseholdRoute,
  signupDecisionRoute,
  signupRequestHouseholdAccessRoute,
  superAdminUserDirectoryRoute,
} from "../../apps/api/src/routes/householdAdmin";
import { authMeRoute } from "../../apps/api/src/routes/auth";
import { router } from "../../apps/api/src/server";
import { householdAdminRepository } from "../../apps/api/src/repositories/households/householdAdminRepository";
import { createAuthedRequest, createJsonRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";

process.env.ALLOW_DEMO_AUTH = "true";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("Eric Bass resolves as super admin without duplicate-role ambiguity", async () => {
  const response = createResponse();
  await authMeRoute(
    createAuthedRequest("adminEric", undefined, { method: "GET", url: "/auth/me" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.context.authenticatedRoleType, "admin");
  assert.equal(response.json.context.isSuperAdmin, true);
  assert.ok(response.json.context.effectiveCapabilities.includes("access_admin_console"));
});

test("Eric Bass auth context falls back safely when sync-backed role resolution fails", async (t) => {
  const originalGetUserAccount = permissionRepository.getUserAccount.bind(permissionRepository);
  permissionRepository.getUserAccount = async (userId, executor) => {
    if (userId === "99999999-9999-4999-8999-999999999999") {
      return null;
    }
    return originalGetUserAccount(userId, executor);
  };
  t.after(() => {
    permissionRepository.getUserAccount = originalGetUserAccount;
  });

  const response = createResponse();
  await authMeRoute(
    createAuthedRequest("adminEric", undefined, { method: "GET", url: "/auth/me" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.context.authenticatedRoleType, "admin");
  assert.equal(response.json.context.isSuperAdmin, true);
  assert.ok(response.json.context.effectiveCapabilities.includes("access_admin_console"));
  assert.deepEqual(response.json.context.testContextAllowedRoles, ["student", "parent", "coach"]);
});

test("Eric Bass fallback still resolves super admin context even if upstream auth role is not admin", async (t) => {
  const originalGetUserAccount = permissionRepository.getUserAccount.bind(permissionRepository);
  permissionRepository.getUserAccount = async (userId, executor) => {
    if (userId === "99999999-9999-4999-8999-999999999999") {
      return null;
    }
    return originalGetUserAccount(userId, executor);
  };
  t.after(() => {
    permissionRepository.getUserAccount = originalGetUserAccount;
  });

  const response = createResponse();
  await authMeRoute(
    createJsonRequest(undefined, {
      method: "GET",
      url: "/auth/me",
      headers: {
        "x-demo-user-id": "99999999-9999-4999-8999-999999999999",
        "x-demo-role-type": "student",
        "x-demo-email": "eric.bassman@gmail.com",
      },
    }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.context.authenticatedRoleType, "admin");
  assert.equal(response.json.context.isSuperAdmin, true);
});

test("Eric Bass parent preview resolves a usable student and household context", async () => {
  const response = createResponse();
  await authMeRoute(
    createJsonRequest(undefined, {
      method: "GET",
      url: "/auth/me",
      headers: {
        "x-demo-user-id": "99999999-9999-4999-8999-999999999999",
        "x-demo-role-type": "admin",
        "x-demo-email": "eric.bassman@gmail.com",
        "x-test-context-role": "parent",
      },
    }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.context.authenticatedRoleType, "parent");
  assert.ok(response.json.context.householdId);
  assert.ok(response.json.context.studentProfileId);
  assert.ok(response.json.context.studentUserId);
});

test("parent first subscriber can create a household through the signup flow", async () => {
  const createResponseRecord = createResponse();
  await signupCreateHouseholdRoute(
    createAuthedRequest(
      "parentAvery",
      { persona: "parent", householdName: "Stone household" },
      { method: "POST", url: "/auth/signup/create-household" }
    ),
    createResponseRecord.res
  );

  assert.equal(createResponseRecord.statusCode, 200);

  const decisionResponse = createResponse();
  await signupDecisionRoute(
    createAuthedRequest("parentAvery", undefined, { method: "GET", url: "/auth/signup/decision" }),
    decisionResponse.res
  );

  assert.equal(decisionResponse.statusCode, 200);
  assert.equal(decisionResponse.json.decision.state, "ready");
  assert.equal(decisionResponse.json.decision.role, "parent");
});

test("student signup cannot create a household and is routed into household access requests instead", async () => {
  const blocked = createResponse();
  await signupCreateHouseholdRoute(
    createAuthedRequest(
      "studentNova",
      { persona: "student", householdName: "Nova household" },
      { method: "POST", url: "/auth/signup/create-household" }
    ),
    blocked.res
  );

  assert.equal(blocked.statusCode, 400);

  const requestResponse = createResponse();
  await signupRequestHouseholdAccessRoute(
    createAuthedRequest(
      "studentNova",
      {
        requestedPersona: "student",
        parentEmail: "elena.rivera@synthetic.rising-senior.local",
        requestMessage: "I belong with the Rivera household.",
      },
      { method: "POST", url: "/auth/signup/request-household-access" }
    ),
    requestResponse.res
  );

  assert.equal(requestResponse.statusCode, 200);
});

test("signup decision falls back to a safe manual path when join-request lookup fails", async (t) => {
  const original = householdAdminRepository.getPendingJoinRequestForUser.bind(householdAdminRepository);
  householdAdminRepository.getPendingJoinRequestForUser = async () => {
    throw new Error("synthetic lookup failure");
  };
  t.after(() => {
    householdAdminRepository.getPendingJoinRequestForUser = original;
  });

  const response = createResponse();
  await signupDecisionRoute(
    createAuthedRequest("studentNova", undefined, { method: "GET", url: "/auth/signup/decision" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.decision.state, "needs_household_request");
  assert.equal(response.json.decision.role, "student");
});

test("signup decision falls back to a safe manual path when auth context resolution fails before service lookup", async (t) => {
  const originalGetUserAccount = permissionRepository.getUserAccount.bind(permissionRepository);
  permissionRepository.getUserAccount = async () => null;
  t.after(() => {
    permissionRepository.getUserAccount = originalGetUserAccount;
  });

  const response = createResponse();
  await signupDecisionRoute(
    createAuthedRequest("studentNova", undefined, { method: "GET", url: "/auth/signup/decision" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.decision.state, "needs_household_request");
  assert.equal(response.json.decision.role, "student");
});

test("super admin household administration overview falls back safely when auth context resolution fails", async (t) => {
  const originalGetUserAccount = permissionRepository.getUserAccount.bind(permissionRepository);
  permissionRepository.getUserAccount = async (userId, executor) => {
    if (userId === "99999999-9999-4999-8999-999999999999") {
      return null;
    }
    return originalGetUserAccount(userId, executor);
  };
  t.after(() => {
    permissionRepository.getUserAccount = originalGetUserAccount;
  });

  const response = createResponse();
  await householdAdminOverviewRoute(
    createAuthedRequest("adminEric", undefined, { method: "GET", url: "/households/me/admin" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.overview.canManageHousehold, true);
  assert.equal(response.json.overview.canManagePermissions, true);
  assert.ok(Array.isArray(response.json.overview.members));
});

test("router-level admin authorization fallback still allows Eric to reach household administration", async (t) => {
  const originalGetUserAccount = permissionRepository.getUserAccount.bind(permissionRepository);
  permissionRepository.getUserAccount = async (userId, executor) => {
    if (userId === "99999999-9999-4999-8999-999999999999") {
      return null;
    }
    return originalGetUserAccount(userId, executor);
  };
  t.after(() => {
    permissionRepository.getUserAccount = originalGetUserAccount;
  });

  const response = createResponse();
  await router(
    createAuthedRequest("adminEric", undefined, { method: "GET", url: "/households/me/admin" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.overview.canManageHousehold, true);
  assert.equal(response.json.overview.canManagePermissions, true);
});

test("router-level admin authorization fallback still allows Eric through generic sync-time failures", async (t) => {
  const originalEnsureCatalog = permissionRepository.ensureCapabilityCatalogSynced.bind(permissionRepository);
  permissionRepository.ensureCapabilityCatalogSynced = async () => {
    throw new Error("synthetic sync failure");
  };
  t.after(() => {
    permissionRepository.ensureCapabilityCatalogSynced = originalEnsureCatalog;
  });

  const response = createResponse();
  await router(
    createAuthedRequest("adminEric", undefined, { method: "GET", url: "/households/me/admin" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.overview.canManageHousehold, true);
  assert.equal(response.json.overview.canManagePermissions, true);
});

test("super admin directory falls back safely when auth context resolution fails", async (t) => {
  const originalGetUserAccount = permissionRepository.getUserAccount.bind(permissionRepository);
  permissionRepository.getUserAccount = async (userId, executor) => {
    if (userId === "99999999-9999-4999-8999-999999999999") {
      return null;
    }
    return originalGetUserAccount(userId, executor);
  };
  t.after(() => {
    permissionRepository.getUserAccount = originalGetUserAccount;
  });

  const response = createResponse();
  await superAdminUserDirectoryRoute(
    createAuthedRequest("adminEric", undefined, { method: "GET", url: "/admin/users" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json.users));
  assert.ok(response.json.users.some((user: { email?: string | null }) => user.email === "eric.bassman@gmail.com"));
});

test("router-level admin authorization fallback still allows Eric through generic sync-time failures for the directory", async (t) => {
  const originalEnsureCatalog = permissionRepository.ensureCapabilityCatalogSynced.bind(permissionRepository);
  permissionRepository.ensureCapabilityCatalogSynced = async () => {
    throw new Error("synthetic sync failure");
  };
  t.after(() => {
    permissionRepository.ensureCapabilityCatalogSynced = originalEnsureCatalog;
  });

  const response = createResponse();
  await router(
    createAuthedRequest("adminEric", undefined, { method: "GET", url: "/admin/users" }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.ok(Array.isArray(response.json.users));
  assert.ok(response.json.users.some((user: { email?: string | null }) => user.email === "eric.bassman@gmail.com"));
});

test("parent can approve a student join request and the student becomes household-active", async () => {
  await signupRequestHouseholdAccessRoute(
    createAuthedRequest(
      "studentNova",
      {
        requestedPersona: "student",
        parentEmail: "elena.rivera@synthetic.rising-senior.local",
      },
      { method: "POST", url: "/auth/signup/request-household-access" }
    ),
    createResponse().res
  );

  const overviewBefore = createResponse();
  await householdAdminOverviewRoute(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/households/me/admin" }),
    overviewBefore.res
  );
  assert.equal(overviewBefore.statusCode, 200);
  const joinRequestId = overviewBefore.json.overview.joinRequests[0].householdJoinRequestId;

  const approveResponse = createResponse();
  await householdJoinRequestApproveRoute(
    createAuthedRequest(
      "parentMaya",
      { householdJoinRequestId: joinRequestId },
      { method: "POST", url: "/households/me/join-requests/approve" }
    ),
    approveResponse.res
  );
  assert.equal(approveResponse.statusCode, 200);

  const decisionResponse = createResponse();
  await signupDecisionRoute(
    createAuthedRequest("studentNova", undefined, { method: "GET", url: "/auth/signup/decision" }),
    decisionResponse.res
  );
  assert.equal(decisionResponse.json.decision.state, "ready");
});

test("parent invites coach and the invited coach can preview and accept the invitation", async () => {
  const inviteResponse = createResponse();
  await householdInvitationCreateRoute(
    createAuthedRequest(
      "parentMaya",
      {
        invitedEmail: "robin.kline@synthetic.rising-senior.local",
        invitedPersona: "coach",
      },
      { method: "POST", url: "/households/me/invitations" }
    ),
    inviteResponse.res
  );
  assert.equal(inviteResponse.statusCode, 200);
  assert.equal(inviteResponse.json.invitation.deliveryProvider, "development_log");
  const inviteLink = inviteResponse.json.invitation.inviteLinkPreview as string;
  const token = new URL(inviteLink).searchParams.get("invite");
  assert.ok(token);

  const previewResponse = createResponse();
  await invitationPreviewRoute(
    createJsonRequest(undefined, {
      method: "GET",
      url: `/auth/invitations/preview?token=${encodeURIComponent(token!)}`,
    }),
    previewResponse.res
  );
  assert.equal(previewResponse.statusCode, 200);
  assert.equal(previewResponse.json.invitation.invitedPersona, "coach");

  const acceptResponse = createResponse();
  await invitationAcceptRoute(
    createAuthedRequest("coachRobin", { token }, { method: "POST", url: "/auth/invitations/accept" }),
    acceptResponse.res
  );
  assert.equal(acceptResponse.statusCode, 200);

  const decisionResponse = createResponse();
  await signupDecisionRoute(
    createAuthedRequest("coachRobin", undefined, { method: "GET", url: "/auth/signup/decision" }),
    decisionResponse.res
  );
  assert.equal(decisionResponse.json.decision.state, "ready");
  assert.equal(decisionResponse.json.decision.role, "coach");
});

test("household setup can produce one active parent, student, and coach in the same household", async () => {
  const studentRequestResponse = createResponse();
  await signupRequestHouseholdAccessRoute(
    createAuthedRequest(
      "studentNova",
      {
        requestedPersona: "student",
        parentEmail: "elena.rivera@synthetic.rising-senior.local",
        requestMessage: "Please connect me to the Rivera household.",
      },
      { method: "POST", url: "/auth/signup/request-household-access" }
    ),
    studentRequestResponse.res
  );
  assert.equal(studentRequestResponse.statusCode, 200);

  const overviewBeforeApproval = createResponse();
  await householdAdminOverviewRoute(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/households/me/admin" }),
    overviewBeforeApproval.res
  );
  assert.equal(overviewBeforeApproval.statusCode, 200);
  const pendingStudentRequest = overviewBeforeApproval.json.overview.joinRequests.find(
    (request: { requestingUserId: string; status: string }) =>
      request.requestingUserId === "44444444-4444-4444-8444-444444444444" && request.status === "pending"
  );
  assert.ok(pendingStudentRequest);

  const approveResponse = createResponse();
  await householdJoinRequestApproveRoute(
    createAuthedRequest(
      "parentMaya",
      { householdJoinRequestId: pendingStudentRequest.householdJoinRequestId },
      { method: "POST", url: "/households/me/join-requests/approve" }
    ),
    approveResponse.res
  );
  assert.equal(approveResponse.statusCode, 200);

  const inviteResponse = createResponse();
  await householdInvitationCreateRoute(
    createAuthedRequest(
      "parentMaya",
      {
        invitedEmail: "robin.kline@synthetic.rising-senior.local",
        invitedPersona: "coach",
      },
      { method: "POST", url: "/households/me/invitations" }
    ),
    inviteResponse.res
  );
  assert.equal(inviteResponse.statusCode, 200);
  const inviteLink = inviteResponse.json.invitation.inviteLinkPreview as string;
  const token = new URL(inviteLink).searchParams.get("invite");
  assert.ok(token);

  const acceptResponse = createResponse();
  await invitationAcceptRoute(
    createAuthedRequest("coachRobin", { token }, { method: "POST", url: "/auth/invitations/accept" }),
    acceptResponse.res
  );
  assert.equal(acceptResponse.statusCode, 200);

  const overviewAfterSetup = createResponse();
  await householdAdminOverviewRoute(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/households/me/admin" }),
    overviewAfterSetup.res
  );
  assert.equal(overviewAfterSetup.statusCode, 200);

  const householdId = overviewAfterSetup.json.overview.householdId;
  assert.ok(householdId);

  const members = overviewAfterSetup.json.overview.members.filter(
    (member: { userId: string }) =>
      member.userId === "11111111-1111-4111-8111-222222222222" ||
      member.userId === "44444444-4444-4444-8444-444444444444" ||
      member.userId === "66666666-6666-4666-8666-666666666666"
  );

  assert.equal(members.length, 3);
  assert.deepEqual(
    members
      .map((member: { persona: string; membershipStatus: string; householdId: string }) => ({
        persona: member.persona,
        membershipStatus: member.membershipStatus,
        householdId: member.householdId,
      }))
      .sort((a, b) => a.persona.localeCompare(b.persona)),
    [
      { persona: "coach", membershipStatus: "active", householdId },
      { persona: "parent", membershipStatus: "active", householdId },
      { persona: "student", membershipStatus: "active", householdId },
    ]
  );

  const studentDecisionResponse = createResponse();
  await signupDecisionRoute(
    createAuthedRequest("studentNova", undefined, { method: "GET", url: "/auth/signup/decision" }),
    studentDecisionResponse.res
  );
  assert.equal(studentDecisionResponse.statusCode, 200);
  assert.equal(studentDecisionResponse.json.decision.state, "ready");
  assert.equal(studentDecisionResponse.json.decision.role, "student");
  assert.equal(studentDecisionResponse.json.decision.householdId, householdId);

  const coachDecisionResponse = createResponse();
  await signupDecisionRoute(
    createAuthedRequest("coachRobin", undefined, { method: "GET", url: "/auth/signup/decision" }),
    coachDecisionResponse.res
  );
  assert.equal(coachDecisionResponse.statusCode, 200);
  assert.equal(coachDecisionResponse.json.decision.state, "ready");
  assert.equal(coachDecisionResponse.json.decision.role, "coach");
  assert.equal(coachDecisionResponse.json.decision.householdId, householdId);
});

test("denied capability is enforced by the API router, not just hidden in the UI", async () => {
  const updateResponse = createResponse();
  await householdPermissionUpdateRoute(
    createAuthedRequest(
      "parentMaya",
      {
        userId: "11111111-1111-4111-8111-222222222222",
        persona: "parent",
        grants: [],
        denies: ["view_career_goals"],
      },
      { method: "POST", url: "/households/me/permissions" }
    ),
    updateResponse.res
  );
  assert.equal(updateResponse.statusCode, 200);

  const blockedResponse = createResponse();
  await router(
    createAuthedRequest("parentMaya", undefined, {
      method: "GET",
      url: "/students/me/career-scenarios",
    }),
    blockedResponse.res
  );

  assert.equal(blockedResponse.statusCode, 403);
});

test("ordinary household admins cannot assign the admin persona", async () => {
  const response = createResponse();
  await householdPermissionUpdateRoute(
    createAuthedRequest(
      "parentMaya",
      {
        userId: "33333333-3333-4333-8333-111111111111",
        persona: "admin",
        grants: [],
        denies: [],
      },
      { method: "POST", url: "/households/me/permissions" }
    ),
    response.res
  );

  assert.equal(response.statusCode, 403);
});

test("super admin can view the cross-household user directory while household admins cannot", async () => {
  const superAdminResponse = createResponse();
  await superAdminUserDirectoryRoute(
    createAuthedRequest("adminEric", undefined, { method: "GET", url: "/admin/users" }),
    superAdminResponse.res
  );

  assert.equal(superAdminResponse.statusCode, 200);
  assert.ok(Array.isArray(superAdminResponse.json.users));
  assert.ok(superAdminResponse.json.users.some((user: { email?: string | null }) => user.email === "eric.bassman@gmail.com"));

  const parentResponse = createResponse();
  await superAdminUserDirectoryRoute(
    createAuthedRequest("parentMaya", undefined, { method: "GET", url: "/admin/users" }),
    parentResponse.res
  );

  assert.equal(parentResponse.statusCode, 403);
});
