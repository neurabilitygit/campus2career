import test from "node:test";
import assert from "node:assert/strict";
import { buildNavigationGroups } from "../../apps/web/src/components/layout/navigation";

function collectLabels(role: Parameters<typeof buildNavigationGroups>[0]) {
  return buildNavigationGroups(role)
    .flatMap((group) => group.items.flatMap((item) => [item.label, ...(item.children || []).map((child) => child.label)]));
}

test("student navigation excludes parent and coach-only sections", () => {
  const labels = collectLabels("student");

  assert.ok(labels.includes("Student dashboard"));
  assert.ok(labels.includes("Messages & chat"));
  assert.ok(labels.includes("Profile"));
  assert.equal(labels.includes("Parent dashboard"), false);
  assert.equal(labels.includes("Coach dashboard"), false);
});

test("parent navigation excludes student and coach-only sections", () => {
  const labels = collectLabels("parent");

  assert.ok(labels.includes("Parent dashboard"));
  assert.ok(labels.includes("Messages & chat"));
  assert.ok(labels.includes("Profile"));
  assert.equal(labels.includes("Student dashboard"), false);
  assert.equal(labels.includes("Coach dashboard"), false);
});

test("coach navigation excludes parent and student-only sections", () => {
  const labels = collectLabels("coach");

  assert.ok(labels.includes("Coach dashboard"));
  assert.ok(labels.includes("Messages & chat"));
  assert.ok(labels.includes("Profile"));
  assert.equal(labels.includes("Student dashboard"), false);
  assert.equal(labels.includes("Parent dashboard"), false);
});

test("signed-out navigation keeps workspace-only tools hidden", () => {
  const labels = collectLabels(null);

  assert.ok(labels.includes("Home"));
  assert.ok(labels.includes("Help and documentation"));
  assert.equal(labels.includes("Profile"), false);
  assert.equal(labels.includes("Messages & chat"), false);
  assert.equal(labels.includes("Student dashboard"), false);
  assert.equal(labels.includes("Parent dashboard"), false);
  assert.equal(labels.includes("Coach dashboard"), false);
});
