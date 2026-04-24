import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  coachOutcomesReviewRoute,
  outcomeRouteDeps,
  parentOutcomesCreateRoute,
  parentOutcomesListRoute,
  studentOutcomesCreateRoute,
  studentOutcomesListRoute,
  studentOutcomesSummaryRoute,
  studentOutcomesUpdateRoute,
} from "./outcomes";

function createRequest(body?: unknown, method: string = "POST") {
  const payload = body == null ? "" : JSON.stringify(body);
  const req = Readable.from(payload ? [payload] : []) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = method;
  req.url = "/";
  req.headers = {};
  return req as any;
}

function createResponse() {
  const headers = new Map<string, string>();
  let body = "";
  const res = {
    statusCode: 200,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    end(chunk?: string) {
      body = chunk || "";
    },
  } as any;

  return {
    res,
    get statusCode() {
      return res.statusCode;
    },
    get json() {
      return body ? JSON.parse(body) : null;
    },
  };
}

function withStubbedDeps<T>(run: () => Promise<T>) {
  const originals = {
    resolveRequestContext: outcomeRouteDeps.resolveRequestContext,
    newId: outcomeRouteDeps.newId,
    listForStudent: outcomeRouteDeps.repo.listForStudent,
    create: outcomeRouteDeps.repo.create,
    updateForStudent: outcomeRouteDeps.repo.updateForStudent,
    markCoachReviewed: outcomeRouteDeps.repo.markCoachReviewed,
    getSummaryForStudent: outcomeRouteDeps.repo.getSummaryForStudent,
    getPrimaryForStudent: outcomeRouteDeps.jobTargetRepo.getPrimaryForStudent,
    getByIdForStudent: outcomeRouteDeps.jobTargetRepo.getByIdForStudent,
  };

  return run().finally(() => {
    outcomeRouteDeps.resolveRequestContext = originals.resolveRequestContext;
    outcomeRouteDeps.newId = originals.newId;
    outcomeRouteDeps.repo.listForStudent = originals.listForStudent;
    outcomeRouteDeps.repo.create = originals.create;
    outcomeRouteDeps.repo.updateForStudent = originals.updateForStudent;
    outcomeRouteDeps.repo.markCoachReviewed = originals.markCoachReviewed;
    outcomeRouteDeps.repo.getSummaryForStudent = originals.getSummaryForStudent;
    outcomeRouteDeps.jobTargetRepo.getPrimaryForStudent = originals.getPrimaryForStudent;
    outcomeRouteDeps.jobTargetRepo.getByIdForStudent = originals.getByIdForStudent;
  });
}

