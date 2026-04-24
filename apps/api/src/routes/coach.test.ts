import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import {
  coachNoteCreateRoute,
  coachOutboundDraftSaveRoute,
  coachOutboundSendMockRoute,
  coachRosterRoute,
  coachRouteDeps,
  coachWorkspaceRoute,
  parentCoachFeedRoute,
  studentCoachFeedRoute,
} from "./coach";

function createRequest(body?: unknown, method: string = "POST", url: string = "/") {
  const payload = body == null ? "" : JSON.stringify(body);
  const req = Readable.from(payload ? [payload] : []) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = method;
  req.url = url;
  req.headers = {};
  return req as any;
}

function createResponse() {
  let body = "";
  const headers = new Map<string, string>();
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
    resolveRequestContext: coachRouteDeps.resolveRequestContext,
    listCoachRoster: coachRouteDeps.listCoachRoster,
    resolveCoachRelationshipOrThrow: coachRouteDeps.resolveCoachRelationshipOrThrow,
    buildCoachWorkspace: coachRouteDeps.buildCoachWorkspace,
    getVisibleCoachFeed: coachRouteDeps.getVisibleCoachFeed,
    createNote: coachRouteDeps.repo.createNote,
    createOutboundMessage: coachRouteDeps.repo.createOutboundMessage,
    getOutboundMessageForCoachStudent: coachRouteDeps.repo.getOutboundMessageForCoachStudent,
    updateOutboundMessageStatus: coachRouteDeps.repo.updateOutboundMessageStatus,
    getStudentUserId: coachRouteDeps.repo.getStudentUserId,
    getParentUserIdForHousehold: coachRouteDeps.repo.getParentUserIdForHousehold,
    getCommunicationProvider: coachRouteDeps.getCommunicationProvider,
    newId: coachRouteDeps.newId,
  };

  return run().finally(() => {
    coachRouteDeps.resolveRequestContext = originals.resolveRequestContext;
    coachRouteDeps.listCoachRoster = originals.listCoachRoster;
    coachRouteDeps.resolveCoachRelationshipOrThrow = originals.resolveCoachRelationshipOrThrow;
    coachRouteDeps.buildCoachWorkspace = originals.buildCoachWorkspace;
    coachRouteDeps.getVisibleCoachFeed = originals.getVisibleCoachFeed;
    coachRouteDeps.repo.createNote = originals.createNote;
    coachRouteDeps.repo.createOutboundMessage = originals.createOutboundMessage;
    coachRouteDeps.repo.getOutboundMessageForCoachStudent = originals.getOutboundMessageForCoachStudent;
    coachRouteDeps.repo.updateOutboundMessageStatus = originals.updateOutboundMessageStatus;
    coachRouteDeps.repo.getStudentUserId = originals.getStudentUserId;
    coachRouteDeps.repo.getParentUserIdForHousehold = originals.getParentUserIdForHousehold;
    coachRouteDeps.getCommunicationProvider = originals.getCommunicationProvider;
    coachRouteDeps.newId = originals.newId;
  });
}

const coachContext = {
  authenticatedUserId: "coach-user",
  authenticatedRoleType: "coach",
  householdId: "household-1",
  studentProfileId: "11111111-1111-4111-8111-111111111111",
  studentUserId: "student-user",
};

const relationship = {
  coachStudentRelationshipId: "rel-1",
  coachUserId: "coach-user",
  studentProfileId: "11111111-1111-4111-8111-111111111111",
  studentDisplayName: "Maya Chen",
  householdId: "household-1",
  relationshipStatus: "active",
  startDate: "2026-01-01",
  endDate: null,
  nextReviewDate: "2026-05-01",
  createdByUserId: "coach-user",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  permissions: {
    viewStudentProfile: true,
    viewEvidence: true,
    createNotes: true,
    createRecommendations: true,
    createActionItems: true,
    sendCommunications: true,
    viewParentFacingSummaries: true,
  },
};

