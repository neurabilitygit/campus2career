import test from "node:test";
import assert from "node:assert/strict";
import { buildBottomBackAction } from "../../apps/web/src/components/layout/backNavigation";

test("workspace root pages stay free of bottom back actions", () => {
  assert.equal(buildBottomBackAction({ pathname: "/student", role: "student" }), null);
  assert.equal(buildBottomBackAction({ pathname: "/parent", role: "parent" }), null);
  assert.equal(buildBottomBackAction({ pathname: "/coach", role: "coach" }), null);
});

test("student setup and detail routes get role-aware bottom back actions", () => {
  assert.deepEqual(buildBottomBackAction({ pathname: "/help", role: "student" }), {
    href: "/student?section=strategy",
    label: "Back to dashboard",
  });
  assert.deepEqual(buildBottomBackAction({ pathname: "/uploads/resume", role: "student" }), {
    href: "/uploads",
    label: "Back to documents",
  });
  assert.deepEqual(buildBottomBackAction({ pathname: "/onboarding/profile", role: "student" }), {
    href: "/onboarding",
    label: "Back to onboarding",
  });
});

test("role-specific routes return to the matching workspace", () => {
  assert.deepEqual(buildBottomBackAction({ pathname: "/parent/history", role: "parent" }), {
    href: "/parent",
    label: "Back to parent dashboard",
  });
  assert.deepEqual(buildBottomBackAction({ pathname: "/diagnostic", role: "coach" }), {
    href: "/coach",
    label: "Back to coach dashboard",
  });
});

test("career goal keeps its custom internal back flow instead of adding a shell back action", () => {
  assert.equal(buildBottomBackAction({ pathname: "/career-scenarios", role: "student" }), null);
});
