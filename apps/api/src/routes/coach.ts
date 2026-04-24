import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { CoachRepository } from "../repositories/coach/coachRepository";
import { resolveRequestContext } from "../services/auth/resolveRequestContext";
import { getCommunicationProvider } from "../services/communication/provider";
import {
  buildCoachWorkspace,
  getVisibleCoachFeed,
  listCoachRoster,
  resolveCoachRelationshipOrThrow,
} from "../services/coach/workspace";
import { canAccessCoachWorkspace, requireRelationshipPermission } from "../services/coach/access";
import { readJsonBody } from "../utils/body";
import { badRequest, forbidden, json, unauthorized } from "../utils/http";

const repo = new CoachRepository();

export const coachRouteDeps = {
  repo,
  resolveRequestContext,
  listCoachRoster,
  resolveCoachRelationshipOrThrow,
  buildCoachWorkspace,
  getVisibleCoachFeed,
  getCommunicationProvider,
  newId: () => crypto.randomUUID(),
};

function requireCoachRole(role: string) {
  if (!canAccessCoachWorkspace(role)) {
    throw new Error("FORBIDDEN_COACH");
  }
}

function requireParentRole(role: string) {
  if (!(role === "parent" || role === "admin")) {
    throw new Error("FORBIDDEN_PARENT");
  }
}

function requireStudentRole(role: string) {
  if (!(role === "student" || role === "admin")) {
    throw new Error("FORBIDDEN_STUDENT");
  }
}

function optionalTrimmedString(maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed || undefined;
    },
    z.string().max(maxLength).optional()
  );
}

const visibilityEnum = z.enum([
  "coach_private",
  "student_visible",
  "parent_visible",
  "student_and_parent_visible",
  "internal_system_context",
]);

