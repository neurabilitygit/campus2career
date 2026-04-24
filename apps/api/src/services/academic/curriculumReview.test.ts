import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCurriculumAlerts,
  canCoachReviewCurriculum,
  canUploadCurriculumPdf,
  canVerifyCurriculum,
  computeEffectiveCurriculumStatus,
} from "./curriculumReview";

test("computeEffectiveCurriculumStatus distinguishes missing from present-unverified and verified", () => {
  assert.equal(
    computeEffectiveCurriculumStatus({ hasCurriculum: false, storedStatus: null }),
    "missing"
  );
  assert.equal(
    computeEffectiveCurriculumStatus({ hasCurriculum: true, storedStatus: null }),
    "present_unverified"
  );
  assert.equal(
    computeEffectiveCurriculumStatus({ hasCurriculum: true, storedStatus: "verified" }),
    "verified"
  );
});

test("buildCurriculumAlerts marks missing and unverified curriculum as high priority", () => {
  assert.equal(buildCurriculumAlerts({ effectiveStatus: "missing" })[0]?.level, "high");
  assert.equal(buildCurriculumAlerts({ effectiveStatus: "present_unverified" })[0]?.level, "high");
  assert.equal(buildCurriculumAlerts({ effectiveStatus: "verified" })[0]?.level, "info");
});

test("curriculum verification capabilities follow role rules", () => {
  assert.equal(canVerifyCurriculum("student"), true);
  assert.equal(canVerifyCurriculum("parent"), true);
  assert.equal(canVerifyCurriculum("coach"), false);
  assert.equal(canCoachReviewCurriculum("coach"), true);
  assert.equal(canCoachReviewCurriculum("student"), false);
  assert.equal(canUploadCurriculumPdf("parent"), true);
  assert.equal(canUploadCurriculumPdf("coach"), false);
});