test("coachRosterRoute returns only the assigned roster", async () => {
  await withStubbedDeps(async () => {
    coachRouteDeps.resolveRequestContext = async () => coachContext as any;
    coachRouteDeps.listCoachRoster = async () =>
      [
        {
          ...relationship,
          readinessStatus: "watch",
          evidenceCompletenessStatus: "moderate",
          openActionItems: 2,
          activeFlags: 1,
          lastCoachNoteDate: "2026-04-20",
        },
      ] as any;

    const response = createResponse();
    await coachRosterRoute(createRequest(undefined, "GET"), response.res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.count, 1);
    assert.equal(response.json.roster[0].studentDisplayName, "Maya Chen");
  });
});

test("coachWorkspaceRoute blocks access to an unassigned student", async () => {
  await withStubbedDeps(async () => {
    coachRouteDeps.resolveRequestContext = async () => coachContext as any;
    coachRouteDeps.resolveCoachRelationshipOrThrow = async () => null;

    const response = createResponse();
    await coachWorkspaceRoute(
      createRequest(undefined, "GET", "/coaches/me/workspace?studentProfileId=22222222-2222-4222-8222-222222222222"),
      response.res
    );

    assert.equal(response.statusCode, 403);
    assert.equal(response.json.error, "forbidden");
  });
});

test("coachNoteCreateRoute saves a note for an assigned student", async () => {
  await withStubbedDeps(async () => {
    let created: any = null;
    coachRouteDeps.resolveRequestContext = async () => coachContext as any;
    coachRouteDeps.resolveCoachRelationshipOrThrow = async () => relationship as any;
    coachRouteDeps.newId = () => "11111111-1111-4111-8111-111111111111";
    coachRouteDeps.repo.createNote = async (input: any) => {
      created = input;
    };

    const response = createResponse();
    await coachNoteCreateRoute(
      createRequest({
        noteType: "session_note",
        title: "Session recap",
        body: "Student needs a tighter follow-up loop.",
        visibility: "coach_private",
        studentProfileId: "11111111-1111-4111-8111-111111111111",
      }),
      response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(created.studentProfileId, "11111111-1111-4111-8111-111111111111");
    assert.equal(created.coachUserId, "coach-user");
    assert.equal(created.visibility, "coach_private");
  });
});

test("studentCoachFeedRoute returns coach-sourced records for the authenticated student", async () => {
  await withStubbedDeps(async () => {
    coachRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "student-user",
        authenticatedRoleType: "student",
        householdId: "household-1",
        studentProfileId: "11111111-1111-4111-8111-111111111111",
        studentUserId: "student-user",
      }) as any;
    coachRouteDeps.getVisibleCoachFeed = async () =>
      ({
        recommendations: [
          {
            coachRecommendationId: "rec-1",
            coachUserId: "coach-user",
            coachDisplayName: "Taylor Brooks",
            studentProfileId: "11111111-1111-4111-8111-111111111111",
            householdId: "household-1",
            title: "Tighten networking plan",
            recommendationCategory: "networking",
            rationale: "Needed now",
            recommendedNextStep: "Reach out to 3 alumni",
            expectedBenefit: null,
            priority: "high",
            dueDate: null,
            visibility: "student_visible",
            status: "active",
            createdAt: "",
            updatedAt: "",
            archivedAt: null,
          },
        ],
        actionItems: [],
        flags: [],
        notes: [],
      }) as any;

    const response = createResponse();
    await studentCoachFeedRoute(createRequest(undefined, "GET"), response.res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.feed.recommendations[0].coachDisplayName, "Taylor Brooks");
  });
});

test("studentCoachFeedRoute forbids parent role access", async () => {
  await withStubbedDeps(async () => {
    coachRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "parent-user",
        authenticatedRoleType: "parent",
        householdId: "household-1",
        studentProfileId: "11111111-1111-4111-8111-111111111111",
      }) as any;

    const response = createResponse();
    await studentCoachFeedRoute(createRequest(undefined, "GET"), response.res);

    assert.equal(response.statusCode, 403);
    assert.equal(response.json.error, "forbidden");
  });
});

