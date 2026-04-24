import test from "node:test";
import assert from "node:assert/strict";
import {
  makeCoachActionItemInput,
  makeCoachRecommendationInput,
  makeDemoAuthState,
  makeOutcomeInput,
  makeStudentProfilePatch,
} from "../synthetic/factories";
import { getSyntheticStudent } from "../synthetic/scenarios";

test("makeDemoAuthState returns the browser auth payload for a seeded user", () => {
  assert.deepEqual(makeDemoAuthState("studentMaya"), {
    userId: "11111111-1111-4111-8111-111111111111",
    roleType: "student",
    email: "maya.rivera@synthetic.rising-senior.local",
  });
});

test("makeStudentProfilePatch composes default synthetic student profile values", () => {
  const patch = makeStudentProfilePatch("maya", {
    academicNotes: "Testing notes",
  });

  assert.equal(patch.schoolName, "Synthetic State University");
  assert.equal(patch.majorPrimary, "Economics");
  assert.equal(patch.academicNotes, "Testing notes");
});

test("coach input factories inherit the target student profile id", () => {
  const student = getSyntheticStudent("maya");
  const recommendation = makeCoachRecommendationInput(student);
  const actionItem = makeCoachActionItemInput(student);
  const outcome = makeOutcomeInput(student, { outcomeType: "interview", status: "interviewing" });

  assert.equal(recommendation.studentProfileId, student.studentProfileId);
  assert.equal(actionItem.studentProfileId, student.studentProfileId);
  assert.equal(outcome.studentProfileId, student.studentProfileId);
  assert.equal(outcome.outcomeType, "interview");
  assert.equal(outcome.status, "interviewing");
});
