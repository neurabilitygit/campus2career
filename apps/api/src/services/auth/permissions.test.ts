import test from "node:test";
import assert from "node:assert/strict";
import { buildEffectivePermissions, resolvePrimaryPersona } from "./permissions";

test("super admin receives all capabilities regardless of overrides", () => {
  const permissions = buildEffectivePermissions({
    account: {
      userId: "user-1",
      email: "eric.bassman@gmail.com",
      roleType: "admin",
      accountStatus: "active",
      authProvider: "supabase_google",
      isSuperAdmin: true,
      firstName: "Eric",
      lastName: "Bass",
      preferredName: "Eric",
    },
    memberships: [],
    overrides: [
      {
        userCapabilityOverrideId: "override-1",
        userId: "user-1",
        householdId: null,
        capabilityKey: "view_student_dashboard",
        effect: "deny",
      },
    ],
  });

  assert.equal(permissions.isSuperAdmin, true);
  assert.ok(permissions.grantedCapabilities.includes("access_admin_console"));
  assert.ok(permissions.grantedCapabilities.includes("manage_system_settings"));
});

test("deny overrides win over persona defaults", () => {
  const permissions = buildEffectivePermissions({
    account: {
      userId: "user-2",
      email: "parent@example.com",
      roleType: "parent",
      accountStatus: "active",
      authProvider: "supabase_google",
      isSuperAdmin: false,
      firstName: "Pat",
      lastName: "Parent",
      preferredName: null,
    },
    memberships: [],
    overrides: [
      {
        userCapabilityOverrideId: "override-2",
        userId: "user-2",
        householdId: null,
        capabilityKey: "view_communication",
        effect: "deny",
      },
    ],
  });

  assert.equal(permissions.grantedCapabilities.includes("view_communication"), false);
  assert.equal(permissions.deniedCapabilities.includes("view_communication"), true);
});

test("primary active membership persona wins over the stored account role", () => {
  const persona = resolvePrimaryPersona(
    {
      userId: "user-3",
      email: "coach@example.com",
      roleType: "student",
      accountStatus: "active",
      authProvider: "supabase_google",
      isSuperAdmin: false,
      firstName: "Casey",
      lastName: "Coach",
      preferredName: null,
    },
    [
      {
        userHouseholdRoleId: "membership-1",
        householdId: "household-1",
        householdName: "Household 1",
        createdByParentUserId: "parent-1",
        userId: "user-3",
        roleInHousehold: "coach",
        isPrimary: true,
        membershipStatus: "active",
        invitedByUserId: null,
        approvedByUserId: null,
        approvedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
  );

  assert.equal(persona, "coach");
});
