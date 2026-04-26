import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldRedirectWorkspaceRole,
  workspaceHrefForRole,
  workspaceLabelForRole,
} from "../../apps/web/src/lib/workspaceAccess";

test("workspaceHrefForRole returns the correct default workspace route", () => {
  assert.equal(workspaceHrefForRole("student"), "/student?section=strategy");
  assert.equal(workspaceHrefForRole("parent"), "/parent");
  assert.equal(workspaceHrefForRole("coach"), "/coach");
  assert.equal(workspaceHrefForRole("admin"), "/admin");
  assert.equal(workspaceHrefForRole(null), "/");
});

test("workspaceLabelForRole returns a human-friendly workspace label", () => {
  assert.equal(workspaceLabelForRole("student"), "Student workspace");
  assert.equal(workspaceLabelForRole("parent"), "Parent workspace");
  assert.equal(workspaceLabelForRole("coach"), "Coach workspace");
});

test("shouldRedirectWorkspaceRole only redirects when the authenticated role is outside the expected set", () => {
  assert.equal(
    shouldRedirectWorkspaceRole({ authenticatedRole: "student", expectedRoles: ["student", "admin"] }),
    false
  );
  assert.equal(
    shouldRedirectWorkspaceRole({ authenticatedRole: "student", expectedRoles: ["coach", "admin"] }),
    true
  );
  assert.equal(
    shouldRedirectWorkspaceRole({ authenticatedRole: null, expectedRoles: ["student"] }),
    false
  );
});
