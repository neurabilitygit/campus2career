import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { closeDbPool } from "../../apps/api/src/db/client";
import {
  curriculumLinkUploadRoute,
  curriculumRequestPopulationRoute,
  curriculumReviewRoute,
  curriculumVerifyRoute,
} from "../../apps/api/src/routes/academic";
import { scoringLiveRoute } from "../../apps/api/src/routes/scoring";
import { ArtifactRepository } from "../../apps/api/src/repositories/student/artifactRepository";
import { createAuthedRequest, createResponse } from "../fixtures/http";
import { resetSyntheticTestData, seedSyntheticTestData } from "../fixtures/seedSyntheticData";
import { SYNTHETIC_STUDENTS } from "../synthetic/scenarios";

process.env.ALLOW_DEMO_AUTH = "true";

const artifactRepo = new ArtifactRepository();

beforeEach(async () => {
  await seedSyntheticTestData();
});

after(async () => {
  await resetSyntheticTestData();
  await closeDbPool();
});

test("curriculum review route returns present curriculum details for Maya and missing state for Leo", async () => {
  const mayaResponse = createResponse();
  await curriculumReviewRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/students/me/academic/curriculum-review",
    }),
    mayaResponse.res
  );

  assert.equal(mayaResponse.statusCode, 200);
  assert.equal(mayaResponse.json.curriculum.summary.major, "Economics");
  assert.equal(mayaResponse.json.curriculum.verification.effectiveStatus, "present_unverified");
  assert.ok(mayaResponse.json.curriculum.details.requirementGroups.length >= 2);

  const leoResponse = createResponse();
  await curriculumReviewRoute(
    createAuthedRequest("studentLeo", undefined, {
      method: "GET",
      url: "/students/me/academic/curriculum-review",
    }),
    leoResponse.res
  );

  assert.equal(leoResponse.statusCode, 200);
  assert.equal(leoResponse.json.curriculum.verification.effectiveStatus, "missing");
});

test("student can save curriculum verification and scoring no longer shows the degree-review warning", async () => {
  const verifyResponse = createResponse();
  await curriculumVerifyRoute(
    createAuthedRequest(
      "studentMaya",
      {
        confirmReviewed: true,
        verificationNotes: "Looks complete enough for scoring.",
      },
      {
        method: "POST",
        url: "/students/me/academic/curriculum-review/verify",
      }
    ),
    verifyResponse.res
  );

  assert.equal(verifyResponse.statusCode, 200);

  const readResponse = createResponse();
  await curriculumReviewRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/students/me/academic/curriculum-review",
    }),
    readResponse.res
  );
  assert.equal(readResponse.json.curriculum.verification.effectiveStatus, "verified");

  const scoringResponse = createResponse();
  await scoringLiveRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/students/me/scoring",
    }),
    scoringResponse.res
  );

  assert.equal(scoringResponse.statusCode, 200);
  assert.equal(
    scoringResponse.json.scoringInput.requirementProgress.curriculumVerificationStatus,
    "verified"
  );
  assert.ok(
    !(scoringResponse.json.scoring.topRisks || []).some((item: string) =>
      /degree requirements must be reviewed/i.test(item)
    )
  );
});

test("requesting curriculum population records the request when curriculum is missing", async () => {
  const response = createResponse();
  await curriculumRequestPopulationRoute(
    createAuthedRequest("studentLeo", undefined, {
      method: "POST",
      url: "/students/me/academic/curriculum-review/request-population",
    }),
    response.res
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.json.populated, false);
  assert.match(response.json.message, /requested/i);

  const readResponse = createResponse();
  await curriculumReviewRoute(
    createAuthedRequest("studentLeo", undefined, {
      method: "GET",
      url: "/students/me/academic/curriculum-review",
    }),
    readResponse.res
  );
  assert.ok(readResponse.json.curriculum.verification.curriculumRequestedAt);
});

test("coach can review curriculum but cannot mark it family-verified", async () => {
  const blockedVerify = createResponse();
  await curriculumVerifyRoute(
    createAuthedRequest(
      "coachTaylor",
      { confirmReviewed: true },
      {
        method: "POST",
        url: `/students/me/academic/curriculum-review/verify?studentProfileId=${encodeURIComponent(
          SYNTHETIC_STUDENTS.maya.studentProfileId
        )}`,
      }
    ),
    blockedVerify.res
  );

  assert.equal(blockedVerify.statusCode, 403);
});

test("linking a curriculum PDF upload associates the artifact with the student review record", async () => {
  await artifactRepo.createAcademicArtifact({
    academicArtifactId: "30000000-0000-4000-8000-300000000000",
    studentProfileId: SYNTHETIC_STUDENTS.maya.studentProfileId,
    artifactType: "other",
    fileUri: "synthetic://curriculum/economics-major.pdf",
    sourceLabel: "Synthetic curriculum PDF",
    parsedStatus: "parsed",
    parseTruthStatus: "inferred",
    parseConfidenceLabel: "medium",
    extractionMethod: "pdf_text",
    parseNotes: "Synthetic curriculum artifact for route coverage.",
  });

  const response = createResponse();
  await curriculumLinkUploadRoute(
    createAuthedRequest(
      "studentMaya",
      { academicArtifactId: "30000000-0000-4000-8000-300000000000" },
      {
        method: "POST",
        url: "/students/me/academic/curriculum-review/link-upload",
      }
    ),
    response.res
  );

  assert.equal(response.statusCode, 200);

  const readResponse = createResponse();
  await curriculumReviewRoute(
    createAuthedRequest("studentMaya", undefined, {
      method: "GET",
      url: "/students/me/academic/curriculum-review",
    }),
    readResponse.res
  );

  assert.equal(
    readResponse.json.curriculum.details.latestPdfUploadId,
    "30000000-0000-4000-8000-300000000000"
  );
});