const noteSchema = z.object({
  studentProfileId: z.string().uuid(),
  noteType: z.enum([
    "session_note",
    "observation",
    "risk_note",
    "strength_note",
    "parent_context_note",
    "follow_up_note",
    "other",
  ]),
  title: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(6000),
  tags: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  visibility: visibilityEnum.default("coach_private"),
  sessionDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const findingSchema = z.object({
  studentProfileId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  findingCategory: z.enum([
    "academic_gap",
    "career_direction",
    "execution_risk",
    "communication_issue",
    "motivation_or_confidence",
    "experience_gap",
    "network_gap",
    "application_strategy",
    "strength",
    "other",
  ]),
  severity: z.enum(["low", "medium", "high", "urgent"]),
  evidenceBasis: optionalTrimmedString(2000),
  explanation: z.string().trim().min(1).max(6000),
  visibility: visibilityEnum.default("coach_private"),
});

const recommendationSchema = z.object({
  studentProfileId: z.string().uuid(),
  title: z.string().trim().min(1).max(240),
  recommendationCategory: z.enum([
    "academic",
    "career_target",
    "resume",
    "internship_search",
    "networking",
    "interview_prep",
    "project_or_portfolio",
    "communication",
    "outcome_tracking",
    "other",
  ]),
  rationale: z.string().trim().min(1).max(5000),
  recommendedNextStep: z.string().trim().min(1).max(5000),
  expectedBenefit: optionalTrimmedString(2000),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  visibility: visibilityEnum.default("coach_private"),
  status: z.enum(["draft", "active", "accepted", "declined", "completed", "archived"]).default("active"),
});

const actionItemSchema = z.object({
  studentProfileId: z.string().uuid(),
  coachRecommendationId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(240),
  description: optionalTrimmedString(4000),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["not_started", "in_progress", "blocked", "completed", "deferred", "archived"]).default("not_started"),
  assignedTo: z.enum(["student", "parent", "coach", "shared"]).default("student"),
  visibleToStudent: z.boolean().default(true),
  visibleToParent: z.boolean().default(false),
});

const flagSchema = z.object({
  studentProfileId: z.string().uuid(),
  flagType: z.enum([
    "missing_evidence",
    "academic_risk",
    "application_stall",
    "communication_breakdown",
    "missed_deadline",
    "no_outcome_activity",
    "high_parent_concern",
    "coach_attention_needed",
    "other",
  ]),
  severity: z.enum(["info", "warning", "high", "urgent"]),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(4000),
  status: z.enum(["open", "acknowledged", "resolved", "archived"]).default("open"),
  visibility: visibilityEnum.default("coach_private"),
});

const outboundDraftSchema = z.object({
  studentProfileId: z.string().uuid(),
  recipientType: z.enum(["student", "parent"]),
  channel: z.enum(["email", "sms", "whatsapp"]),
  subject: optionalTrimmedString(240),
  body: z.string().trim().min(1).max(6000),
  status: z.enum(["draft", "ready"]).default("draft"),
  linkedCoachActionItemId: z.string().uuid().optional(),
  linkedCoachRecommendationId: z.string().uuid().optional(),
});

const outboundSendSchema = z.object({
  studentProfileId: z.string().uuid(),
  coachOutboundMessageId: z.string().uuid(),
});

function formatZodError(error: z.ZodError): string {
  return (
    error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ") ||
    "Invalid request body"
  );
}

async function parseBody<T extends z.ZodTypeAny>(
  req: IncomingMessage,
  schema: T,
  res: ServerResponse
): Promise<z.infer<T> | null> {
  let raw: unknown;
  try {
    raw = await readJsonBody(req);
  } catch {
    badRequest(res, "Invalid JSON body");
    return null;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    badRequest(res, formatZodError(parsed.error));
    return null;
  }

  return parsed.data;
}

function getSearchParams(req: IncomingMessage) {
  return new URL(req.url || "/", "http://localhost").searchParams;
}

async function requireAuthorizedRelationship(
  req: IncomingMessage,
  res: ServerResponse,
  studentProfileId?: string | null
) {
  const ctx = await coachRouteDeps.resolveRequestContext(req);
  requireCoachRole(ctx.authenticatedRoleType);
  const relationship = await coachRouteDeps.resolveCoachRelationshipOrThrow(ctx, studentProfileId ?? null);

  if (!relationship) {
    if (studentProfileId) {
      forbidden(res, "Coach access is limited to assigned students");
      return null;
    }
    return { ctx, relationship: null };
  }

  return { ctx, relationship };
}

export async function coachRosterRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await coachRouteDeps.resolveRequestContext(req);
    requireCoachRole(ctx.authenticatedRoleType);
    const roster = await coachRouteDeps.listCoachRoster(ctx);
    return json(res, 200, { ok: true, count: roster.length, roster });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function coachWorkspaceRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const params = getSearchParams(req);
    const requestedStudentProfileId = params.get("studentProfileId");
    const authorized = await requireAuthorizedRelationship(req, res, requestedStudentProfileId);
    if (!authorized) return;
    if (!authorized.relationship) {
      return json(res, 200, { ok: true, selectedStudentProfileId: null, workspace: null });
    }

    const workspace = await coachRouteDeps.buildCoachWorkspace(authorized.ctx, authorized.relationship);
    return json(res, 200, {
      ok: true,
      selectedStudentProfileId: authorized.relationship.studentProfileId,
      workspace,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function coachNoteCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, noteSchema, res);
    if (!body) return;
    const authorized = await requireAuthorizedRelationship(req, res, body.studentProfileId);
    if (!authorized) return;
    if (!authorized.relationship) return forbidden(res, "Coach access is limited to assigned students");
    if (!requireRelationshipPermission(authorized.relationship, "createNotes")) {
      return forbidden(res, "This coach relationship does not allow note creation");
    }

    await coachRouteDeps.repo.createNote({
      coachNoteId: coachRouteDeps.newId(),
      coachUserId: authorized.ctx.authenticatedUserId,
      studentProfileId: body.studentProfileId,
      householdId: authorized.relationship.householdId,
      noteType: body.noteType,
      title: body.title,
      body: body.body,
      tags: body.tags,
      visibility: body.visibility,
      sessionDate: body.sessionDate ?? null,
    });

    return json(res, 200, { ok: true, message: "Coach note saved" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function coachFindingCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, findingSchema, res);
    if (!body) return;
    const authorized = await requireAuthorizedRelationship(req, res, body.studentProfileId);
    if (!authorized) return;
    if (!authorized.relationship) return forbidden(res, "Coach access is limited to assigned students");
    if (!requireRelationshipPermission(authorized.relationship, "createRecommendations")) {
      return forbidden(res, "This coach relationship does not allow findings or recommendations");
    }

    await coachRouteDeps.repo.createFinding({
      coachFindingId: coachRouteDeps.newId(),
      coachUserId: authorized.ctx.authenticatedUserId,
      studentProfileId: body.studentProfileId,
      householdId: authorized.relationship.householdId,
      title: body.title,
      findingCategory: body.findingCategory,
      severity: body.severity,
      evidenceBasis: body.evidenceBasis ?? null,
      explanation: body.explanation,
      visibility: body.visibility,
    });

    return json(res, 200, { ok: true, message: "Coach finding saved" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function coachRecommendationCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, recommendationSchema, res);
    if (!body) return;
    const authorized = await requireAuthorizedRelationship(req, res, body.studentProfileId);
    if (!authorized) return;
    if (!authorized.relationship) return forbidden(res, "Coach access is limited to assigned students");
    if (!requireRelationshipPermission(authorized.relationship, "createRecommendations")) {
      return forbidden(res, "This coach relationship does not allow recommendation creation");
    }

    await coachRouteDeps.repo.createRecommendation({
      coachRecommendationId: coachRouteDeps.newId(),
      coachUserId: authorized.ctx.authenticatedUserId,
      studentProfileId: body.studentProfileId,
      householdId: authorized.relationship.householdId,
      title: body.title,
      recommendationCategory: body.recommendationCategory,
      rationale: body.rationale,
      recommendedNextStep: body.recommendedNextStep,
      expectedBenefit: body.expectedBenefit ?? null,
      priority: body.priority,
      dueDate: body.dueDate ?? null,
      visibility: body.visibility,
      status: body.status,
    });

    return json(res, 200, { ok: true, message: "Coach recommendation saved" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function coachActionItemCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, actionItemSchema, res);
    if (!body) return;
    const authorized = await requireAuthorizedRelationship(req, res, body.studentProfileId);
    if (!authorized) return;
    if (!authorized.relationship) return forbidden(res, "Coach access is limited to assigned students");
    if (!requireRelationshipPermission(authorized.relationship, "createActionItems")) {
      return forbidden(res, "This coach relationship does not allow action-item creation");
    }

    await coachRouteDeps.repo.createActionItem({
      coachActionItemId: coachRouteDeps.newId(),
      coachUserId: authorized.ctx.authenticatedUserId,
      coachRecommendationId: body.coachRecommendationId ?? null,
      studentProfileId: body.studentProfileId,
      householdId: authorized.relationship.householdId,
      title: body.title,
      description: body.description ?? null,
      priority: body.priority,
      dueDate: body.dueDate ?? null,
      status: body.status,
      assignedTo: body.assignedTo,
      visibleToStudent: body.visibleToStudent,
      visibleToParent: body.visibleToParent,
    });

    return json(res, 200, { ok: true, message: "Coach action item saved" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function coachFlagCreateRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, flagSchema, res);
    if (!body) return;
    const authorized = await requireAuthorizedRelationship(req, res, body.studentProfileId);
    if (!authorized) return;
    if (!authorized.relationship) return forbidden(res, "Coach access is limited to assigned students");
    if (!requireRelationshipPermission(authorized.relationship, "createRecommendations")) {
      return forbidden(res, "This coach relationship does not allow flag creation");
    }

    await coachRouteDeps.repo.createFlag({
      coachFlagId: coachRouteDeps.newId(),
      studentProfileId: body.studentProfileId,
      householdId: authorized.relationship.householdId,
      createdByUserId: authorized.ctx.authenticatedUserId,
      createdByRole: authorized.ctx.authenticatedRoleType === "admin" ? "admin" : "coach",
      flagType: body.flagType,
      severity: body.severity,
      title: body.title,
      description: body.description,
      status: body.status,
      visibility: body.visibility,
    });

    return json(res, 200, { ok: true, message: "Coach flag saved" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function coachOutboundDraftSaveRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, outboundDraftSchema, res);
    if (!body) return;
    const authorized = await requireAuthorizedRelationship(req, res, body.studentProfileId);
    if (!authorized) return;
    if (!authorized.relationship) return forbidden(res, "Coach access is limited to assigned students");
    if (!requireRelationshipPermission(authorized.relationship, "sendCommunications")) {
      return forbidden(res, "This coach relationship does not allow outbound communication");
    }

    const recipientUserId =
      body.recipientType === "student"
        ? await coachRouteDeps.repo.getStudentUserId(body.studentProfileId)
        : await coachRouteDeps.repo.getParentUserIdForHousehold(authorized.relationship.householdId);

    await coachRouteDeps.repo.createOutboundMessage({
      coachOutboundMessageId: coachRouteDeps.newId(),
      coachUserId: authorized.ctx.authenticatedUserId,
      studentProfileId: body.studentProfileId,
      householdId: authorized.relationship.householdId,
      recipientType: body.recipientType,
      recipientUserId,
      channel: body.channel,
      subject: body.subject ?? null,
      body: body.body,
      status: body.status,
      providerMode: "not_sent",
      linkedCoachActionItemId: body.linkedCoachActionItemId ?? null,
      linkedCoachRecommendationId: body.linkedCoachRecommendationId ?? null,
    });

    return json(res, 200, { ok: true, message: body.status === "ready" ? "Coach message marked ready" : "Coach draft saved" });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function coachOutboundSendMockRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = await parseBody(req, outboundSendSchema, res);
    if (!body) return;
    const authorized = await requireAuthorizedRelationship(req, res, body.studentProfileId);
    if (!authorized) return;
    if (!authorized.relationship) return forbidden(res, "Coach access is limited to assigned students");
    if (!requireRelationshipPermission(authorized.relationship, "sendCommunications")) {
      return forbidden(res, "This coach relationship does not allow outbound communication");
    }

    const draft = await coachRouteDeps.repo.getOutboundMessageForCoachStudent(
      authorized.ctx.authenticatedUserId,
      body.studentProfileId,
      body.coachOutboundMessageId
    );
    if (!draft) {
      return badRequest(res, "Coach outbound draft was not found for the selected student");
    }

    const provider = coachRouteDeps.getCommunicationProvider();
    const result = await provider.send({
      channel: draft.channel,
      messageBody: draft.body,
      studentProfileId: draft.studentProfileId,
      strategyId: draft.coachOutboundMessageId,
      metadata: {
        recipientType: draft.recipientType,
        source: "coach_outbound_message",
      },
    });

    const sent = result.status === "delivered";
    await coachRouteDeps.repo.updateOutboundMessageStatus({
      coachOutboundMessageId: draft.coachOutboundMessageId,
      status: sent ? "sent" : "failed",
      providerMode: result.providerMode,
      externalMessageId: result.externalMessageId,
      sentAt: sent ? new Date().toISOString() : null,
    });

    return json(res, 200, {
      ok: result.ok,
      sent,
      status: sent ? "sent" : "failed",
      providerMode: result.providerMode,
      note: result.note,
    });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_COACH") return forbidden(res, "Coach access is required");
    throw error;
  }
}

export async function studentCoachFeedRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await coachRouteDeps.resolveRequestContext(req);
    requireStudentRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const feed = await coachRouteDeps.getVisibleCoachFeed(ctx.studentProfileId, "student");
    return json(res, 200, { ok: true, feed });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_STUDENT") return forbidden(res, "Student access is required");
    throw error;
  }
}

export async function parentCoachFeedRoute(req: IncomingMessage, res: ServerResponse) {
  try {
    const ctx = await coachRouteDeps.resolveRequestContext(req);
    requireParentRole(ctx.authenticatedRoleType);
    if (!ctx.studentProfileId) {
      return badRequest(res, "No student profile could be resolved for the authenticated user");
    }

    const feed = await coachRouteDeps.getVisibleCoachFeed(ctx.studentProfileId, "parent");
    return json(res, 200, { ok: true, feed });
  } catch (error: any) {
    if (error?.message === "UNAUTHENTICATED") return unauthorized(res);
    if (error?.message === "FORBIDDEN_PARENT") return forbidden(res, "Parent access is required");
    throw error;
  }
}
