import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import {
  academicEvidenceDiscoverDegreeRequirementsRoute,
  academicEvidenceDiscoverOfferingsRoute,
  academicEvidenceManualOfferingRoute,
  academicEvidenceStateRoute,
} from "../../apps/api/src/routes/academic";
import { createAuthedRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";

process.env.ALLOW_DEMO_AUTH = "true";

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("academic evidence state shows seeded offerings for the synthetic school", async () => {
  const discoverResponse = createResponse();
  await academicEvidenceDiscoverOfferingsRoute(
    createAuthedRequest(
      "studentLeo",
      { institutionCanonicalName: "synthetic_state_university" },
      {
        method: "POST",
        url: "/students/me/academic-evidence/discover-offerings",
      }
    ),
    discoverResponse.res
  );

  assert.equal(discoverResponse.statusCode, 200);
  assert.equal(discoverResponse.json.sourceUsed, "seeded_database");
});

test("manual academic offering entry creates a student academic assignment", async () => {
  const saveResponse = createResponse();
  await academicEvidenceManualOfferingRoute(
    createAuthedRequest(
      "studentLeo",
      {
        institutionCanonicalName: "synthetic_state_university",
        institutionDisplayName: "Synthetic State University",
        degreeType: "Undergraduate",
        programName: "Synthetic State University majors",
        majorDisplayName: "Economics",
      },
      {
        method: "POST",
        url: "/students/me/academic-evidence/manual-offering",
      }
    ),
    saveResponse.res
  );

  assert.equal(saveResponse.statusCode, 200);

  const stateResponse = createResponse();
  await academicEvidenceStateRoute(
    createAuthedRequest("studentLeo", undefined, {
      method: "GET",
      url: "/students/me/academic-evidence",
    }),
    stateResponse.res
  );

  assert.equal(stateResponse.statusCode, 200);
  assert.equal(stateResponse.json.academicEvidence.assignment.majorDisplayName, "Economics");
});

test("discovering degree requirements reports seeded success when structured requirements already exist", async () => {
  const response = createResponse();
  await academicEvidenceDiscoverDegreeRequirementsRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "POST",
      url: "/students/me/academic-evidence/discover-degree-requirements",
    }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.sourceUsed, "seeded_database");
});
