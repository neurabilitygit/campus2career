import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateDegreeRequirementsReasonableness,
  evaluateOfferingsReasonableness,
} from "../../apps/api/src/services/academic/academicEvidenceService";

test("offerings reasonableness prefers seeded-like complete results and flags generic weak results", () => {
  const strong = evaluateOfferingsReasonableness({
    institutionDisplayName: "Synthetic State University",
    majors: ["Economics", "Computer Science"],
    minors: ["Philosophy"],
    sourceUrl: "https://synthetic-state.example.edu/catalog/programs",
    catalogYear: "2026-2027",
  });

  assert.equal(strong.status, "succeeded");
  assert.equal(strong.confidenceLabel, "high");

  const weak = evaluateOfferingsReasonableness({
    institutionDisplayName: "Synthetic State University",
    majors: ["Programs"],
    minors: [],
    sourceUrl: null,
    catalogYear: null,
  });

  assert.match(weak.notes.join(" "), /generic navigation labels/i);
  assert.notEqual(weak.status, "succeeded");
});

test("degree requirement reasonableness distinguishes complete vs questionable evidence", () => {
  const complete = evaluateDegreeRequirementsReasonableness({
    requirementGroupCount: 3,
    requirementItemCount: 12,
    totalCreditsRequired: 42,
    sourceUrl: "https://synthetic-state.example.edu/catalog/economics",
    catalogYear: "2026-2027",
  });

  assert.equal(complete.status, "succeeded");
  assert.equal(complete.confidenceLabel, "high");

  const questionable = evaluateDegreeRequirementsReasonableness({
    requirementGroupCount: 1,
    requirementItemCount: 1,
    totalCreditsRequired: 999,
    sourceUrl: null,
    catalogYear: null,
  });

  assert.match(questionable.notes.join(" "), /plausible range/i);
  assert.notEqual(questionable.status, "succeeded");
});
