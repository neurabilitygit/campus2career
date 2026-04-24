import test from "node:test";
import assert from "node:assert/strict";
import {
  coachEditableProfileSchema,
  parentEditableProfileSchema,
  splitFullName,
  studentEditableProfileSchema,
} from "./validation";

test("studentEditableProfileSchema accepts optional sensitive fields left blank", () => {
  const parsed = studentEditableProfileSchema.parse({
    fullName: "Maya Rivera",
    preferredName: "Maya",
    knownNeurodivergentCategories: ["Prefer not to say"],
  });

  assert.equal(parsed.fullName, "Maya Rivera");
  assert.equal(parsed.gender, undefined);
  assert.deepEqual(parsed.knownNeurodivergentCategories, ["Prefer not to say"]);
});

test("parentEditableProfileSchema rejects blank household member names", () => {
  const parsed = parentEditableProfileSchema.safeParse({
    fullName: "Elena Rivera",
    householdMembers: [{ name: "   ", relationship: "Sibling" }],
  });

  assert.equal(parsed.success, false);
});

test("coachEditableProfileSchema accepts specialties and optional communication preferences", () => {
  const parsed = coachEditableProfileSchema.parse({
    fullName: "Taylor Brooks",
    coachingSpecialties: ["Networking", "Internship search"],
    communicationPreferences: "Short follow-up notes after each session.",
  });

  assert.deepEqual(parsed.coachingSpecialties, ["Networking", "Internship search"]);
  assert.equal(parsed.communicationPreferences, "Short follow-up notes after each session.");
});

test("splitFullName keeps the first token as first name and the remainder as last name", () => {
  const parsed = splitFullName("Maya Elena Rivera");

  assert.deepEqual(parsed, {
    firstName: "Maya",
    lastName: "Elena Rivera",
  });
});