test("studentOutcomesCreateRoute creates an outcome and infers reporter attribution", async () => {
  await withStubbedDeps(async () => {
    let createdInput: any = null;
    outcomeRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "student-user",
        authenticatedRoleType: "student",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;
    outcomeRouteDeps.newId = () => "11111111-1111-4111-8111-111111111111";
    outcomeRouteDeps.jobTargetRepo.getPrimaryForStudent = async () =>
      ({
        jobTargetId: "target-1",
        normalizedRoleFamily: "business analyst",
        normalizedSectorCluster: "fintech",
      }) as any;
    outcomeRouteDeps.repo.create = async (input: any) => {
      createdInput = input;
    };

    const response = createResponse();
    await studentOutcomesCreateRoute(
      createRequest({
        outcomeType: "internship_application",
        status: "applied",
        employerName: "Example Corp",
        roleTitle: "Summer Analyst Intern",
        actionDate: "2026-04-20",
        notes: "Applied through company portal",
      }),
      response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(createdInput.studentProfileId, "student-1");
    assert.equal(createdInput.sourceType, "student_report");
    assert.equal(createdInput.reportedByRole, "student");
    assert.equal(createdInput.verificationStatus, "self_reported");
    assert.equal(createdInput.jobTargetId, "target-1");
    assert.equal(createdInput.targetRoleFamily, "business analyst");
  });
});

test("parentOutcomesListRoute forbids student role access", async () => {
  await withStubbedDeps(async () => {
    outcomeRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "student-user",
        authenticatedRoleType: "student",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;

    const response = createResponse();
    await parentOutcomesListRoute(createRequest(undefined, "GET"), response.res);

    assert.equal(response.statusCode, 403);
    assert.equal(response.json.error, "forbidden");
  });
});

test("parentOutcomesCreateRoute records parent attribution and verification state", async () => {
  await withStubbedDeps(async () => {
    let createdInput: any = null;
    outcomeRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "parent-user",
        authenticatedRoleType: "parent",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;
    outcomeRouteDeps.newId = () => "11111111-1111-4111-8111-111111111111";
    outcomeRouteDeps.jobTargetRepo.getPrimaryForStudent = async () => null as any;
    outcomeRouteDeps.repo.create = async (input: any) => {
      createdInput = input;
    };

    const response = createResponse();
    await parentOutcomesCreateRoute(
      createRequest({
        outcomeType: "offer",
        status: "offer",
        employerName: "Example Corp",
        roleTitle: "Summer Analyst",
        actionDate: "2026-04-22",
      }),
      response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(createdInput.sourceType, "parent_report");
    assert.equal(createdInput.reportedByRole, "parent");
    assert.equal(createdInput.verificationStatus, "parent_reported");
  });
});

test("studentOutcomesUpdateRoute rejects invalid status combinations", async () => {
  await withStubbedDeps(async () => {
    let updatedCalled = false;
    outcomeRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "student-user",
        authenticatedRoleType: "student",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;
    outcomeRouteDeps.repo.updateForStudent = async () => {
      updatedCalled = true;
      return true;
    };

    const response = createResponse();
    await studentOutcomesUpdateRoute(
      createRequest({
        studentOutcomeId: "11111111-1111-4111-8111-111111111111",
        outcomeType: "interview",
        status: "applied",
        employerName: "Example Corp",
        roleTitle: "Analyst",
        actionDate: "2026-04-20",
      }),
      response.res
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.json.message, /not valid/i);
    assert.equal(updatedCalled, false);
  });
});

test("studentOutcomesSummaryRoute returns summary counts for the current student", async () => {
  await withStubbedDeps(async () => {
    outcomeRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "student-user",
        authenticatedRoleType: "student",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;
    outcomeRouteDeps.repo.getSummaryForStudent = async () =>
      ({
        totalActive: 4,
        countsByType: {
          internship_application: 2,
          interview: 1,
          offer: 1,
          accepted_role: 0,
        },
        countsByStatus: {
          not_started: 0,
          in_progress: 0,
          applied: 2,
          interviewing: 1,
          offer: 1,
          accepted: 0,
        },
        countsByVerification: {
          self_reported: 3,
          coach_reviewed: 1,
          parent_reported: 0,
          verified: 0,
          disputed: 0,
        },
        latestActionDate: "2026-04-20",
        hasOutcomeData: true,
      }) as any;

    const response = createResponse();
    await studentOutcomesSummaryRoute(createRequest(undefined, "GET"), response.res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.summary.countsByType.offer, 1);
    assert.equal(response.json.summary.totalActive, 4);
  });
});

test("studentOutcomesListRoute returns the current student's outcomes in timeline order", async () => {
  await withStubbedDeps(async () => {
    outcomeRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "student-user",
        authenticatedRoleType: "student",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;
    outcomeRouteDeps.repo.listForStudent = async () =>
      [
        {
          studentOutcomeId: "older",
          studentProfileId: "student-1",
          householdId: "household-1",
          jobTargetId: null,
          targetRoleFamily: null,
          targetSectorCluster: null,
          outcomeType: "interview",
          status: "interviewing",
          employerName: "B",
          roleTitle: "Analyst",
          sourceType: "student_report",
          reportedByUserId: "student-user",
          reportedByRole: "student",
          verificationStatus: "self_reported",
          actionDate: "2026-04-20",
          actionDateLabel: "interview_date",
          notes: null,
          archivedAt: null,
          createdAt: "2026-04-20T09:00:00.000Z",
          updatedAt: "2026-04-20T09:00:00.000Z",
        },
        {
          studentOutcomeId: "newer",
          studentProfileId: "student-1",
          householdId: "household-1",
          jobTargetId: null,
          targetRoleFamily: null,
          targetSectorCluster: null,
          outcomeType: "offer",
          status: "offer",
          employerName: "A",
          roleTitle: "Associate",
          sourceType: "student_report",
          reportedByUserId: "student-user",
          reportedByRole: "student",
          verificationStatus: "self_reported",
          actionDate: "2026-04-21",
          actionDateLabel: "offer_date",
          notes: null,
          archivedAt: null,
          createdAt: "2026-04-21T12:00:00.000Z",
          updatedAt: "2026-04-21T12:00:00.000Z",
        },
      ] as any;

    const response = createResponse();
    await studentOutcomesListRoute(createRequest(undefined, "GET"), response.res);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      response.json.outcomes.map((item: any) => item.studentOutcomeId),
      ["newer", "older"]
    );
  });
});

test("coachOutcomesReviewRoute marks the authorized student's outcome as coach reviewed", async () => {
  await withStubbedDeps(async () => {
    let calledWith: { studentProfileId: string; studentOutcomeId: string } | null = null;
    outcomeRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "coach-user",
        authenticatedRoleType: "coach",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;
    outcomeRouteDeps.repo.markCoachReviewed = async (
      studentProfileId: string,
      studentOutcomeId: string
    ) => {
      calledWith = { studentProfileId, studentOutcomeId };
      return true;
    };

    const response = createResponse();
    await coachOutcomesReviewRoute(
      createRequest({
        studentOutcomeId: "11111111-1111-4111-8111-111111111111",
      }),
      response.res
    );

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calledWith, {
      studentProfileId: "student-1",
      studentOutcomeId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
