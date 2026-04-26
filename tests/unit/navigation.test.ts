import test from "node:test";
import assert from "node:assert/strict";
import { getPersonaDefaultCapabilities } from "../../packages/shared/src/capabilities";
import { buildNavigationGroups } from "../../apps/web/src/components/layout/navigation";

function collectLabels(role: Parameters<typeof buildNavigationGroups>[0]) {
  const capabilities =
    role === "student" || role === "parent" || role === "coach" || role === "admin"
      ? getPersonaDefaultCapabilities(role)
      : [];
  return buildNavigationGroups(role, capabilities)
    .flatMap((group) => group.items.flatMap((item) => [item.label, ...(item.children || []).map((child) => child.label)]));
}

test("student navigation excludes parent and coach-only sections", () => {
  const labels = collectLabels("student");

  assert.ok(labels.includes("Student dashboard"));
  assert.ok(labels.includes("Communication hub"));
  assert.ok(labels.includes("Conversation helper"));
  assert.ok(labels.includes("Profile"));
  assert.equal(labels.includes("Parent dashboard"), false);
  assert.equal(labels.includes("Coach dashboard"), false);
  assert.equal(labels.includes("Household administration"), false);
});

test("parent navigation excludes student and coach-only sections", () => {
  const labels = collectLabels("parent");

  assert.ok(labels.includes("Parent dashboard"));
  assert.ok(labels.includes("Communication hub"));
  assert.ok(labels.includes("Translator"));
  assert.ok(labels.includes("Profile"));
  assert.equal(labels.includes("Student dashboard"), false);
  assert.equal(labels.includes("Coach dashboard"), false);
});

test("coach navigation excludes parent and student-only sections", () => {
  const labels = collectLabels("coach");

  assert.ok(labels.includes("Coach dashboard"));
  assert.ok(labels.includes("Communication hub"));
  assert.ok(labels.includes("Communication context"));
  assert.ok(labels.includes("Profile"));
  assert.equal(labels.includes("Student dashboard"), false);
  assert.equal(labels.includes("Parent dashboard"), false);
  assert.equal(labels.includes("Household administration"), false);
});

test("signed-out navigation keeps workspace-only tools hidden", () => {
  const labels = collectLabels(null);

  assert.ok(labels.includes("Home"));
  assert.ok(labels.includes("Help and documentation"));
  assert.equal(labels.includes("Profile"), false);
  assert.equal(labels.includes("Communication hub"), false);
  assert.equal(labels.includes("Student dashboard"), false);
  assert.equal(labels.includes("Parent dashboard"), false);
  assert.equal(labels.includes("Coach dashboard"), false);
});

test("capability filtering removes hidden features even when the role normally allows them", () => {
  const labels = buildNavigationGroups("parent", ["view_parent_dashboard"])
    .flatMap((group) => group.items.map((item) => item.label));

  assert.ok(labels.includes("Parent dashboard"));
  assert.equal(labels.includes("Communication hub"), false);
  assert.equal(labels.includes("Career Goal"), false);
});