test("parentCoachFeedRoute returns only parent-visible coach records", async () => {
  await withStubbedDeps(async () => {
    coachRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "parent-user",
        authenticatedRoleType: "parent",
        householdId: "household-1",
        studentProfileId: "11111111-1111-4111-8111-111111111111",
        studentUserId: "student-user",
      }) as any;
    coachRouteDeps.getVisibleCoachFeed = async () =>
      ({
        recommendations: [],
        actionItems: [
          {
            coachActionItemId: "action-1",
            coachUserId: "coach-user",
            coachDisplayName: "Taylor Brooks",
            coachRecommendationId: null,
            studentProfileId: "11111111-1111-4111-8111-111111111111",
            householdId: "household-1",
            title: "Schedule a resume review",
            description: "Parent can help secure the time block.",
            priority: "medium",
            dueDate: null,
            status: "not_started",
            assignedTo: "parent",
            visibleToStudent: false,
            visibleToParent: true,
            createdAt: "",
            updatedAt: "",
            archivedAt: null,
          },
        ],
        flags: [],
        notes: [],
      }) as any;

    const response = createResponse();
    await parentCoachFeedRoute(createRequest(undefined, "GET"), response.res);

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.feed.actionItems[0].visibleToParent, true);
    assert.equal(response.json.feed.actionItems[0].coachDisplayName, "Taylor Brooks");
  });
});

test("parentCoachFeedRoute forbids student role access", async () => {
  await withStubbedDeps(async () => {
    coachRouteDeps.resolveRequestContext = async () =>
      ({
        authenticatedUserId: "student-user",
        authenticatedRoleType: "student",
        householdId: "household-1",
        studentProfileId: "11111111-1111-4111-8111-111111111111",
      }) as any;

    const response = createResponse();
    await parentCoachFeedRoute(createRequest(undefined, "GET"), response.res);

    assert.equal(response.statusCode, 403);
    assert.equal(response.json.error, "forbidden");
  });
});

test("coachOutboundDraftSaveRoute saves a draft without sending a real message", async () => {
  await withStubbedDeps(async () => {
    let created: any = null;
    coachRouteDeps.resolveRequestContext = async () => coachContext as any;
    coachRouteDeps.resolveCoachRelationshipOrThrow = async () => relationship as any;
    coachRouteDeps.repo.getStudentUserId = async () => "student-user";
    coachRouteDeps.newId = () => "11111111-1111-4111-8111-111111111111";
    coachRouteDeps.repo.createOutboundMessage = async (input: any) => {
      created = input;
    };

    const response = createResponse();
    await coachOutboundDraftSaveRoute(
      createRequest({
        studentProfileId: "11111111-1111-4111-8111-111111111111",
        recipientType: "student",
        channel: "email",
        body: "Please bring your updated resume to our next session.",
        status: "draft",
      }),
      response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(created.status, "draft");
    assert.equal(created.providerMode, "not_sent");
    assert.equal(created.recipientUserId, "student-user");
  });
});

test("coachOutboundSendMockRoute records a mock send without using a real provider", async () => {
  await withStubbedDeps(async () => {
    let updated: any = null;
    coachRouteDeps.resolveRequestContext = async () => coachContext as any;
    coachRouteDeps.resolveCoachRelationshipOrThrow = async () => relationship as any;
    coachRouteDeps.repo.getOutboundMessageForCoachStudent = async () =>
      ({
        coachOutboundMessageId: "11111111-1111-4111-8111-111111111111",
        coachUserId: "coach-user",
        studentProfileId: "11111111-1111-4111-8111-111111111111",
        householdId: "household-1",
        recipientType: "student",
        recipientUserId: "student-user",
        channel: "email",
        subject: null,
        body: "Follow up on the action item.",
        status: "ready",
        providerMode: "not_sent",
        externalMessageId: null,
        linkedCoachActionItemId: null,
        linkedCoachRecommendationId: null,
        createdAt: "",
        updatedAt: "",
        sentAt: null,
        archivedAt: null,
      }) as any;
    coachRouteDeps.repo.updateOutboundMessageStatus = async (input: any) => {
      updated = input;
    };
    coachRouteDeps.getCommunicationProvider = () =>
      ({
        send: async () => ({
          ok: true,
          providerMode: "mock",
          status: "delivered",
          externalMessageId: "mock-1",
          note: "Mock send only",
        }),
      }) as any;

    const response = createResponse();
    await coachOutboundSendMockRoute(
      createRequest({
        studentProfileId: "11111111-1111-4111-8111-111111111111",
        coachOutboundMessageId: "11111111-1111-4111-8111-111111111111",
      }),
      response.res
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.sent, true);
    assert.equal(updated.status, "sent");
    assert.equal(updated.providerMode, "mock");
  });
});
