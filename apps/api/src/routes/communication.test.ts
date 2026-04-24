import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  communicationRouteDeps,
  parentCommunicationDraftSendMockRoute,
  parentCommunicationEntriesListRoute,
  studentCommunicationMessagesRoute,
} from "./communication";

function createRequest(body?: unknown) {
  const payload = body == null ? "" : JSON.stringify(body);
  const req = Readable.from(payload ? [payload] : []) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = "POST";
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
    get headers() {
      return headers;
    },
  };
}

function withStubbedDeps<T>(run: () => Promise<T>) {
  const originals = {
    resolveRequestContext: communicationRouteDeps.resolveRequestContext,
    getDraft: communicationRouteDeps.repo.getDraft,
    getStrategy: communicationRouteDeps.repo.getStrategy,
    updateDraftStatus: communicationRouteDeps.repo.updateDraftStatus,
    createAuditLog: communicationRouteDeps.repo.createAuditLog,
    listEntries: communicationRouteDeps.repo.listEntries,
    listStudentReceivedMessages: communicationRouteDeps.repo.listStudentReceivedMessages,
    getCommunicationProvider: communicationRouteDeps.getCommunicationProvider,
  };

  return run().finally(() => {
    communicationRouteDeps.resolveRequestContext = originals.resolveRequestContext;
    communicationRouteDeps.repo.getDraft = originals.getDraft;
    communicationRouteDeps.repo.getStrategy = originals.getStrategy;
    communicationRouteDeps.repo.updateDraftStatus = originals.updateDraftStatus;
    communicationRouteDeps.repo.createAuditLog = originals.createAuditLog;
    communicationRouteDeps.repo.listEntries = originals.listEntries;
    communicationRouteDeps.repo.listStudentReceivedMessages =
      originals.listStudentReceivedMessages;
    communicationRouteDeps.getCommunicationProvider = originals.getCommunicationProvider;
  });
}

test("parentCommunicationEntriesListRoute forbids student role access", async () => {
  await withStubbedDeps(async () => {
    communicationRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "student-user",
        authenticatedRoleType: "student",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;

    const response = createResponse();
    await parentCommunicationEntriesListRoute(createRequest(), response.res);

    assert.equal(response.statusCode, 403);
    assert.equal(response.json.error, "forbidden");
  });
});

test("parentCommunicationEntriesListRoute scopes the repository call to the authenticated parent context", async () => {
  await withStubbedDeps(async () => {
    let calledWith: { parentUserId: string; studentProfileId: string } | null = null;
    communicationRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "parent-user",
        authenticatedRoleType: "parent",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;
    communicationRouteDeps.repo.listEntries = async (parentUserId, studentProfileId) => {
      calledWith = { parentUserId, studentProfileId };
      return [];
    };

    const response = createResponse();
    await parentCommunicationEntriesListRoute(createRequest(), response.res);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calledWith, {
      parentUserId: "parent-user",
      studentProfileId: "student-1",
    });
  });
});

test("studentCommunicationMessagesRoute forbids parent role access", async () => {
  await withStubbedDeps(async () => {
    communicationRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "parent-user",
        authenticatedRoleType: "parent",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;

    const response = createResponse();
    await studentCommunicationMessagesRoute(createRequest(), response.res);

    assert.equal(response.statusCode, 403);
    assert.equal(response.json.error, "forbidden");
  });
});

test("parentCommunicationDraftSendMockRoute blocks delivery when consent or safety rules forbid sending", async () => {
  await withStubbedDeps(async () => {
    let providerCalled = false;
    let updatedStatus: string | null = null;

    communicationRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "parent-user",
        authenticatedRoleType: "parent",
        householdId: "household-1",
        studentProfileId: "student-1",
        studentUserId: "student-user",
      }) as any;

    communicationRouteDeps.repo.getDraft = async () =>
      ({
        communicationMessageDraftId: "11111111-1111-4111-8111-111111111111",
        communicationStrategyId: "22222222-2222-4222-8222-222222222222",
        parentCommunicationEntryId: "33333333-3333-4333-8333-333333333333",
        parentUserId: "parent-user",
        studentProfileId: "student-1",
        householdId: "household-1",
        selectedChannel: "sms",
        providerMode: "not_sent",
        status: "review_required",
        messageBody: "A translated message",
        reviewRequired: true,
        approvedForDelivery: false,
      }) as any;

    communicationRouteDeps.repo.getStrategy = async () =>
      ({
        communicationStrategyId: "22222222-2222-4222-8222-222222222222",
        parentCommunicationEntryId: "33333333-3333-4333-8333-333333333333",
        parentUserId: "parent-user",
        studentProfileId: "student-1",
        householdId: "household-1",
        generationMode: "fallback",
        consentState: "withheld",
        status: "withheld",
        recommendedChannel: "sms",
        recommendedTone: "gentle",
        recommendedTiming: "Later",
        recommendedFrequency: "as_needed",
        defensivenessRisk: "high",
        reasonForRecommendation: "Needs consent first",
        studentFacingMessageDraft: "Held",
        parentFacingExplanation: "Held",
        whatNotToSay: "Don't pressure",
        humanReviewRecommended: true,
        withholdDelivery: true,
        withholdReason:
          "Student consent is not currently on file for translated parent-originated messages.",
      }) as any;

    communicationRouteDeps.repo.updateDraftStatus = async (input) => {
      updatedStatus = input.status;
    };
    communicationRouteDeps.repo.createAuditLog = async () => {};
    communicationRouteDeps.getCommunicationProvider = () => {
      providerCalled = true;
      throw new Error("Provider should not be called when delivery is blocked");
    };

    const response = createResponse();
    await parentCommunicationDraftSendMockRoute(
      createRequest({
        communicationMessageDraftId: "11111111-1111-4111-8111-111111111111",
      }),
      response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.blocked, true);
    assert.match(response.json.message, /consent/i);
    assert.equal(updatedStatus, "withheld");
    assert.equal(providerCalled, false);
  });
});
